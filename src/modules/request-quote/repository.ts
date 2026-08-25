import "server-only";

import { and, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  businessAuditEvents,
  quoteItems,
  quotes,
  requestEstimates,
  serviceRequestItemAddons,
  serviceRequestItemIssues,
  serviceRequestItems,
  serviceRequests,
} from "@/db/schema/request-quote";
import {
  cleaningAssets,
  cleaningAssetReportedRiskFlags,
  customerContacts,
  customerIdentityLinks,
  customers,
  properties,
} from "@/db/schema/customer-crm";
import {
  applicationRoles,
  permissions,
  rolePermissions,
  userProfiles,
  userRoles,
} from "@/db/schema/identity-access";
import {
  durationModels,
  priceBooks,
  travelZones as travelZoneRecords,
} from "@/db/schema/commercial-engine";
import {
  cleaningItemTypes,
  cleaningItemTypeMeasurementModes,
  capabilityStatuses,
  conditionLevels,
  fibreMaterials,
  issueTypes,
  measurementModes,
  riskFlags,
  serviceItemCapabilities,
  serviceAddonCapabilities,
  serviceAddons,
  services,
  surfaceConstructions,
} from "@/db/schema/service-catalogue";
import type { PermissionCode } from "@/modules/identity-access/policy";
import type {
  CleaningItemTypeCode,
  ConditionLevelCode,
} from "@/modules/service-catalogue/catalogue";
import type { EstimateEngineInput, StaffEstimateCalculation } from "./estimate";
import type {
  CustomerResolutionStatus,
  JsonObject,
  NormalizeRequestItemInput,
  QuoteLineInput,
  QuoteStatus,
  RequestItemInput,
  RequestSource,
  RequestStatus,
} from "./types";

export type StaffRequestListInput = Readonly<{
  search?: string;
  status?: RequestStatus;
  source?: RequestSource;
  resolutionStatus?: CustomerResolutionStatus;
  manualReviewRequired?: boolean;
  submittedFrom?: Date;
  submittedTo?: Date;
  limit: number;
  offset: number;
}>;

export type StaffRequestSummary = Readonly<{
  id: string;
  requestReference: string;
  source: RequestSource;
  customerResolutionStatus: CustomerResolutionStatus;
  customerId: string | null;
  propertyId: string | null;
  status: RequestStatus;
  preferredLocale: "bg" | "en";
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  manualReviewRequired: boolean;
  version: number;
  submittedAt: Date;
  updatedAt: Date;
}>;

export type StaffRequestPage = Readonly<{
  items: readonly StaffRequestSummary[];
  total: number;
  limit: number;
  offset: number;
}>;

export type StaffRequestDetail = StaffRequestSummary &
  Readonly<{
    requestingProfileId: string | null;
    customerNotes: string | null;
    staffNotes: string | null;
    preferredDate: string | null;
    preferredWindowCode: string | null;
    originalSubmission: JsonObject;
    closedAt: Date | null;
    items: readonly Record<string, unknown>[];
    estimates: readonly Record<string, unknown>[];
    quoteHistory: readonly Record<string, unknown>[];
    auditTimeline: readonly Record<string, unknown>[];
  }>;

export type StaffQuoteHistoryItem = Readonly<{
  id: string;
  requestItemId: string | null;
  serviceId: number | null;
  cleaningItemTypeId: number | null;
  measurementModeId: number | null;
  descriptionBg: string;
  descriptionEn: string;
  quantity: number;
  measurementSnapshot: JsonObject;
  baseAmountMinorUnits: number;
  modifierAmountMinorUnits: number;
  addonAmountMinorUnits: number;
  netAmountMinorUnits: number;
  vatRateBasisPoints: number;
  vatAmountMinorUnits: number;
  grossTotalMinorUnits: number;
  calculationSnapshot: JsonObject;
  sortOrder: number;
}>;

/** Customer-facing request projection: human references and customer-safe data only. */
export type CustomerRequestSummary = Readonly<{
  requestReference: string;
  status: RequestStatus;
  preferredLocale: "bg" | "en";
  customerNotes: string | null;
  preferredDate: string | null;
  preferredWindowCode: string | null;
  manualReviewRequired: boolean;
  submittedAt: Date;
  updatedAt: Date;
}>;

export type CustomerRequestDetail = CustomerRequestSummary &
  Readonly<{
    items: readonly Readonly<{
      customerDescription: string;
      quantity: number;
      areaHundredthsM2: number | null;
      seatCount: number | null;
      sides: number | null;
      sortOrder: number;
    }>[];
    quoteReferences: readonly string[];
  }>;

export type CustomerQuoteSummary = Readonly<{
  quoteReference: string;
  requestReference: string;
  quoteVersion: number;
  status: Exclude<QuoteStatus, "DRAFT">;
  currency: "EUR";
  priceBasis: "NET" | "GROSS";
  netAmountMinorUnits: number;
  vatRateBasisPoints: number;
  vatAmountMinorUnits: number;
  grossTotalMinorUnits: number;
  estimatedDurationMinutes: number | null;
  validFrom: Date;
  validUntil: Date;
  issuedAt: Date;
  customerNotes: string | null;
}>;

export type CustomerQuoteDetail = CustomerQuoteSummary &
  Readonly<{
    termsSnapshot: JsonObject;
    items: readonly Readonly<{
      descriptionBg: string;
      descriptionEn: string;
      quantity: number;
      measurementSnapshot: JsonObject;
      baseAmountMinorUnits: number;
      modifierAmountMinorUnits: number;
      addonAmountMinorUnits: number;
      netAmountMinorUnits: number;
      vatRateBasisPoints: number;
      vatAmountMinorUnits: number;
      grossTotalMinorUnits: number;
      sortOrder: number;
    }>[];
  }>;

export type CreateRequestRecordInput = Readonly<{
  requestReference: string;
  source: RequestSource;
  customerId: string | null;
  requestingProfileId: string | null;
  propertyId: string | null;
  preferredLocale: "bg" | "en";
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  customerNotes: string | null;
  preferredDate: string | null;
  preferredWindowCode: string | null;
  originalSubmission: JsonObject;
  items: readonly RequestItemInput[];
}>;

export type CreatePublicCodeRequestInput = Readonly<{
  requestReference: string;
  preferredLocale: "bg" | "en";
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  customerNotes: string | null;
  preferredDate: string | null;
  preferredWindowCode: string | null;
  originalSubmission: JsonObject;
  itemTypeCodes: readonly CleaningItemTypeCode[];
  conditionLevelCode: ConditionLevelCode;
  customerDescription: string;
}>;

export type RequestCreateResult =
  | { status: "CREATED"; requestReference: string; version: number }
  | { status: "CONFLICT" }
  | { status: "NOT_FOUND_OR_FORBIDDEN" }
  | { status: "INVALID_REFERENCE" };

export type RequestMutationResult =
  | { status: "CHANGED"; id: string; version: number; updatedAt: Date }
  | { status: "NO_CHANGE"; id: string; version: number; updatedAt: Date }
  | { status: "CONFLICT" }
  | { status: "NOT_FOUND_OR_FORBIDDEN" }
  | { status: "INVALID_REFERENCE" }
  | { status: "INVALID_TRANSITION" };

export type CreateEstimateRecordResult =
  | {
      status: "CREATED";
      id: string;
      estimateVersion: number;
      requestVersion: number;
    }
  | { status: "CONFLICT" }
  | { status: "NOT_FOUND_OR_FORBIDDEN" }
  | { status: "INVALID_REFERENCE" };

export type QuoteMutationResult =
  | {
      status: "CREATED" | "CHANGED" | "NO_CHANGE";
      id: string;
      quoteReference: string;
      quoteVersion: number;
      recordVersion: number;
      quoteStatus: QuoteStatus;
    }
  | { status: "CONFLICT" }
  | { status: "NOT_FOUND_OR_FORBIDDEN" }
  | { status: "INVALID_REFERENCE" }
  | { status: "INVALID_TRANSITION" };

export type NormalizeRequestInput = Readonly<{
  requestId: string;
  expectedVersion: number;
  staffNotes: string | null;
  items: readonly NormalizeRequestItemInput[];
}>;

export type LinkRequestInput = Readonly<{
  requestId: string;
  expectedVersion: number;
  customerId: string;
  propertyId: string | null;
}>;

export type CreateCustomerFromRequestInput = Readonly<{
  requestId: string;
  expectedVersion: number;
  customerType: "INDIVIDUAL" | "BUSINESS";
  displayName: string;
  legalName: string | null;
  internalNotes: string | null;
  property: Readonly<{
    propertyType:
      | "RESIDENTIAL"
      | "OFFICE"
      | "HOTEL_GUEST_ACCOMMODATION"
      | "SERVICED_APARTMENT"
      | "RESTAURANT_CAFE"
      | "COMMERCIAL_PUBLIC"
      | "OTHER";
    label: string;
    city: string;
    district: string | null;
    streetAddress: string;
    postalCode: string | null;
    serviceZoneId: number | null;
  }> | null;
}>;

export type SetRequestResolutionInput = Readonly<{
  requestId: string;
  expectedVersion: number;
  fromStatus: Exclude<CustomerResolutionStatus, "LINKED">;
  toStatus: Exclude<CustomerResolutionStatus, "LINKED">;
}>;

export type TransitionRequestInput = Readonly<{
  requestId: string;
  expectedVersion: number;
  fromStatus: RequestStatus;
  toStatus: RequestStatus;
}>;

export type AppendEstimateInput = Readonly<{
  requestId: string;
  expectedRequestVersion: number;
  engineInput: JsonObject;
  calculation: StaffEstimateCalculation;
}>;

export type DerivedEstimateInputResult =
  | { status: "READY"; engineInput: EstimateEngineInput }
  | { status: "CONFLICT" }
  | { status: "NOT_FOUND_OR_FORBIDDEN" }
  | { status: "INVALID_REFERENCE" };

export type QuoteCommercialInput = Readonly<{
  estimateId: string;
  currency: "EUR";
  priceBasis: "NET" | "GROSS";
  netAmountMinorUnits: number;
  vatRateBasisPoints: number;
  vatAmountMinorUnits: number;
  grossTotalMinorUnits: number;
  estimatedDurationMinutes: number | null;
  commercialSnapshot: JsonObject;
  termsSnapshot: JsonObject;
  validFrom: Date;
  validUntil: Date;
  staffNotes: string | null;
  customerNotes: string | null;
  items: readonly QuoteLineInput[];
}>;

export type CreateQuoteDraftInput = QuoteCommercialInput &
  Readonly<{
    requestId: string;
    expectedRequestVersion: number;
    quoteReference: string;
  }>;

export type UpdateQuoteDraftInput = QuoteCommercialInput &
  Readonly<{
    quoteId: string;
    expectedRecordVersion: number;
    expectedRequestVersion: number;
  }>;

export type QuoteLifecycleInput = Readonly<{
  quoteId: string;
  expectedRecordVersion: number;
}>;

function enumValue<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`Unexpected ${label}.`);
}

const requestSources = [
  "PUBLIC_WEB",
  "CUSTOMER_PORTAL",
  "STAFF_CREATED",
] as const;
const requestStatuses = [
  "SUBMITTED",
  "IN_REVIEW",
  "NEEDS_REVIEW",
  "READY_TO_QUOTE",
  "QUOTED",
  "CLOSED",
  "DECLINED",
] as const;
const resolutionStatuses = [
  "UNRESOLVED",
  "MATCH_CANDIDATE",
  "LINKED",
  "NEW_CUSTOMER_REQUIRED",
] as const;
const customerQuoteStatuses = [
  "ISSUED",
  "SUPERSEDED",
  "EXPIRED",
  "WITHDRAWN",
] as const;

/** Recheck one current, active application permission at each SQL boundary. */
export function activeActorPermissionSql(
  actorProfileId: string,
  permissionCode: PermissionCode,
): SQL {
  return sql`exists (
    select 1
    from ${userProfiles} actor_profile
    join ${userRoles} actor_assignment
      on actor_assignment.user_profile_id = actor_profile.id
     and actor_assignment.active = true
    join ${applicationRoles} actor_role
      on actor_role.id = actor_assignment.role_id
     and actor_role.active = true
    join ${rolePermissions} actor_mapping
      on actor_mapping.role_id = actor_role.id
    join ${permissions} actor_permission
      on actor_permission.id = actor_mapping.permission_id
     and actor_permission.active = true
    where actor_profile.id = ${actorProfileId}::uuid
      and actor_profile.status = 'ACTIVE'
      and actor_permission.code = ${permissionCode}
  )`;
}

export function staffRequestReadSql(actorProfileId: string): SQL {
  return and(
    activeActorPermissionSql(actorProfileId, "CUSTOMER_RECORDS_READ"),
    activeActorPermissionSql(actorProfileId, "OPERATIONS_READ"),
  )!;
}

export function staffRequestManageSql(actorProfileId: string): SQL {
  return and(
    activeActorPermissionSql(actorProfileId, "CUSTOMER_RECORDS_MANAGE"),
    activeActorPermissionSql(actorProfileId, "OPERATIONS_MANAGE"),
  )!;
}

export function exactLinkedCustomerSql(
  actorProfileId: string,
  customerId: string,
  permissionCode: "OWN_CUSTOMER_DATA_READ" | "OWN_CUSTOMER_DATA_UPDATE",
): SQL {
  return and(
    activeActorPermissionSql(actorProfileId, permissionCode),
    sql`exists (
      select 1
      from ${customerIdentityLinks} exact_link
      join ${customers} linked_customer
        on linked_customer.id = exact_link.customer_id
       and linked_customer.status = 'ACTIVE'
      where exact_link.user_profile_id = ${actorProfileId}::uuid
        and exact_link.customer_id = ${customerId}::uuid
        and exact_link.active = true
        and exact_link.revoked_at is null
    )`,
  )!;
}

function customerRequestAccessSql(
  actorProfileId: string,
  customerIdSql: SQL,
  permissionCode: "OWN_CUSTOMER_DATA_READ" | "OWN_CUSTOMER_DATA_UPDATE",
): SQL {
  return and(
    activeActorPermissionSql(actorProfileId, permissionCode),
    sql`exists (
      select 1
      from ${customerIdentityLinks} exact_link
      join ${customers} linked_customer
        on linked_customer.id = exact_link.customer_id
       and linked_customer.status = 'ACTIVE'
      where exact_link.user_profile_id = ${actorProfileId}::uuid
        and exact_link.customer_id = ${customerIdSql}
        and exact_link.active = true
        and exact_link.revoked_at is null
    )`,
  )!;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; cause?: { code?: unknown } };
  return candidate.code === "23505" || candidate.cause?.code === "23505";
}

function jsonParameter(value: unknown): string {
  return JSON.stringify(value);
}

/** Map only canonical CRM customer types to commercial-engine segments. */
function commercialCustomerSegmentSql(customerType: SQL): SQL {
  return sql`case ${customerType}
    when 'INDIVIDUAL' then 'RESIDENTIAL'
    when 'BUSINESS' then 'B2B'
    else null
  end`;
}

function requestItemsParameter(items: readonly RequestItemInput[]): string {
  return jsonParameter(
    items.map((item) => ({
      service_id: item.serviceId ?? null,
      cleaning_item_type_id: item.cleaningItemTypeId ?? null,
      cleaning_asset_id: item.cleaningAssetId ?? null,
      measurement_mode_id: item.measurementModeId ?? null,
      condition_level_id: item.customerReportedConditionLevelId ?? null,
      fibre_material_id: item.reportedFibreMaterialId ?? null,
      surface_construction_id: item.reportedSurfaceConstructionId ?? null,
      customer_description: item.customerDescription,
      normalized_description: item.normalizedDescription ?? null,
      quantity: item.quantity,
      area_hundredths_m2: item.areaHundredthsM2 ?? null,
      seat_count: item.seatCount ?? null,
      sides: item.sides ?? null,
      sort_order: item.sortOrder,
      issue_type_ids: item.issueTypeIds,
      addon_ids: item.addonIds,
    })),
  );
}

function requestItemReferencesActiveSql(
  items: readonly RequestItemInput[],
): SQL {
  return sql`not exists (
    select 1
    from jsonb_to_recordset(${requestItemsParameter(items)}::jsonb) as item(
      service_id integer,
      cleaning_item_type_id integer,
      measurement_mode_id integer,
      condition_level_id integer,
      fibre_material_id integer,
      surface_construction_id integer,
      issue_type_ids jsonb,
      addon_ids jsonb
    )
    left join ${services} selected_service
      on selected_service.id = item.service_id and selected_service.active = true
    left join ${cleaningItemTypes} selected_type
      on selected_type.id = item.cleaning_item_type_id and selected_type.active = true
    left join ${measurementModes} selected_measurement
      on selected_measurement.id = item.measurement_mode_id
     and selected_measurement.active = true
    left join ${conditionLevels} selected_condition
      on selected_condition.id = item.condition_level_id
     and selected_condition.active = true
    left join ${fibreMaterials} selected_fibre
      on selected_fibre.id = item.fibre_material_id and selected_fibre.active = true
    left join ${surfaceConstructions} selected_surface
      on selected_surface.id = item.surface_construction_id
     and selected_surface.active = true
    where (item.service_id is not null and selected_service.id is null)
      or (item.cleaning_item_type_id is not null and selected_type.id is null)
      or (item.measurement_mode_id is not null and selected_measurement.id is null)
      or (item.condition_level_id is not null and selected_condition.id is null)
      or (item.fibre_material_id is not null and selected_fibre.id is null)
      or (item.surface_construction_id is not null and selected_surface.id is null)
      or (selected_service.id is not null and selected_type.id is not null
        and not exists (
          select 1
          from ${serviceItemCapabilities} capability
          join ${capabilityStatuses} capability_status
           on capability_status.id = capability.status_id
           and capability_status.active = true
          where capability.service_id = selected_service.id
            and capability.item_type_id = selected_type.id
        ))
      or exists (
        select 1 from jsonb_array_elements_text(item.issue_type_ids) issue(value)
        left join ${issueTypes} issue_type
          on issue_type.id = issue.value::integer and issue_type.active = true
        where issue_type.id is null
      )
      or exists (
        select 1 from jsonb_array_elements_text(item.addon_ids) addon(value)
        left join ${serviceAddons} service_addon
          on service_addon.id = addon.value::integer and service_addon.active = true
        where service_addon.id is null
      )
  )`;
}

