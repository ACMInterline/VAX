import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { travelZones } from "./commercial-engine";
import { userProfiles } from "./identity-access";
import {
  cleaningItemTypes,
  conditionLevels,
  fibreMaterials,
  issueTypes,
  riskFlags,
  surfaceConstructions,
} from "./service-catalogue";

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

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerType: varchar("customer_type", { length: 16 }).notNull(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    legalName: varchar("legal_name", { length: 255 }),
    preferredLocale: varchar("preferred_locale", { length: 8 })
      .default("bg")
      .notNull(),
    primaryEmail: varchar("primary_email", { length: 320 }),
    primaryPhone: varchar("primary_phone", { length: 40 }),
    status: varchar("status", { length: 16 }).default("ACTIVE").notNull(),
    version: integer("version").default(1).notNull(),
    internalNotes: text("internal_notes"),
    ...managedRecordColumns(),
  },
  (table) => [
    index("customers_status_type_name_idx").on(
      table.status,
      table.customerType,
      table.displayName,
    ),
    index("customers_primary_email_idx")
      .on(sql`lower(${table.primaryEmail})`)
      .where(sql`${table.primaryEmail} is not null`),
    check(
      "customers_type_valid",
      sql`${table.customerType} in ('INDIVIDUAL', 'BUSINESS')`,
    ),
    check(
      "customers_status_valid",
      sql`${table.status} in ('ACTIVE', 'INACTIVE', 'ARCHIVED')`,
    ),
    check("customers_version_positive", sql`${table.version} >= 1`),
    check(
      "customers_locale_valid",
      sql`${table.preferredLocale} in ('bg', 'en')`,
    ),
    check(
      "customers_display_name_not_blank",
      sql`length(trim(${table.displayName})) > 0`,
    ),
    check(
      "customers_legal_name_not_blank",
      sql`${table.legalName} is null or length(trim(${table.legalName})) > 0`,
    ),
    check(
      "customers_primary_email_not_blank",
      sql`${table.primaryEmail} is null or length(trim(${table.primaryEmail})) > 0`,
    ),
    check(
      "customers_primary_phone_not_blank",
      sql`${table.primaryPhone} is null or length(trim(${table.primaryPhone})) > 0`,
    ),
  ],
);

export const customerContacts = pgTable(
  "customer_contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    contactName: varchar("contact_name", { length: 160 }).notNull(),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 40 }),
    roleTitle: varchar("role_title", { length: 160 }),
    isPrimary: boolean("is_primary").default(false).notNull(),
    preferredContactMethod: varchar("preferred_contact_method", {
      length: 20,
    })
      .default("NO_PREFERENCE")
      .notNull(),
    locale: varchar("locale", { length: 8 }).default("bg").notNull(),
    active: boolean("active").default(true).notNull(),
    version: integer("version").default(1).notNull(),
    ...managedRecordColumns(),
  },
  (table) => [
    index("customer_contacts_customer_active_idx").on(
      table.customerId,
      table.active,
    ),
    uniqueIndex("customer_contacts_id_customer_unique").on(
      table.id,
      table.customerId,
    ),
    index("customer_contacts_email_idx")
      .on(sql`lower(${table.email})`)
      .where(sql`${table.email} is not null`),
    uniqueIndex("customer_contacts_active_primary_unique")
      .on(table.customerId)
      .where(sql`${table.active} = true and ${table.isPrimary} = true`),
    check(
      "customer_contacts_name_not_blank",
      sql`length(trim(${table.contactName})) > 0`,
    ),
    check(
      "customer_contacts_email_not_blank",
      sql`${table.email} is null or length(trim(${table.email})) > 0`,
    ),
    check(
      "customer_contacts_phone_not_blank",
      sql`${table.phone} is null or length(trim(${table.phone})) > 0`,
    ),
    check(
      "customer_contacts_role_title_not_blank",
      sql`${table.roleTitle} is null or length(trim(${table.roleTitle})) > 0`,
    ),
    check(
      "customer_contacts_channel_present",
      sql`${table.email} is not null or ${table.phone} is not null`,
    ),
    check(
      "customer_contacts_preferred_method_valid",
      sql`${table.preferredContactMethod} in ('EMAIL', 'PHONE', 'NO_PREFERENCE')`,
    ),
    check(
      "customer_contacts_preferred_method_channel_present",
      sql`(${table.preferredContactMethod} = 'EMAIL' and ${table.email} is not null) or (${table.preferredContactMethod} = 'PHONE' and ${table.phone} is not null) or ${table.preferredContactMethod} = 'NO_PREFERENCE'`,
    ),
    check(
      "customer_contacts_locale_valid",
      sql`${table.locale} in ('bg', 'en')`,
    ),
    check(
      "customer_contacts_primary_active",
      sql`${table.isPrimary} = false or ${table.active} = true`,
    ),
    check(
      "customer_contacts_version_positive",
      sql`${table.version} >= 1`,
    ),
  ],
);

