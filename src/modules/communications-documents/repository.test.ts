import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sql, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/client";

vi.mock("server-only", () => ({}));

import {
  communicationsRepositorySqlForTesting,
  getCustomerDocument,
  listCustomerHistory,
  listStaffCommunications,
  persistCommunication,
  resolveDeliveryContext,
} from "./repository";
import { communicationSourceSqlForTesting } from "./source-repository";
import type {
  PersistCommunicationInput,
  ResolvedCommunicationSource,
} from "./types";

const dialect = new PgDialect();
const actorProfileId = "10000000-0000-4000-8000-000000000001";
const customerId = "20000000-0000-4000-8000-000000000001";
const sourceId = "30000000-0000-4000-8000-000000000001";
const auditEventId = "40000000-0000-4000-8000-000000000001";
const sourceReference = "Q-000000000000000000000001";

function compiled(query: SQL) {
  return dialect.sqlToQuery(query);
}

function executionDatabase(rows: readonly Record<string, unknown>[] = []) {
  const execute = vi.fn(async (query: SQL) => {
    void query;
    return { rows };
  });
  return {
    database: { execute } as unknown as Database,
    execute,
  };
}

function uniqueViolationDatabase(rows: readonly Record<string, unknown>[]) {
  const execute = vi
    .fn()
    .mockRejectedValueOnce(
      Object.assign(new Error("unique violation"), { code: "23505" }),
    )
    .mockResolvedValueOnce({ rows });
  return {
    database: { execute } as unknown as Database,
    execute,
  };
}

const quoteSource: ResolvedCommunicationSource = {
  sourceType: "QUOTE",
  sourceId,
  sourceReference,
  sourceVersion: 3,
  customerId,
  bookingOccupancyId: null,
  businessAuditEventId: auditEventId,
  bookingAuditEventId: null,
  jobAuditEventId: null,
  financeAuditEventId: null,
  eventType: "QUOTE_ISSUED",
  purpose: "OPERATIONAL",
  localeHint: "en",
  occurredAt: new Date("2026-08-27T09:00:00.000Z"),
  templateKey: "quote_issued",
  documentType: "QUOTE_SUMMARY",
  variables: {
    customer_name: "Example Customer",
    quote_reference: sourceReference,
    valid_until: "30/09/2026",
    gross_total: "€120.00",
  },
  facts: [{ key: "reference", label: "Reference", value: sourceReference }],
  lineItems: [
    {
      description: "Sofa cleaning",
      quantity: 1,
      amountMinorUnits: 12_000,
      currency: "EUR",
    },
  ],
  totals: { currency: "EUR", grossAmountMinorUnits: 12_000 },
  notices: [],
  sourcePayload: {
    schemaVersion: 1,
    sourceSnapshotChecksumSha256: "a".repeat(64),
    sourceAuditEventType: "QUOTE_ISSUED",
  },
  projectionPayload: {},
};

const persistInput: PersistCommunicationInput = {
  eventType: "QUOTE_ISSUED",
  sourceReference,
  documentType: "QUOTE_SUMMARY",
  channel: "PORTAL",
  contactId: null,
  idempotencyKey: "50000000-0000-4000-8000-000000000001",
  communicationReference: "COM-000000000000000000000001",
  documentReference: "DOC-000000000000000000000001",
  deliveryReference: "DEL-000000000000000000000001",
  historyReference: "HIS-000000000000000000000001",
  actorProfileId,
  source: quoteSource,
  template: {
    templateKey: "quote_issued",
    version: 1,
    locale: "en",
    documentType: "QUOTE_SUMMARY",
    titleTemplate: "Quote {{quote_reference}}",
    bodyTemplate:
      "Hello {{customer_name}}. This quote is valid until {{valid_until}} and totals {{gross_total}}.",
    variablesContract: [
      "customer_name",
      "quote_reference",
      "valid_until",
      "gross_total",
    ],
    status: "ACTIVE",
  },
  contact: null,
  locale: "en",
  intentStatus: "DELIVERED_LOCAL",
  content: {
    schemaVersion: 1,
    rendererVersion: 1,
    eventType: "QUOTE_ISSUED",
    sourceReference,
    locale: "en",
    title: `Quote ${sourceReference}`,
    body: "Customer-safe content",
    facts: quoteSource.facts,
    lineItems: quoteSource.lineItems,
    totals: quoteSource.totals,
    notices: [],
  },
  checksumSha256: "b".repeat(64),
  idempotencyFingerprint: "c".repeat(64),
};

