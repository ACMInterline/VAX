import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
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
import { bookingItems, bookings, quoteAcceptances } from "./booking-engine";
import { customers } from "./customer-crm";
import { userProfiles } from "./identity-access";
import { jobItems, jobs } from "./job-execution";
import { quoteItems } from "./request-quote";
import { services } from "./service-catalogue";

type JsonObject = Record<string, unknown>;

function managedConfigurationColumns() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    createdByProfileId: uuid("created_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    updatedByProfileId: uuid("updated_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
  };
}

export const customerBillingProfiles = pgTable(
  "customer_billing_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    status: varchar("status", { length: 16 }).default("DRAFT").notNull(),
    billingName: varchar("billing_name", { length: 255 }).notNull(),
    billingEmail: varchar("billing_email", { length: 320 }),
    billingAddressLine1: text("billing_address_line_1").notNull(),
    billingAddressLine2: text("billing_address_line_2"),
    billingCity: varchar("billing_city", { length: 160 }).notNull(),
    billingPostalCode: varchar("billing_postal_code", { length: 20 }),
    billingCountryCode: varchar("billing_country_code", { length: 2 })
      .default("BG")
      .notNull(),
    companyRegistrationNumber: varchar("company_registration_number", {
      length: 64,
    }),
    vatNumber: varchar("vat_number", { length: 64 }),
    vatNumberStatus: varchar("vat_number_status", { length: 24 })
      .default("UNVERIFIED")
      .notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedByProfileId: uuid("approved_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    ...managedConfigurationColumns(),
  },
  (table) => [
    uniqueIndex("customer_billing_profiles_customer_version_unique").on(
      table.customerId,
      table.version,
    ),
    uniqueIndex("customer_billing_profiles_id_customer_version_unique").on(
      table.id,
      table.customerId,
      table.version,
    ),
    uniqueIndex("customer_billing_profiles_current_approved_unique")
      .on(table.customerId)
      .where(sql`${table.status} = 'APPROVED'`),
    index("customer_billing_profiles_customer_status_idx").on(
      table.customerId,
      table.status,
    ),
    check(
      "customer_billing_profiles_status_valid",
      sql`${table.status} in ('DRAFT', 'APPROVED', 'SUPERSEDED')`,
    ),
    check(
      "customer_billing_profiles_version_positive",
      sql`${table.version} >= 1`,
    ),
    check(
      "customer_billing_profiles_required_text_not_blank",
      sql`length(trim(${table.billingName})) > 0 and length(trim(${table.billingAddressLine1})) > 0 and length(trim(${table.billingCity})) > 0`,
    ),
    check(
      "customer_billing_profiles_optional_text_not_blank",
      sql`(${table.billingEmail} is null or length(trim(${table.billingEmail})) > 0) and (${table.billingAddressLine2} is null or length(trim(${table.billingAddressLine2})) > 0) and (${table.billingPostalCode} is null or length(trim(${table.billingPostalCode})) > 0) and (${table.companyRegistrationNumber} is null or length(trim(${table.companyRegistrationNumber})) > 0) and (${table.vatNumber} is null or length(trim(${table.vatNumber})) > 0)`,
    ),
    check(
      "customer_billing_profiles_country_code_valid",
      sql`${table.billingCountryCode} ~ '^[A-Z]{2}$'`,
    ),
    check(
      "customer_billing_profiles_vat_status_valid",
      sql`${table.vatNumberStatus} in ('UNVERIFIED', 'VERIFIED_FUTURE', 'NOT_APPLICABLE')`,
    ),
    check(
      "customer_billing_profiles_vat_status_consistent",
      sql`(${table.vatNumberStatus} = 'VERIFIED_FUTURE' and ${table.vatNumber} is not null) or (${table.vatNumberStatus} = 'NOT_APPLICABLE' and ${table.vatNumber} is null) or ${table.vatNumberStatus} = 'UNVERIFIED'`,
    ),
    check(
      "customer_billing_profiles_lifecycle_consistent",
      sql`(${table.status} = 'DRAFT' and ${table.approvedAt} is null and ${table.supersededAt} is null) or (${table.status} = 'APPROVED' and ${table.approvedAt} is not null and ${table.supersededAt} is null) or (${table.status} = 'SUPERSEDED' and ${table.approvedAt} is not null and ${table.supersededAt} is not null and ${table.supersededAt} >= ${table.approvedAt})`,
    ),
  ],
);