export const customerIdentityLinks = pgTable(
  "customer_identity_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userProfileId: uuid("user_profile_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    relationshipType: varchar("relationship_type", { length: 32 }).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdByProfileId: uuid("created_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByProfileId: uuid("revoked_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [
    uniqueIndex("customer_identity_links_active_pair_unique")
      .on(table.userProfileId, table.customerId)
      .where(sql`${table.active} = true`),
    index("customer_identity_links_customer_active_idx").on(
      table.customerId,
      table.active,
    ),
    check(
      "customer_identity_links_relationship_valid",
      sql`${table.relationshipType} in ('OWNER', 'PRIMARY_CONTACT', 'AUTHORIZED_CONTACT')`,
    ),
    check(
      "customer_identity_links_active_revocation_consistent",
      sql`(${table.active} = true and ${table.revokedAt} is null) or (${table.active} = false and ${table.revokedAt} is not null)`,
    ),
    check(
      "customer_identity_links_revocation_after_creation",
      sql`${table.revokedAt} is null or ${table.revokedAt} >= ${table.createdAt}`,
    ),
  ],
);

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    propertyType: varchar("property_type", { length: 40 }).notNull(),
    label: varchar("label", { length: 160 }).notNull(),
    city: varchar("city", { length: 160 }).notNull(),
    district: varchar("district", { length: 160 }),
    streetAddress: text("street_address").notNull(),
    postalCode: varchar("postal_code", { length: 20 }),
    latitude: numeric("latitude", {
      precision: 9,
      scale: 6,
      mode: "number",
    }),
    longitude: numeric("longitude", {
      precision: 9,
      scale: 6,
      mode: "number",
    }),
    accessNotes: text("access_notes"),
    parkingNotes: text("parking_notes"),
    serviceZoneId: integer("service_zone_id").references(
      () => travelZones.id,
      { onDelete: "restrict" },
    ),
    status: varchar("status", { length: 16 }).default("ACTIVE").notNull(),
    version: integer("version").default(1).notNull(),
    ...managedRecordColumns(),
  },
  (table) => [
    index("properties_customer_status_idx").on(
      table.customerId,
      table.status,
    ),
    check(
      "properties_type_valid",
      sql`${table.propertyType} in ('RESIDENTIAL', 'OFFICE', 'HOTEL_GUEST_ACCOMMODATION', 'SERVICED_APARTMENT', 'RESTAURANT_CAFE', 'COMMERCIAL_PUBLIC', 'OTHER')`,
    ),
    check(
      "properties_status_valid",
      sql`${table.status} in ('ACTIVE', 'INACTIVE', 'ARCHIVED')`,
    ),
    check("properties_version_positive", sql`${table.version} >= 1`),
    check("properties_label_not_blank", sql`length(trim(${table.label})) > 0`),
    check("properties_city_not_blank", sql`length(trim(${table.city})) > 0`),
    check(
      "properties_street_address_not_blank",
      sql`length(trim(${table.streetAddress})) > 0`,
    ),
    check(
      "properties_district_not_blank",
      sql`${table.district} is null or length(trim(${table.district})) > 0`,
    ),
    check(
      "properties_postal_code_not_blank",
      sql`${table.postalCode} is null or length(trim(${table.postalCode})) > 0`,
    ),
    check(
      "properties_coordinates_complete",
      sql`(${table.latitude} is null and ${table.longitude} is null) or (${table.latitude} is not null and ${table.longitude} is not null)`,
    ),
    check(
      "properties_coordinates_valid",
      sql`(${table.latitude} is null or ${table.latitude} between -90 and 90) and (${table.longitude} is null or ${table.longitude} between -180 and 180)`,
    ),
  ],
);

export const propertyAreas = pgTable(
  "property_areas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    areaType: varchar("area_type", { length: 32 }).notNull(),
    customLabel: varchar("custom_label", { length: 160 }),
    floorLevel: varchar("floor_level", { length: 64 }),
    notes: text("notes"),
    active: boolean("active").default(true).notNull(),
    version: integer("version").default(1).notNull(),
    ...managedRecordColumns(),
  },
  (table) => [
    index("property_areas_property_active_idx").on(
      table.propertyId,
      table.active,
    ),
    uniqueIndex("property_areas_id_property_unique").on(
      table.id,
      table.propertyId,
    ),
    check(
      "property_areas_type_valid",
      sql`${table.areaType} in ('LIVING_ROOM', 'BEDROOM', 'DINING_ROOM', 'OFFICE', 'RECEPTION', 'CORRIDOR', 'STAIRCASE', 'MEETING_ROOM', 'HOTEL_ROOM', 'OTHER')`,
    ),
    check(
      "property_areas_custom_label_not_blank",
      sql`${table.customLabel} is null or length(trim(${table.customLabel})) > 0`,
    ),
    check(
      "property_areas_floor_level_not_blank",
      sql`${table.floorLevel} is null or length(trim(${table.floorLevel})) > 0`,
    ),
    check(
      "property_areas_other_label_present",
      sql`${table.areaType} <> 'OTHER' or (${table.customLabel} is not null and length(trim(${table.customLabel})) > 0)`,
    ),
    check("property_areas_version_positive", sql`${table.version} >= 1`),
  ],
);

