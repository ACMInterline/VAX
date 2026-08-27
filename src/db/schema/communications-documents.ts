import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { bookingAuditEvents, bookingOccupancies, bookings } from "./booking-engine";
import { customerContacts, customers } from "./customer-crm";
import { financeAuditEvents, invoices, payments } from "./finance-invoicing";
import { userProfiles } from "./identity-access";
import { jobAuditEvents, jobs } from "./job-execution";
import { businessAuditEvents, quotes } from "./request-quote";

type JsonObject = Record<string, unknown>;

export const communicationTemplates = pgTable(
  "communication_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateKey: varchar("template_key", { length: 96 }).notNull(),
    version: integer("version").notNull(),
    locale: varchar("locale", { length: 8 }).notNull(),
    documentType: varchar("document_type", { length: 40 }).notNull(),
    titleTemplate: text("title_template").notNull(),
    bodyTemplate: text("body_template").notNull(),
    variablesContract: jsonb("variables_contract")
      .$type<readonly string[]>()
      .notNull(),
    status: varchar("status", { length: 16 }).default("DRAFT").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    createdByProfileId: uuid("created_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [
    uniqueIndex("communication_templates_key_version_locale_unique").on(
      table.templateKey,
      table.version,
      table.locale,
    ),
    uniqueIndex("communication_templates_one_active_unique")
      .on(table.templateKey, table.locale)
      .where(sql`${table.status} = 'ACTIVE'`),
    index("communication_templates_active_lookup_idx").on(
      table.templateKey,
      table.locale,
      table.status,
    ),
    check(
      "communication_templates_key_valid",
      sql`${table.templateKey} ~ '^[a-z][a-z0-9_]{2,95}$'`,
    ),
    check("communication_templates_version_positive", sql`${table.version} >= 1`),
    check("communication_templates_locale_valid", sql`${table.locale} in ('bg', 'en')`),
    check(
      "communication_templates_document_type_valid",
      sql`${table.documentType} in ('QUOTE_SUMMARY', 'BOOKING_CONFIRMATION', 'JOB_COMPLETION_SUMMARY', 'CLEANING_PASSPORT', 'INVOICE', 'PAYMENT_ACKNOWLEDGEMENT')`,
    ),
    check(
      "communication_templates_content_not_blank",
      sql`length(trim(${table.titleTemplate})) > 0 and length(trim(${table.bodyTemplate})) > 0`,
    ),
    check(
      "communication_templates_contract_array",
      sql`jsonb_typeof(${table.variablesContract}) = 'array'`,
    ),
    check(
      "communication_templates_status_valid",
      sql`${table.status} in ('DRAFT', 'ACTIVE', 'SUPERSEDED')`,
    ),
    check(
      "communication_templates_lifecycle_consistent",
      sql`(${table.status} = 'DRAFT' and ${table.activatedAt} is null and ${table.supersededAt} is null) or (${table.status} = 'ACTIVE' and ${table.activatedAt} is not null and ${table.supersededAt} is null) or (${table.status} = 'SUPERSEDED' and ${table.activatedAt} is not null and ${table.supersededAt} is not null and ${table.supersededAt} >= ${table.activatedAt})`,
    ),
  ],
);

