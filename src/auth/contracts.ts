export type UserId = string;

export type AuthenticatedUser = {
  id: UserId;
  email: string;
  displayName: string;
  emailVerified: boolean;
};

export type Session = {
  user: AuthenticatedUser;
  expiresAt: Date | null;
};

export type SignInCredentials = {
  email: string;
  password: string;
};

export type CustomerRegistration = SignInCredentials & {
  displayName: string;
};

export interface AuthenticationProvider {
  getSession(): Promise<Session | null>;
  signIn(credentials: SignInCredentials): Promise<AuthenticatedUser>;
  signUp(registration: CustomerRegistration): Promise<AuthenticatedUser>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;
  requestEmailVerification(email: string): Promise<void>;
  verifyEmail(email: string, otp: string): Promise<void>;
}

export class AuthenticationProviderError extends Error {
  readonly code:
    | "AUTHENTICATION_FAILED"
    | "PROVIDER_UNAVAILABLE"
    | "REQUEST_REJECTED";

  constructor(code: AuthenticationProviderError["code"]) {
    super(code);
    this.name = "AuthenticationProviderError";
    this.code = code;
  }
}
