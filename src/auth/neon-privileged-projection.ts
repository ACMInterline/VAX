import {
  PrivilegedAuthenticationProviderError,
  type PrivilegedAuthUserSummary,
} from "./privileged-provider";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeCreatedAt(value: unknown): string {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) {
    throw new PrivilegedAuthenticationProviderError("INVALID_PROVIDER_RESPONSE");
  }
  return date.toISOString();
}

export function toPrivilegedAuthUserSummary(value: unknown): PrivilegedAuthUserSummary {
  if (
    !isRecord(value) ||
    typeof value.email !== "string" ||
    value.email.trim().length === 0 ||
    typeof value.emailVerified !== "boolean"
  ) {
    throw new PrivilegedAuthenticationProviderError("INVALID_PROVIDER_RESPONSE");
  }

  return {
    email: value.email.trim(),
    emailVerified: value.emailVerified,
    createdAt: normalizeCreatedAt(value.createdAt),
  };
}