function normalizedItemsParameter(
  items: NormalizeRequestInput["items"],
): string {
  return jsonParameter(
    items.map((item) => ({
      item_id: item.itemId,
      expected_version: item.expectedVersion,
      service_id: item.serviceId ?? null,
      cleaning_item_type_id: item.cleaningItemTypeId ?? null,
      cleaning_asset_id: item.cleaningAssetId ?? null,
      measurement_mode_id: item.measurementModeId ?? null,
      normalized_condition_level_id: item.normalizedConditionLevelId ?? null,
      normalized_fibre_material_id: item.normalizedFibreMaterialId ?? null,
      normalized_surface_construction_id:
        item.normalizedSurfaceConstructionId ?? null,
      normalized_description: item.normalizedDescription ?? null,
      quantity: item.quantity,
      area_hundredths_m2: item.areaHundredthsM2 ?? null,
      seat_count: item.seatCount ?? null,
      sides: item.sides ?? null,
      sort_order: item.sortOrder,
      issue_type_ids: item.issueTypeIds,
      addon_ids: item.addonIds,
    })),
  );
}

function quoteItemsParameter(items: readonly QuoteLineInput[]): string {
  return jsonParameter(
    items.map((item) => ({
      request_item_id: item.requestItemId ?? null,
      service_id: item.serviceId ?? null,
      cleaning_item_type_id: item.cleaningItemTypeId ?? null,
      measurement_mode_id: item.measurementModeId ?? null,
      description_bg: item.descriptionBg,
      description_en: item.descriptionEn,
      quantity: item.quantity,
      measurement_snapshot: item.measurementSnapshot,
      base_amount_minor_units: item.baseAmountMinorUnits,
      modifier_amount_minor_units: item.modifierAmountMinorUnits,
      addon_amount_minor_units: item.addonAmountMinorUnits,
      net_amount_minor_units: item.netAmountMinorUnits,
      vat_rate_basis_points: item.vatRateBasisPoints,
      vat_amount_minor_units: item.vatAmountMinorUnits,
      gross_total_minor_units: item.grossTotalMinorUnits,
      calculation_snapshot: item.calculationSnapshot,
      sort_order: item.sortOrder,
    })),
  );
}

type StaffListRow = StaffRequestSummary & { total: number | string };

function staffSummary(row: StaffListRow): StaffRequestSummary {
  return {
    id: row.id,
    requestReference: row.requestReference,
    source: enumValue(row.source, requestSources, "request source"),
    customerResolutionStatus: enumValue(
      row.customerResolutionStatus,
      resolutionStatuses,
      "customer resolution status",
    ),
    customerId: row.customerId,
    propertyId: row.propertyId,
    status: enumValue(row.status, requestStatuses, "request status"),
    preferredLocale: enumValue(row.preferredLocale, ["bg", "en"], "locale"),
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    manualReviewRequired: row.manualReviewRequired,
    version: row.version,
    submittedAt: row.submittedAt,
    updatedAt: row.updatedAt,
  };
}

export async function listStaffRequestRecords(
  database: Database,
  actorProfileId: string,
  input: StaffRequestListInput,
): Promise<StaffRequestPage> {
  const result = await database.execute<StaffListRow>(sql`
    select
      request.id,
      request.request_reference as "requestReference",
      request.source,
      request.customer_resolution_status as "customerResolutionStatus",
      request.customer_id as "customerId",
      request.property_id as "propertyId",
      request.status,
      request.preferred_locale as "preferredLocale",
      request.contact_name as "contactName",
      request.contact_email as "contactEmail",
      request.contact_phone as "contactPhone",
      request.manual_review_required as "manualReviewRequired",
      request.version,
      request.submitted_at as "submittedAt",
      request.updated_at as "updatedAt",
      count(*) over() as total
    from ${serviceRequests} request
    where ${staffRequestReadSql(actorProfileId)}
      and (${input.status ?? null}::text is null or request.status = ${input.status ?? null})
      and (${input.source ?? null}::text is null or request.source = ${input.source ?? null})
      and (${input.resolutionStatus ?? null}::text is null
        or request.customer_resolution_status = ${input.resolutionStatus ?? null})
      and (${input.manualReviewRequired ?? null}::boolean is null
        or request.manual_review_required = ${input.manualReviewRequired ?? null})
      and (${input.submittedFrom ?? null}::timestamptz is null
        or request.submitted_at >= ${input.submittedFrom ?? null}::timestamptz)
      and (${input.submittedTo ?? null}::timestamptz is null
        or request.submitted_at < ${input.submittedTo ?? null}::timestamptz)
      and (${input.search ?? null}::text is null
        or request.request_reference ilike ${input.search ? `%${input.search}%` : null})
    order by request.submitted_at desc, request.id
    limit ${input.limit} offset ${input.offset}
  `);
  return {
    items: result.rows.map(staffSummary),
    total: Number(result.rows[0]?.total ?? 0),
    limit: input.limit,
    offset: input.offset,
  };
}

export async function loadStaffRequestRecord(
  database: Database,
  actorProfileId: string,
  requestId: string,
): Promise<StaffRequestDetail | null> {
  const result = await database.execute<StaffRequestDetail>(sql`
    select
      request.id,
      request.request_reference as "requestReference",
      request.source,
      request.customer_resolution_status as "customerResolutionStatus",
      request.customer_id as "customerId",
      request.requesting_profile_id as "requestingProfileId",
      request.property_id as "propertyId",
      request.status,
      request.preferred_locale as "preferredLocale",
      request.contact_name as "contactName",
      request.contact_email as "contactEmail",
      request.contact_phone as "contactPhone",
      request.customer_notes as "customerNotes",
      request.staff_notes as "staffNotes",
      request.preferred_date as "preferredDate",
      request.preferred_window_code as "preferredWindowCode",
      request.original_submission as "originalSubmission",
      request.manual_review_required as "manualReviewRequired",
      request.version,
      request.submitted_at as "submittedAt",
      request.closed_at as "closedAt",
      request.updated_at as "updatedAt",
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', item.id,
            'serviceId', item.service_id,
            'cleaningItemTypeId', item.cleaning_item_type_id,
            'cleaningAssetId', item.cleaning_asset_id,
            'measurementModeId', item.measurement_mode_id,
            'customerReportedConditionLevelId', item.customer_reported_condition_level_id,
            'normalizedConditionLevelId', item.normalized_condition_level_id,
            'reportedFibreMaterialId', item.reported_fibre_material_id,
            'normalizedFibreMaterialId', item.normalized_fibre_material_id,
            'reportedSurfaceConstructionId', item.reported_surface_construction_id,
            'normalizedSurfaceConstructionId', item.normalized_surface_construction_id,
            'customerDescription', item.customer_description,
            'normalizedDescription', item.normalized_description,
            'quantity', item.quantity,
            'areaHundredthsM2', item.area_hundredths_m2,
            'seatCount', item.seat_count,
            'sides', item.sides,
            'sortOrder', item.sort_order,
            'version', item.version,
            'issueTypeIds', coalesce((
              select jsonb_agg(issue.issue_type_id order by issue.issue_type_id)
              from ${serviceRequestItemIssues} issue
              where issue.request_item_id = item.id
            ), '[]'::jsonb),
            'addonIds', coalesce((
              select jsonb_agg(addon.addon_id order by addon.addon_id)
              from ${serviceRequestItemAddons} addon
              where addon.request_item_id = item.id
            ), '[]'::jsonb)
          ) order by item.sort_order
        )
        from ${serviceRequestItems} item
        where item.request_id = request.id
      ), '[]'::jsonb) as items,
      coalesce((
        select jsonb_agg(to_jsonb(estimate) order by estimate.estimate_version)
        from ${requestEstimates} estimate
        where estimate.request_id = request.id
      ), '[]'::jsonb) as estimates,
      coalesce((
        select jsonb_agg(
          to_jsonb(quote_record) || jsonb_build_object(
            'items', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', quote_item.id,
                  'requestItemId', quote_item.request_item_id,
                  'serviceId', quote_item.service_id,
                  'cleaningItemTypeId', quote_item.cleaning_item_type_id,
                  'measurementModeId', quote_item.measurement_mode_id,
                  'descriptionBg', quote_item.description_bg,
                  'descriptionEn', quote_item.description_en,
                  'quantity', quote_item.quantity,
                  'measurementSnapshot', quote_item.measurement_snapshot,
                  'baseAmountMinorUnits', quote_item.base_amount_minor_units,
                  'modifierAmountMinorUnits', quote_item.modifier_amount_minor_units,
                  'addonAmountMinorUnits', quote_item.addon_amount_minor_units,
                  'netAmountMinorUnits', quote_item.net_amount_minor_units,
                  'vatRateBasisPoints', quote_item.vat_rate_basis_points,
                  'vatAmountMinorUnits', quote_item.vat_amount_minor_units,
                  'grossTotalMinorUnits', quote_item.gross_total_minor_units,
                  'calculationSnapshot', quote_item.calculation_snapshot,
                  'sortOrder', quote_item.sort_order
                ) order by quote_item.sort_order, quote_item.id
              )
              from ${quoteItems} quote_item
              where quote_item.quote_id = quote_record.id
            ), '[]'::jsonb)
          ) order by quote_record.quote_version
        )
        from ${quotes} quote_record
        where quote_record.request_id = request.id
      ), '[]'::jsonb) as "quoteHistory",
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'entityType', audit.entity_type,
            'entityId', audit.entity_id,
            'eventType', audit.event_type,
            'actorProfileId', audit.actor_profile_id,
            'source', audit.source,
            'safeMetadata', audit.safe_metadata,
            'createdAt', audit.created_at
          ) order by audit.created_at, audit.id
        )
        from ${businessAuditEvents} audit
        where (audit.entity_type = 'SERVICE_REQUEST' and audit.entity_id = request.id)
          or (audit.entity_type = 'REQUEST_ESTIMATE' and audit.entity_id in (
            select estimate.id from ${requestEstimates} estimate
            where estimate.request_id = request.id
          ))
          or (audit.entity_type = 'QUOTE' and audit.entity_id in (
            select quote_record.id from ${quotes} quote_record
            where quote_record.request_id = request.id
          ))
      ), '[]'::jsonb) as "auditTimeline"
    from ${serviceRequests} request
    where request.id = ${requestId}::uuid
      and ${staffRequestReadSql(actorProfileId)}
  `);
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...staffSummary({ ...row, total: 1 }),
    requestingProfileId: row.requestingProfileId,
    customerNotes: row.customerNotes,
    staffNotes: row.staffNotes,
    preferredDate: row.preferredDate,
    preferredWindowCode: row.preferredWindowCode,
    originalSubmission: row.originalSubmission,
    closedAt: row.closedAt,
    items: row.items,
    estimates: row.estimates,
    quoteHistory: row.quoteHistory,
    auditTimeline: row.auditTimeline,
  };
}

export async function listCustomerRequestRecords(
  database: Database,
  actorProfileId: string,
): Promise<readonly CustomerRequestSummary[]> {
  const result = await database.execute<CustomerRequestSummary>(sql`
    select
      request.request_reference as "requestReference",
      request.status,
      request.preferred_locale as "preferredLocale",
      request.customer_notes as "customerNotes",
      request.preferred_date as "preferredDate",
      request.preferred_window_code as "preferredWindowCode",
      request.manual_review_required as "manualReviewRequired",
      request.submitted_at as "submittedAt",
      request.updated_at as "updatedAt"
    from ${serviceRequests} request
    where ${customerRequestAccessSql(actorProfileId, sql`request.customer_id`, "OWN_CUSTOMER_DATA_READ")}
    order by request.submitted_at desc, request.id
  `);
  return result.rows;
}

export async function loadCustomerRequestRecord(
  database: Database,
  actorProfileId: string,
  requestReference: string,
): Promise<CustomerRequestDetail | null> {
  const result = await database.execute<CustomerRequestDetail>(sql`
    select
      request.request_reference as "requestReference",
      request.status,
      request.preferred_locale as "preferredLocale",
      request.customer_notes as "customerNotes",
      request.preferred_date as "preferredDate",
      request.preferred_window_code as "preferredWindowCode",
      request.manual_review_required as "manualReviewRequired",
      request.submitted_at as "submittedAt",
      request.updated_at as "updatedAt",
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'customerDescription', item.customer_description,
            'quantity', item.quantity,
            'areaHundredthsM2', item.area_hundredths_m2,
            'seatCount', item.seat_count,
            'sides', item.sides,
            'sortOrder', item.sort_order
          ) order by item.sort_order
        )
        from ${serviceRequestItems} item
        where item.request_id = request.id
      ), '[]'::jsonb) as items,
      coalesce((
        select jsonb_agg(quote_record.quote_reference order by quote_record.quote_version)
        from ${quotes} quote_record
        where quote_record.request_id = request.id
          and quote_record.issued_at is not null
          and quote_record.status <> 'DRAFT'
      ), '[]'::jsonb) as "quoteReferences"
    from ${serviceRequests} request
    where request.request_reference = ${requestReference}
      and ${customerRequestAccessSql(actorProfileId, sql`request.customer_id`, "OWN_CUSTOMER_DATA_READ")}
  `);
  return result.rows[0] ?? null;
}

export async function listCustomerQuoteRecords(
  database: Database,
  actorProfileId: string,
): Promise<readonly CustomerQuoteSummary[]> {
  const result = await database.execute<CustomerQuoteSummary>(sql`
    select
      quote_record.quote_reference as "quoteReference",
      request.request_reference as "requestReference",
      quote_record.quote_version as "quoteVersion",
      quote_record.status,
      quote_record.currency,
      quote_record.price_basis as "priceBasis",
      quote_record.net_amount_minor_units as "netAmountMinorUnits",
      quote_record.vat_rate_basis_points as "vatRateBasisPoints",
      quote_record.vat_amount_minor_units as "vatAmountMinorUnits",
      quote_record.gross_total_minor_units as "grossTotalMinorUnits",
      quote_record.estimated_duration_minutes as "estimatedDurationMinutes",
      quote_record.valid_from as "validFrom",
      quote_record.valid_until as "validUntil",
      quote_record.issued_at as "issuedAt",
      quote_record.customer_notes as "customerNotes"
    from ${quotes} quote_record
    join ${serviceRequests} request on request.id = quote_record.request_id
    where quote_record.issued_at is not null
      and quote_record.status <> 'DRAFT'
      and ${customerRequestAccessSql(actorProfileId, sql`request.customer_id`, "OWN_CUSTOMER_DATA_READ")}
    order by quote_record.issued_at desc, quote_record.id
  `);
  return result.rows.map((row) => ({
    ...row,
    status: enumValue(row.status, customerQuoteStatuses, "quote status"),
  }));
}

export async function loadCustomerQuoteRecord(
  database: Database,
  actorProfileId: string,
  quoteReference: string,
): Promise<CustomerQuoteDetail | null> {
  const result = await database.execute<CustomerQuoteDetail>(sql`
    select
      quote_record.quote_reference as "quoteReference",
      request.request_reference as "requestReference",
      quote_record.quote_version as "quoteVersion",
      quote_record.status,
      quote_record.currency,
      quote_record.price_basis as "priceBasis",
      quote_record.net_amount_minor_units as "netAmountMinorUnits",
      quote_record.vat_rate_basis_points as "vatRateBasisPoints",
      quote_record.vat_amount_minor_units as "vatAmountMinorUnits",
      quote_record.gross_total_minor_units as "grossTotalMinorUnits",
      quote_record.estimated_duration_minutes as "estimatedDurationMinutes",
      quote_record.terms_snapshot as "termsSnapshot",
      quote_record.valid_from as "validFrom",
      quote_record.valid_until as "validUntil",
      quote_record.issued_at as "issuedAt",
      quote_record.customer_notes as "customerNotes",
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'descriptionBg', line.description_bg,
            'descriptionEn', line.description_en,
            'quantity', line.quantity,
            'measurementSnapshot', line.measurement_snapshot,
            'baseAmountMinorUnits', line.base_amount_minor_units,
            'modifierAmountMinorUnits', line.modifier_amount_minor_units,
            'addonAmountMinorUnits', line.addon_amount_minor_units,
            'netAmountMinorUnits', line.net_amount_minor_units,
            'vatRateBasisPoints', line.vat_rate_basis_points,
            'vatAmountMinorUnits', line.vat_amount_minor_units,
            'grossTotalMinorUnits', line.gross_total_minor_units,
            'sortOrder', line.sort_order
          ) order by line.sort_order
        )
        from ${quoteItems} line
        where line.quote_id = quote_record.id
      ), '[]'::jsonb) as items
    from ${quotes} quote_record
    join ${serviceRequests} request on request.id = quote_record.request_id
    where quote_record.quote_reference = ${quoteReference}
      and quote_record.issued_at is not null
      and quote_record.status <> 'DRAFT'
      and ${customerRequestAccessSql(actorProfileId, sql`request.customer_id`, "OWN_CUSTOMER_DATA_READ")}
  `);
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...row,
    status: enumValue(row.status, customerQuoteStatuses, "quote status"),
  };
}

type CreateRequestRow = {
  result: "CREATED" | "NOT_FOUND_OR_FORBIDDEN" | "INVALID_REFERENCE";
  requestReference: string | null;
  version: number | null;
};

