import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalCommunicationTemplates } from "@/modules/communications-documents/templates";

const root = process.cwd();
const migrationPath = path.join(
  root,
  "drizzle/0011_phase_3i_communications_documents.sql",
);
const journalPath = path.join(root, "drizzle/meta/_journal.json");

const protectedMigrationChecksums = new Map([
  [
    "0001_add_service_catalogue.sql",
    "82c358c2cd23ead4e2e88aff76419045e7fd5d31523e1bddd17b963c5237cc53",
  ],
  [
    "0002_add_commercial_engine.sql",
    "57a638063cf4bcc870af51c21e477a5d4c3ffe73172fe1604dec0e7908c8832b",
  ],
  [
    "0003_add_availability_capacity.sql",
    "9a7bdace95a77714d5a7050272b76ee2c60b1f10a1cf1b11cb34c04e04c45a84",
  ],
  [
    "0004_add_identity_access.sql",
    "d5a2aeaa86e719759d5c7c10f65758b348eebcefbd7486f2cdca7bc7a329795c",
  ],
  [
    "0005_add_customer_property_crm.sql",
    "36a13247e4a5475db3917dcbcf6d7092a5373c98e935af07dc9fb4e894d6fb8c",
  ],
  [
    "0006_phase_3d_request_quote.sql",
    "4a1e002b5a1896629041328ca4c00e434232023afdefd11cf73b473e462cbf6e",
  ],
  [
    "0007_phase_3e_booking_engine.sql",
    "c412a89227c7a54f0e7d812797a78d74ac7d65a370951d9f6a42fd77414fc6c2",
  ],
  [
    "0008_phase_3f_job_execution.sql",
    "1e2de59c546b9f52f430b71a04d0461528a05d8ffea2e33bd1332e668b4bc9f9",
  ],
  [
    "0009_phase_3g_scheduling_dispatch.sql",
    "89164bdf1a97e44ae4e8b048e63ffa1a063eb5ad185dcb9a0878f401163c81b7",
  ],
  [
    "0010_phase_3h_finance_invoicing.sql",
    "ea06e7cb322f7b67f65bc45b7d6da78d6d0e8551d84a25c182d40fbf05955324",
  ],
]);

const supportingIndexes = [
  "communication_intents_id_customer_unique",
  "communication_templates_key_version_locale_unique",
  "delivery_attempts_id_customer_unique",
  "delivery_results_id_customer_unique",
  "documents_id_customer_unique",
  "customer_contacts_id_customer_unique",
  "quotes_id_customer_unique",
  "bookings_id_customer_unique",
  "jobs_id_customer_unique",
  "invoices_id_customer_unique",
  "payments_id_customer_unique",
] as const;

