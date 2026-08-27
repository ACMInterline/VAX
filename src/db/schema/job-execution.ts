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
import { operationsTeams, equipmentResources } from "./availability-engine";
import { bookingItems, bookingOccupancies, bookings } from "./booking-engine";
import { cleaningAssets, customers, properties } from "./customer-crm";
import { userProfiles } from "./identity-access";
import {
  cleaningItemTypes,
  cleaningProducts,
  conditionLevels,
  fibreMaterials,
  issueTypes,
  mechanicalActionLevels,
  measurementModes,
  riskFlags,
  serviceAddons,
  services,
  surfaceConstructions,
  treatmentApproaches,
  treatmentLevels,
} from "./service-catalogue";

type JsonObject = Record<string, unknown>;

export const teamMemberships = pgTable(
  "team_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userProfileId: uuid("user_profile_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "restrict" }),
    teamId: integer("team_id")
      .notNull()
      .references(() => operationsTeams.id, { onDelete: "restrict" }),
    active: boolean("active").default(true).notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true })
      .defaultNow()
      .notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true }),
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
  },
  (table) => [
    uniqueIndex("team_memberships_active_pair_unique")
      .on(table.userProfileId, table.teamId)
      .where(sql`${table.active} = true`),
    index("team_memberships_profile_active_idx").on(
      table.userProfileId,
      table.active,
      table.validFrom,
      table.validUntil,
    ),
    index("team_memberships_team_active_idx").on(
      table.teamId,
      table.active,
      table.validFrom,
      table.validUntil,
    ),
    check(
      "team_memberships_window_valid",
      sql`${table.validUntil} is null or ${table.validUntil} >= ${table.validFrom}`,
    ),
    check(
      "team_memberships_inactive_has_end",
      sql`${table.active} = true or ${table.validUntil} is not null`,
    ),
    check("team_memberships_version_positive", sql`${table.version} >= 1`),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobReference: varchar("job_reference", { length: 40 }).notNull(),
    bookingId: uuid("booking_id").notNull(),
    sourceBookingVersion: integer("source_booking_version").notNull(),
    sourceOccupancyId: uuid("source_occupancy_id"),
    sourceOccupancySnapshotVersion: integer(
      "source_occupancy_snapshot_version",
    ),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    assignedTeamId: integer("assigned_team_id").references(
      () => operationsTeams.id,
      { onDelete: "restrict" },
    ),
    assignedEquipmentResourceId: integer(
      "assigned_equipment_resource_id",
    ).references(() => equipmentResources.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 24 }).default("PREPARED").notNull(),
    scheduledStartSnapshot: timestamp("scheduled_start_snapshot", {
      withTimezone: true,
    }),
    scheduledEndSnapshot: timestamp("scheduled_end_snapshot", {
      withTimezone: true,
    }),
    plannedServiceDurationMinutes: integer(
      "planned_service_duration_minutes",
    ).notNull(),
    plannedTeamSize: integer("planned_team_size"),
    sourceProvenanceSnapshot: jsonb("source_provenance_snapshot")
      .$type<JsonObject>()
      .notNull(),
    schedulingSnapshot: jsonb("scheduling_snapshot")
      .$type<JsonObject>()
      .notNull(),
    plannedDurationSnapshot: jsonb("planned_duration_snapshot")
      .$type<JsonObject>()
      .notNull(),
    propertyAccessSnapshot: jsonb("property_access_snapshot")
      .$type<JsonObject>()
      .notNull(),
    visitContactSnapshot: jsonb("visit_contact_snapshot").$type<JsonObject>(),
    enRouteAt: timestamp("en_route_at", { withTimezone: true }),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    actualProductiveMinutes: integer("actual_productive_minutes"),
    actualOccupiedTeamMinutes: integer("actual_occupied_team_minutes"),
    reviewReasonCode: varchar("review_reason_code", { length: 64 }),
    reviewReasonText: text("review_reason_text"),
    internalCompletionNotes: text("internal_completion_notes"),
    customerVisibleCompletionNotes: text(
      "customer_visible_completion_notes",
    ),
    completionSnapshot: jsonb("completion_snapshot").$type<JsonObject>(),
    cancellationReasonCategory: varchar("cancellation_reason_category", {
      length: 32,
    }),
    cancellationReasonText: text("cancellation_reason_text"),
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
    completedByProfileId: uuid("completed_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    cancelledByProfileId: uuid("cancelled_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [
    foreignKey({
      name: "jobs_booking_provenance_fk",
      columns: [table.bookingId, table.customerId, table.propertyId],
      foreignColumns: [bookings.id, bookings.customerId, bookings.propertyId],
    }).onDelete("restrict"),
    foreignKey({
      name: "jobs_booking_occupancy_provenance_fk",
      columns: [
        table.sourceOccupancyId,
        table.bookingId,
        table.sourceOccupancySnapshotVersion,
        table.assignedTeamId,
      ],
      foreignColumns: [
        bookingOccupancies.id,
        bookingOccupancies.bookingId,
        bookingOccupancies.snapshotVersion,
        bookingOccupancies.teamId,
      ],
    }).onDelete("restrict"),
    uniqueIndex("jobs_reference_unique").on(table.jobReference),
    uniqueIndex("jobs_booking_unique").on(table.bookingId),
    uniqueIndex("jobs_id_booking_property_unique").on(
      table.id,
      table.bookingId,
      table.propertyId,
    ),
    uniqueIndex("jobs_id_customer_unique").on(table.id, table.customerId),
    index("jobs_staff_status_schedule_idx").on(
      table.status,
      table.scheduledStartSnapshot,
      table.createdAt,
    ),
    index("jobs_team_status_schedule_idx").on(
      table.assignedTeamId,
      table.status,
      table.scheduledStartSnapshot,
    ),
    index("jobs_customer_created_idx").on(
      table.customerId,
      table.createdAt,
    ),
    index("jobs_property_created_idx").on(
      table.propertyId,
      table.createdAt,
    ),
    check("jobs_reference_valid", sql`${table.jobReference} ~ '^JOB-[A-F0-9]{24}$'`),
    check(
      "jobs_status_valid",
      sql`${table.status} in ('PREPARED', 'READY', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'REQUIRES_REVIEW', 'COMPLETED', 'CANCELLED')`,
    ),
    check(
      "jobs_versions_and_planning_positive",
      sql`${table.sourceBookingVersion} >= 1 and ${table.version} >= 1 and ${table.plannedServiceDurationMinutes} > 0 and (${table.sourceOccupancySnapshotVersion} is null or ${table.sourceOccupancySnapshotVersion} >= 1) and (${table.plannedTeamSize} is null or ${table.plannedTeamSize} > 0)`,
    ),
    check(
      "jobs_schedule_snapshot_consistent",
      sql`(${table.scheduledStartSnapshot} is null and ${table.scheduledEndSnapshot} is null) or (${table.scheduledStartSnapshot} is not null and ${table.scheduledEndSnapshot} is not null and ${table.scheduledEndSnapshot} > ${table.scheduledStartSnapshot})`,
    ),
    check(
      "jobs_executable_context_present",
      sql`${table.status} in ('PREPARED', 'REQUIRES_REVIEW', 'CANCELLED') or (${table.sourceOccupancyId} is not null and ${table.sourceOccupancySnapshotVersion} is not null and ${table.assignedTeamId} is not null and ${table.scheduledStartSnapshot} is not null and ${table.scheduledEndSnapshot} is not null)`,
    ),
    check(
      "jobs_source_occupancy_fields_consistent",
      sql`(${table.sourceOccupancyId} is null and ${table.sourceOccupancySnapshotVersion} is null) or (${table.sourceOccupancyId} is not null and ${table.sourceOccupancySnapshotVersion} is not null and ${table.assignedTeamId} is not null)`,
    ),
    check(
      "jobs_equipment_requires_team",
      sql`${table.assignedEquipmentResourceId} is null or ${table.assignedTeamId} is not null`,
    ),
    check(
      "jobs_operational_timestamps_ordered",
      sql`(${table.arrivedAt} is null or (${table.enRouteAt} is not null and ${table.arrivedAt} >= ${table.enRouteAt})) and (${table.startedAt} is null or (${table.arrivedAt} is not null and ${table.startedAt} >= ${table.arrivedAt})) and (${table.completedAt} is null or (${table.startedAt} is not null and ${table.completedAt} >= ${table.startedAt}))`,
    ),
    check(
      "jobs_status_timestamps_consistent",
      sql`(${table.status} in ('PREPARED', 'READY') and ${table.enRouteAt} is null and ${table.arrivedAt} is null and ${table.startedAt} is null and ${table.completedAt} is null and ${table.cancelledAt} is null) or (${table.status} = 'EN_ROUTE' and ${table.enRouteAt} is not null and ${table.arrivedAt} is null and ${table.startedAt} is null and ${table.completedAt} is null and ${table.cancelledAt} is null) or (${table.status} = 'ARRIVED' and ${table.enRouteAt} is not null and ${table.arrivedAt} is not null and ${table.startedAt} is null and ${table.completedAt} is null and ${table.cancelledAt} is null) or (${table.status} = 'IN_PROGRESS' and ${table.enRouteAt} is not null and ${table.arrivedAt} is not null and ${table.startedAt} is not null and ${table.completedAt} is null and ${table.cancelledAt} is null) or (${table.status} = 'REQUIRES_REVIEW' and ${table.completedAt} is null and ${table.cancelledAt} is null) or (${table.status} = 'COMPLETED' and ${table.enRouteAt} is not null and ${table.arrivedAt} is not null and ${table.startedAt} is not null and ${table.completedAt} is not null and ${table.cancelledAt} is null) or (${table.status} = 'CANCELLED' and ${table.startedAt} is null and ${table.completedAt} is null and ${table.cancelledAt} is not null)`,
    ),
    check(
      "jobs_review_reason_consistent",
      sql`(${table.status} = 'REQUIRES_REVIEW' and ${table.reviewReasonCode} is not null and length(trim(${table.reviewReasonCode})) > 0) or (${table.status} <> 'REQUIRES_REVIEW' and ${table.reviewReasonCode} is null and ${table.reviewReasonText} is null)`,
    ),
    check(
      "jobs_completion_consistent",
      sql`(${table.status} = 'COMPLETED' and ${table.actualProductiveMinutes} is not null and ${table.actualOccupiedTeamMinutes} is not null and ${table.actualProductiveMinutes} >= 0 and ${table.actualOccupiedTeamMinutes} >= ${table.actualProductiveMinutes} and ${table.internalCompletionNotes} is not null and length(trim(${table.internalCompletionNotes})) > 0 and ${table.completionSnapshot} is not null) or (${table.status} <> 'COMPLETED' and ${table.completedAt} is null and ${table.completedByProfileId} is null and ${table.actualProductiveMinutes} is null and ${table.actualOccupiedTeamMinutes} is null and ${table.internalCompletionNotes} is null and ${table.customerVisibleCompletionNotes} is null and ${table.completionSnapshot} is null)`,
    ),
    check(
      "jobs_cancellation_consistent",
      sql`(${table.status} = 'CANCELLED' and ${table.cancellationReasonCategory} is not null) or (${table.status} <> 'CANCELLED' and ${table.cancelledAt} is null and ${table.cancelledByProfileId} is null and ${table.cancellationReasonCategory} is null and ${table.cancellationReasonText} is null)`,
    ),
    check(
      "jobs_cancellation_category_valid",
      sql`${table.cancellationReasonCategory} is null or ${table.cancellationReasonCategory} in ('CUSTOMER_REQUEST', 'OPERATIONAL', 'DUPLICATE', 'SAFETY', 'OTHER')`,
    ),
    check(
      "jobs_optional_text_not_blank",
      sql`(${table.reviewReasonText} is null or length(trim(${table.reviewReasonText})) > 0) and (${table.customerVisibleCompletionNotes} is null or length(trim(${table.customerVisibleCompletionNotes})) > 0) and (${table.cancellationReasonText} is null or length(trim(${table.cancellationReasonText})) > 0)`,
    ),
  ],
);