function requestCreateResult(
  row: CreateRequestRow | undefined,
): RequestCreateResult {
  if (!row || row.result === "NOT_FOUND_OR_FORBIDDEN") {
    return { status: "NOT_FOUND_OR_FORBIDDEN" };
  }
  if (row.result === "INVALID_REFERENCE")
    return { status: "INVALID_REFERENCE" };
  if (!row.requestReference || !row.version) return { status: "CONFLICT" };
  return {
    status: "CREATED",
    requestReference: row.requestReference,
    version: row.version,
  };
}

async function createRequestRecord(
  database: Database,
  actorProfileId: string | null,
  input: CreateRequestRecordInput,
  authorization: SQL,
): Promise<RequestCreateResult> {
  const customerResolutionStatus =
    input.source === "PUBLIC_WEB" ? "UNRESOLVED" : "LINKED";
  const auditSource = input.source === "STAFF_CREATED" ? "STAFF" : input.source;
  try {
    const result = await database.execute<CreateRequestRow>(sql`
      with authorized as materialized (
        select 1 as allowed
        where ${authorization}
          and ${requestItemReferencesActiveSql(input.items)}
      ),
      reference_state as materialized (
        select case
          when not exists (select 1 from authorized) then 'NOT_FOUND_OR_FORBIDDEN'
          when ${input.source} <> 'PUBLIC_WEB' and ${input.customerId}::uuid is null
            then 'INVALID_REFERENCE'
          else 'CREATED'
        end as result
      ),
      created_request as (
        insert into ${serviceRequests} (
          request_reference, source, customer_resolution_status,
          customer_id, requesting_profile_id, property_id, status,
          preferred_locale, contact_name, contact_email, contact_phone,
          customer_notes, preferred_date, preferred_window_code,
          original_submission, manual_review_required, version,
          created_by_profile_id, updated_by_profile_id
        )
        select
          ${input.requestReference}, ${input.source}, ${customerResolutionStatus},
          ${input.customerId}::uuid, ${input.requestingProfileId}::uuid,
          ${input.propertyId}::uuid, 'SUBMITTED', ${input.preferredLocale},
          ${input.contactName}, ${input.contactEmail}, ${input.contactPhone},
          ${input.customerNotes}, ${input.preferredDate}::date,
          ${input.preferredWindowCode}, ${jsonParameter(input.originalSubmission)}::jsonb,
          true, 1, ${actorProfileId}::uuid, ${actorProfileId}::uuid
        from authorized, reference_state
        where reference_state.result = 'CREATED'
        returning id, request_reference, version
      ),
      created_items as (
        insert into ${serviceRequestItems} (
          request_id, service_id, cleaning_item_type_id, cleaning_asset_id,
          measurement_mode_id, customer_reported_condition_level_id,
          normalized_condition_level_id,
          reported_fibre_material_id, normalized_fibre_material_id,
          reported_surface_construction_id,
          normalized_surface_construction_id,
          customer_description, normalized_description, quantity,
          area_hundredths_m2, seat_count, sides, sort_order, version,
          created_by_profile_id, updated_by_profile_id
        )
        select
          created_request.id, item.service_id, item.cleaning_item_type_id,
          item.cleaning_asset_id, item.measurement_mode_id,
          item.condition_level_id, null, item.fibre_material_id, null,
          item.surface_construction_id, null, item.customer_description,
          null, item.quantity, item.area_hundredths_m2, item.seat_count,
          item.sides, item.sort_order, 1, ${actorProfileId}::uuid,
          ${actorProfileId}::uuid
        from created_request
        cross join jsonb_to_recordset(${requestItemsParameter(input.items)}::jsonb) as item(
          service_id integer,
          cleaning_item_type_id integer,
          cleaning_asset_id uuid,
          measurement_mode_id integer,
          condition_level_id integer,
          fibre_material_id integer,
          surface_construction_id integer,
          customer_description text,
          quantity integer,
          area_hundredths_m2 integer,
          seat_count integer,
          sides integer,
          sort_order integer
        )
        returning id, request_id, sort_order
      ),
      created_issues as (
        insert into ${serviceRequestItemIssues} (
          request_item_id, issue_type_id, customer_reported,
          staff_confirmed, created_by_profile_id
        )
        select created_item.id, issue_id, true, false,
          ${actorProfileId}::uuid
        from created_items created_item
        join jsonb_to_recordset(${requestItemsParameter(input.items)}::jsonb) as item(
          sort_order integer,
          issue_type_ids jsonb
        ) on item.sort_order = created_item.sort_order
        cross join lateral jsonb_array_elements_text(item.issue_type_ids) issue(value)
        cross join lateral (select issue.value::integer as issue_id) parsed
        returning request_item_id
      ),
      created_addons as (
        insert into ${serviceRequestItemAddons} (
          request_item_id, addon_id, customer_requested,
          staff_included, created_by_profile_id
        )
        select created_item.id, addon_id, true, false,
          ${actorProfileId}::uuid
        from created_items created_item
        join jsonb_to_recordset(${requestItemsParameter(input.items)}::jsonb) as item(
          sort_order integer,
          addon_ids jsonb
        ) on item.sort_order = created_item.sort_order
        cross join lateral jsonb_array_elements_text(item.addon_ids) addon(value)
        cross join lateral (select addon.value::integer as addon_id) parsed
        returning request_item_id
      ),
      audited as (
        insert into ${businessAuditEvents} (
          entity_type, entity_id, event_type, actor_profile_id, source,
          safe_metadata
        )
        select 'SERVICE_REQUEST', created_request.id, 'REQUEST_SUBMITTED',
          ${actorProfileId}::uuid, ${auditSource},
          jsonb_build_object(
            'source', ${input.source}::text,
            'itemCount', ${input.items.length}::integer
          )
        from created_request
        returning id
      )
      select reference_state.result::text as result,
        created_request.request_reference as "requestReference",
        created_request.version
      from reference_state
      left join created_request on true
    `);
    return requestCreateResult(result.rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "CONFLICT" };
    throw error;
  }
}

export function createPublicRequestRecord(
  database: Database,
  input: Omit<
    CreateRequestRecordInput,
    "source" | "customerId" | "requestingProfileId" | "propertyId"
  >,
): Promise<RequestCreateResult> {
  return createRequestRecord(
    database,
    null,
    {
      ...input,
      source: "PUBLIC_WEB",
      customerId: null,
      requestingProfileId: null,
      propertyId: null,
    },
    sql`true`,
  );
}

/**
 * Anonymous creation seam for public canonical codes. All active reference
 * resolution, the unlinked request, its items and its audit event are one SQL
 * statement; no prior lookup can become stale or be used as authorization.
 */
export async function createPublicCodeRequestRecord(
  database: Database,
  input: CreatePublicCodeRequestInput,
): Promise<RequestCreateResult> {
  try {
    const result = await database.execute<CreateRequestRow>(sql`
      with requested_items as materialized (
        select requested.value::text as item_type_code,
          requested.ordinality::integer - 1 as sort_order
        from jsonb_array_elements_text(${jsonParameter(input.itemTypeCodes)}::jsonb)
          with ordinality requested(value, ordinality)
      ),
      resolved_condition as materialized (
        select condition.id
        from ${conditionLevels} condition
        where condition.code = ${input.conditionLevelCode}
          and condition.active = true
      ),
      resolved_items as materialized (
        select requested.item_type_code, requested.sort_order,
          item_type.id as cleaning_item_type_id,
          resolved_condition.id as condition_level_id
        from requested_items requested
        join ${cleaningItemTypes} item_type
          on item_type.code = requested.item_type_code
         and item_type.active = true
        cross join resolved_condition
      ),
      reference_state as materialized (
        select case
          when (select count(*) from requested_items) <> ${input.itemTypeCodes.length}
            or (select count(distinct item_type_code) from requested_items) <> ${input.itemTypeCodes.length}
            or (select count(*) from resolved_items) <> ${input.itemTypeCodes.length}
            or (select count(*) from resolved_condition) <> 1
            then 'INVALID_REFERENCE'
          else 'CREATED'
        end as result
      ),
      created_request as (
        insert into ${serviceRequests} (
          request_reference, source, customer_resolution_status,
          customer_id, requesting_profile_id, property_id, status,
          preferred_locale, contact_name, contact_email, contact_phone,
          customer_notes, preferred_date, preferred_window_code,
          original_submission, manual_review_required, version,
          created_by_profile_id, updated_by_profile_id
        )
        select ${input.requestReference}, 'PUBLIC_WEB', 'UNRESOLVED',
          null, null, null, 'SUBMITTED', ${input.preferredLocale},
          ${input.contactName}, ${input.contactEmail}, ${input.contactPhone},
          ${input.customerNotes}, ${input.preferredDate}::date,
          ${input.preferredWindowCode},
          ${jsonParameter(input.originalSubmission)}::jsonb, true, 1,
          null, null
        from reference_state
        where reference_state.result = 'CREATED'
        returning id, request_reference, version
      ),
      created_items as (
        insert into ${serviceRequestItems} (
          request_id, service_id, cleaning_item_type_id,
          customer_reported_condition_level_id,
          normalized_condition_level_id, customer_description,
          quantity, sort_order, version
        )
        select created_request.id, null,
          resolved.cleaning_item_type_id, resolved.condition_level_id, null,
          concat(
            resolved.item_type_code,
            ': ',
            ${input.customerDescription}::text
          ),
          1, resolved.sort_order, 1
        from created_request
        cross join resolved_items resolved
        returning id
      ),
      audited as (
        insert into ${businessAuditEvents} (
          entity_type, entity_id, event_type, actor_profile_id, source,
          safe_metadata
        )
        select 'SERVICE_REQUEST', created_request.id, 'REQUEST_SUBMITTED',
          null, 'PUBLIC_WEB',
          jsonb_build_object(
            'source', 'PUBLIC_WEB',
            'itemCount', ${input.itemTypeCodes.length}::integer
          )
        from created_request
        returning id
      )
      select reference_state.result::text as result,
        created_request.request_reference as "requestReference",
        created_request.version
      from reference_state
      left join created_request on true
    `);
    return requestCreateResult(result.rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "CONFLICT" };
    throw error;
  }
}

export function createCustomerRequestRecord(
  database: Database,
  actorProfileId: string,
  input: Omit<CreateRequestRecordInput, "source" | "requestingProfileId">,
): Promise<RequestCreateResult> {
  const propertyIsOwned = input.propertyId
    ? sql`exists (
        select 1 from ${properties} target_property
        where target_property.id = ${input.propertyId}::uuid
          and target_property.customer_id = ${input.customerId}::uuid
          and target_property.status = 'ACTIVE'
      )`
    : sql`true`;
  const assetsAreOwned = sql`not exists (
    select 1
    from jsonb_to_recordset(${requestItemsParameter(input.items)}::jsonb) as item(
      cleaning_asset_id uuid
    )
    where item.cleaning_asset_id is not null
      and not exists (
        select 1
        from ${cleaningAssets} selected_asset
        join ${properties} asset_property
          on asset_property.id = selected_asset.property_id
        where selected_asset.id = item.cleaning_asset_id
          and selected_asset.status = 'ACTIVE'
          and asset_property.status = 'ACTIVE'
          and asset_property.customer_id = ${input.customerId}::uuid
          and asset_property.id = ${input.propertyId}::uuid
      )
  )`;
  return createRequestRecord(
    database,
    actorProfileId,
    {
      ...input,
      source: "CUSTOMER_PORTAL",
      requestingProfileId: actorProfileId,
    },
    and(
      exactLinkedCustomerSql(
        actorProfileId,
        input.customerId ?? "00000000-0000-0000-0000-000000000000",
        "OWN_CUSTOMER_DATA_UPDATE",
      ),
      propertyIsOwned,
      assetsAreOwned,
    )!,
  );
}

export function createStaffRequestRecord(
  database: Database,
  actorProfileId: string,
  input: Omit<CreateRequestRecordInput, "source" | "requestingProfileId">,
): Promise<RequestCreateResult> {
  const referencesValid = sql`exists (
    select 1
    from ${customers} target_customer
    where target_customer.id = ${input.customerId}::uuid
      and target_customer.status = 'ACTIVE'
      and (
        ${input.propertyId}::uuid is null
        or exists (
          select 1 from ${properties} target_property
          where target_property.id = ${input.propertyId}::uuid
            and target_property.customer_id = target_customer.id
            and target_property.status = 'ACTIVE'
        )
      )
      and not exists (
        select 1
        from jsonb_to_recordset(${requestItemsParameter(input.items)}::jsonb) as item(
          cleaning_asset_id uuid
        )
        where item.cleaning_asset_id is not null
          and not exists (
            select 1
            from ${cleaningAssets} selected_asset
            where selected_asset.id = item.cleaning_asset_id
              and selected_asset.status = 'ACTIVE'
              and selected_asset.property_id = ${input.propertyId}::uuid
          )
      )
  )`;
  return createRequestRecord(
    database,
    actorProfileId,
    {
      ...input,
      source: "STAFF_CREATED",
      requestingProfileId: null,
    },
    and(staffRequestManageSql(actorProfileId), referencesValid)!,
  );
}

type RequestMutationRow = {
  result:
    | "CHANGED"
    | "NO_CHANGE"
    | "CONFLICT"
    | "NOT_FOUND_OR_FORBIDDEN"
    | "INVALID_REFERENCE"
    | "INVALID_TRANSITION";
  id: string | null;
  version: number | null;
  updatedAt: Date | null;
};

function requestMutationResult(
  row: RequestMutationRow | undefined,
): RequestMutationResult {
  if (!row) return { status: "NOT_FOUND_OR_FORBIDDEN" };
  switch (row.result) {
    case "CHANGED":
    case "NO_CHANGE":
      if (!row.id || !row.version || !row.updatedAt)
        return { status: "CONFLICT" };
      return {
        status: row.result,
        id: row.id,
        version: row.version,
        updatedAt: row.updatedAt,
      };
    case "CONFLICT":
    case "NOT_FOUND_OR_FORBIDDEN":
    case "INVALID_REFERENCE":
    case "INVALID_TRANSITION":
      return { status: row.result };
  }
}

export async function linkRequestRecord(
  database: Database,
  actorProfileId: string,
  input: LinkRequestInput,
): Promise<RequestMutationResult> {
  const result = await database.execute<RequestMutationRow>(sql`
    with target as materialized (
      select request.id, request.version, request.status,
        request.customer_id, request.property_id, request.updated_at
      from ${serviceRequests} request
      where request.id = ${input.requestId}::uuid
        and ${staffRequestManageSql(actorProfileId)}
      for update of request
    ),
    references_valid as materialized (
      select target_customer.id as customer_id,
        target_property.id as property_id
      from ${customers} target_customer
      left join ${properties} target_property
        on target_property.id = ${input.propertyId}::uuid
       and target_property.customer_id = target_customer.id
       and target_property.status = 'ACTIVE'
      where target_customer.id = ${input.customerId}::uuid
        and target_customer.status = 'ACTIVE'
        and (${input.propertyId}::uuid is null or target_property.id is not null)
    ),
    decision as materialized (
      select case
        when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
        when (select version from target) <> ${input.expectedVersion} then 'CONFLICT'
        when (select status from target) in ('QUOTED', 'CLOSED', 'DECLINED')
          then 'INVALID_TRANSITION'
        when not exists (select 1 from references_valid) then 'INVALID_REFERENCE'
        when (select customer_id from target) = ${input.customerId}::uuid
          and (select property_id from target) is not distinct from ${input.propertyId}::uuid
          then 'NO_CHANGE'
        when (select customer_id from target) is not null
          and (select customer_id from target) <> ${input.customerId}::uuid
          then 'CONFLICT'
        else 'CHANGED'
      end as result
    ),
    changed as (
      update ${serviceRequests} request
      set customer_id = references_valid.customer_id,
        property_id = references_valid.property_id,
        customer_resolution_status = 'LINKED',
        version = request.version + 1,
        updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from references_valid, decision
      where request.id = ${input.requestId}::uuid
        and request.version = ${input.expectedVersion}
        and decision.result = 'CHANGED'
      returning request.id, request.version, request.updated_at
    ),
    audited as (
      insert into ${businessAuditEvents} (
        entity_type, entity_id, event_type, actor_profile_id, source,
        safe_metadata
      )
      select 'SERVICE_REQUEST', changed.id, 'REQUEST_LINKED',
        ${actorProfileId}::uuid, 'STAFF',
        jsonb_build_object(
          'resolution', 'LINKED',
          'propertyChanged',
          target.property_id is distinct from ${input.propertyId}::uuid
        )
      from changed, target
      returning id
    )
    select decision.result::text as result,
      coalesce(changed.id, target.id) as id,
      coalesce(changed.version, target.version) as version,
      coalesce(changed.updated_at, target.updated_at) as "updatedAt"
    from decision
    left join target on true
    left join changed on true
  `);
  return requestMutationResult(result.rows[0]);
}

/**
 * Record a staff CRM-resolution decision without linking or creating CRM data.
 * LINKED is intentionally excluded: only linkRequest/createCustomerFromRequest
 * may establish that state and its relational invariants.
 */
