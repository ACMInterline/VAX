import type { AccountStatus } from "@/modules/identity-access/authorization";
import type {
  ApplicationRoleCode,
  PermissionCode,
} from "@/modules/identity-access/policy";

export type SchedulingActor = Readonly<{
  profileId: string;
  status: AccountStatus;
  roles: ReadonlySet<ApplicationRoleCode>;
  permissions: ReadonlySet<PermissionCode>;
}>;

export type SchedulingAuthorizationFailureCode =
  | "AUTHENTICATION_REQUIRED"
  | "ACCOUNT_UNAVAILABLE"
  | "PERMISSION_DENIED"
  | "RECORD_NOT_FOUND_OR_FORBIDDEN";

export class SchedulingAuthorizationError extends Error {
  readonly code: SchedulingAuthorizationFailureCode;

  constructor(code: SchedulingAuthorizationFailureCode) {
    super(code);
    this.name = "SchedulingAuthorizationError";
    this.code = code;
  }
}

function requirePermissions(
  actor: SchedulingActor | null,
  required: readonly PermissionCode[],
): SchedulingActor {
  if (!actor) {
    throw new SchedulingAuthorizationError("AUTHENTICATION_REQUIRED");
  }
  if (actor.status !== "ACTIVE" || actor.roles.size === 0) {
    throw new SchedulingAuthorizationError("ACCOUNT_UNAVAILABLE");
  }
  if (required.some((permission) => !actor.permissions.has(permission))) {
    throw new SchedulingAuthorizationError("PERMISSION_DENIED");
  }
  return actor;
}

/** Staff-wide dispatch access requires the complete read conjunction. */
export function requireStaffSchedulingRead(
  actor: SchedulingActor | null,
): void {
  requirePermissions(actor, [
    "CUSTOMER_RECORDS_READ",
    "OPERATIONS_READ",
    "SCHEDULE_READ",
  ]);
}

/** Exact scheduling and rescheduling require the complete manage conjunction. */
export function requireStaffSchedulingManage(
  actor: SchedulingActor | null,
): void {
  requirePermissions(actor, [
    "CUSTOMER_RECORDS_MANAGE",
    "OPERATIONS_MANAGE",
    "SCHEDULE_MANAGE",
  ]);
}

/** Row scope is enforced separately by the technician Job repository. */
export function requireTechnicianTodayRead(
  actor: SchedulingActor | null,
): void {
  requirePermissions(actor, [
    "OPERATIONS_READ",
    "SCHEDULE_READ",
    "FIELD_JOBS_READ",
  ]);
}

/** Customer ownership is enforced separately by the Booking repository. */
export function requireCustomerAppointmentRead(
  actor: SchedulingActor | null,
): void {
  requirePermissions(actor, ["OWN_CUSTOMER_DATA_READ"]);
}
