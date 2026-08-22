import type {
  AuthenticationProvider,
  CustomerRegistration,
} from "./contracts";

export async function requestCustomerRegistration(input: {
  provider: AuthenticationProvider;
  registration: CustomerRegistration;
  requireVerifiedEmail: boolean;
}): Promise<void> {
  let registeredUser = null;
  try {
    registeredUser = await input.provider.signUp(input.registration);
  } catch {
    // Duplicate and unavailable-provider outcomes intentionally remain indistinguishable.
  }

  if (
    registeredUser &&
    input.requireVerifiedEmail &&
    !registeredUser.emailVerified
  ) {
    await input.provider
      .requestEmailVerification(input.registration.email)
      .catch(() => undefined);
  }

  await input.provider.signOut().catch(() => undefined);
}