export async function setRequestResolutionRecord(
  database: Database,
  actorProfileId: string,
  input: SetRequestResolutionInput,
): Promise<RequestMutationResult> {
  const result = await database.execute<RequestMutationRow>(sql`
    with target as materialized (
      select request.id, request.version, request.status,
        request.customer_id, request.customer_resolution_status,
        request.updated_at
      from ${serviceRequests} request
      where request.id = ${input.requestId}::uuid
        and ${staffRequestManageSql(actorProfileId)}
      for update of request
    ),
    decision as materialized (
      select case
        when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
        when (select version from target) <> ${input.expectedVersion}
          or (select customer_resolution_status from target) <> ${input.fromStatus}
          then 'CONFLICT'
        when (select customer_id from target) is not null
          or (select status from target) in ('QUOTED', 'CLOSED', 'DECLINED')
          then 'INVALID_TRANSITION'
        when ${input.fromStatus} = ${input.toStatus} then 'NO_CHANGE'
        else 'CHANGED'
      end as result
    ),
    changed as (
      update ${serviceRequests} request
      set customer_resolution_status = ${input.toStatus},
        version = request.version + 1,
        updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from decision
      where request.id = ${input.requestId}::uuid
        and request.version = ${input.expectedVersion}
        and request.customer_resolution_status = ${input.fromStatus}
        and request.customer_id is null
        and request.status not in ('QUOTED', 'CLOSED', 'DECLINED')
        and decision.result = 'CHANGED'
      returning request.id, request.version, request.updated_at
    ),
    audited as (
      insert into ${businessAuditEvents} (
        entity_type, entity_id, event_type, actor_profile_id, source,
        safe_metadata
      )
      select 'SERVICE_REQUEST', changed.id, 'REQUEST_STATUS_CHANGED',
        ${actorProfileId}::uuid, 'STAFF',
        jsonb_build_object(
          'field', 'customerResolutionStatus',
          'from', ${input.fromStatus}::text,
          'to', ${input.toStatus}::text
        )
      from changed
      returning id
    )
    select decision.result::text as result,
      coalesce(changed.id, target.id) as id,
      coalesce(changed.version, target.version) as version,
      coalesce(changed.updated_at, target.updated_at) as "updatedAt"
    from decision
    left join target on true
    left join changed on true
  `);
  return requestMutationResult(result.rows[0]);
}

/** Create CRM records from reviewed request data and link them atomically. */
export async function createCustomerFromRequestRecord(
  database: Database,
  actorProfileId: string,
  input: CreateCustomerFromRequestInput,
): Promise<RequestMutationResult> {
  const result = await database.execute<RequestMutationRow>(sql`
    with target as materialized (
      select request.id, request.version, request.status,
        request.customer_id, request.preferred_locale,
        request.contact_name, request.contact_email, request.contact_phone,
        request.updated_at
      from ${serviceRequests} request
      where request.id = ${input.requestId}::uuid
        and ${staffRequestManageSql(actorProfileId)}
      for update of request
    ),
    zone_reference as materialized (
      select zone.id
      from ${travelZoneRecords} zone
      where zone.id = ${input.property?.serviceZoneId ?? null}::integer
        and zone.active = true
    ),
    decision as materialized (
      select case
        when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
        when (select version from target) <> ${input.expectedVersion}
          then 'CONFLICT'
        when (select status from target) in ('QUOTED', 'CLOSED', 'DECLINED')
          then 'INVALID_TRANSITION'
        when (select customer_id from target) is not null then 'CONFLICT'
        when ${input.property?.serviceZoneId ?? null}::integer is not null
          and not exists (select 1 from zone_reference)
          then 'INVALID_REFERENCE'
        else 'CHANGED'
      end as result
    ),
    created_customer as (
      insert into ${customers} (
        customer_type, display_name, legal_name, preferred_locale,
        primary_email, primary_phone, status, version, internal_notes,
        created_by_profile_id, updated_by_profile_id
      )
      select ${input.customerType}, ${input.displayName}, ${input.legalName},
        target.preferred_locale, target.contact_email, target.contact_phone,
        'ACTIVE', 1, ${input.internalNotes},
        ${actorProfileId}::uuid, ${actorProfileId}::uuid
      from target, decision
      where decision.result = 'CHANGED'
      returning id
    ),
    created_contact as (
      insert into ${customerContacts} (
        customer_id, contact_name, email, phone, is_primary,
        preferred_contact_method, locale, active, version,
        created_by_profile_id, updated_by_profile_id
      )
      select created_customer.id, target.contact_name, target.contact_email,
        target.contact_phone, true, 'NO_PREFERENCE', target.preferred_locale,
        true, 1, ${actorProfileId}::uuid, ${actorProfileId}::uuid
      from created_customer, target
      returning id
    ),
    created_property as (
      insert into ${properties} (
        customer_id, property_type, label, city, district, street_address,
        postal_code, service_zone_id, status, version, created_by_profile_id,
        updated_by_profile_id
      )
      select created_customer.id, ${input.property?.propertyType ?? null},
        ${input.property?.label ?? null}, ${input.property?.city ?? null},
        ${input.property?.district ?? null},
        ${input.property?.streetAddress ?? null},
        ${input.property?.postalCode ?? null},
        ${input.property?.serviceZoneId ?? null}::integer, 'ACTIVE', 1,
        ${actorProfileId}::uuid, ${actorProfileId}::uuid
      from created_customer
      where ${input.property !== null}
      returning id
    ),
    changed_request as (
      update ${serviceRequests} request
      set customer_id = created_customer.id,
        property_id = (select id from created_property),
        customer_resolution_status = 'LINKED',
        version = request.version + 1,
        updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from created_customer, decision
      where request.id = ${input.requestId}::uuid
        and request.version = ${input.expectedVersion}
        and request.customer_id is null
        and decision.result = 'CHANGED'
        and exists (select 1 from created_contact)
      returning request.id, request.version, request.updated_at
    ),
    audited as (
      insert into ${businessAuditEvents} (
        entity_type, entity_id, event_type, actor_profile_id, source,
        safe_metadata
      )
      select 'SERVICE_REQUEST', changed_request.id, 'REQUEST_LINKED',
        ${actorProfileId}::uuid, 'STAFF',
        jsonb_build_object(
          'resolution', 'LINKED',
          'createdCustomer', true,
          'createdProperty', ${input.property !== null}::boolean
        )
      from changed_request
      returning id
    )
    select decision.result::text as result,
      coalesce(changed_request.id, target.id) as id,
      coalesce(changed_request.version, target.version) as version,
      coalesce(changed_request.updated_at, target.updated_at) as "updatedAt"
    from decision
    left join target on true
    left join changed_request on true
  `);
  return requestMutationResult(result.rows[0]);
}

export async function transitionRequestRecord(
  database: Database,
  actorProfileId: string,
  input: TransitionRequestInput,
): Promise<RequestMutationResult> {
  const result = await database.execute<RequestMutationRow>(sql`
    with target as materialized (
      select request.id, request.version, request.status,
        request.customer_resolution_status, request.customer_id,
        request.property_id, request.updated_at
      from ${serviceRequests} request
      where request.id = ${input.requestId}::uuid
        and ${staffRequestManageSql(actorProfileId)}
      for update of request
    ),
    ready_reference as materialized (
      select 1 as valid
      from target
      join ${customers} customer
        on customer.id = target.customer_id
       and customer.status = 'ACTIVE'
      join ${properties} property
        on property.id = target.property_id
       and property.customer_id = target.customer_id
       and property.status = 'ACTIVE'
      join ${travelZoneRecords} zone
        on zone.id = property.service_zone_id
       and zone.active = true
      where target.customer_resolution_status = 'LINKED'
        and exists (
          select 1 from ${serviceRequestItems} item
          where item.request_id = target.id
        )
        and not exists (
          select 1
          from ${serviceRequestItems} item
          left join ${services} service
            on service.id = item.service_id and service.active = true
          left join ${cleaningItemTypes} item_type
            on item_type.id = item.cleaning_item_type_id
           and item_type.active = true
          left join ${measurementModes} measurement
            on measurement.id = item.measurement_mode_id
           and measurement.active = true
          left join ${conditionLevels} normalized_condition
            on normalized_condition.id = item.normalized_condition_level_id
           and normalized_condition.active = true
          left join ${fibreMaterials} fibre
            on fibre.id = coalesce(
              item.normalized_fibre_material_id,
              item.reported_fibre_material_id
            )
           and fibre.active = true
          left join ${surfaceConstructions} surface
            on surface.id = coalesce(
              item.normalized_surface_construction_id,
              item.reported_surface_construction_id
            )
           and surface.active = true
          left join ${cleaningAssets} asset
            on asset.id = item.cleaning_asset_id
           and asset.property_id = target.property_id
           and asset.status = 'ACTIVE'
          where item.request_id = target.id
            and (
              service.id is null
              or item_type.id is null
              or measurement.id is null
              or normalized_condition.id is null
              or (coalesce(item.normalized_fibre_material_id, item.reported_fibre_material_id) is not null and fibre.id is null)
              or (coalesce(item.normalized_surface_construction_id, item.reported_surface_construction_id) is not null and surface.id is null)
              or (item.cleaning_asset_id is not null and asset.id is null)
              or not exists (
                select 1
                from ${serviceItemCapabilities} capability
                join ${capabilityStatuses} capability_status
                  on capability_status.id = capability.status_id
                 and capability_status.active = true
                 and capability_status.code <> 'UNAVAILABLE'
                where capability.service_id = service.id
                  and capability.item_type_id = item_type.id
              )
              or not exists (
                select 1
                from ${cleaningItemTypeMeasurementModes} supported_measurement
                where supported_measurement.item_type_id = item_type.id
                  and supported_measurement.measurement_mode_id = measurement.id
              )
              or exists (
                select 1
                from ${serviceRequestItemIssues} selected_issue
                left join ${issueTypes} issue_type
                  on issue_type.id = selected_issue.issue_type_id
                 and issue_type.active = true
                where selected_issue.request_item_id = item.id
                  and selected_issue.staff_confirmed = true
                  and issue_type.id is null
              )
              or exists (
                select 1
                from ${serviceRequestItemAddons} selected_addon
                left join ${serviceAddons} addon
                  on addon.id = selected_addon.addon_id
                 and addon.active = true
                left join ${serviceAddonCapabilities} addon_capability
                  on addon_capability.service_id = service.id
                 and addon_capability.addon_id = addon.id
                left join ${capabilityStatuses} addon_status
                  on addon_status.id = addon_capability.status_id
                 and addon_status.active = true
                 and addon_status.code <> 'UNAVAILABLE'
                where selected_addon.request_item_id = item.id
                  and selected_addon.staff_included = true
                  and (
                    addon.id is null
                    or addon_capability.addon_id is null
                    or addon_status.id is null
                  )
              )
            )
        )
    ),
    decision as materialized (
      select case
        when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
        when (select version from target) <> ${input.expectedVersion}
          or (select status from target) <> ${input.fromStatus}
          then 'CONFLICT'
        when ${input.toStatus} = 'READY_TO_QUOTE'
          and not exists (select 1 from ready_reference)
          then 'INVALID_REFERENCE'
        when not (
          (${input.fromStatus} = 'SUBMITTED' and ${input.toStatus} = 'IN_REVIEW')
          or (${input.fromStatus} = 'IN_REVIEW' and ${input.toStatus} in ('NEEDS_REVIEW', 'READY_TO_QUOTE', 'DECLINED'))
          or (${input.fromStatus} = 'NEEDS_REVIEW' and ${input.toStatus} in ('IN_REVIEW', 'READY_TO_QUOTE', 'DECLINED'))
          or (${input.fromStatus} = 'READY_TO_QUOTE' and ${input.toStatus} in ('IN_REVIEW', 'DECLINED'))
          or (${input.fromStatus} = 'QUOTED' and ${input.toStatus} = 'CLOSED')
        ) then 'INVALID_TRANSITION'
        else 'CHANGED'
      end as result
    ),
    changed as (
      update ${serviceRequests} request
      set status = ${input.toStatus},
        manual_review_required = case
          when ${input.toStatus} in ('READY_TO_QUOTE', 'QUOTED', 'CLOSED', 'DECLINED')
            then false
          else true
        end,
        closed_at = case when ${input.toStatus} = 'CLOSED' then now() else null end,
        version = request.version + 1,
        updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from decision
      where request.id = ${input.requestId}::uuid
        and request.version = ${input.expectedVersion}
        and request.status = ${input.fromStatus}
        and decision.result = 'CHANGED'
      returning request.id, request.version, request.updated_at
    ),
    audited as (
      insert into ${businessAuditEvents} (
        entity_type, entity_id, event_type, actor_profile_id, source,
        safe_metadata
      )
      select 'SERVICE_REQUEST', changed.id, 'REQUEST_STATUS_CHANGED',
        ${actorProfileId}::uuid, 'STAFF',
        jsonb_build_object(
          'from', ${input.fromStatus}::text,
          'to', ${input.toStatus}::text
        )
      from changed
      returning id
    )
    select decision.result::text as result,
      coalesce(changed.id, target.id) as id,
      coalesce(changed.version, target.version) as version,
      coalesce(changed.updated_at, target.updated_at) as "updatedAt"
    from decision
    left join target on true
    left join changed on true
  `);
  return requestMutationResult(result.rows[0]);
}

