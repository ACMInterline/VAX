import "server-only";
import { getDatabase } from "@/db/client";
import {
  loadApplicationAccess,
  type ApplicationAccess,
} from "@/modules/identity-access/repository";
import {
  hasPermission,
  requireAnyPermission,
  requirePermission,
} from "@/modules/identity-access/authorization";
import type { PermissionCode } from "@/modules/identity-access/policy";
import { getAuthRuntimeConfiguration } from "./config";
import type { AuthenticatedUser, Session } from "./contracts";
import { getAuthenticationProvider } from "./neon-provider";
import {
  AuthenticationBoundaryError,
  resolveAuthenticatedPrincipal,
} from "./principal-policy";

export { AuthenticationBoundaryError } from "./principal-policy";

export type AuthenticatedPrincipal = ApplicationAccess & {
  identity: AuthenticatedUser;
  session: Session;
};

export async function getAuthenticatedUser(): Promise<AuthenticatedPrincipal | null> {
  const session = await getAuthenticationProvider().getSession();
  if (!session) {
    return null;
  }

  const access = await loadApplicationAccess(getDatabase(), session.user.id);
  return resolveAuthenticatedPrincipal(
    session,
    access,
    getAuthRuntimeConfiguration().requireVerifiedEmail,
  );
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedPrincipal> {
  const principal = await getAuthenticatedUser();
  if (!principal) {
    throw new AuthenticationBoundaryError("AUTHENTICATION_REQUIRED");
  }
  return principal;
}

export async function requireUserPermission(
  permission: PermissionCode,
): Promise<AuthenticatedPrincipal> {
  const principal = await requireAuthenticatedUser();
  requirePermission(
    {
      status: principal.profile.status,
      roles: principal.roles,
      permissions: principal.permissions,
    },
    permission,
  );
  return principal;
}

export async function requireUserAnyPermission(
  permissions: readonly PermissionCode[],
): Promise<AuthenticatedPrincipal> {
  const principal = await requireAuthenticatedUser();
  requireAnyPermission(
    {
      status: principal.profile.status,
      roles: principal.roles,
      permissions: principal.permissions,
    },
    permissions,
  );
  return principal;
}

export function principalHasPermission(
  principal: AuthenticatedPrincipal,
  permission: PermissionCode,
): boolean {
  return hasPermission(
    {
      status: principal.profile.status,
      roles: principal.roles,
      permissions: principal.permissions,
    },
    permission,
  );
}
