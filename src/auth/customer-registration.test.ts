import { describe, expect, it, vi } from "vitest";
import type {
  AuthenticatedUser,
  AuthenticationProvider,
} from "./contracts";
import { requestCustomerRegistration } from "./customer-registration";

const user: AuthenticatedUser = {
  id: "provider-user",
  email: "synthetic@example.invalid",
  displayName: "Synthetic User",
  emailVerified: false,
};

function provider(signUp: AuthenticationProvider["signUp"]): AuthenticationProvider {
  return {
    getSession: vi.fn(),
    signIn: vi.fn(),
    signUp,
    signOut: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    requestEmailVerification: vi.fn().mockResolvedValue(undefined),
    verifyEmail: vi.fn(),
  };
}

const registration = {
  displayName: user.displayName,
  email: user.email,
  password: "synthetic-password",
};

describe("customer registration request", () => {
  it.each([
    ["provider success", vi.fn().mockResolvedValue(user)],
    ["provider rejection", vi.fn().mockRejectedValue(new Error("rejected"))],
  ])("returns the same completion outcome after %s", async (_case, signUp) => {
    const authenticationProvider = provider(signUp);

    await expect(
      requestCustomerRegistration({
        provider: authenticationProvider,
        registration,
        requireVerifiedEmail: false,
      }),
    ).resolves.toBeUndefined();
    expect(authenticationProvider.signOut).toHaveBeenCalledOnce();
  });

  it("requests provider verification without changing the generic outcome", async () => {
    const authenticationProvider = provider(vi.fn().mockResolvedValue(user));

    await expect(
      requestCustomerRegistration({
        provider: authenticationProvider,
        registration,
        requireVerifiedEmail: true,
      }),
    ).resolves.toBeUndefined();
    expect(authenticationProvider.requestEmailVerification).toHaveBeenCalledWith(
      registration.email,
    );
  });
});