export async function normalizeRequestRecord(
  database: Database,
  actorProfileId: string,
  input: NormalizeRequestInput,
): Promise<RequestMutationResult> {
  const itemInput = normalizedItemsParameter(input.items);
  const result = await database.execute<RequestMutationRow>(sql`
    with target as materialized (
      select request.id, request.version, request.status,
        request.customer_id, request.property_id, request.updated_at
      from ${serviceRequests} request
      where request.id = ${input.requestId}::uuid
        and ${staffRequestManageSql(actorProfileId)}
      for update of request
    ),
    normalized_input as materialized (
      select *
      from jsonb_to_recordset(${itemInput}::jsonb) as item(
        item_id uuid,
        expected_version integer,
        service_id integer,
        cleaning_item_type_id integer,
        cleaning_asset_id uuid,
        measurement_mode_id integer,
        normalized_condition_level_id integer,
        normalized_fibre_material_id integer,
        normalized_surface_construction_id integer,
        normalized_description text,
        quantity integer,
        area_hundredths_m2 integer,
        seat_count integer,
        sides integer,
        sort_order integer,
        issue_type_ids jsonb,
        addon_ids jsonb
      )
    ),
    references_valid as materialized (
      select not exists (
        select 1
        from normalized_input item
        left join ${serviceRequestItems} current_item
          on current_item.id = item.item_id
         and current_item.request_id = ${input.requestId}::uuid
        left join ${services} selected_service
          on selected_service.id = item.service_id
         and selected_service.active = true
        left join ${cleaningItemTypes} selected_type
          on selected_type.id = item.cleaning_item_type_id
         and selected_type.active = true
        left join ${measurementModes} selected_measurement
          on selected_measurement.id = item.measurement_mode_id
         and selected_measurement.active = true
        left join ${conditionLevels} selected_condition
          on selected_condition.id = item.normalized_condition_level_id
         and selected_condition.active = true
        left join ${fibreMaterials} selected_fibre
          on selected_fibre.id = coalesce(
            item.normalized_fibre_material_id,
            current_item.reported_fibre_material_id
          )
         and selected_fibre.active = true
        left join ${surfaceConstructions} selected_surface
          on selected_surface.id = coalesce(
            item.normalized_surface_construction_id,
            current_item.reported_surface_construction_id
          )
         and selected_surface.active = true
        left join ${cleaningAssets} selected_asset
          on selected_asset.id = item.cleaning_asset_id
         and selected_asset.property_id = (select property_id from target)
         and selected_asset.status = 'ACTIVE'
        where current_item.id is null
          or current_item.version <> item.expected_version
          or (item.service_id is not null and selected_service.id is null)
          or (item.cleaning_item_type_id is not null and selected_type.id is null)
          or (item.measurement_mode_id is not null and selected_measurement.id is null)
          or (item.normalized_condition_level_id is not null and selected_condition.id is null)
          or (coalesce(item.normalized_fibre_material_id, current_item.reported_fibre_material_id) is not null and selected_fibre.id is null)
          or (coalesce(item.normalized_surface_construction_id, current_item.reported_surface_construction_id) is not null and selected_surface.id is null)
          or (selected_service.id is not null and selected_type.id is not null
            and not exists (
              select 1
              from ${serviceItemCapabilities} capability
              join ${capabilityStatuses} capability_status
                on capability_status.id = capability.status_id
               and capability_status.active = true
               and capability_status.code <> 'UNAVAILABLE'
              where capability.service_id = selected_service.id
                and capability.item_type_id = selected_type.id
            ))
          or (selected_type.id is not null and selected_measurement.id is not null
            and not exists (
              select 1
              from ${cleaningItemTypeMeasurementModes} supported_measurement
              where supported_measurement.item_type_id = selected_type.id
                and supported_measurement.measurement_mode_id = selected_measurement.id
            ))
          or (item.cleaning_asset_id is not null and selected_asset.id is null)
          or exists (
            select 1 from jsonb_array_elements_text(item.issue_type_ids) issue(value)
            left join ${issueTypes} issue_type
              on issue_type.id = issue.value::integer and issue_type.active = true
            where issue_type.id is null
          )
          or exists (
            select 1 from jsonb_array_elements_text(item.addon_ids) addon(value)
            left join ${serviceAddons} service_addon
              on service_addon.id = addon.value::integer
             and service_addon.active = true
            left join ${serviceAddonCapabilities} addon_capability
              on addon_capability.addon_id = service_addon.id
             and addon_capability.service_id = selected_service.id
            left join ${capabilityStatuses} addon_capability_status
              on addon_capability_status.id = addon_capability.status_id
             and addon_capability_status.active = true
             and addon_capability_status.code <> 'UNAVAILABLE'
            where service_addon.id is null
              or selected_service.id is null
              or addon_capability.addon_id is null
              or addon_capability_status.id is null
          )
      ) as valid
    ),
    decision as materialized (
      select case
        when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
        when (select version from target) <> ${input.expectedVersion} then 'CONFLICT'
        when (select status from target) not in ('IN_REVIEW', 'NEEDS_REVIEW')
          then 'INVALID_TRANSITION'
        when (select count(*) from normalized_input) <> ${input.items.length}
          or (select count(distinct item_id) from normalized_input) <> ${input.items.length}
          then 'INVALID_REFERENCE'
        when not (select valid from references_valid) then 'INVALID_REFERENCE'
        else 'CHANGED'
      end as result
    ),
    changed_items as (
      update ${serviceRequestItems} current_item
      set service_id = item.service_id,
        cleaning_item_type_id = item.cleaning_item_type_id,
        cleaning_asset_id = item.cleaning_asset_id,
        measurement_mode_id = item.measurement_mode_id,
        normalized_condition_level_id = item.normalized_condition_level_id,
        normalized_fibre_material_id = item.normalized_fibre_material_id,
        normalized_surface_construction_id = item.normalized_surface_construction_id,
        normalized_description = item.normalized_description,
        quantity = item.quantity,
        area_hundredths_m2 = item.area_hundredths_m2,
        seat_count = item.seat_count,
        sides = item.sides,
        sort_order = item.sort_order,
        version = current_item.version + 1,
        updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from normalized_input item, decision
      where current_item.id = item.item_id
        and current_item.request_id = ${input.requestId}::uuid
        and current_item.version = item.expected_version
        and decision.result = 'CHANGED'
      returning current_item.id
    ),
    removed_staff_issues as (
      delete from ${serviceRequestItemIssues} current_issue
      using normalized_input item, decision
      where current_issue.request_item_id = item.item_id
        and current_issue.staff_confirmed = true
        and current_issue.customer_reported = false
        and not exists (
          select 1
          from jsonb_array_elements_text(item.issue_type_ids) retained_issue(value)
          where retained_issue.value::integer = current_issue.issue_type_id
        )
        and decision.result = 'CHANGED'
      returning current_issue.request_item_id
    ),
    unconfirmed_customer_issues as (
      update ${serviceRequestItemIssues} current_issue
      set staff_confirmed = false
      from normalized_input item, decision
      where current_issue.request_item_id = item.item_id
        and current_issue.customer_reported = true
        and current_issue.staff_confirmed = true
        and current_issue.issue_type_id not in (
          select issue.value::integer
          from jsonb_array_elements_text(item.issue_type_ids) issue(value)
        )
        and decision.result = 'CHANGED'
      returning current_issue.request_item_id, current_issue.issue_type_id
    ),
    confirmed_existing_issues as (
      update ${serviceRequestItemIssues} current_issue
      set staff_confirmed = true
      from normalized_input item, decision
      where current_issue.request_item_id = item.item_id
        and current_issue.issue_type_id in (
          select issue.value::integer
          from jsonb_array_elements_text(item.issue_type_ids) issue(value)
        )
        and decision.result = 'CHANGED'
      returning current_issue.request_item_id, current_issue.issue_type_id
    ),
    inserted_issues as (
      insert into ${serviceRequestItemIssues} (
        request_item_id, issue_type_id, customer_reported, staff_confirmed,
        created_by_profile_id
      )
      select item.item_id, issue.value::integer, false, true,
        ${actorProfileId}::uuid
      from normalized_input item
      cross join lateral jsonb_array_elements_text(item.issue_type_ids) issue(value)
      cross join decision
      where decision.result = 'CHANGED'
        and not exists (
          select 1 from ${serviceRequestItemIssues} existing
          where existing.request_item_id = item.item_id
            and existing.issue_type_id = issue.value::integer
        )
      returning request_item_id
    ),
    removed_staff_addons as (
      delete from ${serviceRequestItemAddons} current_addon
      using normalized_input item, decision
      where current_addon.request_item_id = item.item_id
        and current_addon.staff_included = true
        and current_addon.customer_requested = false
        and not exists (
          select 1
          from jsonb_array_elements_text(item.addon_ids) retained_addon(value)
          where retained_addon.value::integer = current_addon.addon_id
        )
        and decision.result = 'CHANGED'
      returning current_addon.request_item_id
    ),
    unconfirmed_customer_addons as (
      update ${serviceRequestItemAddons} current_addon
      set staff_included = false
      from normalized_input item, decision
      where current_addon.request_item_id = item.item_id
        and current_addon.customer_requested = true
        and current_addon.staff_included = true
        and current_addon.addon_id not in (
          select addon.value::integer
          from jsonb_array_elements_text(item.addon_ids) addon(value)
        )
        and decision.result = 'CHANGED'
      returning current_addon.request_item_id, current_addon.addon_id
    ),
    confirmed_existing_addons as (
      update ${serviceRequestItemAddons} current_addon
      set staff_included = true
      from normalized_input item, decision
      where current_addon.request_item_id = item.item_id
        and current_addon.addon_id in (
          select addon.value::integer
          from jsonb_array_elements_text(item.addon_ids) addon(value)
        )
        and decision.result = 'CHANGED'
      returning current_addon.request_item_id, current_addon.addon_id
    ),
    inserted_addons as (
      insert into ${serviceRequestItemAddons} (
        request_item_id, addon_id, customer_requested, staff_included,
        created_by_profile_id
      )
      select item.item_id, addon.value::integer, false, true,
        ${actorProfileId}::uuid
      from normalized_input item
      cross join lateral jsonb_array_elements_text(item.addon_ids) addon(value)
      cross join decision
      where decision.result = 'CHANGED'
        and not exists (
          select 1 from ${serviceRequestItemAddons} existing
          where existing.request_item_id = item.item_id
            and existing.addon_id = addon.value::integer
        )
      returning request_item_id
    ),
    changed_request as (
      update ${serviceRequests} request
      set staff_notes = ${input.staffNotes},
        manual_review_required = true,
        version = request.version + 1,
        updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from decision
      where request.id = ${input.requestId}::uuid
        and request.version = ${input.expectedVersion}
        and decision.result = 'CHANGED'
        and (select count(*) from changed_items) = ${input.items.length}
      returning request.id, request.version, request.updated_at
    ),
    audited as (
      insert into ${businessAuditEvents} (
        entity_type, entity_id, event_type, actor_profile_id, source,
        safe_metadata
      )
      select 'SERVICE_REQUEST', changed_request.id, 'REQUEST_NORMALIZED',
        ${actorProfileId}::uuid, 'STAFF',
        jsonb_build_object('itemCount', ${input.items.length}::integer)
      from changed_request
      returning id
    ),
    final_decision as materialized (
      select case
        when decision.result = 'CHANGED'
          and not exists (select 1 from changed_request) then 'CONFLICT'
        else decision.result
      end as result
      from decision
    )
    select final_decision.result::text as result,
      coalesce(changed_request.id, target.id) as id,
      coalesce(changed_request.version, target.version) as version,
      coalesce(changed_request.updated_at, target.updated_at) as "updatedAt"
    from final_decision
    left join target on true
    left join changed_request on true
  `);
  return requestMutationResult(result.rows[0]);
}

type EstimateCreateRow = {
  result:
    "CREATED" | "CONFLICT" | "NOT_FOUND_OR_FORBIDDEN" | "INVALID_REFERENCE";
  id: string | null;
  estimateVersion: number | null;
  requestVersion: number | null;
};

function estimateCreateResult(
  row: EstimateCreateRow | undefined,
): CreateEstimateRecordResult {
  if (!row) return { status: "NOT_FOUND_OR_FORBIDDEN" };
  switch (row.result) {
    case "CREATED":
      if (!row.id || !row.estimateVersion || !row.requestVersion) {
        return { status: "CONFLICT" };
      }
      return {
        status: "CREATED",
        id: row.id,
        estimateVersion: row.estimateVersion,
        requestVersion: row.requestVersion,
      };
    case "CONFLICT":
    case "NOT_FOUND_OR_FORBIDDEN":
    case "INVALID_REFERENCE":
      return { status: row.result };
  }
}

type DerivedEstimateRow = {
  result: "READY" | "CONFLICT" | "NOT_FOUND_OR_FORBIDDEN" | "INVALID_REFERENCE";
  engineInput: EstimateEngineInput | null;
};

/**
 * Build the commercial-engine input from the current normalized request graph.
 * Browser-supplied service, item, issue, add-on, measurement or CRM codes are
 * never accepted at this boundary.
 */
export async function deriveEstimateEngineInputRecord(
  database: Database,
  actorProfileId: string,
  requestId: string,
  expectedRequestVersion: number,
): Promise<DerivedEstimateInputResult> {
  const result = await database.execute<DerivedEstimateRow>(sql`
    with target as materialized (
      select request.id, request.version, request.status,
        request.customer_id, request.property_id,
        request.preferred_window_code
      from ${serviceRequests} request
      where request.id = ${requestId}::uuid
        and ${staffRequestManageSql(actorProfileId)}
    ),
    customer_context as materialized (
      select ${commercialCustomerSegmentSql(sql`customer.customer_type`)} as customer_segment
      from target
      join ${customers} customer on customer.id = target.customer_id
      where customer.status = 'ACTIVE'
        and customer.customer_type in ('INDIVIDUAL', 'BUSINESS')
    ),
    property_context as materialized (
      select zone.code as travel_zone_code
      from target
      join ${properties} property on property.id = target.property_id
        and property.customer_id = target.customer_id
        and property.status = 'ACTIVE'
      join ${travelZoneRecords} zone on zone.id = property.service_zone_id
        and zone.active = true
        and zone.code in (
          'SOFIA_CORE', 'SOFIA_EXTENDED', 'SOFIA_OUTSKIRTS', 'OUTSIDE_SOFIA'
        )
    ),
    request_item_count as materialized (
      select count(*)::integer as value
      from ${serviceRequestItems} item
      where item.request_id = ${requestId}::uuid
    ),
    normalized_item_rows as materialized (
      select item.id, item.sort_order, service.code as service_code,
        item_type.code as item_type_code, item.quantity,
        item.area_hundredths_m2, item.seat_count, item.sides,
        measurement.code as measurement_mode_code,
        capability_status.code as capability_status_code,
        fibre.code as fibre_material_code,
        condition.code as condition_code,
        coalesce((
          select jsonb_agg(issue_type.code order by issue_type.code)
          from ${serviceRequestItemIssues} selected_issue
          join ${issueTypes} issue_type
            on issue_type.id = selected_issue.issue_type_id
           and issue_type.active = true
          where selected_issue.request_item_id = item.id
            and selected_issue.staff_confirmed = true
        ), '[]'::jsonb) as issue_codes,
        coalesce((
          select jsonb_agg(addon.code order by addon.code)
          from ${serviceRequestItemAddons} selected_addon
          join ${serviceAddons} addon on addon.id = selected_addon.addon_id
           and addon.active = true
          join ${serviceAddonCapabilities} addon_capability
            on addon_capability.service_id = service.id
           and addon_capability.addon_id = addon.id
          join ${capabilityStatuses} addon_status
            on addon_status.id = addon_capability.status_id
           and addon_status.active = true
           and addon_status.code <> 'UNAVAILABLE'
          where selected_addon.request_item_id = item.id
            and selected_addon.staff_included = true
        ), '[]'::jsonb) as addon_codes,
        exists (
          select 1
          from ${serviceRequestItemAddons} selected_addon
          join ${serviceAddonCapabilities} addon_capability
            on addon_capability.service_id = service.id
           and addon_capability.addon_id = selected_addon.addon_id
          join ${capabilityStatuses} addon_status
            on addon_status.id = addon_capability.status_id
           and addon_status.active = true
          where selected_addon.request_item_id = item.id
            and selected_addon.staff_included = true
            and addon_status.code = 'ASSESSMENT_REQUIRED'
        ) as addon_assessment_required,
        exists (
          select 1
          from ${serviceRequestItemAddons} selected_addon
          join ${serviceAddonCapabilities} addon_capability
            on addon_capability.service_id = service.id
           and addon_capability.addon_id = selected_addon.addon_id
          join ${capabilityStatuses} addon_status
            on addon_status.id = addon_capability.status_id
           and addon_status.active = true
          where selected_addon.request_item_id = item.id
            and selected_addon.staff_included = true
            and addon_status.code = 'SPECIALIST_ONLY'
        ) as addon_specialist_required,
        coalesce((
          select jsonb_agg(risk.code order by risk.code)
          from ${cleaningAssetReportedRiskFlags} selected_risk
          join ${riskFlags} risk on risk.id = selected_risk.risk_flag_id
           and risk.active = true
          where selected_risk.cleaning_asset_id = item.cleaning_asset_id
            and selected_risk.active = true
        ), '[]'::jsonb) as risk_flag_codes
      from ${serviceRequestItems} item
      join ${services} service on service.id = item.service_id
        and service.active = true
      join ${cleaningItemTypes} item_type
        on item_type.id = item.cleaning_item_type_id
       and item_type.active = true
      join ${measurementModes} measurement
        on measurement.id = item.measurement_mode_id
       and measurement.active = true
      join ${cleaningItemTypeMeasurementModes} supported_measurement
        on supported_measurement.item_type_id = item_type.id
       and supported_measurement.measurement_mode_id = measurement.id
      join ${serviceItemCapabilities} capability
        on capability.service_id = service.id
       and capability.item_type_id = item_type.id
      join ${capabilityStatuses} capability_status
        on capability_status.id = capability.status_id
       and capability_status.active = true
       and capability_status.code <> 'UNAVAILABLE'
      join ${conditionLevels} condition
        on condition.id = coalesce(
          item.normalized_condition_level_id,
          item.customer_reported_condition_level_id
        )
       and condition.active = true
      left join ${fibreMaterials} fibre
        on fibre.id = coalesce(
          item.normalized_fibre_material_id,
          item.reported_fibre_material_id
        )
       and fibre.active = true
      left join ${surfaceConstructions} surface
        on surface.id = coalesce(
          item.normalized_surface_construction_id,
          item.reported_surface_construction_id
        )
       and surface.active = true
      where item.request_id = ${requestId}::uuid
        and (
          coalesce(item.normalized_fibre_material_id, item.reported_fibre_material_id) is null
          or fibre.id is not null
        )
        and (
          coalesce(item.normalized_surface_construction_id, item.reported_surface_construction_id) is null
          or surface.id is not null
        )
        and (
          item.cleaning_asset_id is null
          or exists (
            select 1 from ${cleaningAssets} asset
            where asset.id = item.cleaning_asset_id
              and asset.property_id = (select property_id from target)
              and asset.status = 'ACTIVE'
          )
        )
        and not exists (
          select 1
          from ${serviceRequestItemIssues} selected_issue
          left join ${issueTypes} issue_type
            on issue_type.id = selected_issue.issue_type_id
           and issue_type.active = true
          where selected_issue.request_item_id = item.id
            and selected_issue.staff_confirmed = true
            and issue_type.id is null
        )
        and not exists (
          select 1
          from ${serviceRequestItemAddons} selected_addon
          left join ${serviceAddons} addon
            on addon.id = selected_addon.addon_id
           and addon.active = true
          left join ${serviceAddonCapabilities} addon_capability
            on addon_capability.service_id = service.id
           and addon_capability.addon_id = addon.id
          left join ${capabilityStatuses} addon_status
            on addon_status.id = addon_capability.status_id
           and addon_status.active = true
           and addon_status.code <> 'UNAVAILABLE'
          where selected_addon.request_item_id = item.id
            and selected_addon.staff_included = true
            and (
              addon.id is null
              or addon_capability.addon_id is null
              or addon_status.id is null
            )
        )
    ),
    governance_context as materialized (
      select coalesce(
        jsonb_agg(distinct reason.value order by reason.value)
          filter (where reason.value is not null),
        '[]'::jsonb
      ) as review_reason_codes
      from normalized_item_rows item
      cross join lateral (values
        (case
          when item.capability_status_code = 'ASSESSMENT_REQUIRED'
            or item.addon_assessment_required
            or item.measurement_mode_code = 'CUSTOM_ASSESSMENT'
          then 'CATALOGUE_ASSESSMENT_REQUIRED'
        end),
        (case
          when item.capability_status_code = 'SPECIALIST_ONLY'
            or item.addon_specialist_required
          then 'CATALOGUE_SPECIALIST_ONLY'
        end),
        (case
          when item.fibre_material_code is null then 'MISSING_MATERIAL'
        end),
        (case
          when (item.measurement_mode_code = 'AREA_M2'
              and item.area_hundredths_m2 is null)
            or (item.measurement_mode_code = 'PER_SEAT'
              and item.seat_count is null)
            or item.measurement_mode_code = 'LINEAR_METER'
          then 'MISSING_MEASUREMENT'
        end)
      ) reason(value)
    ),
    condition_context as materialized (
      select case max(
        case condition_code
          when 'LIGHT_MAINTENANCE' then 1
          when 'NORMAL' then 1
          when 'NOTICEABLY_SOILED' then 2
          when 'HEAVILY_SOILED' then 3
          when 'SPECIALIST_ASSESSMENT_REQUIRED' then 4
          else 4
        end
      )
        when 1 then 'NORMAL'
        when 2 then 'ENHANCED'
        when 3 then 'INTENSIVE'
        else 'ASSESSMENT_REQUIRED'
      end as condition_band_code
      from normalized_item_rows
    ),
    engine_input as materialized (
      select jsonb_build_object(
        'customerSegment', customer_context.customer_segment,
        'items', (
          select jsonb_agg(
            jsonb_strip_nulls(jsonb_build_object(
              'serviceCode', item.service_code,
              'itemTypeCode', item.item_type_code,
              'quantity', item.quantity,
              'areaHundredthsM2', item.area_hundredths_m2,
              'seatCount', item.seat_count,
              'sides', item.sides,
              'issueCodes', item.issue_codes,
              'addonCodes', item.addon_codes,
              'riskFlagCodes', item.risk_flag_codes,
              'fibreMaterialCode', item.fibre_material_code
            )) order by item.sort_order
          ) from normalized_item_rows item
        ),
        'conditionBandCode', condition_context.condition_band_code,
        'travelZoneCode', property_context.travel_zone_code,
        'governanceReviewReasonCodes', governance_context.review_reason_codes,
        'timingCategoryCode', case
          when upper(coalesce(target.preferred_window_code, '')) = 'EARLY_MORNING'
            or target.preferred_window_code = 'early-morning' then 'EARLY_MORNING'
          when upper(coalesce(target.preferred_window_code, '')) = 'EVENING'
            or target.preferred_window_code = 'evening' then 'EVENING'
          else 'STANDARD'
        end
      ) as value
      from target, customer_context, property_context, condition_context,
        governance_context
      where (select count(*) from normalized_item_rows)
        = (select value from request_item_count)
        and (select value from request_item_count) > 0
    ),
    decision as materialized (
      select case
        when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
        when (select version from target) <> ${expectedRequestVersion}
          then 'CONFLICT'
        when (select status from target) not in ('IN_REVIEW', 'NEEDS_REVIEW', 'READY_TO_QUOTE', 'QUOTED')
          then 'CONFLICT'
        when not exists (select 1 from engine_input) then 'INVALID_REFERENCE'
        else 'READY'
      end as result
    )
    select decision.result::text as result,
      engine_input.value as "engineInput"
    from decision
    left join engine_input on true
  `);
  const row = result.rows[0];
  if (!row || row.result === "NOT_FOUND_OR_FORBIDDEN") {
    return { status: "NOT_FOUND_OR_FORBIDDEN" };
  }
  if (row.result !== "READY") return { status: row.result };
  if (!row.engineInput) return { status: "INVALID_REFERENCE" };
  return { status: "READY", engineInput: row.engineInput };
}

