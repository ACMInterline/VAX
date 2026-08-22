import type {
  ApplicationRoleCode,
  PermissionCode,
} from "./policy";

export const accountStatuses = ["ACTIVE", "SUSPENDED", "DISABLED"] as const;
export type AccountStatus = (typeof accountStatuses)[number];

export type AuthorizationContext = {
  status: AccountStatus;
  roles: ReadonlySet<ApplicationRoleCode>;
  permissions: ReadonlySet<PermissionCode>;
};

export type AuthorizationFailureCode =
  | "ACCOUNT_UNAVAILABLE"
  | "AUTHENTICATION_REQUIRED"
  | "PERMISSION_DENIED";

export class AuthorizationError extends Error {
  readonly code: AuthorizationFailureCode;

  constructor(code: AuthorizationFailureCode) {
    super(code);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

export function isActiveAuthorizationContext(
  context: AuthorizationContext,
): boolean {
  return context.status === "ACTIVE";
}

export function hasPermission(
  context: AuthorizationContext,
  permission: PermissionCode,
): boolean {
  return isActiveAuthorizationContext(context) && context.permissions.has(permission);
}

export function hasAnyPermission(
  context: AuthorizationContext,
  permissions: readonly PermissionCode[],
): boolean {
  return permissions.some((permission) => hasPermission(context, permission));
}

export function requirePermission(
  context: AuthorizationContext,
  permission: PermissionCode,
): void {
  if (!isActiveAuthorizationContext(context)) {
    throw new AuthorizationError("ACCOUNT_UNAVAILABLE");
  }

  if (!context.permissions.has(permission)) {
    throw new AuthorizationError("PERMISSION_DENIED");
  }
}

export function requireAnyPermission(
  context: AuthorizationContext,
  permissions: readonly PermissionCode[],
): void {
  if (!isActiveAuthorizationContext(context)) {
    throw new AuthorizationError("ACCOUNT_UNAVAILABLE");
  }

  if (!hasAnyPermission(context, permissions)) {
    throw new AuthorizationError("PERMISSION_DENIED");
  }
}