export const businessLegalProfiles = pgTable(
  "business_legal_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 96 }).notNull(),
    version: integer("version").notNull(),
    environmentScope: varchar("environment_scope", { length: 16 }).notNull(),
    status: varchar("status", { length: 16 }).default("DRAFT").notNull(),
    legalName: varchar("legal_name", { length: 255 }).notNull(),
    registrationNumber: varchar("registration_number", { length: 64 }).notNull(),
    vatNumber: varchar("vat_number", { length: 64 }),
    vatRegistrationStatus: varchar("vat_registration_status", { length: 24 })
      .default("UNVERIFIED")
      .notNull(),
    registeredAddressLine1: text("registered_address_line_1").notNull(),
    registeredAddressLine2: text("registered_address_line_2"),
    registeredCity: varchar("registered_city", { length: 160 }).notNull(),
    registeredPostalCode: varchar("registered_postal_code", { length: 20 }),
    registeredCountryCode: varchar("registered_country_code", { length: 2 })
      .default("BG")
      .notNull(),
    contactEmail: varchar("contact_email", { length: 320 }),
    contactPhone: varchar("contact_phone", { length: 40 }),
    customerVisiblePaymentInstructions: text(
      "customer_visible_payment_instructions",
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedByProfileId: uuid("approved_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    ...managedConfigurationColumns(),
  },
  (table) => [
    uniqueIndex("business_legal_profiles_code_version_unique").on(
      table.code,
      table.version,
    ),
    uniqueIndex("business_legal_profiles_id_version_unique").on(
      table.id,
      table.version,
    ),
    uniqueIndex("business_legal_profiles_id_version_environment_unique").on(
      table.id,
      table.version,
      table.environmentScope,
    ),
    uniqueIndex("business_legal_profiles_id_environment_unique").on(
      table.id,
      table.environmentScope,
    ),
    uniqueIndex("business_legal_profiles_current_approved_unique")
      .on(table.environmentScope)
      .where(sql`${table.status} = 'APPROVED'`),
    check(
      "business_legal_profiles_environment_valid",
      sql`${table.environmentScope} in ('DEVELOPMENT', 'STAGING', 'PRODUCTION')`,
    ),
    check(
      "business_legal_profiles_status_valid",
      sql`${table.status} in ('DRAFT', 'APPROVED', 'SUPERSEDED')`,
    ),
    check("business_legal_profiles_version_positive", sql`${table.version} >= 1`),
    check(
      "business_legal_profiles_required_text_not_blank",
      sql`length(trim(${table.code})) > 0 and length(trim(${table.legalName})) > 0 and length(trim(${table.registrationNumber})) > 0 and length(trim(${table.registeredAddressLine1})) > 0 and length(trim(${table.registeredCity})) > 0`,
    ),
    check(
      "business_legal_profiles_optional_text_not_blank",
      sql`(${table.vatNumber} is null or length(trim(${table.vatNumber})) > 0) and (${table.registeredAddressLine2} is null or length(trim(${table.registeredAddressLine2})) > 0) and (${table.registeredPostalCode} is null or length(trim(${table.registeredPostalCode})) > 0) and (${table.contactEmail} is null or length(trim(${table.contactEmail})) > 0) and (${table.contactPhone} is null or length(trim(${table.contactPhone})) > 0) and (${table.customerVisiblePaymentInstructions} is null or length(trim(${table.customerVisiblePaymentInstructions})) > 0)`,
    ),
    check(
      "business_legal_profiles_country_code_valid",
      sql`${table.registeredCountryCode} ~ '^[A-Z]{2}$'`,
    ),
    check(
      "business_legal_profiles_vat_status_valid",
      sql`${table.vatRegistrationStatus} in ('VAT_REGISTERED', 'VAT_NOT_REGISTERED', 'UNVERIFIED')`,
    ),
    check(
      "business_legal_profiles_vat_status_consistent",
      sql`(${table.vatRegistrationStatus} = 'VAT_REGISTERED' and ${table.vatNumber} is not null) or (${table.vatRegistrationStatus} = 'VAT_NOT_REGISTERED' and ${table.vatNumber} is null) or ${table.vatRegistrationStatus} = 'UNVERIFIED'`,
    ),
    check(
      "business_legal_profiles_lifecycle_consistent",
      sql`(${table.status} = 'DRAFT' and ${table.approvedAt} is null and ${table.supersededAt} is null) or (${table.status} = 'APPROVED' and ${table.approvedAt} is not null and ${table.supersededAt} is null) or (${table.status} = 'SUPERSEDED' and ${table.approvedAt} is not null and ${table.supersededAt} is not null and ${table.supersededAt} >= ${table.approvedAt})`,
    ),
  ],
);

export const invoiceNumberingPolicies = pgTable(
  "invoice_numbering_policies",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    code: varchar("code", { length: 96 }).notNull(),
    version: integer("version").notNull(),
    environmentScope: varchar("environment_scope", { length: 16 }).notNull(),
    documentType: varchar("document_type", { length: 24 })
      .default("STANDARD")
      .notNull(),
    status: varchar("status", { length: 16 }).default("DRAFT").notNull(),
    prefix: varchar("prefix", { length: 32 }).notNull(),
    paddingWidth: integer("padding_width").default(6).notNull(),
    nextSequence: integer("next_sequence").default(1).notNull(),
    provisional: boolean("provisional").default(true).notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedByProfileId: uuid("approved_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    ...managedConfigurationColumns(),
  },
  (table) => [
    uniqueIndex("invoice_numbering_policies_code_version_unique").on(
      table.code,
      table.version,
    ),
    uniqueIndex("invoice_numbering_policies_id_code_version_unique").on(
      table.id,
      table.code,
      table.version,
    ),
    uniqueIndex(
      "invoice_numbering_policies_id_code_version_environment_unique",
    ).on(table.id, table.code, table.version, table.environmentScope),
    uniqueIndex("invoice_numbering_policies_id_environment_unique").on(
      table.id,
      table.environmentScope,
    ),
    uniqueIndex("invoice_numbering_policies_current_approved_unique")
      .on(table.environmentScope, table.documentType)
      .where(sql`${table.status} = 'APPROVED'`),
    check(
      "invoice_numbering_policies_environment_valid",
      sql`${table.environmentScope} in ('DEVELOPMENT', 'STAGING', 'PRODUCTION')`,
    ),
    check(
      "invoice_numbering_policies_document_type_valid",
      sql`${table.documentType} in ('STANDARD', 'PROFORMA', 'CREDIT_NOTE')`,
    ),
    check(
      "invoice_numbering_policies_status_valid",
      sql`${table.status} in ('DRAFT', 'APPROVED', 'SUPERSEDED')`,
    ),
    check(
      "invoice_numbering_policies_version_sequence_valid",
      sql`${table.version} >= 1 and ${table.nextSequence} >= 1 and ${table.paddingWidth} between 1 and 12`,
    ),
    check(
      "invoice_numbering_policies_code_prefix_valid",
      sql`length(trim(${table.code})) > 0 and ${table.prefix} ~ '^[A-Z0-9][A-Z0-9-]{0,31}$'`,
    ),
    check(
      "invoice_numbering_policies_production_approved_not_provisional",
      sql`${table.environmentScope} <> 'PRODUCTION' or ${table.status} <> 'APPROVED' or ${table.provisional} = false`,
    ),
    check(
      "invoice_numbering_policies_lifecycle_consistent",
      sql`(${table.status} = 'DRAFT' and ${table.approvedAt} is null and ${table.supersededAt} is null) or (${table.status} = 'APPROVED' and ${table.approvedAt} is not null and ${table.supersededAt} is null) or (${table.status} = 'SUPERSEDED' and ${table.approvedAt} is not null and ${table.supersededAt} is not null and ${table.supersededAt} >= ${table.approvedAt})`,
    ),
  ],
);

export const invoicePolicies = pgTable(
  "invoice_policies",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    code: varchar("code", { length: 96 }).notNull(),
    version: integer("version").notNull(),
    environmentScope: varchar("environment_scope", { length: 16 }).notNull(),
    status: varchar("status", { length: 16 }).default("DRAFT").notNull(),
    draftEligibility: varchar("draft_eligibility", { length: 32 }).notNull(),
    issueEligibility: varchar("issue_eligibility", { length: 32 }).notNull(),
    paymentTerms: varchar("payment_terms", { length: 24 }).notNull(),
    defaultDueDays: integer("default_due_days"),
    currency: varchar("currency", { length: 3 }).default("EUR").notNull(),
    numberingPolicyId: integer("numbering_policy_id").notNull(),
    sellerLegalProfileId: uuid("seller_legal_profile_id"),
    provisional: boolean("provisional").default(true).notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedByProfileId: uuid("approved_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    ...managedConfigurationColumns(),
  },
  (table) => [
    uniqueIndex("invoice_policies_code_version_unique").on(
      table.code,
      table.version,
    ),
    uniqueIndex("invoice_policies_id_code_version_unique").on(
      table.id,
      table.code,
      table.version,
    ),
    uniqueIndex("invoice_policies_id_code_version_environment_unique").on(
      table.id,
      table.code,
      table.version,
      table.environmentScope,
    ),
    foreignKey({
      name: "invoice_policies_numbering_environment_fk",
      columns: [table.numberingPolicyId, table.environmentScope],
      foreignColumns: [
        invoiceNumberingPolicies.id,
        invoiceNumberingPolicies.environmentScope,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "invoice_policies_seller_environment_fk",
      columns: [table.sellerLegalProfileId, table.environmentScope],
      foreignColumns: [
        businessLegalProfiles.id,
        businessLegalProfiles.environmentScope,
      ],
    }).onDelete("restrict"),
    uniqueIndex("invoice_policies_current_approved_unique")
      .on(table.environmentScope)
      .where(sql`${table.status} = 'APPROVED'`),
    check(
      "invoice_policies_environment_valid",
      sql`${table.environmentScope} in ('DEVELOPMENT', 'STAGING', 'PRODUCTION')`,
    ),
    check(
      "invoice_policies_status_valid",
      sql`${table.status} in ('DRAFT', 'APPROVED', 'SUPERSEDED')`,
    ),
    check(
      "invoice_policies_eligibility_valid",
      sql`${table.draftEligibility} in ('BOOKING_ACCEPTED', 'JOB_COMPLETED') and ${table.issueEligibility} in ('BOOKING_ACCEPTED', 'JOB_COMPLETED')`,
    ),
    check(
      "invoice_policies_eligibility_order_valid",
      sql`${table.draftEligibility} <> 'JOB_COMPLETED' or ${table.issueEligibility} = 'JOB_COMPLETED'`,
    ),
    check(
      "invoice_policies_payment_terms_valid",
      sql`${table.paymentTerms} in ('PAY_ON_COMPLETION', 'PAY_ON_INVOICE', 'PREPAYMENT', 'CUSTOM')`,
    ),
    check(
      "invoice_policies_due_days_consistent",
      sql`(${table.paymentTerms} = 'CUSTOM' and ${table.defaultDueDays} is null) or (${table.paymentTerms} <> 'CUSTOM' and ${table.defaultDueDays} is not null and ${table.defaultDueDays} between 0 and 365)`,
    ),
    check("invoice_policies_currency_eur", sql`${table.currency} = 'EUR'`),
    check("invoice_policies_version_positive", sql`${table.version} >= 1`),
    check(
      "invoice_policies_production_approved_not_provisional",
      sql`${table.environmentScope} <> 'PRODUCTION' or ${table.status} <> 'APPROVED' or (${table.provisional} = false and ${table.sellerLegalProfileId} is not null)`,
    ),
    check(
      "invoice_policies_lifecycle_consistent",
      sql`(${table.status} = 'DRAFT' and ${table.approvedAt} is null and ${table.supersededAt} is null) or (${table.status} = 'APPROVED' and ${table.approvedAt} is not null and ${table.supersededAt} is null) or (${table.status} = 'SUPERSEDED' and ${table.approvedAt} is not null and ${table.supersededAt} is not null and ${table.supersededAt} >= ${table.approvedAt})`,
    ),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceReference: varchar("invoice_reference", { length: 40 }).notNull(),
    invoiceNumber: varchar("invoice_number", { length: 96 }),
    invoicePolicyId: integer("invoice_policy_id").notNull(),
    invoicePolicyCode: varchar("invoice_policy_code", { length: 96 }).notNull(),
    invoicePolicyVersion: integer("invoice_policy_version").notNull(),
    environmentScope: varchar("environment_scope", { length: 16 }).notNull(),
    numberingPolicyId: integer("numbering_policy_id"),
    numberingPolicyCode: varchar("numbering_policy_code", { length: 96 }),
    numberingPolicyVersion: integer("numbering_policy_version"),
    numberingSequence: integer("numbering_sequence"),
    requestId: uuid("request_id").notNull(),
    quoteId: uuid("quote_id").notNull(),
    quoteAcceptanceId: uuid("quote_acceptance_id").notNull(),
    bookingId: uuid("booking_id").notNull(),
    jobId: uuid("job_id"),
    customerId: uuid("customer_id").notNull(),
    propertyId: uuid("property_id").notNull(),
    customerBillingProfileId: uuid("customer_billing_profile_id"),
    customerBillingProfileVersion: integer("customer_billing_profile_version"),
    sellerLegalProfileId: uuid("seller_legal_profile_id"),
    sellerLegalProfileVersion: integer("seller_legal_profile_version"),
    type: varchar("type", { length: 24 }).default("STANDARD").notNull(),
    status: varchar("status", { length: 24 }).default("DRAFT").notNull(),
    financeReviewStatus: varchar("finance_review_status", { length: 16 })
      .default("REQUIRED")
      .notNull(),
    financeReviewReasonCodes: jsonb("finance_review_reason_codes")
      .$type<readonly string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    issueDate: date("issue_date"),
    dueDate: date("due_date"),
    currency: varchar("currency", { length: 3 }).notNull(),
    priceBasis: varchar("price_basis", { length: 8 }).notNull(),
    vatMode: varchar("vat_mode", { length: 24 }).notNull(),
    vatBasis: varchar("vat_basis", { length: 24 }).notNull(),
    netAmountMinorUnits: integer("net_amount_minor_units").notNull(),
    vatRateBasisPoints: integer("vat_rate_basis_points").notNull(),
    vatAmountMinorUnits: integer("vat_amount_minor_units").notNull(),
    grossTotalMinorUnits: integer("gross_total_minor_units").notNull(),
    paidAmountMinorUnits: integer("paid_amount_minor_units")
      .default(0)
      .notNull(),
    outstandingAmountMinorUnits: integer(
      "outstanding_amount_minor_units",
    ).generatedAlwaysAs(
      sql`"gross_total_minor_units" - "paid_amount_minor_units"`,
    ),
    customerSnapshot: jsonb("customer_snapshot").$type<JsonObject>().notNull(),
    sellerSnapshot: jsonb("seller_snapshot").$type<JsonObject>().notNull(),
    commercialSnapshot: jsonb("commercial_snapshot")
      .$type<JsonObject>()
      .notNull(),
    termsSnapshot: jsonb("terms_snapshot").$type<JsonObject>().notNull(),
    provenanceSnapshot: jsonb("provenance_snapshot")
      .$type<JsonObject>()
      .notNull(),
    eligibilitySnapshot: jsonb("eligibility_snapshot")
      .$type<JsonObject>()
      .notNull(),
    internalNotes: text("internal_notes"),
    customerVisibleNotes: text("customer_visible_notes"),
    creationIdempotencyKey: uuid("creation_idempotency_key").notNull(),
    creationFingerprint: varchar("creation_fingerprint", { length: 64 }).notNull(),
    issueIdempotencyKey: uuid("issue_idempotency_key"),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    createdByProfileId: uuid("created_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    issuedByProfileId: uuid("issued_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByProfileId: uuid("cancelled_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [
    foreignKey({
      name: "invoices_acceptance_provenance_fk",
      columns: [
        table.quoteAcceptanceId,
        table.quoteId,
        table.requestId,
        table.customerId,
        table.propertyId,
      ],
      foreignColumns: [
        quoteAcceptances.id,
        quoteAcceptances.quoteId,
        quoteAcceptances.requestId,
        quoteAcceptances.customerId,
        quoteAcceptances.propertyId,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "invoices_booking_commercial_provenance_fk",
      columns: [
        table.bookingId,
        table.requestId,
        table.quoteId,
        table.quoteAcceptanceId,
        table.customerId,
        table.propertyId,
      ],
      foreignColumns: [
        bookings.id,
        bookings.requestId,
        bookings.quoteId,
        bookings.quoteAcceptanceId,
        bookings.customerId,
        bookings.propertyId,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "invoices_job_booking_property_fk",
      columns: [table.jobId, table.bookingId, table.propertyId],
      foreignColumns: [jobs.id, jobs.bookingId, jobs.propertyId],
    }).onDelete("restrict"),
    foreignKey({
      name: "invoices_customer_billing_profile_fk",
      columns: [
        table.customerBillingProfileId,
        table.customerId,
        table.customerBillingProfileVersion,
      ],
      foreignColumns: [
        customerBillingProfiles.id,
        customerBillingProfiles.customerId,
        customerBillingProfiles.version,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "invoices_seller_legal_profile_fk",
      columns: [
        table.sellerLegalProfileId,
        table.sellerLegalProfileVersion,
        table.environmentScope,
      ],
      foreignColumns: [
        businessLegalProfiles.id,
        businessLegalProfiles.version,
        businessLegalProfiles.environmentScope,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "invoices_policy_provenance_fk",
      columns: [
        table.invoicePolicyId,
        table.invoicePolicyCode,
        table.invoicePolicyVersion,
        table.environmentScope,
      ],
      foreignColumns: [
        invoicePolicies.id,
        invoicePolicies.code,
        invoicePolicies.version,
        invoicePolicies.environmentScope,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "invoices_numbering_policy_provenance_fk",
      columns: [
        table.numberingPolicyId,
        table.numberingPolicyCode,
        table.numberingPolicyVersion,
        table.environmentScope,
      ],
      foreignColumns: [
        invoiceNumberingPolicies.id,
        invoiceNumberingPolicies.code,
        invoiceNumberingPolicies.version,
        invoiceNumberingPolicies.environmentScope,
      ],
    }).onDelete("restrict"),
    uniqueIndex("invoices_reference_unique").on(table.invoiceReference),
    uniqueIndex("invoices_number_unique")
      .on(table.invoiceNumber)
      .where(sql`${table.invoiceNumber} is not null`),
    uniqueIndex("invoices_numbering_sequence_unique")
      .on(table.numberingPolicyId, table.numberingSequence)
      .where(sql`${table.numberingPolicyId} is not null`),
    uniqueIndex("invoices_creation_idempotency_unique").on(
      table.creationIdempotencyKey,
    ),
    uniqueIndex("invoices_issue_idempotency_unique")
      .on(table.issueIdempotencyKey)
      .where(sql`${table.issueIdempotencyKey} is not null`),
    uniqueIndex("invoices_live_standard_booking_unique")
      .on(table.bookingId)
      .where(sql`${table.type} = 'STANDARD' and ${table.status} <> 'CANCELLED'`),
    uniqueIndex("invoices_id_customer_currency_unique").on(
      table.id,
      table.customerId,
      table.currency,
    ),
    uniqueIndex("invoices_id_customer_unique").on(table.id, table.customerId),
    uniqueIndex("invoices_id_booking_quote_unique").on(
      table.id,
      table.bookingId,
      table.quoteId,
    ),
    index("invoices_staff_status_due_idx").on(
      table.status,
      table.dueDate,
      table.createdAt,
    ),
    index("invoices_customer_status_created_idx").on(
      table.customerId,
      table.status,
      table.createdAt,
    ),
    check(
      "invoices_reference_valid",
      sql`${table.invoiceReference} ~ '^INV-[A-F0-9]{24}$'`,
    ),
    check(
      "invoices_environment_valid",
      sql`${table.environmentScope} in ('DEVELOPMENT', 'STAGING', 'PRODUCTION')`,
    ),
    check(
      "invoices_fingerprint_valid",
      sql`${table.creationFingerprint} ~ '^[A-Fa-f0-9]{64}$'`,
    ),
    check(
      "invoices_type_valid",
      sql`${table.type} in ('STANDARD', 'PROFORMA', 'CREDIT_NOTE')`,
    ),
    check(
      "invoices_status_valid",
      sql`${table.status} in ('DRAFT', 'READY_TO_ISSUE', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'CREDITED_FUTURE')`,
    ),
    check(
      "invoices_review_status_valid",
      sql`${table.financeReviewStatus} in ('CLEAR', 'REQUIRED')`,
    ),
    check(
      "invoices_review_reasons_consistent",
      sql`jsonb_typeof(${table.financeReviewReasonCodes}) = 'array' and ((${table.financeReviewStatus} = 'CLEAR' and jsonb_array_length(${table.financeReviewReasonCodes}) = 0) or (${table.financeReviewStatus} = 'REQUIRED' and jsonb_array_length(${table.financeReviewReasonCodes}) > 0))`,
    ),
    check("invoices_currency_eur", sql`${table.currency} = 'EUR'`),
    check(
      "invoices_price_basis_valid",
      sql`${table.priceBasis} in ('NET', 'GROSS')`,
    ),
    check(
      "invoices_vat_mode_valid",
      sql`${table.vatMode} in ('VAT_REGISTERED', 'VAT_NOT_REGISTERED')`,
    ),
    check(
      "invoices_vat_basis_valid",
      sql`${table.vatBasis} in ('NET', 'GROSS', 'NOT_REGISTERED')`,
    ),
    check(
      "invoices_amounts_consistent",
      sql`${table.netAmountMinorUnits} >= 0 and ${table.vatAmountMinorUnits} >= 0 and ${table.grossTotalMinorUnits} = ${table.netAmountMinorUnits} + ${table.vatAmountMinorUnits} and ${table.paidAmountMinorUnits} between 0 and ${table.grossTotalMinorUnits}`,
    ),
    check(
      "invoices_vat_rate_valid",
      sql`${table.vatRateBasisPoints} between 0 and 10000`,
    ),
    check(
      "invoices_vat_configuration_consistent",
      sql`(${table.vatMode} = 'VAT_NOT_REGISTERED' and ${table.vatBasis} = 'NOT_REGISTERED' and ${table.vatRateBasisPoints} = 0 and ${table.vatAmountMinorUnits} = 0 and ${table.netAmountMinorUnits} = ${table.grossTotalMinorUnits}) or (${table.vatMode} = 'VAT_REGISTERED' and ${table.vatBasis} = ${table.priceBasis})`,
    ),
    check(
      "invoices_profile_references_consistent",
      sql`(${table.customerBillingProfileId} is null and ${table.customerBillingProfileVersion} is null) or (${table.customerBillingProfileId} is not null and ${table.customerBillingProfileVersion} is not null and ${table.customerBillingProfileVersion} >= 1)`,
    ),
    check(
      "invoices_seller_references_consistent",
      sql`(${table.sellerLegalProfileId} is null and ${table.sellerLegalProfileVersion} is null) or (${table.sellerLegalProfileId} is not null and ${table.sellerLegalProfileVersion} is not null and ${table.sellerLegalProfileVersion} >= 1)`,
    ),
    check(
      "invoices_numbering_fields_consistent",
      sql`(${table.invoiceNumber} is null and ${table.numberingPolicyId} is null and ${table.numberingPolicyCode} is null and ${table.numberingPolicyVersion} is null and ${table.numberingSequence} is null) or (${table.invoiceNumber} is not null and ${table.numberingPolicyId} is not null and ${table.numberingPolicyCode} is not null and ${table.numberingPolicyVersion} is not null and ${table.numberingPolicyVersion} >= 1 and ${table.numberingSequence} is not null and ${table.numberingSequence} >= 1)`,
    ),
    check(
      "invoices_lifecycle_consistent",
      sql`(${table.status} in ('DRAFT', 'READY_TO_ISSUE') and ${table.invoiceNumber} is null and ${table.issueDate} is null and ${table.dueDate} is null and ${table.issuedAt} is null and ${table.issuedByProfileId} is null and ${table.cancelledAt} is null and ${table.cancelledByProfileId} is null) or (${table.status} = 'CANCELLED' and ${table.invoiceNumber} is null and ${table.issueDate} is null and ${table.dueDate} is null and ${table.issuedAt} is null and ${table.issuedByProfileId} is null and ${table.cancelledAt} is not null) or (${table.status} in ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'CREDITED_FUTURE') and ${table.invoiceNumber} is not null and ${table.issueDate} is not null and ${table.dueDate} is not null and ${table.issuedAt} is not null and ${table.cancelledAt} is null and ${table.cancelledByProfileId} is null)`,
    ),
    check(
      "invoices_issue_dates_consistent",
      sql`${table.issueDate} is null or (${table.dueDate} is not null and ${table.dueDate} >= ${table.issueDate})`,
    ),
    check(
      "invoices_ready_to_issue_complete",
      sql`${table.status} not in ('READY_TO_ISSUE', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CREDITED_FUTURE') or (${table.financeReviewStatus} = 'CLEAR' and ${table.customerBillingProfileId} is not null and ${table.sellerLegalProfileId} is not null)`,
    ),
    check(
      "invoices_settlement_status_consistent",
      sql`(${table.status} in ('DRAFT', 'READY_TO_ISSUE', 'ISSUED', 'CANCELLED') and ${table.paidAmountMinorUnits} = 0) or (${table.status} = 'PARTIALLY_PAID' and ${table.paidAmountMinorUnits} > 0 and ${table.paidAmountMinorUnits} < ${table.grossTotalMinorUnits}) or (${table.status} = 'PAID' and ${table.grossTotalMinorUnits} > 0 and ${table.paidAmountMinorUnits} = ${table.grossTotalMinorUnits}) or ${table.status} = 'CREDITED_FUTURE'`,
    ),
    check(
      "invoices_version_positive",
      sql`${table.version} >= 1 and ${table.invoicePolicyVersion} >= 1`,
    ),
    check(
      "invoices_optional_notes_not_blank",
      sql`(${table.internalNotes} is null or length(trim(${table.internalNotes})) > 0) and (${table.customerVisibleNotes} is null or length(trim(${table.customerVisibleNotes})) > 0)`,
    ),
  ],
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id").notNull(),
    bookingId: uuid("booking_id").notNull(),
    quoteId: uuid("quote_id").notNull(),
    quoteItemId: uuid("quote_item_id")
      .notNull()
      .references(() => quoteItems.id, { onDelete: "restrict" }),
    bookingItemId: uuid("booking_item_id").notNull(),
    jobId: uuid("job_id"),
    jobItemId: uuid("job_item_id"),
    serviceId: integer("service_id").references(() => services.id, {
      onDelete: "restrict",
    }),
    descriptionBg: text("description_bg").notNull(),
    descriptionEn: text("description_en").notNull(),
    quantity: integer("quantity").notNull(),
    measurementSnapshot: jsonb("measurement_snapshot")
      .$type<JsonObject>()
      .notNull(),
    netAmountMinorUnits: integer("net_amount_minor_units").notNull(),
    vatRateBasisPoints: integer("vat_rate_basis_points").notNull(),
    vatAmountMinorUnits: integer("vat_amount_minor_units").notNull(),
    grossTotalMinorUnits: integer("gross_total_minor_units").notNull(),
    provenanceSnapshot: jsonb("provenance_snapshot")
      .$type<JsonObject>()
      .notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "invoice_items_invoice_scope_fk",
      columns: [table.invoiceId, table.bookingId, table.quoteId],
      foreignColumns: [invoices.id, invoices.bookingId, invoices.quoteId],
    }).onDelete("restrict"),
    foreignKey({
      name: "invoice_items_booking_item_scope_fk",
      columns: [table.bookingItemId, table.bookingId, table.quoteItemId],
      foreignColumns: [
        bookingItems.id,
        bookingItems.bookingId,
        bookingItems.quoteItemId,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "invoice_items_quote_item_scope_fk",
      columns: [table.quoteItemId, table.quoteId],
      foreignColumns: [quoteItems.id, quoteItems.quoteId],
    }).onDelete("restrict"),
    foreignKey({
      name: "invoice_items_job_item_scope_fk",
      columns: [table.jobItemId, table.jobId, table.bookingItemId],
      foreignColumns: [jobItems.id, jobItems.jobId, jobItems.bookingItemId],
    }).onDelete("restrict"),
    uniqueIndex("invoice_items_invoice_sort_unique").on(
      table.invoiceId,
      table.sortOrder,
    ),
    uniqueIndex("invoice_items_invoice_booking_item_unique").on(
      table.invoiceId,
      table.bookingItemId,
    ),
    index("invoice_items_invoice_idx").on(table.invoiceId),
    check(
      "invoice_items_job_scope_consistent",
      sql`(${table.jobId} is null and ${table.jobItemId} is null) or (${table.jobId} is not null and ${table.jobItemId} is not null)`,
    ),
    check(
      "invoice_items_descriptions_not_blank",
      sql`length(trim(${table.descriptionBg})) > 0 and length(trim(${table.descriptionEn})) > 0`,
    ),
    check("invoice_items_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "invoice_items_amounts_consistent",
      sql`${table.netAmountMinorUnits} >= 0 and ${table.vatAmountMinorUnits} >= 0 and ${table.grossTotalMinorUnits} = ${table.netAmountMinorUnits} + ${table.vatAmountMinorUnits}`,
    ),
    check(
      "invoice_items_vat_rate_valid",
      sql`${table.vatRateBasisPoints} between 0 and 10000`,
    ),
    check("invoice_items_sort_nonnegative", sql`${table.sortOrder} >= 0`),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentReference: varchar("payment_reference", { length: 40 }).notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 16 }).default("RECORDED").notNull(),
    method: varchar("method", { length: 32 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    amountMinorUnits: integer("amount_minor_units").notNull(),
    allocatedAmountMinorUnits: integer("allocated_amount_minor_units")
      .default(0)
      .notNull(),
    unallocatedAmountMinorUnits: integer(
      "unallocated_amount_minor_units",
    ).generatedAlwaysAs(
      sql`"amount_minor_units" - "allocated_amount_minor_units"`,
    ),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    externalReference: varchar("external_reference", { length: 255 }),
    recordingIdempotencyKey: uuid("recording_idempotency_key").notNull(),
    recordingFingerprint: varchar("recording_fingerprint", { length: 64 })
      .notNull(),
    recordedByProfileId: uuid("recorded_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmedByProfileId: uuid("confirmed_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversedByProfileId: uuid("reversed_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    internalNotes: text("internal_notes"),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("payments_reference_unique").on(table.paymentReference),
    uniqueIndex("payments_recording_idempotency_unique").on(
      table.recordingIdempotencyKey,
    ),
    uniqueIndex("payments_id_customer_currency_unique").on(
      table.id,
      table.customerId,
      table.currency,
    ),
    uniqueIndex("payments_id_customer_unique").on(table.id, table.customerId),
    uniqueIndex("payments_reversal_provenance_unique").on(
      table.id,
      table.customerId,
      table.currency,
      table.amountMinorUnits,
    ),
    index("payments_customer_status_received_idx").on(
      table.customerId,
      table.status,
      table.receivedAt,
    ),
    check(
      "payments_reference_valid",
      sql`${table.paymentReference} ~ '^PAY-[A-F0-9]{24}$'`,
    ),
    check(
      "payments_fingerprint_valid",
      sql`${table.recordingFingerprint} ~ '^[A-Fa-f0-9]{64}$'`,
    ),
    check(
      "payments_status_valid",
      sql`${table.status} in ('RECORDED', 'CONFIRMED', 'REVERSED')`,
    ),
    check(
      "payments_method_valid",
      sql`${table.method} in ('BANK_TRANSFER', 'CASH', 'CARD_MANUAL_REFERENCE', 'OTHER')`,
    ),
    check("payments_currency_eur", sql`${table.currency} = 'EUR'`),
    check(
      "payments_amounts_consistent",
      sql`${table.amountMinorUnits} > 0 and ${table.allocatedAmountMinorUnits} between 0 and ${table.amountMinorUnits}`,
    ),
    check(
      "payments_lifecycle_consistent",
      sql`(${table.status} = 'RECORDED' and ${table.confirmedAt} is null and ${table.confirmedByProfileId} is null and ${table.reversedAt} is null and ${table.reversedByProfileId} is null) or (${table.status} = 'CONFIRMED' and ${table.confirmedAt} is not null and ${table.reversedAt} is null and ${table.reversedByProfileId} is null) or (${table.status} = 'REVERSED' and ${table.reversedAt} is not null)`,
    ),
    check(
      "payments_timestamps_ordered",
      sql`(${table.confirmedAt} is null or ${table.confirmedAt} >= ${table.receivedAt}) and (${table.reversedAt} is null or ${table.reversedAt} >= ${table.receivedAt})`,
    ),
    check("payments_version_positive", sql`${table.version} >= 1`),
    check(
      "payments_optional_text_not_blank",
      sql`(${table.externalReference} is null or length(trim(${table.externalReference})) > 0) and (${table.internalNotes} is null or length(trim(${table.internalNotes})) > 0)`,
    ),
  ],
);

export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    allocationReference: varchar("allocation_reference", { length: 40 })
      .notNull(),
    entryType: varchar("entry_type", { length: 16 })
      .default("ALLOCATION")
      .notNull(),
    paymentId: uuid("payment_id").notNull(),
    invoiceId: uuid("invoice_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    amountMinorUnits: integer("amount_minor_units").notNull(),
    reversesAllocationId: uuid("reverses_allocation_id"),
    reversedEntryType: varchar("reversed_entry_type", { length: 16 }),
    idempotencyKey: uuid("idempotency_key").notNull(),
    idempotencyFingerprint: varchar("idempotency_fingerprint", {
      length: 64,
    }).notNull(),
    allocatedByProfileId: uuid("allocated_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "payment_allocations_payment_scope_fk",
      columns: [table.paymentId, table.customerId, table.currency],
      foreignColumns: [payments.id, payments.customerId, payments.currency],
    }).onDelete("restrict"),
    foreignKey({
      name: "payment_allocations_invoice_scope_fk",
      columns: [table.invoiceId, table.customerId, table.currency],
      foreignColumns: [invoices.id, invoices.customerId, invoices.currency],
    }).onDelete("restrict"),
    foreignKey({
      name: "payment_allocations_reversal_scope_fk",
      columns: [
        table.reversesAllocationId,
        table.paymentId,
        table.invoiceId,
        table.customerId,
        table.currency,
        table.amountMinorUnits,
        table.reversedEntryType,
      ],
      foreignColumns: [
        table.id,
        table.paymentId,
        table.invoiceId,
        table.customerId,
        table.currency,
        table.amountMinorUnits,
        table.entryType,
      ],
    }).onDelete("restrict"),
    uniqueIndex("payment_allocations_reference_unique").on(
      table.allocationReference,
    ),
    uniqueIndex("payment_allocations_idempotency_unique").on(
      table.idempotencyKey,
    ),
    uniqueIndex("payment_allocations_reversal_once_unique")
      .on(table.reversesAllocationId)
      .where(sql`${table.reversesAllocationId} is not null`),
    uniqueIndex("payment_allocations_reversal_provenance_unique").on(
      table.id,
      table.paymentId,
      table.invoiceId,
      table.customerId,
      table.currency,
      table.amountMinorUnits,
      table.entryType,
    ),
    index("payment_allocations_payment_created_idx").on(
      table.paymentId,
      table.createdAt,
    ),
    index("payment_allocations_invoice_created_idx").on(
      table.invoiceId,
      table.createdAt,
    ),
    check(
      "payment_allocations_reference_valid",
      sql`${table.allocationReference} ~ '^PAL-[A-F0-9]{24}$'`,
    ),
    check(
      "payment_allocations_fingerprint_valid",
      sql`${table.idempotencyFingerprint} ~ '^[A-Fa-f0-9]{64}$'`,
    ),
    check(
      "payment_allocations_entry_type_valid",
      sql`${table.entryType} in ('ALLOCATION', 'REVERSAL')`,
    ),
    check("payment_allocations_currency_eur", sql`${table.currency} = 'EUR'`),
    check(
      "payment_allocations_amount_positive",
      sql`${table.amountMinorUnits} > 0`,
    ),
    check(
      "payment_allocations_reversal_consistent",
      sql`(${table.entryType} = 'ALLOCATION' and ${table.reversesAllocationId} is null and ${table.reversedEntryType} is null) or (${table.entryType} = 'REVERSAL' and ${table.reversesAllocationId} is not null and ${table.reversedEntryType} = 'ALLOCATION')`,
    ),
  ],
);

export const paymentReversals = pgTable(
  "payment_reversals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reversalReference: varchar("reversal_reference", { length: 40 }).notNull(),
    paymentId: uuid("payment_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    amountMinorUnits: integer("amount_minor_units").notNull(),
    reasonCategory: varchar("reason_category", { length: 32 }).notNull(),
    reasonText: text("reason_text"),
    idempotencyKey: uuid("idempotency_key").notNull(),
    idempotencyFingerprint: varchar("idempotency_fingerprint", {
      length: 64,
    }).notNull(),
    reversedAt: timestamp("reversed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    reversedByProfileId: uuid("reversed_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [
    foreignKey({
      name: "payment_reversals_payment_provenance_fk",
      columns: [
        table.paymentId,
        table.customerId,
        table.currency,
        table.amountMinorUnits,
      ],
      foreignColumns: [
        payments.id,
        payments.customerId,
        payments.currency,
        payments.amountMinorUnits,
      ],
    }).onDelete("restrict"),
    uniqueIndex("payment_reversals_reference_unique").on(
      table.reversalReference,
    ),
    uniqueIndex("payment_reversals_payment_unique").on(table.paymentId),
    uniqueIndex("payment_reversals_idempotency_unique").on(table.idempotencyKey),
    check(
      "payment_reversals_reference_valid",
      sql`${table.reversalReference} ~ '^PRV-[A-F0-9]{24}$'`,
    ),
    check(
      "payment_reversals_fingerprint_valid",
      sql`${table.idempotencyFingerprint} ~ '^[A-Fa-f0-9]{64}$'`,
    ),
    check(
      "payment_reversals_reason_category_valid",
      sql`${table.reasonCategory} in ('DUPLICATE', 'ENTRY_ERROR', 'BANK_RETURN', 'OTHER')`,
    ),
    check("payment_reversals_currency_eur", sql`${table.currency} = 'EUR'`),
    check("payment_reversals_amount_positive", sql`${table.amountMinorUnits} > 0`),
    check(
      "payment_reversals_reason_text_consistent",
      sql`(${table.reasonText} is null or length(trim(${table.reasonText})) > 0) and (${table.reasonCategory} <> 'OTHER' or ${table.reasonText} is not null)`,
    ),
  ],
);

export const financeAuditEvents = pgTable(
  "finance_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id").references(() => invoices.id, {
      onDelete: "restrict",
    }),
    paymentId: uuid("payment_id").references(() => payments.id, {
      onDelete: "restrict",
    }),
    paymentAllocationId: uuid("payment_allocation_id").references(
      () => paymentAllocations.id,
      { onDelete: "restrict" },
    ),
    paymentReversalId: uuid("payment_reversal_id").references(
      () => paymentReversals.id,
      { onDelete: "restrict" },
    ),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    actorProfileId: uuid("actor_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    source: varchar("source", { length: 16 }).notNull(),
    previousStatus: varchar("previous_status", { length: 32 }),
    nextStatus: varchar("next_status", { length: 32 }),
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
    uniqueIndex("finance_audit_events_correlation_unique").on(
      table.correlationId,
    ),
    uniqueIndex("finance_audit_events_invoice_lifecycle_version_unique")
      .on(
        table.invoiceId,
        sql`(${table.safeMetadata} ->> 'invoiceVersion')`,
      )
      .where(
        sql`${table.invoiceId} is not null and ${table.eventType} in ('INVOICE_DRAFT_CREATED', 'INVOICE_READY', 'INVOICE_ISSUED', 'INVOICE_CANCELLED', 'FINANCE_REVIEW_REQUIRED')`,
      ),
    uniqueIndex("finance_audit_events_payment_lifecycle_version_unique")
      .on(
        table.paymentId,
        sql`(${table.safeMetadata} ->> 'paymentVersion')`,
      )
      .where(
        sql`${table.paymentId} is not null and ${table.eventType} in ('PAYMENT_RECORDED', 'PAYMENT_CONFIRMED', 'PAYMENT_REVERSED')`,
      ),
    uniqueIndex("finance_audit_events_allocation_event_unique")
      .on(table.paymentAllocationId, table.eventType)
      .where(sql`${table.paymentAllocationId} is not null`),
    uniqueIndex("finance_audit_events_allocation_invoice_settlement_unique")
      .on(table.paymentAllocationId)
      .where(
        sql`${table.paymentAllocationId} is not null and ${table.eventType} in ('INVOICE_PARTIALLY_PAID', 'INVOICE_PAID')`,
      ),
    index("finance_audit_events_invoice_timeline_idx")
      .on(table.invoiceId, table.createdAt)
      .where(sql`${table.invoiceId} is not null`),
    index("finance_audit_events_payment_timeline_idx")
      .on(table.paymentId, table.createdAt)
      .where(sql`${table.paymentId} is not null`),
    index("finance_audit_events_type_created_idx").on(
      table.eventType,
      table.createdAt,
    ),
    check(
      "finance_audit_events_scope_present",
      sql`${table.invoiceId} is not null or ${table.paymentId} is not null or ${table.paymentAllocationId} is not null or ${table.paymentReversalId} is not null`,
    ),
    check(
      "finance_audit_events_type_valid",
      sql`${table.eventType} in ('INVOICE_DRAFT_CREATED', 'INVOICE_READY', 'INVOICE_ISSUED', 'INVOICE_PARTIALLY_PAID', 'INVOICE_PAID', 'INVOICE_CANCELLED', 'PAYMENT_RECORDED', 'PAYMENT_CONFIRMED', 'PAYMENT_ALLOCATED', 'PAYMENT_ALLOCATION_REVERSED', 'PAYMENT_REVERSED', 'FINANCE_REVIEW_REQUIRED')`,
    ),
    check(
      "finance_audit_events_source_valid",
      sql`${table.source} in ('STAFF', 'SYSTEM')`,
    ),
    check(
      "finance_audit_events_status_not_blank",
      sql`(${table.previousStatus} is null or length(trim(${table.previousStatus})) > 0) and (${table.nextStatus} is null or length(trim(${table.nextStatus})) > 0)`,
    ),
  ],
);