export async function appendEstimateRecord(
  database: Database,
  actorProfileId: string,
  input: AppendEstimateInput,
): Promise<CreateEstimateRecordResult> {
  const { calculation } = input;
  const estimateStatus = calculation.declineOrReferRequired
    ? "DECLINE_OR_REFER"
    : calculation.manualReviewRequired
      ? "REVIEW_REQUIRED"
      : "CALCULATED";
  const warnings = [
    ...calculation.priceSnapshot.result.warnings,
    ...calculation.durationSnapshot.result.warnings,
    ...calculation.reviewReasonCodes,
  ];
  try {
    const result = await database.execute<EstimateCreateRow>(sql`
      with target as materialized (
        select request.id, request.version, request.status,
          request.customer_id, request.property_id
        from ${serviceRequests} request
        where request.id = ${input.requestId}::uuid
          and ${staffRequestManageSql(actorProfileId)}
        for update of request
      ),
      estimate_input as materialized (
        select ${jsonParameter(input.engineInput)}::jsonb as input_snapshot
      ),
      commercial_context as materialized (
        select customer.id as customer_id, property.id as property_id,
          property.service_zone_id,
          ${commercialCustomerSegmentSql(sql`customer.customer_type`)} as customer_segment
        from target
        join ${customers} customer
          on customer.id = target.customer_id
         and customer.status = 'ACTIVE'
        join ${properties} property
          on property.id = target.property_id
         and property.customer_id = customer.id
         and property.status = 'ACTIVE'
        for share of customer, property
      ),
      travel_context as materialized (
        select zone.code as travel_zone_code
        from commercial_context
        join ${travelZoneRecords} zone
          on zone.id = commercial_context.service_zone_id
         and zone.active = true
         and zone.code in (
           'SOFIA_CORE', 'SOFIA_EXTENDED', 'SOFIA_OUTSKIRTS', 'OUTSIDE_SOFIA'
         )
        for share of zone
      ),
      current_estimate_semantics as materialized (
        select commercial_context.customer_segment,
          travel_context.travel_zone_code
        from commercial_context, travel_context
      ),
      model_references as materialized (
        select price_book.id as price_book_id,
          duration_model.id as duration_model_id
        from ${priceBooks} price_book
        cross join ${durationModels} duration_model
        where price_book.code = ${calculation.priceSnapshot.priceBook.code}
          and price_book.version = ${calculation.priceSnapshot.priceBook.version}
          and duration_model.code = ${calculation.durationSnapshot.durationModel.code}
          and duration_model.version = ${calculation.durationSnapshot.durationModel.version}
      ),
      next_version as materialized (
        select coalesce(max(estimate.estimate_version), 0) + 1 as value
        from ${requestEstimates} estimate
        where estimate.request_id = ${input.requestId}::uuid
      ),
      decision as materialized (
        select case
          when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
          when (select version from target) <> ${input.expectedRequestVersion}
            then 'CONFLICT'
          when (select status from target) not in ('IN_REVIEW', 'NEEDS_REVIEW', 'READY_TO_QUOTE', 'QUOTED')
            then 'CONFLICT'
          when not exists (select 1 from commercial_context)
            then 'INVALID_REFERENCE'
          when not exists (select 1 from model_references) then 'INVALID_REFERENCE'
          when not exists (
            select 1
            from current_estimate_semantics, estimate_input
            where current_estimate_semantics.customer_segment
                = (estimate_input.input_snapshot ->> 'customerSegment')
              and current_estimate_semantics.travel_zone_code
                = (estimate_input.input_snapshot ->> 'travelZoneCode')
          ) then 'CONFLICT'
          else 'CREATED'
        end as result
      ),
      request_changed as (
        update ${serviceRequests} request
        set manual_review_required = ${calculation.manualReviewRequired},
          version = request.version + 1,
          updated_at = now(),
          updated_by_profile_id = ${actorProfileId}::uuid
        from decision
        where request.id = ${input.requestId}::uuid
          and request.version = ${input.expectedRequestVersion}
          and decision.result = 'CREATED'
        returning request.id, request.version
      ),
      created as (
        insert into ${requestEstimates} (
          request_id, source_request_version, estimate_version, status, price_book_id,
          price_book_code, price_book_version, duration_model_id,
          duration_model_code, duration_model_version, input_snapshot,
          price_snapshot, duration_snapshot, availability_snapshot,
          net_amount_minor_units,
          vat_rate_basis_points, vat_amount_minor_units,
          gross_total_minor_units, currency, estimated_service_minutes,
          estimated_travel_minutes, manual_assessment_required,
          decline_or_refer_required, warnings, review_reason_codes,
          calculated_by_profile_id,
          calculated_at
        )
        select request_changed.id, request_changed.version, next_version.value,
          ${estimateStatus},
          model_references.price_book_id,
          ${calculation.priceSnapshot.priceBook.code},
          ${calculation.priceSnapshot.priceBook.version},
          model_references.duration_model_id,
          ${calculation.durationSnapshot.durationModel.code},
          ${calculation.durationSnapshot.durationModel.version},
          estimate_input.input_snapshot,
          ${jsonParameter(calculation.priceSnapshot)}::jsonb,
          ${jsonParameter(calculation.durationSnapshot)}::jsonb,
          ${jsonParameter(calculation.availabilitySnapshot)}::jsonb,
          ${calculation.netAmountMinorUnits},
          ${calculation.vatRateBasisPoints},
          ${calculation.vatAmountMinorUnits},
          ${calculation.grossTotalMinorUnits}, ${calculation.currency},
          ${calculation.totalEstimatedMinutes}, null,
          ${calculation.manualReviewRequired},
          ${calculation.declineOrReferRequired},
          ${jsonParameter(warnings)}::jsonb,
          ${jsonParameter(calculation.reviewReasonCodes)}::jsonb,
          ${actorProfileId}::uuid,
          ${calculation.priceSnapshot.calculatedAt}::timestamptz
        from request_changed, model_references, next_version, estimate_input,
          decision
        where decision.result = 'CREATED'
        returning id, estimate_version
      ),
      audited as (
        insert into ${businessAuditEvents} (
          entity_type, entity_id, event_type, actor_profile_id, source,
          safe_metadata
        )
        select 'REQUEST_ESTIMATE', created.id, 'ESTIMATE_CREATED',
          ${actorProfileId}::uuid, 'STAFF',
          jsonb_build_object(
            'requestId', ${input.requestId}::uuid,
            'estimateVersion', created.estimate_version,
            'status', ${estimateStatus}::text
          )
        from created
        returning id
      )
      select decision.result::text as result, created.id,
        created.estimate_version as "estimateVersion",
        request_changed.version as "requestVersion"
      from decision
      left join request_changed on true
      left join created on true
    `);
    return estimateCreateResult(result.rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "CONFLICT" };
    throw error;
  }
}

type QuoteMutationRow = {
  result:
    | "CREATED"
    | "CHANGED"
    | "NO_CHANGE"
    | "CONFLICT"
    | "NOT_FOUND_OR_FORBIDDEN"
    | "INVALID_REFERENCE"
    | "INVALID_TRANSITION";
  id: string | null;
  quoteReference: string | null;
  quoteVersion: number | null;
  recordVersion: number | null;
  quoteStatus: QuoteStatus | null;
};

function quoteMutationResult(
  row: QuoteMutationRow | undefined,
): QuoteMutationResult {
  if (!row) return { status: "NOT_FOUND_OR_FORBIDDEN" };
  switch (row.result) {
    case "CREATED":
    case "CHANGED":
    case "NO_CHANGE":
      if (
        !row.id ||
        !row.quoteReference ||
        !row.quoteVersion ||
        !row.recordVersion ||
        !row.quoteStatus
      ) {
        return { status: "CONFLICT" };
      }
      return {
        status: row.result,
        id: row.id,
        quoteReference: row.quoteReference,
        quoteVersion: row.quoteVersion,
        recordVersion: row.recordVersion,
        quoteStatus: row.quoteStatus,
      };
    case "CONFLICT":
    case "NOT_FOUND_OR_FORBIDDEN":
    case "INVALID_REFERENCE":
    case "INVALID_TRANSITION":
      return { status: row.result };
  }
}

function quoteLineRecordset(lineJson: string): SQL {
  return sql`jsonb_to_recordset(${lineJson}::jsonb) as line(
    request_item_id uuid,
    service_id integer,
    cleaning_item_type_id integer,
    measurement_mode_id integer,
    description_bg text,
    description_en text,
    quantity integer,
    measurement_snapshot jsonb,
    base_amount_minor_units integer,
    modifier_amount_minor_units integer,
    addon_amount_minor_units integer,
    net_amount_minor_units integer,
    vat_rate_basis_points integer,
    vat_amount_minor_units integer,
    gross_total_minor_units integer,
    calculation_snapshot jsonb,
    sort_order integer
  )`;
}

export async function createQuoteDraftRecord(
  database: Database,
  actorProfileId: string,
  input: CreateQuoteDraftInput,
): Promise<QuoteMutationResult> {
  const lineJson = quoteItemsParameter(input.items);
  try {
    const result = await database.execute<QuoteMutationRow>(sql`
      with target_request as materialized (
        select request.id, request.version, request.status,
          request.customer_id, request.property_id
        from ${serviceRequests} request
        where request.id = ${input.requestId}::uuid
          and ${staffRequestManageSql(actorProfileId)}
        for update of request
      ),
      commercial_context as materialized (
        select customer.id as customer_id, property.id as property_id,
          property.service_zone_id,
          ${commercialCustomerSegmentSql(sql`customer.customer_type`)} as customer_segment
        from target_request
        join ${customers} customer
          on customer.id = target_request.customer_id
         and customer.status = 'ACTIVE'
        join ${properties} property
          on property.id = target_request.property_id
         and property.customer_id = customer.id
         and property.status = 'ACTIVE'
        for share of customer, property
      ),
      travel_context as materialized (
        select zone.code as travel_zone_code
        from commercial_context
        join ${travelZoneRecords} zone
          on zone.id = commercial_context.service_zone_id
         and zone.active = true
         and zone.code in (
           'SOFIA_CORE', 'SOFIA_EXTENDED', 'SOFIA_OUTSKIRTS', 'OUTSIDE_SOFIA'
         )
        for share of zone
      ),
      current_estimate_semantics as materialized (
        select commercial_context.customer_segment,
          travel_context.travel_zone_code
        from commercial_context, travel_context
      ),
      selected_estimate as materialized (
        select estimate.id, estimate.input_snapshot
        from ${requestEstimates} estimate
        where estimate.id = ${input.estimateId}::uuid
          and estimate.request_id = ${input.requestId}::uuid
          and estimate.source_request_version = (
            select version from target_request
          )
          and estimate.decline_or_refer_required = false
      ),
      line_input as materialized (
        select * from ${quoteLineRecordset(lineJson)}
      ),
      line_validation as materialized (
        select
          count(*) = ${input.items.length}
            and count(request_item_id) = ${input.items.length}
            and count(distinct request_item_id) = ${input.items.length}
            and count(distinct sort_order) = ${input.items.length}
            and (
              select count(*) from ${serviceRequestItems} request_item
              where request_item.request_id = ${input.requestId}::uuid
            ) = ${input.items.length}
            and coalesce(sum(net_amount_minor_units), 0) = ${input.netAmountMinorUnits}
            and coalesce(sum(vat_amount_minor_units), 0) = ${input.vatAmountMinorUnits}
            and coalesce(sum(gross_total_minor_units), 0) = ${input.grossTotalMinorUnits}
            and not exists (
              select 1 from line_input line
              where not exists (
                  select 1 from ${serviceRequestItems} request_item
                  join ${services} line_service
                    on line_service.id = request_item.service_id
                   and line_service.active = true
                  join ${cleaningItemTypes} line_item_type
                    on line_item_type.id = request_item.cleaning_item_type_id
                   and line_item_type.active = true
                  join ${measurementModes} line_measurement
                    on line_measurement.id = request_item.measurement_mode_id
                   and line_measurement.active = true
                  join ${serviceItemCapabilities} line_capability
                    on line_capability.service_id = line_service.id
                   and line_capability.item_type_id = line_item_type.id
                  join ${capabilityStatuses} line_capability_status
                    on line_capability_status.id = line_capability.status_id
                   and line_capability_status.active = true
                   and line_capability_status.code <> 'UNAVAILABLE'
                  join ${cleaningItemTypeMeasurementModes} line_measurement_support
                    on line_measurement_support.item_type_id = line_item_type.id
                   and line_measurement_support.measurement_mode_id = line_measurement.id
                  where request_item.id = line.request_item_id
                    and request_item.request_id = ${input.requestId}::uuid
                    and request_item.service_id is not distinct from line.service_id
                    and request_item.cleaning_item_type_id is not distinct from line.cleaning_item_type_id
                    and request_item.measurement_mode_id is not distinct from line.measurement_mode_id
                    and request_item.quantity = line.quantity
                    and line.measurement_snapshot = jsonb_build_object(
                      'areaHundredthsM2', request_item.area_hundredths_m2,
                      'seatCount', request_item.seat_count,
                      'sides', request_item.sides
                    )
                )
            ) as valid
        from line_input
      ),
      next_version as materialized (
        select coalesce(max(quote_record.quote_version), 0) + 1 as value
        from ${quotes} quote_record
        where quote_record.request_id = ${input.requestId}::uuid
      ),
      decision as materialized (
        select case
          when not exists (select 1 from target_request)
            then 'NOT_FOUND_OR_FORBIDDEN'
          when (select version from target_request) <> ${input.expectedRequestVersion}
            then 'CONFLICT'
          when (select status from target_request) not in ('READY_TO_QUOTE', 'QUOTED')
            then 'INVALID_TRANSITION'
          when (select customer_id from target_request) is null
            or not exists (select 1 from commercial_context)
            or not exists (select 1 from selected_estimate)
            or not (select valid from line_validation)
            then 'INVALID_REFERENCE'
          when not exists (
            select 1
            from current_estimate_semantics, selected_estimate
            where current_estimate_semantics.customer_segment
                = (selected_estimate.input_snapshot ->> 'customerSegment')
              and current_estimate_semantics.travel_zone_code
                = (selected_estimate.input_snapshot ->> 'travelZoneCode')
          ) then 'CONFLICT'
          else 'CREATED'
        end as result
      ),
      created as (
        insert into ${quotes} (
          quote_reference, request_id, customer_id, property_id, estimate_id,
          source_request_version, quote_version, record_version, status,
          currency, price_basis,
          net_amount_minor_units, vat_rate_basis_points,
          vat_amount_minor_units, gross_total_minor_units,
          estimated_duration_minutes, commercial_snapshot, terms_snapshot,
          valid_from, valid_until, staff_notes, customer_notes,
          created_by_profile_id, updated_by_profile_id
        )
        select ${input.quoteReference}, target_request.id,
          target_request.customer_id, target_request.property_id,
          selected_estimate.id, target_request.version,
          next_version.value, 1, 'DRAFT',
          ${input.currency}, ${input.priceBasis},
          ${input.netAmountMinorUnits}, ${input.vatRateBasisPoints},
          ${input.vatAmountMinorUnits}, ${input.grossTotalMinorUnits},
          ${input.estimatedDurationMinutes},
          ${jsonParameter(input.commercialSnapshot)}::jsonb,
          ${jsonParameter(input.termsSnapshot)}::jsonb,
          ${input.validFrom}::timestamptz, ${input.validUntil}::timestamptz,
          ${input.staffNotes}, ${input.customerNotes},
          ${actorProfileId}::uuid, ${actorProfileId}::uuid
        from target_request, selected_estimate, next_version, decision
        where decision.result = 'CREATED'
        returning id, quote_reference, quote_version, record_version, status
      ),
      inserted_lines as (
        insert into ${quoteItems} (
          quote_id, request_item_id, service_id, cleaning_item_type_id,
          measurement_mode_id, description_bg, description_en, quantity,
          measurement_snapshot, base_amount_minor_units,
          modifier_amount_minor_units, addon_amount_minor_units,
          net_amount_minor_units, vat_rate_basis_points,
          vat_amount_minor_units, gross_total_minor_units,
          calculation_snapshot, sort_order
        )
        select created.id, line.request_item_id, line.service_id,
          line.cleaning_item_type_id, line.measurement_mode_id,
          line.description_bg, line.description_en, line.quantity,
          line.measurement_snapshot, line.base_amount_minor_units,
          line.modifier_amount_minor_units, line.addon_amount_minor_units,
          line.net_amount_minor_units, line.vat_rate_basis_points,
          line.vat_amount_minor_units, line.gross_total_minor_units,
          line.calculation_snapshot, line.sort_order
        from created
        cross join line_input line
        returning id
      ),
      audited as (
        insert into ${businessAuditEvents} (
          entity_type, entity_id, event_type, actor_profile_id, source,
          safe_metadata
        )
        select 'QUOTE', created.id, 'QUOTE_DRAFT_CREATED',
          ${actorProfileId}::uuid, 'STAFF',
          jsonb_build_object(
            'requestId', ${input.requestId}::uuid,
            'quoteVersion', created.quote_version,
            'itemCount', ${input.items.length}::integer
          )
        from created
        where (select count(*) from inserted_lines) = ${input.items.length}
        returning id
      )
      select decision.result::text as result, created.id,
        created.quote_reference as "quoteReference",
        created.quote_version as "quoteVersion",
        created.record_version as "recordVersion",
        created.status as "quoteStatus"
      from decision
      left join created on true
    `);
    return quoteMutationResult(result.rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "CONFLICT" };
    throw error;
  }
}