export const customerCommunicationPreferences = pgTable(
  "customer_communication_preferences",
  {
    customerId: uuid("customer_id")
      .primaryKey()
      .references(() => customers.id, { onDelete: "restrict" }),
    portalEnabled: boolean("portal_enabled").default(true).notNull(),
    emailFutureEnabled: boolean("email_future_enabled").default(false).notNull(),
    smsFutureEnabled: boolean("sms_future_enabled").default(false).notNull(),
    operationalAllowed: boolean("operational_allowed").default(true).notNull(),
    billingAllowed: boolean("billing_allowed").default(true).notNull(),
    marketingConsent: boolean("marketing_consent").default(false).notNull(),
    preferredLocale: varchar("preferred_locale", { length: 8 })
      .default("bg")
      .notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    updatedByProfileId: uuid("updated_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [
    check(
      "customer_communication_preferences_locale_valid",
      sql`${table.preferredLocale} in ('bg', 'en')`,
    ),
    check(
      "customer_communication_preferences_version_positive",
      sql`${table.version} >= 1`,
    ),
  ],
);

export const communicationIntents = pgTable(
  "communication_intents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    communicationReference: varchar("communication_reference", { length: 40 })
      .notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    contactId: uuid("contact_id"),
    sourceType: varchar("source_type", { length: 24 }).notNull(),
    sourceReference: varchar("source_reference", { length: 96 }).notNull(),
    sourceVersion: integer("source_version").notNull(),
    quoteId: uuid("quote_id"),
    bookingId: uuid("booking_id"),
    bookingOccupancyId: uuid("booking_occupancy_id").references(
      () => bookingOccupancies.id,
      { onDelete: "restrict" },
    ),
    jobId: uuid("job_id"),
    invoiceId: uuid("invoice_id"),
    paymentId: uuid("payment_id"),
    businessAuditEventId: uuid("business_audit_event_id").references(
      () => businessAuditEvents.id,
      { onDelete: "restrict" },
    ),
    bookingAuditEventId: uuid("booking_audit_event_id").references(
      () => bookingAuditEvents.id,
      { onDelete: "restrict" },
    ),
    jobAuditEventId: uuid("job_audit_event_id").references(
      () => jobAuditEvents.id,
      { onDelete: "restrict" },
    ),
    financeAuditEventId: uuid("finance_audit_event_id").references(
      () => financeAuditEvents.id,
      { onDelete: "restrict" },
    ),
    eventType: varchar("event_type", { length: 40 }).notNull(),
    purpose: varchar("purpose", { length: 16 }).notNull(),
    channel: varchar("channel", { length: 24 }).notNull(),
    locale: varchar("locale", { length: 8 }).notNull(),
    status: varchar("status", { length: 24 }).notNull(),
    templateKey: varchar("template_key", { length: 96 }).notNull(),
    templateVersion: integer("template_version").notNull(),
    payloadSnapshot: jsonb("payload_snapshot").$type<JsonObject>().notNull(),
    contactSnapshot: jsonb("contact_snapshot").$type<JsonObject>(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    idempotencyFingerprint: varchar("idempotency_fingerprint", {
      length: 64,
    }).notNull(),
    createdByProfileId: uuid("created_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    deliveredLocalAt: timestamp("delivered_local_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "communication_intents_contact_customer_fk",
      columns: [table.contactId, table.customerId],
      foreignColumns: [customerContacts.id, customerContacts.customerId],
    }).onDelete("restrict"),
    foreignKey({
      name: "communication_intents_quote_customer_fk",
      columns: [table.quoteId, table.customerId],
      foreignColumns: [quotes.id, quotes.customerId],
    }).onDelete("restrict"),
    foreignKey({
      name: "communication_intents_booking_customer_fk",
      columns: [table.bookingId, table.customerId],
      foreignColumns: [bookings.id, bookings.customerId],
    }).onDelete("restrict"),
    foreignKey({
      name: "communication_intents_job_customer_fk",
      columns: [table.jobId, table.customerId],
      foreignColumns: [jobs.id, jobs.customerId],
    }).onDelete("restrict"),
    foreignKey({
      name: "communication_intents_invoice_customer_fk",
      columns: [table.invoiceId, table.customerId],
      foreignColumns: [invoices.id, invoices.customerId],
    }).onDelete("restrict"),
    foreignKey({
      name: "communication_intents_payment_customer_fk",
      columns: [table.paymentId, table.customerId],
      foreignColumns: [payments.id, payments.customerId],
    }).onDelete("restrict"),
    foreignKey({
      name: "communication_intents_template_fk",
      columns: [table.templateKey, table.templateVersion, table.locale],
      foreignColumns: [
        communicationTemplates.templateKey,
        communicationTemplates.version,
        communicationTemplates.locale,
      ],
    }).onDelete("restrict"),
    uniqueIndex("communication_intents_reference_unique").on(
      table.communicationReference,
    ),
    uniqueIndex("communication_intents_id_customer_unique").on(
      table.id,
      table.customerId,
    ),
    uniqueIndex("communication_intents_idempotency_unique").on(
      table.idempotencyKey,
    ),
    uniqueIndex("communication_intents_business_event_unique")
      .on(
        table.businessAuditEventId,
        table.channel,
        table.templateKey,
        table.templateVersion,
      )
      .where(sql`${table.businessAuditEventId} is not null`),
    uniqueIndex("communication_intents_booking_event_unique")
      .on(
        table.bookingAuditEventId,
        table.channel,
        table.templateKey,
        table.templateVersion,
      )
      .where(sql`${table.bookingAuditEventId} is not null`),
    uniqueIndex("communication_intents_job_event_unique")
      .on(
        table.jobAuditEventId,
        table.channel,
        table.templateKey,
        table.templateVersion,
      )
      .where(sql`${table.jobAuditEventId} is not null`),
    uniqueIndex("communication_intents_finance_event_unique")
      .on(
        table.financeAuditEventId,
        table.channel,
        table.templateKey,
        table.templateVersion,
      )
      .where(sql`${table.financeAuditEventId} is not null`),
    index("communication_intents_staff_queue_idx").on(
      table.status,
      table.createdAt,
    ),
    index("communication_intents_customer_history_idx").on(
      table.customerId,
      table.createdAt,
    ),
    check(
      "communication_intents_reference_valid",
      sql`${table.communicationReference} ~ '^COM-[A-F0-9]{24}$'`,
    ),
    check("communication_intents_source_version_positive", sql`${table.sourceVersion} >= 1`),
    check(
      "communication_intents_source_type_valid",
      sql`${table.sourceType} in ('QUOTE', 'BOOKING', 'JOB', 'INVOICE', 'PAYMENT', 'MANUAL')`,
    ),
    check(
      "communication_intents_event_type_valid",
      sql`${table.eventType} in ('QUOTE_ISSUED', 'BOOKING_CONFIRMED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED', 'JOB_COMPLETED', 'INVOICE_ISSUED', 'PAYMENT_CONFIRMED', 'PAYMENT_REVERSED', 'MANUAL_STAFF_MESSAGE')`,
    ),
    check(
      "communication_intents_purpose_valid",
      sql`${table.purpose} in ('OPERATIONAL', 'BILLING', 'MARKETING')`,
    ),
    check(
      "communication_intents_no_marketing_automation",
      sql`${table.purpose} <> 'MARKETING'`,
    ),
    check(
      "communication_intents_channel_valid",
      sql`${table.channel} in ('PORTAL', 'EMAIL_FUTURE', 'SMS_FUTURE', 'MANUAL')`,
    ),
    check("communication_intents_locale_valid", sql`${table.locale} in ('bg', 'en')`),
    check(
      "communication_intents_status_valid",
      sql`${table.status} in ('DRAFT', 'READY', 'QUEUED_FUTURE', 'DELIVERED_LOCAL', 'FAILED', 'CANCELLED')`,
    ),
    check(
      "communication_intents_source_exactly_one",
      sql`num_nonnulls(${table.quoteId}, ${table.bookingId}, ${table.jobId}, ${table.invoiceId}, ${table.paymentId}) = case when ${table.sourceType} = 'MANUAL' then 0 else 1 end`,
    ),
    check(
      "communication_intents_source_matches_type",
      sql`(${table.sourceType} = 'QUOTE' and ${table.quoteId} is not null and ${table.businessAuditEventId} is not null) or (${table.sourceType} = 'BOOKING' and ${table.bookingId} is not null and ${table.bookingAuditEventId} is not null) or (${table.sourceType} = 'JOB' and ${table.jobId} is not null and ${table.jobAuditEventId} is not null) or (${table.sourceType} = 'INVOICE' and ${table.invoiceId} is not null and ${table.financeAuditEventId} is not null) or (${table.sourceType} = 'PAYMENT' and ${table.paymentId} is not null and ${table.financeAuditEventId} is not null) or (${table.sourceType} = 'MANUAL' and num_nonnulls(${table.businessAuditEventId}, ${table.bookingAuditEventId}, ${table.jobAuditEventId}, ${table.financeAuditEventId}) = 0)`,
    ),
    check(
      "communication_intents_source_audit_exactly_one",
      sql`num_nonnulls(${table.businessAuditEventId}, ${table.bookingAuditEventId}, ${table.jobAuditEventId}, ${table.financeAuditEventId}) = case when ${table.sourceType} = 'MANUAL' then 0 else 1 end`,
    ),
    check(
      "communication_intents_event_source_consistent",
      sql`(${table.eventType} = 'QUOTE_ISSUED' and ${table.sourceType} = 'QUOTE') or (${table.eventType} in ('BOOKING_CONFIRMED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED') and ${table.sourceType} = 'BOOKING') or (${table.eventType} = 'JOB_COMPLETED' and ${table.sourceType} = 'JOB') or (${table.eventType} = 'INVOICE_ISSUED' and ${table.sourceType} = 'INVOICE') or (${table.eventType} in ('PAYMENT_CONFIRMED', 'PAYMENT_REVERSED') and ${table.sourceType} = 'PAYMENT') or (${table.eventType} = 'MANUAL_STAFF_MESSAGE' and ${table.sourceType} = 'MANUAL')`,
    ),
    check(
      "communication_intents_event_purpose_consistent",
      sql`(${table.eventType} in ('QUOTE_ISSUED', 'BOOKING_CONFIRMED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED', 'JOB_COMPLETED', 'MANUAL_STAFF_MESSAGE') and ${table.purpose} = 'OPERATIONAL') or (${table.eventType} in ('INVOICE_ISSUED', 'PAYMENT_CONFIRMED', 'PAYMENT_REVERSED') and ${table.purpose} = 'BILLING')`,
    ),
    check(
      "communication_intents_booking_occupancy_consistent",
      sql`(${table.eventType} in ('BOOKING_CONFIRMED', 'BOOKING_RESCHEDULED') and ${table.bookingOccupancyId} is not null) or (${table.eventType} not in ('BOOKING_CONFIRMED', 'BOOKING_RESCHEDULED') and ${table.bookingOccupancyId} is null)`,
    ),
    check(
      "communication_intents_contact_snapshot_consistent",
      sql`(${table.contactId} is null and ${table.contactSnapshot} is null) or (${table.contactId} is not null and ${table.contactSnapshot} is not null and jsonb_typeof(${table.contactSnapshot}) = 'object')`,
    ),
    check(
      "communication_intents_future_channel_has_contact",
      sql`${table.channel} not in ('EMAIL_FUTURE', 'SMS_FUTURE') or ${table.contactId} is not null`,
    ),
    check(
      "communication_intents_payload_object",
      sql`jsonb_typeof(${table.payloadSnapshot}) = 'object'`,
    ),
    check(
      "communication_intents_fingerprint_valid",
      sql`${table.idempotencyFingerprint} ~ '^[A-Fa-f0-9]{64}$'`,
    ),
    check(
      "communication_intents_lifecycle_consistent",
      sql`(${table.status} = 'DRAFT' and ${table.readyAt} is null and ${table.deliveredLocalAt} is null and ${table.cancelledAt} is null) or (${table.status} = 'READY' and ${table.readyAt} is not null and ${table.deliveredLocalAt} is null and ${table.cancelledAt} is null) or (${table.status} = 'QUEUED_FUTURE' and ${table.channel} in ('EMAIL_FUTURE', 'SMS_FUTURE') and ${table.readyAt} is not null and ${table.deliveredLocalAt} is null and ${table.cancelledAt} is null) or (${table.status} = 'DELIVERED_LOCAL' and ${table.channel} = 'PORTAL' and ${table.readyAt} is not null and ${table.deliveredLocalAt} is not null and ${table.cancelledAt} is null and ${table.deliveredLocalAt} >= ${table.readyAt}) or (${table.status} = 'FAILED' and ${table.readyAt} is not null and ${table.deliveredLocalAt} is null and ${table.cancelledAt} is null) or (${table.status} = 'CANCELLED' and ${table.deliveredLocalAt} is null and ${table.cancelledAt} is not null)`,
    ),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentReference: varchar("document_reference", { length: 40 }).notNull(),
    communicationIntentId: uuid("communication_intent_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    documentType: varchar("document_type", { length: 40 }).notNull(),
    documentVersion: integer("document_version").default(1).notNull(),
    sourceType: varchar("source_type", { length: 24 }).notNull(),
    sourceReference: varchar("source_reference", { length: 96 }).notNull(),
    sourceVersion: integer("source_version").notNull(),
    locale: varchar("locale", { length: 8 }).notNull(),
    templateKey: varchar("template_key", { length: 96 }).notNull(),
    templateVersion: integer("template_version").notNull(),
    rendererVersion: integer("renderer_version").notNull(),
    titleSnapshot: text("title_snapshot").notNull(),
    contentSnapshot: jsonb("content_snapshot").$type<JsonObject>().notNull(),
    renderedFormat: varchar("rendered_format", { length: 24 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    checksumSha256: varchar("checksum_sha256", { length: 64 }).notNull(),
    supersedesDocumentId: uuid("supersedes_document_id"),
    createdByProfileId: uuid("created_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    renderedAt: timestamp("rendered_at", { withTimezone: true }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "documents_intent_customer_fk",
      columns: [table.communicationIntentId, table.customerId],
      foreignColumns: [communicationIntents.id, communicationIntents.customerId],
    }).onDelete("restrict"),
    foreignKey({
      name: "documents_template_fk",
      columns: [table.templateKey, table.templateVersion, table.locale],
      foreignColumns: [
        communicationTemplates.templateKey,
        communicationTemplates.version,
        communicationTemplates.locale,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "documents_supersedes_fk",
      columns: [table.supersedesDocumentId],
      foreignColumns: [table.id],
    }).onDelete("restrict"),
    uniqueIndex("documents_reference_unique").on(table.documentReference),
    uniqueIndex("documents_id_customer_unique").on(table.id, table.customerId),
    uniqueIndex("documents_intent_type_unique").on(
      table.communicationIntentId,
      table.documentType,
    ),
    uniqueIndex("documents_supersedes_once_unique")
      .on(table.supersedesDocumentId)
      .where(sql`${table.supersedesDocumentId} is not null`),
    index("documents_customer_created_idx").on(
      table.customerId,
      table.createdAt,
    ),
    check(
      "documents_reference_valid",
      sql`${table.documentReference} ~ '^DOC-[A-F0-9]{24}$'`,
    ),
    check(
      "documents_type_valid",
      sql`${table.documentType} in ('QUOTE_SUMMARY', 'BOOKING_CONFIRMATION', 'JOB_COMPLETION_SUMMARY', 'CLEANING_PASSPORT', 'INVOICE', 'PAYMENT_ACKNOWLEDGEMENT')`,
    ),
    check(
      "documents_source_type_valid",
      sql`${table.sourceType} in ('QUOTE', 'BOOKING', 'JOB', 'INVOICE', 'PAYMENT')`,
    ),
    check(
      "documents_versions_positive",
      sql`${table.documentVersion} >= 1 and ${table.sourceVersion} >= 1 and ${table.templateVersion} >= 1 and ${table.rendererVersion} >= 1`,
    ),
    check("documents_locale_valid", sql`${table.locale} in ('bg', 'en')`),
    check(
      "documents_title_not_blank",
      sql`length(trim(${table.titleSnapshot})) > 0`,
    ),
    check(
      "documents_content_object",
      sql`jsonb_typeof(${table.contentSnapshot}) = 'object'`,
    ),
    check(
      "documents_format_html_print",
      sql`${table.renderedFormat} = 'HTML_PRINT'`,
    ),
    check(
      "documents_status_valid",
      sql`${table.status} in ('DRAFT', 'RENDERED', 'FINAL', 'SUPERSEDED', 'CANCELLED')`,
    ),
    check(
      "documents_checksum_valid",
      sql`${table.checksumSha256} ~ '^[A-Fa-f0-9]{64}$'`,
    ),
    check(
      "documents_not_self_superseding",
      sql`${table.supersedesDocumentId} is null or ${table.supersedesDocumentId} <> ${table.id}`,
    ),
    check(
      "documents_lifecycle_consistent",
      sql`(${table.status} = 'DRAFT' and ${table.renderedAt} is null and ${table.finalizedAt} is null and ${table.supersededAt} is null and ${table.cancelledAt} is null) or (${table.status} = 'RENDERED' and ${table.renderedAt} is not null and ${table.finalizedAt} is null and ${table.supersededAt} is null and ${table.cancelledAt} is null) or (${table.status} = 'FINAL' and ${table.renderedAt} is not null and ${table.finalizedAt} is not null and ${table.supersededAt} is null and ${table.cancelledAt} is null) or (${table.status} = 'SUPERSEDED' and ${table.renderedAt} is not null and ${table.finalizedAt} is not null and ${table.supersededAt} is not null and ${table.cancelledAt} is null) or (${table.status} = 'CANCELLED' and ${table.finalizedAt} is null and ${table.supersededAt} is null and ${table.cancelledAt} is not null)`,
    ),
    check(
      "documents_lifecycle_ordered",
      sql`(${table.finalizedAt} is null or ${table.renderedAt} is not null and ${table.finalizedAt} >= ${table.renderedAt}) and (${table.supersededAt} is null or ${table.supersededAt} >= ${table.finalizedAt})`,
    ),
  ],
);

export const deliveryAttempts = pgTable(
  "delivery_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deliveryReference: varchar("delivery_reference", { length: 40 }).notNull(),
    communicationIntentId: uuid("communication_intent_id").notNull(),
    documentId: uuid("document_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    channel: varchar("channel", { length: 24 }).notNull(),
    adapterKey: varchar("adapter_key", { length: 40 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    attemptedByProfileId: uuid("attempted_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "delivery_attempts_intent_customer_fk",
      columns: [table.communicationIntentId, table.customerId],
      foreignColumns: [communicationIntents.id, communicationIntents.customerId],
    }).onDelete("restrict"),
    foreignKey({
      name: "delivery_attempts_document_customer_fk",
      columns: [table.documentId, table.customerId],
      foreignColumns: [documents.id, documents.customerId],
    }).onDelete("restrict"),
    uniqueIndex("delivery_attempts_reference_unique").on(
      table.deliveryReference,
    ),
    uniqueIndex("delivery_attempts_intent_number_unique").on(
      table.communicationIntentId,
      table.attemptNumber,
    ),
    uniqueIndex("delivery_attempts_idempotency_unique").on(
      table.idempotencyKey,
    ),
    uniqueIndex("delivery_attempts_id_customer_unique").on(
      table.id,
      table.customerId,
    ),
    check(
      "delivery_attempts_reference_valid",
      sql`${table.deliveryReference} ~ '^DEL-[A-F0-9]{24}$'`,
    ),
    check("delivery_attempts_number_positive", sql`${table.attemptNumber} >= 1`),
    check("delivery_attempts_portal_only", sql`${table.channel} = 'PORTAL'`),
    check(
      "delivery_attempts_local_adapter_only",
      sql`${table.adapterKey} = 'PORTAL_LOCAL'`,
    ),
    check(
      "delivery_attempts_status_valid",
      sql`${table.status} in ('STARTED', 'COMPLETED', 'FAILED', 'CANCELLED')`,
    ),
    check(
      "delivery_attempts_lifecycle_consistent",
      sql`(${table.status} = 'STARTED' and ${table.completedAt} is null) or (${table.status} in ('COMPLETED', 'FAILED', 'CANCELLED') and ${table.completedAt} is not null and ${table.completedAt} >= ${table.startedAt})`,
    ),
  ],
);

export const deliveryResults = pgTable(
  "delivery_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deliveryAttemptId: uuid("delivery_attempt_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    outcome: varchar("outcome", { length: 24 }).notNull(),
    resultCode: varchar("result_code", { length: 64 }).notNull(),
    retryable: boolean("retryable").default(false).notNull(),
    safeEvidence: jsonb("safe_evidence")
      .$type<JsonObject>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "delivery_results_attempt_customer_fk",
      columns: [table.deliveryAttemptId, table.customerId],
      foreignColumns: [deliveryAttempts.id, deliveryAttempts.customerId],
    }).onDelete("restrict"),
    uniqueIndex("delivery_results_attempt_unique").on(table.deliveryAttemptId),
    uniqueIndex("delivery_results_id_customer_unique").on(
      table.id,
      table.customerId,
    ),
    check(
      "delivery_results_outcome_valid",
      sql`${table.outcome} in ('DELIVERED_LOCAL', 'FAILED', 'CANCELLED')`,
    ),
    check(
      "delivery_results_code_valid",
      sql`${table.resultCode} in ('PORTAL_PUBLISHED', 'LOCAL_FAILURE', 'CANCELLED_BY_STAFF')`,
    ),
    check(
      "delivery_results_outcome_code_consistent",
      sql`(${table.outcome} = 'DELIVERED_LOCAL' and ${table.resultCode} = 'PORTAL_PUBLISHED' and ${table.retryable} = false) or (${table.outcome} = 'FAILED' and ${table.resultCode} = 'LOCAL_FAILURE') or (${table.outcome} = 'CANCELLED' and ${table.resultCode} = 'CANCELLED_BY_STAFF' and ${table.retryable} = false)`,
    ),
    check(
      "delivery_results_evidence_object",
      sql`jsonb_typeof(${table.safeEvidence}) = 'object'`,
    ),
  ],
);

export const customerCommunicationHistoryEntries = pgTable(
  "customer_communication_history_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    historyReference: varchar("history_reference", { length: 40 }).notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    communicationIntentId: uuid("communication_intent_id").notNull(),
    documentId: uuid("document_id").notNull(),
    deliveryResultId: uuid("delivery_result_id").notNull(),
    eventType: varchar("event_type", { length: 40 }).notNull(),
    locale: varchar("locale", { length: 8 }).notNull(),
    titleSnapshot: text("title_snapshot").notNull(),
    visibleAt: timestamp("visible_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "customer_history_intent_customer_fk",
      columns: [table.communicationIntentId, table.customerId],
      foreignColumns: [communicationIntents.id, communicationIntents.customerId],
    }).onDelete("restrict"),
    foreignKey({
      name: "customer_history_document_customer_fk",
      columns: [table.documentId, table.customerId],
      foreignColumns: [documents.id, documents.customerId],
    }).onDelete("restrict"),
    foreignKey({
      name: "customer_history_result_customer_fk",
      columns: [table.deliveryResultId, table.customerId],
      foreignColumns: [deliveryResults.id, deliveryResults.customerId],
    }).onDelete("restrict"),
    uniqueIndex("customer_history_reference_unique").on(table.historyReference),
    uniqueIndex("customer_history_intent_document_unique").on(
      table.communicationIntentId,
      table.documentId,
    ),
    index("customer_history_customer_visible_idx").on(
      table.customerId,
      table.visibleAt,
    ),
    check(
      "customer_history_reference_valid",
      sql`${table.historyReference} ~ '^HIS-[A-F0-9]{24}$'`,
    ),
    check("customer_history_locale_valid", sql`${table.locale} in ('bg', 'en')`),
    check(
      "customer_history_title_not_blank",
      sql`length(trim(${table.titleSnapshot})) > 0`,
    ),
  ],
);

