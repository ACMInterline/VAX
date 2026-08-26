import "server-only";

import { and, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  equipmentResources,
  operationsTeams,
  teamCapabilities,
  teamEquipmentAssignments,
} from "@/db/schema/availability-engine";
import {
  bookingItems,
  bookingOccupancies,
  bookings,
  quoteAcceptances,
} from "@/db/schema/booking-engine";
import {
  cleaningAssets,
  customerContacts,
  customerIdentityLinks,
  customers,
  properties,
} from "@/db/schema/customer-crm";
import {
  cleaningPassportEntries,
  jobAuditEvents,
  jobItemInspectionIssues,
  jobItemInspectionRisks,
  jobItemInspections,
  jobItems,
  jobItemTreatmentExecutions,
  jobItemTreatmentPlanAddons,
  jobItemTreatmentPlans,
  jobs,
  teamMemberships,
} from "@/db/schema/job-execution";
import {
  applicationRoles,
  userProfiles,
  userRoles,
} from "@/db/schema/identity-access";
import { quotes } from "@/db/schema/request-quote";
import {
  capabilityStatuses,
  cleaningItemTypes,
  cleaningProducts,
  conditionLevels,
  fibreMaterials,
  issueHandlingClassifications,
  issueTypes,
  materialTreatmentConsiderations,
  mechanicalActionLevels,
  riskFlags,
  serviceAddons,
  serviceAddonCapabilities,
  serviceItemCapabilities,
  serviceTreatmentLevels,
  surfaceConstructions,
  treatmentApproaches,
  treatmentLevels,
} from "@/db/schema/service-catalogue";
import { activeActorPermissionSql } from "@/modules/request-quote/repository";
import type { JsonObject } from "@/modules/request-quote/types";
import type {
  CleaningPassportPage,
  CustomerCleaningPassportEntry,
  JobCreationResult,
  JobItemDetail,
  JobItemMutationResult,
  JobListInput,
  JobMutationResult,
  JobPage,
  JobStatus,
  JobSummary,
  JobListSummary,
  StaffCleaningPassportEntry,
  StaffJobDetail,
  TechnicianJobDetail,
} from "./types";
import type {
  AssignJobTeamInput,
  CancelJobInput,
  CompleteJobInput,
  CompleteJobItemTreatmentInput,
  ConfirmJobItemTreatmentPlanInput,
  CreateJobFromBookingInput,
  JobItemVersionCommandInput,
  RecordJobItemInspectionInput,
  StartJobItemTreatmentInput,
} from "./validation";

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; cause?: { code?: unknown } };
  return candidate.code === "23505" || candidate.cause?.code === "23505";
}

function strings(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numbers(value: unknown): readonly number[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is number => Number.isSafeInteger(item) && item > 0,
      )
    : [];
}

function object(value: unknown): JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function dateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function dateRequired(value: unknown): Date {
  return dateOrNull(value) ?? new Date(0);
}

function integerOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return null;
}

function jobStaffReadSql(actorProfileId: string): SQL {
  return and(
    activeActorPermissionSql(actorProfileId, "CUSTOMER_RECORDS_READ"),
    activeActorPermissionSql(actorProfileId, "OPERATIONS_READ"),
    activeActorPermissionSql(actorProfileId, "SCHEDULE_READ"),
    activeActorPermissionSql(actorProfileId, "FIELD_JOBS_READ"),
  )!;
}

function activeTechnicianRoleSql(actorProfileId: string): SQL {
  return sql`exists (
    select 1
    from ${userProfiles} scoped_profile
    join ${userRoles} scoped_assignment
      on scoped_assignment.user_profile_id = scoped_profile.id
     and scoped_assignment.active = true
     and scoped_assignment.revoked_at is null
    join ${applicationRoles} scoped_role
      on scoped_role.id = scoped_assignment.role_id
     and scoped_role.active = true
     and scoped_role.code = 'TECHNICIAN'
    where scoped_profile.id = ${actorProfileId}::uuid
      and scoped_profile.status = 'ACTIVE'
  )`;
}

function exactTeamMembershipSql(
  actorProfileId: string,
  assignedTeamId: SQL,
): SQL {
  return and(
    activeTechnicianRoleSql(actorProfileId),
    sql`exists (
      select 1
      from ${teamMemberships} scoped_membership
      where scoped_membership.user_profile_id = ${actorProfileId}::uuid
        and scoped_membership.team_id = ${assignedTeamId}
        and scoped_membership.active = true
        and scoped_membership.valid_from <= now()
        and (
          scoped_membership.valid_until is null
          or scoped_membership.valid_until > now()
        )
    )`,
  )!;
}

function jobReadSql(actorProfileId: string, assignedTeamId: SQL): SQL {
  return or(
    jobStaffReadSql(actorProfileId),
    and(
      activeActorPermissionSql(actorProfileId, "OPERATIONS_READ"),
      activeActorPermissionSql(actorProfileId, "SCHEDULE_READ"),
      activeActorPermissionSql(actorProfileId, "FIELD_JOBS_READ"),
      exactTeamMembershipSql(actorProfileId, assignedTeamId),
    ),
  )!;
}

function jobExecutionUpdateSql(
  actorProfileId: string,
  assignedTeamId: SQL,
): SQL {
  return and(
    activeActorPermissionSql(actorProfileId, "FIELD_JOBS_UPDATE"),
    activeActorPermissionSql(actorProfileId, "FIELD_JOBS_READ"),
    activeActorPermissionSql(actorProfileId, "OPERATIONS_READ"),
    activeActorPermissionSql(actorProfileId, "SCHEDULE_READ"),
    or(
      activeActorPermissionSql(actorProfileId, "OPERATIONS_MANAGE"),
      exactTeamMembershipSql(actorProfileId, assignedTeamId),
    ),
  )!;
}

type OperationalResourceSqlReferences = Readonly<{
  bookingId: SQL;
  sourceOccupancyId: SQL;
  sourceOccupancySnapshotVersion: SQL;
  assignedTeamId: SQL;
  assignedEquipmentResourceId: SQL;
  scheduledStart: SQL;
  scheduledEnd: SQL;
}>;

/**
 * Re-proves the mutable operational resources behind an immutable Job
 * assignment. The Job remains bound to its exact occupancy snapshot; this
 * check never refreshes or repairs that snapshot from current Booking data.
 */
function operationalResourceReasonCodesSql(
  actorProfileId: string,
  reference: OperationalResourceSqlReferences,
): SQL {
  const actorStillAssigned = or(
    activeActorPermissionSql(actorProfileId, "OPERATIONS_MANAGE"),
    exactTeamMembershipSql(actorProfileId, reference.assignedTeamId),
  )!;

  return sql`array_remove(array[
    case when not exists (
      select 1
      from ${bookingOccupancies} current_occupancy
      join ${bookings} current_booking
        on current_booking.id = current_occupancy.booking_id
      where current_occupancy.id = ${reference.sourceOccupancyId}
        and current_occupancy.booking_id = ${reference.bookingId}
        and current_occupancy.snapshot_version =
          ${reference.sourceOccupancySnapshotVersion}
        and current_occupancy.team_id = ${reference.assignedTeamId}
        and current_occupancy.status = 'CONFIRMED'
        and current_occupancy.service_start = ${reference.scheduledStart}
        and current_occupancy.service_end = ${reference.scheduledEnd}
        and current_occupancy.equipment_resource_id is not distinct from
          ${reference.assignedEquipmentResourceId}
        and current_booking.status = 'CONFIRMED'
        and current_booking.scheduling_status = 'SCHEDULED'
        and current_booking.assigned_team_id = current_occupancy.team_id
        and current_booking.assigned_equipment_resource_id is not distinct from
          current_occupancy.equipment_resource_id
        and current_booking.scheduled_start = current_occupancy.service_start
        and current_booking.scheduled_end = current_occupancy.service_end
    ) then 'CONFIRMED_OCCUPANCY_INCONSISTENT' end,
    case when not exists (
      select 1 from ${operationsTeams} current_team
      where current_team.id = ${reference.assignedTeamId}
        and current_team.active = true
    ) then 'TEAM_INACTIVE' end,
    case when exists (
      select 1 from ${bookingOccupancies} current_occupancy
      where current_occupancy.id = ${reference.sourceOccupancyId}
        and current_occupancy.booking_id = ${reference.bookingId}
        and current_occupancy.snapshot_version =
          ${reference.sourceOccupancySnapshotVersion}
        and current_occupancy.team_id = ${reference.assignedTeamId}
        and (
          jsonb_typeof(current_occupancy.requirements_snapshot ->
            'requiredCapabilityCodes') is distinct from 'array'
          or exists (
            select 1 from jsonb_array_elements_text(
              case when jsonb_typeof(current_occupancy.requirements_snapshot ->
                  'requiredCapabilityCodes') = 'array'
                then current_occupancy.requirements_snapshot ->
                  'requiredCapabilityCodes'
                else '[]'::jsonb end
            ) required(code)
            where not exists (
              select 1 from ${teamCapabilities} current_capability
              where current_capability.team_id = current_occupancy.team_id
                and current_capability.capability_code = required.code
                and current_capability.active = true
            )
          )
        )
    ) then 'TEAM_CAPABILITY_REVOKED' end,
    case when ${reference.assignedEquipmentResourceId} is not null
      and not exists (
        select 1
        from ${equipmentResources} current_equipment
        join ${teamEquipmentAssignments} current_assignment
          on current_assignment.equipment_resource_id = current_equipment.id
         and current_assignment.team_id = ${reference.assignedTeamId}
        join ${bookingOccupancies} current_occupancy
          on current_occupancy.id = ${reference.sourceOccupancyId}
         and current_occupancy.booking_id = ${reference.bookingId}
         and current_occupancy.snapshot_version =
           ${reference.sourceOccupancySnapshotVersion}
         and current_occupancy.team_id = ${reference.assignedTeamId}
        where current_equipment.id =
            ${reference.assignedEquipmentResourceId}
          and current_equipment.active = true
          and current_equipment.status = 'ACTIVE'
          and current_equipment.capability_code =
            current_occupancy.required_equipment_capability_code
          and current_assignment.active = true
          and (current_assignment.effective_from is null
            or current_assignment.effective_from <= now())
          and (current_assignment.effective_until is null
            or current_assignment.effective_until > now())
      ) then 'EQUIPMENT_UNAVAILABLE' end,
    case when not (${actorStillAssigned})
      then 'ACTOR_ASSIGNMENT_REVOKED' end
  ], null)::text[]`;
}

function jobManagementSql(actorProfileId: string): SQL {
  return and(
    activeActorPermissionSql(actorProfileId, "FIELD_JOBS_READ"),
    activeActorPermissionSql(actorProfileId, "OPERATIONS_MANAGE"),
    activeActorPermissionSql(actorProfileId, "SCHEDULE_MANAGE"),
  )!;
}

function customerAssetReadSql(actorProfileId: string, customerId: SQL): SQL {
  return and(
    activeActorPermissionSql(actorProfileId, "OWN_CUSTOMER_DATA_READ"),
    sql`exists (
      select 1
      from ${customerIdentityLinks} exact_link
      join ${customers} linked_customer
        on linked_customer.id = exact_link.customer_id
       and linked_customer.status = 'ACTIVE'
      where exact_link.user_profile_id = ${actorProfileId}::uuid
        and exact_link.customer_id = ${customerId}
        and exact_link.active = true
        and exact_link.revoked_at is null
    )`,
  )!;
}

function staffAssetReadSql(actorProfileId: string): SQL {
  return and(
    activeActorPermissionSql(actorProfileId, "CUSTOMER_RECORDS_READ"),
    activeActorPermissionSql(actorProfileId, "OPERATIONS_READ"),
    activeActorPermissionSql(actorProfileId, "FIELD_JOBS_READ"),
  )!;
}

type CreationRow = {
  result: string;
  jobReference: string | null;
  jobStatus: string | null;
  reasonCodes: unknown;
};

function creationResult(row: CreationRow | undefined): JobCreationResult {
  if (!row || row.result === "NOT_FOUND_OR_FORBIDDEN") {
    return { status: "NOT_FOUND_OR_FORBIDDEN" };
  }
  if (row.result === "REFERENCE_CONFLICT") {
    return { status: "REFERENCE_CONFLICT" };
  }
  if (
    row.result === "CREATED" &&
    row.jobReference &&
    (row.jobStatus === "PREPARED" || row.jobStatus === "READY")
  ) {
    return {
      status: "CREATED",
      jobReference: row.jobReference,
      jobStatus: row.jobStatus,
    };
  }
  if (row.result === "EXISTING" && row.jobReference && row.jobStatus) {
    return {
      status: "EXISTING",
      jobReference: row.jobReference,
      jobStatus: row.jobStatus as JobStatus,
    };
  }
  if (row.result === "REVIEW_REQUIRED") {
    return { status: "REVIEW_REQUIRED", reasonCodes: strings(row.reasonCodes) };
  }
  return { status: "INELIGIBLE", reasonCodes: strings(row.reasonCodes) };
}

type CreationInput = CreateJobFromBookingInput & { jobReference: string };

async function loadExistingJobForBooking(
  database: Database,
  actorProfileId: string,
  bookingReference: string,
): Promise<JobCreationResult | null> {
  const result = await database.execute<{
    jobReference: string;
    jobStatus: JobStatus;
  }>(sql`
    select job.job_reference as "jobReference", job.status as "jobStatus"
    from ${bookings} booking
    join ${jobs} job on job.booking_id = booking.id
    where booking.booking_reference = ${bookingReference}
      and ${jobManagementSql(actorProfileId)}
    limit 1
  `);
  const row = result.rows[0];
  return row
    ? {
        status: "EXISTING",
        jobReference: row.jobReference,
        jobStatus: row.jobStatus,
      }
    : null;
}

/**
 * Atomically copies only execution-relevant immutable Booking and issued-Quote
 * evidence. Current request/estimate rows are deliberately absent: malformed
 * or inconsistent provenance produces zero Job writes.
 */
