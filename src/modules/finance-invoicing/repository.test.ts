import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/client";

vi.mock("server-only", () => ({}));

import {
  allocatePaymentRecord,
  createInvoiceDraftRecord,
  getCustomerInvoiceRecord,
  issueInvoiceRecord,
  reversePaymentRecord,
} from "./repository";

const dialect = new PgDialect();
const actorProfileId = "10000000-0000-4000-8000-000000000001";
const invoiceReference = "INV-0123456789ABCDEF01234567";
const paymentReference = "PAY-0123456789ABCDEF01234567";
const idempotencyKey = "20000000-0000-4000-8000-000000000002";

function compiled(query: SQL) {
  return dialect.sqlToQuery(query);
}

function directDatabase(rows: readonly Record<string, unknown>[]) {
  const execute = vi.fn(async (query: SQL) => {
    void query;
    return { rows };
  });
  return { database: { execute } as unknown as Database, execute };
}

function batchDatabase(result: Record<string, unknown>, statementCount = 3) {
  const execute = vi.fn((query: SQL) => query);
  const batch = vi.fn(async () => [
    ...Array.from({ length: statementCount - 1 }, () => ({ rows: [] })),
    { rows: [result] },
  ]);
  return {
    database: { execute, batch } as unknown as Database,
    execute,
    batch,
  };
}

function batchStatements(execute: ReturnType<typeof vi.fn>): string[] {
  return execute.mock.calls.map(([query]) => compiled(query as SQL).sql);
}

