import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  getAuthenticationProvider: vi.fn(),
  isAuthAttemptAllowed: vi.fn(),
  requestPasswordReset: vi.fn(),
  recordAuthAuditEvent: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/auth/neon-provider", () => ({
  getAuthenticationProvider: doubles.getAuthenticationProvider,
}));
vi.mock("@/auth/customer-registration", () => ({
  requestCustomerRegistration: vi.fn(),
}));
vi.mock("@/auth/enforce-rate-limit", () => ({
  isAuthAttemptAllowed: doubles.isAuthAttemptAllowed,
}));
vi.mock("@/db/client", () => ({ getDatabase: vi.fn(() => ({})) }));
vi.mock("@/modules/identity-access/repository", () => ({
  loadApplicationAccess: vi.fn(),
  provisionCustomerProfile: vi.fn(),
  recordAuthAuditEvent: doubles.recordAuthAuditEvent,
}));

import { forgotPasswordAction } from "./auth-actions";

const initialState = { status: "IDLE" as const };

function forgotPasswordForm(): FormData {
  const formData = new FormData();
  formData.set("locale", "en");
  formData.set("email", "synthetic@example.invalid");
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  doubles.isAuthAttemptAllowed.mockResolvedValue(true);
  doubles.requestPasswordReset.mockResolvedValue(undefined);
  doubles.getAuthenticationProvider.mockReturnValue({
    requestPasswordReset: doubles.requestPasswordReset,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("production password-reset callback configuration", () => {
  it.each([
    "http://public.example.invalid",
    "https://127.0.0.1",
    "https://reset.localhost",
    "https://[::ffff:127.0.0.1]",
    "https://operator:password@public.example.invalid",
    "https://public.example.invalid/unexpected-path",
  ])(
    "does not send a reset request through an unsafe public origin",
    async (origin) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("PUBLIC_SITE_URL", origin);

      await expect(
        forgotPasswordAction(initialState, forgotPasswordForm()),
      ).resolves.toMatchObject({ status: "SUCCESS" });
      expect(doubles.requestPasswordReset).not.toHaveBeenCalled();
    },
  );

  it("passes the selected locale through a valid production callback", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_SITE_URL", "https://public.example.invalid");

    await expect(
      forgotPasswordAction(initialState, forgotPasswordForm()),
    ).resolves.toMatchObject({ status: "SUCCESS" });
    expect(doubles.requestPasswordReset).toHaveBeenCalledWith(
      "synthetic@example.invalid",
      "https://public.example.invalid/en/reset-password",
    );
  });
});
