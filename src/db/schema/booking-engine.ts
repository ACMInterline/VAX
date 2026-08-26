import { sql } from "drizzle-orm";
import {
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
import {
  equipmentResources,
  operationsTeams,
  travelTimeProfiles,
  workingHourPolicies,
} from "./availability-engine";
import { userProfiles } from "./identity-access";
import {
  quoteItems,
  quotes,
  serviceRequestItems,
} from "./request-quote";

type JsonObject = Record<string, unknown>;

export const quoteAcceptances = pgTable(
  "quote_acceptances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quoteId: uuid("quote_id").notNull(),
    quoteVersion: integer("quote_version").notNull(),
    quoteRecordVersion: integer("quote_record_version").notNull(),
    requestId: uuid("request_id").notNull(),
    sourceRequestVersion: integer("source_request_version").notNull(),
    customerId: uuid("customer_id").notNull(),
    propertyId: uuid("property_id").notNull(),
    acceptedByProfileId: uuid("accepted_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    actorType: varchar("actor_type", { length: 24 }).notNull(),
    acceptanceSource: varchar("acceptance_source", { length: 32 }).notNull(),
    acceptanceNote: text("acceptance_note"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    commercialSnapshot: jsonb("commercial_snapshot")
      .$type<JsonObject>()
      .notNull(),
    termsSnapshot: jsonb("terms_snapshot").$type<JsonObject>().notNull(),
    pricingSnapshot: jsonb("pricing_snapshot").$type<JsonObject>().notNull(),
    durationSnapshot: jsonb("duration_snapshot")
      .$type<JsonObject>()
      .notNull(),
    provenanceSnapshot: jsonb("provenance_snapshot")
      .$type<JsonObject>()
      .notNull(),
    safeMetadata: jsonb("safe_metadata")
      .$type<JsonObject>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "quote_acceptances_quote_provenance_fk",
      columns: [
        table.quoteId,
        table.requestId,
        table.customerId,
        table.propertyId,
      ],
      foreignColumns: [
        quotes.id,
        quotes.requestId,
        quotes.customerId,
        quotes.propertyId,
      ],
    }).onDelete("restrict"),
    uniqueIndex("quote_acceptances_quote_unique").on(table.quoteId),
    uniqueIndex("quote_acceptances_booking_provenance_unique").on(
      table.id,
      table.quoteId,
      table.requestId,
      table.customerId,
      table.propertyId,
    ),
    index("quote_acceptances_customer_accepted_idx").on(
      table.customerId,
      table.acceptedAt,
    ),
    check(
      "quote_acceptances_versions_positive",
      sql`${table.quoteVersion} >= 1 and ${table.quoteRecordVersion} >= 1 and ${table.sourceRequestVersion} >= 1`,
    ),
    check(
      "quote_acceptances_actor_type_valid",
      sql`${table.actorType} in ('CUSTOMER', 'STAFF_ON_BEHALF')`,
    ),
    check(
      "quote_acceptances_source_valid",
      sql`${table.acceptanceSource} in ('CUSTOMER_PORTAL', 'PHONE', 'EMAIL', 'IN_PERSON', 'OTHER_RECORDED')`,
    ),
    check(
      "quote_acceptances_actor_source_consistent",
      sql`(${table.actorType} = 'CUSTOMER' and ${table.acceptanceSource} = 'CUSTOMER_PORTAL' and ${table.acceptanceNote} is null) or (${table.actorType} = 'STAFF_ON_BEHALF' and ${table.acceptanceSource} <> 'CUSTOMER_PORTAL' and ${table.acceptanceNote} is not null and length(trim(${table.acceptanceNote})) > 0)`,
    ),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingReference: varchar("booking_reference", { length: 40 })
      .notNull()
      .unique(),
    requestId: uuid("request_id").notNull(),
    quoteId: uuid("quote_id").notNull(),
    quoteAcceptanceId: uuid("quote_acceptance_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    propertyId: uuid("property_id").notNull(),
    status: varchar("status", { length: 24 })
      .default("PENDING_SCHEDULING")
      .notNull(),
    schedulingStatus: varchar("scheduling_status", { length: 24 })
      .default("REVIEW_REQUIRED")
      .notNull(),
    preferredDate: date("preferred_date"),
    appointmentWindowCode: varchar("appointment_window_code", { length: 64 }),
    scheduledStart: timestamp("scheduled_start", { withTimezone: true }),
    scheduledEnd: timestamp("scheduled_end", { withTimezone: true }),
    assignedTeamId: integer("assigned_team_id").references(
      () => operationsTeams.id,
      { onDelete: "restrict" },
    ),
    assignedEquipmentResourceId: integer(
      "assigned_equipment_resource_id",
    ).references(() => equipmentResources.id, { onDelete: "restrict" }),
    priceSnapshot: jsonb("price_snapshot").$type<JsonObject>().notNull(),
    durationSnapshot: jsonb("duration_snapshot").$type<JsonObject>().notNull(),
    schedulingSnapshot: jsonb("scheduling_snapshot")
      .$type<JsonObject>()
      .notNull(),
    customerSnapshot: jsonb("customer_snapshot").$type<JsonObject>().notNull(),
    propertySnapshot: jsonb("property_snapshot").$type<JsonObject>().notNull(),
    customerNotesSnapshot: text("customer_notes_snapshot"),
    internalNotes: text("internal_notes"),
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
    updatedByProfileId: uuid("updated_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByProfileId: uuid("cancelled_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    cancellationReasonCategory: varchar("cancellation_reason_category", {
      length: 32,
    }),
    cancellationReasonText: text("cancellation_reason_text"),
  },
  (table) => [
    foreignKey({
      name: "bookings_acceptance_provenance_fk",
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
    uniqueIndex("bookings_quote_unique").on(table.quoteId),
    uniqueIndex("bookings_acceptance_unique").on(table.quoteAcceptanceId),
    uniqueIndex("bookings_reference_unique").on(table.bookingReference),
    uniqueIndex("bookings_id_customer_property_unique").on(
      table.id,
      table.customerId,
      table.propertyId,
    ),
    index("bookings_customer_status_idx").on(
      table.customerId,
      table.status,
      table.createdAt,
    ),
    index("bookings_staff_schedule_idx").on(
      table.schedulingStatus,
      table.scheduledStart,
      table.createdAt,
    ),
    check(
      "bookings_reference_valid",
      sql`${table.bookingReference} ~ '^BKG-[A-F0-9]{24}$'`,
    ),
    check(
      "bookings_status_valid",
      sql`${table.status} in ('PENDING_SCHEDULING', 'CONFIRMED', 'CANCELLED')`,
    ),
    check(
      "bookings_scheduling_status_valid",
      sql`${table.schedulingStatus} in ('UNSCHEDULED', 'REVIEW_REQUIRED', 'SCHEDULED')`,
    ),
    check("bookings_version_positive", sql`${table.version} >= 1`),
    check(
      "bookings_schedule_interval_consistent",
      sql`(${table.scheduledStart} is null and ${table.scheduledEnd} is null and ${table.assignedTeamId} is null and ${table.assignedEquipmentResourceId} is null) or (${table.scheduledStart} is not null and ${table.scheduledEnd} is not null and ${table.scheduledEnd} > ${table.scheduledStart} and ${table.assignedTeamId} is not null)`,
    ),
    check(
      "bookings_scheduling_lifecycle_consistent",
      sql`(${table.schedulingStatus} = 'SCHEDULED' and ${table.scheduledStart} is not null and ${table.scheduledEnd} is not null and ${table.assignedTeamId} is not null) or (${table.schedulingStatus} <> 'SCHEDULED' and ${table.scheduledStart} is null and ${table.scheduledEnd} is null and ${table.assignedTeamId} is null and ${table.assignedEquipmentResourceId} is null)`,
    ),
    check(
      "bookings_status_schedule_consistent",
      sql`(${table.status} = 'PENDING_SCHEDULING' and ${table.schedulingStatus} <> 'SCHEDULED') or (${table.status} = 'CONFIRMED' and ${table.schedulingStatus} = 'SCHEDULED') or ${table.status} = 'CANCELLED'`,
    ),
    check(
      "bookings_cancellation_consistent",
      sql`(${table.status} = 'CANCELLED' and ${table.cancelledAt} is not null and ${table.cancellationReasonCategory} is not null) or (${table.status} <> 'CANCELLED' and ${table.cancelledAt} is null and ${table.cancelledByProfileId} is null and ${table.cancellationReasonCategory} is null and ${table.cancellationReasonText} is null)`,
    ),
    check(
      "bookings_cancellation_category_valid",
      sql`${table.cancellationReasonCategory} is null or ${table.cancellationReasonCategory} in ('CUSTOMER_REQUEST', 'OPERATIONAL', 'DUPLICATE', 'OTHER')`,
    ),
    check(
      "bookings_notes_not_blank",
      sql`(${table.customerNotesSnapshot} is null or length(trim(${table.customerNotesSnapshot})) > 0) and (${table.internalNotes} is null or length(trim(${table.internalNotes})) > 0) and (${table.cancellationReasonText} is null or length(trim(${table.cancellationReasonText})) > 0)`,
    ),
  ],
);

export const bookingItems = pgTable(
  "booking_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    quoteItemId: uuid("quote_item_id")
      .notNull()
      .references(() => quoteItems.id, { onDelete: "restrict" }),
    requestItemId: uuid("request_item_id").references(
      () => serviceRequestItems.id,
      { onDelete: "restrict" },
    ),
    serviceId: integer("service_id"),
    cleaningItemTypeId: integer("cleaning_item_type_id"),
    measurementModeId: integer("measurement_mode_id"),
    descriptionBg: text("description_bg").notNull(),
    descriptionEn: text("description_en").notNull(),
    quantity: integer("quantity").notNull(),
    measurementSnapshot: jsonb("measurement_snapshot")
      .$type<JsonObject>()
      .notNull(),
    baseAmountMinorUnits: integer("base_amount_minor_units").notNull(),
    modifierAmountMinorUnits: integer("modifier_amount_minor_units").notNull(),
    addonAmountMinorUnits: integer("addon_amount_minor_units").notNull(),
    netAmountMinorUnits: integer("net_amount_minor_units").notNull(),
    vatRateBasisPoints: integer("vat_rate_basis_points").notNull(),
    vatAmountMinorUnits: integer("vat_amount_minor_units").notNull(),
    grossTotalMinorUnits: integer("gross_total_minor_units").notNull(),
    calculationSnapshot: jsonb("calculation_snapshot")
      .$type<JsonObject>()
      .notNull(),
    durationBasisSnapshot: jsonb("duration_basis_snapshot")
      .$type<JsonObject>()
      .notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("booking_items_booking_sort_unique").on(
      table.bookingId,
      table.sortOrder,
    ),
    uniqueIndex("booking_items_booking_quote_item_unique").on(
      table.bookingId,
      table.quoteItemId,
    ),
    uniqueIndex("booking_items_id_booking_unique").on(
      table.id,
      table.bookingId,
    ),
    index("booking_items_booking_idx").on(table.bookingId),
    check(
      "booking_items_descriptions_not_blank",
      sql`length(trim(${table.descriptionBg})) > 0 and length(trim(${table.descriptionEn})) > 0`,
    ),
    check("booking_items_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "booking_items_amounts_consistent",
      sql`${table.baseAmountMinorUnits} >= 0 and ${table.addonAmountMinorUnits} >= 0 and ${table.netAmountMinorUnits} = ${table.baseAmountMinorUnits} + ${table.modifierAmountMinorUnits} + ${table.addonAmountMinorUnits} and ${table.netAmountMinorUnits} >= 0 and ${table.vatAmountMinorUnits} >= 0 and ${table.grossTotalMinorUnits} = ${table.netAmountMinorUnits} + ${table.vatAmountMinorUnits}`,
    ),
    check(
      "booking_items_vat_rate_valid",
      sql`${table.vatRateBasisPoints} between 0 and 10000`,
    ),
    check("booking_items_sort_nonnegative", sql`${table.sortOrder} >= 0`),
  ],
);

export const bookingOccupancies = pgTable(
  "booking_occupancies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    snapshotVersion: integer("snapshot_version").notNull(),
    previousOccupancyId: uuid("previous_occupancy_id"),
    teamId: integer("team_id")
      .notNull()
      .references(() => operationsTeams.id, { onDelete: "restrict" }),
    equipmentResourceId: integer("equipment_resource_id").references(
      () => equipmentResources.id,
      { onDelete: "restrict" },
    ),
    serviceStart: timestamp("service_start", { withTimezone: true }).notNull(),
    serviceEnd: timestamp("service_end", { withTimezone: true }).notNull(),
    operationalStart: timestamp("operational_start", {
      withTimezone: true,
    }).notNull(),
    operationalEnd: timestamp("operational_end", {
      withTimezone: true,
    }).notNull(),
    timeZone: varchar("time_zone", { length: 64 })
      .default("Europe/Sofia")
      .notNull(),
    status: varchar("status", { length: 16 }).default("CONFIRMED").notNull(),
    serviceDurationMinutes: integer("service_duration_minutes").notNull(),
    requiredEquipmentCapabilityCode: varchar(
      "required_equipment_capability_code",
      { length: 64 },
    ),
    schedulingPolicyCode: varchar("scheduling_policy_code", {
      length: 96,
    }).notNull(),
    schedulingPolicyVersion: integer("scheduling_policy_version").notNull(),
    workingHourPolicyId: integer("working_hour_policy_id")
      .notNull()
      .references(() => workingHourPolicies.id, { onDelete: "restrict" }),
    workingHourPolicyCode: varchar("working_hour_policy_code", {
      length: 96,
    }).notNull(),
    workingHourPolicyVersion: integer(
      "working_hour_policy_version",
    ).notNull(),
    travelTimeProfileId: integer("travel_time_profile_id")
      .notNull()
      .references(() => travelTimeProfiles.id, { onDelete: "restrict" }),
    travelTimeProfileCode: varchar("travel_time_profile_code", {
      length: 96,
    }).notNull(),
    travelTimeProfileVersion: integer(
      "travel_time_profile_version",
    ).notNull(),
    durationSnapshot: jsonb("duration_snapshot").$type<JsonObject>().notNull(),
    locationSnapshot: jsonb("location_snapshot").$type<JsonObject>().notNull(),
    requirementsSnapshot: jsonb("requirements_snapshot")
      .$type<JsonObject>()
      .notNull(),
    availabilityInputSnapshot: jsonb("availability_input_snapshot")
      .$type<JsonObject>()
      .notNull(),
    availabilityResultSnapshot: jsonb("availability_result_snapshot")
      .$type<JsonObject>()
      .notNull(),
    travelSnapshot: jsonb("travel_snapshot").$type<JsonObject>().notNull(),
    workingHoursSnapshot: jsonb("working_hours_snapshot")
      .$type<JsonObject>()
      .notNull(),
    equipmentSnapshot: jsonb("equipment_snapshot")
      .$type<JsonObject>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdByProfileId: uuid("created_by_profile_id").references(
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
      name: "booking_occupancies_previous_fk",
      columns: [table.previousOccupancyId],
      foreignColumns: [table.id],
    }).onDelete("restrict"),
    uniqueIndex("booking_occupancies_booking_version_unique").on(
      table.bookingId,
      table.snapshotVersion,
    ),
    uniqueIndex("booking_occupancies_id_booking_version_team_unique").on(
      table.id,
      table.bookingId,
      table.snapshotVersion,
      table.teamId,
    ),
    uniqueIndex("booking_occupancies_blocking_booking_unique")
      .on(table.bookingId)
      .where(sql`${table.status} in ('PENDING', 'CONFIRMED')`),
    index("booking_occupancies_team_time_idx").on(
      table.teamId,
      table.operationalStart,
      table.operationalEnd,
    ),
    index("booking_occupancies_equipment_time_idx").on(
      table.equipmentResourceId,
      table.operationalStart,
      table.operationalEnd,
    ),
    check(
      "booking_occupancies_status_valid",
      sql`${table.status} in ('PENDING', 'CONFIRMED', 'CANCELLED')`,
    ),
    check(
      "booking_occupancies_intervals_valid",
      sql`${table.serviceEnd} > ${table.serviceStart} and ${table.operationalEnd} > ${table.operationalStart} and ${table.operationalStart} <= ${table.serviceStart} and ${table.operationalEnd} >= ${table.serviceEnd} and extract(epoch from (${table.serviceEnd} - ${table.serviceStart})) / 60 = ${table.serviceDurationMinutes}`,
    ),
    check(
      "booking_occupancies_versions_positive",
      sql`${table.snapshotVersion} >= 1 and ${table.serviceDurationMinutes} > 0 and ${table.schedulingPolicyVersion} >= 1 and ${table.workingHourPolicyVersion} >= 1 and ${table.travelTimeProfileVersion} >= 1`,
    ),
    check(
      "booking_occupancies_time_zone_sofia",
      sql`${table.timeZone} = 'Europe/Sofia'`,
    ),
    check(
      "booking_occupancies_equipment_consistent",
      sql`(${table.equipmentResourceId} is null and ${table.requiredEquipmentCapabilityCode} is null) or (${table.equipmentResourceId} is not null and ${table.requiredEquipmentCapabilityCode} is not null and length(trim(${table.requiredEquipmentCapabilityCode})) > 0)`,
    ),
    check(
      "booking_occupancies_cancellation_consistent",
      sql`(${table.status} in ('PENDING', 'CONFIRMED') and ${table.cancelledAt} is null and ${table.cancelledByProfileId} is null) or (${table.status} = 'CANCELLED' and ${table.cancelledAt} is not null)`,
    ),
  ],
);

export const bookingAuditEvents = pgTable(
  "booking_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    quoteAcceptanceId: uuid("quote_acceptance_id")
      .notNull()
      .references(() => quoteAcceptances.id, { onDelete: "restrict" }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    actorProfileId: uuid("actor_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
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
    uniqueIndex("booking_audit_events_correlation_unique").on(
      table.correlationId,
    ),
    index("booking_audit_events_booking_timeline_idx").on(
      table.bookingId,
      table.createdAt,
    ),
    index("booking_audit_events_type_created_idx").on(
      table.eventType,
      table.createdAt,
    ),
    check(
      "booking_audit_events_type_valid",
      sql`${table.eventType} in ('QUOTE_ACCEPTED', 'BOOKING_CREATED', 'BOOKING_SCHEDULED', 'BOOKING_CANCELLED', 'TEAM_ASSIGNED')`,
    ),
    check(
      "booking_audit_events_source_valid",
      sql`${table.source} in ('CUSTOMER_PORTAL', 'STAFF', 'SYSTEM')`,
    ),
  ],
);