export async function createJobFromBookingRecord(
  database: Database,
  actorProfileId: string,
  input: CreationInput,
): Promise<JobCreationResult> {
  try {
    const result = await database.execute<CreationRow>(sql`
      with target as materialized (
        select booking.id as booking_id,
          booking.booking_reference, booking.version as booking_version,
          booking.status as booking_status,
          booking.scheduling_status, booking.request_id, booking.quote_id,
          booking.quote_acceptance_id, booking.customer_id,
          booking.property_id, booking.scheduled_start,
          booking.scheduled_end, booking.assigned_team_id,
          booking.assigned_equipment_resource_id,
          booking.price_snapshot as booking_price_snapshot,
          booking.duration_snapshot as booking_duration_snapshot,
          booking.scheduling_snapshot as booking_scheduling_snapshot,
          booking.customer_snapshot as booking_customer_snapshot,
          booking.property_snapshot as booking_property_snapshot,
          booking.customer_notes_snapshot,
          acceptance.quote_version, acceptance.quote_record_version,
          acceptance.source_request_version,
          acceptance.commercial_snapshot as accepted_commercial_snapshot,
          acceptance.terms_snapshot as accepted_terms_snapshot,
          acceptance.pricing_snapshot as accepted_pricing_snapshot,
          acceptance.duration_snapshot as accepted_duration_snapshot,
          acceptance.provenance_snapshot as accepted_provenance_snapshot,
          quote_record.quote_reference, quote_record.acceptance_source_snapshot,
          quote_record.issued_at,
          existing_job.job_reference as existing_job_reference,
          existing_job.status as existing_job_status,
          visit_contact.value as visit_contact_snapshot
        from ${bookings} booking
        join ${quoteAcceptances} acceptance
          on acceptance.id = booking.quote_acceptance_id
         and acceptance.quote_id = booking.quote_id
         and acceptance.request_id = booking.request_id
         and acceptance.customer_id = booking.customer_id
         and acceptance.property_id = booking.property_id
        join ${quotes} quote_record
          on quote_record.id = acceptance.quote_id
         and quote_record.request_id = acceptance.request_id
         and quote_record.customer_id = acceptance.customer_id
         and quote_record.property_id = acceptance.property_id
        left join ${jobs} existing_job on existing_job.booking_id = booking.id
        left join lateral (
          select jsonb_build_object(
            'schemaVersion', 1,
            'contactName', contact.contact_name,
            'email', contact.email,
            'phone', contact.phone,
            'sourceContactId', contact.id,
            'sourceContactVersion', contact.version,
            'capturedAt', now()
          ) as value
          from ${customerContacts} contact
          where contact.customer_id = booking.customer_id
            and contact.active = true
            and contact.is_primary = true
          order by contact.id
          limit 1
        ) visit_contact on true
        where booking.booking_reference = ${input.bookingReference}
          and ${jobManagementSql(actorProfileId)}
        for update of booking, acceptance, quote_record
      ),
      current_occupancy as materialized (
        select occupancy.*, team.code as team_code,
          team.name as team_name, team.active as team_active,
          team.default_crew_size,
          equipment.active as equipment_active,
          equipment.status as equipment_status,
          jsonb_typeof(occupancy.requirements_snapshot ->
              'requiredCapabilityCodes') = 'array'
            and not exists (
              select 1 from jsonb_array_elements_text(
                occupancy.requirements_snapshot -> 'requiredCapabilityCodes'
              ) required(code)
              where not exists (
                select 1 from ${teamCapabilities} capability
                where capability.team_id = occupancy.team_id
                  and capability.capability_code = required.code
                  and capability.active = true
              )
            ) as team_capabilities_satisfied,
          exists (
            select 1
            from ${teamEquipmentAssignments} assignment
            where assignment.team_id = occupancy.team_id
              and assignment.equipment_resource_id = occupancy.equipment_resource_id
              and assignment.active = true
              and (assignment.effective_from is null or assignment.effective_from <= now())
              and (assignment.effective_until is null or assignment.effective_until > now())
          ) as equipment_assigned
        from target
        join ${bookingOccupancies} occupancy
          on occupancy.booking_id = target.booking_id
         and occupancy.status = 'CONFIRMED'
        join ${operationsTeams} team on team.id = occupancy.team_id
        left join ${equipmentResources} equipment
          on equipment.id = occupancy.equipment_resource_id
        for update of occupancy
      ),
      guarded_source as materialized (
        select target.*
        from target
        where target.acceptance_source_snapshot is not null
          and jsonb_typeof(target.acceptance_source_snapshot) = 'object'
          and target.acceptance_source_snapshot ->> 'schemaVersion' = '1'
          and jsonb_typeof(target.acceptance_source_snapshot #> '{quote}') = 'object'
          and jsonb_typeof(target.acceptance_source_snapshot #> '{request}') = 'object'
          and jsonb_typeof(target.acceptance_source_snapshot #> '{request,items}') = 'array'
          and jsonb_typeof(target.acceptance_source_snapshot #> '{quoteItems}') = 'array'
          and jsonb_typeof(target.acceptance_source_snapshot #> '{estimate}') = 'object'
          and jsonb_typeof(target.acceptance_source_snapshot #> '{customer}') = 'object'
          and jsonb_typeof(target.acceptance_source_snapshot #> '{property}') = 'object'
      ),
      request_source as materialized (
        select request_item.value as snapshot,
          case when pg_input_is_valid(request_item.value ->> 'id', 'uuid')
            then (request_item.value ->> 'id')::uuid end as request_item_id,
          case when pg_input_is_valid(request_item.value ->> 'version', 'integer')
            then (request_item.value ->> 'version')::integer end as request_item_version,
          case when pg_input_is_valid(request_item.value ->> 'serviceId', 'integer')
            then (request_item.value ->> 'serviceId')::integer end as service_id,
          case when pg_input_is_valid(request_item.value ->> 'cleaningItemTypeId', 'integer')
            then (request_item.value ->> 'cleaningItemTypeId')::integer end as cleaning_item_type_id,
          case when pg_input_is_valid(request_item.value ->> 'measurementModeId', 'integer')
            then (request_item.value ->> 'measurementModeId')::integer end as measurement_mode_id,
          case when pg_input_is_valid(request_item.value ->> 'quantity', 'integer')
            then (request_item.value ->> 'quantity')::integer end as quantity,
          case when pg_input_is_valid(request_item.value ->> 'areaHundredthsM2', 'integer')
            then (request_item.value ->> 'areaHundredthsM2')::integer end as area_hundredths_m2,
          case when pg_input_is_valid(request_item.value ->> 'seatCount', 'integer')
            then (request_item.value ->> 'seatCount')::integer end as seat_count,
          case when pg_input_is_valid(request_item.value ->> 'sides', 'integer')
            then (request_item.value ->> 'sides')::integer end as sides,
          case when pg_input_is_valid(request_item.value ->> 'cleaningAssetId', 'uuid')
            then (request_item.value ->> 'cleaningAssetId')::uuid end as cleaning_asset_id,
          case when pg_input_is_valid(request_item.value ->> 'customerReportedConditionLevelId', 'integer')
            then (request_item.value ->> 'customerReportedConditionLevelId')::integer end as customer_condition_id,
          case when pg_input_is_valid(request_item.value ->> 'normalizedConditionLevelId', 'integer')
            then (request_item.value ->> 'normalizedConditionLevelId')::integer end as normalized_condition_id,
          case when pg_input_is_valid(request_item.value ->> 'reportedFibreMaterialId', 'integer')
            then (request_item.value ->> 'reportedFibreMaterialId')::integer end as reported_fibre_id,
          case when pg_input_is_valid(request_item.value ->> 'normalizedFibreMaterialId', 'integer')
            then (request_item.value ->> 'normalizedFibreMaterialId')::integer end as normalized_fibre_id,
          case when pg_input_is_valid(request_item.value ->> 'reportedSurfaceConstructionId', 'integer')
            then (request_item.value ->> 'reportedSurfaceConstructionId')::integer end as reported_construction_id,
          case when pg_input_is_valid(request_item.value ->> 'normalizedSurfaceConstructionId', 'integer')
            then (request_item.value ->> 'normalizedSurfaceConstructionId')::integer end as normalized_construction_id,
          case when pg_input_is_valid(request_item.value ->> 'sortOrder', 'integer')
            then (request_item.value ->> 'sortOrder')::integer end as sort_order,
          request_item.value ->> 'customerDescription' as customer_description,
          request_item.value ->> 'normalizedDescription' as normalized_description,
          request_item.value -> 'issues' as issues,
          request_item.value -> 'addons' as addons,
          jsonb_typeof(request_item.value) = 'object'
            and pg_input_is_valid(request_item.value ->> 'id', 'uuid')
            and case when pg_input_is_valid(request_item.value ->> 'version', 'integer')
              then (request_item.value ->> 'version')::integer > 0 else false end
            and case when pg_input_is_valid(request_item.value ->> 'serviceId', 'integer')
              then (request_item.value ->> 'serviceId')::integer > 0 else false end
            and case when pg_input_is_valid(request_item.value ->> 'cleaningItemTypeId', 'integer')
              then (request_item.value ->> 'cleaningItemTypeId')::integer > 0 else false end
            and case when pg_input_is_valid(request_item.value ->> 'measurementModeId', 'integer')
              then (request_item.value ->> 'measurementModeId')::integer > 0 else false end
            and case when pg_input_is_valid(request_item.value ->> 'quantity', 'integer')
              then (request_item.value ->> 'quantity')::integer > 0 else false end
            and case when pg_input_is_valid(request_item.value ->> 'sortOrder', 'integer')
              then (request_item.value ->> 'sortOrder')::integer >= 0 else false end
            and request_item.value ? 'cleaningAssetId'
            and (
              jsonb_typeof(request_item.value -> 'cleaningAssetId') = 'null'
              or pg_input_is_valid(request_item.value ->> 'cleaningAssetId', 'uuid')
            )
            and request_item.value ? 'customerReportedConditionLevelId'
            and request_item.value ? 'normalizedConditionLevelId'
            and request_item.value ? 'reportedFibreMaterialId'
            and request_item.value ? 'normalizedFibreMaterialId'
            and request_item.value ? 'reportedSurfaceConstructionId'
            and request_item.value ? 'normalizedSurfaceConstructionId'
            and request_item.value ? 'areaHundredthsM2'
            and request_item.value ? 'seatCount'
            and request_item.value ? 'sides'
            and request_item.value ? 'customerDescription'
            and request_item.value ? 'normalizedDescription'
            and (
              jsonb_typeof(request_item.value -> 'customerReportedConditionLevelId') = 'null'
              or case when pg_input_is_valid(request_item.value ->> 'customerReportedConditionLevelId', 'integer')
                then (request_item.value ->> 'customerReportedConditionLevelId')::integer > 0
                else false end
            )
            and (
              jsonb_typeof(request_item.value -> 'normalizedConditionLevelId') = 'null'
              or case when pg_input_is_valid(request_item.value ->> 'normalizedConditionLevelId', 'integer')
                then (request_item.value ->> 'normalizedConditionLevelId')::integer > 0
                else false end
            )
            and (
              jsonb_typeof(request_item.value -> 'reportedFibreMaterialId') = 'null'
              or case when pg_input_is_valid(request_item.value ->> 'reportedFibreMaterialId', 'integer')
                then (request_item.value ->> 'reportedFibreMaterialId')::integer > 0
                else false end
            )
            and (
              jsonb_typeof(request_item.value -> 'normalizedFibreMaterialId') = 'null'
              or case when pg_input_is_valid(request_item.value ->> 'normalizedFibreMaterialId', 'integer')
                then (request_item.value ->> 'normalizedFibreMaterialId')::integer > 0
                else false end
            )
            and (
              jsonb_typeof(request_item.value -> 'reportedSurfaceConstructionId') = 'null'
              or case when pg_input_is_valid(request_item.value ->> 'reportedSurfaceConstructionId', 'integer')
                then (request_item.value ->> 'reportedSurfaceConstructionId')::integer > 0
                else false end
            )
            and (
              jsonb_typeof(request_item.value -> 'normalizedSurfaceConstructionId') = 'null'
              or case when pg_input_is_valid(request_item.value ->> 'normalizedSurfaceConstructionId', 'integer')
                then (request_item.value ->> 'normalizedSurfaceConstructionId')::integer > 0
                else false end
            )
            and (
              jsonb_typeof(request_item.value -> 'areaHundredthsM2') = 'null'
              or case when pg_input_is_valid(request_item.value ->> 'areaHundredthsM2', 'integer')
                then (request_item.value ->> 'areaHundredthsM2')::integer > 0
                else false end
            )
            and (
              jsonb_typeof(request_item.value -> 'seatCount') = 'null'
              or case when pg_input_is_valid(request_item.value ->> 'seatCount', 'integer')
                then (request_item.value ->> 'seatCount')::integer > 0
                else false end
            )
            and (
              jsonb_typeof(request_item.value -> 'sides') = 'null'
              or case when pg_input_is_valid(request_item.value ->> 'sides', 'integer')
                then (request_item.value ->> 'sides')::integer in (1, 2)
                else false end
            )
            and jsonb_typeof(request_item.value -> 'customerDescription') = 'string'
            and length(trim(request_item.value ->> 'customerDescription')) > 0
            and (
              jsonb_typeof(request_item.value -> 'normalizedDescription') = 'null'
              or (
                jsonb_typeof(request_item.value -> 'normalizedDescription') = 'string'
                and length(trim(request_item.value ->> 'normalizedDescription')) > 0
              )
            )
            and jsonb_typeof(request_item.value -> 'issues') = 'array'
            and jsonb_typeof(request_item.value -> 'addons') = 'array'
            and not exists (
              select 1
              from jsonb_array_elements(
                case when jsonb_typeof(request_item.value -> 'issues') = 'array'
                  then request_item.value -> 'issues' else '[]'::jsonb end
              ) issue(value)
              where jsonb_typeof(issue.value) <> 'object'
                or not (issue.value ? 'issueTypeId')
                or not (case when pg_input_is_valid(
                    issue.value ->> 'issueTypeId', 'integer'
                  ) then (issue.value ->> 'issueTypeId')::integer > 0
                  else false end)
                or jsonb_typeof(issue.value -> 'customerReported') <> 'boolean'
                or jsonb_typeof(issue.value -> 'staffConfirmed') <> 'boolean'
                or (issue.value -> 'customerReported' <> 'true'::jsonb
                  and issue.value -> 'staffConfirmed' <> 'true'::jsonb)
                or not (issue.value ? 'notes')
                or jsonb_typeof(issue.value -> 'notes') not in ('null', 'string')
                or (jsonb_typeof(issue.value -> 'notes') = 'string'
                  and length(trim(issue.value ->> 'notes')) = 0)
            )
            and (
              select count(*) = count(distinct case
                when pg_input_is_valid(issue.value ->> 'issueTypeId', 'integer')
                  then (issue.value ->> 'issueTypeId')::integer end)
              from jsonb_array_elements(
                case when jsonb_typeof(request_item.value -> 'issues') = 'array'
                  then request_item.value -> 'issues' else '[]'::jsonb end
              ) issue(value)
            )
            and not exists (
              select 1
              from jsonb_array_elements(
                case when jsonb_typeof(request_item.value -> 'issues') = 'array'
                  then request_item.value -> 'issues' else '[]'::jsonb end
              ) issue(value)
              where not exists (
                select 1 from ${issueTypes} source_issue
                where source_issue.id = case when pg_input_is_valid(
                    issue.value ->> 'issueTypeId', 'integer'
                  ) then (issue.value ->> 'issueTypeId')::integer end
              )
            )
            and not exists (
              select 1
              from jsonb_array_elements(
                case when jsonb_typeof(request_item.value -> 'addons') = 'array'
                  then request_item.value -> 'addons' else '[]'::jsonb end
              ) addon(value)
              where jsonb_typeof(addon.value) <> 'object'
                or not (addon.value ? 'addonId')
                or not (case when pg_input_is_valid(
                    addon.value ->> 'addonId', 'integer'
                  ) then (addon.value ->> 'addonId')::integer > 0
                  else false end)
                or jsonb_typeof(addon.value -> 'customerRequested') <> 'boolean'
                or jsonb_typeof(addon.value -> 'staffIncluded') <> 'boolean'
                or (addon.value -> 'customerRequested' <> 'true'::jsonb
                  and addon.value -> 'staffIncluded' <> 'true'::jsonb)
                or not (addon.value ? 'notes')
                or jsonb_typeof(addon.value -> 'notes') not in ('null', 'string')
                or (jsonb_typeof(addon.value -> 'notes') = 'string'
                  and length(trim(addon.value ->> 'notes')) = 0)
            )
            and (
              select count(*) = count(distinct case
                when pg_input_is_valid(addon.value ->> 'addonId', 'integer')
                  then (addon.value ->> 'addonId')::integer end)
              from jsonb_array_elements(
                case when jsonb_typeof(request_item.value -> 'addons') = 'array'
                  then request_item.value -> 'addons' else '[]'::jsonb end
              ) addon(value)
            )
            and not exists (
              select 1
              from jsonb_array_elements(
                case when jsonb_typeof(request_item.value -> 'addons') = 'array'
                  then request_item.value -> 'addons' else '[]'::jsonb end
              ) addon(value)
              where not exists (
                select 1 from ${serviceAddons} source_addon
                where source_addon.id = case when pg_input_is_valid(
                    addon.value ->> 'addonId', 'integer'
                  ) then (addon.value ->> 'addonId')::integer end
              )
            )
          as fields_valid
        from guarded_source
        cross join lateral jsonb_array_elements(
          guarded_source.acceptance_source_snapshot #> '{request,items}'
        ) request_item(value)
      ),
      quote_source as materialized (
        select quote_item.value as snapshot,
          case when pg_input_is_valid(quote_item.value ->> 'id', 'uuid')
            then (quote_item.value ->> 'id')::uuid end as quote_item_id,
          case when pg_input_is_valid(quote_item.value ->> 'requestItemId', 'uuid')
            then (quote_item.value ->> 'requestItemId')::uuid end as request_item_id,
          case when pg_input_is_valid(quote_item.value ->> 'serviceId', 'integer')
            then (quote_item.value ->> 'serviceId')::integer end as service_id,
          case when pg_input_is_valid(quote_item.value ->> 'cleaningItemTypeId', 'integer')
            then (quote_item.value ->> 'cleaningItemTypeId')::integer end as cleaning_item_type_id,
          case when pg_input_is_valid(quote_item.value ->> 'measurementModeId', 'integer')
            then (quote_item.value ->> 'measurementModeId')::integer end as measurement_mode_id,
          case when pg_input_is_valid(quote_item.value ->> 'quantity', 'integer')
            then (quote_item.value ->> 'quantity')::integer end as quantity,
          case when pg_input_is_valid(quote_item.value ->> 'sortOrder', 'integer')
            then (quote_item.value ->> 'sortOrder')::integer end as sort_order,
          quote_item.value ->> 'descriptionBg' as description_bg,
          quote_item.value ->> 'descriptionEn' as description_en,
          quote_item.value -> 'measurementSnapshot' as measurement_snapshot,
          jsonb_typeof(quote_item.value) = 'object'
            and pg_input_is_valid(quote_item.value ->> 'id', 'uuid')
            and pg_input_is_valid(quote_item.value ->> 'requestItemId', 'uuid')
            and case when pg_input_is_valid(quote_item.value ->> 'serviceId', 'integer')
              then (quote_item.value ->> 'serviceId')::integer > 0 else false end
            and case when pg_input_is_valid(quote_item.value ->> 'cleaningItemTypeId', 'integer')
              then (quote_item.value ->> 'cleaningItemTypeId')::integer > 0 else false end
            and case when pg_input_is_valid(quote_item.value ->> 'measurementModeId', 'integer')
              then (quote_item.value ->> 'measurementModeId')::integer > 0 else false end
            and case when pg_input_is_valid(quote_item.value ->> 'quantity', 'integer')
              then (quote_item.value ->> 'quantity')::integer > 0 else false end
            and case when pg_input_is_valid(quote_item.value ->> 'sortOrder', 'integer')
              then (quote_item.value ->> 'sortOrder')::integer >= 0 else false end
            and jsonb_typeof(quote_item.value -> 'descriptionBg') = 'string'
            and jsonb_typeof(quote_item.value -> 'descriptionEn') = 'string'
            and jsonb_typeof(quote_item.value -> 'measurementSnapshot') = 'object'
          as fields_valid
        from guarded_source
        cross join lateral jsonb_array_elements(
          guarded_source.acceptance_source_snapshot -> 'quoteItems'
        ) quote_item(value)
      ),
      matched_items as materialized (
        select booking_item.id as booking_item_id,
          booking_item.booking_id, target.property_id,
          request_source.request_item_id,
          request_source.request_item_version,
          request_source.cleaning_asset_id,
          request_source.service_id,
          request_source.cleaning_item_type_id,
          request_source.measurement_mode_id,
          request_source.customer_condition_id,
          request_source.normalized_condition_id,
          request_source.reported_fibre_id,
          request_source.normalized_fibre_id,
          request_source.reported_construction_id,
          request_source.normalized_construction_id,
          quote_source.description_bg, quote_source.description_en,
          request_source.customer_description,
          request_source.normalized_description,
          request_source.quantity, request_source.area_hundredths_m2,
          request_source.seat_count, request_source.sides,
          quote_source.measurement_snapshot,
          request_source.snapshot as source_scope_snapshot,
          jsonb_build_object(
            'schemaVersion', 1,
            'customerReportedConditionLevelId', request_source.customer_condition_id,
            'staffNormalizedConditionLevelId', request_source.normalized_condition_id,
            'customerReportedFibreMaterialId', request_source.reported_fibre_id,
            'staffNormalizedFibreMaterialId', request_source.normalized_fibre_id,
            'customerReportedSurfaceConstructionId', request_source.reported_construction_id,
            'staffNormalizedSurfaceConstructionId', request_source.normalized_construction_id,
            'reportedIssues', request_source.issues,
            'quotedAddons', request_source.addons
          ) as treatment_assumptions,
          quote_source.sort_order
        from target
        join ${bookingItems} booking_item
          on booking_item.booking_id = target.booking_id
         and booking_item.request_item_id is not null
        join request_source
          on request_source.request_item_id = booking_item.request_item_id
         and request_source.fields_valid = true
        join quote_source
          on quote_source.quote_item_id = booking_item.quote_item_id
         and quote_source.request_item_id = booking_item.request_item_id
         and quote_source.fields_valid = true
        where booking_item.service_id = request_source.service_id
          and booking_item.service_id = quote_source.service_id
          and booking_item.cleaning_item_type_id = request_source.cleaning_item_type_id
          and booking_item.cleaning_item_type_id = quote_source.cleaning_item_type_id
          and booking_item.measurement_mode_id = request_source.measurement_mode_id
          and booking_item.measurement_mode_id = quote_source.measurement_mode_id
          and booking_item.quantity = request_source.quantity
          and booking_item.quantity = quote_source.quantity
          and booking_item.description_bg = quote_source.description_bg
          and booking_item.description_en = quote_source.description_en
          and booking_item.measurement_snapshot = quote_source.measurement_snapshot
          and booking_item.sort_order = quote_source.sort_order
      ),
      integrity as materialized (
        select target.*,
          (select count(*)::integer from ${bookingItems} line
            where line.booking_id = target.booking_id
              and line.request_item_id is not null) as executable_line_count,
          (select count(*)::integer from request_source) as request_item_count,
          (select count(*)::integer from quote_source) as quote_item_count,
          (select count(*)::integer from matched_items) as matched_item_count,
          coalesce((
            select bool_and(request_source.fields_valid)
            from request_source
          ), false) as request_items_valid,
          not exists (
            select 1 from request_source source_item
            where source_item.cleaning_asset_id is not null
              and not exists (
                select 1 from ${cleaningAssets} asset
                where asset.id = source_item.cleaning_asset_id
                  and asset.property_id = target.property_id
                  and asset.cleaning_item_type_id = source_item.cleaning_item_type_id
                  and asset.status <> 'ARCHIVED'
              )
          ) as asset_references_valid,
          exists (
            select 1 from guarded_source
            where guarded_source.acceptance_source_snapshot #>> '{quote,id}' = guarded_source.quote_id::text
              and guarded_source.acceptance_source_snapshot #>> '{quote,quoteReference}' = guarded_source.quote_reference
              and guarded_source.acceptance_source_snapshot #>> '{quote,quoteVersion}' = guarded_source.quote_version::text
              and guarded_source.acceptance_source_snapshot #>> '{quote,recordVersion}' = guarded_source.quote_record_version::text
              and guarded_source.acceptance_source_snapshot #>> '{quote,status}' = 'ISSUED'
              and guarded_source.acceptance_source_snapshot #>> '{quote,requestId}' = guarded_source.request_id::text
              and guarded_source.acceptance_source_snapshot #>> '{quote,sourceRequestVersion}' = guarded_source.source_request_version::text
              and guarded_source.acceptance_source_snapshot #>> '{quote,customerId}' = guarded_source.customer_id::text
              and guarded_source.acceptance_source_snapshot #>> '{quote,propertyId}' = guarded_source.property_id::text
              and guarded_source.acceptance_source_snapshot #>> '{request,id}' = guarded_source.request_id::text
              and guarded_source.acceptance_source_snapshot #>> '{request,customerId}' = guarded_source.customer_id::text
              and guarded_source.acceptance_source_snapshot #>> '{request,propertyId}' = guarded_source.property_id::text
              and guarded_source.acceptance_source_snapshot #>> '{customer,id}' = guarded_source.customer_id::text
              and guarded_source.acceptance_source_snapshot #>> '{property,id}' = guarded_source.property_id::text
              and guarded_source.acceptance_source_snapshot #>> '{property,customerId}' = guarded_source.customer_id::text
              and guarded_source.acceptance_source_snapshot #> '{quote,commercialSnapshot}' = guarded_source.accepted_commercial_snapshot
              and guarded_source.acceptance_source_snapshot #> '{quote,termsSnapshot}' = guarded_source.accepted_terms_snapshot
              and guarded_source.booking_price_snapshot = guarded_source.accepted_pricing_snapshot
              and guarded_source.booking_duration_snapshot = guarded_source.accepted_duration_snapshot
              and guarded_source.accepted_provenance_snapshot ->> 'quoteSourceSnapshotMatched' = 'true'
              and guarded_source.accepted_provenance_snapshot ->> 'requestSourceSnapshotMatched' = 'true'
              and guarded_source.accepted_provenance_snapshot ->> 'requestNormalizationPreserved' = 'true'
              and guarded_source.acceptance_source_snapshot #>> '{quote,estimateId}'
                = guarded_source.acceptance_source_snapshot #>> '{estimate,id}'
              and guarded_source.acceptance_source_snapshot #>> '{estimate,requestId}'
                = guarded_source.request_id::text
              and guarded_source.acceptance_source_snapshot #>> '{estimate,sourceRequestVersion}'
                = guarded_source.source_request_version::text
              and guarded_source.accepted_provenance_snapshot ->> 'issuedRequestVersion'
                = guarded_source.acceptance_source_snapshot #>> '{request,version}'
              and guarded_source.accepted_provenance_snapshot ->> 'estimateId'
                = guarded_source.acceptance_source_snapshot #>> '{estimate,id}'
              and guarded_source.accepted_provenance_snapshot ->> 'estimateVersion'
                = guarded_source.acceptance_source_snapshot #>> '{estimate,estimateVersion}'
              and guarded_source.accepted_provenance_snapshot ->> 'customerSegment'
                = guarded_source.acceptance_source_snapshot #>> '{estimate,inputSnapshot,customerSegment}'
              and guarded_source.accepted_provenance_snapshot ->> 'travelZoneCode'
                = guarded_source.acceptance_source_snapshot #>> '{travelZone,code}'
          ) as source_provenance_valid,
          exists (
            select 1 from current_occupancy occupancy
            where target.booking_status = 'CONFIRMED'
              and target.scheduling_status = 'SCHEDULED'
              and occupancy.status = 'CONFIRMED'
              and occupancy.service_start = target.scheduled_start
              and occupancy.service_end = target.scheduled_end
              and occupancy.team_id = target.assigned_team_id
              and occupancy.equipment_resource_id is not distinct from target.assigned_equipment_resource_id
              and occupancy.service_duration_minutes > 0
              and occupancy.team_active = true
              and occupancy.team_capabilities_satisfied = true
              and (
                occupancy.equipment_resource_id is null
                or (
                  occupancy.equipment_active = true
                  and occupancy.equipment_status = 'ACTIVE'
                  and occupancy.equipment_assigned = true
                )
              )
          ) as exact_schedule_valid,
          case
            when exists (select 1 from current_occupancy occupancy
              where occupancy.service_duration_minutes > 0)
              then (select occupancy.service_duration_minutes from current_occupancy occupancy limit 1)
            when pg_input_is_valid(target.booking_duration_snapshot ->> 'quotedDurationMinutes', 'integer')
              then (target.booking_duration_snapshot ->> 'quotedDurationMinutes')::integer
          end as planned_duration_minutes
        from target
      ),
      decision as materialized (
        select case
            when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
            when integrity.existing_job_reference is not null then 'EXISTING'
            when integrity.booking_version <> ${input.expectedBookingVersion} then 'INELIGIBLE'
            when integrity.booking_status = 'CANCELLED' then 'INELIGIBLE'
            when integrity.booking_status not in ('PENDING_SCHEDULING', 'CONFIRMED') then 'INELIGIBLE'
            when not integrity.source_provenance_valid then 'INELIGIBLE'
            when integrity.executable_line_count <= 0
              or integrity.executable_line_count <> integrity.request_item_count
              or integrity.executable_line_count <> integrity.quote_item_count
              or integrity.executable_line_count <> integrity.matched_item_count
              or case when pg_input_is_valid(
                  integrity.accepted_provenance_snapshot ->> 'quoteItemCount',
                  'integer'
                ) then
                  (integrity.accepted_provenance_snapshot ->> 'quoteItemCount')::integer
                    <> integrity.quote_item_count
                else true end
              or not integrity.request_items_valid
              then 'INELIGIBLE'
            when not integrity.asset_references_valid then 'INELIGIBLE'
            when integrity.planned_duration_minutes is null
              or integrity.planned_duration_minutes <= 0 then 'INELIGIBLE'
            else 'CREATE'
          end as result,
          case when integrity.exact_schedule_valid then 'READY' else 'PREPARED' end as job_status,
          coalesce((select jsonb_agg(reason.code order by reason.sort_order)
            from (values
              (10, case when integrity.booking_version <> ${input.expectedBookingVersion} then 'BOOKING_VERSION_CONFLICT' end),
              (20, case when integrity.booking_status = 'CANCELLED' then 'BOOKING_CANCELLED' end),
              (30, case when not integrity.source_provenance_valid then 'BOOKING_QUOTE_PROVENANCE_INCONSISTENT' end),
              (40, case when integrity.executable_line_count <= 0 then 'BOOKING_ITEMS_INCOMPLETE' end),
              (50, case when integrity.executable_line_count <> integrity.request_item_count or integrity.executable_line_count <> integrity.quote_item_count or integrity.executable_line_count <> integrity.matched_item_count or not pg_input_is_valid(integrity.accepted_provenance_snapshot ->> 'quoteItemCount', 'integer') or (case when pg_input_is_valid(integrity.accepted_provenance_snapshot ->> 'quoteItemCount', 'integer') then (integrity.accepted_provenance_snapshot ->> 'quoteItemCount')::integer end) <> integrity.quote_item_count or not integrity.request_items_valid then 'BOOKING_ITEMS_DO_NOT_MATCH_ISSUED_SNAPSHOT' end),
              (60, case when not integrity.asset_references_valid then 'ASSET_REFERENCE_INCONSISTENT' end),
              (70, case when integrity.planned_duration_minutes is null or integrity.planned_duration_minutes <= 0 then 'BOOKING_ITEMS_INCOMPLETE' end),
              (80, case when integrity.booking_status <> 'CONFIRMED' then 'BOOKING_NOT_CONFIRMED' end),
              (90, case when integrity.scheduling_status = 'UNSCHEDULED' then 'SCHEDULE_UNSCHEDULED' end),
              (100, case when integrity.scheduling_status = 'REVIEW_REQUIRED' then 'SCHEDULE_REVIEW_REQUIRED' end),
              (110, case when not integrity.exact_schedule_valid then 'CONFIRMED_OCCUPANCY_INCONSISTENT' end)
            ) reason(sort_order, code)
            where reason.code is not null), '[]'::jsonb) as reason_codes
        from integrity
        union all
        select 'NOT_FOUND_OR_FORBIDDEN', null, '[]'::jsonb
        where not exists (select 1 from integrity)
      ),
      created_job as (
        insert into ${jobs} (
          job_reference, booking_id, source_booking_version,
          source_occupancy_id, source_occupancy_snapshot_version,
          customer_id, property_id, assigned_team_id,
          assigned_equipment_resource_id, status,
          scheduled_start_snapshot, scheduled_end_snapshot,
          planned_service_duration_minutes, planned_team_size,
          source_provenance_snapshot, scheduling_snapshot,
          planned_duration_snapshot, property_access_snapshot,
          visit_contact_snapshot, created_by_profile_id, updated_by_profile_id
        )
        select ${input.jobReference}, integrity.booking_id,
          integrity.booking_version,
          case when decision.job_status = 'READY' then occupancy.id end,
          case when decision.job_status = 'READY' then occupancy.snapshot_version end,
          integrity.customer_id, integrity.property_id,
          case when decision.job_status = 'READY' then occupancy.team_id end,
          case when decision.job_status = 'READY' then occupancy.equipment_resource_id end,
          decision.job_status,
          case when decision.job_status = 'READY' then occupancy.service_start end,
          case when decision.job_status = 'READY' then occupancy.service_end end,
          integrity.planned_duration_minutes,
          case when decision.job_status = 'READY' then occupancy.default_crew_size end,
          jsonb_build_object(
            'schemaVersion', 1,
            'bookingReference', integrity.booking_reference,
            'bookingVersion', integrity.booking_version,
            'quoteReference', integrity.quote_reference,
            'quoteVersion', integrity.quote_version,
            'sourceRequestVersion', integrity.source_request_version,
            'issuedAt', integrity.issued_at,
            'customerDisplayName', integrity.acceptance_source_snapshot #> '{customer,displayName}',
            'customerServiceNotes', integrity.acceptance_source_snapshot #> '{quote,customerNotes}',
            'itemCount', integrity.executable_line_count,
            'requestNormalizationPreserved', true,
            'commercialTermsPreserved', true
          ),
          jsonb_build_object(
            'schemaVersion', 1,
            'status', decision.job_status,
            'reviewReasonCodes', decision.reason_codes,
            'sourceOccupancyId', case when decision.job_status = 'READY' then occupancy.id end,
            'sourceOccupancySnapshotVersion', case when decision.job_status = 'READY' then occupancy.snapshot_version end,
            'teamCode', case when decision.job_status = 'READY' then occupancy.team_code end,
            'equipmentResourceId', case when decision.job_status = 'READY' then occupancy.equipment_resource_id end,
            'schedulingPolicyCode', case when decision.job_status = 'READY' then occupancy.scheduling_policy_code end,
            'schedulingPolicyVersion', case when decision.job_status = 'READY' then occupancy.scheduling_policy_version end
          ),
          integrity.booking_duration_snapshot,
          jsonb_build_object(
            'schemaVersion', 1,
            'propertyLabel', integrity.acceptance_source_snapshot #> '{property,label}',
            'streetAddress', integrity.acceptance_source_snapshot #> '{property,streetAddress}',
            'city', integrity.acceptance_source_snapshot #> '{property,city}',
            'district', integrity.acceptance_source_snapshot #> '{property,district}',
            'postalCode', integrity.acceptance_source_snapshot #> '{property,postalCode}',
            'accessNotes', integrity.acceptance_source_snapshot #> '{property,accessNotes}',
            'parkingNotes', integrity.acceptance_source_snapshot #> '{property,parkingNotes}'
          ),
          integrity.visit_contact_snapshot,
          ${actorProfileId}::uuid, ${actorProfileId}::uuid
        from integrity
        join decision on decision.result = 'CREATE'
        left join current_occupancy occupancy on integrity.exact_schedule_valid
        returning *
      ),
      copied_items as (
        insert into ${jobItems} (
          job_id, booking_id, property_id, booking_item_id,
          source_request_item_id, source_request_item_version,
          cleaning_asset_id, service_id, cleaning_item_type_id,
          measurement_mode_id, customer_reported_condition_level_id,
          staff_normalized_condition_level_id,
          customer_reported_fibre_material_id,
          staff_normalized_fibre_material_id,
          customer_reported_surface_construction_id,
          staff_normalized_surface_construction_id,
          customer_visible_description_bg, customer_visible_description_en,
          customer_description_snapshot,
          staff_normalized_description_snapshot, quantity,
          area_hundredths_m2, seat_count, sides,
          planned_measurement_snapshot,
          planned_treatment_assumptions_snapshot,
          source_scope_snapshot, sort_order
        )
        select created_job.id, matched_items.booking_id,
          matched_items.property_id, matched_items.booking_item_id,
          matched_items.request_item_id, matched_items.request_item_version,
          matched_items.cleaning_asset_id, matched_items.service_id,
          matched_items.cleaning_item_type_id,
          matched_items.measurement_mode_id,
          matched_items.customer_condition_id,
          matched_items.normalized_condition_id,
          matched_items.reported_fibre_id,
          matched_items.normalized_fibre_id,
          matched_items.reported_construction_id,
          matched_items.normalized_construction_id,
          matched_items.description_bg, matched_items.description_en,
          matched_items.customer_description,
          matched_items.normalized_description,
          matched_items.quantity, matched_items.area_hundredths_m2,
          matched_items.seat_count, matched_items.sides,
          matched_items.measurement_snapshot,
          matched_items.treatment_assumptions,
          matched_items.source_scope_snapshot,
          matched_items.sort_order
        from created_job
        join matched_items on true
        returning id
      ),
      audited as (
        insert into ${jobAuditEvents} (
          job_id, event_type, actor_profile_id, source,
          previous_status, next_status, safe_metadata
        )
        select created_job.id, event.event_type,
          ${actorProfileId}::uuid, 'STAFF', null,
          created_job.status,
          jsonb_build_object(
            'bookingReference', integrity.booking_reference,
            'jobStatus', created_job.status
          )
        from created_job
        join integrity on integrity.booking_id = created_job.booking_id
        cross join lateral (values ('JOB_CREATED'), ('JOB_READY')) event(event_type)
        where event.event_type = 'JOB_CREATED'
          or created_job.status = 'READY'
        returning id
      )
      select case
          when decision.result = 'CREATE'
            and created_job.id is not null
            and (select count(*) from copied_items) = integrity.executable_line_count
            and (select count(*) from audited) = case when created_job.status = 'READY' then 2 else 1 end
          then 'CREATED'
          else decision.result
        end::text as result,
        coalesce(created_job.job_reference, integrity.existing_job_reference)
          as "jobReference",
        coalesce(created_job.status, integrity.existing_job_status,
          decision.job_status)::text as "jobStatus",
        decision.reason_codes as "reasonCodes"
      from decision
      left join integrity on true
      left join created_job on true
    `);
    return creationResult(result.rows[0]);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return (
      (await loadExistingJobForBooking(
        database,
        actorProfileId,
        input.bookingReference,
      )) ?? { status: "REFERENCE_CONFLICT" }
    );
  }
}