describe("Phase 3I communications and documents migration boundary", () => {
  it("is additive, communications-scoped, and has one reviewed identity", async () => {
    const migration = await readFile(migrationPath, "utf8");
    expect(
      [...migration.matchAll(/CREATE TABLE "([^"]+)"/g)].map(
        (match) => match[1],
      ),
    ).toEqual([
      "communication_audit_events",
      "communication_intents",
      "communication_templates",
      "customer_communication_history_entries",
      "customer_communication_preferences",
      "delivery_attempts",
      "delivery_results",
      "documents",
    ]);
    expect(migration).not.toMatch(/\bDROP\s+(?:TABLE|COLUMN|INDEX|SCHEMA)\b/i);
    expect(migration).not.toMatch(/\bTRUNCATE\b|\bDELETE\s+FROM\b/i);
    expect(migration).not.toMatch(/neon_auth/i);
    expect(migration).not.toMatch(/\bCASCADE\b/i);
    expect(migration).not.toMatch(/(?:smtp|twilio|whatsapp)/i);
    await expect(
      access(path.join(root, "drizzle/0011_silly_generated_name.sql")),
    ).rejects.toThrow();
  });

  it("creates every composite uniqueness target before the first foreign key", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const firstForeignKey = migration.indexOf(" ADD CONSTRAINT ");
    expect(firstForeignKey).toBeGreaterThan(0);
    for (const indexName of supportingIndexes) {
      const position = migration.indexOf(`CREATE UNIQUE INDEX "${indexName}"`);
      expect(position, indexName).toBeGreaterThan(0);
      expect(position, indexName).toBeLessThan(firstForeignKey);
      expect(
        migration.indexOf(`CREATE UNIQUE INDEX "${indexName}"`, position + 1),
        indexName,
      ).toBe(-1);
    }
  });

  it("binds exact source records, audit events, templates, and customer scope", async () => {
    const migration = await readFile(migrationPath, "utf8");
    for (const fragment of [
      'FOREIGN KEY ("contact_id","customer_id") REFERENCES "public"."customer_contacts"("id","customer_id")',
      'FOREIGN KEY ("quote_id","customer_id") REFERENCES "public"."quotes"("id","customer_id")',
      'FOREIGN KEY ("booking_id","customer_id") REFERENCES "public"."bookings"("id","customer_id")',
      'FOREIGN KEY ("job_id","customer_id") REFERENCES "public"."jobs"("id","customer_id")',
      'FOREIGN KEY ("invoice_id","customer_id") REFERENCES "public"."invoices"("id","customer_id")',
      'FOREIGN KEY ("payment_id","customer_id") REFERENCES "public"."payments"("id","customer_id")',
      'FOREIGN KEY ("template_key","template_version","locale") REFERENCES "public"."communication_templates"("template_key","version","locale")',
      'FOREIGN KEY ("communication_intent_id","customer_id") REFERENCES "public"."communication_intents"("id","customer_id")',
    ]) {
      expect(migration, fragment).toContain(fragment);
    }
    expect(migration).toContain(
      "communication intent source provenance is stale or inconsistent",
    );
    expect(migration).toContain(
      "communication intent contact snapshot is stale or inconsistent",
    );
    expect(migration).toContain(
      "communication document does not match its immutable intent source",
    );
    expect(migration).toContain(
      "quote.acceptance_source_snapshot #>> '{quote,customerId}'",
    );
    expect(migration).toContain(
      "booking.scheduling_snapshot #>> '{occupancyId}'",
    );
    expect(migration).toContain(
      "job_event.safe_metadata ->> 'passportEntryCount'",
    );
    expect(migration).toContain(
      "passport.source_execution_status = 'COMPLETED'",
    );

    const cleaningPassportKey = canonicalCommunicationTemplates.find(
      (template) =>
        template.documentType === "CLEANING_PASSPORT" &&
        template.locale === "en",
    )?.templateKey;
    expect(cleaningPassportKey).toBe("cleaning_passport_ready");
    const jobGuard = migration.match(
      /ELSIF NEW\.source_type = 'JOB' THEN[\s\S]*?ELSIF NEW\.source_type = 'INVOICE' THEN/,
    )?.[0];
    expect(jobGuard).toContain(
      `NEW.template_key <> '${cleaningPassportKey}'`,
    );
  });

  it("guards final documents, versioned templates, and append-only evidence", async () => {
    const migration = await readFile(migrationPath, "utf8");
    for (const guard of [
      "vax_communications_guard_template",
      "vax_communications_guard_intent",
      "vax_communications_guard_document",
      "vax_communications_validate_delivery_graph",
      "vax_communications_guard_append_only",
    ]) {
      expect(migration, guard).toContain(guard);
    }
    expect(migration).toContain(
      "final communication documents require a preserved superseding version",
    );
    expect(migration).toContain(
      "communication document version provenance is inconsistent",
    );
    expect(migration).toContain(
      "communication delivery, history, and audit evidence is append-only",
    );
    expect(migration).toContain(
      "communication intent provenance and snapshots are immutable",
    );
    expect(migration).toContain(
      'BEFORE INSERT OR UPDATE OR DELETE ON "communication_templates"',
    );
    expect(migration).toContain(
      'BEFORE INSERT OR UPDATE OR DELETE ON "communication_intents"',
    );
    expect(migration).toContain(
      'AFTER INSERT OR UPDATE OR DELETE ON "documents"',
    );
    expect(migration.match(/DEFERRABLE INITIALLY DEFERRED/g)).toHaveLength(5);
    expect(migration.match(/BEFORE UPDATE OR DELETE ON/g)).toHaveLength(4);
  });

  it("prevents fabricated portal delivery and customer history graphs", async () => {
    const migration = await readFile(migrationPath, "utf8");
    expect(migration).toContain(
      "communication delivery or audit graph is inconsistent",
    );
    expect(migration).toContain("intent.channel = 'PORTAL'");
    expect(migration).toContain("intent.status = 'DELIVERED_LOCAL'");
    expect(migration).toContain("result.outcome = 'DELIVERED_LOCAL'");
    expect(migration).toContain("result.result_code = 'PORTAL_PUBLISHED'");
    expect(migration).toContain(
      "intent.channel IN ('EMAIL_FUTURE', 'SMS_FUTURE')",
    );
    expect(migration).toContain("intent.status = 'QUEUED_FUTURE'");
    expect(migration).toContain("NEW.safe_metadata ->> 'preferenceVersion' =");
    expect(migration).toContain("document.status = 'SUPERSEDED'");
  });

  it("preserves every completed migration byte-for-byte", async () => {
    for (const [fileName, expectedChecksum] of protectedMigrationChecksums) {
      const contents = await readFile(path.join(root, "drizzle", fileName));
      const checksum = createHash("sha256").update(contents).digest("hex");
      expect(checksum, fileName).toBe(expectedChecksum);
    }
  });

  it("places migration 0011 directly after the Phase 3H migration", async () => {
    const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    expect(journal.entries.at(-2)).toMatchObject({
      idx: 10,
      tag: "0010_phase_3h_finance_invoicing",
    });
    expect(journal.entries.at(-1)).toMatchObject({
      idx: 11,
      tag: "0011_phase_3i_communications_documents",
    });
  });
});