export const communicationAuditEvents = pgTable(
  "communication_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "restrict",
    }),
    communicationIntentId: uuid("communication_intent_id").references(
      () => communicationIntents.id,
      { onDelete: "restrict" },
    ),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "restrict",
    }),
    deliveryAttemptId: uuid("delivery_attempt_id").references(
      () => deliveryAttempts.id,
      { onDelete: "restrict" },
    ),
    historyEntryId: uuid("history_entry_id").references(
      () => customerCommunicationHistoryEntries.id,
      { onDelete: "restrict" },
    ),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    actorProfileId: uuid("actor_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    source: varchar("source", { length: 16 }).notNull(),
    correlationId: uuid("correlation_id").defaultRandom().notNull(),
    safeMetadata: jsonb("safe_metadata")
      .$type<JsonObject>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("communication_audit_events_correlation_unique").on(
      table.correlationId,
    ),
    index("communication_audit_events_intent_timeline_idx").on(
      table.communicationIntentId,
      table.createdAt,
    ),
    check(
      "communication_audit_events_scope_present",
      sql`num_nonnulls(${table.customerId}, ${table.communicationIntentId}, ${table.documentId}, ${table.deliveryAttemptId}, ${table.historyEntryId}) >= 1`,
    ),
    check(
      "communication_audit_events_type_valid",
      sql`${table.eventType} in ('INTENT_CREATED', 'DOCUMENT_RENDERED', 'DOCUMENT_FINALIZED', 'PORTAL_PUBLISHED', 'FUTURE_CHANNEL_DEFERRED', 'INTENT_CANCELLED', 'DOCUMENT_SUPERSEDED', 'PREFERENCES_UPDATED')`,
    ),
    check(
      "communication_audit_events_source_valid",
      sql`${table.source} in ('STAFF', 'CUSTOMER', 'SYSTEM')`,
    ),
    check(
      "communication_audit_events_metadata_object",
      sql`jsonb_typeof(${table.safeMetadata}) = 'object'`,
    ),
  ],
);