type SummaryRow = JobListSummary & { totalCount?: number };

export async function listJobRecords(
  database: Database,
  actorProfileId: string,
  input: JobListInput,
): Promise<JobPage> {
  const access = jobReadSql(actorProfileId, sql`job.assigned_team_id`);
  const filters = and(
    access,
    input.search
      ? sql`(
          job.job_reference ilike ${`%${input.search}%`}
          or booking.booking_reference ilike ${`%${input.search}%`}
          or job.source_provenance_snapshot ->> 'customerDisplayName'
            ilike ${`%${input.search}%`}
          or job.property_access_snapshot ->> 'propertyLabel'
            ilike ${`%${input.search}%`}
        )`
      : undefined,
    input.status ? sql`job.status = ${input.status}` : undefined,
    input.teamId ? sql`job.assigned_team_id = ${input.teamId}` : undefined,
    input.scheduledFrom
      ? sql`job.scheduled_start_snapshot >= ${input.scheduledFrom}`
      : undefined,
    input.scheduledTo
      ? sql`job.scheduled_start_snapshot < ${input.scheduledTo}`
      : undefined,
    input.manualReviewRequired === undefined
      ? undefined
      : input.manualReviewRequired
        ? sql`job.status in ('PREPARED', 'REQUIRES_REVIEW')`
        : sql`job.status not in ('PREPARED', 'REQUIRES_REVIEW')`,
  )!;
  const result = await database.execute<SummaryRow>(sql`
    select job.job_reference as "jobReference",
      booking.booking_reference as "bookingReference",
      job.status,
      (job.status in ('PREPARED', 'REQUIRES_REVIEW'))
        as "manualReviewRequired",
      job.scheduled_start_snapshot as "scheduledStart",
      job.scheduled_end_snapshot as "scheduledEnd",
      job.source_provenance_snapshot ->> 'customerDisplayName'
        as "customerDisplayName",
      job.property_access_snapshot ->> 'propertyLabel' as "propertyLabel",
      nullif(job.property_access_snapshot ->> 'accessNotes', '')
        as "accessInstructions",
      concat_ws(', ',
        nullif(job.property_access_snapshot ->> 'streetAddress', ''),
        nullif(job.property_access_snapshot ->> 'district', ''),
        nullif(job.property_access_snapshot ->> 'city', ''),
        nullif(job.property_access_snapshot ->> 'postalCode', '')
      ) as "propertyAddress",
      team.code as "assignedTeamCode", team.name as "assignedTeamName",
      (select count(*)::integer from ${jobItems} item
        where item.job_id = job.id) as "itemCount",
      job.version, job.created_at as "createdAt",
      job.updated_at as "updatedAt",
      count(*) over()::integer as "totalCount"
    from ${jobs} job
    join ${bookings} booking on booking.id = job.booking_id
    left join ${operationsTeams} team on team.id = job.assigned_team_id
    where ${filters}
    order by job.scheduled_start_snapshot asc nulls last,
      job.created_at desc, job.job_reference
    limit ${input.limit} offset ${input.offset}
  `);
  return {
    items: result.rows.map((row) => {
      const summary = { ...row };
      delete summary.totalCount;
      return summary;
    }),
    total: result.rows[0]?.totalCount ?? 0,
    limit: input.limit,
    offset: input.offset,
  };
}

type DetailHeaderRow = JobSummary & {
  accessScope: "STAFF" | "ASSIGNED_TEAM";
  propertyAccessSnapshot: unknown;
  visitContactSnapshot: unknown;
  sourceProvenanceSnapshot: unknown;
  schedulingSnapshot: unknown;
  plannedDurationMinutes: number;
  enRouteAt: Date | null;
  arrivedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  actualProductiveMinutes: number | null;
  actualOccupiedTeamMinutes: number | null;
  internalCompletionNotes: string | null;
};

type DetailItemRow = {
  id: string;
  status: JobItemDetail["status"];
  version: number;
  bookingItemId: string;
  sourceRequestItemId: string;
  cleaningAssetId: string | null;
  serviceId: number;
  cleaningItemTypeId: number;
  descriptionBg: string;
  descriptionEn: string;
  customerDescription: string | null;
  measurementModeId: number;
  quantity: number;
  areaHundredthsM2: number | null;
  seatCount: number | null;
  sides: 1 | 2 | null;
  plannedConditionLevelId: number | null;
  plannedFibreMaterialId: number | null;
  plannedSurfaceConstructionId: number | null;
  quotedAddonIds: unknown;
  treatmentAssumptions: unknown;
  sortOrder: number;
  inspection: unknown;
  treatmentPlan: unknown;
  treatmentExecution: unknown;
};

function mapInspection(value: unknown): JobItemDetail["inspection"] {
  if (!value) return null;
  const row = object(value);
  const measurement = object(row.observedMeasurement);
  return {
    id: String(row.id ?? ""),
    sourceJobItemVersion: integerOrNull(row.sourceJobItemVersion) ?? 1,
    observedCleaningItemTypeId:
      integerOrNull(row.observedCleaningItemTypeId) ?? 0,
    observedMeasurement: {
      measurementModeId: integerOrNull(measurement.measurementModeId) ?? 0,
      quantity: integerOrNull(measurement.quantity) ?? 0,
      areaHundredthsM2: integerOrNull(measurement.areaHundredthsM2),
      seatCount: integerOrNull(measurement.seatCount),
      sides: integerOrNull(measurement.sides) as 1 | 2 | null,
    },
    observedConditionLevelId:
      integerOrNull(row.observedConditionLevelId) ?? 0,
    observedConditionCode: String(
      row.observedConditionCode ?? "NORMAL",
    ) as NonNullable<JobItemDetail["inspection"]>["observedConditionCode"],
    confirmedFibreMaterialId:
      integerOrNull(row.confirmedFibreMaterialId) ?? 0,
    confirmedSurfaceConstructionId:
      integerOrNull(row.confirmedSurfaceConstructionId) ?? 0,
    existingDamageObserved: row.existingDamageObserved === true,
    existingDamageNotes:
      typeof row.existingDamageNotes === "string"
        ? row.existingDamageNotes
        : null,
    colourfastnessConcern: row.colourfastnessConcern === true,
    moistureSensitivity: row.moistureSensitivity === true,
    unsafeContaminationObserved: row.unsafeContaminationObserved === true,
    unsafeStructuralConditionObserved:
      row.unsafeStructuralConditionObserved === true,
    technicianNotes:
      typeof row.technicianNotes === "string" ? row.technicianNotes : null,
    issues: Array.isArray(row.issues)
      ? row.issues.map((issue) => {
          const item = object(issue);
          return {
            issueTypeId: integerOrNull(item.issueTypeId) ?? 0,
            handlingClassification: String(
              item.handlingClassification ?? "ASSESSMENT_REQUIRED",
            ) as NonNullable<
              JobItemDetail["inspection"]
            >["issues"][number]["handlingClassification"],
            technicianNote:
              typeof item.technicianNote === "string"
                ? item.technicianNote
                : null,
          };
        })
      : [],
    risks: Array.isArray(row.risks)
      ? row.risks.map((risk) => {
          const item = object(risk);
          return {
            riskFlagId: integerOrNull(item.riskFlagId) ?? 0,
            code: String(item.code ?? "OTHER") as NonNullable<
              JobItemDetail["inspection"]
            >["risks"][number]["code"],
            technicianNote:
              typeof item.technicianNote === "string"
                ? item.technicianNote
                : null,
          };
        })
      : [],
    inspectedAt: dateRequired(row.inspectedAt),
    inspectedByProfileId:
      typeof row.inspectedByProfileId === "string"
        ? row.inspectedByProfileId
        : null,
  };
}

function mapTreatmentPlan(value: unknown): JobItemDetail["treatmentPlan"] {
  if (!value) return null;
  const row = object(value);
  return {
    id: String(row.id ?? ""),
    sourceJobItemVersion: integerOrNull(row.sourceJobItemVersion) ?? 1,
    decision: String(row.decision) as NonNullable<
      JobItemDetail["treatmentPlan"]
    >["decision"],
    treatmentLevelId: integerOrNull(row.treatmentLevelId),
    mechanicalActionLevelId: integerOrNull(row.mechanicalActionLevelId),
    treatmentApproachId: integerOrNull(row.treatmentApproachId),
    addonIds: numbers(row.addonIds),
    cleaningProductId: integerOrNull(row.cleaningProductId),
    materialScopeChange: row.materialScopeChange === true,
    technicianRationale: String(row.technicianRationale ?? ""),
    confirmedAt: dateRequired(row.confirmedAt),
    confirmedByProfileId:
      typeof row.confirmedByProfileId === "string"
        ? row.confirmedByProfileId
        : null,
  };
}

