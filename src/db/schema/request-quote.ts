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
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { durationModels, priceBooks } from "./commercial-engine";
import { cleaningAssets, customers, properties } from "./customer-crm";
import { userProfiles } from "./identity-access";
import {
  cleaningItemTypes,
  conditionLevels,
  fibreMaterials,
  issueTypes,
  measurementModes,
  serviceAddons,
  services,
  surfaceConstructions,
} from "./service-catalogue";

type JsonObject = Record<string, unknown>;

function managedRecordColumns() {
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

export const serviceRequests = pgTable(
  "service_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestReference: varchar("request_reference", { length: 40 })
      .notNull()
      .unique(),
    source: varchar("source", { length: 32 }).notNull(),
    customerResolutionStatus: varchar("customer_resolution_status", {
      length: 32,
    })
      .default("UNRESOLVED")
      .notNull(),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "restrict",
    }),
    requestingProfileId: uuid("requesting_profile_id").references(
      () => userProfiles.id,
      { onDelete: "restrict" },
    ),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "restrict",
    }),
    status: varchar("status", { length: 24 }).default("SUBMITTED").notNull(),
    preferredLocale: varchar("preferred_locale", { length: 8 })
      .default("bg")
      .notNull(),
    contactName: varchar("contact_name", { length: 160 }).notNull(),
    contactEmail: varchar("contact_email", { length: 320 }),
    contactPhone: varchar("contact_phone", { length: 40 }),
    customerNotes: text("customer_notes"),
    staffNotes: text("staff_notes"),
    preferredDate: date("preferred_date"),
    preferredWindowCode: varchar("preferred_window_code", { length: 64 }),
    originalSubmission: jsonb("original_submission")
      .$type<JsonObject>()
      .notNull(),
    manualReviewRequired: boolean("manual_review_required")
      .default(true)
      .notNull(),
    version: integer("version").default(1).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    ...managedRecordColumns(),
  },
  (table) => [
    index("service_requests_staff_inbox_idx").on(
      table.status,
      table.manualReviewRequired,
      table.submittedAt,
    ),
    index("service_requests_source_resolution_idx").on(
      table.source,
      table.customerResolutionStatus,
      table.submittedAt,
    ),
    index("service_requests_customer_status_idx")
      .on(table.customerId, table.status, table.submittedAt)
      .where(sql`${table.customerId} is not null`),
    index("service_requests_requesting_profile_idx")
      .on(table.requestingProfileId, table.submittedAt)
      .where(sql`${table.requestingProfileId} is not null`),
    check(
      "service_requests_reference_valid",
      sql`${table.requestReference} ~ '^REQ-[A-F0-9]{24}$'`,
    ),
    check(
      "service_requests_source_valid",
      sql`${table.source} in ('PUBLIC_WEB', 'CUSTOMER_PORTAL', 'STAFF_CREATED')`,
    ),
    check(
      "service_requests_resolution_valid",
      sql`${table.customerResolutionStatus} in ('UNRESOLVED', 'MATCH_CANDIDATE', 'LINKED', 'NEW_CUSTOMER_REQUIRED')`,
    ),
    check(
      "service_requests_linked_resolution_consistent",
      sql`(${table.customerResolutionStatus} = 'LINKED' and ${table.customerId} is not null) or (${table.customerResolutionStatus} <> 'LINKED' and ${table.customerId} is null)`,
    ),
    check(
      "service_requests_status_valid",
      sql`${table.status} in ('SUBMITTED', 'IN_REVIEW', 'NEEDS_REVIEW', 'READY_TO_QUOTE', 'QUOTED', 'CLOSED', 'DECLINED')`,
    ),
    check(
      "service_requests_locale_valid",
      sql`${table.preferredLocale} in ('bg', 'en')`,
    ),
    check(
      "service_requests_contact_name_not_blank",
      sql`length(trim(${table.contactName})) > 0`,
    ),
    check(
      "service_requests_contact_channel_present",
      sql`${table.contactEmail} is not null or ${table.contactPhone} is not null`,
    ),
    check(
      "service_requests_contact_email_not_blank",
      sql`${table.contactEmail} is null or length(trim(${table.contactEmail})) > 0`,
    ),
    check(
      "service_requests_contact_phone_not_blank",
      sql`${table.contactPhone} is null or length(trim(${table.contactPhone})) > 0`,
    ),
    check(
      "service_requests_customer_notes_not_blank",
      sql`${table.customerNotes} is null or length(trim(${table.customerNotes})) > 0`,
    ),
    check(
      "service_requests_staff_notes_not_blank",
      sql`${table.staffNotes} is null or length(trim(${table.staffNotes})) > 0`,
    ),
    check(
      "service_requests_preferred_window_not_blank",
      sql`${table.preferredWindowCode} is null or length(trim(${table.preferredWindowCode})) > 0`,
    ),
    check(
      "service_requests_source_identity_consistent",
      sql`(${table.source} = 'CUSTOMER_PORTAL' and ${table.requestingProfileId} is not null) or (${table.source} <> 'CUSTOMER_PORTAL' and ${table.requestingProfileId} is null)`,
    ),
    check(
      "service_requests_source_customer_consistent",
      sql`${table.source} = 'PUBLIC_WEB' or ${table.customerId} is not null`,
    ),
    check(
      "service_requests_property_requires_customer",
      sql`${table.propertyId} is null or ${table.customerId} is not null`,
    ),
    check("service_requests_version_positive", sql`${table.version} >= 1`),
    check(
      "service_requests_closed_at_consistent",
      sql`(${table.status} = 'CLOSED' and ${table.closedAt} is not null) or (${table.status} <> 'CLOSED' and ${table.closedAt} is null)`,
    ),
    check(
      "service_requests_closed_after_submission",
      sql`${table.closedAt} is null or ${table.closedAt} >= ${table.submittedAt}`,
    ),
  ],
);

