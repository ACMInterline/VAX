import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { travelZones } from "./commercial-engine";

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

export const workingHourPolicies = pgTable(
  "working_hour_policies",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    code: varchar("code", { length: 96 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    market: varchar("market", { length: 64 }).notNull(),
    timeZone: varchar("time_zone", { length: 64 }).notNull(),
    version: integer("version").notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    provisional: boolean("provisional").default(true).notNull(),
    active: boolean("active").default(false).notNull(),
    ...managedTimestamps(),
  },
  (table) => [
    check("working_hour_policies_version_positive", sql`${table.version} > 0`),
    check(
      "working_hour_policies_status_valid",
      sql`${table.status} in ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED')`,
    ),
    check(
      "working_hour_policies_effective_window_valid",
      sql`${table.effectiveFrom} is null or ${table.effectiveUntil} is null or ${table.effectiveUntil} > ${table.effectiveFrom}`,
    ),
  ],
);

export const operationsTeams = pgTable(
  "operations_teams",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    code: varchar("code", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    active: boolean("active").default(true).notNull(),
    defaultCrewSize: integer("default_crew_size").notNull(),
    workingHourPolicyId: integer("working_hour_policy_id")
      .notNull()
      .references(() => workingHourPolicies.id, { onDelete: "restrict" }),
    notes: text("notes"),
    ...managedTimestamps(),
  },
  (table) => [
    check(
      "operations_teams_crew_size_positive",
      sql`${table.defaultCrewSize} > 0`,
    ),
  ],
);

export const workingHourRules = pgTable(
  "working_hour_rules",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    policyId: integer("policy_id")
      .notNull()
      .references(() => workingHourPolicies.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 160 }).notNull().unique(),
    weekday: integer("weekday").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    teamId: integer("team_id").references(() => operationsTeams.id, {
      onDelete: "restrict",
    }),
    ...managedTimestamps(),
  },
  (table) => [
    uniqueIndex("working_hour_rules_policy_code_unique").on(
      table.policyId,
      table.code,
    ),
    check("working_hour_rules_weekday_valid", sql`${table.weekday} between 1 and 7`),
    check(
      "working_hour_rules_minutes_valid",
      sql`${table.startMinute} >= 0 and ${table.endMinute} <= 1440 and ${table.endMinute} > ${table.startMinute}`,
    ),
  ],
);

export const teamCapabilities = pgTable(
  "team_capabilities",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    teamId: integer("team_id")
      .notNull()
      .references(() => operationsTeams.id, { onDelete: "restrict" }),
    capabilityCode: varchar("capability_code", { length: 64 }).notNull(),
    active: boolean("active").default(true).notNull(),
    notes: text("notes"),
    ...managedTimestamps(),
  },
  (table) => [
    uniqueIndex("team_capabilities_team_code_unique").on(
      table.teamId,
      table.capabilityCode,
    ),
    check(
      "team_capabilities_code_valid",
      sql`${table.capabilityCode} in ('STANDARD_RESIDENTIAL', 'COMMERCIAL_AREA', 'SPECIALIST_ASSESSMENT', 'PORTABLE_EXTRACTION')`,
    ),
  ],
);

export const equipmentResources = pgTable(
  "equipment_resources",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    code: varchar("code", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    equipmentTypeCode: varchar("equipment_type_code", { length: 64 }).notNull(),
    capabilityCode: varchar("capability_code", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    active: boolean("active").default(true).notNull(),
    serialNumber: varchar("serial_number", { length: 160 }),
    notes: text("notes"),
    ...managedTimestamps(),
  },
  (table) => [
    check(
      "equipment_resources_type_valid",
      sql`${table.equipmentTypeCode} in ('PORTABLE_CLEANING_MACHINE')`,
    ),
    check(
      "equipment_resources_capability_valid",
      sql`${table.capabilityCode} in ('PORTABLE_EXTRACTION')`,
    ),
    check(
      "equipment_resources_status_valid",
      sql`${table.status} in ('ACTIVE', 'UNAVAILABLE', 'MAINTENANCE')`,
    ),
  ],
);

export const teamEquipmentAssignments = pgTable(
  "team_equipment_assignments",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    teamId: integer("team_id")
      .notNull()
      .references(() => operationsTeams.id, { onDelete: "restrict" }),
    equipmentResourceId: integer("equipment_resource_id")
      .notNull()
      .references(() => equipmentResources.id, { onDelete: "restrict" }),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    active: boolean("active").default(true).notNull(),
    notes: text("notes"),
    ...managedTimestamps(),
  },
  (table) => [
    uniqueIndex("team_equipment_assignments_pair_unique").on(
      table.teamId,
      table.equipmentResourceId,
    ),
    check(
      "team_equipment_assignments_window_valid",
      sql`${table.effectiveFrom} is null or ${table.effectiveUntil} is null or ${table.effectiveUntil} > ${table.effectiveFrom}`,
    ),
  ],
);