function mapTreatmentExecution(
  value: unknown,
): JobItemDetail["treatmentExecution"] {
  if (!value) return null;
  const row = object(value);
  return {
    id: String(row.id ?? ""),
    status: String(row.status) as NonNullable<
      JobItemDetail["treatmentExecution"]
    >["status"],
    performedTreatmentLevelId:
      integerOrNull(row.performedTreatmentLevelId) ?? 0,
    performedMechanicalActionLevelId:
      integerOrNull(row.performedMechanicalActionLevelId) ?? 0,
    performedTreatmentApproachId:
      integerOrNull(row.performedTreatmentApproachId) ?? 0,
    performedAddonIds: numbers(row.performedAddonIds),
    cleaningProductId: integerOrNull(row.cleaningProductId),
    technicianNotes:
      typeof row.technicianNotes === "string" ? row.technicianNotes : null,
    resultClassification:
      typeof row.resultClassification === "string"
        ? (row.resultClassification as NonNullable<
            JobItemDetail["treatmentExecution"]
          >["resultClassification"])
        : null,
    startedAt: dateRequired(row.startedAt),
    completedAt: dateOrNull(row.completedAt),
    performedByProfileId:
      typeof row.performedByProfileId === "string"
        ? row.performedByProfileId
        : null,
    version: integerOrNull(row.version) ?? 1,
  };
}

function mapDetailItem(row: DetailItemRow): JobItemDetail {
  const treatmentPlan = mapTreatmentPlan(row.treatmentPlan);
  return {
    id: row.id,
    status: row.status,
    planned: {
      bookingItemId: row.bookingItemId,
      requestItemId: row.sourceRequestItemId,
      cleaningAssetId: row.cleaningAssetId,
      serviceId: row.serviceId,
      cleaningItemTypeId: row.cleaningItemTypeId,
      descriptionBg: row.descriptionBg,
      descriptionEn: row.descriptionEn,
      customerDescription: row.customerDescription ?? "",
      measurement: {
        measurementModeId: row.measurementModeId,
        quantity: row.quantity,
        areaHundredthsM2: row.areaHundredthsM2,
        seatCount: row.seatCount,
        sides: row.sides,
      },
      plannedConditionLevelId: row.plannedConditionLevelId,
      plannedFibreMaterialId: row.plannedFibreMaterialId,
      plannedSurfaceConstructionId: row.plannedSurfaceConstructionId,
      quotedAddonIds: numbers(row.quotedAddonIds),
      treatmentAssumptions: object(row.treatmentAssumptions),
      sortOrder: row.sortOrder,
    },
    inspection: mapInspection(row.inspection),
    treatmentPlan,
    treatmentExecution: mapTreatmentExecution(row.treatmentExecution),
    resolutionReasonCategory:
      treatmentPlan?.decision === "DECLINE" || treatmentPlan?.decision === "REFER"
        ? "OTHER_RECORDED"
        : null,
    resolutionNotes:
      treatmentPlan?.decision === "DECLINE" || treatmentPlan?.decision === "REFER"
        ? treatmentPlan.technicianRationale
        : null,
    version: row.version,
  };
}

export async function loadJobRecord(
  database: Database,
  actorProfileId: string,
  jobReference: string,
): Promise<StaffJobDetail | TechnicianJobDetail | null> {
  const staffAccess = jobStaffReadSql(actorProfileId);
  const access = jobReadSql(actorProfileId, sql`job.assigned_team_id`);
  const headerResult = await database.execute<DetailHeaderRow>(sql`
    select job.job_reference as "jobReference",
      booking.booking_reference as "bookingReference", job.status,
      (job.status in ('PREPARED', 'REQUIRES_REVIEW'))
        as "manualReviewRequired",
      job.scheduled_start_snapshot as "scheduledStart",
      job.scheduled_end_snapshot as "scheduledEnd",
      job.source_provenance_snapshot ->> 'customerDisplayName'
        as "customerDisplayName",
      job.property_access_snapshot ->> 'propertyLabel' as "propertyLabel",
      concat_ws(', ',
        nullif(job.property_access_snapshot ->> 'streetAddress', ''),
        nullif(job.property_access_snapshot ->> 'district', ''),
        nullif(job.property_access_snapshot ->> 'city', ''),
        nullif(job.property_access_snapshot ->> 'postalCode', '')
      ) as "propertyAddress",
      team.code as "assignedTeamCode", team.name as "assignedTeamName",
      (select count(*)::integer from ${jobItems} item
        where item.job_id = job.id) as "itemCount",
      job.version, job.created_at as "createdAt",
      job.updated_at as "updatedAt",
      case when ${staffAccess} then 'STAFF' else 'ASSIGNED_TEAM' end
        as "accessScope",
      job.property_access_snapshot as "propertyAccessSnapshot",
      job.visit_contact_snapshot as "visitContactSnapshot",
      job.source_provenance_snapshot as "sourceProvenanceSnapshot",
      job.scheduling_snapshot as "schedulingSnapshot",
      job.planned_service_duration_minutes as "plannedDurationMinutes",
      job.en_route_at as "enRouteAt", job.arrived_at as "arrivedAt",
      job.started_at as "startedAt", job.completed_at as "completedAt",
      job.actual_productive_minutes as "actualProductiveMinutes",
      job.actual_occupied_team_minutes as "actualOccupiedTeamMinutes",
      case when ${staffAccess} then job.internal_completion_notes end
        as "internalCompletionNotes"
    from ${jobs} job
    join ${bookings} booking on booking.id = job.booking_id
    left join ${operationsTeams} team on team.id = job.assigned_team_id
    where job.job_reference = ${jobReference} and ${access}
    limit 1
  `);
  const header = headerResult.rows[0];
  if (!header) return null;

  const itemResult = await database.execute<DetailItemRow>(sql`
    select item.id, item.status, item.version,
      item.booking_item_id as "bookingItemId",
      item.source_request_item_id as "sourceRequestItemId",
      item.cleaning_asset_id as "cleaningAssetId",
      item.service_id as "serviceId",
      item.cleaning_item_type_id as "cleaningItemTypeId",
      item.customer_visible_description_bg as "descriptionBg",
      item.customer_visible_description_en as "descriptionEn",
      item.customer_description_snapshot as "customerDescription",
      item.measurement_mode_id as "measurementModeId",
      item.quantity, item.area_hundredths_m2 as "areaHundredthsM2",
      item.seat_count as "seatCount", item.sides,
      coalesce(item.staff_normalized_condition_level_id,
        item.customer_reported_condition_level_id) as "plannedConditionLevelId",
      coalesce(item.staff_normalized_fibre_material_id,
        item.customer_reported_fibre_material_id) as "plannedFibreMaterialId",
      coalesce(item.staff_normalized_surface_construction_id,
        item.customer_reported_surface_construction_id)
        as "plannedSurfaceConstructionId",
      coalesce((select jsonb_agg((addon.value ->> 'addonId')::integer
          order by (addon.value ->> 'addonId')::integer)
        from jsonb_array_elements(
          case when jsonb_typeof(item.planned_treatment_assumptions_snapshot -> 'quotedAddons') = 'array'
            then item.planned_treatment_assumptions_snapshot -> 'quotedAddons'
            else '[]'::jsonb end
        ) addon(value)
        where addon.value ->> 'staffIncluded' = 'true'
          and pg_input_is_valid(addon.value ->> 'addonId', 'integer')),
        '[]'::jsonb) as "quotedAddonIds",
      item.planned_treatment_assumptions_snapshot as "treatmentAssumptions",
      item.sort_order as "sortOrder",
      case when inspection.id is null then null else jsonb_build_object(
        'id', inspection.id,
        'sourceJobItemVersion', inspection.source_job_item_version,
        'observedCleaningItemTypeId', inspection.observed_cleaning_item_type_id,
        'observedMeasurement', jsonb_build_object(
          'measurementModeId', inspection.observed_measurement_mode_id,
          'quantity', inspection.observed_quantity,
          'areaHundredthsM2', inspection.observed_area_hundredths_m2,
          'seatCount', inspection.observed_seat_count,
          'sides', inspection.observed_sides
        ),
        'observedConditionLevelId', inspection.observed_condition_level_id,
        'observedConditionCode', observed_condition.code,
        'confirmedFibreMaterialId', inspection.confirmed_fibre_material_id,
        'confirmedSurfaceConstructionId', inspection.confirmed_surface_construction_id,
        'existingDamageObserved', inspection.existing_damage_present,
        'existingDamageNotes', inspection.existing_damage_notes,
        'colourfastnessConcern', inspection.colourfastness_concern,
        'moistureSensitivity', inspection.moisture_sensitivity,
        'unsafeContaminationObserved',
          inspection.unsafe_contamination_observed,
        'unsafeStructuralConditionObserved',
          inspection.unsafe_structural_condition_observed,
        'technicianNotes', inspection.internal_technician_notes,
        'issues', coalesce((select jsonb_agg(jsonb_build_object(
            'issueTypeId', observed_issue.issue_type_id,
            'handlingClassification', classification.code,
            'technicianNote', observed_issue.notes
          ) order by observed_issue.issue_type_id)
          from ${jobItemInspectionIssues} observed_issue
          join ${issueTypes} issue on issue.id = observed_issue.issue_type_id
          join ${issueHandlingClassifications} classification
            on classification.id = issue.handling_classification_id
          where observed_issue.inspection_id = inspection.id), '[]'::jsonb),
        'risks', coalesce((select jsonb_agg(jsonb_build_object(
            'riskFlagId', observed_risk.risk_flag_id,
            'code', risk.code,
            'technicianNote', observed_risk.notes
          ) order by observed_risk.risk_flag_id)
          from ${jobItemInspectionRisks} observed_risk
          join ${riskFlags} risk on risk.id = observed_risk.risk_flag_id
          where observed_risk.inspection_id = inspection.id), '[]'::jsonb),
        'inspectedAt', inspection.inspected_at,
        'inspectedByProfileId', inspection.inspected_by_profile_id
      ) end as inspection,
      case when plan.id is null then null else jsonb_build_object(
        'id', plan.id, 'sourceJobItemVersion', plan.source_job_item_version,
        'decision', plan.decision, 'treatmentLevelId', plan.treatment_level_id,
        'mechanicalActionLevelId', plan.mechanical_action_level_id,
        'treatmentApproachId', plan.treatment_approach_id,
        'addonIds', coalesce((select jsonb_agg(plan_addon.service_addon_id
          order by plan_addon.service_addon_id)
          from ${jobItemTreatmentPlanAddons} plan_addon
          where plan_addon.treatment_plan_id = plan.id), '[]'::jsonb),
        'cleaningProductId', plan.cleaning_product_id,
        'materialScopeChange', plan.material_scope_change,
        'technicianRationale', plan.technician_rationale,
        'confirmedAt', plan.confirmed_at,
        'confirmedByProfileId', plan.confirmed_by_profile_id
      ) end as "treatmentPlan",
      case when execution.id is null then null else jsonb_build_object(
        'id', execution.id, 'status', execution.status,
        'performedTreatmentLevelId', execution.performed_treatment_level_id,
        'performedMechanicalActionLevelId', execution.performed_mechanical_action_level_id,
        'performedTreatmentApproachId', execution.performed_treatment_approach_id,
        'performedAddonIds', coalesce(execution.performed_addons_snapshot -> 'addonIds', '[]'::jsonb),
        'cleaningProductId', execution.cleaning_product_id,
        'technicianNotes', execution.internal_technician_notes,
        'resultClassification', execution.result_classification,
        'startedAt', execution.started_at,
        'completedAt', execution.completed_at,
        'performedByProfileId', execution.performed_by_profile_id,
        'version', execution.version
      ) end as "treatmentExecution"
    from ${jobItems} item
    join ${jobs} job on job.id = item.job_id
    left join ${jobItemInspections} inspection
      on inspection.job_item_id = item.id
    left join ${conditionLevels} observed_condition
      on observed_condition.id = inspection.observed_condition_level_id
    left join ${jobItemTreatmentPlans} plan on plan.job_item_id = item.id
    left join ${jobItemTreatmentExecutions} execution
      on execution.job_item_id = item.id
    where job.job_reference = ${jobReference}
      and ${jobReadSql(actorProfileId, sql`job.assigned_team_id`)}
    order by item.sort_order, item.id
  `);

  const propertySnapshot = object(header.propertyAccessSnapshot);
  const contactSnapshot = object(header.visitContactSnapshot);
  const sourceSnapshot = object(header.sourceProvenanceSnapshot);
  const schedulingSnapshot = object(header.schedulingSnapshot);
  const base: TechnicianJobDetail = {
    jobReference: header.jobReference,
    bookingReference: header.bookingReference,
    status: header.status,
    manualReviewRequired: header.manualReviewRequired,
    scheduledStart: header.scheduledStart,
    scheduledEnd: header.scheduledEnd,
    customerDisplayName: header.customerDisplayName,
    propertyLabel: header.propertyLabel,
    propertyAddress: header.propertyAddress,
    assignedTeamCode: header.assignedTeamCode,
    assignedTeamName: header.assignedTeamName,
    itemCount: header.itemCount,
    version: header.version,
    createdAt: header.createdAt,
    updatedAt: header.updatedAt,
    property: {
      label: String(propertySnapshot.propertyLabel ?? header.propertyLabel),
      address: header.propertyAddress,
      accessNotes:
        typeof propertySnapshot.accessNotes === "string"
          ? propertySnapshot.accessNotes
          : null,
      parkingNotes:
        typeof propertySnapshot.parkingNotes === "string"
          ? propertySnapshot.parkingNotes
          : null,
    },
    visitContact:
      typeof contactSnapshot.contactName === "string"
        ? {
            contactName: contactSnapshot.contactName,
            email:
              typeof contactSnapshot.email === "string"
                ? contactSnapshot.email
                : null,
            phone:
              typeof contactSnapshot.phone === "string"
                ? contactSnapshot.phone
                : null,
          }
        : null,
    customerServiceNotes:
      typeof sourceSnapshot.customerServiceNotes === "string"
        ? sourceSnapshot.customerServiceNotes
        : null,
    plannedDurationMinutes: header.plannedDurationMinutes,
    enRouteAt: header.enRouteAt,
    arrivedAt: header.arrivedAt,
    startedAt: header.startedAt,
    completedAt: header.completedAt,
    actualProductiveMinutes: header.actualProductiveMinutes,
    actualOccupiedTeamMinutes: header.actualOccupiedTeamMinutes,
    items: itemResult.rows.map(mapDetailItem),
  };
  if (header.accessScope !== "STAFF") return base;

  const auditResult = await database.execute<
    StaffJobDetail["auditTimeline"][number]
  >(sql`
    select audit.event_type as "eventType", audit.source,
      audit.safe_metadata as "safeMetadata", audit.created_at as "createdAt"
    from ${jobAuditEvents} audit
    join ${jobs} job on job.id = audit.job_id
    where job.job_reference = ${jobReference}
      and ${jobStaffReadSql(actorProfileId)}
    order by audit.created_at, audit.id
  `);
  return {
    ...base,
    internalCompletionNotes: header.internalCompletionNotes,
    preparationReviewReasonCodes: strings(
      schedulingSnapshot.reviewReasonCodes,
    ) as StaffJobDetail["preparationReviewReasonCodes"],
    auditTimeline: auditResult.rows,
  };
}

type MutationRow = {
  result: string;
  jobReference: string | null;
  version: number | null;
  reasonCodes?: unknown;
};

function mutationResult(row: MutationRow | undefined): JobMutationResult {
  if (!row || row.result === "NOT_FOUND_OR_FORBIDDEN") {
    return { status: "NOT_FOUND_OR_FORBIDDEN" };
  }
  if (row.result === "CHANGED" || row.result === "NO_CHANGE") {
    if (!row.jobReference || row.version === null) {
      return { status: "CONFLICT" };
    }
    return {
      status: row.result,
      jobReference: row.jobReference,
      version: row.version,
    };
  }
  if (
    row.result === "CONFLICT" ||
    row.result === "INVALID_TRANSITION" ||
    row.result === "REQUIRES_REVIEW" ||
    row.result === "INCOMPLETE"
  ) {
    return {
      status: row.result,
      ...(row.reasonCodes === undefined
        ? {}
        : { reasonCodes: strings(row.reasonCodes) }),
    };
  }
  return { status: "CONFLICT" };
}

export async function assignJobTeamRecord(
  database: Database,
  actorProfileId: string,
  input: AssignJobTeamInput,
): Promise<JobMutationResult> {
  const result = await database.execute<MutationRow>(sql`
    with target as materialized (
      select job.*, booking.status as booking_status,
        booking.scheduling_status, booking.scheduled_start,
        booking.scheduled_end,
        booking.assigned_team_id as booking_team_id,
        booking.assigned_equipment_resource_id as booking_equipment_id
      from ${jobs} job
      join ${bookings} booking on booking.id = job.booking_id
      where job.job_reference = ${input.jobReference}
        and ${jobManagementSql(actorProfileId)}
      for update of job, booking
    ),
    exact_occupancy as materialized (
      select occupancy.*, team.code as team_code,
        team.name as team_name, team.default_crew_size,
        team.active as team_active,
        equipment.active as equipment_active,
        equipment.status as equipment_status,
        exists (
          select 1 from ${teamEquipmentAssignments} assignment
          where assignment.team_id = occupancy.team_id
            and assignment.equipment_resource_id = occupancy.equipment_resource_id
            and assignment.active = true
            and (assignment.effective_from is null or assignment.effective_from <= now())
            and (assignment.effective_until is null or assignment.effective_until > now())
        ) as equipment_assigned
      from target
      join ${bookingOccupancies} occupancy
        on occupancy.booking_id = target.booking_id
       and occupancy.status = 'CONFIRMED'
      join ${operationsTeams} team on team.id = occupancy.team_id
      left join ${equipmentResources} equipment
        on equipment.id = occupancy.equipment_resource_id
      where occupancy.team_id = ${input.operationsTeamId}
        and target.booking_status = 'CONFIRMED'
        and target.scheduling_status = 'SCHEDULED'
        and target.booking_team_id = occupancy.team_id
        and target.booking_equipment_id is not distinct from occupancy.equipment_resource_id
        and target.scheduled_start = occupancy.service_start
        and target.scheduled_end = occupancy.service_end
        and team.active = true
        and jsonb_typeof(occupancy.requirements_snapshot ->
            'requiredCapabilityCodes') = 'array'
        and not exists (
          select 1 from jsonb_array_elements_text(
            occupancy.requirements_snapshot -> 'requiredCapabilityCodes'
          ) required(code)
          where not exists (
            select 1 from ${teamCapabilities} capability
            where capability.team_id = occupancy.team_id
              and capability.capability_code = required.code
              and capability.active = true
          )
        )
        and (
          occupancy.equipment_resource_id is null
          or (equipment.active = true and equipment.status = 'ACTIVE'
            and exists (
              select 1 from ${teamEquipmentAssignments} current_assignment
              where current_assignment.team_id = occupancy.team_id
                and current_assignment.equipment_resource_id = occupancy.equipment_resource_id
                and current_assignment.active = true
                and (current_assignment.effective_from is null or current_assignment.effective_from <= now())
                and (current_assignment.effective_until is null or current_assignment.effective_until > now())
            ))
        )
      for update of occupancy
    ),
    decision as materialized (
      select case
          when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
          when target.status = 'READY'
            and target.assigned_team_id = ${input.operationsTeamId}
            and exists (select 1 from exact_occupancy)
            then 'NO_CHANGE'
          when target.version <> ${input.expectedJobVersion} then 'CONFLICT'
          when target.status not in ('PREPARED', 'READY') then 'INVALID_TRANSITION'
          when not exists (select 1 from exact_occupancy) then 'REQUIRES_REVIEW'
          else 'READY'
        end as result
      from target
      union all select 'NOT_FOUND_OR_FORBIDDEN'
      where not exists (select 1 from target)
    ),
    changed as (
      update ${jobs} job
      set source_occupancy_id = occupancy.id,
        source_occupancy_snapshot_version = occupancy.snapshot_version,
        assigned_team_id = occupancy.team_id,
        assigned_equipment_resource_id = occupancy.equipment_resource_id,
        status = 'READY',
        scheduled_start_snapshot = occupancy.service_start,
        scheduled_end_snapshot = occupancy.service_end,
        planned_service_duration_minutes = occupancy.service_duration_minutes,
        planned_team_size = occupancy.default_crew_size,
        scheduling_snapshot = jsonb_build_object(
          'schemaVersion', 1, 'status', 'READY',
          'reviewReasonCodes', '[]'::jsonb,
          'sourceOccupancyId', occupancy.id,
          'sourceOccupancySnapshotVersion', occupancy.snapshot_version,
          'teamCode', occupancy.team_code,
          'equipmentResourceId', occupancy.equipment_resource_id,
          'schedulingPolicyCode', occupancy.scheduling_policy_code,
          'schedulingPolicyVersion', occupancy.scheduling_policy_version
        ),
        version = job.version + 1, updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from exact_occupancy occupancy, decision
      where job.id = (select id from target)
        and decision.result = 'READY'
      returning job.*
    ),
    audited as (
      insert into ${jobAuditEvents} (
        job_id, event_type, actor_profile_id, source,
        previous_status, next_status, safe_metadata
      )
      select changed.id, event.event_type, ${actorProfileId}::uuid,
        'STAFF', target.status, changed.status,
        jsonb_build_object(
          'teamCode', occupancy.team_code,
          'occupancySnapshotVersion', occupancy.snapshot_version
        )
      from changed
      join target on target.id = changed.id
      join exact_occupancy occupancy on true
      cross join lateral (values ('TEAM_ASSIGNED'), ('JOB_READY')) event(event_type)
      where event.event_type = 'TEAM_ASSIGNED' or target.status <> 'READY'
      returning id
    )
    select case when decision.result = 'READY'
          and changed.id is not null and (select count(*) from audited) >= 1
        then 'CHANGED' else decision.result end::text as result,
      coalesce(changed.job_reference, target.job_reference) as "jobReference",
      coalesce(changed.version, target.version) as version,
      case when decision.result = 'REQUIRES_REVIEW'
        then jsonb_build_array('CONFIRMED_OCCUPANCY_INCONSISTENT')
        else '[]'::jsonb end as "reasonCodes"
    from decision
    left join target on true
    left join changed on true
  `);
  return mutationResult(result.rows[0]);
}

