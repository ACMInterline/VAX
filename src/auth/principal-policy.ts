import type { Session } from "./contracts";
import type { ApplicationAccess } from "@/modules/identity-access/repository";

export type AuthenticationFailureCode =
  | "AUTHENTICATION_REQUIRED"
  | "ACCOUNT_NOT_PROVISIONED"
  | "ACCOUNT_UNAVAILABLE"
  | "EMAIL_VERIFICATION_REQUIRED";

export class AuthenticationBoundaryError extends Error {
  readonly code: AuthenticationFailureCode;

  constructor(code: AuthenticationFailureCode) {
    super(code);
    this.name = "AuthenticationBoundaryError";
    this.code = code;
  }
}

export function resolveAuthenticatedPrincipal(
  session: Session | null,
  access: ApplicationAccess | null,
  requireVerifiedEmail: boolean,
) {
  if (!session) {
    throw new AuthenticationBoundaryError("AUTHENTICATION_REQUIRED");
  }
  if (!access) {
    throw new AuthenticationBoundaryError("ACCOUNT_NOT_PROVISIONED");
  }
  if (access.profile.status !== "ACTIVE") {
    throw new AuthenticationBoundaryError("ACCOUNT_UNAVAILABLE");
  }
  if (requireVerifiedEmail && !session.user.emailVerified) {
    throw new AuthenticationBoundaryError("EMAIL_VERIFICATION_REQUIRED");
  }
  if (access.roles.size === 0) {
    throw new AuthenticationBoundaryError("ACCOUNT_UNAVAILABLE");
  }

  return { ...access, identity: session.user, session };
}