export const jobItems = pgTable(
  "job_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").notNull(),
    bookingId: uuid("booking_id").notNull(),
    propertyId: uuid("property_id").notNull(),
    bookingItemId: uuid("booking_item_id").notNull(),
    sourceRequestItemId: uuid("source_request_item_id").notNull(),
    sourceRequestItemVersion: integer("source_request_item_version").notNull(),
    cleaningAssetId: uuid("cleaning_asset_id").references(
      () => cleaningAssets.id,
      { onDelete: "restrict" },
    ),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    cleaningItemTypeId: integer("cleaning_item_type_id")
      .notNull()
      .references(() => cleaningItemTypes.id, { onDelete: "restrict" }),
    measurementModeId: integer("measurement_mode_id")
      .notNull()
      .references(() => measurementModes.id, { onDelete: "restrict" }),
    customerReportedConditionLevelId: integer(
      "customer_reported_condition_level_id",
    ).references(() => conditionLevels.id, { onDelete: "restrict" }),
    staffNormalizedConditionLevelId: integer(
      "staff_normalized_condition_level_id",
    ).references(() => conditionLevels.id, { onDelete: "restrict" }),
    customerReportedFibreMaterialId: integer(
      "customer_reported_fibre_material_id",
    ).references(() => fibreMaterials.id, { onDelete: "restrict" }),
    staffNormalizedFibreMaterialId: integer(
      "staff_normalized_fibre_material_id",
    ).references(() => fibreMaterials.id, { onDelete: "restrict" }),
    customerReportedSurfaceConstructionId: integer(
      "customer_reported_surface_construction_id",
    ).references(() => surfaceConstructions.id, { onDelete: "restrict" }),
    staffNormalizedSurfaceConstructionId: integer(
      "staff_normalized_surface_construction_id",
    ).references(() => surfaceConstructions.id, { onDelete: "restrict" }),
    customerVisibleDescriptionBg: text("customer_visible_description_bg")
      .notNull(),
    customerVisibleDescriptionEn: text("customer_visible_description_en")
      .notNull(),
    customerDescriptionSnapshot: text("customer_description_snapshot"),
    staffNormalizedDescriptionSnapshot: text(
      "staff_normalized_description_snapshot",
    ),
    quantity: integer("quantity").notNull(),
    areaHundredthsM2: integer("area_hundredths_m2"),
    seatCount: integer("seat_count"),
    sides: integer("sides"),
    plannedMeasurementSnapshot: jsonb("planned_measurement_snapshot")
      .$type<JsonObject>()
      .notNull(),
    plannedTreatmentAssumptionsSnapshot: jsonb(
      "planned_treatment_assumptions_snapshot",
    )
      .$type<JsonObject>()
      .notNull(),
    sourceScopeSnapshot: jsonb("source_scope_snapshot")
      .$type<JsonObject>()
      .notNull(),
    status: varchar("status", { length: 32 })
      .default("PENDING_INSPECTION")
      .notNull(),
    sortOrder: integer("sort_order").notNull(),
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
    foreignKey({
      name: "job_items_job_provenance_fk",
      columns: [table.jobId, table.bookingId, table.propertyId],
      foreignColumns: [jobs.id, jobs.bookingId, jobs.propertyId],
    }).onDelete("restrict"),
    foreignKey({
      name: "job_items_booking_item_provenance_fk",
      columns: [table.bookingItemId, table.bookingId],
      foreignColumns: [bookingItems.id, bookingItems.bookingId],
    }).onDelete("restrict"),
    foreignKey({
      name: "job_items_cleaning_asset_property_fk",
      columns: [table.cleaningAssetId, table.propertyId],
      foreignColumns: [cleaningAssets.id, cleaningAssets.propertyId],
    }).onDelete("restrict"),
    uniqueIndex("job_items_id_job_unique").on(table.id, table.jobId),
    uniqueIndex("job_items_id_job_booking_item_unique").on(
      table.id,
      table.jobId,
      table.bookingItemId,
    ),
    uniqueIndex("job_items_id_job_asset_unique").on(
      table.id,
      table.jobId,
      table.cleaningAssetId,
    ),
    uniqueIndex("job_items_booking_item_unique").on(table.bookingItemId),
    uniqueIndex("job_items_job_sort_unique").on(table.jobId, table.sortOrder),
    index("job_items_job_status_idx").on(table.jobId, table.status),
    index("job_items_asset_created_idx")
      .on(table.cleaningAssetId, table.createdAt)
      .where(sql`${table.cleaningAssetId} is not null`),
    check(
      "job_items_status_valid",
      sql`${table.status} in ('PENDING_INSPECTION', 'INSPECTED', 'TREATMENT_CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'REFERRED', 'REQUIRES_REVIEW')`,
    ),
    check(
      "job_items_versions_quantity_sort_valid",
      sql`${table.sourceRequestItemVersion} >= 1 and ${table.quantity} > 0 and ${table.sortOrder} >= 0 and ${table.version} >= 1 and (${table.areaHundredthsM2} is null or ${table.areaHundredthsM2} > 0) and (${table.seatCount} is null or ${table.seatCount} > 0) and (${table.sides} is null or ${table.sides} in (1, 2))`,
    ),
    check(
      "job_items_descriptions_not_blank",
      sql`length(trim(${table.customerVisibleDescriptionBg})) > 0 and length(trim(${table.customerVisibleDescriptionEn})) > 0 and (${table.customerDescriptionSnapshot} is null or length(trim(${table.customerDescriptionSnapshot})) > 0) and (${table.staffNormalizedDescriptionSnapshot} is null or length(trim(${table.staffNormalizedDescriptionSnapshot})) > 0)`,
    ),
  ],
);