export const appointmentWindowDefinitions = pgTable(
  "appointment_window_definitions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    profileCode: varchar("profile_code", { length: 96 }).notNull(),
    version: integer("version").notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    windowCode: varchar("window_code", { length: 64 }).notNull(),
    labelBg: varchar("label_bg", { length: 160 }).notNull(),
    labelEn: varchar("label_en", { length: 160 }).notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    provisional: boolean("provisional").default(true).notNull(),
    active: boolean("active").default(false).notNull(),
    ...managedTimestamps(),
  },
  (table) => [
    uniqueIndex("appointment_windows_profile_version_code_unique").on(
      table.profileCode,
      table.version,
      table.windowCode,
    ),
    check("appointment_windows_version_positive", sql`${table.version} > 0`),
    check(
      "appointment_windows_status_valid",
      sql`${table.status} in ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED')`,
    ),
    check(
      "appointment_windows_code_valid",
      sql`${table.windowCode} in ('EARLY_MORNING', 'MORNING', 'MIDDAY', 'AFTERNOON', 'EVENING')`,
    ),
    check(
      "appointment_windows_minutes_valid",
      sql`${table.startMinute} >= 0 and ${table.endMinute} <= 1440 and ${table.endMinute} > ${table.startMinute}`,
    ),
    check(
      "appointment_windows_effective_window_valid",
      sql`${table.effectiveFrom} is null or ${table.effectiveUntil} is null or ${table.effectiveUntil} > ${table.effectiveFrom}`,
    ),
  ],
);

export const travelTimeProfiles = pgTable(
  "travel_time_profiles",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    code: varchar("code", { length: 96 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    market: varchar("market", { length: 64 }).notNull(),
    version: integer("version").notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    defaultTravelMinutes: integer("default_travel_minutes").notNull(),
    interJobBufferMinutes: integer("inter_job_buffer_minutes").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    provisional: boolean("provisional").default(true).notNull(),
    active: boolean("active").default(false).notNull(),
    ...managedTimestamps(),
  },
  (table) => [
    check("travel_time_profiles_version_positive", sql`${table.version} > 0`),
    check(
      "travel_time_profiles_status_valid",
      sql`${table.status} in ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED')`,
    ),
    check(
      "travel_time_profiles_default_positive",
      sql`${table.defaultTravelMinutes} > 0`,
    ),
    check(
      "travel_time_profiles_buffer_nonnegative",
      sql`${table.interJobBufferMinutes} >= 0`,
    ),
    check(
      "travel_time_profiles_effective_window_valid",
      sql`${table.effectiveFrom} is null or ${table.effectiveUntil} is null or ${table.effectiveUntil} > ${table.effectiveFrom}`,
    ),
  ],
);

export const travelTimeMatrixRules = pgTable(
  "travel_time_matrix_rules",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    travelTimeProfileId: integer("travel_time_profile_id")
      .notNull()
      .references(() => travelTimeProfiles.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 160 }).notNull().unique(),
    originTravelZoneId: integer("origin_travel_zone_id")
      .notNull()
      .references(() => travelZones.id, { onDelete: "restrict" }),
    destinationTravelZoneId: integer("destination_travel_zone_id")
      .notNull()
      .references(() => travelZones.id, { onDelete: "restrict" }),
    estimatedTravelMinutes: integer("estimated_travel_minutes"),
    bidirectional: boolean("bidirectional").default(true).notNull(),
    sameDistrictOnly: boolean("same_district_only").default(false).notNull(),
    manualAssessmentRequired: boolean("manual_assessment_required")
      .default(false)
      .notNull(),
    priority: integer("priority").notNull(),
    active: boolean("active").default(true).notNull(),
    notes: text("notes"),
    ...managedTimestamps(),
  },
  (table) => [
    uniqueIndex("travel_time_matrix_profile_code_unique").on(
      table.travelTimeProfileId,
      table.code,
    ),
    check(
      "travel_time_matrix_minutes_positive",
      sql`${table.estimatedTravelMinutes} is null or ${table.estimatedTravelMinutes} > 0`,
    ),
    check(
      "travel_time_matrix_priority_nonnegative",
      sql`${table.priority} >= 0`,
    ),
    check(
      "travel_time_matrix_manual_or_minutes",
      sql`${table.manualAssessmentRequired} = true or ${table.estimatedTravelMinutes} is not null`,
    ),
  ],
);
