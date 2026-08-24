import type { PermissionCode } from "@/modules/identity-access/policy";
import type {
  CustomerCrmActor,
  CustomerRecordAccessScope,
} from "./types";

export type CustomerCrmAuthorizationFailureCode =
  | "AUTHENTICATION_REQUIRED"
  | "ACCOUNT_UNAVAILABLE"
  | "PERMISSION_DENIED"
  | "RECORD_NOT_FOUND_OR_FORBIDDEN";

export class CustomerCrmAuthorizationError extends Error {
  readonly code: CustomerCrmAuthorizationFailureCode;

  constructor(code: CustomerCrmAuthorizationFailureCode) {
    super(code);
    this.name = "CustomerCrmAuthorizationError";
    this.code = code;
  }
}

function requireActiveActor(actor: CustomerCrmActor | null): CustomerCrmActor {
  if (!actor) {
    throw new CustomerCrmAuthorizationError("AUTHENTICATION_REQUIRED");
  }
  if (actor.status !== "ACTIVE" || actor.roles.size === 0) {
    throw new CustomerCrmAuthorizationError("ACCOUNT_UNAVAILABLE");
  }
  return actor;
}

function requirePermissions(
  actorInput: CustomerCrmActor | null,
  permissions: readonly PermissionCode[],
): CustomerCrmActor {
  const actor = requireActiveActor(actorInput);
  if (permissions.some((permission) => !actor.permissions.has(permission))) {
    throw new CustomerCrmAuthorizationError("PERMISSION_DENIED");
  }
  return actor;
}

export function requireStaffCustomerRead(
  actor: CustomerCrmActor | null,
): CustomerRecordAccessScope {
  requirePermissions(actor, ["CUSTOMER_RECORDS_READ"]);
  return "STAFF";
}

export function requireStaffCustomerManagement(
  actor: CustomerCrmActor | null,
): CustomerRecordAccessScope {
  requirePermissions(actor, ["CUSTOMER_RECORDS_MANAGE"]);
  return "STAFF";
}

export function requireCustomerSelfRead(
  actor: CustomerCrmActor | null,
): CustomerRecordAccessScope {
  requirePermissions(actor, ["OWN_CUSTOMER_DATA_READ"]);
  return "LINKED_CUSTOMER";
}

export function requireCustomerIdentityLinkManagement(
  actor: CustomerCrmActor | null,
): CustomerRecordAccessScope {
  requirePermissions(actor, ["CUSTOMER_RECORDS_MANAGE", "USER_ADMIN_MANAGE"]);
  return "STAFF";
}

export function resolveCustomerRecordReadScope(
  actorInput: CustomerCrmActor | null,
  hasActiveExactCustomerLink: boolean,
): CustomerRecordAccessScope {
  const actor = requireActiveActor(actorInput);
  if (actor.permissions.has("CUSTOMER_RECORDS_READ")) {
    return "STAFF";
  }
  if (!actor.permissions.has("OWN_CUSTOMER_DATA_READ")) {
    throw new CustomerCrmAuthorizationError("PERMISSION_DENIED");
  }
  if (!hasActiveExactCustomerLink) {
    throw new CustomerCrmAuthorizationError("RECORD_NOT_FOUND_OR_FORBIDDEN");
  }
  return "LINKED_CUSTOMER";
}

export function canReadInternalCustomerNotes(
  scope: CustomerRecordAccessScope,
): boolean {
  return scope === "STAFF";
}

export type { CustomerCrmActor } from "./types";