export const serviceRequestItems = pgTable(
  "service_request_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "restrict" }),
    serviceId: integer("service_id").references(() => services.id, {
      onDelete: "restrict",
    }),
    cleaningItemTypeId: integer("cleaning_item_type_id").references(
      () => cleaningItemTypes.id,
      { onDelete: "restrict" },
    ),
    cleaningAssetId: uuid("cleaning_asset_id").references(
      () => cleaningAssets.id,
      { onDelete: "restrict" },
    ),
    measurementModeId: integer("measurement_mode_id").references(
      () => measurementModes.id,
      { onDelete: "restrict" },
    ),
    customerReportedConditionLevelId: integer(
      "customer_reported_condition_level_id",
    ).references(() => conditionLevels.id, { onDelete: "restrict" }),
    normalizedConditionLevelId: integer(
      "normalized_condition_level_id",
    ).references(() => conditionLevels.id, { onDelete: "restrict" }),
    reportedFibreMaterialId: integer("reported_fibre_material_id").references(
      () => fibreMaterials.id,
      { onDelete: "restrict" },
    ),
    normalizedFibreMaterialId: integer(
      "normalized_fibre_material_id",
    ).references(() => fibreMaterials.id, { onDelete: "restrict" }),
    reportedSurfaceConstructionId: integer(
      "reported_surface_construction_id",
    ).references(() => surfaceConstructions.id, { onDelete: "restrict" }),
    normalizedSurfaceConstructionId: integer(
      "normalized_surface_construction_id",
    ).references(() => surfaceConstructions.id, { onDelete: "restrict" }),
    customerDescription: text("customer_description").notNull(),
    normalizedDescription: text("normalized_description"),
    quantity: integer("quantity").default(1).notNull(),
    areaHundredthsM2: integer("area_hundredths_m2"),
    seatCount: integer("seat_count"),
    sides: integer("sides"),
    sortOrder: integer("sort_order").notNull(),
    version: integer("version").default(1).notNull(),
    ...managedRecordColumns(),
  },
  (table) => [
    uniqueIndex("service_request_items_request_sort_unique").on(
      table.requestId,
      table.sortOrder,
    ),
    index("service_request_items_request_idx").on(table.requestId),
    check(
      "service_request_items_customer_description_not_blank",
      sql`length(trim(${table.customerDescription})) > 0`,
    ),
    check(
      "service_request_items_normalized_description_not_blank",
      sql`${table.normalizedDescription} is null or length(trim(${table.normalizedDescription})) > 0`,
    ),
    check(
      "service_request_items_quantity_positive",
      sql`${table.quantity} > 0`,
    ),
    check(
      "service_request_items_measurements_positive",
      sql`(${table.areaHundredthsM2} is null or ${table.areaHundredthsM2} > 0) and (${table.seatCount} is null or ${table.seatCount} > 0)`,
    ),
    check(
      "service_request_items_sides_valid",
      sql`${table.sides} is null or ${table.sides} in (1, 2)`,
    ),
    check(
      "service_request_items_sort_nonnegative",
      sql`${table.sortOrder} >= 0`,
    ),
    check("service_request_items_version_positive", sql`${table.version} >= 1`),
  ],
);