const transitionEvents: Readonly<Record<"EN_ROUTE" | "ARRIVED" | "IN_PROGRESS", string>> = {
  EN_ROUTE: "EN_ROUTE",
  ARRIVED: "ARRIVED",
  IN_PROGRESS: "WORK_STARTED",
};

export async function transitionJobRecord(
  database: Database,
  actorProfileId: string,
  input: JobItemVersionCommandInput | { jobReference: string; expectedJobVersion: number },
  targetStatus: "EN_ROUTE" | "ARRIVED" | "IN_PROGRESS",
): Promise<JobMutationResult> {
  const requiredCurrent =
    targetStatus === "EN_ROUTE"
      ? "READY"
      : targetStatus === "ARRIVED"
        ? "EN_ROUTE"
        : "ARRIVED";
  const eventType = transitionEvents[targetStatus];
  const result = await database.execute<MutationRow>(sql`
    with target as materialized (
      select job.*,
        ${operationalResourceReasonCodesSql(actorProfileId, {
          bookingId: sql`job.booking_id`,
          sourceOccupancyId: sql`job.source_occupancy_id`,
          sourceOccupancySnapshotVersion:
            sql`job.source_occupancy_snapshot_version`,
          assignedTeamId: sql`job.assigned_team_id`,
          assignedEquipmentResourceId:
            sql`job.assigned_equipment_resource_id`,
          scheduledStart: sql`job.scheduled_start_snapshot`,
          scheduledEnd: sql`job.scheduled_end_snapshot`,
        })} as operational_resource_reason_codes
      from ${jobs} job
      where job.job_reference = ${input.jobReference}
        and ${jobExecutionUpdateSql(actorProfileId, sql`job.assigned_team_id`)}
      for update of job
    ),
    decision as materialized (
      select case
          when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
          when target.status = ${targetStatus} then 'NO_CHANGE'
          when target.version <> ${input.expectedJobVersion} then 'CONFLICT'
          when target.status <> ${requiredCurrent} then 'INVALID_TRANSITION'
          when cardinality(target.operational_resource_reason_codes) > 0
            then 'REQUIRES_REVIEW'
          else 'READY'
        end as result,
        coalesce(target.operational_resource_reason_codes,
          array[]::text[]) as reason_codes
      from target
      union all select 'NOT_FOUND_OR_FORBIDDEN', array[]::text[]
      where not exists (select 1 from target)
    ),
    changed as (
      update ${jobs} job
      set status = ${targetStatus},
        en_route_at = case when ${targetStatus} = 'EN_ROUTE' then now()
          else job.en_route_at end,
        arrived_at = case when ${targetStatus} = 'ARRIVED' then now()
          else job.arrived_at end,
        started_at = case when ${targetStatus} = 'IN_PROGRESS' then now()
          else job.started_at end,
        version = job.version + 1, updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from decision
      where job.id = (select id from target) and decision.result = 'READY'
      returning job.*
    ),
    audited as (
      insert into ${jobAuditEvents} (
        job_id, event_type, actor_profile_id, source,
        previous_status, next_status, safe_metadata
      )
      select changed.id, ${eventType}, ${actorProfileId}::uuid,
        case when ${activeActorPermissionSql(actorProfileId, "OPERATIONS_MANAGE")}
          then 'STAFF' else 'TECHNICIAN' end,
        target.status, changed.status, '{}'::jsonb
      from changed join target on target.id = changed.id
      returning id
    )
    select case when decision.result = 'READY' and changed.id is not null
          and (select count(*) from audited) = 1
        then 'CHANGED' else decision.result end::text as result,
      coalesce(changed.job_reference, target.job_reference) as "jobReference",
      coalesce(changed.version, target.version) as version,
      to_jsonb(decision.reason_codes) as "reasonCodes"
    from decision left join target on true left join changed on true
  `);
  return mutationResult(result.rows[0]);
}

type ItemMutationRow = {
  result: string;
  jobReference: string | null;
  jobVersion: number | null;
  jobItemVersion: number | null;
  reasonCodes?: unknown;
};

function itemMutationResult(
  row: ItemMutationRow | undefined,
): JobItemMutationResult {
  if (!row || row.result === "NOT_FOUND_OR_FORBIDDEN") {
    return { status: "NOT_FOUND_OR_FORBIDDEN" };
  }
  if (
    (row.result === "CHANGED" || row.result === "NO_CHANGE") &&
    row.jobReference &&
    row.jobVersion !== null &&
    row.jobItemVersion !== null
  ) {
    return {
      status: row.result,
      jobReference: row.jobReference,
      jobVersion: row.jobVersion,
      jobItemVersion: row.jobItemVersion,
    };
  }
  if (
    row.result === "CONFLICT" ||
    row.result === "INVALID_TRANSITION" ||
    row.result === "REQUIRES_REVIEW" ||
    row.result === "INCOMPLETE"
  ) {
    return {
      status: row.result,
      ...(row.reasonCodes === undefined
        ? {}
        : { reasonCodes: strings(row.reasonCodes) }),
    };
  }
  return { status: "CONFLICT" };
}

export interface JobExecutionRepository {
  createJob(
    actorProfileId: string,
    input: CreationInput,
  ): Promise<JobCreationResult>;
  listJobs(actorProfileId: string, input: JobListInput): Promise<JobPage>;
  getJob(
    actorProfileId: string,
    jobReference: string,
  ): Promise<StaffJobDetail | TechnicianJobDetail | null>;
  assignTeam(
    actorProfileId: string,
    input: AssignJobTeamInput,
  ): Promise<JobMutationResult>;
  transitionJob(
    actorProfileId: string,
    input: Readonly<{ jobReference: string; expectedJobVersion: number }>,
    targetStatus: "EN_ROUTE" | "ARRIVED" | "IN_PROGRESS",
  ): Promise<JobMutationResult>;
  recordInspection(
    actorProfileId: string,
    input: RecordJobItemInspectionInput,
  ): Promise<JobItemMutationResult>;
  confirmTreatmentPlan(
    actorProfileId: string,
    input: ConfirmJobItemTreatmentPlanInput,
  ): Promise<JobItemMutationResult>;
  startTreatment(
    actorProfileId: string,
    input: StartJobItemTreatmentInput,
  ): Promise<JobItemMutationResult>;
  completeTreatment(
    actorProfileId: string,
    input: CompleteJobItemTreatmentInput,
  ): Promise<JobItemMutationResult>;
  completeJob(
    actorProfileId: string,
    input: CompleteJobInput,
  ): Promise<JobMutationResult>;
  cancelJob(
    actorProfileId: string,
    input: CancelJobInput,
  ): Promise<JobMutationResult>;
  getCustomerPassport(
    actorProfileId: string,
    input: Readonly<{ propertyId: string; assetId: string }>,
  ): Promise<CleaningPassportPage | null>;
  getStaffAssetHistory(
    actorProfileId: string,
    input: Readonly<{ propertyId: string; assetId: string }>,
  ): Promise<Readonly<{
    assetLabel: string;
    entries: readonly StaffCleaningPassportEntry[];
  }> | null>;
}

/**
 * Records one immutable on-site observation. The database recomputes all
 * safety and scope decisions from canonical references and the frozen Job
 * item; the browser cannot select feasibility or review state.
 */
export async function recordJobItemInspectionRecord(
  database: Database,
  actorProfileId: string,
  input: RecordJobItemInspectionInput,
): Promise<JobItemMutationResult> {
  const issuePayload = JSON.stringify(input.issues);
  const riskPayload = JSON.stringify(input.risks);
  const observedMeasurement = JSON.stringify(input.observedMeasurement);
  const result = await database.execute<ItemMutationRow>(sql`
    with target as materialized (
      select job.id as job_id, job.job_reference, job.status as job_status,
        job.version as job_version, job.assigned_team_id,
        ${operationalResourceReasonCodesSql(actorProfileId, {
          bookingId: sql`job.booking_id`,
          sourceOccupancyId: sql`job.source_occupancy_id`,
          sourceOccupancySnapshotVersion:
            sql`job.source_occupancy_snapshot_version`,
          assignedTeamId: sql`job.assigned_team_id`,
          assignedEquipmentResourceId:
            sql`job.assigned_equipment_resource_id`,
          scheduledStart: sql`job.scheduled_start_snapshot`,
          scheduledEnd: sql`job.scheduled_end_snapshot`,
        })} as operational_resource_reason_codes,
        item.id as job_item_id, item.status as item_status,
        item.version as job_item_version, item.cleaning_item_type_id,
        item.measurement_mode_id, item.quantity, item.area_hundredths_m2,
        item.seat_count, item.sides, item.service_id,
        coalesce(item.staff_normalized_condition_level_id,
          item.customer_reported_condition_level_id)
          as planned_condition_level_id,
        coalesce(item.staff_normalized_fibre_material_id,
          item.customer_reported_fibre_material_id)
          as planned_fibre_material_id,
        coalesce(item.staff_normalized_surface_construction_id,
          item.customer_reported_surface_construction_id)
          as planned_surface_construction_id
      from ${jobs} job
      join ${jobItems} item on item.job_id = job.id
      where job.job_reference = ${input.jobReference}
        and item.id = ${input.jobItemId}::uuid
        and ${jobExecutionUpdateSql(actorProfileId, sql`job.assigned_team_id`)}
      for update of job, item
    ),
    provided_issues as materialized (
      select provided."issueTypeId" as issue_type_id,
        nullif(trim(provided."technicianNote"), '') as notes
      from jsonb_to_recordset(${issuePayload}::jsonb)
        as provided("issueTypeId" integer, "technicianNote" text)
    ),
    provided_risks as materialized (
      select provided."riskFlagId" as risk_flag_id,
        nullif(trim(provided."technicianNote"), '') as notes
      from jsonb_to_recordset(${riskPayload}::jsonb)
        as provided("riskFlagId" integer, "technicianNote" text)
    ),
    issue_evidence as materialized (
      select issue.id, classification.code as handling_code
      from provided_issues provided
      join ${issueTypes} issue on issue.id = provided.issue_type_id
        and issue.active = true
      join ${issueHandlingClassifications} classification
        on classification.id = issue.handling_classification_id
       and classification.active = true
    ),
    risk_evidence as materialized (
      select risk.id, risk.code
      from provided_risks provided
      join ${riskFlags} risk on risk.id = provided.risk_flag_id
        and risk.active = true
    ),
    canonical as materialized (
      select target.*,
        service_status.code as service_capability_code,
        (select count(*)::integer from provided_issues) as provided_issue_count,
        (select count(*)::integer from issue_evidence) as valid_issue_count,
        (select count(*)::integer from provided_risks) as provided_risk_count,
        (select count(*)::integer from risk_evidence) as valid_risk_count,
        exists (select 1 from ${cleaningItemTypes} reference
          where reference.id = ${input.observedCleaningItemTypeId}
            and reference.active = true) as item_type_valid,
        exists (select 1 from ${conditionLevels} reference
          where reference.id = ${input.observedConditionLevelId}
            and reference.active = true) as condition_valid,
        exists (select 1 from ${fibreMaterials} reference
          where reference.id = ${input.confirmedFibreMaterialId}
            and reference.active = true) as fibre_valid,
        exists (select 1 from ${surfaceConstructions} reference
          where reference.id = ${input.confirmedSurfaceConstructionId}
            and reference.active = true) as construction_valid,
        exists (
          select 1 from ${serviceItemCapabilities} capability
          join ${capabilityStatuses} status on status.id = capability.status_id
            and status.active = true
          where capability.service_id = target.service_id
            and capability.item_type_id = ${input.observedCleaningItemTypeId}
        ) as capability_present
      from target
      left join ${serviceItemCapabilities} service_capability
        on service_capability.service_id = target.service_id
       and service_capability.item_type_id = ${input.observedCleaningItemTypeId}
      left join ${capabilityStatuses} service_status
        on service_status.id = service_capability.status_id
       and service_status.active = true
    ),
    safety as materialized (
      select canonical.*,
        array_remove(array[
          case when ${input.unsafeContaminationObserved}
            then 'UNSAFE_CONTAMINATION' end,
          case when ${input.unsafeStructuralConditionObserved}
            then 'UNSAFE_STRUCTURAL_CONDITION' end,
          case when exists (select 1 from issue_evidence
              where handling_code = 'DECLINE_OR_REFER')
            then 'DECLINE_OR_REFER_ISSUE' end,
          case when canonical.cleaning_item_type_id <>
              ${input.observedCleaningItemTypeId}
            then 'CLEANING_ITEM_TYPE_CHANGED' end,
          case when canonical.measurement_mode_id <>
                ${input.observedMeasurement.measurementModeId}
              or canonical.quantity <> ${input.observedMeasurement.quantity}
              or canonical.area_hundredths_m2 is distinct from
                ${input.observedMeasurement.areaHundredthsM2}
              or canonical.seat_count is distinct from
                ${input.observedMeasurement.seatCount}
              or canonical.sides is distinct from ${input.observedMeasurement.sides}
            then 'MEASUREMENT_CHANGED' end,
          case when canonical.planned_condition_level_id is distinct from
              ${input.observedConditionLevelId}
            then 'CONDITION_LEVEL_CHANGED' end,
          case when canonical.planned_fibre_material_id is distinct from
              ${input.confirmedFibreMaterialId}
            then 'FIBRE_MATERIAL_CHANGED' end,
          case when canonical.planned_surface_construction_id is distinct from
              ${input.confirmedSurfaceConstructionId}
            then 'SURFACE_CONSTRUCTION_CHANGED' end,
          case when exists (select 1 from issue_evidence
              where handling_code = 'SPECIALIST_ONLY')
            then 'SPECIALIST_ISSUE' end,
          case when exists (select 1 from risk_evidence where code in (
              'DELICATE_MATERIAL', 'UNKNOWN_FIBRE', 'VALUABLE_ITEM',
              'ANTIQUE_OR_VINTAGE', 'COLOURFASTNESS_CONCERN',
              'MOISTURE_SENSITIVE', 'LOOSE_SEAMS', 'FRAYING',
              'SHRINKAGE_RISK', 'DYE_BLEED_RISK', 'HANDMADE',
              'CUSTOMER_DECLARED_SPECIAL_VALUE'))
            then 'ELEVATED_MATERIAL_RISK' end,
          case when canonical.service_capability_code in
              ('SPECIALIST_ONLY', 'UNAVAILABLE')
            then 'SERVICE_CAPABILITY_REQUIRES_REVIEW' end
        ], null)::text[] as reason_codes,
        (${input.unsafeContaminationObserved}
          or ${input.unsafeStructuralConditionObserved}
          or exists (select 1 from issue_evidence
            where handling_code = 'DECLINE_OR_REFER')) as decline_or_refer,
        (canonical.cleaning_item_type_id <> ${input.observedCleaningItemTypeId}
          or canonical.measurement_mode_id <>
            ${input.observedMeasurement.measurementModeId}
          or canonical.quantity <> ${input.observedMeasurement.quantity}
          or canonical.area_hundredths_m2 is distinct from
            ${input.observedMeasurement.areaHundredthsM2}
          or canonical.seat_count is distinct from
            ${input.observedMeasurement.seatCount}
          or canonical.sides is distinct from ${input.observedMeasurement.sides}
          or canonical.planned_condition_level_id is distinct from
            ${input.observedConditionLevelId}
          or canonical.planned_fibre_material_id is distinct from
            ${input.confirmedFibreMaterialId}
          or canonical.planned_surface_construction_id is distinct from
            ${input.confirmedSurfaceConstructionId}
          or exists (select 1 from issue_evidence
            where handling_code = 'SPECIALIST_ONLY')
          or exists (select 1 from risk_evidence where code in (
            'DELICATE_MATERIAL', 'UNKNOWN_FIBRE', 'VALUABLE_ITEM',
            'ANTIQUE_OR_VINTAGE', 'COLOURFASTNESS_CONCERN',
            'MOISTURE_SENSITIVE', 'LOOSE_SEAMS', 'FRAYING',
            'SHRINKAGE_RISK', 'DYE_BLEED_RISK', 'HANDMADE',
            'CUSTOMER_DECLARED_SPECIAL_VALUE'))
          or canonical.service_capability_code in
            ('SPECIALIST_ONLY', 'UNAVAILABLE')) as review_required
      from canonical
    ),
    existing as materialized (
      select inspection.*
      from target
      join ${jobItemInspections} inspection
        on inspection.job_item_id = target.job_item_id
    ),
    decision as materialized (
      select case
          when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
          when exists (select 1 from existing) then 'CONFLICT'
          when safety.job_version <> ${input.expectedJobVersion}
            or safety.job_item_version <> ${input.expectedJobItemVersion}
            then 'CONFLICT'
          when safety.job_status <> 'IN_PROGRESS'
            or safety.item_status <> 'PENDING_INSPECTION'
            then 'INVALID_TRANSITION'
          when cardinality(safety.operational_resource_reason_codes) > 0
            then 'REQUIRES_REVIEW'
          when not safety.item_type_valid or not safety.condition_valid
            or not safety.fibre_valid or not safety.construction_valid
            or not safety.capability_present
            or safety.provided_issue_count <> safety.valid_issue_count
            or safety.provided_risk_count <> safety.valid_risk_count
            then 'INCOMPLETE'
          else 'CREATE'
        end as result,
        case when cardinality(safety.operational_resource_reason_codes) > 0
          then safety.operational_resource_reason_codes
          else coalesce(safety.reason_codes, array[]::text[])
        end as reason_codes
      from safety
      union all select 'NOT_FOUND_OR_FORBIDDEN', array[]::text[]
      where not exists (select 1 from target)
    ),
    created_inspection as (
      insert into ${jobItemInspections} (
        job_id, job_item_id, source_job_item_version,
        observed_cleaning_item_type_id, observed_measurement_mode_id,
        observed_quantity, observed_area_hundredths_m2,
        observed_seat_count, observed_sides, observed_condition_level_id,
        confirmed_fibre_material_id, confirmed_surface_construction_id,
        observed_measurement_snapshot, existing_damage_present,
        existing_damage_notes, colourfastness_concern, moisture_sensitivity,
        unsafe_contamination_observed, unsafe_structural_condition_observed,
        treatment_feasibility, internal_technician_notes,
        inspected_by_profile_id
      )
      select safety.job_id, safety.job_item_id, safety.job_item_version,
        ${input.observedCleaningItemTypeId},
        ${input.observedMeasurement.measurementModeId},
        ${input.observedMeasurement.quantity},
        ${input.observedMeasurement.areaHundredthsM2},
        ${input.observedMeasurement.seatCount}, ${input.observedMeasurement.sides},
        ${input.observedConditionLevelId}, ${input.confirmedFibreMaterialId},
        ${input.confirmedSurfaceConstructionId}, ${observedMeasurement}::jsonb,
        ${input.existingDamageObserved}, ${input.existingDamageNotes},
        ${input.colourfastnessConcern}, ${input.moistureSensitivity},
        ${input.unsafeContaminationObserved},
        ${input.unsafeStructuralConditionObserved},
        case when safety.decline_or_refer then 'NOT_FEASIBLE'
          when safety.review_required then 'SPECIALIST_REVIEW'
          when ${input.colourfastnessConcern} or ${input.moistureSensitivity}
            then 'CONDITIONAL' else 'FEASIBLE' end,
        ${input.technicianNotes}, ${actorProfileId}::uuid
      from safety, decision where decision.result = 'CREATE'
      returning *
    ),
    created_issues as (
      insert into ${jobItemInspectionIssues} (
        inspection_id, job_item_id, job_id, issue_type_id, notes
      )
      select inspection.id, inspection.job_item_id, inspection.job_id,
        provided.issue_type_id, provided.notes
      from created_inspection inspection cross join provided_issues provided
      returning inspection_id
    ),
    created_risks as (
      insert into ${jobItemInspectionRisks} (
        inspection_id, job_item_id, job_id, risk_flag_id, notes
      )
      select inspection.id, inspection.job_item_id, inspection.job_id,
        provided.risk_flag_id, provided.notes
      from created_inspection inspection cross join provided_risks provided
      returning inspection_id
    ),
    changed_item as (
      update ${jobItems} item
      set status = case when safety.review_required and not safety.decline_or_refer
          then 'REQUIRES_REVIEW' else 'INSPECTED' end,
        version = item.version + 1, updated_at = now()
      from safety, decision, created_inspection
      where item.id = safety.job_item_id and decision.result = 'CREATE'
      returning item.*
    ),
    changed_job as (
      update ${jobs} job
      set status = case when safety.review_required and not safety.decline_or_refer
          then 'REQUIRES_REVIEW' else job.status end,
        review_reason_code = case
          when safety.review_required and not safety.decline_or_refer
            then coalesce(safety.reason_codes[1], 'INSPECTION_REQUIRES_REVIEW')
          else null end,
        review_reason_text = case
          when safety.review_required and not safety.decline_or_refer
            then array_to_string(safety.reason_codes, ',') else null end,
        version = job.version + 1, updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from safety, decision, created_inspection
      where job.id = safety.job_id and decision.result = 'CREATE'
      returning job.*
    ),
    audited as (
      insert into ${jobAuditEvents} (
        job_id, job_item_id, event_type, actor_profile_id, source,
        previous_status, next_status, safe_metadata
      )
      select changed_job.id, changed_item.id,
        event.event_type, ${actorProfileId}::uuid,
        case when ${activeActorPermissionSql(actorProfileId, "OPERATIONS_MANAGE")}
          then 'STAFF' else 'TECHNICIAN' end,
        safety.job_status, changed_job.status,
        case when event.event_type = 'REQUIRES_REVIEW'
          then jsonb_build_object('reasonCodes', to_jsonb(safety.reason_codes))
          else jsonb_build_object('issueCount', safety.provided_issue_count,
            'riskCount', safety.provided_risk_count,
            'safetyReasonCodes', to_jsonb(safety.reason_codes)) end
      from changed_job join changed_item on true join safety on true
      cross join lateral (values ('INSPECTION_COMPLETED'),
        ('REQUIRES_REVIEW')) event(event_type)
      where event.event_type = 'INSPECTION_COMPLETED'
        or (safety.review_required and not safety.decline_or_refer)
      returning id
    )
    select case when decision.result = 'CREATE'
          and created_inspection.id is not null
          and (select count(*) from created_issues) = safety.provided_issue_count
          and (select count(*) from created_risks) = safety.provided_risk_count
          and (select count(*) from audited) >= 1
        then 'CHANGED' else decision.result end::text as result,
      coalesce(changed_job.job_reference, safety.job_reference)
        as "jobReference",
      coalesce(changed_job.version, safety.job_version) as "jobVersion",
      coalesce(changed_item.version, safety.job_item_version)
        as "jobItemVersion",
      to_jsonb(decision.reason_codes) as "reasonCodes"
    from decision
    left join safety on true
    left join created_inspection on true
    left join changed_item on true
    left join changed_job on true
  `);
  return itemMutationResult(result.rows[0]);
}