export const cleaningAssets = pgTable(
  "cleaning_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    areaId: uuid("area_id"),
    cleaningItemTypeId: integer("cleaning_item_type_id")
      .notNull()
      .references(() => cleaningItemTypes.id, { onDelete: "restrict" }),
    label: varchar("label", { length: 160 }).notNull(),
    approximateLengthCm: integer("approximate_length_cm"),
    approximateWidthCm: integer("approximate_width_cm"),
    approximateAreaHundredthsM2: integer(
      "approximate_area_hundredths_m2",
    ),
    approximateSeatCount: integer("approximate_seat_count"),
    reportedFibreMaterialId: integer("reported_fibre_material_id").references(
      () => fibreMaterials.id,
      { onDelete: "restrict" },
    ),
    reportedSurfaceConstructionId: integer(
      "reported_surface_construction_id",
    ).references(() => surfaceConstructions.id, { onDelete: "restrict" }),
    customerReportedConditionLevelId: integer(
      "customer_reported_condition_level_id",
    ).references(() => conditionLevels.id, { onDelete: "restrict" }),
    customerConditionNotes: text("customer_condition_notes"),
    colourAppearanceNotes: text("colour_appearance_notes"),
    approximateAcquisitionYear: integer("approximate_acquisition_year"),
    status: varchar("status", { length: 16 }).default("ACTIVE").notNull(),
    version: integer("version").default(1).notNull(),
    operationalNotes: text("operational_notes"),
    ...managedRecordColumns(),
  },
  (table) => [
    foreignKey({
      name: "cleaning_assets_area_property_fk",
      columns: [table.areaId, table.propertyId],
      foreignColumns: [propertyAreas.id, propertyAreas.propertyId],
    }).onDelete("restrict"),
    index("cleaning_assets_property_status_idx").on(
      table.propertyId,
      table.status,
    ),
    index("cleaning_assets_area_status_idx")
      .on(table.areaId, table.status)
      .where(sql`${table.areaId} is not null`),
    index("cleaning_assets_item_type_status_idx").on(
      table.cleaningItemTypeId,
      table.status,
    ),
    uniqueIndex("cleaning_assets_id_property_unique").on(
      table.id,
      table.propertyId,
    ),
    check("cleaning_assets_label_not_blank", sql`length(trim(${table.label})) > 0`),
    check(
      "cleaning_assets_status_valid",
      sql`${table.status} in ('ACTIVE', 'INACTIVE', 'ARCHIVED')`,
    ),
    check("cleaning_assets_version_positive", sql`${table.version} >= 1`),
    check(
      "cleaning_assets_dimensions_positive",
      sql`(${table.approximateLengthCm} is null or ${table.approximateLengthCm} > 0) and (${table.approximateWidthCm} is null or ${table.approximateWidthCm} > 0) and (${table.approximateAreaHundredthsM2} is null or ${table.approximateAreaHundredthsM2} > 0) and (${table.approximateSeatCount} is null or ${table.approximateSeatCount} > 0)`,
    ),
    check(
      "cleaning_assets_acquisition_year_valid",
      sql`${table.approximateAcquisitionYear} is null or ${table.approximateAcquisitionYear} between 1800 and 3000`,
    ),
  ],
);

export const cleaningAssetReportedIssues = pgTable(
  "cleaning_asset_reported_issues",
  {
    assetId: uuid("cleaning_asset_id")
      .notNull()
      .references(() => cleaningAssets.id, { onDelete: "restrict" }),
    issueTypeId: integer("issue_type_id")
      .notNull()
      .references(() => issueTypes.id, { onDelete: "restrict" }),
    notes: text("notes"),
    active: boolean("active").default(true).notNull(),
    ...managedRecordColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.assetId, table.issueTypeId] }),
    check(
      "cleaning_asset_reported_issues_notes_not_blank",
      sql`${table.notes} is null or length(trim(${table.notes})) > 0`,
    ),
  ],
);

export const cleaningAssetReportedRiskFlags = pgTable(
  "cleaning_asset_reported_risk_flags",
  {
    assetId: uuid("cleaning_asset_id")
      .notNull()
      .references(() => cleaningAssets.id, { onDelete: "restrict" }),
    riskFlagId: integer("risk_flag_id")
      .notNull()
      .references(() => riskFlags.id, { onDelete: "restrict" }),
    notes: text("notes"),
    active: boolean("active").default(true).notNull(),
    ...managedRecordColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.assetId, table.riskFlagId] }),
    check(
      "cleaning_asset_reported_risk_flags_notes_not_blank",
      sql`${table.notes} is null or length(trim(${table.notes})) > 0`,
    ),
  ],
);