export const serviceRequestItemIssues = pgTable(
  "service_request_item_issues",
  {
    requestItemId: uuid("request_item_id")
      .notNull()
      .references(() => serviceRequestItems.id, { onDelete: "restrict" }),
    issueTypeId: integer("issue_type_id")
      .notNull()
      .references(() => issueTypes.id, { onDelete: "restrict" }),
    customerReported: boolean("customer_reported").default(false).notNull(),
    staffConfirmed: boolean("staff_confirmed").default(false).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdByProfileId: uuid("created_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [
    primaryKey({ columns: [table.requestItemId, table.issueTypeId] }),
    check(
      "service_request_item_issues_provenance_present",
      sql`${table.customerReported} = true or ${table.staffConfirmed} = true`,
    ),
    check(
      "service_request_item_issues_notes_not_blank",
      sql`${table.notes} is null or length(trim(${table.notes})) > 0`,
    ),
  ],
);

export const serviceRequestItemAddons = pgTable(
  "service_request_item_addons",
  {
    requestItemId: uuid("request_item_id")
      .notNull()
      .references(() => serviceRequestItems.id, { onDelete: "restrict" }),
    addonId: integer("addon_id")
      .notNull()
      .references(() => serviceAddons.id, { onDelete: "restrict" }),
    customerRequested: boolean("customer_requested").default(false).notNull(),
    staffIncluded: boolean("staff_included").default(false).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdByProfileId: uuid("created_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [
    primaryKey({ columns: [table.requestItemId, table.addonId] }),
    check(
      "service_request_item_addons_provenance_present",
      sql`${table.customerRequested} = true or ${table.staffIncluded} = true`,
    ),
    check(
      "service_request_item_addons_notes_not_blank",
      sql`${table.notes} is null or length(trim(${table.notes})) > 0`,
    ),
  ],
);

export const requestEstimates = pgTable(
  "request_estimates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "restrict" }),
    sourceRequestVersion: integer("source_request_version").notNull(),
    estimateVersion: integer("estimate_version").notNull(),
    status: varchar("status", { length: 24 }).notNull(),
    priceBookId: integer("price_book_id")
      .notNull()
      .references(() => priceBooks.id, { onDelete: "restrict" }),
    priceBookCode: varchar("price_book_code", { length: 96 }).notNull(),
    priceBookVersion: integer("price_book_version").notNull(),
    durationModelId: integer("duration_model_id")
      .notNull()
      .references(() => durationModels.id, { onDelete: "restrict" }),
    durationModelCode: varchar("duration_model_code", { length: 96 }).notNull(),
    durationModelVersion: integer("duration_model_version").notNull(),
    inputSnapshot: jsonb("input_snapshot").$type<JsonObject>().notNull(),
    priceSnapshot: jsonb("price_snapshot").$type<JsonObject>().notNull(),
    durationSnapshot: jsonb("duration_snapshot").$type<JsonObject>().notNull(),
    availabilitySnapshot: jsonb("availability_snapshot")
      .$type<JsonObject>()
      .notNull(),
    netAmountMinorUnits: integer("net_amount_minor_units"),
    vatRateBasisPoints: integer("vat_rate_basis_points"),
    vatAmountMinorUnits: integer("vat_amount_minor_units"),
    grossTotalMinorUnits: integer("gross_total_minor_units"),
    currency: varchar("currency", { length: 3 }).notNull(),
    estimatedServiceMinutes: integer("estimated_service_minutes"),
    estimatedTravelMinutes: integer("estimated_travel_minutes"),
    manualAssessmentRequired: boolean("manual_assessment_required")
      .default(true)
      .notNull(),
    declineOrReferRequired: boolean("decline_or_refer_required")
      .default(false)
      .notNull(),
    warnings: jsonb("warnings")
      .$type<readonly string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    reviewReasonCodes: jsonb("review_reason_codes")
      .$type<readonly string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    calculatedByProfileId: uuid("calculated_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    calculatedAt: timestamp("calculated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("request_estimates_request_version_unique").on(
      table.requestId,
      table.estimateVersion,
    ),
    uniqueIndex("request_estimates_id_request_unique").on(
      table.id,
      table.requestId,
    ),
    index("request_estimates_request_calculated_idx").on(
      table.requestId,
      table.calculatedAt,
    ),
    check(
      "request_estimates_status_valid",
      sql`${table.status} in ('CALCULATED', 'REVIEW_REQUIRED', 'DECLINE_OR_REFER')`,
    ),
    check(
      "request_estimates_version_positive",
      sql`${table.estimateVersion} >= 1`,
    ),
    check(
      "request_estimates_source_request_version_positive",
      sql`${table.sourceRequestVersion} >= 1`,
    ),
    check(
      "request_estimates_model_versions_positive",
      sql`${table.priceBookVersion} >= 1 and ${table.durationModelVersion} >= 1`,
    ),
    check("request_estimates_currency_eur", sql`${table.currency} = 'EUR'`),
    check(
      "request_estimates_vat_rate_valid",
      sql`${table.vatRateBasisPoints} is null or ${table.vatRateBasisPoints} between 0 and 10000`,
    ),
    check(
      "request_estimates_amount_group_consistent",
      sql`(${table.netAmountMinorUnits} is null and ${table.vatAmountMinorUnits} is null and ${table.grossTotalMinorUnits} is null) or (${table.netAmountMinorUnits} is null and ${table.vatRateBasisPoints} is null and ${table.vatAmountMinorUnits} is null and ${table.grossTotalMinorUnits} is not null and ${table.grossTotalMinorUnits} >= 0 and ${table.manualAssessmentRequired} = true and ${table.status} = 'REVIEW_REQUIRED') or (${table.netAmountMinorUnits} is not null and ${table.netAmountMinorUnits} >= 0 and ${table.vatRateBasisPoints} is not null and ${table.vatAmountMinorUnits} is not null and ${table.vatAmountMinorUnits} >= 0 and ${table.grossTotalMinorUnits} is not null and ${table.grossTotalMinorUnits} = ${table.netAmountMinorUnits} + ${table.vatAmountMinorUnits})`,
    ),
    check(
      "request_estimates_minutes_nonnegative",
      sql`(${table.estimatedServiceMinutes} is null or ${table.estimatedServiceMinutes} >= 0) and (${table.estimatedTravelMinutes} is null or ${table.estimatedTravelMinutes} >= 0)`,
    ),
    check(
      "request_estimates_decline_requires_manual",
      sql`${table.declineOrReferRequired} = false or ${table.manualAssessmentRequired} = true`,
    ),
  ],
);

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quoteReference: varchar("quote_reference", { length: 40 })
      .notNull()
      .unique(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "restrict" }),
    sourceRequestVersion: integer("source_request_version").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "restrict",
    }),
    estimateId: uuid("estimate_id").notNull(),
    quoteVersion: integer("quote_version").notNull(),
    recordVersion: integer("record_version").default(1).notNull(),
    status: varchar("status", { length: 24 }).default("DRAFT").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    priceBasis: varchar("price_basis", { length: 8 }).notNull(),
    netAmountMinorUnits: integer("net_amount_minor_units").notNull(),
    vatRateBasisPoints: integer("vat_rate_basis_points").notNull(),
    vatAmountMinorUnits: integer("vat_amount_minor_units").notNull(),
    grossTotalMinorUnits: integer("gross_total_minor_units").notNull(),
    estimatedDurationMinutes: integer("estimated_duration_minutes"),
    commercialSnapshot: jsonb("commercial_snapshot")
      .$type<JsonObject>()
      .notNull(),
    termsSnapshot: jsonb("terms_snapshot").$type<JsonObject>().notNull(),
    acceptanceSourceSnapshot: jsonb("acceptance_source_snapshot").$type<JsonObject>(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    staffNotes: text("staff_notes"),
    customerNotes: text("customer_notes"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    ...managedRecordColumns(),
  },
  (table) => [
    foreignKey({
      name: "quotes_estimate_request_fk",
      columns: [table.estimateId, table.requestId],
      foreignColumns: [requestEstimates.id, requestEstimates.requestId],
    }).onDelete("restrict"),
    uniqueIndex("quotes_request_version_unique").on(
      table.requestId,
      table.quoteVersion,
    ),
    uniqueIndex("quotes_booking_provenance_unique").on(
      table.id,
      table.requestId,
      table.customerId,
      table.propertyId,
    ),
    uniqueIndex("quotes_id_customer_unique").on(table.id, table.customerId),
    uniqueIndex("quotes_active_issued_request_unique")
      .on(table.requestId)
      .where(sql`${table.status} = 'ISSUED'`),
    index("quotes_customer_status_idx").on(
      table.customerId,
      table.status,
      table.createdAt,
    ),
    index("quotes_request_created_idx").on(table.requestId, table.createdAt),
    check(
      "quotes_reference_valid",
      sql`${table.quoteReference} ~ '^Q-[A-F0-9]{24}$'`,
    ),
    check(
      "quotes_status_valid",
      sql`${table.status} in ('DRAFT', 'ISSUED', 'SUPERSEDED', 'EXPIRED', 'WITHDRAWN')`,
    ),
    check("quotes_currency_eur", sql`${table.currency} = 'EUR'`),
    check(
      "quotes_price_basis_valid",
      sql`${table.priceBasis} in ('NET', 'GROSS')`,
    ),
    check("quotes_quote_version_positive", sql`${table.quoteVersion} >= 1`),
    check(
      "quotes_source_request_version_positive",
      sql`${table.sourceRequestVersion} >= 1`,
    ),
    check("quotes_record_version_positive", sql`${table.recordVersion} >= 1`),
    check(
      "quotes_vat_rate_valid",
      sql`${table.vatRateBasisPoints} between 0 and 10000`,
    ),
    check(
      "quotes_amounts_consistent",
      sql`${table.netAmountMinorUnits} >= 0 and ${table.vatAmountMinorUnits} >= 0 and ${table.grossTotalMinorUnits} = ${table.netAmountMinorUnits} + ${table.vatAmountMinorUnits}`,
    ),
    check(
      "quotes_duration_nonnegative",
      sql`${table.estimatedDurationMinutes} is null or ${table.estimatedDurationMinutes} >= 0`,
    ),
    check(
      "quotes_validity_window_valid",
      sql`${table.validUntil} > ${table.validFrom}`,
    ),
    check(
      "quotes_staff_notes_not_blank",
      sql`${table.staffNotes} is null or length(trim(${table.staffNotes})) > 0`,
    ),
    check(
      "quotes_customer_notes_not_blank",
      sql`${table.customerNotes} is null or length(trim(${table.customerNotes})) > 0`,
    ),
    check(
      "quotes_lifecycle_timestamps_consistent",
      sql`(${table.status} = 'DRAFT' and ${table.issuedAt} is null and ${table.supersededAt} is null and ${table.expiredAt} is null and ${table.withdrawnAt} is null) or (${table.status} = 'ISSUED' and ${table.issuedAt} is not null and ${table.supersededAt} is null and ${table.expiredAt} is null and ${table.withdrawnAt} is null) or (${table.status} = 'SUPERSEDED' and ${table.issuedAt} is not null and ${table.supersededAt} is not null and ${table.expiredAt} is null and ${table.withdrawnAt} is null) or (${table.status} = 'EXPIRED' and ${table.issuedAt} is not null and ${table.supersededAt} is null and ${table.expiredAt} is not null and ${table.withdrawnAt} is null) or (${table.status} = 'WITHDRAWN' and ${table.issuedAt} is not null and ${table.supersededAt} is null and ${table.expiredAt} is null and ${table.withdrawnAt} is not null)`,
    ),
    check(
      "quotes_lifecycle_after_issue",
      sql`(${table.supersededAt} is null or ${table.supersededAt} >= ${table.issuedAt}) and (${table.expiredAt} is null or ${table.expiredAt} >= ${table.issuedAt}) and (${table.withdrawnAt} is null or ${table.withdrawnAt} >= ${table.issuedAt})`,
    ),
  ],
);

