import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  getAuthenticationProvider: vi.fn(),
  isAuthAttemptAllowed: vi.fn(),
  requestCustomerRegistration: vi.fn(),
  requestPasswordReset: vi.fn(),
  requestEmailVerification: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/auth/neon-provider", () => ({
  getAuthenticationProvider: doubles.getAuthenticationProvider,
}));
vi.mock("@/auth/customer-registration", () => ({
  requestCustomerRegistration: doubles.requestCustomerRegistration,
}));
vi.mock("@/auth/enforce-rate-limit", () => ({
  isAuthAttemptAllowed: doubles.isAuthAttemptAllowed,
}));
vi.mock("@/db/client", () => ({ getDatabase: vi.fn(() => ({})) }));
vi.mock("@/modules/identity-access/repository", () => ({
  loadApplicationAccess: vi.fn(),
  provisionCustomerProfile: vi.fn(),
  recordAuthAuditEvent: vi.fn(),
}));

import {
  forgotPasswordAction,
  loginAction,
  requestEmailVerificationAction,
  signupAction,
  verifyEmailAction,
} from "./auth-actions";

const initialState = { status: "IDLE" as const };
const allowedEmail = "owner+phase3m@example.invalid";
const disallowedEmail = "outside@example.invalid";

function form(values: Readonly<Record<string, string>>): FormData {
  const result = new FormData();
  result.set("locale", "en");
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  return result;
}

function signupForm(email: string): FormData {
  return form({
    displayName: "Synthetic Owner",
    email,
    password: "synthetic-password-123",
    passwordConfirmation: "synthetic-password-123",
    preferredLocale: "en",
    termsAccepted: "on",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VAX_ENVIRONMENT", "staging");
  vi.stubEnv("PUBLIC_SITE_URL", "https://staging.example.invalid");
  vi.stubEnv("AUTH_TRUSTED_ORIGINS", "https://staging.example.invalid");
  vi.stubEnv("NEON_AUTH_BASE_URL", "https://auth.example.invalid/path");
  vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "x".repeat(32));
  vi.stubEnv("EMAIL_DELIVERY_MODE", "sandbox");
  vi.stubEnv("STAGING_AUTH_EMAIL_ALLOWLIST", allowedEmail);
  doubles.isAuthAttemptAllowed.mockResolvedValue(true);
  doubles.requestCustomerRegistration.mockResolvedValue(undefined);
  doubles.requestPasswordReset.mockResolvedValue(undefined);
  doubles.requestEmailVerification.mockResolvedValue(undefined);
  doubles.getAuthenticationProvider.mockReturnValue({
    requestPasswordReset: doubles.requestPasswordReset,
    requestEmailVerification: doubles.requestEmailVerification,
    signIn: doubles.signIn,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("hosted staging Auth recipient boundary", () => {
  it("keeps a disallowed signup generic without calling the provider", async () => {
    await expect(
      signupAction(initialState, signupForm(disallowedEmail)),
    ).resolves.toMatchObject({ status: "SUCCESS", nextStep: "VERIFY_EMAIL" });
    expect(doubles.requestCustomerRegistration).not.toHaveBeenCalled();
    expect(doubles.getAuthenticationProvider).not.toHaveBeenCalled();
  });

  it("allows an exact configured signup recipient", async () => {
    await expect(
      signupAction(initialState, signupForm(allowedEmail)),
    ).resolves.toMatchObject({ status: "SUCCESS", nextStep: "VERIFY_EMAIL" });
    expect(doubles.requestCustomerRegistration).toHaveBeenCalledOnce();
  });

  it("keeps a disallowed reset request generic without sending email", async () => {
    await expect(
      forgotPasswordAction(initialState, form({ email: disallowedEmail })),
    ).resolves.toMatchObject({ status: "SUCCESS" });
    expect(doubles.requestPasswordReset).not.toHaveBeenCalled();
  });

  it("does not call provider login or verification methods for disallowed email", async () => {
    await expect(
      loginAction(
        initialState,
        form({ email: disallowedEmail, password: "synthetic-password-123" }),
      ),
    ).resolves.toMatchObject({ status: "ERROR" });
    await expect(
      requestEmailVerificationAction(
        initialState,
        form({ email: disallowedEmail }),
      ),
    ).resolves.toMatchObject({ status: "SUCCESS" });
    await expect(
      verifyEmailAction(
        initialState,
        form({ email: disallowedEmail, otp: "123456" }),
      ),
    ).resolves.toMatchObject({ status: "ERROR" });

    expect(doubles.signIn).not.toHaveBeenCalled();
    expect(doubles.requestEmailVerification).not.toHaveBeenCalled();
  });
});
