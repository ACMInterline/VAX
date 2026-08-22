import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  };
}

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

export const serviceCategories = pgTable(
  "service_categories",
  referenceColumns(),
  (table) => [
    check(
      "service_categories_sort_order_nonnegative",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);

export const measurementModes = pgTable(
  "measurement_modes",
  referenceColumns(),
  (table) => [
    check(
      "measurement_modes_sort_order_nonnegative",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);

export const reuseAdvisoryCategories = pgTable(
  "reuse_advisory_categories",
  referenceColumns(),
  (table) => [
    check(
      "reuse_advisory_categories_sort_order_nonnegative",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);

export const services = pgTable(
  "services",
  {
    ...referenceColumns(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => serviceCategories.id, { onDelete: "restrict" }),
    publicSlug: varchar("public_slug", { length: 96 }).unique(),
    baseSetupMinutes: integer("base_setup_minutes"),
    durationMinutesPerUnit: numeric("duration_minutes_per_unit", {
      precision: 10,
      scale: 2,
      mode: "number",
    }),
    complexityMultiplierEligible: boolean("complexity_multiplier_eligible"),
    minimumServiceDurationMinutes: integer("minimum_service_duration_minutes"),
    inspectionRequired: boolean("inspection_required").default(true).notNull(),
    instantQuoteEligible: boolean("instant_quote_eligible")
      .default(false)
      .notNull(),
    reuseAdvisoryCategoryId: integer("reuse_advisory_category_id")
      .notNull()
      .references(() => reuseAdvisoryCategories.id, {
        onDelete: "restrict",
      }),
  },
  (table) => [
    check("services_sort_order_nonnegative", sql`${table.sortOrder} >= 0`),
    check(
      "services_base_setup_minutes_nonnegative",
      sql`${table.baseSetupMinutes} is null or ${table.baseSetupMinutes} >= 0`,
    ),
    check(
      "services_duration_factor_positive",
      sql`${table.durationMinutesPerUnit} is null or ${table.durationMinutesPerUnit} > 0`,
    ),
    check(
      "services_minimum_duration_nonnegative",
      sql`${table.minimumServiceDurationMinutes} is null or ${table.minimumServiceDurationMinutes} >= 0`,
    ),
  ],
);

export const cleaningItemTypes = pgTable(
  "cleaning_item_types",
  {
    ...referenceColumns(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => serviceCategories.id, { onDelete: "restrict" }),
  },
  (table) => [
    check(
      "cleaning_item_types_sort_order_nonnegative",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);

export const cleaningItemTypeMeasurementModes = pgTable(
  "cleaning_item_type_measurement_modes",
  {
    itemTypeId: integer("item_type_id")
      .notNull()
      .references(() => cleaningItemTypes.id, { onDelete: "restrict" }),
    measurementModeId: integer("measurement_mode_id")
      .notNull()
      .references(() => measurementModes.id, { onDelete: "restrict" }),
    isDefault: boolean("is_default").default(false).notNull(),
    ...managedTimestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.itemTypeId, table.measurementModeId] }),
    uniqueIndex("cleaning_item_type_default_measurement_unique")
      .on(table.itemTypeId)
      .where(sql`${table.isDefault} = true`),
  ],
);

export const fibreMaterials = pgTable(
  "fibre_materials",
  referenceColumns(),
  (table) => [
    check(
      "fibre_materials_sort_order_nonnegative",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);

export const surfaceConstructions = pgTable(
  "surface_constructions",
  referenceColumns(),
  (table) => [
    check(
      "surface_constructions_sort_order_nonnegative",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);

export const conditionLevels = pgTable(
  "condition_levels",
  referenceColumns(),
  (table) => [
    check(
      "condition_levels_sort_order_nonnegative",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);

export const issueHandlingClassifications = pgTable(
  "issue_handling_classifications",
  referenceColumns(),
  (table) => [
    check(
      "issue_handling_classifications_sort_order_nonnegative",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);

export const issueTypes = pgTable(
  "issue_types",
  {
    ...referenceColumns(),
    handlingClassificationId: integer("handling_classification_id")
      .notNull()
      .references(() => issueHandlingClassifications.id, {
        onDelete: "restrict",
      }),
  },
  (table) => [
    check("issue_types_sort_order_nonnegative", sql`${table.sortOrder} >= 0`),
  ],
);

export const riskFlags = pgTable(
  "risk_flags",
  referenceColumns(),
  (table) => [
    check("risk_flags_sort_order_nonnegative", sql`${table.sortOrder} >= 0`),
  ],
);

export const treatmentLevels = pgTable(
  "treatment_levels",
  {
    ...referenceColumns(),
    customerSelectable: boolean("customer_selectable")
      .default(false)
      .notNull(),
  },
  (table) => [
    check(
      "treatment_levels_sort_order_nonnegative",
      sql`${table.sortOrder} >= 0`,
    ),
    check(
      "treatment_levels_not_customer_selectable",
      sql`${table.customerSelectable} = false`,
    ),
  ],
);

export const mechanicalActionLevels = pgTable(
  "mechanical_action_levels",
  referenceColumns(),
  (table) => [
    check(
      "mechanical_action_levels_sort_order_nonnegative",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);

export const treatmentApproaches = pgTable(
  "treatment_approaches",
  referenceColumns(),
  (table) => [
    check(
      "treatment_approaches_sort_order_nonnegative",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);

export const cleaningProductCategories = pgTable(
  "cleaning_product_categories",
  referenceColumns(),
  (table) => [
    check(
      "cleaning_product_categories_sort_order_nonnegative",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);

export const cleaningProducts = pgTable("cleaning_products", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  manufacturer: varchar("manufacturer", { length: 160 }),
  productName: varchar("product_name", { length: 255 }).notNull(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => cleaningProductCategories.id, { onDelete: "restrict" }),
  intendedApplication: text("intended_application"),
  compatibleMaterialNotes: text("compatible_material_notes"),
  dilutionGuidance: text("dilution_guidance"),
  safetyDocumentReference: text("safety_document_reference"),
  evidenceDocumentReference: text("evidence_document_reference"),
  active: boolean("active").default(true).notNull(),
  internalNotes: text("internal_notes"),
  ...managedTimestamps(),
});

export const serviceAddons = pgTable(
  "service_addons",
  referenceColumns(),
  (table) => [
    check(
      "service_addons_sort_order_nonnegative",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);

export const capabilityStatuses = pgTable(
  "capability_statuses",
  referenceColumns(),
  (table) => [
    check(
      "capability_statuses_sort_order_nonnegative",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);

export const serviceItemCapabilities = pgTable(
  "service_item_capabilities",
  {
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    itemTypeId: integer("item_type_id")
      .notNull()
      .references(() => cleaningItemTypes.id, { onDelete: "restrict" }),
    statusId: integer("status_id")
      .notNull()
      .references(() => capabilityStatuses.id, { onDelete: "restrict" }),
    inspectionRequired: boolean("inspection_required").default(true).notNull(),
    instantQuoteEligible: boolean("instant_quote_eligible")
      .default(false)
      .notNull(),
    ...managedTimestamps(),
  },
  (table) => [primaryKey({ columns: [table.serviceId, table.itemTypeId] })],
);

export const serviceTreatmentLevels = pgTable(
  "service_treatment_levels",
  {
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    treatmentLevelId: integer("treatment_level_id")
      .notNull()
      .references(() => treatmentLevels.id, { onDelete: "restrict" }),
    statusId: integer("status_id")
      .notNull()
      .references(() => capabilityStatuses.id, { onDelete: "restrict" }),
    ...managedTimestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.serviceId, table.treatmentLevelId] }),
  ],
);

export const materialTreatmentConsiderations = pgTable(
  "material_treatment_considerations",
  {
    materialId: integer("material_id")
      .notNull()
      .references(() => fibreMaterials.id, { onDelete: "restrict" }),
    treatmentLevelId: integer("treatment_level_id")
      .notNull()
      .references(() => treatmentLevels.id, { onDelete: "restrict" }),
    statusId: integer("status_id")
      .notNull()
      .references(() => capabilityStatuses.id, { onDelete: "restrict" }),
    notesBg: text("notes_bg").notNull(),
    notesEn: text("notes_en").notNull(),
    ...managedTimestamps(),
  },
  (table) => [
    primaryKey({ columns: [table.materialId, table.treatmentLevelId] }),
  ],
);

export const serviceAddonCapabilities = pgTable(
  "service_addon_capabilities",
  {
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    addonId: integer("addon_id")
      .notNull()
      .references(() => serviceAddons.id, { onDelete: "restrict" }),
    statusId: integer("status_id")
      .notNull()
      .references(() => capabilityStatuses.id, { onDelete: "restrict" }),
    ...managedTimestamps(),
  },
  (table) => [primaryKey({ columns: [table.serviceId, table.addonId] })],
);
