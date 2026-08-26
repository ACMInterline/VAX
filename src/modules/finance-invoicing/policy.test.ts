import { describe, expect, it } from "vitest";
import type { PermissionCode } from "@/modules/identity-access/policy";
import {
  FinanceAuthorizationError,
  requireCustomerInvoiceRead,
  requireInvoiceIssue,
  requirePaymentRecord,
  requirePaymentReversal,
  requireStaffFinanceManage,
  requireStaffFinanceRead,
  type FinanceActor,
} from "./policy";

function actor(permissions: readonly PermissionCode[]): FinanceActor {
  return {
    profileId: "00000000-0000-4000-8000-000000000001",
    status: "ACTIVE",
    roles: new Set(["ADMIN"]),
    permissions: new Set(permissions),
  };
}

describe("finance authorization policy", () => {
  it("uses operation-specific permission conjunctions", () => {
    expect(() => requireStaffFinanceRead(actor(["FINANCE_READ"]))).not.toThrow();
    expect(() =>
      requireStaffFinanceManage(actor(["FINANCE_READ", "FINANCE_MANAGE"])),
    ).not.toThrow();
    expect(() =>
      requireInvoiceIssue(actor(["FINANCE_READ", "INVOICE_ISSUE"])),
    ).not.toThrow();
    expect(() =>
      requirePaymentRecord(actor(["FINANCE_READ", "PAYMENT_RECORD"])),
    ).not.toThrow();
    expect(() =>
      requirePaymentReversal(
        actor(["FINANCE_READ", "FINANCE_MANAGE", "PAYMENT_RECORD"]),
      ),
    ).not.toThrow();
  });

  it("keeps customer reads on exact own-data authority", () => {
    expect(() =>
      requireCustomerInvoiceRead(actor(["OWN_CUSTOMER_DATA_READ"])),
    ).not.toThrow();
    expect(() => requireCustomerInvoiceRead(actor(["FINANCE_READ"]))).toThrow(
      FinanceAuthorizationError,
    );
  });

  it("denies labels without permissions and inactive accounts", () => {
    expect(() => requireInvoiceIssue(actor([]))).toThrow(
      FinanceAuthorizationError,
    );
    expect(() =>
      requireStaffFinanceRead({ ...actor(["FINANCE_READ"]), status: "SUSPENDED" }),
    ).toThrow(FinanceAuthorizationError);
  });
});
