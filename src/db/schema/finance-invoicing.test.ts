import { getTableName } from "drizzle-orm";
import { getTableConfig, type AnyPgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { invoices as exportedInvoices } from "../schema";
import {
  businessLegalProfiles,
  customerBillingProfiles,
  financeAuditEvents,
  invoiceItems,
  invoiceNumberingPolicies,
  invoicePolicies,
  invoices,
  paymentAllocations,
  paymentReversals,
  payments,
} from "./finance-invoicing";

const financeTables = [
  customerBillingProfiles,
  businessLegalProfiles,
  invoicePolicies,
  invoiceNumberingPolicies,
  invoices,
  invoiceItems,
  payments,
  paymentAllocations,
  paymentReversals,
  financeAuditEvents,
] as const;

function indexNames(table: AnyPgTable) {
  return getTableConfig(table).indexes.map((index) => index.config.name);
}

describe("finance and invoicing schema contract", () => {
  it("exports the ten additive finance tables without browser-facing RLS", () => {
    expect(financeTables.map(getTableName)).toEqual([
      "customer_billing_profiles",
      "business_legal_profiles",
      "invoice_policies",
      "invoice_numbering_policies",
      "invoices",
      "invoice_items",
      "payments",
      "payment_allocations",
      "payment_reversals",
      "finance_audit_events",
    ]);
    expect(exportedInvoices).toBe(invoices);
    expect(
      financeTables.every((table) => !getTableConfig(table).enableRLS),
    ).toBe(true);
  });

  it("stores financial arithmetic as EUR integer minor units and basis points", () => {
    for (const column of [
      invoices.netAmountMinorUnits,
      invoices.vatRateBasisPoints,
      invoices.vatAmountMinorUnits,
      invoices.grossTotalMinorUnits,
      invoices.paidAmountMinorUnits,
      invoiceItems.netAmountMinorUnits,
      invoiceItems.vatRateBasisPoints,
      invoiceItems.vatAmountMinorUnits,
      invoiceItems.grossTotalMinorUnits,
      payments.amountMinorUnits,
      payments.allocatedAmountMinorUnits,
      paymentAllocations.amountMinorUnits,
      paymentReversals.amountMinorUnits,
    ]) {
      expect(column.getSQLType()).toBe("integer");
      expect(column.notNull).toBe(true);
    }

    const checkNames = financeTables.flatMap((table) =>
      getTableConfig(table).checks.map((constraint) => constraint.name),
    );
    expect(checkNames).toEqual(
      expect.arrayContaining([
        "invoice_policies_currency_eur",
        "invoices_currency_eur",
        "invoices_amounts_consistent",
        "invoices_vat_configuration_consistent",
        "invoice_items_amounts_consistent",
        "payments_currency_eur",
        "payments_amounts_consistent",
        "payment_allocations_currency_eur",
        "payment_reversals_currency_eur",
      ]),
    );
  });

  it("binds invoice, item, payment, allocation and reversal provenance restrictively", () => {
    const expectedForeignKeys = [
      [invoices, "invoices_acceptance_provenance_fk"],
      [invoices, "invoices_booking_commercial_provenance_fk"],
      [invoices, "invoices_job_booking_property_fk"],
      [invoices, "invoices_customer_billing_profile_fk"],
      [invoices, "invoices_seller_legal_profile_fk"],
      [invoices, "invoices_policy_provenance_fk"],
      [invoices, "invoices_numbering_policy_provenance_fk"],
      [invoiceItems, "invoice_items_invoice_scope_fk"],
      [invoiceItems, "invoice_items_booking_item_scope_fk"],
      [invoiceItems, "invoice_items_quote_item_scope_fk"],
      [invoiceItems, "invoice_items_job_item_scope_fk"],
      [paymentAllocations, "payment_allocations_payment_scope_fk"],
      [paymentAllocations, "payment_allocations_invoice_scope_fk"],
      [paymentAllocations, "payment_allocations_reversal_scope_fk"],
      [paymentReversals, "payment_reversals_payment_provenance_fk"],
    ] as const;

    for (const [table, name] of expectedForeignKeys) {
      const foreignKey = getTableConfig(table).foreignKeys.find(
        (candidate) => candidate.getName() === name,
      );
      expect(foreignKey, name).toBeDefined();
      expect(foreignKey?.onDelete, name).toBe("restrict");
    }

    expect(
      financeTables
        .flatMap((table) => getTableConfig(table).foreignKeys)
        .some((foreignKey) => foreignKey.onDelete === "cascade"),
    ).toBe(false);
  });

  it("provides idempotent numbering, issuance, payment and reversal safeguards", () => {
    expect(indexNames(invoices)).toEqual(
      expect.arrayContaining([
        "invoices_number_unique",
        "invoices_numbering_sequence_unique",
        "invoices_creation_idempotency_unique",
        "invoices_issue_idempotency_unique",
        "invoices_live_standard_booking_unique",
      ]),
    );
    expect(indexNames(payments)).toEqual(
      expect.arrayContaining([
        "payments_recording_idempotency_unique",
      ]),
    );
    expect(indexNames(paymentAllocations)).toEqual(
      expect.arrayContaining([
        "payment_allocations_idempotency_unique",
        "payment_allocations_reversal_once_unique",
        "payment_allocations_reversal_provenance_unique",
      ]),
    );
    expect(indexNames(paymentReversals)).toEqual(
      expect.arrayContaining([
        "payment_reversals_payment_unique",
        "payment_reversals_idempotency_unique",
      ]),
    );
    expect(invoiceNumberingPolicies.nextSequence.getSQLType()).toBe("integer");
    expect(invoiceNumberingPolicies.nextSequence.notNull).toBe(true);
    expect(paymentAllocations.idempotencyFingerprint.notNull).toBe(true);
    expect(paymentReversals.idempotencyFingerprint.notNull).toBe(true);

    const checkNames = [paymentAllocations, paymentReversals].flatMap((table) =>
      getTableConfig(table).checks.map((constraint) => constraint.name),
    );
    expect(checkNames).toEqual(
      expect.arrayContaining([
        "payment_allocations_fingerprint_valid",
        "payment_reversals_fingerprint_valid",
      ]),
    );
  });

  it("keeps copied line items, allocation/reversal ledgers and audit events append-oriented", () => {
    for (const table of [
      invoiceItems,
      paymentAllocations,
      paymentReversals,
      financeAuditEvents,
    ] as const) {
      expect("updatedAt" in table, getTableName(table)).toBe(false);
    }

    expect("updatedAt" in invoices).toBe(true);
    expect("updatedAt" in payments).toBe(true);
    expect(invoices.version.notNull).toBe(true);
    expect(payments.version.notNull).toBe(true);
  });
});
