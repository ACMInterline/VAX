import type { PermissionCode } from "@/modules/identity-access/policy";
import type {
  CommunicationEventType,
  CommunicationsActor,
} from "./types";

export type CommunicationsAuthorizationFailureCode =
  | "AUTHENTICATION_REQUIRED"
  | "ACCOUNT_UNAVAILABLE"
  | "PERMISSION_DENIED";

export class CommunicationsAuthorizationError extends Error {
  readonly code: CommunicationsAuthorizationFailureCode;

  constructor(code: CommunicationsAuthorizationFailureCode) {
    super(code);
    this.name = "CommunicationsAuthorizationError";
    this.code = code;
  }
}

function requirePermissions(
  actor: CommunicationsActor | null,
  required: readonly PermissionCode[],
): CommunicationsActor {
  if (!actor) {
    throw new CommunicationsAuthorizationError("AUTHENTICATION_REQUIRED");
  }
  if (actor.status !== "ACTIVE" || actor.roles.size === 0) {
    throw new CommunicationsAuthorizationError("ACCOUNT_UNAVAILABLE");
  }
  if (required.some((permission) => !actor.permissions.has(permission))) {
    throw new CommunicationsAuthorizationError("PERMISSION_DENIED");
  }
  return actor;
}

export function sourcePermissions(
  eventType: Exclude<CommunicationEventType, "MANUAL_STAFF_MESSAGE">,
): readonly PermissionCode[] {
  switch (eventType) {
    case "QUOTE_ISSUED":
      return ["CUSTOMER_RECORDS_READ", "OPERATIONS_READ"];
    case "BOOKING_CONFIRMED":
    case "BOOKING_RESCHEDULED":
    case "BOOKING_CANCELLED":
      return ["CUSTOMER_RECORDS_READ", "OPERATIONS_READ", "SCHEDULE_READ"];
    case "JOB_COMPLETED":
      return [
        "CUSTOMER_RECORDS_READ",
        "OPERATIONS_READ",
        "FIELD_JOBS_READ",
      ];
    case "INVOICE_ISSUED":
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_REVERSED":
      return ["CUSTOMER_RECORDS_READ", "FINANCE_READ"];
  }
}

export function requireStaffCommunicationsRead(
  actor: CommunicationsActor | null,
): void {
  requirePermissions(actor, ["COMMUNICATIONS_READ"]);
}

export function requireStaffCommunicationsManage(
  actor: CommunicationsActor | null,
): void {
  requirePermissions(actor, ["COMMUNICATIONS_READ", "COMMUNICATIONS_MANAGE"]);
}

export function requireStaffCommunicationManage(
  actor: CommunicationsActor | null,
  eventType: Exclude<CommunicationEventType, "MANUAL_STAFF_MESSAGE">,
): void {
  requirePermissions(actor, [
    "COMMUNICATIONS_READ",
    "COMMUNICATIONS_MANAGE",
    ...sourcePermissions(eventType),
  ]);
}

export function requireCustomerCommunicationRead(
  actor: CommunicationsActor | null,
): void {
  requirePermissions(actor, ["OWN_CUSTOMER_DATA_READ"]);
}

export function requireCustomerCommunicationUpdate(
  actor: CommunicationsActor | null,
): void {
  requirePermissions(actor, [
    "OWN_CUSTOMER_DATA_READ",
    "OWN_CUSTOMER_DATA_UPDATE",
  ]);
}
