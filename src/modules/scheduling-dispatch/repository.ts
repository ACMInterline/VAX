import "server-only";

import { createHash } from "node:crypto";
import { and, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  appointmentWindowDefinitions,
  equipmentResources,
  operationsTeams,
  teamCapabilities,
  teamEquipmentAssignments,
  travelTimeMatrixRules,
  travelTimeProfiles,
  workingHourPolicies,
  workingHourRules,
} from "@/db/schema/availability-engine";
import {
  bookingAuditEvents,
  bookingItems,
  bookingOccupancies,
  bookings,
  quoteAcceptances,
} from "@/db/schema/booking-engine";
import { travelZones } from "@/db/schema/commercial-engine";
import { customers, properties } from "@/db/schema/customer-crm";
import { jobs } from "@/db/schema/job-execution";
import {
  developmentSchedulingPolicy,
} from "@/modules/availability-engine/development-config";
import { getWorkingWindowForDate } from "@/modules/availability-engine/availability";
import { createDevelopmentTravelTimeEstimator } from "@/modules/availability-engine/travel";
import type {
  AppointmentWindowDefinition,
  EquipmentResourceDefinition,
  LocationInput,
  OperationsTeamCode,
  OperationsTeamDefinition,
  ServiceAreaDefinition,
  TeamCapabilityCode,
  TravelTimeProfileDefinition,
  WorkingHourPolicyDefinition,
  WorkingWindow,
} from "@/modules/availability-engine/types";
import type { TravelZoneCode } from "@/modules/commercial-engine/types";
import {
  calculateRevenueProductivity,
  calculateTeamAndLabourTime,
  calculateTeamUtilisation,
} from "@/modules/availability-engine/utilisation";
import { activeActorPermissionSql } from "@/modules/request-quote/repository";
import { generateSchedulingCandidates } from "./candidate-engine";
import { immutableOperationalRequirementsFromDurationSnapshot } from "./provenance";
import { rankScheduleCandidates } from "./ranking";
import {
  nextSofiaDate,
  previousSofiaDate,
  sofiaDayBounds,
  sofiaLocalDate,
  sofiaLocalMinuteToInstant,
  sofiaMinuteOfDay,
} from "./time";
import type {
  BookingPreviewInput,
  BookingSchedulePreview,
  DispatchDay,
  DispatchDayInput,
  DispatchMetrics,
  DispatchRepository,
  ScheduleCandidateBase,
  ScheduleConfirmationCommand,
  ScheduleMutationResult,
  SchedulingReadinessCode,
} from "./types";

type JsonObject = Record<string, unknown>;

const workingPolicyCode = "SOFIA_TEAM_HOURS_V1_DRAFT";
const travelProfileCode = "SOFIA_TRAVEL_V1_DRAFT";
const appointmentProfileCode = "SOFIA_APPOINTMENT_WINDOWS_V1_DRAFT";
const knownTeamCodes = new Set<OperationsTeamCode>(["TEAM_A", "TEAM_B"]);
const knownZoneCodes = new Set<TravelZoneCode>([
  "SOFIA_CORE",
  "SOFIA_EXTENDED",
  "SOFIA_OUTSKIRTS",
  "OUTSIDE_SOFIA",
]);
const knownTeamCapabilities = new Set<TeamCapabilityCode>([
  "STANDARD_RESIDENTIAL",
  "COMMERCIAL_AREA",
  "SPECIALIST_ASSESSMENT",
  "PORTABLE_EXTRACTION",
]);

function staffReadSql(profileId: string): SQL {
  return and(
    activeActorPermissionSql(profileId, "CUSTOMER_RECORDS_READ"),
    activeActorPermissionSql(profileId, "OPERATIONS_READ"),
    activeActorPermissionSql(profileId, "SCHEDULE_READ"),
  )!;
}

function staffManageSql(profileId: string): SQL {
  return and(
    activeActorPermissionSql(profileId, "CUSTOMER_RECORDS_MANAGE"),
    activeActorPermissionSql(profileId, "OPERATIONS_MANAGE"),
    activeActorPermissionSql(profileId, "SCHEDULE_MANAGE"),
  )!;
}

