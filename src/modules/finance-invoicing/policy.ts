import type { AccountStatus } from "@/modules/identity-access/authorization";
import type {
  ApplicationRoleCode,
  PermissionCode,
} from "@/modules/identity-access/policy";

export type FinanceActor = Readonly<{
  profileId: string;
  status: AccountStatus;
  roles: ReadonlySet<ApplicationRoleCode>;
  permissions: ReadonlySet<PermissionCode>;
}>;

export type FinanceAuthorizationFailureCode =
  | "AUTHENTICATION_REQUIRED"
  | "ACCOUNT_UNAVAILABLE"
  | "PERMISSION_DENIED";

export class FinanceAuthorizationError extends Error {
  readonly code: FinanceAuthorizationFailureCode;

  constructor(code: FinanceAuthorizationFailureCode) {
    super(code);
    this.name = "FinanceAuthorizationError";
    this.code = code;
  }
}

function requirePermissions(
  actor: FinanceActor | null,
  required: readonly PermissionCode[],
): FinanceActor {
  if (!actor) throw new FinanceAuthorizationError("AUTHENTICATION_REQUIRED");
  if (actor.status !== "ACTIVE" || actor.roles.size === 0) {
    throw new FinanceAuthorizationError("ACCOUNT_UNAVAILABLE");
  }
  if (required.some((permission) => !actor.permissions.has(permission))) {
    throw new FinanceAuthorizationError("PERMISSION_DENIED");
  }
  return actor;
}

export function requireStaffFinanceRead(actor: FinanceActor | null): void {
  requirePermissions(actor, ["FINANCE_READ"]);
}

export function requireStaffFinanceManage(actor: FinanceActor | null): void {
  requirePermissions(actor, ["FINANCE_READ", "FINANCE_MANAGE"]);
}

export function requireInvoiceIssue(actor: FinanceActor | null): void {
  requirePermissions(actor, ["FINANCE_READ", "INVOICE_ISSUE"]);
}

export function requirePaymentRecord(actor: FinanceActor | null): void {
  requirePermissions(actor, ["FINANCE_READ", "PAYMENT_RECORD"]);
}

export function requirePaymentReversal(actor: FinanceActor | null): void {
  requirePermissions(actor, [
    "FINANCE_READ",
    "FINANCE_MANAGE",
    "PAYMENT_RECORD",
  ]);
}

export function requireCustomerInvoiceRead(actor: FinanceActor | null): void {
  requirePermissions(actor, ["OWN_CUSTOMER_DATA_READ"]);
}