function expectCurrentPermissionBoundary(
  query: ReturnType<typeof compiled>,
  permissions: readonly string[],
): void {
  expect(query.sql).toContain("actor_profile.status = 'ACTIVE'");
  expect(query.sql).toContain("actor_assignment.active = true");
  expect(query.sql).toContain("actor_role.active = true");
  expect(query.sql).toContain("actor_permission.active = true");
  expect(query.params).toEqual(
    expect.arrayContaining([actorProfileId, ...permissions]),
  );
}

describe("communication source SQL provenance boundaries", () => {
  it.each([
    [
      "quote",
      () =>
        communicationSourceSqlForTesting.quoteSourceSql(
          actorProfileId,
          sourceReference,
        ),
      [
        "COMMUNICATIONS_READ",
        "COMMUNICATIONS_MANAGE",
        "CUSTOMER_RECORDS_READ",
        "OPERATIONS_READ",
      ],
    ],
    [
      "booking",
      () =>
        communicationSourceSqlForTesting.bookingSourceSql(
          actorProfileId,
          "BOOKING_CONFIRMED",
          "BKG-000000000000000000000001",
        ),
      [
        "COMMUNICATIONS_READ",
        "COMMUNICATIONS_MANAGE",
        "CUSTOMER_RECORDS_READ",
        "OPERATIONS_READ",
        "SCHEDULE_READ",
      ],
    ],
    [
      "job",
      () =>
        communicationSourceSqlForTesting.jobSourceSql(
          actorProfileId,
          "JOB-000000000000000000000001",
          "JOB_COMPLETION_SUMMARY",
        ),
      [
        "COMMUNICATIONS_READ",
        "COMMUNICATIONS_MANAGE",
        "CUSTOMER_RECORDS_READ",
        "OPERATIONS_READ",
        "FIELD_JOBS_READ",
      ],
    ],
    [
      "invoice",
      () =>
        communicationSourceSqlForTesting.invoiceSourceSql(
          actorProfileId,
          "INV-000000000000000000000001",
        ),
      [
        "COMMUNICATIONS_READ",
        "COMMUNICATIONS_MANAGE",
        "CUSTOMER_RECORDS_READ",
        "FINANCE_READ",
      ],
    ],
    [
      "payment",
      () =>
        communicationSourceSqlForTesting.paymentSourceSql(
          actorProfileId,
          "PAYMENT_CONFIRMED",
          "PAY-000000000000000000000001",
        ),
      [
        "COMMUNICATIONS_READ",
        "COMMUNICATIONS_MANAGE",
        "CUSTOMER_RECORDS_READ",
        "FINANCE_READ",
      ],
    ],
  ] as const)(
    "requires current layered permissions while resolving a %s source",
    (_label, buildQuery, permissions) => {
      expectCurrentPermissionBoundary(compiled(buildQuery()), permissions);
    },
  );

  it("selects a Quote only from the exact issued audit and immutable acceptance snapshot", () => {
    const query = compiled(
      communicationSourceSqlForTesting.quoteSourceSql(
        actorProfileId,
        sourceReference,
      ),
    );

    expect(query.sql).toContain("event.entity_type = 'QUOTE'");
    expect(query.sql).toContain("event.entity_id = quote.id");
    expect(query.sql).toContain("event.event_type = 'QUOTE_ISSUED'");
    expect(query.sql).toContain("quote.acceptance_source_snapshot");
    expect(query.sql).toContain("#>> '{quote,recordVersion}'");
    expect(query.sql).toContain("#>> '{quote,customerId}'");
    expect(query.sql).toContain("jsonb_array_elements");
    expect(query.sql).not.toContain('from "customers"');
    expect(query.sql).not.toContain('from "service_requests"');
  });

  it("binds Booking schedule output to the exact audit version and occupancy snapshot", () => {
    const query = compiled(
      communicationSourceSqlForTesting.bookingSourceSql(
        actorProfileId,
        "BOOKING_RESCHEDULED",
        "BKG-000000000000000000000001",
      ),
    );

    expect(query.params).toContain("BOOKING_RESCHEDULED");
    expect(query.sql).toContain("event.booking_id = booking.id");
    expect(query.sql).toContain("event.safe_metadata ->> 'bookingVersion'");
    expect(query.sql).toContain(
      "event.safe_metadata ->> 'occupancySnapshotVersion'",
    );
    expect(query.sql).toContain("occupancy.snapshot_version");
    expect(query.sql).toContain("occupancy.status = 'CONFIRMED'");
    expect(query.sql).toContain("booking.scheduling_snapshot");
    expect(query.sql).toContain("booking.customer_snapshot");
    expect(query.sql).toContain("booking.property_snapshot");
    expect(query.sql).toContain("booking.price_snapshot");
  });

  it("requires an exact JOB_COMPLETED audit and matching immutable passport-entry count", () => {
    const query = compiled(
      communicationSourceSqlForTesting.jobSourceSql(
        actorProfileId,
        "JOB-000000000000000000000001",
        "CLEANING_PASSPORT",
      ),
    );

    expect(query.params).toContain("JOB_COMPLETED");
    expect(query.sql).toContain("event.job_id = job.id");
    expect(query.sql).toContain("job.status = 'COMPLETED'");
    expect(query.sql).toContain("job.completion_snapshot");
    expect(query.sql).toContain("job.source_provenance_snapshot");
    expect(query.sql).toContain("event.safe_metadata ->> 'passportEntryCount'");
    expect(query.sql).toContain("select count(*)::integer");
    expect(query.sql).toContain(
      "passport_entry.source_execution_status = 'COMPLETED'",
    );
    expect(query.sql).toMatch(
      /passport_entry\.customer_safe_snapshot\s*->> 'schemaVersion' = '1'/,
    );
    expect(query.sql).toContain("order by event.created_at asc, event.id asc");
  });

  it("binds Invoice and Payment projections to exact immutable finance audit facts", () => {
    const invoice = compiled(
      communicationSourceSqlForTesting.invoiceSourceSql(
        actorProfileId,
        "INV-000000000000000000000001",
      ),
    );
    const payment = compiled(
      communicationSourceSqlForTesting.paymentSourceSql(
        actorProfileId,
        "PAYMENT_REVERSED",
        "PAY-000000000000000000000001",
      ),
    );

    expect(invoice.sql).toContain("event.invoice_id = invoice.id");
    expect(invoice.sql).toContain("event.event_type = 'INVOICE_ISSUED'");
    expect(invoice.sql).toContain("event.safe_metadata ->> 'invoiceVersion'");
    expect(invoice.sql).toContain("invoice.customer_snapshot");
    expect(invoice.sql).toContain("invoice.seller_snapshot");
    expect(invoice.sql).toContain("invoice.commercial_snapshot");
    expect(invoice.sql).toContain("invoice.terms_snapshot");
    expect(invoice.sql).toContain("invoice.finance_review_status = 'CLEAR'");

    expect(payment.params).toEqual(
      expect.arrayContaining(["PAYMENT_REVERSED", "REVERSED"]),
    );
    expect(payment.sql).toContain("event.payment_id = payment.id");
    expect(payment.sql).toContain("event.safe_metadata ->> 'paymentVersion'");
    expect(payment.sql).toContain("payment.reversed_at");
    expect(payment.sql).toContain("sourceSnapshotChecksumSha256");
  });
});

