import type { AccountStatus } from "@/modules/identity-access/authorization";
import type {
  ApplicationRoleCode,
  PermissionCode,
} from "@/modules/identity-access/policy";

export type BookingActor = Readonly<{
  profileId: string;
  status: AccountStatus;
  roles: ReadonlySet<ApplicationRoleCode>;
  permissions: ReadonlySet<PermissionCode>;
}>;

export type BookingAuthorizationFailureCode =
  | "AUTHENTICATION_REQUIRED"
  | "ACCOUNT_UNAVAILABLE"
  | "PERMISSION_DENIED"
  | "RECORD_NOT_FOUND_OR_FORBIDDEN";

export class BookingAuthorizationError extends Error {
  readonly code: BookingAuthorizationFailureCode;

  constructor(code: BookingAuthorizationFailureCode) {
    super(code);
    this.name = "BookingAuthorizationError";
    this.code = code;
  }
}

function requirePermissions(
  actor: BookingActor | null,
  required: readonly PermissionCode[],
): BookingActor {
  if (!actor) throw new BookingAuthorizationError("AUTHENTICATION_REQUIRED");
  if (actor.status !== "ACTIVE" || actor.roles.size === 0) {
    throw new BookingAuthorizationError("ACCOUNT_UNAVAILABLE");
  }
  if (required.some((permission) => !actor.permissions.has(permission))) {
    throw new BookingAuthorizationError("PERMISSION_DENIED");
  }
  return actor;
}

export function requireCustomerBookingRead(actor: BookingActor | null): void {
  requirePermissions(actor, ["OWN_CUSTOMER_DATA_READ"]);
}

export function requireCustomerQuoteAcceptance(
  actor: BookingActor | null,
): void {
  requirePermissions(actor, ["OWN_CUSTOMER_DATA_UPDATE"]);
}

export function requireStaffBookingRead(actor: BookingActor | null): void {
  requirePermissions(actor, [
    "CUSTOMER_RECORDS_READ",
    "OPERATIONS_READ",
    "SCHEDULE_READ",
  ]);
}

export function requireStaffQuoteAcceptance(actor: BookingActor | null): void {
  requirePermissions(actor, [
    "CUSTOMER_RECORDS_MANAGE",
    "OPERATIONS_MANAGE",
  ]);
}

export function requireStaffBookingScheduling(
  actor: BookingActor | null,
): void {
  requirePermissions(actor, [
    "CUSTOMER_RECORDS_MANAGE",
    "OPERATIONS_MANAGE",
    "SCHEDULE_MANAGE",
  ]);
}
