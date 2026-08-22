import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import {
  cleaningItemTypes,
  fibreMaterials,
  issueTypes,
  measurementModes,
  riskFlags,
  serviceAddons,
  services,
  treatmentLevels,
} from "./service-catalogue";

function managedTimestamps() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  };
}

function referenceColumns() {
  return {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    code: varchar("code", { length: 64 }).notNull().unique(),
    labelBg: varchar("label_bg", { length: 160 }).notNull(),
    labelEn: varchar("label_en", { length: 160 }).notNull(),
    descriptionBg: text("description_bg").notNull(),
    descriptionEn: text("description_en").notNull(),
    sortOrder: integer("sort_order").notNull(),
    active: boolean("active").default(true).notNull(),
    ...managedTimestamps(),
  };
}

export const commercialConditionBands = pgTable(
  "commercial_condition_bands",
  referenceColumns(),
  (table) => [
    check(
      "commercial_condition_bands_sort_nonnegative",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);

export const parkingPolicies = pgTable(
  "parking_policies",
  referenceColumns(),
  (table) => [
    check("parking_policies_sort_nonnegative", sql`${table.sortOrder} >= 0`),
  ],
);

export const travelZones = pgTable(
  "travel_zones",
  {
    ...referenceColumns(),
    defaultParkingPolicyId: integer("default_parking_policy_id")
      .notNull()
      .references(() => parkingPolicies.id, { onDelete: "restrict" }),
    distanceThresholdHundredthsKm: integer(
      "distance_threshold_hundredths_km",
    ),
    travelTimeThresholdMinutes: integer("travel_time_threshold_minutes"),
    boundaryNotes: text("boundary_notes"),
    serviceEligible: boolean("service_eligible").default(false).notNull(),
    minimumOrderOverrideMinorUnits: integer(
      "minimum_order_override_minor_units",
    ),
    estimatedBaseTravelMinutes: integer("estimated_base_travel_minutes"),
    manualConfirmationRequired: boolean("manual_confirmation_required")
      .default(true)
      .notNull(),
    geographicMetadata: jsonb("geographic_metadata"),
  },
  (table) => [
    check("travel_zones_sort_nonnegative", sql`${table.sortOrder} >= 0`),
    check(
      "travel_zones_distance_nonnegative",
      sql`${table.distanceThresholdHundredthsKm} is null or ${table.distanceThresholdHundredthsKm} >= 0`,
    ),
    check(
      "travel_zones_time_nonnegative",
      sql`${table.travelTimeThresholdMinutes} is null or ${table.travelTimeThresholdMinutes} >= 0`,
    ),
    check(
      "travel_zones_minimum_order_nonnegative",
      sql`${table.minimumOrderOverrideMinorUnits} is null or ${table.minimumOrderOverrideMinorUnits} >= 0`,
    ),
    check(
      "travel_zones_base_travel_nonnegative",
      sql`${table.estimatedBaseTravelMinutes} is null or ${table.estimatedBaseTravelMinutes} >= 0`,
    ),
  ],
);

export const timingCategories = pgTable(
  "timing_categories",
  referenceColumns(),
  (table) => [
    check("timing_categories_sort_nonnegative", sql`${table.sortOrder} >= 0`),
  ],
);

export const priceBooks = pgTable(
  "price_books",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    code: varchar("code", { length: 96 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    market: varchar("market", { length: 64 }).notNull(),
    customerSegment: varchar("customer_segment", { length: 32 }).notNull(),
    version: integer("version").notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    vatMode: varchar("vat_mode", { length: 32 }).notNull(),
    priceBasis: varchar("price_basis", { length: 8 }).notNull(),
    defaultVatRateBasisPoints: integer(
      "default_vat_rate_basis_points",
    ).notNull(),
    provisional: boolean("provisional").default(true).notNull(),
    approvedForPublication: boolean("approved_for_publication")
      .default(false)
      .notNull(),
    active: boolean("active").default(false).notNull(),
    ...managedTimestamps(),
  },
  (table) => [
    check("price_books_eur_only", sql`${table.currency} = 'EUR'`),
    check("price_books_version_positive", sql`${table.version} > 0`),
    check(
      "price_books_status_valid",
      sql`${table.status} in ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED')`,
    ),
    check(
      "price_books_segment_valid",
      sql`${table.customerSegment} in ('RESIDENTIAL', 'B2B')`,
    ),
    check(
      "price_books_vat_mode_valid",
      sql`${table.vatMode} in ('VAT_REGISTERED', 'VAT_NOT_REGISTERED')`,
    ),
    check(
      "price_books_price_basis_valid",
      sql`${table.priceBasis} in ('GROSS', 'NET')`,
    ),
    check(
      "price_books_vat_rate_valid",
      sql`${table.defaultVatRateBasisPoints} between 0 and 10000`,
    ),
    check(
      "price_books_nonregistered_vat_zero",
      sql`${table.vatMode} <> 'VAT_NOT_REGISTERED' or ${table.defaultVatRateBasisPoints} = 0`,
    ),
    check(
      "price_books_effective_window_valid",
      sql`${table.effectiveFrom} is null or ${table.effectiveUntil} is null or ${table.effectiveUntil} > ${table.effectiveFrom}`,
    ),
  ],
);

export const priceRules = pgTable(
  "price_rules",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    priceBookId: integer("price_book_id")
      .notNull()
      .references(() => priceBooks.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 160 }).notNull().unique(),
    ruleType: varchar("rule_type", { length: 40 }).notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    adjustmentKind: varchar("adjustment_kind", { length: 32 }).notNull(),
    serviceId: integer("service_id").references(() => services.id, {
      onDelete: "restrict",
    }),
    itemTypeId: integer("item_type_id").references(() => cleaningItemTypes.id, {
      onDelete: "restrict",
    }),
    measurementModeId: integer("measurement_mode_id").references(
      () => measurementModes.id,
      { onDelete: "restrict" },
    ),
    conditionBandId: integer("condition_band_id").references(
      () => commercialConditionBands.id,
      { onDelete: "restrict" },
    ),
    issueTypeId: integer("issue_type_id").references(() => issueTypes.id, {
      onDelete: "restrict",
    }),
    addonId: integer("addon_id").references(() => serviceAddons.id, {
      onDelete: "restrict",
    }),
    suggestedAddonId: integer("suggested_addon_id").references(
      () => serviceAddons.id,
      { onDelete: "restrict" },
    ),
    riskFlagId: integer("risk_flag_id").references(() => riskFlags.id, {
      onDelete: "restrict",
    }),
    travelZoneId: integer("travel_zone_id").references(() => travelZones.id, {
      onDelete: "restrict",
    }),
    timingCategoryId: integer("timing_category_id").references(
      () => timingCategories.id,
      { onDelete: "restrict" },
    ),
    billingUnit: varchar("billing_unit", { length: 24 }),
    amountMinorUnits: integer("amount_minor_units"),
    percentageBasisPoints: integer("percentage_basis_points"),
    measurementMinHundredths: integer("measurement_min_hundredths"),
    measurementMaxHundredths: integer("measurement_max_hundredths"),
    manualAssessmentRequired: boolean("manual_assessment_required")
      .default(false)
      .notNull(),
    declineOrReferRequired: boolean("decline_or_refer_required")
      .default(false)
      .notNull(),
    priority: integer("priority").notNull(),
    active: boolean("active").default(true).notNull(),
    notes: text("notes"),
    ...managedTimestamps(),
  },
  (table) => [
    uniqueIndex("price_rules_book_code_unique").on(
      table.priceBookId,
      table.code,
    ),
    check(
      "price_rules_type_valid",
      sql`${table.ruleType} in ('BASE_ITEM', 'PER_AREA_M2', 'PER_ITEM', 'PER_SEAT', 'MINIMUM_VISIT', 'CONDITION_MODIFIER', 'ISSUE_MODIFIER', 'ADD_ON', 'TRAVEL_ZONE', 'TIMING_MODIFIER', 'VOLUME_TIER', 'CUSTOM_ASSESSMENT')`,
    ),
    check(
      "price_rules_adjustment_valid",
      sql`${table.adjustmentKind} in ('NONE', 'FIXED', 'RATE_PER_UNIT', 'PERCENTAGE', 'MANUAL_ASSESSMENT', 'DECLINE_OR_REFER', 'SUGGEST_ADD_ON')`,
    ),
    check(
      "price_rules_billing_unit_valid",
      sql`${table.billingUnit} is null or ${table.billingUnit} in ('PER_ITEM', 'PER_SIDE', 'PER_SEAT', 'AREA_M2')`,
    ),
    check(
      "price_rules_percentage_valid",
      sql`${table.percentageBasisPoints} is null or ${table.percentageBasisPoints} between -10000 and 100000`,
    ),
    check(
      "price_rules_measurement_min_nonnegative",
      sql`${table.measurementMinHundredths} is null or ${table.measurementMinHundredths} >= 0`,
    ),
    check(
      "price_rules_measurement_window_valid",
      sql`${table.measurementMinHundredths} is null or ${table.measurementMaxHundredths} is null or ${table.measurementMaxHundredths} >= ${table.measurementMinHundredths}`,
    ),
    check("price_rules_priority_nonnegative", sql`${table.priority} >= 0`),
    check(
      "price_rules_decline_requires_manual",
      sql`${table.declineOrReferRequired} = false or ${table.manualAssessmentRequired} = true`,
    ),
  ],
);

export const durationModels = pgTable(
  "duration_models",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    code: varchar("code", { length: 96 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    market: varchar("market", { length: 64 }).notNull(),
    version: integer("version").notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    provisional: boolean("provisional").default(true).notNull(),
    active: boolean("active").default(false).notNull(),
    ...managedTimestamps(),
  },
  (table) => [
    check("duration_models_version_positive", sql`${table.version} > 0`),
    check(
      "duration_models_status_valid",
      sql`${table.status} in ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED')`,
    ),
    check(
      "duration_models_effective_window_valid",
      sql`${table.effectiveFrom} is null or ${table.effectiveUntil} is null or ${table.effectiveUntil} > ${table.effectiveFrom}`,
    ),
  ],
);

export const durationRules = pgTable(
  "duration_rules",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    durationModelId: integer("duration_model_id")
      .notNull()
      .references(() => durationModels.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 160 }).notNull().unique(),
    ruleType: varchar("rule_type", { length: 40 }).notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    serviceId: integer("service_id").references(() => services.id, {
      onDelete: "restrict",
    }),
    itemTypeId: integer("item_type_id").references(() => cleaningItemTypes.id, {
      onDelete: "restrict",
    }),
    conditionBandId: integer("condition_band_id").references(
      () => commercialConditionBands.id,
      { onDelete: "restrict" },
    ),
    issueTypeId: integer("issue_type_id").references(() => issueTypes.id, {
      onDelete: "restrict",
    }),
    addonId: integer("addon_id").references(() => serviceAddons.id, {
      onDelete: "restrict",
    }),
    riskFlagId: integer("risk_flag_id").references(() => riskFlags.id, {
      onDelete: "restrict",
    }),
    fibreMaterialId: integer("fibre_material_id").references(
      () => fibreMaterials.id,
      { onDelete: "restrict" },
    ),
    treatmentLevelId: integer("treatment_level_id").references(
      () => treatmentLevels.id,
      { onDelete: "restrict" },
    ),
    billingUnit: varchar("billing_unit", { length: 24 }),
    minutes: integer("minutes"),
    multiplierBasisPoints: integer("multiplier_basis_points"),
    productivityHundredthsM2PerHour: integer(
      "productivity_hundredths_m2_per_hour",
    ),
    manualAssessmentRequired: boolean("manual_assessment_required")
      .default(false)
      .notNull(),
    declineOrReferRequired: boolean("decline_or_refer_required")
      .default(false)
      .notNull(),
    priority: integer("priority").notNull(),
    active: boolean("active").default(true).notNull(),
    notes: text("notes"),
    ...managedTimestamps(),
  },
  (table) => [
    uniqueIndex("duration_rules_model_code_unique").on(
      table.durationModelId,
      table.code,
    ),
    check(
      "duration_rules_type_valid",
      sql`${table.ruleType} in ('JOB_SETUP', 'JOB_INSPECTION', 'JOB_CLEANUP', 'ITEM_BASE', 'AREA_PRODUCTIVITY', 'CONDITION_MULTIPLIER', 'ISSUE_COMPLEXITY', 'MATERIAL_SENSITIVITY', 'TREATMENT_COMPLEXITY', 'ADD_ON_TIME', 'CUSTOM_ASSESSMENT')`,
    ),
    check(
      "duration_rules_billing_unit_valid",
      sql`${table.billingUnit} is null or ${table.billingUnit} in ('PER_ITEM', 'PER_SIDE', 'PER_SEAT', 'AREA_M2')`,
    ),
    check(
      "duration_rules_minutes_nonnegative",
      sql`${table.minutes} is null or ${table.minutes} >= 0`,
    ),
    check(
      "duration_rules_multiplier_positive",
      sql`${table.multiplierBasisPoints} is null or ${table.multiplierBasisPoints} > 0`,
    ),
    check(
      "duration_rules_productivity_positive",
      sql`${table.productivityHundredthsM2PerHour} is null or ${table.productivityHundredthsM2PerHour} > 0`,
    ),
    check("duration_rules_priority_nonnegative", sql`${table.priority} >= 0`),
    check(
      "duration_rules_decline_requires_manual",
      sql`${table.declineOrReferRequired} = false or ${table.manualAssessmentRequired} = true`,
    ),
  ],
);