export async function updateQuoteDraftRecord(
  database: Database,
  actorProfileId: string,
  input: UpdateQuoteDraftInput,
): Promise<QuoteMutationResult> {
  const lineJson = quoteItemsParameter(input.items);
  const result = await database.execute<QuoteMutationRow>(sql`
    with target as materialized (
      select quote_record.id, quote_record.quote_reference,
        quote_record.quote_version, quote_record.record_version,
        quote_record.status, quote_record.request_id,
        request.version as request_version,
        request.status as request_status,
        request.customer_id, request.property_id
      from ${quotes} quote_record
      join ${serviceRequests} request on request.id = quote_record.request_id
      where quote_record.id = ${input.quoteId}::uuid
        and ${staffRequestManageSql(actorProfileId)}
      for update of quote_record, request
    ),
    commercial_context as materialized (
      select customer.id as customer_id, property.id as property_id,
        property.service_zone_id,
        ${commercialCustomerSegmentSql(sql`customer.customer_type`)} as customer_segment
      from target
      join ${customers} customer
        on customer.id = target.customer_id
       and customer.status = 'ACTIVE'
      join ${properties} property
        on property.id = target.property_id
       and property.customer_id = customer.id
       and property.status = 'ACTIVE'
      for share of customer, property
    ),
    travel_context as materialized (
      select zone.code as travel_zone_code
      from commercial_context
      join ${travelZoneRecords} zone
        on zone.id = commercial_context.service_zone_id
       and zone.active = true
       and zone.code in (
         'SOFIA_CORE', 'SOFIA_EXTENDED', 'SOFIA_OUTSKIRTS', 'OUTSIDE_SOFIA'
       )
      for share of zone
    ),
    current_estimate_semantics as materialized (
      select commercial_context.customer_segment,
        travel_context.travel_zone_code
      from commercial_context, travel_context
    ),
    selected_estimate as materialized (
      select estimate.id, estimate.input_snapshot
      from ${requestEstimates} estimate
      join target on target.request_id = estimate.request_id
      where estimate.id = ${input.estimateId}::uuid
        and estimate.source_request_version = target.request_version
        and estimate.decline_or_refer_required = false
    ),
    line_input as materialized (
      select * from ${quoteLineRecordset(lineJson)}
    ),
    line_validation as materialized (
      select
        count(*) = ${input.items.length}
          and count(request_item_id) = ${input.items.length}
          and count(distinct request_item_id) = ${input.items.length}
          and count(distinct sort_order) = ${input.items.length}
          and (
            select count(*) from ${serviceRequestItems} request_item
            cross join target
            where request_item.request_id = target.request_id
          ) = ${input.items.length}
          and coalesce(sum(net_amount_minor_units), 0) = ${input.netAmountMinorUnits}
          and coalesce(sum(vat_amount_minor_units), 0) = ${input.vatAmountMinorUnits}
          and coalesce(sum(gross_total_minor_units), 0) = ${input.grossTotalMinorUnits}
          and not exists (
            select 1 from line_input line
            cross join target
            where not exists (
                select 1 from ${serviceRequestItems} request_item
                join ${services} line_service
                  on line_service.id = request_item.service_id
                 and line_service.active = true
                join ${cleaningItemTypes} line_item_type
                  on line_item_type.id = request_item.cleaning_item_type_id
                 and line_item_type.active = true
                join ${measurementModes} line_measurement
                  on line_measurement.id = request_item.measurement_mode_id
                 and line_measurement.active = true
                join ${serviceItemCapabilities} line_capability
                  on line_capability.service_id = line_service.id
                 and line_capability.item_type_id = line_item_type.id
                join ${capabilityStatuses} line_capability_status
                  on line_capability_status.id = line_capability.status_id
                 and line_capability_status.active = true
                 and line_capability_status.code <> 'UNAVAILABLE'
                join ${cleaningItemTypeMeasurementModes} line_measurement_support
                  on line_measurement_support.item_type_id = line_item_type.id
                 and line_measurement_support.measurement_mode_id = line_measurement.id
                where request_item.id = line.request_item_id
                  and request_item.request_id = target.request_id
                  and request_item.service_id is not distinct from line.service_id
                  and request_item.cleaning_item_type_id is not distinct from line.cleaning_item_type_id
                  and request_item.measurement_mode_id is not distinct from line.measurement_mode_id
                  and request_item.quantity = line.quantity
                  and line.measurement_snapshot = jsonb_build_object(
                    'areaHundredthsM2', request_item.area_hundredths_m2,
                    'seatCount', request_item.seat_count,
                    'sides', request_item.sides
                  )
              )
          ) as valid
      from line_input
    ),
    decision as materialized (
      select case
        when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
        when (select record_version from target) <> ${input.expectedRecordVersion}
          then 'CONFLICT'
        when (select request_version from target) <> ${input.expectedRequestVersion}
          then 'CONFLICT'
        when (select status from target) <> 'DRAFT' then 'INVALID_TRANSITION'
        when (select request_status from target) not in ('READY_TO_QUOTE', 'QUOTED')
          then 'INVALID_TRANSITION'
        when not exists (select 1 from commercial_context)
          or not exists (select 1 from selected_estimate)
          or not (select valid from line_validation) then 'INVALID_REFERENCE'
        when not exists (
          select 1
          from current_estimate_semantics, selected_estimate
          where current_estimate_semantics.customer_segment
              = (selected_estimate.input_snapshot ->> 'customerSegment')
            and current_estimate_semantics.travel_zone_code
              = (selected_estimate.input_snapshot ->> 'travelZoneCode')
        ) then 'CONFLICT'
        else 'CHANGED'
      end as result
    ),
    deleted_lines as (
      delete from ${quoteItems} existing_line
      using target, decision
      where existing_line.quote_id = target.id
        and decision.result = 'CHANGED'
      returning existing_line.id
    ),
    changed as (
      update ${quotes} quote_record
      set estimate_id = selected_estimate.id,
        source_request_version = target.request_version,
        currency = ${input.currency},
        price_basis = ${input.priceBasis},
        net_amount_minor_units = ${input.netAmountMinorUnits},
        vat_rate_basis_points = ${input.vatRateBasisPoints},
        vat_amount_minor_units = ${input.vatAmountMinorUnits},
        gross_total_minor_units = ${input.grossTotalMinorUnits},
        estimated_duration_minutes = ${input.estimatedDurationMinutes},
        commercial_snapshot = ${jsonParameter(input.commercialSnapshot)}::jsonb,
        terms_snapshot = ${jsonParameter(input.termsSnapshot)}::jsonb,
        valid_from = ${input.validFrom}::timestamptz,
        valid_until = ${input.validUntil}::timestamptz,
        staff_notes = ${input.staffNotes},
        customer_notes = ${input.customerNotes},
        record_version = quote_record.record_version + 1,
        updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from selected_estimate, decision, target
      where quote_record.id = ${input.quoteId}::uuid
        and quote_record.record_version = ${input.expectedRecordVersion}
        and quote_record.status = 'DRAFT'
        and decision.result = 'CHANGED'
        and (select count(*) from deleted_lines) >= 0
      returning quote_record.id, quote_record.quote_reference,
        quote_record.quote_version, quote_record.record_version,
        quote_record.status
    ),
    inserted_lines as (
      insert into ${quoteItems} (
        quote_id, request_item_id, service_id, cleaning_item_type_id,
        measurement_mode_id, description_bg, description_en, quantity,
        measurement_snapshot, base_amount_minor_units,
        modifier_amount_minor_units, addon_amount_minor_units,
        net_amount_minor_units, vat_rate_basis_points,
        vat_amount_minor_units, gross_total_minor_units,
        calculation_snapshot, sort_order
      )
      select changed.id, line.request_item_id, line.service_id,
        line.cleaning_item_type_id, line.measurement_mode_id,
        line.description_bg, line.description_en, line.quantity,
        line.measurement_snapshot, line.base_amount_minor_units,
        line.modifier_amount_minor_units, line.addon_amount_minor_units,
        line.net_amount_minor_units, line.vat_rate_basis_points,
        line.vat_amount_minor_units, line.gross_total_minor_units,
        line.calculation_snapshot, line.sort_order
      from changed
      cross join line_input line
      returning id
    ),
    audited as (
      insert into ${businessAuditEvents} (
        entity_type, entity_id, event_type, actor_profile_id, source,
        safe_metadata
      )
      select 'QUOTE', changed.id, 'QUOTE_DRAFT_UPDATED',
        ${actorProfileId}::uuid, 'STAFF',
        jsonb_build_object(
          'quoteVersion', changed.quote_version,
          'recordVersion', changed.record_version,
          'itemCount', ${input.items.length}::integer
        )
      from changed
      where (select count(*) from inserted_lines) = ${input.items.length}
      returning id
    )
    select decision.result::text as result,
      coalesce(changed.id, target.id) as id,
      coalesce(changed.quote_reference, target.quote_reference) as "quoteReference",
      coalesce(changed.quote_version, target.quote_version) as "quoteVersion",
      coalesce(changed.record_version, target.record_version) as "recordVersion",
      coalesce(changed.status, target.status) as "quoteStatus"
    from decision
    left join target on true
    left join changed on true
  `);
  return quoteMutationResult(result.rows[0]);
}

export async function issueQuoteRecord(
  database: Database,
  actorProfileId: string,
  input: QuoteLifecycleInput,
): Promise<QuoteMutationResult> {
  try {
    const result = await database.execute<QuoteMutationRow>(sql`
      with target as materialized (
        select quote_record.id, quote_record.quote_reference,
          quote_record.quote_version, quote_record.record_version,
          quote_record.status, quote_record.request_id,
          request.status as request_status,
          request.version as request_version,
          quote_record.source_request_version,
          quote_record.estimate_id,
          request.customer_id, request.property_id,
          quote_record.valid_from,
          quote_record.valid_until
        from ${quotes} quote_record
        join ${serviceRequests} request on request.id = quote_record.request_id
        where quote_record.id = ${input.quoteId}::uuid
          and ${staffRequestManageSql(actorProfileId)}
        for update of request, quote_record
      ),
      commercial_context as materialized (
        select customer.id as customer_id, property.id as property_id,
          property.service_zone_id,
          ${commercialCustomerSegmentSql(sql`customer.customer_type`)} as customer_segment
        from target
        join ${customers} customer
          on customer.id = target.customer_id
         and customer.status = 'ACTIVE'
        join ${properties} property
          on property.id = target.property_id
         and property.customer_id = customer.id
         and property.status = 'ACTIVE'
        for share of customer, property
      ),
      travel_context as materialized (
        select zone.code as travel_zone_code
        from commercial_context
        join ${travelZoneRecords} zone
          on zone.id = commercial_context.service_zone_id
         and zone.active = true
         and zone.code in (
           'SOFIA_CORE', 'SOFIA_EXTENDED', 'SOFIA_OUTSKIRTS', 'OUTSIDE_SOFIA'
         )
        for share of zone
      ),
      current_estimate_semantics as materialized (
        select commercial_context.customer_segment,
          travel_context.travel_zone_code
        from commercial_context, travel_context
      ),
      selected_estimate as materialized (
        select estimate.input_snapshot
        from target
        join ${requestEstimates} estimate
          on estimate.id = target.estimate_id
         and estimate.request_id = target.request_id
         and estimate.source_request_version = target.request_version
         and estimate.decline_or_refer_required = false
      ),
      request_item_count as materialized (
        select count(*)::integer as value
        from ${serviceRequestItems} request_item
        join target on target.request_id = request_item.request_id
      ),
      current_catalogue_items as materialized (
        select request_item.id
        from target
        join ${serviceRequestItems} request_item
          on request_item.request_id = target.request_id
        join ${services} line_service
          on line_service.id = request_item.service_id
         and line_service.active = true
        join ${cleaningItemTypes} line_item_type
          on line_item_type.id = request_item.cleaning_item_type_id
         and line_item_type.active = true
        join ${measurementModes} line_measurement
          on line_measurement.id = request_item.measurement_mode_id
         and line_measurement.active = true
        join ${cleaningItemTypeMeasurementModes} line_measurement_support
          on line_measurement_support.item_type_id = line_item_type.id
         and line_measurement_support.measurement_mode_id = line_measurement.id
        join ${serviceItemCapabilities} line_capability
          on line_capability.service_id = line_service.id
         and line_capability.item_type_id = line_item_type.id
        join ${capabilityStatuses} line_capability_status
          on line_capability_status.id = line_capability.status_id
         and line_capability_status.active = true
         and line_capability_status.code <> 'UNAVAILABLE'
        join ${conditionLevels} line_condition
          on line_condition.id = coalesce(
            request_item.normalized_condition_level_id,
            request_item.customer_reported_condition_level_id
          )
         and line_condition.active = true
        for share of line_service, line_item_type, line_measurement,
          line_measurement_support, line_capability, line_capability_status,
          line_condition
      ),
      current_fibres as materialized (
        select request_item.id
        from target
        join ${serviceRequestItems} request_item
          on request_item.request_id = target.request_id
         and coalesce(
           request_item.normalized_fibre_material_id,
           request_item.reported_fibre_material_id
         ) is not null
        join ${fibreMaterials} line_fibre
          on line_fibre.id = coalesce(
            request_item.normalized_fibre_material_id,
            request_item.reported_fibre_material_id
          )
         and line_fibre.active = true
        for share of line_fibre
      ),
      current_surfaces as materialized (
        select request_item.id
        from target
        join ${serviceRequestItems} request_item
          on request_item.request_id = target.request_id
         and coalesce(
           request_item.normalized_surface_construction_id,
           request_item.reported_surface_construction_id
         ) is not null
        join ${surfaceConstructions} line_surface
          on line_surface.id = coalesce(
            request_item.normalized_surface_construction_id,
            request_item.reported_surface_construction_id
          )
         and line_surface.active = true
        for share of line_surface
      ),
      current_assets as materialized (
        select request_item.id
        from target
        join ${serviceRequestItems} request_item
          on request_item.request_id = target.request_id
         and request_item.cleaning_asset_id is not null
        join ${cleaningAssets} line_asset
          on line_asset.id = request_item.cleaning_asset_id
         and line_asset.property_id = target.property_id
         and line_asset.status = 'ACTIVE'
        for share of line_asset
      ),
      current_issues as materialized (
        select selected_issue.request_item_id, selected_issue.issue_type_id
        from target
        join ${serviceRequestItems} request_item
          on request_item.request_id = target.request_id
        join ${serviceRequestItemIssues} selected_issue
          on selected_issue.request_item_id = request_item.id
         and selected_issue.staff_confirmed = true
        join ${issueTypes} line_issue
          on line_issue.id = selected_issue.issue_type_id
         and line_issue.active = true
        for share of line_issue
      ),
      current_addons as materialized (
        select selected_addon.request_item_id, selected_addon.addon_id
        from target
        join ${serviceRequestItems} request_item
          on request_item.request_id = target.request_id
        join ${serviceRequestItemAddons} selected_addon
          on selected_addon.request_item_id = request_item.id
         and selected_addon.staff_included = true
        join ${serviceAddons} line_addon
          on line_addon.id = selected_addon.addon_id
         and line_addon.active = true
        join ${serviceAddonCapabilities} line_addon_capability
          on line_addon_capability.service_id = request_item.service_id
         and line_addon_capability.addon_id = line_addon.id
        join ${capabilityStatuses} line_addon_status
          on line_addon_status.id = line_addon_capability.status_id
         and line_addon_status.active = true
         and line_addon_status.code <> 'UNAVAILABLE'
        for share of line_addon, line_addon_capability, line_addon_status
      ),
      current_request_graph as materialized (
        select 1 as valid
        where (select value from request_item_count) > 0
          and (select count(*) from current_catalogue_items)
            = (select value from request_item_count)
          and (select count(*) from current_fibres) = (
            select count(*)
            from ${serviceRequestItems} request_item
            join target on target.request_id = request_item.request_id
            where coalesce(
              request_item.normalized_fibre_material_id,
              request_item.reported_fibre_material_id
            ) is not null
          )
          and (select count(*) from current_surfaces) = (
            select count(*)
            from ${serviceRequestItems} request_item
            join target on target.request_id = request_item.request_id
            where coalesce(
              request_item.normalized_surface_construction_id,
              request_item.reported_surface_construction_id
            ) is not null
          )
          and (select count(*) from current_assets) = (
            select count(*)
            from ${serviceRequestItems} request_item
            join target on target.request_id = request_item.request_id
            where request_item.cleaning_asset_id is not null
          )
          and (select count(*) from current_issues) = (
            select count(*)
            from ${serviceRequestItemIssues} selected_issue
            join ${serviceRequestItems} request_item
              on request_item.id = selected_issue.request_item_id
            join target on target.request_id = request_item.request_id
            where selected_issue.staff_confirmed = true
          )
          and (select count(*) from current_addons) = (
            select count(*)
            from ${serviceRequestItemAddons} selected_addon
            join ${serviceRequestItems} request_item
              on request_item.id = selected_addon.request_item_id
            join target on target.request_id = request_item.request_id
            where selected_addon.staff_included = true
          )
      ),
      active_issued as materialized (
        select current_quote.id, current_quote.quote_version,
          current_quote.record_version
        from ${quotes} current_quote
        join target on target.request_id = current_quote.request_id
        where current_quote.status = 'ISSUED'
          and current_quote.id <> target.id
        for update of current_quote
      ),
      request_quote_versions as materialized (
        select current_quote.id, current_quote.quote_version
        from ${quotes} current_quote
        join target on target.request_id = current_quote.request_id
        for update of current_quote
      ),
      latest_quote_version as materialized (
        select max(quote_version) as value
        from request_quote_versions
      ),
      decision as materialized (
        select case
          when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
          when (select status from target) = 'ISSUED' then 'NO_CHANGE'
          when (select record_version from target) <> ${input.expectedRecordVersion}
            then 'CONFLICT'
          when (select quote_version from target)
            <> (select value from latest_quote_version)
            then 'CONFLICT'
          when (select source_request_version from target)
            <> (select request_version from target)
            then 'CONFLICT'
          when (select status from target) <> 'DRAFT'
            or (select request_status from target) not in ('READY_TO_QUOTE', 'QUOTED')
            then 'INVALID_TRANSITION'
          when now() < (select valid_from from target)
            or now() >= (select valid_until from target)
            then 'INVALID_TRANSITION'
          when (select customer_id from target) is null
            or not exists (select 1 from commercial_context)
            or not exists (select 1 from selected_estimate)
            or not exists (select 1 from current_request_graph)
            then 'INVALID_REFERENCE'
          when not exists (
            select 1
            from current_estimate_semantics, selected_estimate
            where current_estimate_semantics.customer_segment
                = (selected_estimate.input_snapshot ->> 'customerSegment')
              and current_estimate_semantics.travel_zone_code
                = (selected_estimate.input_snapshot ->> 'travelZoneCode')
          ) then 'CONFLICT'
          else 'CHANGED'
        end as result
      ),
      superseded as (
        update ${quotes} current_quote
        set status = 'SUPERSEDED', superseded_at = now(),
          record_version = current_quote.record_version + 1,
          updated_at = now(),
          updated_by_profile_id = ${actorProfileId}::uuid
        from active_issued, decision
        where current_quote.id = active_issued.id
          and current_quote.status = 'ISSUED'
          and decision.result = 'CHANGED'
        returning current_quote.id, current_quote.quote_version
      ),
      issued as (
        update ${quotes} quote_record
        set status = 'ISSUED', issued_at = now(),
          record_version = quote_record.record_version + 1,
          updated_at = now(),
          updated_by_profile_id = ${actorProfileId}::uuid
        from decision
        where quote_record.id = ${input.quoteId}::uuid
          and quote_record.status = 'DRAFT'
          and quote_record.record_version = ${input.expectedRecordVersion}
          and decision.result = 'CHANGED'
          and (select count(*) from superseded) >= 0
        returning quote_record.id, quote_record.quote_reference,
          quote_record.quote_version, quote_record.record_version,
          quote_record.status, quote_record.request_id
      ),
      request_changed as (
        update ${serviceRequests} request
        set status = 'QUOTED', manual_review_required = false,
          version = request.version + 1,
          updated_at = now(),
          updated_by_profile_id = ${actorProfileId}::uuid
        from issued
        where request.id = issued.request_id
          and request.status in ('READY_TO_QUOTE', 'QUOTED')
        returning request.id
      ),
      request_audit as (
        insert into ${businessAuditEvents} (
          entity_type, entity_id, event_type, actor_profile_id, source,
          safe_metadata
        )
        select 'SERVICE_REQUEST', request_changed.id,
          'REQUEST_STATUS_CHANGED', ${actorProfileId}::uuid, 'STAFF',
          jsonb_build_object('from', 'READY_TO_QUOTE', 'to', 'QUOTED')
        from request_changed, target
        where target.request_status = 'READY_TO_QUOTE'
        returning id
      ),
      superseded_audit as (
        insert into ${businessAuditEvents} (
          entity_type, entity_id, event_type, actor_profile_id, source,
          safe_metadata
        )
        select 'QUOTE', superseded.id, 'QUOTE_SUPERSEDED',
          ${actorProfileId}::uuid, 'STAFF',
          jsonb_build_object('quoteVersion', superseded.quote_version)
        from superseded
        returning id
      ),
      issued_audit as (
        insert into ${businessAuditEvents} (
          entity_type, entity_id, event_type, actor_profile_id, source,
          safe_metadata
        )
        select 'QUOTE', issued.id, 'QUOTE_ISSUED',
          ${actorProfileId}::uuid, 'STAFF',
          jsonb_build_object(
            'quoteVersion', issued.quote_version,
            'supersededCount', (select count(*) from superseded_audit)
          )
        from issued
        where exists (select 1 from request_changed)
          and (select count(*) from request_audit) >= 0
        returning id
      )
      select decision.result::text as result,
        coalesce(issued.id, target.id) as id,
        coalesce(issued.quote_reference, target.quote_reference) as "quoteReference",
        coalesce(issued.quote_version, target.quote_version) as "quoteVersion",
        coalesce(issued.record_version, target.record_version) as "recordVersion",
        coalesce(issued.status, target.status) as "quoteStatus"
      from decision
      left join target on true
      left join issued on true
    `);
    return quoteMutationResult(result.rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "CONFLICT" };
    throw error;
  }
}