/** Confirms a one-shot technical plan without changing commercial scope. */
export async function confirmJobItemTreatmentPlanRecord(
  database: Database,
  actorProfileId: string,
  input: ConfirmJobItemTreatmentPlanInput,
): Promise<JobItemMutationResult> {
  const addonPayload = JSON.stringify(input.addonIds);
  const result = await database.execute<ItemMutationRow>(sql`
    with target as materialized (
      select job.id as job_id, job.job_reference,
        job.status as job_status, job.version as job_version,
        job.assigned_team_id,
        ${operationalResourceReasonCodesSql(actorProfileId, {
          bookingId: sql`job.booking_id`,
          sourceOccupancyId: sql`job.source_occupancy_id`,
          sourceOccupancySnapshotVersion:
            sql`job.source_occupancy_snapshot_version`,
          assignedTeamId: sql`job.assigned_team_id`,
          assignedEquipmentResourceId:
            sql`job.assigned_equipment_resource_id`,
          scheduledStart: sql`job.scheduled_start_snapshot`,
          scheduledEnd: sql`job.scheduled_end_snapshot`,
        })} as operational_resource_reason_codes,
        item.id as job_item_id,
        item.status as item_status, item.version as job_item_version,
        item.service_id, item.cleaning_item_type_id,
        item.measurement_mode_id, item.quantity, item.area_hundredths_m2,
        item.seat_count, item.sides,
        coalesce(item.staff_normalized_condition_level_id,
          item.customer_reported_condition_level_id)
          as planned_condition_level_id,
        coalesce(item.staff_normalized_fibre_material_id,
          item.customer_reported_fibre_material_id)
          as planned_fibre_material_id,
        coalesce(item.staff_normalized_surface_construction_id,
          item.customer_reported_surface_construction_id)
          as planned_surface_construction_id,
        item.planned_treatment_assumptions_snapshot,
        inspection.id as inspection_id,
        inspection.treatment_feasibility,
        inspection.observed_cleaning_item_type_id,
        inspection.observed_measurement_mode_id,
        inspection.observed_quantity, inspection.observed_area_hundredths_m2,
        inspection.observed_seat_count, inspection.observed_sides,
        inspection.observed_condition_level_id,
        inspection.confirmed_fibre_material_id,
        inspection.confirmed_surface_construction_id
      from ${jobs} job
      join ${jobItems} item on item.job_id = job.id
      left join ${jobItemInspections} inspection
        on inspection.job_item_id = item.id
      where job.job_reference = ${input.jobReference}
        and item.id = ${input.jobItemId}::uuid
        and ${jobExecutionUpdateSql(actorProfileId, sql`job.assigned_team_id`)}
      for update of job, item
    ),
    provided_addons as materialized (
      select value::integer as addon_id
      from jsonb_array_elements_text(${addonPayload}::jsonb) value
    ),
    quoted_addons as materialized (
      select (addon.value ->> 'addonId')::integer as addon_id
      from target
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(
          target.planned_treatment_assumptions_snapshot -> 'quotedAddons'
        ) = 'array'
          then target.planned_treatment_assumptions_snapshot -> 'quotedAddons'
          else '[]'::jsonb end
      ) addon(value)
      where addon.value ->> 'staffIncluded' = 'true'
        and pg_input_is_valid(addon.value ->> 'addonId', 'integer')
    ),
    addon_evidence as materialized (
      select provided.addon_id, status.code as capability_code
      from provided_addons provided
      join ${serviceAddons} addon on addon.id = provided.addon_id
        and addon.active = true
      join target on true
      join ${serviceAddonCapabilities} capability
        on capability.service_id = target.service_id
       and capability.addon_id = provided.addon_id
      join ${capabilityStatuses} status on status.id = capability.status_id
        and status.active = true
      where exists (select 1 from quoted_addons quoted
        where quoted.addon_id = provided.addon_id)
    ),
    technical_evidence as materialized (
      select target.*,
        (target.cleaning_item_type_id <>
            target.observed_cleaning_item_type_id
          or target.measurement_mode_id <>
            target.observed_measurement_mode_id
          or target.quantity <> target.observed_quantity
          or target.area_hundredths_m2 is distinct from
            target.observed_area_hundredths_m2
          or target.seat_count is distinct from target.observed_seat_count
          or target.sides is distinct from target.observed_sides
          or target.planned_condition_level_id is distinct from
            target.observed_condition_level_id
          or target.planned_fibre_material_id is distinct from
            target.confirmed_fibre_material_id
          or target.planned_surface_construction_id is distinct from
            target.confirmed_surface_construction_id)
          as material_scope_change,
        (select count(*)::integer from provided_addons) as provided_addon_count,
        (select count(*)::integer from addon_evidence) as valid_addon_count,
        exists (select 1 from ${treatmentLevels} reference
          where reference.id = ${input.treatmentLevelId}
            and reference.active = true) as treatment_level_valid,
        exists (select 1 from ${mechanicalActionLevels} reference
          where reference.id = ${input.mechanicalActionLevelId}
            and reference.active = true) as mechanical_action_valid,
        exists (select 1 from ${treatmentApproaches} reference
          where reference.id = ${input.treatmentApproachId}
            and reference.active = true) as approach_valid,
        (${input.cleaningProductId}::integer is null or exists (
          select 1 from ${cleaningProducts} product
          where product.id = ${input.cleaningProductId} and product.active = true
        )) as product_valid,
        treatment_status.code as treatment_capability_code,
        material_status.code as material_capability_code,
        exists (select 1 from ${jobItemTreatmentPlans} existing
          where existing.job_item_id = target.job_item_id) as plan_exists
      from target
      left join ${serviceTreatmentLevels} service_treatment
        on service_treatment.service_id = target.service_id
       and service_treatment.treatment_level_id = ${input.treatmentLevelId}
      left join ${capabilityStatuses} treatment_status
        on treatment_status.id = service_treatment.status_id
       and treatment_status.active = true
      left join ${materialTreatmentConsiderations} consideration
        on consideration.material_id = target.confirmed_fibre_material_id
       and consideration.treatment_level_id = ${input.treatmentLevelId}
      left join ${capabilityStatuses} material_status
        on material_status.id = consideration.status_id
       and material_status.active = true
    ),
    safety as materialized (
      select technical_evidence.*,
        (technical_evidence.material_scope_change
          or technical_evidence.treatment_feasibility = 'SPECIALIST_REVIEW'
          or technical_evidence.treatment_capability_code in
            ('SPECIALIST_ONLY', 'UNAVAILABLE')
          or technical_evidence.material_capability_code in
            ('SPECIALIST_ONLY', 'UNAVAILABLE')
          or exists (select 1 from addon_evidence
            where capability_code in ('SPECIALIST_ONLY', 'UNAVAILABLE')))
          as review_required,
        array_remove(array[
          case when technical_evidence.material_scope_change
            then 'MATERIAL_SCOPE_CHANGE' end,
          case when technical_evidence.treatment_feasibility = 'SPECIALIST_REVIEW'
            then 'INSPECTION_REQUIRES_REVIEW' end,
          case when technical_evidence.treatment_capability_code in
              ('SPECIALIST_ONLY', 'UNAVAILABLE')
            then 'TREATMENT_CAPABILITY_REQUIRES_REVIEW' end,
          case when technical_evidence.material_capability_code in
              ('SPECIALIST_ONLY', 'UNAVAILABLE')
            then 'MATERIAL_CAPABILITY_REQUIRES_REVIEW' end,
          case when exists (select 1 from addon_evidence
              where capability_code in ('SPECIALIST_ONLY', 'UNAVAILABLE'))
            then 'ADDON_CAPABILITY_REQUIRES_REVIEW' end
        ], null)::text[] as reason_codes
      from technical_evidence
    ),
    decision as materialized (
      select case
          when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
          when safety.plan_exists then 'CONFLICT'
          when safety.job_version <> ${input.expectedJobVersion}
            or safety.job_item_version <> ${input.expectedJobItemVersion}
            then 'CONFLICT'
          when safety.job_status <> 'IN_PROGRESS'
            or safety.item_status <> 'INSPECTED'
            or safety.inspection_id is distinct from ${input.sourceInspectionId}::uuid
            then 'INVALID_TRANSITION'
          when safety.treatment_feasibility = 'NOT_FEASIBLE'
            and ${input.decision} not in ('DECLINE', 'REFER')
            then 'INVALID_TRANSITION'
          when cardinality(safety.operational_resource_reason_codes) > 0
            then 'REQUIRES_REVIEW'
          when safety.review_required and ${input.decision} <> 'REQUIRES_REVIEW'
            then 'REQUIRES_REVIEW'
          when not safety.review_required and ${input.decision} = 'REQUIRES_REVIEW'
            then 'CREATE'
          when ${input.decision} in ('PERFORM', 'PERFORM_WITH_LIMITATIONS')
            and (not safety.treatment_level_valid
              or not safety.mechanical_action_valid or not safety.approach_valid
              or not safety.product_valid
              or safety.treatment_capability_code is null
              or safety.provided_addon_count <> safety.valid_addon_count)
            then 'INCOMPLETE'
          else 'CREATE'
        end as result,
        case when cardinality(safety.operational_resource_reason_codes) > 0
          then safety.operational_resource_reason_codes
          else coalesce(safety.reason_codes, array[]::text[])
        end as reason_codes
      from safety
      union all select 'NOT_FOUND_OR_FORBIDDEN', array[]::text[]
      where not exists (select 1 from target)
    ),
    created_plan as (
      insert into ${jobItemTreatmentPlans} (
        job_id, job_item_id, inspection_id, source_job_item_version,
        decision, treatment_level_id, mechanical_action_level_id,
        treatment_approach_id, cleaning_product_id, material_scope_change,
        technician_rationale, confirmed_by_profile_id
      )
      select safety.job_id, safety.job_item_id, safety.inspection_id,
        safety.job_item_version, ${input.decision}, ${input.treatmentLevelId},
        ${input.mechanicalActionLevelId}, ${input.treatmentApproachId},
        ${input.cleaningProductId}, safety.material_scope_change,
        ${input.technicianRationale}, ${actorProfileId}::uuid
      from safety, decision where decision.result = 'CREATE'
      returning *
    ),
    created_addons as (
      insert into ${jobItemTreatmentPlanAddons} (
        treatment_plan_id, job_item_id, job_id, service_addon_id
      )
      select plan.id, plan.job_item_id, plan.job_id, provided.addon_id
      from created_plan plan cross join provided_addons provided
      returning treatment_plan_id
    ),
    changed_item as (
      update ${jobItems} item
      set status = case ${input.decision}
          when 'DECLINE' then 'DECLINED'
          when 'REFER' then 'REFERRED'
          when 'REQUIRES_REVIEW' then 'REQUIRES_REVIEW'
          else 'TREATMENT_CONFIRMED' end,
        version = item.version + 1, updated_at = now()
      from safety, decision, created_plan
      where item.id = safety.job_item_id and decision.result = 'CREATE'
      returning item.*
    ),
    changed_job as (
      update ${jobs} job
      set status = case when ${input.decision} = 'REQUIRES_REVIEW'
          then 'REQUIRES_REVIEW' else job.status end,
        review_reason_code = case when ${input.decision} = 'REQUIRES_REVIEW'
          then coalesce(safety.reason_codes[1], 'TECHNICIAN_REVIEW') end,
        review_reason_text = case when ${input.decision} = 'REQUIRES_REVIEW'
          then coalesce(nullif(array_to_string(safety.reason_codes, ','), ''),
            'Technician requested review.') end,
        version = job.version + 1, updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from safety, decision, created_plan
      where job.id = safety.job_id and decision.result = 'CREATE'
      returning job.*
    ),
    audited as (
      insert into ${jobAuditEvents} (
        job_id, job_item_id, event_type, actor_profile_id, source,
        previous_status, next_status, safe_metadata
      )
      select changed_job.id, changed_item.id,
        case ${input.decision} when 'DECLINE' then 'ITEM_DECLINED'
          when 'REFER' then 'ITEM_REFERRED'
          when 'REQUIRES_REVIEW' then 'REQUIRES_REVIEW'
          else 'TREATMENT_CONFIRMED' end,
        ${actorProfileId}::uuid,
        case when ${activeActorPermissionSql(actorProfileId, "OPERATIONS_MANAGE")}
          then 'STAFF' else 'TECHNICIAN' end,
        safety.job_status, changed_job.status,
        jsonb_build_object('decision', ${input.decision},
          'addonCount', safety.provided_addon_count,
          'reasonCodes', to_jsonb(safety.reason_codes))
      from changed_job join changed_item on true join safety on true
      returning id
    )
    select case when decision.result = 'CREATE'
          and created_plan.id is not null
          and (select count(*) from created_addons) = safety.provided_addon_count
          and (select count(*) from audited) = 1
        then 'CHANGED' else decision.result end::text as result,
      coalesce(changed_job.job_reference, safety.job_reference)
        as "jobReference",
      coalesce(changed_job.version, safety.job_version) as "jobVersion",
      coalesce(changed_item.version, safety.job_item_version)
        as "jobItemVersion",
      to_jsonb(decision.reason_codes) as "reasonCodes"
    from decision left join safety on true left join created_plan on true
    left join changed_item on true left join changed_job on true
  `);
  return itemMutationResult(result.rows[0]);
}

/** Starts only the exact, immutable, performable plan and copies its facts. */
export async function startJobItemTreatmentRecord(
  database: Database,
  actorProfileId: string,
  input: StartJobItemTreatmentInput,
): Promise<JobItemMutationResult> {
  const result = await database.execute<ItemMutationRow>(sql`
    with target as materialized (
      select job.id as job_id, job.job_reference,
        job.status as job_status, job.version as job_version,
        job.assigned_team_id,
        ${operationalResourceReasonCodesSql(actorProfileId, {
          bookingId: sql`job.booking_id`,
          sourceOccupancyId: sql`job.source_occupancy_id`,
          sourceOccupancySnapshotVersion:
            sql`job.source_occupancy_snapshot_version`,
          assignedTeamId: sql`job.assigned_team_id`,
          assignedEquipmentResourceId:
            sql`job.assigned_equipment_resource_id`,
          scheduledStart: sql`job.scheduled_start_snapshot`,
          scheduledEnd: sql`job.scheduled_end_snapshot`,
        })} as operational_resource_reason_codes,
        item.id as job_item_id,
        item.status as item_status, item.version as job_item_version,
        plan.id as treatment_plan_id, plan.decision,
        plan.treatment_level_id, plan.mechanical_action_level_id,
        plan.treatment_approach_id, plan.cleaning_product_id,
        existing.id as existing_execution_id
      from ${jobs} job
      join ${jobItems} item on item.job_id = job.id
      left join ${jobItemTreatmentPlans} plan on plan.job_item_id = item.id
      left join ${jobItemTreatmentExecutions} existing
        on existing.job_item_id = item.id
      where job.job_reference = ${input.jobReference}
        and item.id = ${input.jobItemId}::uuid
        and ${jobExecutionUpdateSql(actorProfileId, sql`job.assigned_team_id`)}
      for update of job, item
    ),
    decision as materialized (
      select case
          when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
          when target.existing_execution_id is not null
            and target.treatment_plan_id = ${input.treatmentPlanId}::uuid
            then 'NO_CHANGE'
          when target.existing_execution_id is not null then 'CONFLICT'
          when target.job_version <> ${input.expectedJobVersion}
            or target.job_item_version <> ${input.expectedJobItemVersion}
            then 'CONFLICT'
          when target.job_status <> 'IN_PROGRESS'
            or target.item_status <> 'TREATMENT_CONFIRMED'
            or target.treatment_plan_id is distinct from
              ${input.treatmentPlanId}::uuid
            or target.decision not in ('PERFORM', 'PERFORM_WITH_LIMITATIONS')
            then 'INVALID_TRANSITION'
          when cardinality(target.operational_resource_reason_codes) > 0
            then 'REQUIRES_REVIEW'
          when target.treatment_level_id is null
            or target.mechanical_action_level_id is null
            or target.treatment_approach_id is null then 'INCOMPLETE'
          else 'CREATE'
        end as result,
        coalesce(target.operational_resource_reason_codes,
          array[]::text[]) as reason_codes
      from target
      union all select 'NOT_FOUND_OR_FORBIDDEN', array[]::text[]
      where not exists (select 1 from target)
    ),
    created_execution as (
      insert into ${jobItemTreatmentExecutions} (
        job_id, job_item_id, treatment_plan_id,
        performed_treatment_level_id, performed_mechanical_action_level_id,
        performed_treatment_approach_id, cleaning_product_id,
        performed_addons_snapshot, performed_by_profile_id
      )
      select target.job_id, target.job_item_id, target.treatment_plan_id,
        target.treatment_level_id, target.mechanical_action_level_id,
        target.treatment_approach_id, target.cleaning_product_id,
        jsonb_build_object('schemaVersion', 1, 'addonIds', coalesce((
          select jsonb_agg(addon.service_addon_id
            order by addon.service_addon_id)
          from ${jobItemTreatmentPlanAddons} addon
          where addon.treatment_plan_id = target.treatment_plan_id
        ), '[]'::jsonb)), ${actorProfileId}::uuid
      from target, decision where decision.result = 'CREATE'
      returning *
    ),
    changed_item as (
      update ${jobItems} item set status = 'IN_PROGRESS',
        version = item.version + 1, updated_at = now()
      from target, decision, created_execution
      where item.id = target.job_item_id and decision.result = 'CREATE'
      returning item.*
    ),
    changed_job as (
      update ${jobs} job set version = job.version + 1,
        updated_at = now(), updated_by_profile_id = ${actorProfileId}::uuid
      from target, decision, created_execution
      where job.id = target.job_id and decision.result = 'CREATE'
      returning job.*
    ),
    audited as (
      insert into ${jobAuditEvents} (
        job_id, job_item_id, event_type, actor_profile_id, source,
        previous_status, next_status, safe_metadata
      )
      select changed_job.id, changed_item.id, 'TREATMENT_STARTED',
        ${actorProfileId}::uuid,
        case when ${activeActorPermissionSql(actorProfileId, "OPERATIONS_MANAGE")}
          then 'STAFF' else 'TECHNICIAN' end,
        target.job_status, changed_job.status,
        jsonb_build_object('planDecision', target.decision)
      from changed_job join changed_item on true join target on true
      returning id
    )
    select case when decision.result = 'CREATE'
          and created_execution.id is not null
          and (select count(*) from audited) = 1
        then 'CHANGED' else decision.result end::text as result,
      coalesce(changed_job.job_reference, target.job_reference)
        as "jobReference",
      coalesce(changed_job.version, target.job_version) as "jobVersion",
      coalesce(changed_item.version, target.job_item_version)
        as "jobItemVersion",
      to_jsonb(decision.reason_codes) as "reasonCodes"
    from decision left join target on true
    left join created_execution on true left join changed_item on true
    left join changed_job on true
  `);
  return itemMutationResult(result.rows[0]);
}