describe("finance repository provenance and mutation boundaries", () => {
  it("creates a draft only by copying the accepted Quote and Booking graph", async () => {
    const fake = directDatabase([
      {
        result: "CREATED",
        invoiceReference,
        invoiceNumber: null,
        paymentReference: null,
        reasonCodes: [],
      },
    ]);

    await createInvoiceDraftRecord(fake.database, actorProfileId, {
      bookingReference: "BKG-0123456789ABCDEF01234567",
      invoiceReference,
      customerVisibleNote: null,
      internalNote: null,
      manualAdjustmentRequested: false,
      environmentScope: "DEVELOPMENT",
    });

    const query = compiled(fake.execute.mock.calls[0]![0] as SQL);
    expect(query.sql).toContain('join "quote_acceptances"');
    expect(query.sql).toContain('join "quotes"');
    expect(query.sql).toContain('from "booking_items"');
    expect(query.sql).toContain("item_graph_matches");
    expect(query.sql).toContain("COMMERCIAL_TOTALS_INCONSISTENT");
    expect(query.sql).toContain("JOB_SCOPE_DIFFERENCE");
    expect(query.sql).toContain("job_known_divergence");
    expect(query.sql).toContain(
      "job_item.status in ('DECLINED', 'REFERRED', 'REQUIRES_REVIEW')",
    );
    expect(query.sql).toContain(
      "job_item.quantity <> booking_item.quantity",
    );
    expect(query.sql).toContain("booking_item_count = quote_item_count");
    expect(query.sql).toContain("item_graph_matches = true");
    expect(query.sql).toContain("line_net = net_amount_minor_units");
    expect(query.sql).toContain("line_vat = vat_amount_minor_units");
    expect(query.sql).toContain("line_gross = gross_total_minor_units");
    expect(query.sql).toContain("line_net <> net_amount_minor_units");
    expect(query.sql).toContain(
      "job_id is null or job_item_count = booking_item_count",
    );
    expect(query.sql).toContain(
      "issue_eligibility <> 'JOB_COMPLETED' or job_id is not null",
    );
    expect(query.sql).toContain(
      "issue_eligibility = 'JOB_COMPLETED' and job_id is null",
    );
    expect(query.sql).toContain("booking_item_count <> quote_item_count");
    expect(query.sql).toContain("item_graph_matches = false");
    expect(query.sql).toContain("to_jsonb(review_reasons)");
    expect(query.sql).not.toContain(
      "jsonb_build_array('JOB_COMPLETION_REQUIRED')",
    );
    expect(query.sql).toContain("draft_eligibility <> 'JOB_COMPLETED'");
    expect(query.sql).toContain("draft_eligibility = 'JOB_COMPLETED'");
    expect(query.sql).toContain('insert into "invoices"');
    expect(query.sql).toContain('insert into "invoice_items"');
    expect(query.sql).toContain("'invoiceVersion'");
    expect(query.sql).not.toMatch(/(?:reprice|normalize|calculate)\s*\(/i);
    expect(query.sql).not.toContain('from "price_books"');
    expect(query.sql).not.toContain('from "service_requests"');
  });

  it("classifies missing approved finance configuration without leaking bookings", async () => {
    const missingPolicyRow = {
      result: "FINANCE_REVIEW_REQUIRED",
      invoiceReference: null,
      invoiceNumber: null,
      paymentReference: null,
      reasonCodes: ["INVOICE_POLICY_MISSING"],
    };
    let call = 0;
    const execute = vi.fn((query: SQL) => {
      void query;
      call += 1;
      return Promise.resolve({ rows: call === 2 ? [missingPolicyRow] : [] });
    });
    const database = { execute } as unknown as Database;

    await expect(
      createInvoiceDraftRecord(database, actorProfileId, {
        bookingReference: "BKG-0123456789ABCDEF01234567",
        invoiceReference,
        customerVisibleNote: null,
        internalNote: null,
        manualAdjustmentRequested: false,
        environmentScope: "DEVELOPMENT",
      }),
    ).resolves.toEqual({
      status: "FINANCE_REVIEW_REQUIRED",
      reasonCodes: ["INVOICE_POLICY_MISSING"],
    });

    const classification = compiled(execute.mock.calls[1]![0] as SQL);
    expect(classification.sql).toContain("authorized_booking as materialized");
    expect(classification.sql).toContain("INVOICE_POLICY_MISSING");
    expect(classification.sql).toContain("NUMBERING_POLICY_MISSING");
    expect(classification.sql).toContain("numbering.status = 'APPROVED'");
    expect(classification.params).toContain("FINANCE_MANAGE");
  });

  it("serializes numbering and rejects stale or provisional production issue", async () => {
    const result = {
      result: "ISSUED",
      invoiceReference,
      invoiceNumber: "DEV-INV-000001",
      paymentReference: null,
      reasonCodes: [],
    };
    let initialRead = true;
    const execute = vi.fn((query: SQL) => {
      if (initialRead) {
        initialRead = false;
        return Promise.resolve({ rows: [] });
      }
      return query;
    });
    const batch = vi.fn(async () => [
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [result] },
    ]);
    const database = { execute, batch } as unknown as Database;

    await issueInvoiceRecord(database, actorProfileId, {
      invoiceReference,
      expectedVersion: 3,
      issueConfirmed: true,
      environmentScope: "PRODUCTION",
    });

    const statements = batchStatements(execute);
    expect(statements[1]).toContain("set transaction isolation level");
    expect(statements[2]).toContain("for update of numbering");
    expect(statements[3]).toContain('join "jobs" job');
    expect(statements[3]).toContain("invoice.environment_scope =");
    expect(statements[3]).toContain("for share of job");
    expect(statements[4]).toContain("invoice.version =");
    expect(statements[4]).toContain("JOB_COMPLETION_REQUIRED");
    expect(statements[4]).toContain("policy.issue_eligibility = 'JOB_COMPLETED'");
    expect(statements[4]).toContain("finance_review_status = 'CLEAR'");
    expect(statements[4]).toContain("finance_review_reason_codes = '[]'::jsonb");
    expect(statements[4]).toContain("policy.provisional = false");
    expect(statements[4]).toContain("numbering.provisional = false");
    expect(statements[4]).toContain("next_sequence = numbering.next_sequence + 1");
    expect(statements[4]).toContain("greatest(");
    expect(statements[4]).toContain("invoice.commercial_snapshot = quote.commercial_snapshot");
    expect(statements[4]).toContain("quote.acceptance_source_snapshot is not null");
    expect(statements[4]).toContain("acceptance.terms_snapshot = quote.terms_snapshot");
    expect(statements[4]).toContain("customer.customer_type <> 'BUSINESS'");
    expect(statements[4]).toContain("billing.company_registration_number is not null");
    expect(statements[4]).toContain("billing.vat_number_status <> 'UNVERIFIED'");
    expect(statements[4]).toContain("invoice.eligibility_snapshot - 'jobStatus'");
    expect(statements[4]).toContain(
      "job_lock.status not in ('REQUIRES_REVIEW', 'CANCELLED')",
    );
    expect(statements[4]).toContain(
      "'DECLINED', 'REFERRED', 'REQUIRES_REVIEW'",
    );
    expect(statements[4]).not.toContain("'jobStatus', job_lock.status");
    expect(statements[4]).toContain("invoice.customer_snapshot = jsonb_build_object");
    expect(statements[4]).toContain("invoice.seller_snapshot = jsonb_build_object");
    expect(statements[4]).toContain("invoice_item.provenance_snapshot");
    expect(statements[4]).toContain("for update of invoice, policy, seller, billing, booking");
    expect(statements[4]).toContain('insert into "finance_audit_events"');
    expect(statements[4]).toContain("'invoiceVersion'");
    expect(statements[4]).toContain("target.status as previous_status");
    expect(statements[4]).toContain("issued.previous_status");
  });

  it("fails closed to staff review when a current invoice no longer passes issuance gates", async () => {
    let call = 0;
    const execute = vi.fn((query: SQL) => {
      call += 1;
      if (call === 1) return Promise.resolve({ rows: [] });
      if (call <= 5) return query;
      return Promise.resolve({
        rows: [
          {
            result: "FINANCE_REVIEW_REQUIRED",
            invoiceReference,
            invoiceNumber: null,
            paymentReference: null,
            reasonCodes: ["COMMERCIAL_PROVENANCE_INCOMPLETE"],
          },
        ],
      });
    });
    const batch = vi.fn(async () => [
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
    ]);
    const database = { execute, batch } as unknown as Database;

    await expect(
      issueInvoiceRecord(database, actorProfileId, {
        invoiceReference,
        expectedVersion: 3,
        issueConfirmed: true,
        environmentScope: "DEVELOPMENT",
      }),
    ).resolves.toEqual({
      status: "FINANCE_REVIEW_REQUIRED",
      invoiceReference,
      reasonCodes: ["COMMERCIAL_PROVENANCE_INCOMPLETE"],
    });

    const classification = compiled(execute.mock.calls[5]![0] as SQL);
    expect(classification.sql).toContain("invoice.version <>");
    expect(classification.sql).toContain("FINANCE_REVIEW_REQUIRED");
    expect(classification.sql).toContain("COMMERCIAL_PROVENANCE_INCOMPLETE");
  });

  it("allocates under payment-first locks with server-side customer, currency and balance checks", async () => {
    const fake = batchDatabase({
      result: "UPDATED",
      invoiceReference,
      invoiceNumber: null,
      paymentReference,
      reasonCodes: [],
    });

    await allocatePaymentRecord(fake.database, actorProfileId, {
      paymentReference,
      invoiceReference,
      amountMinorUnits: 5_000,
      idempotencyKey,
    });

    const statements = batchStatements(fake.execute);
    expect(statements[1]).toContain('from "payments" payment');
    expect(statements[1]).toContain("for update of payment");
    expect(statements[2]).toContain("invoice_lock as materialized");
    expect(statements[2]).toContain("invoice_lock.paid_amount_minor_units");
    expect(statements[2]).toContain("join invoice_lock");
    expect(statements[2]).toContain("for update of invoice");
    expect(statements[2]).toContain(
      "invoice_lock.customer_id = payment.customer_id",
    );
    expect(statements[2]).toContain(
      "invoice_lock.currency = payment.currency",
    );
    expect(statements[2]).toContain("payment.status = 'CONFIRMED'");
    expect(statements[2]).toContain("payment.amount_minor_units - payment.allocated_amount_minor_units");
    expect(statements[2]).toMatch(
      /invoice_lock\.gross_total_minor_units\s*-\s*invoice_lock\.paid_amount_minor_units/,
    );
    expect(statements[2]).toContain("idempotency_fingerprint");
    expect(statements[2]).toContain("PAYMENT_ALLOCATED");
    expect(statements[2]).toContain("INVOICE_PARTIALLY_PAID");
    expect(statements[2]).toContain("INVOICE_PAID");
    expect(statements[2]).toContain("'paymentVersion'");
    expect(statements[2]).toContain("'invoiceVersion'");
    expect(statements[2]).toContain("'CONFIRMED', 'CONFIRMED'");
  });

  it("reverses with append-only compensating allocation facts and restores balances", async () => {
    const fake = batchDatabase(
      {
        result: "UPDATED",
        invoiceReference: null,
        invoiceNumber: null,
        paymentReference,
        reasonCodes: [],
      },
      4,
    );

    await reversePaymentRecord(fake.database, actorProfileId, {
      paymentReference,
      expectedVersion: 4,
      reasonCategory: "ENTRY_ERROR",
      reasonNote: "Synthetic verification correction",
      idempotencyKey,
    });

    const statements = batchStatements(fake.execute);
    expect(statements[1]).toContain("for update of payment");
    expect(statements[2]).toContain("order by invoice.id");
    expect(statements[2]).toContain("for update of invoice");
    expect(statements[3]).toContain('insert into "payment_reversals"');
    expect(statements[3]).toContain('insert into "payment_allocations"');
    expect(statements[3]).toContain("'REVERSAL'");
    expect(statements[3]).toContain("reverses_allocation_id");
    expect(statements[3]).toContain("invoice_locks.status as previous_invoice_status");
    expect(statements[3]).toContain("invoice_locks.paid_amount_minor_units");
    expect(statements[3]).toContain("invoice.paid_amount_minor_units - delta.amount_minor_units");
    expect(statements[3]).toContain("PAYMENT_ALLOCATION_REVERSED");
    expect(statements[3]).toContain("PAYMENT_REVERSED");
    expect(statements[3]).toContain("'paymentVersion'");
    expect(statements[3]).toContain("'invoiceVersion'");
    expect(compiled(fake.execute.mock.calls[1]![0] as SQL).params).toContain(
      "FINANCE_MANAGE",
    );
    expect(statements[3]).not.toMatch(/delete\s+from\s+"payment_/i);
  });

  it("does not load staff audit metadata for a customer invoice read", async () => {
    const execute = vi.fn((query: SQL) => query);
    const batch = vi.fn(async () => [
      { rows: [] },
      { rows: [] },
      { rows: [] },
    ]);
    const database = { execute, batch } as unknown as Database;

    await getCustomerInvoiceRecord(
      database,
      actorProfileId,
      invoiceReference,
      "2026-08-26",
    );

    const statements = batchStatements(execute);
    expect(compiled(execute.mock.calls[0]![0] as SQL).params).toContain(
      "OWN_CUSTOMER_DATA_READ",
    );
    expect(statements[0]).toContain("exact_link.active = true");
    expect(statements[0]).toContain("exact_link.revoked_at is null");
    expect(statements[0]).toContain("null::text");
    expect(statements[2]).not.toContain('"finance_audit_events"');
    expect(statements.join("\n")).not.toContain("internal_notes as");
  });
});