export const jobItemInspections = pgTable(
  "job_item_inspections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").notNull(),
    jobItemId: uuid("job_item_id").notNull(),
    sourceJobItemVersion: integer("source_job_item_version").notNull(),
    observedCleaningItemTypeId: integer("observed_cleaning_item_type_id")
      .notNull()
      .references(() => cleaningItemTypes.id, { onDelete: "restrict" }),
    observedMeasurementModeId: integer("observed_measurement_mode_id")
      .notNull()
      .references(() => measurementModes.id, { onDelete: "restrict" }),
    observedQuantity: integer("observed_quantity").notNull(),
    observedAreaHundredthsM2: integer("observed_area_hundredths_m2"),
    observedSeatCount: integer("observed_seat_count"),
    observedSides: integer("observed_sides"),
    observedConditionLevelId: integer("observed_condition_level_id")
      .notNull()
      .references(() => conditionLevels.id, { onDelete: "restrict" }),
    confirmedFibreMaterialId: integer("confirmed_fibre_material_id")
      .notNull()
      .references(() => fibreMaterials.id, { onDelete: "restrict" }),
    confirmedSurfaceConstructionId: integer(
      "confirmed_surface_construction_id",
    )
      .notNull()
      .references(() => surfaceConstructions.id, { onDelete: "restrict" }),
    observedMeasurementSnapshot: jsonb("observed_measurement_snapshot")
      .$type<JsonObject>()
      .notNull(),
    existingDamagePresent: boolean("existing_damage_present")
      .default(false)
      .notNull(),
    existingDamageNotes: text("existing_damage_notes"),
    colourfastnessConcern: boolean("colourfastness_concern")
      .default(false)
      .notNull(),
    moistureSensitivity: boolean("moisture_sensitivity")
      .default(false)
      .notNull(),
    unsafeContaminationObserved: boolean("unsafe_contamination_observed")
      .default(false)
      .notNull(),
    unsafeStructuralConditionObserved: boolean(
      "unsafe_structural_condition_observed",
    )
      .default(false)
      .notNull(),
    treatmentFeasibility: varchar("treatment_feasibility", {
      length: 32,
    }).notNull(),
    internalTechnicianNotes: text("internal_technician_notes"),
    inspectedAt: timestamp("inspected_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    inspectedByProfileId: uuid("inspected_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [
    foreignKey({
      name: "job_item_inspections_item_scope_fk",
      columns: [table.jobItemId, table.jobId],
      foreignColumns: [jobItems.id, jobItems.jobId],
    }).onDelete("restrict"),
    uniqueIndex("job_item_inspections_item_unique").on(table.jobItemId),
    uniqueIndex("job_item_inspections_id_item_job_unique").on(
      table.id,
      table.jobItemId,
      table.jobId,
    ),
    index("job_item_inspections_job_time_idx").on(
      table.jobId,
      table.inspectedAt,
    ),
    check(
      "job_item_inspections_source_version_positive",
      sql`${table.sourceJobItemVersion} >= 1`,
    ),
    check(
      "job_item_inspections_measurements_valid",
      sql`${table.observedQuantity} > 0 and (${table.observedAreaHundredthsM2} is null or ${table.observedAreaHundredthsM2} > 0) and (${table.observedSeatCount} is null or ${table.observedSeatCount} > 0) and (${table.observedSides} is null or ${table.observedSides} in (1, 2))`,
    ),
    check(
      "job_item_inspections_feasibility_valid",
      sql`${table.treatmentFeasibility} in ('FEASIBLE', 'CONDITIONAL', 'NOT_FEASIBLE', 'SPECIALIST_REVIEW')`,
    ),
    check(
      "job_item_inspections_damage_consistent",
      sql`(${table.existingDamagePresent} = true and ${table.existingDamageNotes} is not null and length(trim(${table.existingDamageNotes})) > 0) or (${table.existingDamagePresent} = false and ${table.existingDamageNotes} is null)`,
    ),
    check(
      "job_item_inspections_unsafe_not_feasible",
      sql`(${table.unsafeContaminationObserved} = false and ${table.unsafeStructuralConditionObserved} = false) or ${table.treatmentFeasibility} = 'NOT_FEASIBLE'`,
    ),
    check(
      "job_item_inspections_notes_not_blank",
      sql`${table.internalTechnicianNotes} is null or length(trim(${table.internalTechnicianNotes})) > 0`,
    ),
  ],
);