function object(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function integerValue(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? value
    : typeof value === "string" && /^-?\d+$/.test(value)
      ? Number(value)
      : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" && value.trim() && Number.isFinite(Number(value))
      ? Number(value)
      : null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function locationFromSnapshot(value: unknown): LocationInput | null {
  const snapshot = object(value);
  const city = textValue(snapshot?.city);
  const zoneCode = textValue(snapshot?.travelZoneCode);
  if (!city || !zoneCode || !knownZoneCodes.has(zoneCode as TravelZoneCode)) {
    return null;
  }
  return {
    city,
    district: textValue(snapshot?.district),
    addressText: textValue(snapshot?.streetAddress),
    postalCode: textValue(snapshot?.postalCode),
    latitude: numberValue(snapshot?.latitude),
    longitude: numberValue(snapshot?.longitude),
    accessNotes: textValue(snapshot?.accessNotes),
    parkingNotes: textValue(snapshot?.parkingNotes),
    zoneCode: zoneCode as TravelZoneCode,
  };
}

function snapshotDuration(value: unknown): number | null {
  const snapshot = object(value);
  const quoted = integerValue(snapshot?.quotedDurationMinutes);
  const source = object(snapshot?.sourceEstimateDurationSnapshot);
  const result = object(source?.result);
  const estimated = integerValue(result?.totalEstimatedMinutes);
  return quoted !== null && quoted > 0 && quoted === estimated ? quoted : null;
}

type WorkingPolicyRow = {
  id: number;
  code: string;
  name: string;
  timeZone: string;
  version: number;
  status: string;
  provisional: boolean;
  active: boolean;
  rules: unknown;
};

type TravelProfileRow = {
  id: number;
  code: string;
  name: string;
  market: string;
  version: number;
  status: string;
  defaultTravelMinutes: number;
  interJobBufferMinutes: number;
  provisional: boolean;
  active: boolean;
  rules: unknown;
};

type TeamRow = {
  id: number;
  code: string;
  name: string;
  active: boolean;
  defaultCrewSize: number;
  workingHourPolicyId: number;
  capabilities: unknown;
  equipment: unknown;
};

type ZoneRow = {
  code: string;
  nameBg: string;
  nameEn: string;
  active: boolean;
  serviceEligible: boolean;
  minimumOrderOverrideMinorUnits: number | null;
  estimatedBaseTravelMinutes: number | null;
  manualConfirmationRequired: boolean;
  geographicMetadata: JsonObject | null;
  notes: string | null;
};

type WindowRow = {
  id: number;
  profileCode: string;
  version: number;
  status: string;
  windowCode: string;
  labelBg: string;
  labelEn: string;
  startMinute: number;
  endMinute: number;
  provisional: boolean;
  active: boolean;
};

type EquipmentConfig = Readonly<{
  id: number;
  definition: EquipmentResourceDefinition;
}>;

type TeamConfig = Readonly<{
  id: number;
  workingHourPolicyId: number;
  definition: OperationsTeamDefinition;
  equipment: readonly EquipmentConfig[];
}>;

type OperationalConfiguration = Readonly<{
  workingPolicyId: number;
  workingPolicy: WorkingHourPolicyDefinition;
  travelProfileId: number;
  travelProfile: TravelTimeProfileDefinition;
  teams: readonly TeamConfig[];
  zones: ReadonlyMap<TravelZoneCode, ServiceAreaDefinition>;
  windows: ReadonlyMap<string, AppointmentWindowDefinition>;
  provisional: boolean;
}>;

async function loadOperationalConfiguration(
  database: Database,
  profileId: string,
): Promise<OperationalConfiguration | null> {
  const access = staffReadSql(profileId);
  const [workingResult, travelResult, teamResult, zoneResult, windowResult] =
    await Promise.all([
      database.execute<WorkingPolicyRow>(sql`
        select policy.id, policy.code, policy.name,
          policy.time_zone as "timeZone", policy.version, policy.status,
          policy.provisional, policy.active,
          coalesce(jsonb_agg(jsonb_build_object(
            'id', rule.code, 'weekday', rule.weekday,
            'startMinute', rule.start_minute, 'endMinute', rule.end_minute,
            'enabled', rule.enabled, 'teamCode', team.code
          ) order by rule.weekday, rule.code)
            filter (where rule.id is not null), '[]'::jsonb) as rules
        from ${workingHourPolicies} policy
        left join ${workingHourRules} rule on rule.policy_id = policy.id
        left join ${operationsTeams} team on team.id = rule.team_id
        where policy.code = ${workingPolicyCode} and ${access}
        group by policy.id
      `),
      database.execute<TravelProfileRow>(sql`
        select profile.id, profile.code, profile.name, profile.market,
          profile.version, profile.status,
          profile.default_travel_minutes as "defaultTravelMinutes",
          profile.inter_job_buffer_minutes as "interJobBufferMinutes",
          profile.provisional, profile.active,
          coalesce(jsonb_agg(jsonb_build_object(
            'id', rule.code, 'originZoneCode', origin.code,
            'destinationZoneCode', destination.code,
            'estimatedTravelMinutes', rule.estimated_travel_minutes,
            'bidirectional', rule.bidirectional,
            'sameDistrictOnly', rule.same_district_only,
            'manualAssessmentRequired', rule.manual_assessment_required,
            'priority', rule.priority, 'active', rule.active,
            'notes', coalesce(rule.notes, '')
          ) order by rule.priority, rule.code)
            filter (where rule.id is not null), '[]'::jsonb) as rules
        from ${travelTimeProfiles} profile
        left join ${travelTimeMatrixRules} rule
          on rule.travel_time_profile_id = profile.id
        left join ${travelZones} origin on origin.id = rule.origin_travel_zone_id
        left join ${travelZones} destination
          on destination.id = rule.destination_travel_zone_id
        where profile.code = ${travelProfileCode} and ${access}
        group by profile.id
      `),
      database.execute<TeamRow>(sql`
        select team.id, team.code, team.name, team.active,
          team.default_crew_size as "defaultCrewSize",
          team.working_hour_policy_id as "workingHourPolicyId",
          coalesce(array_agg(distinct capability.capability_code)
            filter (where capability.id is not null and capability.active), '{}')
            as capabilities,
          coalesce(jsonb_agg(distinct jsonb_build_object(
            'id', equipment.id, 'code', equipment.code,
            'name', equipment.name,
            'equipmentTypeCode', equipment.equipment_type_code,
            'capabilityCode', equipment.capability_code,
            'status', equipment.status, 'active', equipment.active,
            'assignmentActive', assignment.active,
            'effectiveFrom', assignment.effective_from,
            'effectiveUntil', assignment.effective_until
          )) filter (where equipment.id is not null), '[]'::jsonb) as equipment
        from ${operationsTeams} team
        left join ${teamCapabilities} capability on capability.team_id = team.id
        left join ${teamEquipmentAssignments} assignment on assignment.team_id = team.id
          and assignment.active = true
          and (assignment.effective_from is null or assignment.effective_from <= now())
          and (assignment.effective_until is null or assignment.effective_until > now())
        left join ${equipmentResources} equipment
          on equipment.id = assignment.equipment_resource_id
        where ${access}
        group by team.id
        order by team.code
      `),
      database.execute<ZoneRow>(sql`
        select zone.code, zone.label_bg as "nameBg",
          zone.label_en as "nameEn", zone.active,
          zone.service_eligible as "serviceEligible",
          zone.minimum_order_override_minor_units
            as "minimumOrderOverrideMinorUnits",
          zone.estimated_base_travel_minutes as "estimatedBaseTravelMinutes",
          zone.manual_confirmation_required as "manualConfirmationRequired",
          zone.geographic_metadata as "geographicMetadata",
          zone.boundary_notes as notes
        from ${travelZones} zone where ${access}
      `),
      database.execute<WindowRow>(sql`
        select window.id, window.profile_code as "profileCode",
          window.version, window.status, window.window_code as "windowCode",
          window.label_bg as "labelBg", window.label_en as "labelEn",
          window.start_minute as "startMinute",
          window.end_minute as "endMinute", window.provisional, window.active
        from ${appointmentWindowDefinitions} window
        where window.profile_code = ${appointmentProfileCode} and ${access}
        order by window.start_minute
      `),
    ]);

  const working = workingResult.rows[0];
  const travel = travelResult.rows[0];
  if (
    !working ||
    !travel ||
    working.timeZone !== "Europe/Sofia" ||
    working.version !== 1 ||
    travel.version !== 1 ||
    working.status !== "DRAFT" ||
    travel.status !== "DRAFT"
  ) {
    return null;
  }
  const workingRules = Array.isArray(working.rules) ? working.rules : [];
  const workingPolicy: WorkingHourPolicyDefinition = {
    id: String(working.id),
    code: working.code,
    name: working.name,
    timeZone: "Europe/Sofia",
    version: working.version,
    status: "DRAFT",
    effectiveFrom: null,
    effectiveUntil: null,
    provisional: working.provisional,
    active: working.active,
    rules: workingRules.flatMap((entry) => {
      const row = object(entry);
      const weekday = integerValue(row?.weekday);
      const teamCode = textValue(row?.teamCode);
      return weekday && weekday >= 1 && weekday <= 7
        ? [{
            id: textValue(row?.id) ?? `rule-${weekday}`,
            weekday: weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7,
            startMinute: integerValue(row?.startMinute) ?? -1,
            endMinute: integerValue(row?.endMinute) ?? -1,
            enabled: booleanValue(row?.enabled) ?? false,
            teamCode:
              teamCode && knownTeamCodes.has(teamCode as OperationsTeamCode)
                ? (teamCode as OperationsTeamCode)
                : null,
          }]
        : [];
    }),
  };
  const travelRules = Array.isArray(travel.rules) ? travel.rules : [];
  const travelProfile: TravelTimeProfileDefinition = {
    id: String(travel.id),
    code: travel.code,
    name: travel.name,
    market: "SOFIA",
    version: travel.version,
    status: "DRAFT",
    effectiveFrom: null,
    effectiveUntil: null,
    defaultTravelMinutes: travel.defaultTravelMinutes,
    interJobBufferMinutes: travel.interJobBufferMinutes,
    provisional: travel.provisional,
    active: travel.active,
    rules: travelRules.flatMap((entry) => {
      const row = object(entry);
      const origin = textValue(row?.originZoneCode);
      const destination = textValue(row?.destinationZoneCode);
      if (
        !origin ||
        !destination ||
        !knownZoneCodes.has(origin as TravelZoneCode) ||
        !knownZoneCodes.has(destination as TravelZoneCode)
      ) return [];
      return [{
        id: textValue(row?.id) ?? "unknown-rule",
        originZoneCode: origin as TravelZoneCode,
        destinationZoneCode: destination as TravelZoneCode,
        estimatedTravelMinutes: integerValue(row?.estimatedTravelMinutes),
        bidirectional: booleanValue(row?.bidirectional) ?? false,
        sameDistrictOnly: booleanValue(row?.sameDistrictOnly) ?? false,
        manualAssessmentRequired:
          booleanValue(row?.manualAssessmentRequired) ?? true,
        priority: integerValue(row?.priority) ?? Number.MAX_SAFE_INTEGER,
        active: booleanValue(row?.active) ?? false,
        notes: textValue(row?.notes) ?? "",
      }];
    }),
  };
  const teams: TeamConfig[] = teamResult.rows.flatMap((row) => {
    if (!knownTeamCodes.has(row.code as OperationsTeamCode)) return [];
    const capabilities = stringArray(row.capabilities).filter(
      (code): code is TeamCapabilityCode =>
        knownTeamCapabilities.has(code as TeamCapabilityCode),
    );
    const rawEquipment = Array.isArray(row.equipment) ? row.equipment : [];
    const equipment = rawEquipment.flatMap((value): EquipmentConfig[] => {
      const item = object(value);
      const id = integerValue(item?.id);
      const code = textValue(item?.code);
      const name = textValue(item?.name);
      if (!id || !code || !name || item?.capabilityCode !== "PORTABLE_EXTRACTION") {
        return [];
      }
      return [{
        id,
        definition: {
          id: String(id), code, name,
          equipmentTypeCode: "PORTABLE_CLEANING_MACHINE",
          capabilityCode: "PORTABLE_EXTRACTION",
          status:
            item.status === "ACTIVE" || item.status === "UNAVAILABLE" ||
            item.status === "MAINTENANCE" ? item.status : "UNAVAILABLE",
          active: item.active === true,
          assignedTeamCode: row.code as OperationsTeamCode,
          serialNumber: null,
          notes: "Current server-side operational assignment.",
        },
      }];
    });
    return [{
      id: row.id,
      workingHourPolicyId: row.workingHourPolicyId,
      definition: {
        id: String(row.id), code: row.code as OperationsTeamCode,
        name: row.name, active: row.active,
        defaultCrewSize: row.defaultCrewSize,
        workingHourPolicyCode: working.code,
        capabilityCodes: capabilities,
        equipmentResourceCodes: equipment.map((item) => item.definition.code),
        notes: "Current server-side operational team.",
      },
      equipment,
    }];
  });
  const zones = new Map<TravelZoneCode, ServiceAreaDefinition>();
  for (const row of zoneResult.rows) {
    if (!knownZoneCodes.has(row.code as TravelZoneCode)) continue;
    zones.set(row.code as TravelZoneCode, {
      code: row.code as TravelZoneCode,
      name: { bg: row.nameBg, en: row.nameEn },
      active: row.active,
      serviceEligible: row.serviceEligible,
      minimumOrderOverrideMinorUnits: row.minimumOrderOverrideMinorUnits,
      estimatedBaseTravelMinutes: row.estimatedBaseTravelMinutes,
      manualConfirmationRequired: row.manualConfirmationRequired,
      geographicMetadata: row.geographicMetadata,
      notes: row.notes ?? "",
    });
  }
  const windows = new Map<string, AppointmentWindowDefinition>();
  for (const row of windowResult.rows) {
    if (!["EARLY_MORNING", "MORNING", "MIDDAY", "AFTERNOON", "EVENING"].includes(row.windowCode)) continue;
    windows.set(row.windowCode, {
      id: String(row.id), profileCode: row.profileCode, version: row.version,
      status: row.status === "DRAFT" ? "DRAFT" : "ARCHIVED",
      windowCode: row.windowCode as AppointmentWindowDefinition["windowCode"],
      name: { bg: row.labelBg, en: row.labelEn },
      startMinute: row.startMinute, endMinute: row.endMinute,
      provisional: row.provisional, active: row.active,
    });
  }
  if (teams.length === 0 || zones.size === 0 || workingRules.length === 0) {
    return null;
  }
  return {
    workingPolicyId: working.id,
    workingPolicy,
    travelProfileId: travel.id,
    travelProfile,
    teams,
    zones,
    windows,
    provisional:
      working.provisional || travel.provisional ||
      working.status === "DRAFT" || travel.status === "DRAFT" ||
      !working.active || !travel.active,
  };
}

type BookingContextRow = {
  id: string;
  bookingReference: string;
  status: string;
  schedulingStatus: string;
  version: number;
  preferredDate: string | null;
  appointmentWindowCode: string | null;
  durationSnapshot: unknown;
  acceptanceDurationSnapshot: unknown;
  acceptanceProvenanceSnapshot: unknown;
  schedulingSnapshot: unknown;
  customerSnapshot: unknown;
  propertySnapshot: unknown;
  customerStatus: string;
  propertyStatus: string;
  propertyCustomerMatches: boolean;
  itemCount: number;
  occupancyId: string | null;
  occupancySnapshotVersion: number | null;
  occupancyServiceStart: Date | null;
  occupancyServiceEnd: Date | null;
  occupancyTeamName: string | null;
  occupancyEquipmentLabel: string | null;
  jobStatus: string | null;
};

async function loadBookingContext(
  database: Database,
  profileId: string,
  bookingReference: string,
): Promise<BookingContextRow | null> {
  const result = await database.execute<BookingContextRow>(sql`
    select booking.id, booking.booking_reference as "bookingReference",
      booking.status, booking.scheduling_status as "schedulingStatus",
      booking.version, booking.preferred_date::text as "preferredDate",
      booking.appointment_window_code as "appointmentWindowCode",
      booking.duration_snapshot as "durationSnapshot",
      acceptance.duration_snapshot as "acceptanceDurationSnapshot",
      acceptance.provenance_snapshot as "acceptanceProvenanceSnapshot",
      booking.scheduling_snapshot as "schedulingSnapshot",
      booking.customer_snapshot as "customerSnapshot",
      booking.property_snapshot as "propertySnapshot",
      customer.status as "customerStatus", property.status as "propertyStatus",
      (property.customer_id = booking.customer_id) as "propertyCustomerMatches",
      (select count(*)::integer from ${bookingItems} item
        where item.booking_id = booking.id) as "itemCount",
      occupancy.id as "occupancyId",
      occupancy.snapshot_version as "occupancySnapshotVersion",
      occupancy.service_start as "occupancyServiceStart",
      occupancy.service_end as "occupancyServiceEnd",
      team.name as "occupancyTeamName",
      equipment.name as "occupancyEquipmentLabel",
      job.status as "jobStatus"
    from ${bookings} booking
    join ${quoteAcceptances} acceptance
      on acceptance.id = booking.quote_acceptance_id
    join ${customers} customer on customer.id = booking.customer_id
    join ${properties} property on property.id = booking.property_id
    left join ${bookingOccupancies} occupancy
      on occupancy.booking_id = booking.id
     and occupancy.status in ('PENDING', 'CONFIRMED')
    left join ${operationsTeams} team on team.id = occupancy.team_id
    left join ${equipmentResources} equipment
      on equipment.id = occupancy.equipment_resource_id
    left join ${jobs} job on job.booking_id = booking.id and job.status <> 'CANCELLED'
    where booking.booking_reference = ${bookingReference}
      and ${staffReadSql(profileId)}
    limit 1
  `);
  return result.rows[0] ?? null;
}

type OccupancyRow = {
  id: string;
  bookingId: string;
  teamId: number;
  equipmentResourceId: number | null;
  serviceStart: Date;
  serviceEnd: Date;
  operationalStart: Date;
  operationalEnd: Date;
  locationSnapshot: unknown;
  serviceDurationMinutes: number;
  travelSnapshot: unknown;
};

async function loadDayOccupancies(
  database: Database,
  profileId: string,
  workDate: string,
  excludedBookingId?: string,
): Promise<readonly OccupancyRow[]> {
  const bounds = sofiaDayBounds(workDate);
  const excluded = excludedBookingId
    ? sql`and occupancy.booking_id <> ${excludedBookingId}::uuid`
    : sql``;
  const result = await database.execute<OccupancyRow>(sql`
    select occupancy.id, occupancy.booking_id as "bookingId",
      occupancy.team_id as "teamId", occupancy.service_start as "serviceStart",
      occupancy.equipment_resource_id as "equipmentResourceId",
      occupancy.service_end as "serviceEnd",
      occupancy.operational_start as "operationalStart",
      occupancy.operational_end as "operationalEnd",
      occupancy.location_snapshot as "locationSnapshot",
      occupancy.service_duration_minutes as "serviceDurationMinutes",
      occupancy.travel_snapshot as "travelSnapshot"
    from ${bookingOccupancies} occupancy
    where occupancy.status in ('PENDING', 'CONFIRMED')
      and occupancy.operational_start < ${bounds.endExclusive}
      and occupancy.operational_end > ${bounds.startInclusive}
      ${excluded}
      and ${staffReadSql(profileId)}
    order by occupancy.team_id, occupancy.service_start, occupancy.id
  `);
  return result.rows;
}

function minuteForWorkDate(instant: Date, workDate: string): number {
  const date = sofiaLocalDate(instant);
  if (date === workDate) return sofiaMinuteOfDay(instant, workDate);
  return date < workDate ? 0 : 1_440;
}

function candidateKey(input: {
  bookingReference: string;
  bookingVersion: number;
  workDate: string;
  teamId: number;
  equipmentId: number | null;
  serviceStart: Date;
  operationalStart: Date;
  operationalEnd: Date;
  previousId: string | null;
  nextId: string | null;
  workingPolicyVersion: number;
  travelProfileVersion: number;
}): string {
  const canonical = JSON.stringify(input);
  return createHash("sha256").update(canonical).digest("hex");
}

function previewIntegrity(row: BookingContextRow): readonly string[] {
  const warnings: string[] = [];
  const requirements = immutableOperationalRequirementsFromDurationSnapshot(
    row.durationSnapshot,
    row.itemCount,
  );
  if (row.status === "CANCELLED") warnings.push("BOOKING_CANCELLED");
  if (!["PENDING_SCHEDULING", "CONFIRMED"].includes(row.status)) {
    warnings.push("BOOKING_STATE_REVIEW_REQUIRED");
  }
  const duration = snapshotDuration(row.durationSnapshot);
  if (
    duration === null ||
    JSON.stringify(row.durationSnapshot) !==
      JSON.stringify(row.acceptanceDurationSnapshot)
  ) warnings.push("DURATION_PROVENANCE_INCOMPLETE");
  const provenance = object(row.acceptanceProvenanceSnapshot);
  if (
    provenance?.quoteSourceSnapshotMatched !== true ||
    provenance?.requestSourceSnapshotMatched !== true ||
    provenance?.requestNormalizationPreserved !== true
  ) warnings.push("ACCEPTANCE_PROVENANCE_INCOMPLETE");
  if (
    row.customerStatus !== "ACTIVE" ||
    row.propertyStatus !== "ACTIVE" ||
    !row.propertyCustomerMatches
  ) warnings.push("CRM_OWNERSHIP_REVIEW_REQUIRED");
  if (
    requirements === null
  ) warnings.push("OPERATIONAL_REQUIREMENTS_UNKNOWN");
  if (!locationFromSnapshot(row.propertySnapshot)) {
    warnings.push("IMMUTABLE_LOCATION_INCOMPLETE");
  }
  if (
    row.occupancyId &&
    row.jobStatus &&
    !["PREPARED"].includes(row.jobStatus)
  ) warnings.push("JOB_PROVENANCE_REVIEW_REQUIRED");
  return warnings;
}

export async function previewBookingScheduleRecord(
  database: Database,
  profileId: string,
  input: BookingPreviewInput,
): Promise<BookingSchedulePreview | null> {
  const [booking, configuration] = await Promise.all([
    loadBookingContext(database, profileId, input.bookingReference),
    loadOperationalConfiguration(database, profileId),
  ]);
  if (!booking) return null;
  const duration = snapshotDuration(booking.durationSnapshot) ?? 0;
  const customer = object(booking.customerSnapshot);
  const property = object(booking.propertySnapshot);
  const base = {
    bookingReference: booking.bookingReference,
    expectedBookingVersion: booking.version,
    customerDisplayName: textValue(customer?.displayName) ?? "—",
    propertyLabel: textValue(property?.label) ?? "—",
    propertyAddress: textValue(property?.streetAddress) ?? "—",
    preferredTimingLabel: [booking.preferredDate, booking.appointmentWindowCode]
      .filter(Boolean).join(" · ") || null,
    serviceDurationMinutes: duration,
    workDate: input.workDate,
    timeZone: "Europe/Sofia" as const,
    currentAppointment:
      booking.occupancyId && booking.occupancySnapshotVersion &&
      booking.occupancyServiceStart && booking.occupancyServiceEnd
        ? {
            occupancyId: booking.occupancyId,
            snapshotVersion: booking.occupancySnapshotVersion,
            serviceStart: booking.occupancyServiceStart,
            serviceEnd: booking.occupancyServiceEnd,
            teamName: booking.occupancyTeamName ?? "—",
            equipmentLabel: booking.occupancyEquipmentLabel,
          }
        : null,
  };
  const integrityWarnings = previewIntegrity(booking);
  if (!configuration || integrityWarnings.length > 0) {
    return {
      ...base,
      candidates: [],
      reviewWarnings: [
        ...integrityWarnings,
        ...(!configuration ? ["SCHEDULING_CONFIGURATION_INCOMPLETE"] : []),
      ],
      provisionalConfiguration: true,
    };
  }
  const location = locationFromSnapshot(booking.propertySnapshot)!;
  const requirements = immutableOperationalRequirementsFromDurationSnapshot(
    booking.durationSnapshot,
    booking.itemCount,
  )!;
  const serviceArea = configuration.zones.get(location.zoneCode);
  const preferredWindow = booking.appointmentWindowCode
    ? configuration.windows.get(booking.appointmentWindowCode) ?? null
    : null;
  if (
    !serviceArea ||
    !serviceArea.active ||
    !serviceArea.serviceEligible ||
    location.zoneCode === "OUTSIDE_SOFIA" ||
    (booking.appointmentWindowCode && !preferredWindow)
  ) {
    return {
      ...base,
      candidates: [],
      reviewWarnings: ["SERVICE_AREA_OR_WINDOW_REVIEW_REQUIRED"],
      provisionalConfiguration: configuration.provisional,
    };
  }
  const occupancies = await loadDayOccupancies(
    database,
    profileId,
    input.workDate,
    booking.id,
  );
  const travelEstimator = createDevelopmentTravelTimeEstimator(
    configuration.travelProfile,
  );
  const candidates: ScheduleCandidateBase[] = [];
  for (const team of configuration.teams) {
    const workingWindow = getWorkingWindowForDate(
      configuration.workingPolicy,
      input.workDate,
      team.definition.code,
    );
    if (!workingWindow) continue;
    const teamOccupancies = occupancies
      .filter((occupancy) => occupancy.teamId === team.id)
      .map((occupancy) => ({
        id: occupancy.id,
        serviceStartMinute: minuteForWorkDate(occupancy.serviceStart, input.workDate),
        serviceEndMinute: minuteForWorkDate(occupancy.serviceEnd, input.workDate),
        operationalStartMinute: minuteForWorkDate(occupancy.operationalStart, input.workDate),
        operationalEndMinute: minuteForWorkDate(occupancy.operationalEnd, input.workDate),
        location: locationFromSnapshot(occupancy.locationSnapshot),
      }));
    const equipmentOptions = requirements.equipment.length > 0
      ? team.equipment.filter((equipment) =>
          requirements.equipment.includes(equipment.definition.capabilityCode),
        )
      : [null];
    const options = equipmentOptions.length > 0 ? equipmentOptions : [null];
    for (const equipment of options) {
      const evaluations = generateSchedulingCandidates({
        workDate: input.workDate,
        serviceDurationMinutes: duration,
        location,
        workingWindow,
        preferredWindow: preferredWindow
          ? { startMinute: preferredWindow.startMinute, endMinute: preferredWindow.endMinute }
          : null,
        candidateIntervalMinutes: developmentSchedulingPolicy.candidateIntervalMinutes,
        interJobBufferMinutes: configuration.travelProfile.interJobBufferMinutes,
        parkingBufferMinutes: 0,
        largeJobReviewThresholdMinutes:
          developmentSchedulingPolicy.largeJobReviewThresholdMinutes,
        configurationProvisional: configuration.provisional ||
          serviceArea.manualConfirmationRequired || preferredWindow?.provisional === true,
        teamActive: team.definition.active,
        teamCapabilityCodes: team.definition.capabilityCodes,
        requiredCapabilityCodes: requirements.team,
        equipmentActive: equipment?.definition.active === true &&
          equipment.definition.status === "ACTIVE",
        equipmentCapabilityCode: equipment?.definition.capabilityCode ?? null,
        requiredEquipmentCapabilityCodes: requirements.equipment,
        occupancies: teamOccupancies,
        equipmentOccupancies: equipment
          ? occupancies
              .filter(
                (occupancy) =>
                  occupancy.equipmentResourceId === equipment.id,
              )
              .map((occupancy) => ({
                operationalStartMinute: minuteForWorkDate(
                  occupancy.operationalStart,
                  input.workDate,
                ),
                operationalEndMinute: minuteForWorkDate(
                  occupancy.operationalEnd,
                  input.workDate,
                ),
              }))
          : [],
        travelEstimator,
      });
      const occupiedWorkloadMinutes = teamOccupancies.reduce(
        (sum, occupancy) => sum +
          Math.max(0, occupancy.operationalEndMinute - occupancy.operationalStartMinute),
        0,
      );
      for (const evaluation of evaluations.filter((item) => item.selectable)) {
        const serviceStart = sofiaLocalMinuteToInstant(
          input.workDate,
          evaluation.serviceStartMinute,
        );
        const serviceEnd = new Date(
          serviceStart.valueOf() + duration * 60_000,
        );
        const operationalStart = sofiaLocalMinuteToInstant(
          input.workDate,
          evaluation.operationalStartMinute,
        );
        const operationalEnd = sofiaLocalMinuteToInstant(
          input.workDate,
          evaluation.operationalEndMinute,
        );
        candidates.push({
          key: candidateKey({
            bookingReference: booking.bookingReference,
            bookingVersion: booking.version,
            workDate: input.workDate,
            teamId: team.id,
            equipmentId: equipment?.id ?? null,
            serviceStart,
            operationalStart,
            operationalEnd,
            previousId: evaluation.previousOccupancyId,
            nextId: evaluation.nextOccupancyId,
            workingPolicyVersion: configuration.workingPolicy.version,
            travelProfileVersion: configuration.travelProfile.version,
          }),
          teamId: team.id,
          teamCode: team.definition.code,
          teamName: team.definition.name,
          equipmentResourceId: equipment?.id ?? null,
          equipmentLabel: equipment?.definition.name ?? null,
          workDate: input.workDate,
          serviceStart, serviceEnd, operationalStart, operationalEnd,
          serviceDurationMinutes: duration,
          travelBeforeMinutes: evaluation.travelBeforeMinutes,
          travelAfterMinutes: evaluation.travelAfterMinutes,
          travelMinutes:
            evaluation.travelBeforeMinutes + evaluation.travelAfterMinutes,
          bufferMinutes: evaluation.bufferMinutes,
          parkingBufferMinutes: 0,
          readiness: evaluation.readiness,
          selectable: evaluation.selectable,
          fallbackTravelUsed: evaluation.fallbackTravelUsed,
          manualReviewRequired: evaluation.manualReviewRequired,
          warnings: evaluation.warnings,
          preferredWindowMatch: true,
          additionalTravelMinutes:
            evaluation.travelBeforeMinutes + evaluation.travelAfterMinutes,
          nearbyWorkContinuity: evaluation.nearbyWorkContinuity,
          occupiedWorkloadMinutes,
          previousOccupancyId: evaluation.previousOccupancyId,
          nextOccupancyId: evaluation.nextOccupancyId,
        });
      }
    }
  }
  return {
    ...base,
    candidates: rankScheduleCandidates(candidates).slice(0, 12),
    reviewWarnings: [
      ...(configuration.provisional
        ? ["SCHEDULING_CONFIGURATION_DRAFT"]
        : []),
      ...(candidates.length === 0 ? ["NO_FEASIBLE_CANDIDATE"] : []),
    ],
    provisionalConfiguration: configuration.provisional,
  };
}

type DispatchAppointmentRow = {
  bookingReference: string;
  customerDisplayName: string;
  propertyLabel: string;
  propertyAddress: string;
  teamId: number;
  teamActive: boolean;
  equipmentActive: boolean | null;
  equipmentStatus: string | null;
  serviceStart: Date;
  serviceEnd: Date;
  operationalStart: Date;
  operationalEnd: Date;
  serviceDurationMinutes: number;
  travelSnapshot: unknown;
  equipmentLabel: string | null;
  jobReference: string | null;
  jobStatus: string | null;
  grossRevenueMinorUnits: number | null;
};

type UnscheduledRow = {
  bookingReference: string;
  customerDisplayName: string;
  propertyLabel: string;
  preferredDate: string | null;
  appointmentWindowCode: string | null;
  durationSnapshot: unknown;
  schedulingStatus: string;
};

function nonnegativeSnapshotMinute(snapshot: unknown, key: string): number {
  const value = integerValue(object(snapshot)?.[key]);
  return value !== null && value >= 0 ? value : 0;
}

function metricsForTeam(input: {
  workDate: string;
  workingWindow: WorkingWindow;
  crewSize: number;
  rows: readonly DispatchAppointmentRow[];
  includeRevenue: boolean;
}): DispatchMetrics {
  const occupancyBlocks = input.rows.map((row) => {
    const travel =
      nonnegativeSnapshotMinute(row.travelSnapshot, "travelBeforeMinutes") +
      nonnegativeSnapshotMinute(row.travelSnapshot, "travelAfterMinutes");
    const buffer =
      nonnegativeSnapshotMinute(row.travelSnapshot, "bufferMinutes") +
      nonnegativeSnapshotMinute(row.travelSnapshot, "parkingBufferMinutes");
    return {
      id: row.bookingReference,
      type: "JOB" as const,
      status: "CONFIRMED",
      startMinute: minuteForWorkDate(
        row.operationalStart,
        input.workDate,
      ),
      endMinute: minuteForWorkDate(
        row.operationalEnd,
        input.workDate,
      ),
      location: null,
      serviceMinutes: row.serviceDurationMinutes,
      travelMinutes: travel,
      bufferMinutes: buffer,
    };
  });
  try {
    const utilisation = calculateTeamUtilisation({
      workingWindow: input.workingWindow,
      occupancyBlocks,
    });
    const time = calculateTeamAndLabourTime(
      utilisation.occupiedTeamMinutes,
      input.crewSize,
    );
    const gross = input.rows.reduce(
      (sum, row) => sum + (row.grossRevenueMinorUnits ?? 0),
      0,
    );
    const revenue =
      input.includeRevenue && utilisation.occupiedTeamMinutes > 0
        ? calculateRevenueProductivity({
            grossRevenueMinorUnits: gross,
            estimatedContributionMinorUnits: 0,
            occupiedTeamMinutes: utilisation.occupiedTeamMinutes,
          }).grossRevenuePerOccupiedTeamHourMinorUnits
        : null;
    return {
      scheduledJobs: input.rows.length,
      serviceMinutes: utilisation.scheduledServiceMinutes,
      travelMinutes: utilisation.scheduledTravelMinutes,
      bufferMinutes: utilisation.scheduledBufferMinutes,
      idleMinutes: utilisation.idleMinutes,
      utilizationPercent: Math.round(
        utilisation.occupiedUtilisationBasisPoints / 100,
      ),
      occupiedTeamHoursHundredths: time.teamHoursHundredths,
      laborHoursHundredths: time.labourHoursHundredths,
      revenuePerOccupiedTeamHourMinorUnits: revenue,
      currency: "EUR",
    };
  } catch {
    return {
      scheduledJobs: input.rows.length,
      serviceMinutes: 0,
      travelMinutes: 0,
      bufferMinutes: 0,
      idleMinutes: 0,
      utilizationPercent: 0,
      occupiedTeamHoursHundredths: 0,
      laborHoursHundredths: 0,
      revenuePerOccupiedTeamHourMinorUnits: null,
      currency: "EUR",
    };
  }
}

function combineMetrics(
  metrics: readonly DispatchMetrics[],
  includeRevenue: boolean,
  rows: readonly DispatchAppointmentRow[],
): DispatchMetrics {
  const serviceMinutes = metrics.reduce((sum, item) => sum + item.serviceMinutes, 0);
  const travelMinutes = metrics.reduce((sum, item) => sum + item.travelMinutes, 0);
  const bufferMinutes = metrics.reduce((sum, item) => sum + item.bufferMinutes, 0);
  const occupiedMinutes = serviceMinutes + travelMinutes + bufferMinutes;
  const totalMinutes = occupiedMinutes + metrics.reduce((sum, item) => sum + item.idleMinutes, 0);
  const gross = rows.reduce(
    (sum, row) => sum + (row.grossRevenueMinorUnits ?? 0),
    0,
  );
  return {
    scheduledJobs: metrics.reduce((sum, item) => sum + item.scheduledJobs, 0),
    serviceMinutes,
    travelMinutes,
    bufferMinutes,
    idleMinutes: Math.max(0, totalMinutes - occupiedMinutes),
    utilizationPercent:
      totalMinutes > 0 ? Math.round((occupiedMinutes * 100) / totalMinutes) : 0,
    occupiedTeamHoursHundredths: metrics.reduce(
      (sum, item) => sum + item.occupiedTeamHoursHundredths,
      0,
    ),
    laborHoursHundredths: metrics.reduce(
      (sum, item) => sum + item.laborHoursHundredths,
      0,
    ),
    revenuePerOccupiedTeamHourMinorUnits:
      includeRevenue && occupiedMinutes > 0
        ? Math.round((gross * 60) / occupiedMinutes)
        : null,
    currency: "EUR",
  };
}

function appointmentReadiness(
  row: DispatchAppointmentRow,
): SchedulingReadinessCode {
  if (!row.teamActive) return "MISSING_TEAM";
  if (
    row.equipmentLabel &&
    (row.equipmentActive !== true || row.equipmentStatus !== "ACTIVE")
  ) return "MISSING_EQUIPMENT";
  if (object(row.travelSnapshot)?.fallbackUsed === true) return "TRAVEL_REVIEW";
  if (row.jobStatus === "REQUIRES_REVIEW") return "CAPABILITY_REVIEW";
  return "READY";
}

export async function loadDispatchDayRecord(
  database: Database,
  profileId: string,
  input: DispatchDayInput,
): Promise<DispatchDay> {
  const configuration = await loadOperationalConfiguration(database, profileId);
  const bounds = sofiaDayBounds(input.workDate);
  const access = staffReadSql(profileId);
  const [appointmentResult, unscheduledResult] = await Promise.all([
    database.execute<DispatchAppointmentRow>(sql`
      select booking.booking_reference as "bookingReference",
        booking.customer_snapshot ->> 'displayName' as "customerDisplayName",
        booking.property_snapshot ->> 'label' as "propertyLabel",
        booking.property_snapshot ->> 'streetAddress' as "propertyAddress",
        occupancy.team_id as "teamId", team.active as "teamActive",
        equipment.active as "equipmentActive",
        equipment.status as "equipmentStatus",
        occupancy.service_start as "serviceStart",
        occupancy.service_end as "serviceEnd",
        occupancy.operational_start as "operationalStart",
        occupancy.operational_end as "operationalEnd",
        occupancy.service_duration_minutes as "serviceDurationMinutes",
        occupancy.travel_snapshot as "travelSnapshot",
        equipment.name as "equipmentLabel",
        job.job_reference as "jobReference", job.status as "jobStatus",
        case when ${input.includeRevenue}
          then (booking.price_snapshot ->> 'grossTotalMinorUnits')::integer
          else null end as "grossRevenueMinorUnits"
      from ${bookingOccupancies} occupancy
      join ${bookings} booking on booking.id = occupancy.booking_id
      join ${operationsTeams} team on team.id = occupancy.team_id
      left join ${equipmentResources} equipment
        on equipment.id = occupancy.equipment_resource_id
      left join ${jobs} job on job.booking_id = booking.id
        and job.status <> 'CANCELLED'
      where occupancy.status = 'CONFIRMED'
        and occupancy.operational_start < ${bounds.endExclusive}
        and occupancy.operational_end > ${bounds.startInclusive}
        and ${access}
      order by team.code, occupancy.service_start, booking.booking_reference
    `),
    database.execute<UnscheduledRow>(sql`
      select booking.booking_reference as "bookingReference",
        booking.customer_snapshot ->> 'displayName' as "customerDisplayName",
        booking.property_snapshot ->> 'label' as "propertyLabel",
        booking.preferred_date::text as "preferredDate",
        booking.appointment_window_code as "appointmentWindowCode",
        booking.duration_snapshot as "durationSnapshot",
        booking.scheduling_status as "schedulingStatus"
      from ${bookings} booking
      where booking.status = 'PENDING_SCHEDULING'
        and booking.scheduling_status in ('UNSCHEDULED', 'REVIEW_REQUIRED')
        and ${access}
      order by booking.preferred_date nulls last, booking.created_at,
        booking.booking_reference
      limit 100
    `),
  ]);
  if (!configuration) {
    return {
      workDate: input.workDate,
      timeZone: "Europe/Sofia",
      previousDate: previousSofiaDate(input.workDate),
      nextDate: nextSofiaDate(input.workDate),
      provisionalConfiguration: true,
      warnings: ["SCHEDULING_CONFIGURATION_INCOMPLETE"],
      unscheduledBookings: unscheduledResult.rows.map((row) => ({
        bookingReference: row.bookingReference,
        customerDisplayName: row.customerDisplayName,
        propertyLabel: row.propertyLabel,
        preferredDate: row.preferredDate,
        appointmentWindowLabel: row.appointmentWindowCode,
        serviceDurationMinutes: snapshotDuration(row.durationSnapshot) ?? 0,
        readiness: "CUSTOMER_REVIEW",
        warnings: ["SCHEDULING_CONFIGURATION_INCOMPLETE"],
      })),
      teams: [],
      metrics: combineMetrics([], false, []),
    };
  }
  const teams = configuration.teams.map((team) => {
    const workingWindow = getWorkingWindowForDate(
      configuration.workingPolicy,
      input.workDate,
      team.definition.code,
    ) ?? { startMinute: 0, endMinute: 1 };
    const rows = appointmentResult.rows.filter((row) => row.teamId === team.id);
    const metrics = metricsForTeam({
      workDate: input.workDate,
      workingWindow,
      crewSize: team.definition.defaultCrewSize,
      rows,
      includeRevenue: input.includeRevenue,
    });
    const label = (minute: number) =>
      `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    return {
      id: team.id,
      code: team.definition.code,
      name: team.definition.name,
      workingWindowLabel: `${label(workingWindow.startMinute)}–${label(workingWindow.endMinute)}`,
      appointments: rows.map((row) => {
        const warnings = [
          ...(row.jobReference ? [] : ["JOB_NOT_PREPARED"]),
          ...(row.jobStatus === "PREPARED" ? ["JOB_TEAM_BINDING_REQUIRED"] : []),
        ];
        return {
          bookingReference: row.bookingReference,
          jobReference: row.jobReference,
          customerDisplayName: row.customerDisplayName,
          propertyLabel: row.propertyLabel,
          propertyAddress: row.propertyAddress,
          serviceStart: row.serviceStart,
          serviceEnd: row.serviceEnd,
          serviceDurationMinutes: row.serviceDurationMinutes,
          travelMinutes:
            nonnegativeSnapshotMinute(row.travelSnapshot, "travelBeforeMinutes") +
            nonnegativeSnapshotMinute(row.travelSnapshot, "travelAfterMinutes"),
          bufferMinutes:
            nonnegativeSnapshotMinute(row.travelSnapshot, "bufferMinutes") +
            nonnegativeSnapshotMinute(row.travelSnapshot, "parkingBufferMinutes"),
          equipmentLabel: row.equipmentLabel,
          readiness: appointmentReadiness(row),
          fallbackTravelUsed: object(row.travelSnapshot)?.fallbackUsed === true,
          warnings,
        };
      }),
      metrics,
    };
  });
  return {
    workDate: input.workDate,
    timeZone: "Europe/Sofia",
    previousDate: previousSofiaDate(input.workDate),
    nextDate: nextSofiaDate(input.workDate),
    provisionalConfiguration: configuration.provisional,
    warnings: configuration.provisional
      ? ["SCHEDULING_CONFIGURATION_DRAFT"]
      : [],
    unscheduledBookings: unscheduledResult.rows.map((row) => ({
      bookingReference: row.bookingReference,
      customerDisplayName: row.customerDisplayName,
      propertyLabel: row.propertyLabel,
      preferredDate: row.preferredDate,
      appointmentWindowLabel:
        row.appointmentWindowCode
          ? configuration.windows.get(row.appointmentWindowCode)?.name.en ??
            row.appointmentWindowCode
          : null,
      serviceDurationMinutes: snapshotDuration(row.durationSnapshot) ?? 0,
      readiness:
        snapshotDuration(row.durationSnapshot) === null
          ? "CUSTOMER_REVIEW"
          : "READY",
      warnings:
        row.schedulingStatus === "REVIEW_REQUIRED"
          ? ["STAFF_SCHEDULING_REVIEW_REQUIRED"]
          : [],
    })),
    teams,
    metrics: combineMetrics(
      teams.map((team) => team.metrics),
      input.includeRevenue,
      appointmentResult.rows,
    ),
  };
}

type ScheduleMutationRow = {
  result: string;
  bookingReference: string | null;
  occupancyId: string | null;
  occupancySnapshotVersion: number | null;
  bookingVersion: number | null;
  serviceStart: Date | null;
  serviceEnd: Date | null;
  reasonCodes: unknown;
};

function databaseConflict(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error &&
    ((error as { code?: unknown }).code === "23P01" ||
      (error as { code?: unknown }).code === "23505")
  );
}

function scheduleMutationResult(
  row: ScheduleMutationRow | undefined,
): ScheduleMutationResult {
  if (!row || row.result === "NOT_FOUND_OR_FORBIDDEN") {
    return { status: "NOT_FOUND_OR_FORBIDDEN" };
  }
  if (
    row.result === "STALE" ||
    row.result === "CONFLICT" ||
    row.result === "INVALID_TRANSITION"
  ) return { status: row.result };
  if (row.result === "REVIEW_REQUIRED") {
    return {
      status: "REVIEW_REQUIRED",
      reasonCodes: stringArray(row.reasonCodes),
    };
  }
  if (
    (row.result === "SCHEDULED" || row.result === "RESCHEDULED" ||
      row.result === "NO_CHANGE") &&
    row.bookingReference && row.occupancyId &&
    row.occupancySnapshotVersion && row.bookingVersion &&
    row.serviceStart && row.serviceEnd
  ) {
    return {
      status: row.result,
      bookingReference: row.bookingReference,
      occupancyId: row.occupancyId,
      occupancySnapshotVersion: row.occupancySnapshotVersion,
      bookingVersion: row.bookingVersion,
      serviceStart: row.serviceStart,
      serviceEnd: row.serviceEnd,
    };
  }
  return { status: "CONFLICT" };
}

export async function confirmBookingScheduleRecord(
  database: Database,
  profileId: string,
  command: ScheduleConfirmationCommand,
): Promise<ScheduleMutationResult> {
  const preview = await previewBookingScheduleRecord(database, profileId, {
    bookingReference: command.bookingReference,
    workDate: command.workDate,
  });
  if (!preview) return { status: "NOT_FOUND_OR_FORBIDDEN" };
  const candidate = preview.candidates.find(
    (item) => item.key === command.candidateKey && item.selectable,
  );
  if (!candidate) {
    return {
      status: "REVIEW_REQUIRED",
      reasonCodes: ["CANDIDATE_NO_LONGER_AVAILABLE"],
    };
  }
  const warningSnapshot = JSON.stringify(candidate.warnings);
  try {
    const result = await database.execute<ScheduleMutationRow>(sql`
      with target as materialized (
        select booking.*, acceptance.duration_snapshot
            as acceptance_duration_snapshot,
          acceptance.provenance_snapshot as acceptance_provenance_snapshot,
          customer.status as customer_status,
          property.status as property_status,
          property.customer_id as property_customer_id
        from ${bookings} booking
        join ${quoteAcceptances} acceptance
          on acceptance.id = booking.quote_acceptance_id
        join ${customers} customer on customer.id = booking.customer_id
        join ${properties} property on property.id = booking.property_id
        where booking.booking_reference = ${command.bookingReference}
          and ${staffManageSql(profileId)}
        for update of booking
      ),
      schedule_lock as materialized (
        select pg_advisory_xact_lock(hashtextextended(
          'vax-schedule:' || ${candidate.teamId}::text || ':' ||
          ${command.workDate}, 0
        )) as acquired
        from target
      ),
      current_occupancy as materialized (
        select occupancy.*
        from target
        join ${bookingOccupancies} occupancy
          on occupancy.booking_id = target.id
         and occupancy.status in ('PENDING', 'CONFIRMED')
        for update of occupancy
      ),
      current_job as materialized (
        select job.status, job.source_occupancy_id
        from target join ${jobs} job on job.booking_id = target.id
        where job.status <> 'CANCELLED'
        for update of job
      ),
      operational_requirements as materialized (
        select (select count(*)::integer from ${bookingItems} item
            where item.booking_id = target.id) as item_count,
          count(snapshot_item.item)::integer as service_count,
          coalesce(bool_and(coalesce(
            snapshot_item.item ->> 'serviceCode', ''
          ) in (
            'CARPET_CARE', 'RUG_RUNNER_CARE', 'UPHOLSTERY_CARE',
            'MATTRESS_CARE', 'COMMERCIAL_TEXTILE_CARE',
            'DELICATE_TEXTILE_ASSESSMENT'
          )), false) as all_known,
          coalesce(bool_or(snapshot_item.item ->> 'serviceCode'
            <> 'DELICATE_TEXTILE_ASSESSMENT'), false)
            as needs_equipment,
          coalesce(jsonb_agg(distinct case
            when snapshot_item.item ->> 'serviceCode'
              = 'COMMERCIAL_TEXTILE_CARE'
              then 'COMMERCIAL_AREA'
            when snapshot_item.item ->> 'serviceCode'
              = 'DELICATE_TEXTILE_ASSESSMENT'
              then 'SPECIALIST_ASSESSMENT'
            else 'STANDARD_RESIDENTIAL'
          end) filter (where snapshot_item.item ->> 'serviceCode' is not null),
            '[]'::jsonb)
            as required_capabilities
        from target
        left join lateral jsonb_array_elements(case
          when jsonb_typeof(target.duration_snapshot
            #> '{sourceEstimateDurationSnapshot,input,items}') = 'array'
            then target.duration_snapshot
              #> '{sourceEstimateDurationSnapshot,input,items}'
          else '[]'::jsonb
        end) snapshot_item(item) on true
        group by target.id
      ),
      policy_context as materialized (
        select team.id as team_id, team.code as team_code,
          team.name as team_name, team.active as team_active,
          team.default_crew_size,
          policy.id as working_policy_id,
          policy.code as working_policy_code,
          policy.version as working_policy_version,
          policy.status as working_policy_status,
          policy.provisional as working_policy_provisional,
          policy.active as working_policy_active,
          work_rule.start_minute, work_rule.end_minute,
          travel.id as travel_profile_id,
          travel.code as travel_profile_code,
          travel.version as travel_profile_version,
          travel.status as travel_profile_status,
          travel.provisional as travel_profile_provisional,
          travel.active as travel_profile_active
        from ${operationsTeams} team
        join ${workingHourPolicies} policy
          on policy.id = team.working_hour_policy_id
         and policy.code = ${workingPolicyCode}
         and policy.version = 1 and policy.status = 'DRAFT'
         and policy.provisional = true and policy.active = false
        join lateral (
          select rule.start_minute, rule.end_minute
          from ${workingHourRules} rule
          where rule.policy_id = policy.id and rule.enabled = true
            and rule.weekday = extract(isodow from ${command.workDate}::date)
            and (rule.team_id = team.id or rule.team_id is null)
          order by (rule.team_id is not null) desc, rule.id
          limit 1
        ) work_rule on true
        join ${travelTimeProfiles} travel
          on travel.code = ${travelProfileCode}
         and travel.version = 1 and travel.status = 'DRAFT'
         and travel.provisional = true and travel.active = false
        where team.id = ${candidate.teamId}
      ),
      equipment_context as materialized (
        select equipment.id, equipment.code, equipment.name,
          equipment.capability_code, equipment.active, equipment.status,
          assignment.id is not null as currently_assigned
        from ${equipmentResources} equipment
        left join ${teamEquipmentAssignments} assignment
          on assignment.equipment_resource_id = equipment.id
         and assignment.team_id = ${candidate.teamId}
         and assignment.active = true
         and (assignment.effective_from is null or assignment.effective_from <= now())
         and (assignment.effective_until is null or assignment.effective_until > now())
        where equipment.id = ${candidate.equipmentResourceId}
      ),
      actual_previous as materialized (
        select occupancy.id
        from target
        join ${bookingOccupancies} occupancy
          on occupancy.team_id = ${candidate.teamId}
         and occupancy.booking_id <> target.id
         and occupancy.status in ('PENDING', 'CONFIRMED')
         and occupancy.service_end <= ${candidate.serviceStart}
        order by occupancy.service_end desc, occupancy.id
        limit 1
      ),
      actual_next as materialized (
        select occupancy.id
        from target
        join ${bookingOccupancies} occupancy
          on occupancy.team_id = ${candidate.teamId}
         and occupancy.booking_id <> target.id
         and occupancy.status in ('PENDING', 'CONFIRMED')
         and occupancy.service_start >= ${candidate.serviceEnd}
        order by occupancy.service_start, occupancy.id
        limit 1
      ),
      decision as materialized (
        select case
          when target.version <> ${command.expectedBookingVersion}
            then 'STALE'
          when target.status = 'CANCELLED' then 'INVALID_TRANSITION'
          when target.status not in ('PENDING_SCHEDULING', 'CONFIRMED')
            then 'INVALID_TRANSITION'
          when target.duration_snapshot is distinct from
              target.acceptance_duration_snapshot
            or coalesce(target.duration_snapshot ->> 'quotedDurationMinutes', '')
              !~ '^[1-9][0-9]*$'
            or target.duration_snapshot ->> 'quotedDurationMinutes'
              is distinct from target.duration_snapshot
                #>> '{sourceEstimateDurationSnapshot,result,totalEstimatedMinutes}'
            or (target.duration_snapshot ->> 'quotedDurationMinutes')::integer
              <> ${candidate.serviceDurationMinutes}
            or target.acceptance_provenance_snapshot
                ->> 'quoteSourceSnapshotMatched' is distinct from 'true'
            or target.acceptance_provenance_snapshot
                ->> 'requestSourceSnapshotMatched' is distinct from 'true'
            or target.acceptance_provenance_snapshot
                ->> 'requestNormalizationPreserved' is distinct from 'true'
            then 'REVIEW_REQUIRED'
          when target.customer_status <> 'ACTIVE'
            or target.property_status <> 'ACTIVE'
            or target.property_customer_id <> target.customer_id
            or coalesce(target.property_snapshot ->> 'city', '') = ''
            or coalesce(target.property_snapshot ->> 'streetAddress', '') = ''
            or target.property_snapshot ->> 'travelZoneCode' not in (
              'SOFIA_CORE', 'SOFIA_EXTENDED', 'SOFIA_OUTSKIRTS',
              'OUTSIDE_SOFIA'
            )
            or not exists (
              select 1 from ${travelZones} zone
              where zone.code = target.property_snapshot ->> 'travelZoneCode'
                and zone.active = true and zone.service_eligible = true
                and zone.code <> 'OUTSIDE_SOFIA'
            ) then 'REVIEW_REQUIRED'
          when operational_requirements.item_count <= 0
            or operational_requirements.item_count <>
              operational_requirements.service_count
            or not operational_requirements.all_known
            then 'REVIEW_REQUIRED'
          when ${command.expectedOccupancySnapshotVersion}::integer is null
            and exists (select 1 from current_occupancy) then 'STALE'
          when ${command.expectedOccupancySnapshotVersion}::integer is not null
            and not exists (
              select 1 from current_occupancy
              where snapshot_version =
                ${command.expectedOccupancySnapshotVersion}::integer
            ) then 'STALE'
          when (${command.expectedOccupancySnapshotVersion}::integer is null
              and (${command.reasonCategory}::text is not null
                or ${command.reasonText}::text is not null))
            or (${command.expectedOccupancySnapshotVersion}::integer is not null
              and ${command.reasonCategory}::text is null)
            then 'INVALID_TRANSITION'
          when exists (select 1 from current_job
            where status <> 'PREPARED' or source_occupancy_id is not null)
            then 'REVIEW_REQUIRED'
          when not exists (select 1 from policy_context where team_active)
            then 'REVIEW_REQUIRED'
          when exists (
            select 1 from jsonb_array_elements_text(
              operational_requirements.required_capabilities
            ) required(code)
            where not exists (
              select 1 from ${teamCapabilities} capability
              where capability.team_id = ${candidate.teamId}
                and capability.capability_code = required.code
                and capability.active = true
            )
          ) then 'REVIEW_REQUIRED'
          when operational_requirements.needs_equipment and (
            ${candidate.equipmentResourceId}::integer is null
            or not exists (select 1 from equipment_context
              where active and status = 'ACTIVE'
                and capability_code = 'PORTABLE_EXTRACTION'
                and currently_assigned)
          ) then 'REVIEW_REQUIRED'
          when not operational_requirements.needs_equipment
            and ${candidate.equipmentResourceId}::integer is not null
            then 'REVIEW_REQUIRED'
          when (${candidate.serviceStart} at time zone 'Europe/Sofia')::date
              <> ${command.workDate}::date
            or (${candidate.serviceEnd} at time zone 'Europe/Sofia')::date
              <> ${command.workDate}::date
            or ${candidate.serviceEnd} <= ${candidate.serviceStart}
            or extract(epoch from (${candidate.serviceEnd} -
              ${candidate.serviceStart})) / 60
              <> ${candidate.serviceDurationMinutes}
            or ${candidate.operationalStart} > ${candidate.serviceStart}
            or ${candidate.operationalEnd} < ${candidate.serviceEnd}
            or (extract(hour from ${candidate.operationalStart}
                at time zone 'Europe/Sofia') * 60
              + extract(minute from ${candidate.operationalStart}
                at time zone 'Europe/Sofia')) < policy_context.start_minute
            or (extract(hour from ${candidate.operationalEnd}
                at time zone 'Europe/Sofia') * 60
              + extract(minute from ${candidate.operationalEnd}
                at time zone 'Europe/Sofia')) > policy_context.end_minute
            then 'REVIEW_REQUIRED'
          when target.appointment_window_code is not null and not exists (
            select 1 from ${appointmentWindowDefinitions} window
            where window.profile_code = ${appointmentProfileCode}
              and window.version = 1 and window.status = 'DRAFT'
              and window.provisional = true and window.active = false
              and window.window_code = target.appointment_window_code
              and (extract(hour from ${candidate.serviceStart}
                    at time zone 'Europe/Sofia') * 60
                + extract(minute from ${candidate.serviceStart}
                    at time zone 'Europe/Sofia')) >= window.start_minute
              and (extract(hour from ${candidate.serviceStart}
                    at time zone 'Europe/Sofia') * 60
                + extract(minute from ${candidate.serviceStart}
                    at time zone 'Europe/Sofia')) < window.end_minute
          ) then 'REVIEW_REQUIRED'
          when (select id from actual_previous) is distinct from
              ${candidate.previousOccupancyId ?? null}::uuid
            or (select id from actual_next) is distinct from
              ${candidate.nextOccupancyId ?? null}::uuid
            then 'STALE'
          when exists (select 1 from current_occupancy
            where team_id = ${candidate.teamId}
              and equipment_resource_id is not distinct from
                ${candidate.equipmentResourceId}::integer
              and service_start = ${candidate.serviceStart}
              and service_end = ${candidate.serviceEnd})
            then 'NO_CHANGE'
          else 'READY'
        end as result
        from target, schedule_lock, operational_requirements, policy_context
        union all select 'NOT_FOUND_OR_FORBIDDEN'
        where not exists (select 1 from target)
      ),
      released as (
        update ${bookingOccupancies} occupancy
        set status = 'CANCELLED', cancelled_at = now(),
          cancelled_by_profile_id = ${profileId}::uuid
        from decision
        where occupancy.id = (select id from current_occupancy)
          and decision.result = 'READY'
        returning occupancy.id, occupancy.snapshot_version
      ),
      inserted as (
        insert into ${bookingOccupancies} (
          booking_id, snapshot_version, previous_occupancy_id,
          revision_kind, revision_reason_category, revision_note,
          team_id, equipment_resource_id,
          service_start, service_end, operational_start, operational_end,
          time_zone, status, service_duration_minutes,
          required_equipment_capability_code,
          scheduling_policy_code, scheduling_policy_version,
          working_hour_policy_id, working_hour_policy_code,
          working_hour_policy_version, travel_time_profile_id,
          travel_time_profile_code, travel_time_profile_version,
          duration_snapshot, location_snapshot, requirements_snapshot,
          availability_input_snapshot, availability_result_snapshot,
          travel_snapshot, working_hours_snapshot, equipment_snapshot,
          created_by_profile_id
        )
        select target.id,
          coalesce((select max(history.snapshot_version) + 1
            from ${bookingOccupancies} history
            where history.booking_id = target.id), 1),
          current_occupancy.id,
          case when current_occupancy.id is null then 'INITIAL'
            else 'RESCHEDULE' end,
          case when current_occupancy.id is null then null
            else ${command.reasonCategory} end,
          case when current_occupancy.id is null then null
            else ${command.reasonText} end,
          policy_context.team_id, ${candidate.equipmentResourceId},
          ${candidate.serviceStart}, ${candidate.serviceEnd},
          ${candidate.operationalStart}, ${candidate.operationalEnd},
          'Europe/Sofia', 'CONFIRMED', ${candidate.serviceDurationMinutes},
          case when operational_requirements.needs_equipment
            then 'PORTABLE_EXTRACTION' else null end,
          ${developmentSchedulingPolicy.code},
          ${developmentSchedulingPolicy.version},
          policy_context.working_policy_id,
          policy_context.working_policy_code,
          policy_context.working_policy_version,
          policy_context.travel_profile_id,
          policy_context.travel_profile_code,
          policy_context.travel_profile_version,
          target.duration_snapshot, target.property_snapshot,
          jsonb_build_object(
            'schemaVersion', 1,
            'requiredCapabilityCodes',
              operational_requirements.required_capabilities,
            'requiredEquipmentCapabilityCodes',
              case when operational_requirements.needs_equipment
                then jsonb_build_array('PORTABLE_EXTRACTION')
                else '[]'::jsonb end,
            'requiredTeamCount', 1,
            'source', 'IMMUTABLE_ACCEPTED_ESTIMATE_DURATION_INPUT',
            'bookingItemCountVerified', true
          ),
          jsonb_build_object(
            'schemaVersion', 1, 'workDate', ${command.workDate},
            'candidateKey', ${command.candidateKey},
            'previousOccupancyId', ${candidate.previousOccupancyId ?? null}::uuid,
            'nextOccupancyId', ${candidate.nextOccupancyId ?? null}::uuid,
            'staffReviewAcknowledged', true,
            'configurationStatus', 'DRAFT'
          ),
          jsonb_build_object(
            'schemaVersion', 1, 'readiness', ${candidate.readiness},
            'manualReviewRequired', ${candidate.manualReviewRequired},
            'warnings', ${warningSnapshot}::jsonb,
            'serviceStart', ${candidate.serviceStart},
            'serviceEnd', ${candidate.serviceEnd},
            'operationalStart', ${candidate.operationalStart},
            'operationalEnd', ${candidate.operationalEnd}
          ),
          jsonb_build_object(
            'schemaVersion', 1,
            'travelBeforeMinutes', ${candidate.travelBeforeMinutes},
            'travelAfterMinutes', ${candidate.travelAfterMinutes},
            'bufferMinutes', ${candidate.bufferMinutes},
            'parkingBufferMinutes', ${candidate.parkingBufferMinutes},
            'fallbackUsed', ${candidate.fallbackTravelUsed},
            'liveRoutingUsed', false,
            'profileCode', policy_context.travel_profile_code,
            'profileVersion', policy_context.travel_profile_version
          ),
          jsonb_build_object(
            'schemaVersion', 1,
            'timeZone', 'Europe/Sofia',
            'startMinute', policy_context.start_minute,
            'endMinute', policy_context.end_minute,
            'policyCode', policy_context.working_policy_code,
            'policyVersion', policy_context.working_policy_version,
            'status', policy_context.working_policy_status,
            'provisional', policy_context.working_policy_provisional
          ),
          jsonb_build_object(
            'schemaVersion', 1,
            'resourceId', equipment_context.id,
            'resourceCode', equipment_context.code,
            'capabilityCode', equipment_context.capability_code,
            'status', equipment_context.status,
            'assignmentVerified',
              coalesce(equipment_context.currently_assigned, false)
          ),
          ${profileId}::uuid
        from target cross join decision cross join policy_context
        cross join operational_requirements
        left join current_occupancy on true
        left join equipment_context on true
        where decision.result = 'READY'
          and (current_occupancy.id is null
            or exists (select 1 from released))
        returning *
      ),
      changed as (
        update ${bookings} booking
        set status = 'CONFIRMED', scheduling_status = 'SCHEDULED',
          scheduled_start = inserted.service_start,
          scheduled_end = inserted.service_end,
          assigned_team_id = inserted.team_id,
          assigned_equipment_resource_id = inserted.equipment_resource_id,
          scheduling_snapshot = jsonb_build_object(
            'schemaVersion', 1, 'status', 'SCHEDULED',
            'exactSlotConfirmed', true,
            'occupancyId', inserted.id,
            'occupancySnapshotVersion', inserted.snapshot_version,
            'schedulingPolicyCode', inserted.scheduling_policy_code,
            'schedulingPolicyVersion', inserted.scheduling_policy_version,
            'workingHourPolicyCode', inserted.working_hour_policy_code,
            'workingHourPolicyVersion', inserted.working_hour_policy_version,
            'travelTimeProfileCode', inserted.travel_time_profile_code,
            'travelTimeProfileVersion', inserted.travel_time_profile_version,
            'configurationStatus', 'DRAFT',
            'commercialTermsPreserved', true
          ),
          version = booking.version + 1, updated_at = now(),
          updated_by_profile_id = ${profileId}::uuid
        from inserted
        where booking.id = inserted.booking_id
        returning booking.*
      ),
      audited as (
        insert into ${bookingAuditEvents} (
          booking_id, quote_acceptance_id, event_type,
          actor_profile_id, source, safe_metadata
        )
        select changed.id, changed.quote_acceptance_id, event.event_type,
          ${profileId}::uuid, 'STAFF',
          jsonb_build_object(
            'bookingVersion', changed.version,
            'occupancySnapshotVersion', inserted.snapshot_version,
            'teamCode', policy_context.team_code,
            'equipmentAssigned', inserted.equipment_resource_id is not null,
            'revisionReasonCategory', ${command.reasonCategory}
          )
        from changed join inserted on inserted.booking_id = changed.id
        cross join policy_context
        cross join lateral (values
          (case when inserted.previous_occupancy_id is null
            then 'BOOKING_SCHEDULED' else 'BOOKING_RESCHEDULED' end),
          ('TEAM_ASSIGNED'),
          (case when inserted.equipment_resource_id is null
            then null else 'EQUIPMENT_ASSIGNED' end),
          (case when inserted.previous_occupancy_id is null
            then null else 'OCCUPANCY_RELEASED' end)
        ) event(event_type)
        where event.event_type is not null
        returning id
      )
      select case
          when decision.result = 'READY' and changed.id is not null
            and exists (select 1 from audited)
            then case when inserted.previous_occupancy_id is null
              then 'SCHEDULED' else 'RESCHEDULED' end
          else decision.result
        end::text as result,
        target.booking_reference as "bookingReference",
        coalesce(inserted.id, current_occupancy.id) as "occupancyId",
        coalesce(inserted.snapshot_version,
          current_occupancy.snapshot_version) as "occupancySnapshotVersion",
        coalesce(changed.version, target.version) as "bookingVersion",
        coalesce(inserted.service_start,
          current_occupancy.service_start) as "serviceStart",
        coalesce(inserted.service_end,
          current_occupancy.service_end) as "serviceEnd",
        case when decision.result = 'REVIEW_REQUIRED'
          then jsonb_build_array('SCHEDULING_INTEGRITY_REVIEW_REQUIRED')
          else '[]'::jsonb end as "reasonCodes"
      from decision
      left join target on true
      left join current_occupancy on true
      left join inserted on true
      left join changed on true
    `);
    return scheduleMutationResult(result.rows[0]);
  } catch (error) {
    if (databaseConflict(error)) return { status: "CONFLICT" };
    throw error;
  }
}

export function createDatabaseSchedulingDispatchRepository(
  database: Database,
): DispatchRepository {
  return {
    getDispatchDay(profileId, input) {
      return loadDispatchDayRecord(database, profileId, input);
    },
    previewBooking(profileId, input) {
      return previewBookingScheduleRecord(database, profileId, input);
    },
    confirmSchedule(profileId, command) {
      return confirmBookingScheduleRecord(database, profileId, command);
    },
  };
}
