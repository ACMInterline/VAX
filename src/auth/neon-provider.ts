import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import {
  AuthenticationProviderError,
  type AuthenticatedUser,
  type AuthenticationProvider,
  type CustomerRegistration,
  type Session,
  type SignInCredentials,
} from "./contracts";
import { getAuthRuntimeConfiguration } from "./config";

type NeonAuthClient = ReturnType<typeof createNeonAuth>;

let neonAuthClient: NeonAuthClient | undefined;

export function getNeonAuthClient(): NeonAuthClient {
  if (!neonAuthClient) {
    const configuration = getAuthRuntimeConfiguration();
    neonAuthClient = createNeonAuth({
      baseUrl: configuration.baseUrl,
      cookies: {
        secret: configuration.cookieSecret,
        sessionDataTtl: 300,
        sameSite: "strict",
      },
      logLevel: "silent",
    });
  }

  return neonAuthClient;
}

function mapUser(user: {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.name,
    emailVerified: user.emailVerified,
  };
}

class NeonAuthenticationProvider implements AuthenticationProvider {
  async getSession(): Promise<Session | null> {
    const result = await getNeonAuthClient().getSession();
    if (result.error || !result.data?.user || !result.data.session) {
      return null;
    }

    return {
      user: mapUser(result.data.user),
      expiresAt: new Date(result.data.session.expiresAt),
    };
  }

  async signIn(credentials: SignInCredentials): Promise<AuthenticatedUser> {
    const result = await getNeonAuthClient().signIn.email({
      email: credentials.email,
      password: credentials.password,
      rememberMe: false,
    });
    if (result.error || !result.data?.user) {
      throw new AuthenticationProviderError("AUTHENTICATION_FAILED");
    }
    return mapUser(result.data.user);
  }

  async signUp(registration: CustomerRegistration): Promise<AuthenticatedUser> {
    const result = await getNeonAuthClient().signUp.email({
      email: registration.email,
      password: registration.password,
      name: registration.displayName,
    });
    if (result.error || !result.data?.user) {
      throw new AuthenticationProviderError("REQUEST_REJECTED");
    }
    return mapUser(result.data.user);
  }

  async signOut(): Promise<void> {
    const result = await getNeonAuthClient().signOut();
    if (result.error) {
      throw new AuthenticationProviderError("PROVIDER_UNAVAILABLE");
    }
  }

  async requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    const result = await getNeonAuthClient().requestPasswordReset({
      email,
      redirectTo,
    });
    if (result.error) {
      throw new AuthenticationProviderError("REQUEST_REJECTED");
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const result = await getNeonAuthClient().resetPassword({
      newPassword,
      token,
    });
    if (result.error) {
      throw new AuthenticationProviderError("REQUEST_REJECTED");
    }
  }

  async requestEmailVerification(email: string): Promise<void> {
    const result = await getNeonAuthClient().emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    if (result.error) {
      throw new AuthenticationProviderError("REQUEST_REJECTED");
    }
  }

  async verifyEmail(email: string, otp: string): Promise<void> {
    const result = await getNeonAuthClient().emailOtp.verifyEmail({ email, otp });
    if (result.error) {
      throw new AuthenticationProviderError("REQUEST_REJECTED");
    }
  }
}

let provider: AuthenticationProvider | undefined;

export function getAuthenticationProvider(): AuthenticationProvider {
  provider ??= new NeonAuthenticationProvider();
  return provider;
}