export const jobItemInspectionIssues = pgTable(
  "job_item_inspection_issues",
  {
    inspectionId: uuid("inspection_id").notNull(),
    jobItemId: uuid("job_item_id").notNull(),
    jobId: uuid("job_id").notNull(),
    issueTypeId: integer("issue_type_id")
      .notNull()
      .references(() => issueTypes.id, { onDelete: "restrict" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "job_item_inspection_issues_scope_fk",
      columns: [table.inspectionId, table.jobItemId, table.jobId],
      foreignColumns: [
        jobItemInspections.id,
        jobItemInspections.jobItemId,
        jobItemInspections.jobId,
      ],
    }).onDelete("restrict"),
    primaryKey({ columns: [table.inspectionId, table.issueTypeId] }),
    index("job_item_inspection_issues_job_idx").on(table.jobId),
    check(
      "job_item_inspection_issues_notes_not_blank",
      sql`${table.notes} is null or length(trim(${table.notes})) > 0`,
    ),
  ],
);

export const jobItemInspectionRisks = pgTable(
  "job_item_inspection_risks",
  {
    inspectionId: uuid("inspection_id").notNull(),
    jobItemId: uuid("job_item_id").notNull(),
    jobId: uuid("job_id").notNull(),
    riskFlagId: integer("risk_flag_id")
      .notNull()
      .references(() => riskFlags.id, { onDelete: "restrict" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "job_item_inspection_risks_scope_fk",
      columns: [table.inspectionId, table.jobItemId, table.jobId],
      foreignColumns: [
        jobItemInspections.id,
        jobItemInspections.jobItemId,
        jobItemInspections.jobId,
      ],
    }).onDelete("restrict"),
    primaryKey({ columns: [table.inspectionId, table.riskFlagId] }),
    index("job_item_inspection_risks_job_idx").on(table.jobId),
    check(
      "job_item_inspection_risks_notes_not_blank",
      sql`${table.notes} is null or length(trim(${table.notes})) > 0`,
    ),
  ],
);