/**
 * Completes an execution with observed performed facts. Any difference from
 * the confirmed plan is retained but moves the Job to review and can never
 * create a Cleaning Passport entry through ordinary completion.
 */
export async function completeJobItemTreatmentRecord(
  database: Database,
  actorProfileId: string,
  input: CompleteJobItemTreatmentInput,
): Promise<JobItemMutationResult> {
  const addonPayload = JSON.stringify(input.performedAddonIds);
  const result = await database.execute<ItemMutationRow>(sql`
    with target as materialized (
      select job.id as job_id, job.job_reference,
        job.status as job_status, job.version as job_version,
        job.assigned_team_id,
        ${operationalResourceReasonCodesSql(actorProfileId, {
          bookingId: sql`job.booking_id`,
          sourceOccupancyId: sql`job.source_occupancy_id`,
          sourceOccupancySnapshotVersion:
            sql`job.source_occupancy_snapshot_version`,
          assignedTeamId: sql`job.assigned_team_id`,
          assignedEquipmentResourceId:
            sql`job.assigned_equipment_resource_id`,
          scheduledStart: sql`job.scheduled_start_snapshot`,
          scheduledEnd: sql`job.scheduled_end_snapshot`,
        })} as operational_resource_reason_codes,
        item.id as job_item_id,
        item.status as item_status, item.version as job_item_version,
        plan.id as treatment_plan_id, plan.decision,
        plan.treatment_level_id, plan.mechanical_action_level_id,
        plan.treatment_approach_id, plan.cleaning_product_id as plan_product_id,
        execution.id as execution_id, execution.status as execution_status,
        execution.version as execution_version,
        execution.performed_treatment_level_id as existing_treatment_level_id,
        execution.performed_mechanical_action_level_id as existing_action_level_id,
        execution.performed_treatment_approach_id as existing_approach_id,
        execution.cleaning_product_id as existing_product_id,
        execution.performed_addons_snapshot as existing_addons_snapshot,
        execution.result_classification as existing_result_classification,
        execution.internal_technician_notes as existing_internal_technician_notes
      from ${jobs} job
      join ${jobItems} item on item.job_id = job.id
      left join ${jobItemTreatmentPlans} plan on plan.job_item_id = item.id
      left join ${jobItemTreatmentExecutions} execution
        on execution.job_item_id = item.id
      where job.job_reference = ${input.jobReference}
        and item.id = ${input.jobItemId}::uuid
        and ${jobExecutionUpdateSql(actorProfileId, sql`job.assigned_team_id`)}
      for update of job, item
    ),
    provided_addons as materialized (
      select value::integer as addon_id
      from jsonb_array_elements_text(${addonPayload}::jsonb) value
    ),
    plan_addons as materialized (
      select addon.service_addon_id as addon_id
      from target
      join ${jobItemTreatmentPlanAddons} addon
        on addon.treatment_plan_id = target.treatment_plan_id
    ),
    canonical as materialized (
      select target.*,
        (select count(*)::integer from provided_addons) as provided_addon_count,
        (select count(*)::integer from plan_addons) as plan_addon_count,
        (select count(*)::integer from provided_addons provided
          join ${serviceAddons} addon on addon.id = provided.addon_id)
          as valid_addon_count,
        exists (select 1 from ${treatmentLevels} reference
          where reference.id = ${input.performedTreatmentLevelId})
          as treatment_level_valid,
        exists (select 1 from ${mechanicalActionLevels} reference
          where reference.id = ${input.performedMechanicalActionLevelId})
          as action_level_valid,
        exists (select 1 from ${treatmentApproaches} reference
          where reference.id = ${input.performedTreatmentApproachId})
          as approach_valid,
        (${input.cleaningProductId}::integer is null or exists (
          select 1 from ${cleaningProducts} product
          where product.id = ${input.cleaningProductId}
        )) as product_valid
      from target
    ),
    conformance as materialized (
      select canonical.*,
        array_remove(array[
          case when canonical.decision not in
              ('PERFORM', 'PERFORM_WITH_LIMITATIONS')
            then 'PLAN_NOT_PERFORMABLE' end,
          case when canonical.treatment_level_id is distinct from
              ${input.performedTreatmentLevelId}
            then 'TREATMENT_LEVEL_CHANGED' end,
          case when canonical.mechanical_action_level_id is distinct from
              ${input.performedMechanicalActionLevelId}
            then 'MECHANICAL_ACTION_CHANGED' end,
          case when canonical.treatment_approach_id is distinct from
              ${input.performedTreatmentApproachId}
            then 'TREATMENT_APPROACH_CHANGED' end,
          case when canonical.plan_addon_count <> canonical.provided_addon_count
              or exists (select 1 from plan_addons planned
                where not exists (select 1 from provided_addons performed
                  where performed.addon_id = planned.addon_id))
              or exists (select 1 from provided_addons performed
                where not exists (select 1 from plan_addons planned
                  where planned.addon_id = performed.addon_id))
            then 'ADDONS_CHANGED' end,
          case when canonical.plan_product_id is distinct from
              ${input.cleaningProductId}
            then 'PRODUCT_CHANGED' end,
          case when ${input.resultClassification} = 'STOPPED_FOR_SAFETY'
            then 'STOPPED_FOR_SAFETY' end
        ], null)::text[] as reason_codes
      from canonical
    ),
    decision as materialized (
      select case
          when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
          when conformance.execution_status = 'COMPLETED'
            and conformance.execution_id = ${input.treatmentExecutionId}::uuid
            and conformance.existing_treatment_level_id =
              ${input.performedTreatmentLevelId}
            and conformance.existing_action_level_id =
              ${input.performedMechanicalActionLevelId}
            and conformance.existing_approach_id =
              ${input.performedTreatmentApproachId}
            and conformance.existing_product_id is not distinct from
              ${input.cleaningProductId}
            and conformance.existing_result_classification =
              ${input.resultClassification}
            and conformance.existing_internal_technician_notes is not distinct from
              ${input.technicianNotes}
            and coalesce(conformance.existing_addons_snapshot -> 'addonIds',
              '[]'::jsonb) = ${addonPayload}::jsonb
            then 'NO_CHANGE'
          when conformance.execution_status = 'COMPLETED' then 'CONFLICT'
          when conformance.job_version <> ${input.expectedJobVersion}
            or conformance.job_item_version <> ${input.expectedJobItemVersion}
            or conformance.execution_version <>
              ${input.expectedTreatmentExecutionVersion}
            then 'CONFLICT'
          when conformance.job_status <> 'IN_PROGRESS'
            or conformance.item_status <> 'IN_PROGRESS'
            or conformance.execution_id is distinct from
              ${input.treatmentExecutionId}::uuid
            or conformance.execution_status <> 'IN_PROGRESS'
            or conformance.decision not in
              ('PERFORM', 'PERFORM_WITH_LIMITATIONS')
            then 'INVALID_TRANSITION'
          when cardinality(conformance.operational_resource_reason_codes) > 0
            then 'REQUIRES_REVIEW'
          when not conformance.treatment_level_valid
            or not conformance.action_level_valid
            or not conformance.approach_valid
            or not conformance.product_valid
            or conformance.valid_addon_count <> conformance.provided_addon_count
            then 'INCOMPLETE'
          else 'COMPLETE'
        end as result,
        case
          when cardinality(conformance.operational_resource_reason_codes) > 0
            then conformance.operational_resource_reason_codes
          else coalesce(conformance.reason_codes, array[]::text[])
        end as reason_codes
      from conformance
      union all select 'NOT_FOUND_OR_FORBIDDEN', array[]::text[]
      where not exists (select 1 from target)
    ),
    changed_execution as (
      update ${jobItemTreatmentExecutions} execution
      set status = 'COMPLETED',
        performed_treatment_level_id = ${input.performedTreatmentLevelId},
        performed_mechanical_action_level_id =
          ${input.performedMechanicalActionLevelId},
        performed_treatment_approach_id = ${input.performedTreatmentApproachId},
        cleaning_product_id = ${input.cleaningProductId},
        performed_addons_snapshot = jsonb_build_object(
          'schemaVersion', 1, 'addonIds', ${addonPayload}::jsonb),
        result_classification = ${input.resultClassification},
        internal_technician_notes = ${input.technicianNotes},
        completed_at = now(), completed_by_profile_id = ${actorProfileId}::uuid,
        completion_snapshot = jsonb_build_object(
          'schemaVersion', 1,
          'treatmentPlanId', conformance.treatment_plan_id,
          'performedTreatmentLevelId', ${input.performedTreatmentLevelId},
          'performedMechanicalActionLevelId',
            ${input.performedMechanicalActionLevelId},
          'performedTreatmentApproachId', ${input.performedTreatmentApproachId},
          'performedAddonIds', ${addonPayload}::jsonb,
          'cleaningProductId', ${input.cleaningProductId},
          'resultClassification', ${input.resultClassification},
          'conformanceReasonCodes', to_jsonb(conformance.reason_codes),
          'completedAt', now()
        ),
        version = execution.version + 1, updated_at = now()
      from conformance, decision
      where execution.id = conformance.execution_id
        and decision.result = 'COMPLETE'
      returning execution.*
    ),
    changed_item as (
      update ${jobItems} item
      set status = case when cardinality(conformance.reason_codes) = 0
          then 'COMPLETED' else 'REQUIRES_REVIEW' end,
        version = item.version + 1, updated_at = now()
      from conformance, decision, changed_execution
      where item.id = conformance.job_item_id
        and decision.result = 'COMPLETE'
      returning item.*
    ),
    changed_job as (
      update ${jobs} job
      set status = case when cardinality(conformance.reason_codes) > 0
          then 'REQUIRES_REVIEW' else job.status end,
        review_reason_code = case when cardinality(conformance.reason_codes) > 0
          then conformance.reason_codes[1] end,
        review_reason_text = case when cardinality(conformance.reason_codes) > 0
          then array_to_string(conformance.reason_codes, ',') end,
        version = job.version + 1, updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from conformance, decision, changed_execution
      where job.id = conformance.job_id and decision.result = 'COMPLETE'
      returning job.*
    ),
    audited as (
      insert into ${jobAuditEvents} (
        job_id, job_item_id, event_type, actor_profile_id, source,
        previous_status, next_status, safe_metadata
      )
      select changed_job.id, changed_item.id, event.event_type,
        ${actorProfileId}::uuid,
        case when ${activeActorPermissionSql(actorProfileId, "OPERATIONS_MANAGE")}
          then 'STAFF' else 'TECHNICIAN' end,
        conformance.job_status, changed_job.status,
        jsonb_build_object('resultClassification', ${input.resultClassification},
          'reasonCodes', to_jsonb(conformance.reason_codes))
      from changed_job join changed_item on true join conformance on true
      cross join lateral (values ('TREATMENT_COMPLETED'),
        ('REQUIRES_REVIEW')) event(event_type)
      where event.event_type = 'TREATMENT_COMPLETED'
        or cardinality(conformance.reason_codes) > 0
      returning id
    )
    select case when decision.result = 'COMPLETE'
          and changed_execution.id is not null
          and (select count(*) from audited) >= 1
        then 'CHANGED' else decision.result end::text as result,
      coalesce(changed_job.job_reference, conformance.job_reference)
        as "jobReference",
      coalesce(changed_job.version, conformance.job_version) as "jobVersion",
      coalesce(changed_item.version, conformance.job_item_version)
        as "jobItemVersion",
      to_jsonb(decision.reason_codes) as "reasonCodes"
    from decision left join conformance on true
    left join changed_execution on true left join changed_item on true
    left join changed_job on true
  `);
  return itemMutationResult(result.rows[0]);
}

/**
 * Atomically closes a fully resolved Job and appends asset history. Passport
 * rows are derived only from completed, conforming executions with an exact
 * asset link; inspection-only, declined, referred, stopped and review items
 * are intentionally excluded.
 */
