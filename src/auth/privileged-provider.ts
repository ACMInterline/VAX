export type PrivilegedAuthenticationCapabilityUnavailableReason =
  | "PROVIDER_NOT_SUPPORTED"
  | "RECENT_AUTHENTICATION_UNAVAILABLE"
  | "UNVALIDATED_PROVIDER_CONTRACT";

export type PrivilegedAuthenticationCapability =
  | Readonly<{
      availability: "SUPPORTED";
      requiresProviderAdmin: boolean;
      requiresRecentAuthentication: boolean;
      unavailableReason?: never;
    }>
  | Readonly<{
      availability: "UNAVAILABLE";
      requiresProviderAdmin: boolean;
      requiresRecentAuthentication: boolean;
      unavailableReason: PrivilegedAuthenticationCapabilityUnavailableReason;
    }>;

export type PrivilegedAuthenticationCapabilities = Readonly<{
  listUsers: PrivilegedAuthenticationCapability;
  listSessions: PrivilegedAuthenticationCapability;
  revokeAllSessions: PrivilegedAuthenticationCapability;
  recentAuthentication: PrivilegedAuthenticationCapability;
}>;

export type PrivilegedAuthUserSummary = Readonly<{
  /** Provider email for authorized server-rendered administration only. */
  email: string;
  emailVerified: boolean;
  createdAt: string;
}>;

export type PrivilegedAuthUserListRequest = Readonly<{
  limit: number;
  offset: number;
  searchEmail?: string;
}>;

export type PrivilegedAuthUserPage = Readonly<{
  users: readonly PrivilegedAuthUserSummary[];
  total: number;
  limit: number;
  offset: number;
}>;

export interface PrivilegedAuthenticationProvider {
  getCapabilities(): PrivilegedAuthenticationCapabilities;
  listUsers(request: PrivilegedAuthUserListRequest): Promise<PrivilegedAuthUserPage>;
  revokeAllSessions(): Promise<void>;
}

export type PrivilegedAuthenticationProviderErrorCode =
  | "AUTHORIZATION_REQUIRED"
  | "INVALID_PROVIDER_RESPONSE"
  | "INVALID_REQUEST"
  | "PROVIDER_UNAVAILABLE"
  | "RECENT_AUTHENTICATION_UNAVAILABLE";

export class PrivilegedAuthenticationProviderError extends Error {
  constructor(readonly code: PrivilegedAuthenticationProviderErrorCode) {
    super(code);
    this.name = "PrivilegedAuthenticationProviderError";
  }
}

export function validatePrivilegedAuthUserListRequest(
  request: PrivilegedAuthUserListRequest,
): PrivilegedAuthUserListRequest {
  if (
    !Number.isInteger(request.limit) ||
    request.limit < 1 ||
    request.limit > 100 ||
    !Number.isInteger(request.offset) ||
    request.offset < 0
  ) {
    throw new PrivilegedAuthenticationProviderError("INVALID_REQUEST");
  }

  const searchEmail = request.searchEmail?.trim();
  if (searchEmail !== undefined && (searchEmail.length === 0 || searchEmail.length > 320)) {
    throw new PrivilegedAuthenticationProviderError("INVALID_REQUEST");
  }

  return {
    limit: request.limit,
    offset: request.offset,
    ...(searchEmail === undefined ? {} : { searchEmail }),
  };
}