export const jobItemTreatmentPlans = pgTable(
  "job_item_treatment_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").notNull(),
    jobItemId: uuid("job_item_id").notNull(),
    inspectionId: uuid("inspection_id").notNull(),
    sourceJobItemVersion: integer("source_job_item_version").notNull(),
    decision: varchar("decision", { length: 32 }).notNull(),
    treatmentLevelId: integer("treatment_level_id").references(
      () => treatmentLevels.id,
      { onDelete: "restrict" },
    ),
    mechanicalActionLevelId: integer(
      "mechanical_action_level_id",
    ).references(() => mechanicalActionLevels.id, { onDelete: "restrict" }),
    treatmentApproachId: integer("treatment_approach_id").references(
      () => treatmentApproaches.id,
      { onDelete: "restrict" },
    ),
    cleaningProductId: integer("cleaning_product_id").references(
      () => cleaningProducts.id,
      { onDelete: "restrict" },
    ),
    materialScopeChange: boolean("material_scope_change")
      .default(false)
      .notNull(),
    technicianRationale: text("technician_rationale").notNull(),
    internalTechnicianNotes: text("internal_technician_notes"),
    customerVisibleExplanation: text("customer_visible_explanation"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    confirmedByProfileId: uuid("confirmed_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [
    foreignKey({
      name: "job_item_treatment_plans_inspection_scope_fk",
      columns: [table.inspectionId, table.jobItemId, table.jobId],
      foreignColumns: [
        jobItemInspections.id,
        jobItemInspections.jobItemId,
        jobItemInspections.jobId,
      ],
    }).onDelete("restrict"),
    uniqueIndex("job_item_treatment_plans_item_unique").on(table.jobItemId),
    uniqueIndex("job_item_treatment_plans_id_item_job_unique").on(
      table.id,
      table.jobItemId,
      table.jobId,
    ),
    index("job_item_treatment_plans_job_time_idx").on(
      table.jobId,
      table.confirmedAt,
    ),
    check(
      "job_item_treatment_plans_source_version_positive",
      sql`${table.sourceJobItemVersion} >= 1`,
    ),
    check(
      "job_item_treatment_plans_decision_valid",
      sql`${table.decision} in ('PERFORM', 'PERFORM_WITH_LIMITATIONS', 'DECLINE', 'REFER', 'REQUIRES_REVIEW')`,
    ),
    check(
      "job_item_treatment_plans_technical_fields_consistent",
      sql`(${table.decision} in ('PERFORM', 'PERFORM_WITH_LIMITATIONS') and ${table.treatmentLevelId} is not null and ${table.mechanicalActionLevelId} is not null and ${table.treatmentApproachId} is not null) or (${table.decision} in ('DECLINE', 'REFER', 'REQUIRES_REVIEW') and ${table.treatmentLevelId} is null and ${table.mechanicalActionLevelId} is null and ${table.treatmentApproachId} is null and ${table.cleaningProductId} is null)`,
    ),
    check(
      "job_item_treatment_plans_material_change_review",
      sql`${table.materialScopeChange} = false or ${table.decision} = 'REQUIRES_REVIEW'`,
    ),
    check(
      "job_item_treatment_plans_text_not_blank",
      sql`length(trim(${table.technicianRationale})) > 0 and (${table.internalTechnicianNotes} is null or length(trim(${table.internalTechnicianNotes})) > 0) and (${table.customerVisibleExplanation} is null or length(trim(${table.customerVisibleExplanation})) > 0)`,
    ),
  ],
);