export const quoteItems = pgTable(
  "quote_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "restrict" }),
    requestItemId: uuid("request_item_id").references(
      () => serviceRequestItems.id,
      { onDelete: "restrict" },
    ),
    serviceId: integer("service_id").references(() => services.id, {
      onDelete: "restrict",
    }),
    cleaningItemTypeId: integer("cleaning_item_type_id").references(
      () => cleaningItemTypes.id,
      { onDelete: "restrict" },
    ),
    measurementModeId: integer("measurement_mode_id").references(
      () => measurementModes.id,
      { onDelete: "restrict" },
    ),
    descriptionBg: text("description_bg").notNull(),
    descriptionEn: text("description_en").notNull(),
    quantity: integer("quantity").notNull(),
    measurementSnapshot: jsonb("measurement_snapshot")
      .$type<JsonObject>()
      .notNull(),
    baseAmountMinorUnits: integer("base_amount_minor_units").notNull(),
    modifierAmountMinorUnits: integer("modifier_amount_minor_units")
      .default(0)
      .notNull(),
    addonAmountMinorUnits: integer("addon_amount_minor_units")
      .default(0)
      .notNull(),
    netAmountMinorUnits: integer("net_amount_minor_units").notNull(),
    vatRateBasisPoints: integer("vat_rate_basis_points").notNull(),
    vatAmountMinorUnits: integer("vat_amount_minor_units").notNull(),
    grossTotalMinorUnits: integer("gross_total_minor_units").notNull(),
    calculationSnapshot: jsonb("calculation_snapshot")
      .$type<JsonObject>()
      .notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("quote_items_quote_sort_unique").on(
      table.quoteId,
      table.sortOrder,
    ),
    uniqueIndex("quote_items_id_quote_unique").on(table.id, table.quoteId),
    index("quote_items_quote_idx").on(table.quoteId),
    check(
      "quote_items_descriptions_not_blank",
      sql`length(trim(${table.descriptionBg})) > 0 and length(trim(${table.descriptionEn})) > 0`,
    ),
    check("quote_items_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "quote_items_amounts_consistent",
      sql`${table.baseAmountMinorUnits} >= 0 and ${table.addonAmountMinorUnits} >= 0 and ${table.netAmountMinorUnits} = ${table.baseAmountMinorUnits} + ${table.modifierAmountMinorUnits} + ${table.addonAmountMinorUnits} and ${table.netAmountMinorUnits} >= 0 and ${table.vatAmountMinorUnits} >= 0 and ${table.grossTotalMinorUnits} = ${table.netAmountMinorUnits} + ${table.vatAmountMinorUnits}`,
    ),
    check(
      "quote_items_vat_rate_valid",
      sql`${table.vatRateBasisPoints} between 0 and 10000`,
    ),
    check("quote_items_sort_nonnegative", sql`${table.sortOrder} >= 0`),
  ],
);