describe("communications repository authorization and delivery graph", () => {
  it("rechecks source-specific permissions and immutable source identity at persistence", () => {
    const query = compiled(
      communicationsRepositorySqlForTesting.sourceRecheckSql(persistInput),
    );

    expectCurrentPermissionBoundary(query, [
      "COMMUNICATIONS_READ",
      "COMMUNICATIONS_MANAGE",
      "CUSTOMER_RECORDS_READ",
      "OPERATIONS_READ",
    ]);
    expect(query.sql).toContain("event.id =");
    expect(query.sql).toContain("event.entity_type = 'QUOTE'");
    expect(query.sql).toContain("event.entity_id = quote.id");
    expect(query.sql).toContain("event.event_type = 'QUOTE_ISSUED'");
    expect(query.sql).toContain("quote.customer_id =");
    expect(query.sql).toContain("quote.acceptance_source_snapshot");
    expect(query.params).toEqual(
      expect.arrayContaining([
        sourceId,
        customerId,
        sourceReference,
        auditEventId,
        3,
      ]),
    );
  });

  it("rechecks the exact JOB_COMPLETED audit and passport-entry count before persistence", () => {
    const jobReference = "JOB-000000000000000000000001";
    const jobSource: ResolvedCommunicationSource = {
      ...quoteSource,
      sourceType: "JOB",
      sourceReference: jobReference,
      sourceVersion: 5,
      businessAuditEventId: null,
      jobAuditEventId: auditEventId,
      eventType: "JOB_COMPLETED",
      templateKey: "cleaning_passport_ready",
      documentType: "CLEANING_PASSPORT",
      variables: {
        customer_name: "Example Customer",
        job_reference: jobReference,
        completed_at: "27/08/2026, 12:00 EEST",
      },
      lineItems: [{ description: "Completed service", quantity: 1 }],
      totals: null,
    };
    const query = compiled(
      communicationsRepositorySqlForTesting.sourceRecheckSql({
        ...persistInput,
        eventType: "JOB_COMPLETED",
        sourceReference: jobReference,
        documentType: "CLEANING_PASSPORT",
        source: jobSource,
      }),
    );

    expect(query.sql).toContain("event.id =");
    expect(query.sql).toContain("event.job_id = job.id");
    expect(query.sql).toContain("event.event_type = 'JOB_COMPLETED'");
    expect(query.sql).toContain("job.status = 'COMPLETED'");
    expect(query.sql).toContain("event.safe_metadata ->> 'passportEntryCount'");
    expect(query.sql).toContain("select count(*)::integer");
    expect(query.sql).toContain(
      "passport_entry.source_execution_status = 'COMPLETED'",
    );
    expect(query.sql).toMatch(
      /passport_entry\.customer_safe_snapshot\s*->> 'schemaVersion' = '1'/,
    );
    expectCurrentPermissionBoundary(query, [
      "COMMUNICATIONS_READ",
      "COMMUNICATIONS_MANAGE",
      "CUSTOMER_RECORDS_READ",
      "OPERATIONS_READ",
      "FIELD_JOBS_READ",
    ]);
  });

  it("applies source-specific current permission conjunctions to staff rows", async () => {
    const fake = executionDatabase();

    await listStaffCommunications(fake.database, actorProfileId, {
      limit: 25,
      offset: 0,
    });
    const query = compiled(fake.execute.mock.calls[0]![0] as SQL);

    expectCurrentPermissionBoundary(query, [
      "COMMUNICATIONS_READ",
      "CUSTOMER_RECORDS_READ",
      "OPERATIONS_READ",
      "SCHEDULE_READ",
      "FIELD_JOBS_READ",
      "FINANCE_READ",
    ]);
    expect(query.sql).toContain(
      '"communication_intents"."source_type" = \'QUOTE\'',
    );
    expect(query.sql).toContain(
      '"communication_intents"."source_type" = \'BOOKING\'',
    );
    expect(query.sql).toContain(
      '"communication_intents"."source_type" = \'JOB\'',
    );
    expect(query.sql).toContain(
      "\"communication_intents\".\"source_type\" in ('INVOICE', 'PAYMENT')",
    );
  });

  it("selects contacts only by exact customer scope and current active state", async () => {
    const fake = executionDatabase();

    await resolveDeliveryContext(fake.database, actorProfileId, quoteSource, {
      channel: "EMAIL_FUTURE",
      contactId: "60000000-0000-4000-8000-000000000001",
    });
    const query = compiled(fake.execute.mock.calls[0]![0] as SQL);

    expect(query.sql).toContain("contact.id =");
    expect(query.sql).toContain("contact.customer_id = customer.id");
    expect(query.sql).toContain("contact.active = true");
    expect(query.sql).toContain("contact.email is not null");
    expect(query.sql).toContain("customer.status = 'ACTIVE'");
    expect(query.sql).toContain("template.status = 'ACTIVE'");
    expectCurrentPermissionBoundary(query, [
      "COMMUNICATIONS_READ",
      "COMMUNICATIONS_MANAGE",
      "CUSTOMER_RECORDS_READ",
      "OPERATIONS_READ",
    ]);
  });

  it("binds customer reads to one exact active, unrevoked identity link", () => {
    const query = compiled(
      communicationsRepositorySqlForTesting.customerAccessSql(
        actorProfileId,
        sql`${customerId}::uuid`,
      ),
    );

    expect(query.sql).toContain('from "customer_identity_links" exact_link');
    expect(query.sql).toContain("exact_link.user_profile_id =");
    expect(query.sql).toContain("exact_link.customer_id =");
    expect(query.sql).toContain("exact_link.active = true");
    expect(query.sql).toContain("exact_link.revoked_at is null");
    expect(query.sql).toContain("linked_customer.status = 'ACTIVE'");
    expect(query.params).toEqual(
      expect.arrayContaining([
        actorProfileId,
        customerId,
        "OWN_CUSTOMER_DATA_READ",
      ]),
    );
  });

  it("exposes customer history and documents only after local portal publication", async () => {
    const historyDatabase = executionDatabase();
    const documentDatabase = executionDatabase();

    await listCustomerHistory(historyDatabase.database, actorProfileId);
    await getCustomerDocument(
      documentDatabase.database,
      actorProfileId,
      "DOC-000000000000000000000001",
    );
    const history = compiled(historyDatabase.execute.mock.calls[0]![0] as SQL);
    const document = compiled(
      documentDatabase.execute.mock.calls[0]![0] as SQL,
    );

    for (const query of [history, document]) {
      expect(query.sql).toContain("intent.status = 'DELIVERED_LOCAL'");
      expect(query.sql).toContain("intent.channel = 'PORTAL'");
      expect(query.sql).toContain("document.status in ('FINAL', 'SUPERSEDED')");
      expect(query.sql).toContain("result.outcome = 'DELIVERED_LOCAL'");
      expect(query.sql).toContain("result.result_code = 'PORTAL_PUBLISHED'");
      expect(query.sql).toContain("exact_link.active = true");
      expect(query.sql).toContain("exact_link.revoked_at is null");
      expect(query.sql).not.toContain("EMAIL_FUTURE");
      expect(query.sql).not.toContain("SMS_FUTURE");
    }
  });

  it("creates the complete portal graph and its audit evidence in one atomic statement", async () => {
    const fake = executionDatabase([
      {
        result: "CREATED",
        communicationReference: persistInput.communicationReference,
        documentReference: persistInput.documentReference,
        intentStatus: "DELIVERED_LOCAL",
        idempotencyFingerprint: persistInput.idempotencyFingerprint,
      },
    ]);

    await expect(
      persistCommunication(fake.database, persistInput),
    ).resolves.toMatchObject({ status: "CREATED" });
    expect(fake.execute).toHaveBeenCalledTimes(1);
    const query = compiled(fake.execute.mock.calls[0]![0] as SQL);

    for (const table of [
      "communication_intents",
      "documents",
      "delivery_attempts",
      "delivery_results",
      "customer_communication_history_entries",
    ]) {
      expect(query.sql, table).toContain(`insert into "${table}"`);
    }
    expect(
      query.sql.match(/insert into "communication_audit_events"/g),
    ).toHaveLength(5);
    expect(query.sql).toContain("from inserted_intent intent");
    expect(query.sql).toContain("exists (select 1 from inserted_attempt)");
    expect(query.sql).toMatch(
      /insert into "delivery_attempts"[\s\S]*?returning 1\s*\),\s*inserted_result/,
    );
    expect(query.sql).toContain("join inserted_history history");
    expect(query.sql).toContain("exists (select 1 from intent_audit)");
    expect(query.sql).toContain("exists (select 1 from rendered_audit)");
    expect(query.sql).toContain("exists (select 1 from finalized_audit)");
    expect(query.sql).toContain("exists (select 1 from delivery_audit)");
    expect(query.sql).toContain("'PORTAL_LOCAL'");
    expect(query.sql).toContain("'PORTAL_PUBLISHED'");
  });

  it("rejects a new-key replay of the same event when its fingerprint differs", async () => {
    const fake = uniqueViolationDatabase([
      {
        result: "EXISTING",
        communicationReference: persistInput.communicationReference,
        documentReference: persistInput.documentReference,
        intentStatus: "DELIVERED_LOCAL",
        idempotencyFingerprint: "d".repeat(64),
      },
    ]);

    await expect(
      persistCommunication(fake.database, persistInput),
    ).resolves.toEqual({ status: "IDEMPOTENCY_CONFLICT" });
    expect(fake.execute).toHaveBeenCalledTimes(2);

    const mutation = compiled(fake.execute.mock.calls[0]![0] as SQL);
    const eventConflict =
      /when exists \(select 1 from existing_event\s+where idempotency_fingerprint <> \$\d+\)\s+then 'IDEMPOTENCY_CONFLICT'/;
    expect(mutation.sql).toMatch(eventConflict);
    expect(mutation.sql.search(eventConflict)).toBeLessThan(
      mutation.sql.indexOf("then 'EXISTING_EVENT'"),
    );
  });

  it("returns the existing communication for a same-fingerprint event replay", async () => {
    const fake = uniqueViolationDatabase([
      {
        result: "EXISTING",
        communicationReference: persistInput.communicationReference,
        documentReference: persistInput.documentReference,
        intentStatus: "DELIVERED_LOCAL",
        idempotencyFingerprint: persistInput.idempotencyFingerprint,
      },
    ]);

    await expect(
      persistCommunication(fake.database, persistInput),
    ).resolves.toEqual({
      status: "EXISTING",
      communicationReference: persistInput.communicationReference,
      documentReference: persistInput.documentReference,
      intentStatus: "DELIVERED_LOCAL",
    });
    expect(fake.execute).toHaveBeenCalledTimes(2);

    const recovery = compiled(fake.execute.mock.calls[1]![0] as SQL);
    expect(recovery.sql).toContain("intent.idempotency_fingerprint");
    expect(recovery.params).toContain(persistInput.idempotencyFingerprint);
  });

  it("contains no external delivery or networking adapter in the Phase 3I module", () => {
    const moduleDirectory = join(
      process.cwd(),
      "src/modules/communications-documents",
    );
    const sources = readdirSync(moduleDirectory)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .map((name) => readFileSync(join(moduleDirectory, name), "utf8"))
      .join("\n");
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    const dependencies = Object.keys(manifest.dependencies ?? {});

    expect(sources).not.toMatch(/\bfetch\s*\(/);
    expect(sources).not.toMatch(
      /from\s+["'](?:node:)?(?:http|https|net|tls|dgram|dns)["']/,
    );
    expect(sources).not.toMatch(
      /\b(?:axios|nodemailer|twilio|sendgrid|postmark|resend)\b/i,
    );
    expect(sources).not.toMatch(/process\.env|DATABASE_URL/);
    expect(dependencies).toEqual(
      expect.not.arrayContaining([
        "axios",
        "nodemailer",
        "twilio",
        "@sendgrid/mail",
        "postmark",
        "resend",
      ]),
    );
  });
});