export const jobItemTreatmentPlanAddons = pgTable(
  "job_item_treatment_plan_addons",
  {
    treatmentPlanId: uuid("treatment_plan_id").notNull(),
    jobItemId: uuid("job_item_id").notNull(),
    jobId: uuid("job_id").notNull(),
    serviceAddonId: integer("service_addon_id")
      .notNull()
      .references(() => serviceAddons.id, { onDelete: "restrict" }),
    approvalSource: varchar("approval_source", { length: 24 })
      .default("ISSUED_QUOTE")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "job_item_treatment_plan_addons_scope_fk",
      columns: [table.treatmentPlanId, table.jobItemId, table.jobId],
      foreignColumns: [
        jobItemTreatmentPlans.id,
        jobItemTreatmentPlans.jobItemId,
        jobItemTreatmentPlans.jobId,
      ],
    }).onDelete("restrict"),
    primaryKey({ columns: [table.treatmentPlanId, table.serviceAddonId] }),
    index("job_item_treatment_plan_addons_job_idx").on(table.jobId),
    check(
      "job_item_treatment_plan_addons_source_valid",
      sql`${table.approvalSource} = 'ISSUED_QUOTE'`,
    ),
  ],
);

export const jobItemTreatmentExecutions = pgTable(
  "job_item_treatment_executions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").notNull(),
    jobItemId: uuid("job_item_id").notNull(),
    treatmentPlanId: uuid("treatment_plan_id").notNull(),
    status: varchar("status", { length: 16 })
      .default("IN_PROGRESS")
      .notNull(),
    performedTreatmentLevelId: integer("performed_treatment_level_id")
      .notNull()
      .references(() => treatmentLevels.id, { onDelete: "restrict" }),
    performedMechanicalActionLevelId: integer(
      "performed_mechanical_action_level_id",
    )
      .notNull()
      .references(() => mechanicalActionLevels.id, { onDelete: "restrict" }),
    performedTreatmentApproachId: integer(
      "performed_treatment_approach_id",
    )
      .notNull()
      .references(() => treatmentApproaches.id, { onDelete: "restrict" }),
    cleaningProductId: integer("cleaning_product_id").references(
      () => cleaningProducts.id,
      { onDelete: "restrict" },
    ),
    performedAddonsSnapshot: jsonb("performed_addons_snapshot")
      .$type<JsonObject>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    resultClassification: varchar("result_classification", { length: 40 }),
    internalTechnicianNotes: text("internal_technician_notes"),
    customerVisibleResultNotes: text("customer_visible_result_notes"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    performedByProfileId: uuid("performed_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    completedByProfileId: uuid("completed_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    completionSnapshot: jsonb("completion_snapshot").$type<JsonObject>(),
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
    foreignKey({
      name: "job_item_treatment_executions_plan_scope_fk",
      columns: [table.treatmentPlanId, table.jobItemId, table.jobId],
      foreignColumns: [
        jobItemTreatmentPlans.id,
        jobItemTreatmentPlans.jobItemId,
        jobItemTreatmentPlans.jobId,
      ],
    }).onDelete("restrict"),
    uniqueIndex("job_item_treatment_executions_plan_unique").on(
      table.treatmentPlanId,
    ),
    uniqueIndex("job_item_treatment_executions_item_unique").on(
      table.jobItemId,
    ),
    uniqueIndex("job_item_treatment_executions_id_item_job_unique").on(
      table.id,
      table.jobItemId,
      table.jobId,
    ),
    uniqueIndex(
      "job_item_treatment_executions_passport_provenance_unique",
    ).on(
      table.id,
      table.jobItemId,
      table.jobId,
      table.status,
      table.completedAt,
      table.resultClassification,
      table.performedTreatmentLevelId,
      table.performedMechanicalActionLevelId,
      table.performedTreatmentApproachId,
    ),
    index("job_item_treatment_executions_job_status_idx").on(
      table.jobId,
      table.status,
    ),
    check(
      "job_item_treatment_executions_status_valid",
      sql`${table.status} in ('IN_PROGRESS', 'COMPLETED')`,
    ),
    check(
      "job_item_treatment_executions_result_valid",
      sql`${table.resultClassification} is null or ${table.resultClassification} in ('COMPLETED_AS_PLANNED', 'COMPLETED_WITH_LIMITATIONS', 'PARTIAL_IMPROVEMENT', 'NO_OBSERVABLE_IMPROVEMENT', 'STOPPED_FOR_SAFETY')`,
    ),
    check(
      "job_item_treatment_executions_completion_consistent",
      sql`(${table.status} = 'IN_PROGRESS' and ${table.completedAt} is null and ${table.completedByProfileId} is null and ${table.resultClassification} is null and ${table.customerVisibleResultNotes} is null and ${table.completionSnapshot} is null) or (${table.status} = 'COMPLETED' and ${table.completedAt} is not null and ${table.completedAt} >= ${table.startedAt} and ${table.resultClassification} is not null and ${table.completionSnapshot} is not null)`,
    ),
    check(
      "job_item_treatment_executions_version_positive",
      sql`${table.version} >= 1`,
    ),
    check(
      "job_item_treatment_executions_notes_not_blank",
      sql`(${table.internalTechnicianNotes} is null or length(trim(${table.internalTechnicianNotes})) > 0) and (${table.customerVisibleResultNotes} is null or length(trim(${table.customerVisibleResultNotes})) > 0)`,
    ),
  ],
);

