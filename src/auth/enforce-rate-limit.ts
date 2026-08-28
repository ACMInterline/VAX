import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import {
  createRuntimeAuthRateLimiter,
  SharedAuthRateLimiter,
  type AuthRateLimiter,
  type AuthAttemptScope,
} from "./rate-limit";
import { PostgresSharedRateLimitStore } from "@/db/shared-rate-limit-store";
import { getTrustedProxyHopCount } from "@/operations/environment";
import {
  reportOperationalError,
  type OperationalErrorReporter,
} from "@/operations/safe-log";

const processLocalHashSecret = randomBytes(32).toString("base64url");

function configuredHashSecret(
  environment: Readonly<Record<string, string | undefined>>,
): string | undefined {
  const configured = environment.RATE_LIMIT_HASH_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  return environment.RATE_LIMIT_BACKEND === "database"
    ? undefined
    : processLocalHashSecret;
}

const hashSecret = configuredHashSecret(process.env);
const sharedLimiter =
  hashSecret && process.env.RATE_LIMIT_BACKEND === "database"
  ? new SharedAuthRateLimiter(new PostgresSharedRateLimitStore())
  : undefined;
const rateLimiter = createRuntimeAuthRateLimiter(process.env, sharedLimiter);

function canonicalIpAddress(value: string): string | undefined {
  const trimmed = value.trim();
  const version = isIP(trimmed);
  if (version === 4) return new URL(`http://${trimmed}`).hostname;
  if (version === 6) {
    return new URL(`http://[${trimmed}]`).hostname.slice(1, -1);
  }
  return undefined;
}

function normalizedRateLimitSource(value: string): string {
  return canonicalIpAddress(value) ?? value.trim().toLowerCase();
}

export function deriveOpaqueRateLimitKey(
  sourceAddress: string,
  accountKey: string,
  secret: string,
): string {
  if (secret.length < 32) throw new Error("Rate-limit key security is invalid.");
  return createHmac("sha256", secret)
    .update("vax-rate-limit:v1")
    .update("\0")
    .update("source-account")
    .update("\0")
    .update(normalizedRateLimitSource(sourceAddress))
    .update("\0")
    .update(accountKey.trim().toLowerCase())
    .digest("hex");
}

export function deriveOpaqueSourceRateLimitKey(
  sourceAddress: string,
  secret: string,
): string {
  if (secret.length < 32) throw new Error("Rate-limit key security is invalid.");
  return createHmac("sha256", secret)
    .update("vax-rate-limit:v1")
    .update("\0")
    .update("source")
    .update("\0")
    .update(normalizedRateLimitSource(sourceAddress))
    .digest("hex");
}

export function deriveOpaqueAccountRateLimitKey(
  accountKey: string,
  secret: string,
): string {
  if (secret.length < 32) throw new Error("Rate-limit key security is invalid.");
  return createHmac("sha256", secret)
    .update("vax-rate-limit:v1")
    .update("\0")
    .update("account")
    .update("\0")
    .update(accountKey.trim().toLowerCase())
    .digest("hex");
}

export function sourceAddressFromHeaders(
  requestHeaders: Pick<Headers, "get">,
  trustedProxyHops: number,
): string {
  if (trustedProxyHops === 0) return "untrusted-proxy";
  const forwarded = requestHeaders
    .get("x-forwarded-for")
    ?.split(",")
    .map(canonicalIpAddress);
  if (
    !forwarded?.length ||
    forwarded.length < trustedProxyHops ||
    forwarded.some((part) => part === undefined)
  ) {
    return "unknown";
  }
  // X-Forwarded-For omits the immediate proxy. Count backwards from the
  // trusted suffix so a client-supplied prefix cannot become the source key.
  const index = forwarded.length - trustedProxyHops;
  return forwarded[index] ?? "unknown";
}

function safeRouteForScope(scope: AuthAttemptScope): string {
  if (
    scope === "LOGIN" ||
    scope === "SIGNUP" ||
    scope === "PASSWORD_RESET" ||
    scope === "EMAIL_VERIFICATION"
  ) {
    return "/auth";
  }
  return scope === "PUBLIC_REQUEST" ? "/request" : "/app";
}

function scopeHasAccountDimension(scope: AuthAttemptScope): boolean {
  return scope !== "PUBLIC_REQUEST";
}

export async function evaluateRateLimitAttempt(
  input: Readonly<{
    scope: AuthAttemptScope;
    accountKey: string;
    requestHeaders: Pick<Headers, "get">;
    trustedProxyHops: number;
    hashSecret: string;
  }>,
  dependencies: Readonly<{
    limiter: AuthRateLimiter;
    reporter?: OperationalErrorReporter;
  }>,
): Promise<boolean> {
  const sourceAddress = sourceAddressFromHeaders(
    input.requestHeaders,
    input.trustedProxyHops,
  );
  if (input.trustedProxyHops > 0 && sourceAddress === "unknown") return false;
  const sourceAccountKey = deriveOpaqueRateLimitKey(
    sourceAddress,
    input.accountKey,
    input.hashSecret,
  );
  try {
    if (input.trustedProxyHops > 0) {
      const sourceKey = deriveOpaqueSourceRateLimitKey(
        sourceAddress,
        input.hashSecret,
      );
      const sourceResult = await dependencies.limiter.consume(
        input.scope,
        sourceKey,
        "SOURCE",
      );
      if (!sourceResult.allowed) return false;
    }
    if (scopeHasAccountDimension(input.scope)) {
      const accountResult = await dependencies.limiter.consume(
        input.scope,
        deriveOpaqueAccountRateLimitKey(input.accountKey, input.hashSecret),
        "ACCOUNT",
      );
      if (!accountResult.allowed) return false;
    }
    return (
      await dependencies.limiter.consume(
        input.scope,
        sourceAccountKey,
        "SOURCE_ACCOUNT",
      )
    ).allowed;
  } catch {
    const event = {
      eventCode: "RATE_LIMIT_BACKEND_FAILURE" as const,
      status: "ERROR" as const,
      route: safeRouteForScope(input.scope),
      errorClass: "DEPENDENCY_UNAVAILABLE" as const,
    };
    if (dependencies.reporter) {
      await dependencies.reporter.capture(event).catch(() => undefined);
    } else {
      await reportOperationalError(event);
    }
    return false;
  }
}

export async function isAuthAttemptAllowed(
  scope: AuthAttemptScope,
  accountKey: string,
): Promise<boolean> {
  if (!hashSecret) return false;
  try {
    return evaluateRateLimitAttempt(
      {
        scope,
        accountKey,
        requestHeaders: await headers(),
        trustedProxyHops: getTrustedProxyHopCount(),
        hashSecret,
      },
      { limiter: rateLimiter },
    );
  } catch {
    return false;
  }
}
