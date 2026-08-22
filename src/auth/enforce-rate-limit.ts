import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import {
  createRuntimeAuthRateLimiter,
  type AuthAttemptScope,
} from "./rate-limit";

const rateLimiter = createRuntimeAuthRateLimiter();

export async function isAuthAttemptAllowed(
  scope: AuthAttemptScope,
  accountKey: string,
): Promise<boolean> {
  const requestHeaders = await headers();
  const forwardedAddress = requestHeaders.get("x-forwarded-for")?.split(",")[0];
  const source = `${forwardedAddress?.trim() || "unknown"}|${accountKey.trim().toLowerCase()}`;
  const opaqueKey = createHash("sha256").update(source).digest("hex");
  const result = await rateLimiter.consume(scope, opaqueKey);
  return result.allowed;
}