export const cleaningPassportEntries = pgTable(
  "cleaning_passport_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cleaningAssetId: uuid("cleaning_asset_id")
      .notNull()
      .references(() => cleaningAssets.id, { onDelete: "restrict" }),
    jobId: uuid("job_id").notNull(),
    jobItemId: uuid("job_item_id").notNull(),
    treatmentExecutionId: uuid("treatment_execution_id").notNull(),
    sourceExecutionStatus: varchar("source_execution_status", {
      length: 16,
    }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
    observedConditionLevelId: integer("observed_condition_level_id")
      .notNull()
      .references(() => conditionLevels.id, { onDelete: "restrict" }),
    treatmentLevelId: integer("treatment_level_id")
      .notNull()
      .references(() => treatmentLevels.id, { onDelete: "restrict" }),
    mechanicalActionLevelId: integer("mechanical_action_level_id")
      .notNull()
      .references(() => mechanicalActionLevels.id, { onDelete: "restrict" }),
    treatmentApproachId: integer("treatment_approach_id")
      .notNull()
      .references(() => treatmentApproaches.id, { onDelete: "restrict" }),
    resultClassification: varchar("result_classification", {
      length: 40,
    }).notNull(),
    customerVisibleServiceSummary: text(
      "customer_visible_service_summary",
    ).notNull(),
    customerVisibleConditionSummary: text(
      "customer_visible_condition_summary",
    ).notNull(),
    customerVisibleTreatmentSummary: text(
      "customer_visible_treatment_summary",
    ).notNull(),
    customerVisibleCareRecommendation: text(
      "customer_visible_care_recommendation",
    ),
    issuesTreatedSnapshot: jsonb("issues_treated_snapshot")
      .$type<JsonObject>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    risksNotedSnapshot: jsonb("risks_noted_snapshot")
      .$type<JsonObject>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    customerSafeSnapshot: jsonb("customer_safe_snapshot")
      .$type<JsonObject>()
      .notNull(),
    recommendedReviewDate: date("recommended_review_date"),
    suggestedIntervalMonths: integer("suggested_interval_months"),
    maintenanceRecommendationReason: text(
      "maintenance_recommendation_reason",
    ),
    maintenanceRecommendationSourceType: varchar(
      "maintenance_recommendation_source_type",
      { length: 32 },
    ),
    performedByProfileId: uuid("performed_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "cleaning_passport_entries_item_asset_scope_fk",
      columns: [table.jobItemId, table.jobId, table.cleaningAssetId],
      foreignColumns: [jobItems.id, jobItems.jobId, jobItems.cleaningAssetId],
    }).onDelete("restrict"),
    foreignKey({
      name: "cleaning_passport_entries_execution_scope_fk",
      columns: [
        table.treatmentExecutionId,
        table.jobItemId,
        table.jobId,
        table.sourceExecutionStatus,
        table.completedAt,
        table.resultClassification,
        table.treatmentLevelId,
        table.mechanicalActionLevelId,
        table.treatmentApproachId,
      ],
      foreignColumns: [
        jobItemTreatmentExecutions.id,
        jobItemTreatmentExecutions.jobItemId,
        jobItemTreatmentExecutions.jobId,
        jobItemTreatmentExecutions.status,
        jobItemTreatmentExecutions.completedAt,
        jobItemTreatmentExecutions.resultClassification,
        jobItemTreatmentExecutions.performedTreatmentLevelId,
        jobItemTreatmentExecutions.performedMechanicalActionLevelId,
        jobItemTreatmentExecutions.performedTreatmentApproachId,
      ],
    }).onDelete("restrict"),
    uniqueIndex("cleaning_passport_entries_job_item_unique").on(
      table.jobItemId,
    ),
    uniqueIndex("cleaning_passport_entries_execution_unique").on(
      table.treatmentExecutionId,
    ),
    index("cleaning_passport_entries_asset_completed_idx").on(
      table.cleaningAssetId,
      table.completedAt,
    ),
    index("cleaning_passport_entries_job_idx").on(table.jobId),
    check(
      "cleaning_passport_entries_result_valid",
      sql`${table.resultClassification} in ('COMPLETED_AS_PLANNED', 'COMPLETED_WITH_LIMITATIONS', 'PARTIAL_IMPROVEMENT')`,
    ),
    check(
      "cleaning_passport_entries_source_execution_completed",
      sql`${table.sourceExecutionStatus} = 'COMPLETED'`,
    ),
    check(
      "cleaning_passport_entries_summaries_not_blank",
      sql`length(trim(${table.customerVisibleServiceSummary})) > 0 and length(trim(${table.customerVisibleConditionSummary})) > 0 and length(trim(${table.customerVisibleTreatmentSummary})) > 0 and (${table.customerVisibleCareRecommendation} is null or length(trim(${table.customerVisibleCareRecommendation})) > 0)`,
    ),
    check(
      "cleaning_passport_entries_maintenance_consistent",
      sql`(${table.recommendedReviewDate} is null and ${table.suggestedIntervalMonths} is null and ${table.maintenanceRecommendationReason} is null and ${table.maintenanceRecommendationSourceType} is null) or ((${table.recommendedReviewDate} is not null or ${table.suggestedIntervalMonths} is not null) and ${table.maintenanceRecommendationReason} is not null and length(trim(${table.maintenanceRecommendationReason})) > 0 and ${table.maintenanceRecommendationSourceType} in ('TECHNICIAN_ASSESSMENT', 'CATALOGUE_EVIDENCE'))`,
    ),
    check(
      "cleaning_passport_entries_interval_positive",
      sql`${table.suggestedIntervalMonths} is null or ${table.suggestedIntervalMonths} > 0`,
    ),
  ],
);

