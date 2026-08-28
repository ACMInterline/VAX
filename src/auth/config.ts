import { isLiteralLoopbackOrUnspecifiedHostname } from "@/lib/url-security";
import { getConfiguredPublicUrl } from "@/lib/public-metadata";
import {
  getVaxEnvironment,
  isStrictHostedEnvironment,
} from "@/operations/environment";

export type AuthRuntimeConfiguration = {
  baseUrl: string;
  cookieSecret: string;
  requireVerifiedEmail: boolean;
  trustedOrigins: readonly string[];
};

function configuredTrustedOrigins(
  environment: Readonly<Record<string, string | undefined>>,
): readonly string[] {
  const deployment = getVaxEnvironment(environment);
  const configured = environment.AUTH_TRUSTED_ORIGINS?.trim();
  if (!configured) {
    if (deployment === "development") return [];
    throw new Error("Authentication trusted origins are not configured.");
  }

  const strictHosted = isStrictHostedEnvironment(environment);
  const origins = new Set<string>();
  for (const candidate of configured.split(",")) {
    const value = candidate.trim();
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error("Authentication trusted origins are not configured.");
    }
    const loopback = isLiteralLoopbackOrUnspecifiedHostname(parsed.hostname);
    const localHttp = !strictHosted && parsed.protocol === "http:" && loopback;
    if (
      !value ||
      value.includes("*") ||
      (parsed.protocol !== "https:" && !localHttp) ||
      (strictHosted && loopback) ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.pathname !== "/" ||
      parsed.search !== "" ||
      parsed.hash !== ""
    ) {
      throw new Error("Authentication trusted origins are not configured.");
    }
    origins.add(parsed.origin);
  }

  const publicSiteUrl = getConfiguredPublicUrl(environment);
  if (deployment !== "development" && !publicSiteUrl) {
    throw new Error("Authentication trusted origins are not configured.");
  }
  if (publicSiteUrl && !origins.has(publicSiteUrl.origin)) {
    throw new Error("Authentication trusted origins are not configured.");
  }
  return [...origins].sort();
}

export function getAuthRuntimeConfiguration(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AuthRuntimeConfiguration {
  const baseUrl = environment.NEON_AUTH_BASE_URL?.trim();
  const cookieSecret = environment.NEON_AUTH_COOKIE_SECRET?.trim();

  if (!baseUrl) {
    throw new Error("Authentication service is not configured.");
  }
  if (!cookieSecret || cookieSecret.length < 32) {
    throw new Error("Authentication cookie security is not configured.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error("Authentication service is not configured.");
  }
  const isLoopback = isLiteralLoopbackOrUnspecifiedHostname(
    parsedUrl.hostname,
  );
  const strictHosted = isStrictHostedEnvironment(environment);
  const localHttp =
    !strictHosted &&
    parsedUrl.protocol === "http:" &&
    isLoopback;
  if (
    (parsedUrl.protocol !== "https:" && !localHttp) ||
    (strictHosted && isLoopback) ||
    parsedUrl.username !== "" ||
    parsedUrl.password !== "" ||
    parsedUrl.search !== "" ||
    parsedUrl.hash !== "" ||
    baseUrl.includes("?") ||
    baseUrl.includes("#")
  ) {
    throw new Error("Authentication service is not configured.");
  }

  return {
    baseUrl: parsedUrl.toString().replace(/\/$/, ""),
    cookieSecret,
    requireVerifiedEmail:
      getVaxEnvironment(environment) !== "development" ||
      environment.AUTH_REQUIRE_VERIFIED_EMAIL === "true",
    trustedOrigins: configuredTrustedOrigins(environment),
  };
}
