import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationPath = path.join(
  root,
  "drizzle/0010_phase_3h_finance_invoicing.sql",
);
const journalPath = path.join(root, "drizzle/meta/_journal.json");

const protectedMigrationChecksums = new Map([
  ["0001_add_service_catalogue.sql", "82c358c2cd23ead4e2e88aff76419045e7fd5d31523e1bddd17b963c5237cc53"],
  ["0002_add_commercial_engine.sql", "57a638063cf4bcc870af51c21e477a5d4c3ffe73172fe1604dec0e7908c8832b"],
  ["0003_add_availability_capacity.sql", "9a7bdace95a77714d5a7050272b76ee2c60b1f10a1cf1b11cb34c04e04c45a84"],
  ["0004_add_identity_access.sql", "d5a2aeaa86e719759d5c7c10f65758b348eebcefbd7486f2cdca7bc7a329795c"],
  ["0005_add_customer_property_crm.sql", "36a13247e4a5475db3917dcbcf6d7092a5373c98e935af07dc9fb4e894d6fb8c"],
  ["0006_phase_3d_request_quote.sql", "4a1e002b5a1896629041328ca4c00e434232023afdefd11cf73b473e462cbf6e"],
  ["0007_phase_3e_booking_engine.sql", "c412a89227c7a54f0e7d812797a78d74ac7d65a370951d9f6a42fd77414fc6c2"],
  ["0008_phase_3f_job_execution.sql", "1e2de59c546b9f52f430b71a04d0461528a05d8ffea2e33bd1332e668b4bc9f9"],
  ["0009_phase_3g_scheduling_dispatch.sql", "89164bdf1a97e44ae4e8b048e63ffa1a063eb5ad185dcb9a0878f401163c81b7"],
]);

const supportingIndexes = [
  "business_legal_profiles_id_version_environment_unique",
  "business_legal_profiles_id_environment_unique",
  "customer_billing_profiles_id_customer_version_unique",
  "invoice_numbering_policies_id_code_version_environment_unique",
  "invoice_numbering_policies_id_environment_unique",
  "invoice_policies_id_code_version_environment_unique",
  "invoices_id_customer_currency_unique",
  "invoices_id_booking_quote_unique",
  "payment_allocations_reversal_provenance_unique",
  "payments_id_customer_currency_unique",
  "payments_reversal_provenance_unique",
  "quote_items_id_quote_unique",
  "booking_items_id_booking_quote_item_unique",
  "bookings_id_commercial_provenance_unique",
  "job_items_id_job_booking_item_unique",
];