export const jobAuditEvents = pgTable(
  "job_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "restrict" }),
    jobItemId: uuid("job_item_id"),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    actorProfileId: uuid("actor_profile_id").references(
      () => userProfiles.id,
      { onDelete: "set null" },
    ),
    source: varchar("source", { length: 24 }).notNull(),
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
    foreignKey({
      name: "job_audit_events_item_scope_fk",
      columns: [table.jobItemId, table.jobId],
      foreignColumns: [jobItems.id, jobItems.jobId],
    }).onDelete("restrict"),
    uniqueIndex("job_audit_events_correlation_unique").on(
      table.correlationId,
    ),
    index("job_audit_events_job_timeline_idx").on(
      table.jobId,
      table.createdAt,
    ),
    index("job_audit_events_item_timeline_idx")
      .on(table.jobItemId, table.createdAt)
      .where(sql`${table.jobItemId} is not null`),
    index("job_audit_events_type_created_idx").on(
      table.eventType,
      table.createdAt,
    ),
    check(
      "job_audit_events_type_valid",
      sql`${table.eventType} in ('JOB_CREATED', 'TEAM_ASSIGNED', 'JOB_READY', 'EN_ROUTE', 'ARRIVED', 'WORK_STARTED', 'INSPECTION_COMPLETED', 'TREATMENT_CONFIRMED', 'TREATMENT_STARTED', 'TREATMENT_COMPLETED', 'ITEM_DECLINED', 'ITEM_REFERRED', 'REQUIRES_REVIEW', 'JOB_COMPLETED', 'PASSPORT_ENTRY_CREATED', 'JOB_CANCELLED')`,
    ),
    check(
      "job_audit_events_source_valid",
      sql`${table.source} in ('STAFF', 'TECHNICIAN', 'SYSTEM')`,
    ),
    check(
      "job_audit_events_status_not_blank",
      sql`(${table.previousStatus} is null or length(trim(${table.previousStatus})) > 0) and (${table.nextStatus} is null or length(trim(${table.nextStatus})) > 0)`,
    ),
  ],
);