export async function withdrawQuoteRecord(
  database: Database,
  actorProfileId: string,
  input: QuoteLifecycleInput,
): Promise<QuoteMutationResult> {
  const result = await database.execute<QuoteMutationRow>(sql`
    with target as materialized (
      select quote_record.id, quote_record.quote_reference,
        quote_record.quote_version, quote_record.record_version,
        quote_record.status, quote_record.request_id,
        request.status as request_status
      from ${quotes} quote_record
      join ${serviceRequests} request on request.id = quote_record.request_id
      where quote_record.id = ${input.quoteId}::uuid
        and ${staffRequestManageSql(actorProfileId)}
      for update of request, quote_record
    ),
    decision as materialized (
      select case
        when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
        when (select status from target) = 'WITHDRAWN' then 'NO_CHANGE'
        when (select record_version from target) <> ${input.expectedRecordVersion}
          then 'CONFLICT'
        when (select status from target) <> 'ISSUED'
          or (select request_status from target) <> 'QUOTED'
          then 'INVALID_TRANSITION'
        else 'CHANGED'
      end as result
    ),
    changed as (
      update ${quotes} quote_record
      set status = 'WITHDRAWN', withdrawn_at = now(),
        record_version = quote_record.record_version + 1,
        updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from decision
      where quote_record.id = ${input.quoteId}::uuid
        and quote_record.status = 'ISSUED'
        and quote_record.record_version = ${input.expectedRecordVersion}
        and decision.result = 'CHANGED'
      returning quote_record.id, quote_record.quote_reference,
        quote_record.quote_version, quote_record.record_version,
        quote_record.status, quote_record.request_id
    ),
    request_changed as (
      update ${serviceRequests} request
      set status = 'READY_TO_QUOTE', manual_review_required = false,
        version = request.version + 1,
        updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from changed
      where request.id = changed.request_id
        and request.status = 'QUOTED'
      returning request.id
    ),
    quote_audit as (
      insert into ${businessAuditEvents} (
        entity_type, entity_id, event_type, actor_profile_id, source,
        safe_metadata
      )
      select 'QUOTE', changed.id, 'QUOTE_WITHDRAWN',
        ${actorProfileId}::uuid, 'STAFF',
        jsonb_build_object('quoteVersion', changed.quote_version)
      from changed
      where exists (select 1 from request_changed)
      returning id
    ),
    request_audit as (
      insert into ${businessAuditEvents} (
        entity_type, entity_id, event_type, actor_profile_id, source,
        safe_metadata
      )
      select 'SERVICE_REQUEST', request_changed.id,
        'REQUEST_STATUS_CHANGED', ${actorProfileId}::uuid, 'STAFF',
        jsonb_build_object(
          'from', 'QUOTED',
          'to', 'READY_TO_QUOTE',
          'cause', 'ACTIVE_QUOTE_BECAME_INACTIVE'
        )
      from request_changed
      where exists (select 1 from quote_audit)
      returning id
    )
    select decision.result::text as result,
      coalesce(changed.id, target.id) as id,
      coalesce(changed.quote_reference, target.quote_reference) as "quoteReference",
      coalesce(changed.quote_version, target.quote_version) as "quoteVersion",
      coalesce(changed.record_version, target.record_version) as "recordVersion",
      coalesce(changed.status, target.status) as "quoteStatus"
    from decision
    left join target on true
    left join changed on true
  `);
  return quoteMutationResult(result.rows[0]);
}

export async function expireQuoteRecord(
  database: Database,
  actorProfileId: string,
  input: QuoteLifecycleInput,
): Promise<QuoteMutationResult> {
  const result = await database.execute<QuoteMutationRow>(sql`
    with target as materialized (
      select quote_record.id, quote_record.quote_reference,
        quote_record.quote_version, quote_record.record_version,
        quote_record.status, quote_record.request_id,
        quote_record.valid_until, request.status as request_status
      from ${quotes} quote_record
      join ${serviceRequests} request on request.id = quote_record.request_id
      where quote_record.id = ${input.quoteId}::uuid
        and ${staffRequestManageSql(actorProfileId)}
      for update of request, quote_record
    ),
    decision as materialized (
      select case
        when not exists (select 1 from target) then 'NOT_FOUND_OR_FORBIDDEN'
        when (select status from target) = 'EXPIRED' then 'NO_CHANGE'
        when (select record_version from target) <> ${input.expectedRecordVersion}
          then 'CONFLICT'
        when (select status from target) <> 'ISSUED'
          or (select request_status from target) <> 'QUOTED'
          or (select valid_until from target) > now()
          then 'INVALID_TRANSITION'
        else 'CHANGED'
      end as result
    ),
    changed as (
      update ${quotes} quote_record
      set status = 'EXPIRED', expired_at = now(),
        record_version = quote_record.record_version + 1,
        updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from decision
      where quote_record.id = ${input.quoteId}::uuid
        and quote_record.status = 'ISSUED'
        and quote_record.record_version = ${input.expectedRecordVersion}
        and quote_record.valid_until <= now()
        and decision.result = 'CHANGED'
      returning quote_record.id, quote_record.quote_reference,
        quote_record.quote_version, quote_record.record_version,
        quote_record.status, quote_record.request_id
    ),
    request_changed as (
      update ${serviceRequests} request
      set status = 'READY_TO_QUOTE', manual_review_required = false,
        version = request.version + 1,
        updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from changed
      where request.id = changed.request_id
        and request.status = 'QUOTED'
      returning request.id
    ),
    quote_audit as (
      insert into ${businessAuditEvents} (
        entity_type, entity_id, event_type, actor_profile_id, source,
        safe_metadata
      )
      select 'QUOTE', changed.id, 'QUOTE_EXPIRED',
        ${actorProfileId}::uuid, 'STAFF',
        jsonb_build_object('quoteVersion', changed.quote_version)
      from changed
      where exists (select 1 from request_changed)
      returning id
    ),
    request_audit as (
      insert into ${businessAuditEvents} (
        entity_type, entity_id, event_type, actor_profile_id, source,
        safe_metadata
      )
      select 'SERVICE_REQUEST', request_changed.id,
        'REQUEST_STATUS_CHANGED', ${actorProfileId}::uuid, 'STAFF',
        jsonb_build_object(
          'from', 'QUOTED',
          'to', 'READY_TO_QUOTE',
          'cause', 'ACTIVE_QUOTE_BECAME_INACTIVE'
        )
      from request_changed
      where exists (select 1 from quote_audit)
      returning id
    )
    select decision.result::text as result,
      coalesce(changed.id, target.id) as id,
      coalesce(changed.quote_reference, target.quote_reference) as "quoteReference",
      coalesce(changed.quote_version, target.quote_version) as "quoteVersion",
      coalesce(changed.record_version, target.record_version) as "recordVersion",
      coalesce(changed.status, target.status) as "quoteStatus"
    from decision
    left join target on true
    left join changed on true
  `);
  return quoteMutationResult(result.rows[0]);
}

export interface RequestQuoteRepository {
  createPublicCodeRequest(
    input: CreatePublicCodeRequestInput,
  ): Promise<RequestCreateResult>;
  createCustomerRequest(
    actorProfileId: string,
    input: Omit<CreateRequestRecordInput, "source" | "requestingProfileId">,
  ): Promise<RequestCreateResult>;
  createStaffRequest(
    actorProfileId: string,
    input: Omit<CreateRequestRecordInput, "source" | "requestingProfileId">,
  ): Promise<RequestCreateResult>;
  listStaffRequests(
    actorProfileId: string,
    input: StaffRequestListInput,
  ): Promise<StaffRequestPage>;
  getStaffRequest(
    actorProfileId: string,
    requestId: string,
  ): Promise<StaffRequestDetail | null>;
  listCustomerRequests(
    actorProfileId: string,
  ): Promise<readonly CustomerRequestSummary[]>;
  getCustomerRequest(
    actorProfileId: string,
    requestReference: string,
  ): Promise<CustomerRequestDetail | null>;
  listCustomerQuotes(
    actorProfileId: string,
  ): Promise<readonly CustomerQuoteSummary[]>;
  getCustomerQuote(
    actorProfileId: string,
    quoteReference: string,
  ): Promise<CustomerQuoteDetail | null>;
  linkRequest(
    actorProfileId: string,
    input: LinkRequestInput,
  ): Promise<RequestMutationResult>;
  setRequestResolution(
    actorProfileId: string,
    input: SetRequestResolutionInput,
  ): Promise<RequestMutationResult>;
  createCustomerFromRequest(
    actorProfileId: string,
    input: CreateCustomerFromRequestInput,
  ): Promise<RequestMutationResult>;
  normalizeRequest(
    actorProfileId: string,
    input: NormalizeRequestInput,
  ): Promise<RequestMutationResult>;
  transitionRequest(
    actorProfileId: string,
    input: TransitionRequestInput,
  ): Promise<RequestMutationResult>;
  appendEstimate(
    actorProfileId: string,
    input: AppendEstimateInput,
  ): Promise<CreateEstimateRecordResult>;
  deriveEstimateEngineInput(
    actorProfileId: string,
    requestId: string,
    expectedRequestVersion: number,
  ): Promise<DerivedEstimateInputResult>;
  createQuoteDraft(
    actorProfileId: string,
    input: CreateQuoteDraftInput,
  ): Promise<QuoteMutationResult>;
  updateQuoteDraft(
    actorProfileId: string,
    input: UpdateQuoteDraftInput,
  ): Promise<QuoteMutationResult>;
  issueQuote(
    actorProfileId: string,
    input: QuoteLifecycleInput,
  ): Promise<QuoteMutationResult>;
  withdrawQuote(
    actorProfileId: string,
    input: QuoteLifecycleInput,
  ): Promise<QuoteMutationResult>;
  expireQuote(
    actorProfileId: string,
    input: QuoteLifecycleInput,
  ): Promise<QuoteMutationResult>;
}

export function createDatabaseRequestQuoteRepository(
  database: Database,
): RequestQuoteRepository {
  return {
    createPublicCodeRequest: (input) =>
      createPublicCodeRequestRecord(database, input),
    createCustomerRequest: (actorProfileId, input) =>
      createCustomerRequestRecord(database, actorProfileId, input),
    createStaffRequest: (actorProfileId, input) =>
      createStaffRequestRecord(database, actorProfileId, input),
    listStaffRequests: (actorProfileId, input) =>
      listStaffRequestRecords(database, actorProfileId, input),
    getStaffRequest: (actorProfileId, requestId) =>
      loadStaffRequestRecord(database, actorProfileId, requestId),
    listCustomerRequests: (actorProfileId) =>
      listCustomerRequestRecords(database, actorProfileId),
    getCustomerRequest: (actorProfileId, requestReference) =>
      loadCustomerRequestRecord(database, actorProfileId, requestReference),
    listCustomerQuotes: (actorProfileId) =>
      listCustomerQuoteRecords(database, actorProfileId),
    getCustomerQuote: (actorProfileId, quoteReference) =>
      loadCustomerQuoteRecord(database, actorProfileId, quoteReference),
    linkRequest: (actorProfileId, input) =>
      linkRequestRecord(database, actorProfileId, input),
    setRequestResolution: (actorProfileId, input) =>
      setRequestResolutionRecord(database, actorProfileId, input),
    createCustomerFromRequest: (actorProfileId, input) =>
      createCustomerFromRequestRecord(database, actorProfileId, input),
    normalizeRequest: (actorProfileId, input) =>
      normalizeRequestRecord(database, actorProfileId, input),
    transitionRequest: (actorProfileId, input) =>
      transitionRequestRecord(database, actorProfileId, input),
    appendEstimate: (actorProfileId, input) =>
      appendEstimateRecord(database, actorProfileId, input),
    deriveEstimateEngineInput: (
      actorProfileId,
      requestId,
      expectedRequestVersion,
    ) =>
      deriveEstimateEngineInputRecord(
        database,
        actorProfileId,
        requestId,
        expectedRequestVersion,
      ),
    createQuoteDraft: (actorProfileId, input) =>
      createQuoteDraftRecord(database, actorProfileId, input),
    updateQuoteDraft: (actorProfileId, input) =>
      updateQuoteDraftRecord(database, actorProfileId, input),
    issueQuote: (actorProfileId, input) =>
      issueQuoteRecord(database, actorProfileId, input),
    withdrawQuote: (actorProfileId, input) =>
      withdrawQuoteRecord(database, actorProfileId, input),
    expireQuote: (actorProfileId, input) =>
      expireQuoteRecord(database, actorProfileId, input),
  };
}