export const businessAuditEvents = pgTable(
  "business_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: varchar("entity_type", { length: 32 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    actorProfileId: uuid("actor_profile_id").references(() => userProfiles.id, {
      onDelete: "set null",
    }),
    source: varchar("source", { length: 32 }).notNull(),
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
    uniqueIndex("business_audit_events_correlation_unique").on(
      table.correlationId,
    ),
    index("business_audit_events_entity_timeline_idx").on(
      table.entityType,
      table.entityId,
      table.createdAt,
    ),
    index("business_audit_events_type_created_idx").on(
      table.eventType,
      table.createdAt,
    ),
    check(
      "business_audit_events_entity_type_valid",
      sql`${table.entityType} in ('SERVICE_REQUEST', 'REQUEST_ESTIMATE', 'QUOTE')`,
    ),
    check(
      "business_audit_events_event_type_valid",
      sql`${table.eventType} in ('REQUEST_SUBMITTED', 'REQUEST_LINKED', 'REQUEST_STATUS_CHANGED', 'REQUEST_NORMALIZED', 'ESTIMATE_CREATED', 'QUOTE_DRAFT_CREATED', 'QUOTE_DRAFT_UPDATED', 'QUOTE_ISSUED', 'QUOTE_SUPERSEDED', 'QUOTE_WITHDRAWN', 'QUOTE_EXPIRED')`,
    ),
    check(
      "business_audit_events_source_valid",
      sql`${table.source} in ('PUBLIC_WEB', 'CUSTOMER_PORTAL', 'STAFF', 'SYSTEM')`,
    ),
  ],
);
