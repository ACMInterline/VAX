import { getTableName } from "drizzle-orm";
import { getTableConfig, type AnyPgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  communicationIntents as exportedCommunicationIntents,
  documents as exportedDocuments,
} from "../schema";
import {
  communicationAuditEvents,
  communicationIntents,
  communicationTemplates,
  customerCommunicationHistoryEntries,
  customerCommunicationPreferences,
  deliveryAttempts,
  deliveryResults,
  documents,
} from "./communications-documents";

const communicationTables = [
  communicationTemplates,
  customerCommunicationPreferences,
  communicationIntents,
  documents,
  deliveryAttempts,
  deliveryResults,
  customerCommunicationHistoryEntries,
  communicationAuditEvents,
] as const;

function indexNames(table: AnyPgTable) {
  return getTableConfig(table).indexes.map((index) => index.config.name);
}

describe("communications and documents schema contract", () => {
  it("keeps all eight Phase 3I concepts separate and server-owned", () => {
    expect(communicationTables.map(getTableName)).toEqual([
      "communication_templates",
      "customer_communication_preferences",
      "communication_intents",
      "documents",
      "delivery_attempts",
      "delivery_results",
      "customer_communication_history_entries",
      "communication_audit_events",
    ]);
    expect(exportedCommunicationIntents).toBe(communicationIntents);
    expect(exportedDocuments).toBe(documents);
    expect(
      communicationTables.every((table) => !getTableConfig(table).enableRLS),
    ).toBe(true);
  });

  it("binds source, customer, contact, template, and delivery scope restrictively", () => {
    const expectedForeignKeys = [
      [communicationIntents, "communication_intents_contact_customer_fk"],
      [communicationIntents, "communication_intents_quote_customer_fk"],
      [communicationIntents, "communication_intents_booking_customer_fk"],
      [communicationIntents, "communication_intents_job_customer_fk"],
      [communicationIntents, "communication_intents_invoice_customer_fk"],
      [communicationIntents, "communication_intents_payment_customer_fk"],
      [communicationIntents, "communication_intents_template_fk"],
      [documents, "documents_intent_customer_fk"],
      [documents, "documents_template_fk"],
      [documents, "documents_supersedes_fk"],
      [deliveryAttempts, "delivery_attempts_intent_customer_fk"],
      [deliveryAttempts, "delivery_attempts_document_customer_fk"],
      [deliveryResults, "delivery_results_attempt_customer_fk"],
      [
        customerCommunicationHistoryEntries,
        "customer_history_intent_customer_fk",
      ],
      [
        customerCommunicationHistoryEntries,
        "customer_history_document_customer_fk",
      ],
      [
        customerCommunicationHistoryEntries,
        "customer_history_result_customer_fk",
      ],
    ] as const;

    for (const [table, name] of expectedForeignKeys) {
      const foreignKey = getTableConfig(table).foreignKeys.find(
        (candidate) => candidate.getName() === name,
      );
      expect(foreignKey, name).toBeDefined();
      expect(foreignKey?.onDelete, name).toBe("restrict");
    }

    expect(
      communicationTables
        .flatMap((table) => getTableConfig(table).foreignKeys)
        .some((foreignKey) => foreignKey.onDelete === "cascade"),
    ).toBe(false);
  });

  it("stores immutable render and recipient evidence as required snapshots", () => {
    for (const column of [
      communicationIntents.payloadSnapshot,
      documents.contentSnapshot,
      deliveryResults.safeEvidence,
      communicationAuditEvents.safeMetadata,
    ]) {
      expect(column.getSQLType()).toBe("jsonb");
      expect(column.notNull).toBe(true);
    }
    expect(communicationIntents.contactSnapshot.getSQLType()).toBe("jsonb");
    expect(communicationIntents.idempotencyFingerprint.notNull).toBe(true);
    expect(documents.checksumSha256.notNull).toBe(true);
    expect(documents.supersedesDocumentId.notNull).toBe(false);
  });

  it("provides collision, idempotency, event, and version safeguards", () => {
    expect(indexNames(communicationTemplates)).toEqual(
      expect.arrayContaining([
        "communication_templates_key_version_locale_unique",
        "communication_templates_one_active_unique",
      ]),
    );
    expect(indexNames(communicationIntents)).toEqual(
      expect.arrayContaining([
        "communication_intents_reference_unique",
        "communication_intents_idempotency_unique",
        "communication_intents_business_event_unique",
        "communication_intents_booking_event_unique",
        "communication_intents_job_event_unique",
        "communication_intents_finance_event_unique",
      ]),
    );
    expect(indexNames(documents)).toEqual(
      expect.arrayContaining([
        "documents_reference_unique",
        "documents_intent_type_unique",
        "documents_supersedes_once_unique",
      ]),
    );
    expect(indexNames(deliveryAttempts)).toEqual(
      expect.arrayContaining([
        "delivery_attempts_reference_unique",
        "delivery_attempts_intent_number_unique",
        "delivery_attempts_idempotency_unique",
      ]),
    );
  });

  it("keeps delivery, results, customer history, and audit evidence append-oriented", () => {
    for (const table of [
      documents,
      deliveryAttempts,
      deliveryResults,
      customerCommunicationHistoryEntries,
      communicationAuditEvents,
    ] as const) {
      expect("updatedAt" in table, getTableName(table)).toBe(false);
    }

    expect("updatedAt" in communicationIntents).toBe(true);
    expect("updatedAt" in customerCommunicationPreferences).toBe(true);
  });

  it("contains no production provider identifiers or mutable delivery payload", () => {
    const columnNames = communicationTables.flatMap((table) =>
      getTableConfig(table).columns.map((column) => column.name),
    );
    expect(
      columnNames.filter((name) =>
        /(?:smtp|twilio|whatsapp|provider_message|external_delivery)/i.test(
          name,
        ),
      ),
    ).toEqual([]);
  });
});