export async function completeJobRecord(
  database: Database,
  actorProfileId: string,
  input: CompleteJobInput,
): Promise<JobMutationResult> {
  const recommendationPayload = JSON.stringify(input.maintenanceRecommendations);
  const result = await database.execute<MutationRow>(sql`
    with target as materialized (
      select job.*,
        ${operationalResourceReasonCodesSql(actorProfileId, {
          bookingId: sql`job.booking_id`,
          sourceOccupancyId: sql`job.source_occupancy_id`,
          sourceOccupancySnapshotVersion:
            sql`job.source_occupancy_snapshot_version`,
          assignedTeamId: sql`job.assigned_team_id`,
          assignedEquipmentResourceId:
            sql`job.assigned_equipment_resource_id`,
          scheduledStart: sql`job.scheduled_start_snapshot`,
          scheduledEnd: sql`job.scheduled_end_snapshot`,
        })} as operational_resource_reason_codes
      from ${jobs} job
      where job.job_reference = ${input.jobReference}
        and ${jobExecutionUpdateSql(actorProfileId, sql`job.assigned_team_id`)}
      for update of job
    ),
    locked_items as materialized (
      select item.*, inspection.id as inspection_id,
        inspection.observed_condition_level_id,
        inspection.internal_technician_notes as inspection_notes,
        plan.id as treatment_plan_id, plan.decision,
        execution.id as execution_id,
        execution.status as execution_status,
        execution.completed_at as execution_completed_at,
        execution.result_classification,
        execution.performed_treatment_level_id,
        execution.performed_mechanical_action_level_id,
        execution.performed_treatment_approach_id,
        execution.performed_addons_snapshot,
        execution.cleaning_product_id,
        execution.performed_by_profile_id,
        execution.internal_technician_notes as execution_notes
      from target
      join ${jobItems} item on item.job_id = target.id
      left join ${jobItemInspections} inspection
        on inspection.job_item_id = item.id
      left join ${jobItemTreatmentPlans} plan on plan.job_item_id = item.id
      left join ${jobItemTreatmentExecutions} execution
        on execution.job_item_id = item.id
      for update of item
    ),
    recommendations as materialized (
      select case when pg_input_is_valid(value ->> 'jobItemId', 'uuid')
          then (value ->> 'jobItemId')::uuid end as job_item_id,
        value -> 'recommendation' as recommendation
      from jsonb_array_elements(${recommendationPayload}::jsonb) value
    ),
    existing_recommendations as materialized (
      select coalesce(jsonb_agg(jsonb_build_object(
        'jobItemId', passport.job_item_id,
        'recommendation', jsonb_build_object(
          'recommendedReviewDate', to_char(
            passport.recommended_review_date, 'YYYY-MM-DD'),
          'suggestedIntervalMonths', passport.suggested_interval_months,
          'reason', passport.maintenance_recommendation_reason,
          'sourceType', passport.maintenance_recommendation_source_type
        )
      ) order by passport.job_item_id), '[]'::jsonb) as value
      from target
      join ${cleaningPassportEntries} passport on passport.job_id = target.id
      where passport.maintenance_recommendation_source_type is not null
    ),
    recommendation_evidence as materialized (
      select recommendation.job_item_id, recommendation.recommendation
      from recommendations recommendation
      join locked_items item on item.id = recommendation.job_item_id
        and item.status = 'COMPLETED'
        and item.cleaning_asset_id is not null
        and item.execution_status = 'COMPLETED'
        and item.result_classification in (
          'COMPLETED_AS_PLANNED', 'COMPLETED_WITH_LIMITATIONS',
          'PARTIAL_IMPROVEMENT')
      where recommendation.job_item_id is not null
        and jsonb_typeof(recommendation.recommendation) = 'object'
    ),
    readiness as materialized (
      select target.*,
        (select count(*)::integer from locked_items) as item_count,
        (select count(*)::integer from recommendations)
          as recommendation_count,
        (select count(*)::integer from recommendation_evidence)
          as valid_recommendation_count,
        array_remove(array[
          case when target.status <> 'IN_PROGRESS'
            then 'JOB_NOT_IN_PROGRESS' end,
          case when not exists (select 1 from locked_items)
            then 'NO_JOB_ITEMS' end,
          case when exists (select 1 from locked_items
              where inspection_id is null) then 'INSPECTION_MISSING' end,
          case when exists (select 1 from locked_items
              where treatment_plan_id is null) then 'TREATMENT_PLAN_MISSING' end,
          case when exists (select 1 from locked_items
              where status = 'COMPLETED' and (
                execution_id is null or execution_status <> 'COMPLETED'
                or result_classification = 'STOPPED_FOR_SAFETY'))
            then 'TREATMENT_EXECUTION_INCOMPLETE' end,
          case when exists (select 1 from locked_items
              where status not in ('COMPLETED', 'DECLINED', 'REFERRED'))
            then 'ITEM_UNRESOLVED' end,
          case when exists (select 1 from locked_items
              where status = 'REQUIRES_REVIEW') then 'REVIEW_REQUIRED' end,
          case when (select count(*) from recommendations) <>
              (select count(*) from recommendation_evidence)
            then 'INVALID_MAINTENANCE_RECOMMENDATION' end
        ], null)::text[] as reason_codes
      from target
    ),
    decision as materialized (
      select case
          when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
          when readiness.status = 'COMPLETED'
            and readiness.internal_completion_notes =
              ${input.internalCompletionNotes}
            and readiness.customer_visible_completion_notes is not distinct from
              ${input.customerVisibleCompletionNotes}
            and readiness.completion_snapshot ->> 'customerVisibleCareNotes'
              is not distinct from ${input.customerVisibleCareNotes}
            and (select value from existing_recommendations) =
              ${recommendationPayload}::jsonb
            then 'NO_CHANGE'
          when readiness.status = 'COMPLETED' then 'CONFLICT'
          when readiness.version <> ${input.expectedJobVersion} then 'CONFLICT'
          when cardinality(readiness.operational_resource_reason_codes) > 0
            then 'REQUIRES_REVIEW'
          when cardinality(readiness.reason_codes) > 0 then 'INCOMPLETE'
          else 'COMPLETE'
        end as result,
        case
          when cardinality(readiness.operational_resource_reason_codes) > 0
            then readiness.operational_resource_reason_codes
          else coalesce(readiness.reason_codes, array[]::text[])
        end as reason_codes
      from readiness
      union all select 'NOT_FOUND_OR_FORBIDDEN', array[]::text[]
      where not exists (select 1 from target)
    ),
    changed_job as (
      update ${jobs} job
      set status = 'COMPLETED', completed_at = now(),
        actual_productive_minutes = greatest(0,
          floor(extract(epoch from (now() - job.started_at)) / 60)::integer),
        actual_occupied_team_minutes = greatest(0,
          floor(extract(epoch from (now() - job.en_route_at)) / 60)::integer),
        internal_completion_notes = ${input.internalCompletionNotes},
        customer_visible_completion_notes =
          ${input.customerVisibleCompletionNotes},
        completion_snapshot = jsonb_build_object(
          'schemaVersion', 1,
          'jobReference', job.job_reference,
          'bookingId', job.booking_id,
          'sourceBookingVersion', job.source_booking_version,
          'sourceProvenanceSnapshot', job.source_provenance_snapshot,
          'schedulingSnapshot', job.scheduling_snapshot,
          'plannedDurationSnapshot', job.planned_duration_snapshot,
          'completedItemCount', (select count(*) from locked_items
            where status = 'COMPLETED'),
          'declinedItemCount', (select count(*) from locked_items
            where status = 'DECLINED'),
          'referredItemCount', (select count(*) from locked_items
            where status = 'REFERRED'),
          'actualProductiveMinutes', greatest(0,
            floor(extract(epoch from (now() - job.started_at)) / 60)::integer),
          'actualOccupiedTeamMinutes', greatest(0,
            floor(extract(epoch from (now() - job.en_route_at)) / 60)::integer),
          'items', coalesce((select jsonb_agg(jsonb_build_object(
              'jobItemId', item.id,
              'status', item.status,
              'cleaningAssetId', item.cleaning_asset_id,
              'inspectionId', item.inspection_id,
              'observedConditionLevelId', item.observed_condition_level_id,
              'observedIssueTypeIds', coalesce((select jsonb_agg(
                  observed_issue.issue_type_id order by
                    observed_issue.issue_type_id)
                from ${jobItemInspectionIssues} observed_issue
                where observed_issue.job_item_id = item.id), '[]'::jsonb),
              'observedRiskFlagIds', coalesce((select jsonb_agg(
                  observed_risk.risk_flag_id order by
                    observed_risk.risk_flag_id)
                from ${jobItemInspectionRisks} observed_risk
                where observed_risk.job_item_id = item.id), '[]'::jsonb),
              'treatmentPlanId', item.treatment_plan_id,
              'treatmentDecision', item.decision,
              'treatmentExecutionId', item.execution_id,
              'treatmentCompletedAt', item.execution_completed_at,
              'performedTreatmentLevelId',
                item.performed_treatment_level_id,
              'performedMechanicalActionLevelId',
                item.performed_mechanical_action_level_id,
              'performedTreatmentApproachId',
                item.performed_treatment_approach_id,
              'performedAddonsSnapshot', item.performed_addons_snapshot,
              'cleaningProductId', item.cleaning_product_id,
              'resultClassification', item.result_classification,
              'performedByProfileId', item.performed_by_profile_id
            ) order by item.sort_order, item.id) from locked_items item),
            '[]'::jsonb),
          'customerVisibleCompletionNotes',
            ${input.customerVisibleCompletionNotes},
          'customerVisibleCareNotes', ${input.customerVisibleCareNotes},
          'completedAt', now(),
          'completedByProfileId', ${actorProfileId}::uuid
        ),
        completed_by_profile_id = ${actorProfileId}::uuid,
        version = job.version + 1, updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from decision
      where job.id = (select id from target) and decision.result = 'COMPLETE'
      returning job.*
    ),
    created_passports as (
      insert into ${cleaningPassportEntries} (
        cleaning_asset_id, job_id, job_item_id, treatment_execution_id,
        source_execution_status, completed_at, observed_condition_level_id,
        treatment_level_id,
        mechanical_action_level_id, treatment_approach_id,
        result_classification, customer_visible_service_summary,
        customer_visible_condition_summary,
        customer_visible_treatment_summary,
        customer_visible_care_recommendation,
        issues_treated_snapshot, risks_noted_snapshot,
        customer_safe_snapshot, recommended_review_date,
        suggested_interval_months, maintenance_recommendation_reason,
        maintenance_recommendation_source_type, performed_by_profile_id
      )
      select item.cleaning_asset_id, changed_job.id, item.id,
        item.execution_id, 'COMPLETED', item.execution_completed_at,
        item.observed_condition_level_id,
        item.performed_treatment_level_id,
        item.performed_mechanical_action_level_id,
        item.performed_treatment_approach_id,
        item.result_classification,
        item.customer_visible_description_bg, condition.label_bg,
        concat_ws(' / ', treatment.label_bg, action.label_bg, approach.label_bg),
        ${input.customerVisibleCareNotes},
        jsonb_build_object('schemaVersion', 1,
          'classification', 'OBSERVED_DURING_TREATED_ITEM',
          'issues', coalesce((
          select jsonb_agg(jsonb_build_object(
            'issueTypeId', observed_issue.issue_type_id,
            'code', issue.code, 'labelBg', issue.label_bg,
            'labelEn', issue.label_en
          ) order by observed_issue.issue_type_id)
          from ${jobItemInspectionIssues} observed_issue
          join ${issueTypes} issue on issue.id = observed_issue.issue_type_id
          where observed_issue.job_item_id = item.id
        ), '[]'::jsonb)),
        jsonb_build_object('schemaVersion', 1, 'risks', coalesce((
          select jsonb_agg(jsonb_build_object(
            'riskFlagId', observed_risk.risk_flag_id,
            'code', risk.code, 'labelBg', risk.label_bg,
            'labelEn', risk.label_en
          ) order by observed_risk.risk_flag_id)
          from ${jobItemInspectionRisks} observed_risk
          join ${riskFlags} risk on risk.id = observed_risk.risk_flag_id
          where observed_risk.job_item_id = item.id
        ), '[]'::jsonb)),
        jsonb_build_object(
          'schemaVersion', 1,
          'jobReference', changed_job.job_reference,
          'completedAt', item.execution_completed_at,
          'serviceDescriptionBg', item.customer_visible_description_bg,
          'serviceDescriptionEn', item.customer_visible_description_en,
          'observedConditionSummaryBg', condition.label_bg,
          'observedConditionSummaryEn', condition.label_en,
          'treatmentSummaryBg', concat_ws(' / ', treatment.label_bg,
            action.label_bg, approach.label_bg),
          'treatmentSummaryEn', concat_ws(' / ', treatment.label_en,
            action.label_en, approach.label_en),
          'resultClassification', item.result_classification,
          'careRecommendation', ${input.customerVisibleCareNotes},
          'maintenanceRecommendation', recommendation.recommendation
        ),
        case when pg_input_is_valid(
            recommendation.recommendation ->> 'recommendedReviewDate', 'date')
          then (recommendation.recommendation ->> 'recommendedReviewDate')::date
        end,
        case when pg_input_is_valid(
            recommendation.recommendation ->> 'suggestedIntervalMonths',
            'integer')
          then (recommendation.recommendation ->> 'suggestedIntervalMonths')::integer
        end,
        recommendation.recommendation ->> 'reason',
        recommendation.recommendation ->> 'sourceType',
        item.performed_by_profile_id
      from changed_job
      join locked_items item on item.status = 'COMPLETED'
        and item.cleaning_asset_id is not null
        and item.execution_status = 'COMPLETED'
        and item.result_classification in (
          'COMPLETED_AS_PLANNED', 'COMPLETED_WITH_LIMITATIONS',
          'PARTIAL_IMPROVEMENT')
      join ${conditionLevels} condition
        on condition.id = item.observed_condition_level_id
      join ${treatmentLevels} treatment
        on treatment.id = item.performed_treatment_level_id
      join ${mechanicalActionLevels} action
        on action.id = item.performed_mechanical_action_level_id
      join ${treatmentApproaches} approach
        on approach.id = item.performed_treatment_approach_id
      left join recommendation_evidence recommendation
        on recommendation.job_item_id = item.id
      returning *
    ),
    audited_completion as (
      insert into ${jobAuditEvents} (
        job_id, event_type, actor_profile_id, source,
        previous_status, next_status, safe_metadata
      )
      select changed_job.id, 'JOB_COMPLETED', ${actorProfileId}::uuid,
        case when ${activeActorPermissionSql(actorProfileId, "OPERATIONS_MANAGE")}
          then 'STAFF' else 'TECHNICIAN' end,
        target.status, changed_job.status,
        jsonb_build_object(
          'resolvedItemCount', (select count(*) from locked_items),
          'passportEntryCount', (select count(*) from created_passports),
          'actualProductiveMinutes', changed_job.actual_productive_minutes,
          'actualOccupiedTeamMinutes',
            changed_job.actual_occupied_team_minutes)
      from changed_job join target on true
      returning id
    ),
    audited_passports as (
      insert into ${jobAuditEvents} (
        job_id, job_item_id, event_type, actor_profile_id, source,
        previous_status, next_status, safe_metadata
      )
      select passport.job_id, passport.job_item_id,
        'PASSPORT_ENTRY_CREATED', ${actorProfileId}::uuid, 'SYSTEM',
        'IN_PROGRESS', 'COMPLETED',
        jsonb_build_object('resultClassification',
          passport.result_classification)
      from created_passports passport
      returning id
    )
    select case when decision.result = 'COMPLETE'
          and changed_job.id is not null
          and (select count(*) from audited_completion) = 1
          and (select count(*) from audited_passports) =
            (select count(*) from created_passports)
        then 'CHANGED' else decision.result end::text as result,
      coalesce(changed_job.job_reference, readiness.job_reference)
        as "jobReference",
      coalesce(changed_job.version, readiness.version) as version,
      to_jsonb(decision.reason_codes) as "reasonCodes"
    from decision left join readiness on true left join changed_job on true
  `);
  return mutationResult(result.rows[0]);
}

export async function cancelJobRecord(
  database: Database,
  actorProfileId: string,
  input: CancelJobInput,
): Promise<JobMutationResult> {
  const result = await database.execute<MutationRow>(sql`
    with target as materialized (
      select job.* from ${jobs} job
      where job.job_reference = ${input.jobReference}
        and ${jobManagementSql(actorProfileId)}
      for update of job
    ),
    decision as materialized (
      select case
          when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
          when target.status = 'CANCELLED'
            and target.cancellation_reason_category = ${input.reasonCategory}
            and target.cancellation_reason_text is not distinct from
              ${input.reasonText}
            then 'NO_CHANGE'
          when target.status = 'CANCELLED' then 'CONFLICT'
          when target.version <> ${input.expectedJobVersion} then 'CONFLICT'
          when target.status not in ('PREPARED', 'READY')
            then 'INVALID_TRANSITION'
          else 'CANCEL'
        end as result
      from target
      union all select 'NOT_FOUND_OR_FORBIDDEN'
      where not exists (select 1 from target)
    ),
    changed as (
      update ${jobs} job
      set status = 'CANCELLED', cancelled_at = now(),
        cancellation_reason_category = ${input.reasonCategory},
        cancellation_reason_text = ${input.reasonText},
        cancelled_by_profile_id = ${actorProfileId}::uuid,
        version = job.version + 1, updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from decision
      where job.id = (select id from target) and decision.result = 'CANCEL'
      returning job.*
    ),
    audited as (
      insert into ${jobAuditEvents} (
        job_id, event_type, actor_profile_id, source,
        previous_status, next_status, safe_metadata
      )
      select changed.id, 'JOB_CANCELLED', ${actorProfileId}::uuid,
        'STAFF', target.status, changed.status,
        jsonb_build_object('reasonCategory', ${input.reasonCategory})
      from changed join target on target.id = changed.id
      returning id
    )
    select case when decision.result = 'CANCEL' and changed.id is not null
          and (select count(*) from audited) = 1
        then 'CHANGED' else decision.result end::text as result,
      coalesce(changed.job_reference, target.job_reference)
        as "jobReference",
      coalesce(changed.version, target.version) as version
    from decision left join target on true left join changed on true
  `);
  return mutationResult(result.rows[0]);
}

type CustomerPassportRow = CustomerCleaningPassportEntry & {
  maintenanceRecommendationValue: unknown;
};

function mapMaintenanceRecommendation(
  value: unknown,
): CustomerCleaningPassportEntry["maintenanceRecommendation"] {
  if (!value) return null;
  const item = object(value);
  if (typeof item.reason !== "string") return null;
  return {
    recommendedReviewDate:
      typeof item.recommendedReviewDate === "string"
        ? item.recommendedReviewDate
        : null,
    suggestedIntervalMonths: integerOrNull(item.suggestedIntervalMonths),
    reason: item.reason,
    sourceType: "TECHNICIAN_ASSESSMENT",
  };
}

/** Customer history reads only an exact active identity/property/asset link. */
export async function loadCustomerCleaningPassportRecord(
  database: Database,
  actorProfileId: string,
  input: Readonly<{ propertyId: string; assetId: string }>,
): Promise<CleaningPassportPage | null> {
  const assetResult = await database.execute<{
    assetLabel: string;
    locale: "bg" | "en";
  }>(sql`
    select asset.label as "assetLabel", profile.preferred_locale as locale
    from ${cleaningAssets} asset
    join ${properties} property on property.id = asset.property_id
    join ${userProfiles} profile on profile.id = ${actorProfileId}::uuid
      and profile.status = 'ACTIVE'
    where asset.id = ${input.assetId}::uuid
      and asset.property_id = ${input.propertyId}::uuid
      and asset.status <> 'ARCHIVED'
      and ${customerAssetReadSql(actorProfileId, sql`property.customer_id`)}
    limit 1
  `);
  const asset = assetResult.rows[0];
  if (!asset) return null;

  const result = await database.execute<CustomerPassportRow>(sql`
    select job.job_reference as "jobReference", entry.completed_at as "completedAt",
      case when profile.preferred_locale = 'en'
        then coalesce(entry.customer_safe_snapshot ->> 'serviceDescriptionEn',
          entry.customer_visible_service_summary)
        else coalesce(entry.customer_safe_snapshot ->> 'serviceDescriptionBg',
          entry.customer_visible_service_summary) end as "serviceDescription",
      case when profile.preferred_locale = 'en'
        then coalesce(entry.customer_safe_snapshot ->> 'observedConditionSummaryEn',
          entry.customer_visible_condition_summary)
        else coalesce(entry.customer_safe_snapshot ->> 'observedConditionSummaryBg',
          entry.customer_visible_condition_summary) end as "observedConditionSummary",
      case when profile.preferred_locale = 'en'
        then coalesce(entry.customer_safe_snapshot ->> 'treatmentSummaryEn',
          entry.customer_visible_treatment_summary)
        else coalesce(entry.customer_safe_snapshot ->> 'treatmentSummaryBg',
          entry.customer_visible_treatment_summary) end as "treatmentSummary",
      entry.result_classification as "resultClassification",
      entry.customer_visible_care_recommendation as "careRecommendation",
      case when entry.maintenance_recommendation_reason is null then null
        else jsonb_build_object(
          'recommendedReviewDate', entry.recommended_review_date,
          'suggestedIntervalMonths', entry.suggested_interval_months,
          'reason', entry.maintenance_recommendation_reason,
          'sourceType', entry.maintenance_recommendation_source_type
        ) end as "maintenanceRecommendationValue"
    from ${cleaningPassportEntries} entry
    join ${cleaningAssets} asset on asset.id = entry.cleaning_asset_id
      and asset.property_id = ${input.propertyId}::uuid
    join ${properties} property on property.id = asset.property_id
    join ${jobs} job on job.id = entry.job_id and job.status = 'COMPLETED'
    join ${userProfiles} profile on profile.id = ${actorProfileId}::uuid
      and profile.status = 'ACTIVE'
    where entry.cleaning_asset_id = ${input.assetId}::uuid
      and ${customerAssetReadSql(actorProfileId, sql`property.customer_id`)}
    order by entry.completed_at desc, entry.id desc
  `);
  return {
    assetLabel: asset.assetLabel,
    entries: result.rows.map(({ maintenanceRecommendationValue, ...entry }) => ({
      ...entry,
      maintenanceRecommendation: mapMaintenanceRecommendation(
        maintenanceRecommendationValue,
      ),
    })),
  };
}

type StaffPassportRow = Omit<
  StaffCleaningPassportEntry,
  "maintenanceRecommendation" | "immutableSnapshot"
> & {
  maintenanceRecommendationValue: unknown;
  immutableSnapshotValue: unknown;
};

/** Staff history is still exact-property scoped and freshly authorized. */
export async function loadStaffCleaningPassportRecords(
  database: Database,
  actorProfileId: string,
  input: Readonly<{ propertyId: string; assetId: string }>,
): Promise<Readonly<{
  assetLabel: string;
  entries: readonly StaffCleaningPassportEntry[];
}> | null> {
  const assetResult = await database.execute<{ assetLabel: string }>(sql`
    select asset.label as "assetLabel"
    from ${cleaningAssets} asset
    where asset.id = ${input.assetId}::uuid
      and asset.property_id = ${input.propertyId}::uuid
      and ${staffAssetReadSql(actorProfileId)}
    limit 1
  `);
  const asset = assetResult.rows[0];
  if (!asset) return null;

  const result = await database.execute<StaffPassportRow>(sql`
    select entry.id, entry.job_item_id as "jobItemId",
      job.job_reference as "jobReference", entry.completed_at as "completedAt",
      case when profile.preferred_locale = 'en'
        then coalesce(entry.customer_safe_snapshot ->> 'serviceDescriptionEn',
          entry.customer_visible_service_summary)
        else coalesce(entry.customer_safe_snapshot ->> 'serviceDescriptionBg',
          entry.customer_visible_service_summary) end as "serviceDescription",
      case when profile.preferred_locale = 'en'
        then coalesce(entry.customer_safe_snapshot ->> 'observedConditionSummaryEn',
          entry.customer_visible_condition_summary)
        else coalesce(entry.customer_safe_snapshot ->> 'observedConditionSummaryBg',
          entry.customer_visible_condition_summary) end as "observedConditionSummary",
      case when profile.preferred_locale = 'en'
        then coalesce(entry.customer_safe_snapshot ->> 'treatmentSummaryEn',
          entry.customer_visible_treatment_summary)
        else coalesce(entry.customer_safe_snapshot ->> 'treatmentSummaryBg',
          entry.customer_visible_treatment_summary) end as "treatmentSummary",
      entry.result_classification as "resultClassification",
      entry.customer_visible_care_recommendation as "careRecommendation",
      coalesce((select jsonb_agg(value ->> 'code' order by value ->> 'code')
        from jsonb_array_elements(
          coalesce(entry.issues_treated_snapshot -> 'issues', '[]'::jsonb)
        ) value), '[]'::jsonb) as "inspectionIssueSummary",
      coalesce((select jsonb_agg(value ->> 'code' order by value ->> 'code')
        from jsonb_array_elements(
          coalesce(entry.risks_noted_snapshot -> 'risks', '[]'::jsonb)
        ) value), '[]'::jsonb) as "inspectionRiskSummary",
      execution.internal_technician_notes as "internalTechnicianNotes",
      entry.customer_safe_snapshot as "immutableSnapshotValue",
      case when entry.maintenance_recommendation_reason is null then null
        else jsonb_build_object(
          'recommendedReviewDate', entry.recommended_review_date,
          'suggestedIntervalMonths', entry.suggested_interval_months,
          'reason', entry.maintenance_recommendation_reason,
          'sourceType', entry.maintenance_recommendation_source_type
        ) end as "maintenanceRecommendationValue"
    from ${cleaningPassportEntries} entry
    join ${cleaningAssets} asset on asset.id = entry.cleaning_asset_id
      and asset.property_id = ${input.propertyId}::uuid
    join ${jobs} job on job.id = entry.job_id and job.status = 'COMPLETED'
    join ${jobItemTreatmentExecutions} execution
      on execution.id = entry.treatment_execution_id
    join ${userProfiles} profile on profile.id = ${actorProfileId}::uuid
      and profile.status = 'ACTIVE'
    where entry.cleaning_asset_id = ${input.assetId}::uuid
      and ${staffAssetReadSql(actorProfileId)}
    order by entry.completed_at desc, entry.id desc
  `);
  return {
    assetLabel: asset.assetLabel,
    entries: result.rows.map(
      ({ maintenanceRecommendationValue, immutableSnapshotValue, ...entry }) => ({
        ...entry,
        maintenanceRecommendation: mapMaintenanceRecommendation(
          maintenanceRecommendationValue,
        ),
        immutableSnapshot: object(immutableSnapshotValue),
      }),
    ),
  };
}

export function createDatabaseJobExecutionRepository(
  database: Database,
): JobExecutionRepository {
  return {
    createJob: (actorProfileId, input) =>
      createJobFromBookingRecord(database, actorProfileId, input),
    listJobs: (actorProfileId, input) =>
      listJobRecords(database, actorProfileId, input),
    getJob: (actorProfileId, jobReference) =>
      loadJobRecord(database, actorProfileId, jobReference),
    assignTeam: (actorProfileId, input) =>
      assignJobTeamRecord(database, actorProfileId, input),
    transitionJob: (actorProfileId, input, status) =>
      transitionJobRecord(database, actorProfileId, input, status),
    recordInspection: (actorProfileId, input) =>
      recordJobItemInspectionRecord(database, actorProfileId, input),
    confirmTreatmentPlan: (actorProfileId, input) =>
      confirmJobItemTreatmentPlanRecord(database, actorProfileId, input),
    startTreatment: (actorProfileId, input) =>
      startJobItemTreatmentRecord(database, actorProfileId, input),
    completeTreatment: (actorProfileId, input) =>
      completeJobItemTreatmentRecord(database, actorProfileId, input),
    completeJob: (actorProfileId, input) =>
      completeJobRecord(database, actorProfileId, input),
    cancelJob: (actorProfileId, input) =>
      cancelJobRecord(database, actorProfileId, input),
    getCustomerPassport: (actorProfileId, input) =>
      loadCustomerCleaningPassportRecord(database, actorProfileId, input),
    getStaffAssetHistory: (actorProfileId, input) =>
      loadStaffCleaningPassportRecords(database, actorProfileId, input),
  };
}
