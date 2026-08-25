import type { AccountStatus } from "@/modules/identity-access/authorization";
import type {
  ApplicationRoleCode,
  PermissionCode,
} from "@/modules/identity-access/policy";

export type RequestQuoteActor = Readonly<{
  profileId: string;
  status: AccountStatus;
  roles: ReadonlySet<ApplicationRoleCode>;
  permissions: ReadonlySet<PermissionCode>;
}>;

export type RequestQuoteAccessScope = "STAFF" | "LINKED_CUSTOMER";

export type RequestQuoteAuthorizationFailureCode =
  | "AUTHENTICATION_REQUIRED"
  | "ACCOUNT_UNAVAILABLE"
  | "PERMISSION_DENIED"
  | "RECORD_NOT_FOUND_OR_FORBIDDEN";

export class RequestQuoteAuthorizationError extends Error {
  readonly code: RequestQuoteAuthorizationFailureCode;

  constructor(code: RequestQuoteAuthorizationFailureCode) {
    super(code);
    this.name = "RequestQuoteAuthorizationError";
    this.code = code;
  }
}

function requireActiveActor(
  actor: RequestQuoteActor | null,
): RequestQuoteActor {
  if (!actor) {
    throw new RequestQuoteAuthorizationError("AUTHENTICATION_REQUIRED");
  }
  if (actor.status !== "ACTIVE" || actor.roles.size === 0) {
    throw new RequestQuoteAuthorizationError("ACCOUNT_UNAVAILABLE");
  }
  return actor;
}

function requirePermissions(
  actorInput: RequestQuoteActor | null,
  permissions: readonly PermissionCode[],
): RequestQuoteActor {
  const actor = requireActiveActor(actorInput);
  if (permissions.some((permission) => !actor.permissions.has(permission))) {
    throw new RequestQuoteAuthorizationError("PERMISSION_DENIED");
  }
  return actor;
}

/** Staff request reads require both the CRM and operational boundaries. */
export function requireStaffRequestRead(
  actor: RequestQuoteActor | null,
): RequestQuoteAccessScope {
  requirePermissions(actor, ["CUSTOMER_RECORDS_READ", "OPERATIONS_READ"]);
  return "STAFF";
}

/** Staff request writes require both the CRM and operational boundaries. */
export function requireStaffRequestManagement(
  actor: RequestQuoteActor | null,
): RequestQuoteAccessScope {
  requirePermissions(actor, ["CUSTOMER_RECORDS_MANAGE", "OPERATIONS_MANAGE"]);
  return "STAFF";
}

export function requireCustomerRequestRead(
  actor: RequestQuoteActor | null,
): RequestQuoteAccessScope {
  requirePermissions(actor, ["OWN_CUSTOMER_DATA_READ"]);
  return "LINKED_CUSTOMER";
}

export function requireCustomerRequestUpdate(
  actor: RequestQuoteActor | null,
): RequestQuoteAccessScope {
  requirePermissions(actor, ["OWN_CUSTOMER_DATA_UPDATE"]);
  return "LINKED_CUSTOMER";
}

export function assertExactActiveCustomerLink(
  hasActiveExactCustomerLink: boolean,
): void {
  if (!hasActiveExactCustomerLink) {
    throw new RequestQuoteAuthorizationError(
      "RECORD_NOT_FOUND_OR_FORBIDDEN",
    );
  }
}