describe("Phase 3H finance and invoicing migration boundary", () => {
  it("is additive, finance-scoped, and has the reviewed migration identity", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const createdTables = [...migration.matchAll(/CREATE TABLE "([^"]+)"/g)].map(
      (match) => match[1],
    );

    expect(createdTables).toEqual([
      "business_legal_profiles",
      "customer_billing_profiles",
      "finance_audit_events",
      "invoice_items",
      "invoice_numbering_policies",
      "invoice_policies",
      "invoices",
      "payment_allocations",
      "payment_reversals",
      "payments",
    ]);
    expect(migration).not.toMatch(/\bDROP\s+(?:TABLE|COLUMN|INDEX|SCHEMA)\b/i);
    expect(migration).not.toMatch(/\bTRUNCATE\b|\bDELETE\s+FROM\b/i);
    expect(migration).not.toMatch(/neon_auth/i);
    expect(migration).not.toMatch(/\bCASCADE\b/i);
    await expect(
      access(path.join(root, "drizzle/0010_modern_elektra.sql")),
    ).rejects.toThrow();
  });

  it("creates every unique target before a dependent foreign key", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const firstForeignKey = migration.indexOf(" ADD CONSTRAINT ");
    expect(firstForeignKey).toBeGreaterThan(0);
    for (const indexName of supportingIndexes) {
      const position = migration.indexOf(`CREATE UNIQUE INDEX "${indexName}"`);
      expect(position, indexName).toBeGreaterThan(0);
      expect(position, indexName).toBeLessThan(firstForeignKey);
      expect(migration.indexOf(`CREATE UNIQUE INDEX "${indexName}"`, position + 1)).toBe(-1);
    }
  });

  it("keeps money integral, EUR-only, and cached balances generated or reconciled", async () => {
    const migration = await readFile(migrationPath, "utf8");
    expect(migration).toContain(
      '"outstanding_amount_minor_units" integer GENERATED ALWAYS AS ("gross_total_minor_units" - "paid_amount_minor_units") STORED',
    );
    expect(migration).toContain(
      '"unallocated_amount_minor_units" integer GENERATED ALWAYS AS ("amount_minor_units" - "allocated_amount_minor_units") STORED',
    );
    expect(migration).not.toMatch(/(?:numeric|decimal|real|double precision)\s*\(/i);
    expect(migration.match(/_currency_eur" CHECK/g)).toHaveLength(5);
    expect(migration).toContain("vax_finance_validate_settlement");
  });

  it("binds configuration and provenance to exact versions and environments", async () => {
    const migration = await readFile(migrationPath, "utf8");
    expect(migration).toContain(
      'FOREIGN KEY ("invoice_policy_id","invoice_policy_code","invoice_policy_version","environment_scope")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("numbering_policy_id","numbering_policy_code","numbering_policy_version","environment_scope")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("seller_legal_profile_id","seller_legal_profile_version","environment_scope")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("booking_id","request_id","quote_id","quote_acceptance_id","customer_id","property_id")',
    );
    expect(migration).toContain("approved finance configuration may only be superseded");
    expect(migration).toContain("approved numbering counter must advance exactly once");
  });

  it("guards immutable issuance, append-only settlement, and audit graph integrity", async () => {
    const migration = await readFile(migrationPath, "utf8");
    for (const guard of [
      "vax_finance_guard_invoice",
      "vax_finance_guard_payment",
      "vax_finance_guard_append_ledger",
      "vax_finance_require_operation_actor",
      "vax_finance_validate_invoice_item",
      "vax_finance_validate_number_allocation",
      "vax_finance_validate_invoice_number_allocation",
      "vax_finance_validate_settlement",
      "vax_finance_validate_audit_graph",
      "vax_finance_validate_allocation_audit",
      "vax_finance_validate_invoice_audit",
      "vax_finance_validate_payment_audit",
    ]) {
      expect(migration, guard).toContain(guard);
    }
    expect(migration.match(/DEFERRABLE INITIALLY DEFERRED/g)).toHaveLength(11);
    expect(migration).toContain("finance ledger and audit rows are append-only");
    expect(migration).toContain("staff finance operations require actor attribution");
    expect(migration).toContain(
      "finance configuration transitions require actor attribution",
    );
    expect(migration).toContain(
      "finance configuration actor history is immutable",
    );
    expect(migration).toContain(
      "finance configuration updates require actor attribution",
    );
    expect(migration).toContain(
      "WHERE profile.id = OLD.approved_by_profile_id",
    );
    expect(migration).toContain(
      "WHERE profile.id = (old_row ->> actor_column)::uuid",
    );
    expect(migration).toContain(
      "WHERE profile.id = OLD.created_by_profile_id",
    );
    expect(migration).toContain(
      "WHERE profile.id = OLD.recorded_by_profile_id",
    );
    expect(migration).toContain(
      'BEFORE INSERT OR UPDATE OR DELETE ON "business_legal_profiles"',
    );
    expect(migration).toContain(
      'BEFORE INSERT OR UPDATE OR DELETE ON "customer_billing_profiles"',
    );
    expect(migration).toContain(
      'BEFORE INSERT OR UPDATE OR DELETE ON "invoice_numbering_policies"',
    );
    expect(migration).toContain(
      "row_data ->> 'source' = 'STAFF'",
    );
    expect(migration).toContain("row_data ->> 'created_by_profile_id' IS NULL");
    expect(migration).toContain("row_data ->> 'recorded_by_profile_id' IS NULL");
    expect(migration).toContain("invoice issue provenance or commercial snapshot is stale");
    expect(migration).toContain(
      "SELECT count(*) FROM public.invoice_items item",
    );
    expect(migration).toContain(
      "SELECT count(*) FROM public.booking_items item",
    );
    expect(migration).toContain(
      "SELECT count(*) FROM public.quote_items item",
    );
    expect(migration).toContain(
      "SELECT count(*) FROM public.job_items item",
    );
    expect(migration).toContain(
      "NEW.job_id IS NULL AND EXISTS (",
    );
    expect(migration).toContain(
      "policy.issue_eligibility = 'JOB_COMPLETED'",
    );
    expect(migration).toContain("quote.acceptance_source_snapshot IS NOT NULL");
    expect(migration).toContain("acceptance.terms_snapshot = quote.terms_snapshot");
    expect(migration).toContain("customer.customer_type <> 'BUSINESS'");
    expect(migration).toContain("billing.company_registration_number IS NOT NULL");
    expect(migration).toContain("billing.vat_number_status <> 'UNVERIFIED'");
    expect(migration).toContain("numbering counter advance has no matching issued invoice");
    expect(migration).toContain(
      "numbering.next_sequence = NEW.numbering_sequence + 1",
    );
    expect(migration).toContain(
      "numbering.code = NEW.numbering_policy_code",
    );
    expect(migration).toContain(
      "numbering.version = NEW.numbering_policy_version",
    );
    expect(migration).toContain(
      "numbering.environment_scope = NEW.environment_scope",
    );
    expect(migration).toContain(
      "issued invoice has no reciprocal numbering counter allocation",
    );
    expect(migration).toContain("payment balance does not reconcile to its append-only ledger");
    expect(migration).toContain("invoice lifecycle mutation has no matching finance audit event");
    expect(migration).toContain("payment allocation has no exact audit pair");
    expect(migration).toContain(
      "payment allocation reversal has no exact audit fact",
    );
    expect(migration).toContain(
      "audit.safe_metadata ->> 'amountMinorUnits'",
    );
    expect(migration).toContain(
      "invoice audit event is not bound to its exact operation",
    );
    expect(migration).toContain(
      "payment audit event is not bound to its exact operation",
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "finance_audit_events_invoice_lifecycle_version_unique"',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "finance_audit_events_payment_lifecycle_version_unique"',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "finance_audit_events_allocation_event_unique"',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "finance_audit_events_allocation_invoice_settlement_unique"',
    );
    expect(migration).toContain(
      "audit.safe_metadata ->> 'invoiceVersion' = NEW.version::text",
    );
    expect(migration).toContain(
      "audit.safe_metadata ->> 'paymentVersion' = NEW.version::text",
    );
    expect(migration).not.toContain("audit.created_at >= NEW.updated_at");
    expect(migration).toContain(
      "NEW.previous_status IN ('DRAFT', 'READY_TO_ISSUE')",
    );
    expect(migration).toContain(
      "NEW.previous_status = 'CONFIRMED'",
    );
    expect(migration).toContain(
      "job.status NOT IN ('REQUIRES_REVIEW', 'CANCELLED')",
    );
    expect(migration).toContain(
      "job_item.status IN (\n                  'DECLINED', 'REFERRED', 'REQUIRES_REVIEW'",
    );
    expect(migration).toContain(
      "NEW.finance_review_reason_codes ? 'JOB_SCOPE_DIFFERENCE'",
    );
    expect(migration).toContain(
      "invoice.finance_review_status = 'REQUIRED'",
    );
    expect(migration).toContain("payment.version = 2");
    expect(migration).toContain(
      "payment.allocated_amount_minor_units = 0",
    );
  });

  it("permits only the reviewed job-completion exception from draft to issued", async () => {
    const migration = await readFile(migrationPath, "utf8");
    expect(migration).toContain(
      `OLD.finance_review_reason_codes = '["JOB_COMPLETION_REQUIRED"]'::jsonb`,
    );
    expect(migration).toContain("OLD.status = 'DRAFT'");
    expect(migration).toContain("NEW.finance_review_status <> 'CLEAR'");
    expect(migration).toContain(
      "NEW.eligibility_snapshot - 'jobStatus' = jsonb_build_object(",
    );
    expect(migration).not.toContain(
      "'jobStatus', job.status\n        )",
    );
    expect(migration).toContain("policy.issue_eligibility <> 'JOB_COMPLETED' OR job.status = 'COMPLETED'");
    expect(migration).not.toMatch(
      /CREATE UNIQUE INDEX[^;]+ON "invoices"[^;]+"creation_fingerprint"/,
    );
    expect(migration).not.toMatch(
      /CREATE UNIQUE INDEX[^;]+ON "payments"[^;]+"recording_fingerprint"/,
    );
  });

  it("preserves migrations 0001 through 0009 byte-for-byte", async () => {
    for (const [fileName, expectedChecksum] of protectedMigrationChecksums) {
      const contents = await readFile(path.join(root, "drizzle", fileName));
      const checksum = createHash("sha256").update(contents).digest("hex");
      expect(checksum, fileName).toBe(expectedChecksum);
    }
  });

  it("places the named Phase 3H migration directly after Phase 3G", async () => {
    const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
      version: string;
      dialect: string;
      entries: Array<{ idx: number; tag: string; breakpoints: boolean }>;
    };
    expect(journal).toMatchObject({ version: "7", dialect: "postgresql" });
    expect(journal.entries[9]).toMatchObject({
      idx: 9,
      tag: "0009_phase_3g_scheduling_dispatch",
      breakpoints: true,
    });
    expect(journal.entries[10]).toMatchObject({
      idx: 10,
      tag: "0010_phase_3h_finance_invoicing",
      breakpoints: true,
    });
  });
});
