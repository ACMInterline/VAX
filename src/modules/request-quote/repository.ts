import "server-only";

import { and, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  appointmentWindowCodes,
  operationsTeamCodes,
} from "@/modules/availability-engine/types";
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
import {
  adjustmentKinds,
  billingUnits,
  commercialConditionBandCodes,
  customerSegments,
  durationRuleTypes,
  priceBases,
  priceBookStatuses,
  priceRuleTypes,
  timingCategoryCodes,
  travelZoneCodes,
  vatModes,
} from "@/modules/commercial-engine/types";
import type { PermissionCode } from "@/modules/identity-access/policy";
import {
  cleaningItemTypes as catalogueItemTypes,
  fibreMaterials as catalogueFibreMaterials,
  issueTypes as catalogueIssueTypes,
  riskFlags as catalogueRiskFlags,
  serviceAddons as catalogueAddons,
  services as catalogueServices,
  treatmentLevels as catalogueTreatmentLevels,
  type CleaningItemTypeCode,
  type ConditionLevelCode,
} from "@/modules/service-catalogue/catalogue";
import {
  estimateGovernanceReviewReasonCodes,
  estimateReviewReasonCodes,
  type EstimateEngineInput,
  type StaffEstimateCalculation,
} from "./estimate";
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

/** PostgreSQL 18 core SHA-256 over the database-canonical JSONB text. */
export function priceSnapshotSha256Sql(value: SQL): SQL {
  return sql`encode(sha256(convert_to((${value})::text, 'UTF8')), 'hex')`;
}

/** Map only canonical CRM customer types to commercial-engine segments. */
function commercialCustomerSegmentSql(customerType: SQL): SQL {
  return sql`case ${customerType}
    when 'INDIVIDUAL' then 'RESIDENTIAL'
    when 'BUSINESS' then 'B2B'
    else null
  end`;
}

function exactJsonObject(value: SQL, keys: readonly string[]): SQL {
  const keyList = sql.join(
    keys.map((key) => sql`${key}`),
    sql`, `,
  );
  return sql`case
    when jsonb_typeof(${value}) = 'object'
    then (select count(*) from jsonb_object_keys(${value})) = ${keys.length}
      and ${value} ?& array[${keyList}]::text[]
    else false
  end`;
}

function jsonObjectWithAllowedKeys(
  value: SQL,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[],
): SQL {
  const requiredKeyList = sql.join(
    requiredKeys.map((key) => sql`${key}`),
    sql`, `,
  );
  const allowedKeyList = sql.join(
    [...requiredKeys, ...optionalKeys].map((key) => sql`${key}`),
    sql`, `,
  );
  return sql`case
    when jsonb_typeof(${value}) = 'object'
    then ${value} ?& array[${requiredKeyList}]::text[]
      and not exists (
        select 1 from jsonb_object_keys(${value}) object_key(key)
        where object_key.key not in (${allowedKeyList})
      )
    else false
  end`;
}

function jsonString(value: SQL, maximumLength: number): SQL {
  return sql`case
    when jsonb_typeof(${value}) = 'string'
    then length(btrim(${value} #>> '{}')) between 1 and ${maximumLength}
    else false
  end`;
}

function jsonStringIn(value: SQL, allowedValues: readonly string[]): SQL {
  const allowed = sql.join(
    allowedValues.map((candidate) => sql`${candidate}`),
    sql`, `,
  );
  return sql`case
    when jsonb_typeof(${value}) = 'string'
    then (${value} #>> '{}') in (${allowed})
    else false
  end`;
}

function jsonIsoInstant(value: SQL): SQL {
  return sql`case
    when jsonb_typeof(${value}) = 'string'
    then (${value} #>> '{}')
      ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$'
      and pg_input_is_valid(${value} #>> '{}', 'timestamp with time zone')
    else false
  end`;
}

function jsonBoolean(value: SQL): SQL {
  return sql`jsonb_typeof(${value}) = 'boolean'`;
}

function jsonInteger(
  value: SQL,
  minimum: number,
  maximum: number,
  nullable = false,
): SQL {
  const numericCheck = sql`case
    when jsonb_typeof(${value}) = 'number'
      and (${value} #>> '{}') ~ '^-?[0-9]+$'
    then (${value} #>> '{}')::numeric between ${minimum} and ${maximum}
    else false
  end`;
  return nullable
    ? sql`(jsonb_typeof(${value}) = 'null' or ${numericCheck})`
    : numericCheck;
}

/** New quote writes require resolved source VAT; historical evidence stays immutable. */
function resolvedQuoteSourceVatSql(priceSnapshot: SQL, relationalVatRate: SQL): SQL {
  const vat = sql`(${priceSnapshot} #> '{configuration,vatConfiguration}')`;
  const configuredRate = sql`(${vat} -> 'rateBasisPoints')`;
  const resultRate = sql`(${priceSnapshot} #> '{result,vatRateBasisPoints}')`;
  return sql`(
    ${jsonStringIn(sql`(${vat} -> 'mode')`, ["VAT_REGISTERED", "VAT_NOT_REGISTERED"])}
    and ${jsonInteger(configuredRate, 0, 10_000)}
    and ${jsonInteger(resultRate, 0, 10_000)}
    and ${relationalVatRate} is not null
    and ${configuredRate} = ${resultRate}
    and ${resultRate} = to_jsonb(${relationalVatRate})
    and (${vat} ->> 'mode' = 'VAT_REGISTERED' or ${configuredRate} = '0'::jsonb)
  )`;
}

function jsonStringArray(
  value: SQL,
  maximumItems: number,
  maximumStringLength: number,
): SQL {
  return sql`case
    when jsonb_typeof(${value}) = 'array'
    then jsonb_array_length(${value}) <= ${maximumItems}
      and not exists (
        select 1
        from jsonb_array_elements(${value}) element(value)
        where not (${jsonString(sql.raw("element.value"), maximumStringLength)})
      )
    else false
  end`;
}

function jsonStringArrayIn(
  value: SQL,
  maximumItems: number,
  allowedValues: readonly string[],
): SQL {
  const item = sql.raw("enum_array_item.value");
  return sql`case
    when jsonb_typeof(${value}) = 'array'
    then jsonb_array_length(${value}) <= ${maximumItems}
      and not exists (
        select 1
        from jsonb_array_elements(${value}) enum_array_item(value)
        where not (${jsonStringIn(item, allowedValues)})
      )
    else false
  end`;
}

function optionalJsonInteger(
  object: SQL,
  key: string,
  minimum: number,
  maximum: number,
): SQL {
  return sql`(not (${object} ? ${key})
    or ${jsonInteger(sql`${object} -> ${key}`, minimum, maximum)})`;
}

function optionalJsonStringIn(
  object: SQL,
  key: string,
  allowedValues: readonly string[],
): SQL {
  return sql`(not (${object} ? ${key})
    or ${jsonStringIn(sql`${object} -> ${key}`, allowedValues)})`;
}

function optionalJsonString(
  object: SQL,
  key: string,
  maximumLength: number,
): SQL {
  return sql`(not (${object} ? ${key})
    or ${jsonString(sql`${object} -> ${key}`, maximumLength)})`;
}

function optionalJsonBoolean(object: SQL, key: string): SQL {
  return sql`(not (${object} ? ${key})
    or ${jsonBoolean(sql`${object} -> ${key}`)})`;
}

function optionalNullableJsonInteger(
  object: SQL,
  key: string,
  minimum: number,
  maximum: number,
): SQL {
  return sql`(not (${object} ? ${key})
    or ${jsonInteger(sql`${object} -> ${key}`, minimum, maximum, true)})`;
}

function nullableJsonString(value: SQL, maximumLength: number): SQL {
  return sql`(jsonb_typeof(${value}) = 'null'
    or ${jsonString(value, maximumLength)})`;
}

const catalogueServiceCodes = catalogueServices.map((entry) => entry.code);
const catalogueItemTypeCodes = catalogueItemTypes.map((entry) => entry.code);
const catalogueIssueCodes = catalogueIssueTypes.map((entry) => entry.code);
const catalogueAddonCodes = catalogueAddons.map((entry) => entry.code);
const catalogueRiskCodes = catalogueRiskFlags.map((entry) => entry.code);
const catalogueFibreCodes = catalogueFibreMaterials.map((entry) => entry.code);
const catalogueTreatmentCodes = catalogueTreatmentLevels.map(
  (entry) => entry.code,
);

function estimateInputItemsAreWellFormed(value: SQL): SQL {
  const item = sql.raw("estimate_input_item.value");
  return sql`case
    when jsonb_typeof(${value}) = 'array'
    then jsonb_array_length(${value}) between 1 and 50
      and not exists (
        select 1
        from jsonb_array_elements(${value}) estimate_input_item(value)
        where not (
          ${jsonObjectWithAllowedKeys(
            item,
            [
              "serviceCode",
              "itemTypeCode",
              "quantity",
              "issueCodes",
              "addonCodes",
              "riskFlagCodes",
            ],
            [
              "areaHundredthsM2",
              "seatCount",
              "sides",
              "fibreMaterialCode",
              "treatmentLevelCode",
            ],
          )}
          and ${jsonStringIn(sql`${item} -> 'serviceCode'`, catalogueServiceCodes)}
          and ${jsonStringIn(sql`${item} -> 'itemTypeCode'`, catalogueItemTypeCodes)}
          and ${jsonInteger(sql`${item} -> 'quantity'`, 1, 100_000)}
          and ${optionalJsonInteger(item, "areaHundredthsM2", 1, 100_000_000)}
          and ${optionalJsonInteger(item, "seatCount", 1, 10_000)}
          and ${optionalJsonInteger(item, "sides", 1, 2)}
          and ${jsonStringArrayIn(sql`${item} -> 'issueCodes'`, 100, catalogueIssueCodes)}
          and ${jsonStringArrayIn(sql`${item} -> 'addonCodes'`, 100, catalogueAddonCodes)}
          and ${jsonStringArrayIn(sql`${item} -> 'riskFlagCodes'`, 100, catalogueRiskCodes)}
          and ${optionalJsonStringIn(item, "fibreMaterialCode", catalogueFibreCodes)}
          and ${optionalJsonStringIn(item, "treatmentLevelCode", catalogueTreatmentCodes)}
        )
      )
    else false
  end`;
}

function priceLinesAreWellFormed(value: SQL): SQL {
  const line = sql.raw("price_line.value");
  return sql`case
    when jsonb_typeof(${value}) = 'array'
    then jsonb_array_length(${value}) <= 1000
      and not exists (
        select 1
        from jsonb_array_elements(${value}) price_line(value)
        where not (
          ${exactJsonObject(line, ["kind", "label", "amountMinorUnits", "ruleId"])}
          and ${jsonStringIn(sql`${line} -> 'kind'`, [
            ...priceRuleTypes,
            "MINIMUM_VISIT_ADJUSTMENT",
          ])}
          and ${jsonString(sql`${line} -> 'label'`, 255)}
          and ${jsonInteger(sql`${line} -> 'amountMinorUnits'`, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)}
          and ${jsonString(sql`${line} -> 'ruleId'`, 160)}
        )
      )
    else false
  end`;
}

function priceLineEvidenceIsConsistent(
  lines: SQL,
  result: SQL,
  configuration: SQL,
): SQL {
  const subtotal = sql`${result} ->> 'subtotalMinorUnits'`;
  const minimum = sql`${result} ->> 'minimumVisitAdjustmentMinorUnits'`;
  const net = sql`${result} ->> 'netAmountMinorUnits'`;
  const vatRate = sql`${result} ->> 'vatRateBasisPoints'`;
  const vat = sql`${result} ->> 'vatAmountMinorUnits'`;
  const gross = sql`${result} ->> 'grossTotalMinorUnits'`;
  const manual = sql`${result} -> 'manualAssessmentRequired'`;
  const rules = sql`${configuration} -> 'rules'`;
  const configuredVat = sql`${configuration} -> 'vatConfiguration'`;
  const unresolvedVat = sql`${configuredVat} ->> 'mode' = 'VAT_UNRESOLVED'`;
  const unresolvedGrossShape = sql`${unresolvedVat}
    and ${manual} = 'true'::jsonb
    and jsonb_typeof(${result} -> 'minimumVisitAdjustmentMinorUnits') = 'number'
    and jsonb_typeof(${result} -> 'netAmountMinorUnits') = 'null'
    and jsonb_typeof(${result} -> 'vatRateBasisPoints') = 'null'
    and jsonb_typeof(${result} -> 'vatAmountMinorUnits') = 'null'
    and jsonb_typeof(${result} -> 'grossTotalMinorUnits') = 'number'`;

  return sql`case
    when jsonb_typeof(${lines}) = 'array'
      and jsonb_typeof(${rules}) = 'array'
      and jsonb_typeof(${result} -> 'appliedRuleIds') = 'array'
      and (${subtotal}) ~ '^[0-9]+$'
      and ((${vatRate}) ~ '^[0-9]+$' or ${unresolvedVat})
      and ${manual} in ('true'::jsonb, 'false'::jsonb)
      and not exists (
        select 1 from jsonb_array_elements(${lines}) price_evidence_line(value)
        where jsonb_typeof(price_evidence_line.value) <> 'object'
          or (price_evidence_line.value ->> 'amountMinorUnits')
            !~ '^-?[0-9]+$'
      )
      and case when ${unresolvedGrossShape} then
        (${minimum}) ~ '^[0-9]+$' and (${gross}) ~ '^[0-9]+$'
      when ${manual} = 'true'::jsonb then
        jsonb_typeof(${result} -> 'minimumVisitAdjustmentMinorUnits') = 'null'
          and jsonb_typeof(${result} -> 'netAmountMinorUnits') = 'null'
          and jsonb_typeof(${result} -> 'vatAmountMinorUnits') = 'null'
          and jsonb_typeof(${result} -> 'grossTotalMinorUnits') = 'null'
      else (${minimum}) ~ '^[0-9]+$'
        and (${net}) ~ '^[0-9]+$'
        and (${vat}) ~ '^[0-9]+$'
        and (${gross}) ~ '^[0-9]+$'
      end
    then
      coalesce((
        select sum((price_evidence_line.value ->> 'amountMinorUnits')::numeric)
          filter (where price_evidence_line.value ->> 'kind'
            <> 'MINIMUM_VISIT_ADJUSTMENT')
        from jsonb_array_elements(${lines}) price_evidence_line(value)
      ), 0) = (${subtotal})::numeric
      and (
        select count(*) from jsonb_array_elements(${lines}) price_minimum_line(value)
        where price_minimum_line.value ->> 'kind' = 'MINIMUM_VISIT_ADJUSTMENT'
      ) <= 1
      and coalesce((
        select sum((price_minimum_line.value ->> 'amountMinorUnits')::numeric)
        from jsonb_array_elements(${lines}) price_minimum_line(value)
        where price_minimum_line.value ->> 'kind' = 'MINIMUM_VISIT_ADJUSTMENT'
      ), 0) = case when ${manual} = 'true'::jsonb and not (${unresolvedGrossShape})
        then 0 else (${minimum})::numeric end
      and jsonb_array_length(${result} -> 'appliedRuleIds') = (
        select count(distinct applied_rule.value #>> '{}')
        from jsonb_array_elements(${result} -> 'appliedRuleIds') applied_rule(value)
      )
      and not exists (
        select 1
        from jsonb_array_elements(${result} -> 'appliedRuleIds') applied_rule(value)
        where jsonb_typeof(applied_rule.value) <> 'string'
          or not exists (
            select 1 from jsonb_array_elements(${rules}) configured_rule(value)
            where configured_rule.value -> 'id' = applied_rule.value
              and configured_rule.value -> 'active' = 'true'::jsonb
          )
      )
      and not exists (
        select 1 from jsonb_array_elements(${lines}) price_rule_line(value)
        where not (${result} -> 'appliedRuleIds'
          @> jsonb_build_array(price_rule_line.value -> 'ruleId'))
          or not exists (
            select 1 from jsonb_array_elements(${rules}) configured_rule(value)
            where configured_rule.value -> 'id' = price_rule_line.value -> 'ruleId'
              and configured_rule.value -> 'active' = 'true'::jsonb
              and (
                configured_rule.value -> 'type' = price_rule_line.value -> 'kind'
                or (
                  price_rule_line.value ->> 'kind' = 'MINIMUM_VISIT_ADJUSTMENT'
                  and configured_rule.value ->> 'type' = 'MINIMUM_VISIT'
                )
              )
          )
      )
      and ${configuredVat} -> 'rateBasisPoints'
        = ${result} -> 'vatRateBasisPoints'
      and case
        when ${unresolvedGrossShape} then
          (${gross})::numeric = (${subtotal})::numeric + (${minimum})::numeric
        when ${manual} = 'true'::jsonb then true
        when ${configuredVat} ->> 'mode' = 'VAT_NOT_REGISTERED' then
          (${net})::numeric = (${subtotal})::numeric + (${minimum})::numeric
            and (${vat})::numeric = 0
            and (${gross})::numeric = (${net})::numeric
        when ${configuration} ->> 'priceBasis' = 'GROSS' then
          (${gross})::numeric = (${subtotal})::numeric + (${minimum})::numeric
            and (${net})::numeric = round(
              (${gross})::numeric * 10000
                / (10000 + (${vatRate})::numeric)
            )
            and (${vat})::numeric = (${gross})::numeric - (${net})::numeric
        else (${net})::numeric = (${subtotal})::numeric + (${minimum})::numeric
          and (${vat})::numeric = round(
            (${net})::numeric * (${vatRate})::numeric / 10000
          )
          and (${gross})::numeric = (${net})::numeric + (${vat})::numeric
      end
    else false
  end`;
}

function durationLinesAreWellFormed(value: SQL): SQL {
  const line = sql.raw("duration_line.value");
  return sql`case
    when jsonb_typeof(${value}) = 'array'
    then jsonb_array_length(${value}) <= 1000
      and not exists (
        select 1
        from jsonb_array_elements(${value}) duration_line(value)
        where not (
          ${exactJsonObject(line, ["kind", "label", "minutes", "ruleId"])}
          and ${jsonStringIn(sql`${line} -> 'kind'`, durationRuleTypes)}
          and ${jsonString(sql`${line} -> 'label'`, 255)}
          and ${jsonInteger(sql`${line} -> 'minutes'`, 0, 1_000_000)}
          and ${jsonString(sql`${line} -> 'ruleId'`, 160)}
        )
      )
    else false
  end`;
}

function durationLineEvidenceIsConsistent(
  lines: SQL,
  result: SQL,
  configuration: SQL,
): SQL {
  const rules = sql`${configuration} -> 'rules'`;
  const appliedRuleIds = sql`${result} -> 'appliedRuleIds'`;
  const component = (key: string) => sql`${result} ->> ${key}`;
  const lineSum = (kinds: readonly string[]) => sql`coalesce((
    select sum((duration_evidence_line.value ->> 'minutes')::numeric)
    from jsonb_array_elements(${lines}) duration_evidence_line(value)
    where duration_evidence_line.value ->> 'kind' in (${sql.join(
      kinds.map((kind) => sql`${kind}`),
      sql`, `,
    )})
  ), 0)`;

  return sql`case
    when jsonb_typeof(${lines}) = 'array'
      and jsonb_typeof(${rules}) = 'array'
      and jsonb_typeof(${appliedRuleIds}) = 'array'
      and not exists (
        select 1 from jsonb_array_elements(${lines}) duration_evidence_line(value)
        where jsonb_typeof(duration_evidence_line.value) <> 'object'
          or (duration_evidence_line.value ->> 'minutes') !~ '^[0-9]+$'
          or duration_evidence_line.value ->> 'kind' not in (
            'JOB_SETUP', 'JOB_INSPECTION', 'JOB_CLEANUP', 'ITEM_BASE',
            'AREA_PRODUCTIVITY', 'CONDITION_MULTIPLIER',
            'ISSUE_COMPLEXITY', 'ADD_ON_TIME'
          )
      )
      and (${component("setupMinutes")}) ~ '^[0-9]+$'
      and (${component("inspectionMinutes")}) ~ '^[0-9]+$'
      and (${component("baseCleaningMinutes")}) ~ '^[0-9]+$'
      and (${component("modifierMinutes")}) ~ '^[0-9]+$'
      and (${component("addonMinutes")}) ~ '^[0-9]+$'
      and (${component("cleanupMinutes")}) ~ '^[0-9]+$'
    then
      ${lineSum(["JOB_SETUP"])} = (${component("setupMinutes")})::numeric
      and ${lineSum(["JOB_INSPECTION"])}
        = (${component("inspectionMinutes")})::numeric
      and ${lineSum(["ITEM_BASE", "AREA_PRODUCTIVITY"])}
        = (${component("baseCleaningMinutes")})::numeric
      and ${lineSum(["CONDITION_MULTIPLIER", "ISSUE_COMPLEXITY"])}
        = (${component("modifierMinutes")})::numeric
      and ${lineSum(["ADD_ON_TIME"])}
        = (${component("addonMinutes")})::numeric
      and ${lineSum(["JOB_CLEANUP"])}
        = (${component("cleanupMinutes")})::numeric
      and (
        select count(*) from jsonb_array_elements(${lines}) fixed_line(value)
        where fixed_line.value ->> 'kind' = 'JOB_SETUP'
      ) = 1
      and (
        select count(*) from jsonb_array_elements(${lines}) fixed_line(value)
        where fixed_line.value ->> 'kind' = 'JOB_INSPECTION'
      ) = 1
      and (
        select count(*) from jsonb_array_elements(${lines}) fixed_line(value)
        where fixed_line.value ->> 'kind' = 'JOB_CLEANUP'
      ) = 1
      and jsonb_array_length(${appliedRuleIds}) = (
        select count(distinct applied_rule.value #>> '{}')
        from jsonb_array_elements(${appliedRuleIds}) applied_rule(value)
      )
      and not exists (
        select 1 from jsonb_array_elements(${appliedRuleIds}) applied_rule(value)
        where jsonb_typeof(applied_rule.value) <> 'string'
          or not exists (
            select 1 from jsonb_array_elements(${rules}) configured_rule(value)
            where configured_rule.value -> 'id' = applied_rule.value
              and configured_rule.value -> 'active' = 'true'::jsonb
          )
      )
      and not exists (
        select 1 from jsonb_array_elements(${lines}) duration_rule_line(value)
        where not (${appliedRuleIds}
          @> jsonb_build_array(duration_rule_line.value -> 'ruleId'))
          or not exists (
            select 1 from jsonb_array_elements(${rules}) configured_rule(value)
            where configured_rule.value -> 'id'
                = duration_rule_line.value -> 'ruleId'
              and configured_rule.value -> 'type'
                = duration_rule_line.value -> 'kind'
              and configured_rule.value -> 'active' = 'true'::jsonb
          )
      )
    else false
  end`;
}

function priceRulesAreWellFormed(value: SQL): SQL {
  const rule = sql.raw("price_config_rule.value");
  return sql`case
    when jsonb_typeof(${value}) = 'array'
    then jsonb_array_length(${value}) between 1 and 1000
      and jsonb_array_length(${value}) = (
        select count(distinct unique_price_rule.value ->> 'id')
        from jsonb_array_elements(${value}) unique_price_rule(value)
      )
      and not exists (
        select 1
        from jsonb_array_elements(${value}) price_config_rule(value)
        where not (
          ${jsonObjectWithAllowedKeys(
            rule,
            ["id", "type", "label", "adjustmentKind", "active", "priority"],
            [
              "serviceCode", "itemTypeCode", "conditionBandCode", "issueCode",
              "addonCode", "suggestedAddonCode", "riskFlagCode",
              "travelZoneCode", "timingCategoryCode", "billingUnit",
              "amountMinorUnits", "percentageBasisPoints",
              "additionalSidePercentageBasisPoints",
              "measurementMinHundredths", "measurementMaxHundredths",
              "manualAssessmentRequired", "declineOrReferRequired", "notes",
            ],
          )}
          and ${jsonString(sql`${rule} -> 'id'`, 160)}
          and ${jsonStringIn(sql`${rule} -> 'type'`, priceRuleTypes)}
          and ${jsonString(sql`${rule} -> 'label'`, 255)}
          and ${jsonStringIn(sql`${rule} -> 'adjustmentKind'`, adjustmentKinds)}
          and ${jsonBoolean(sql`${rule} -> 'active'`)}
          and ${jsonInteger(sql`${rule} -> 'priority'`, 0, 2_147_483_647)}
          and ${optionalJsonStringIn(rule, "serviceCode", catalogueServiceCodes)}
          and ${optionalJsonStringIn(rule, "itemTypeCode", catalogueItemTypeCodes)}
          and ${optionalJsonStringIn(rule, "conditionBandCode", commercialConditionBandCodes)}
          and ${optionalJsonStringIn(rule, "issueCode", catalogueIssueCodes)}
          and ${optionalJsonStringIn(rule, "addonCode", catalogueAddonCodes)}
          and ${optionalJsonStringIn(rule, "suggestedAddonCode", catalogueAddonCodes)}
          and ${optionalJsonStringIn(rule, "riskFlagCode", catalogueRiskCodes)}
          and ${optionalJsonStringIn(rule, "travelZoneCode", travelZoneCodes)}
          and ${optionalJsonStringIn(rule, "timingCategoryCode", timingCategoryCodes)}
          and ${optionalJsonStringIn(rule, "billingUnit", billingUnits)}
          and ${optionalJsonInteger(rule, "amountMinorUnits", Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)}
          and ${optionalJsonInteger(rule, "percentageBasisPoints", Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)}
          and ${optionalJsonInteger(rule, "additionalSidePercentageBasisPoints", 0, 100_000)}
          and ${optionalJsonInteger(rule, "measurementMinHundredths", 0, Number.MAX_SAFE_INTEGER)}
          and ${optionalNullableJsonInteger(rule, "measurementMaxHundredths", 0, Number.MAX_SAFE_INTEGER)}
          and ${optionalJsonBoolean(rule, "manualAssessmentRequired")}
          and ${optionalJsonBoolean(rule, "declineOrReferRequired")}
          and ${optionalJsonString(rule, "notes", 4000)}
        )
      )
    else false
  end`;
}

function durationRulesAreWellFormed(value: SQL): SQL {
  const rule = sql.raw("duration_config_rule.value");
  return sql`case
    when jsonb_typeof(${value}) = 'array'
    then jsonb_array_length(${value}) between 1 and 1000
      and jsonb_array_length(${value}) = (
        select count(distinct unique_duration_rule.value ->> 'id')
        from jsonb_array_elements(${value}) unique_duration_rule(value)
      )
      and not exists (
        select 1
        from jsonb_array_elements(${value}) duration_config_rule(value)
        where not (
          ${jsonObjectWithAllowedKeys(
            rule,
            ["id", "type", "label", "active", "priority"],
            [
              "serviceCode", "itemTypeCode", "conditionBandCode", "issueCode",
              "addonCode", "riskFlagCode", "fibreMaterialCode",
              "treatmentLevelCode", "billingUnit", "minutes",
              "multiplierBasisPoints", "additionalSidePercentageBasisPoints",
              "productivityHundredthsM2PerHour",
              "manualAssessmentRequired", "declineOrReferRequired", "notes",
            ],
          )}
          and ${jsonString(sql`${rule} -> 'id'`, 160)}
          and ${jsonStringIn(sql`${rule} -> 'type'`, durationRuleTypes)}
          and ${jsonString(sql`${rule} -> 'label'`, 255)}
          and ${jsonBoolean(sql`${rule} -> 'active'`)}
          and ${jsonInteger(sql`${rule} -> 'priority'`, 0, 2_147_483_647)}
          and ${optionalJsonStringIn(rule, "serviceCode", catalogueServiceCodes)}
          and ${optionalJsonStringIn(rule, "itemTypeCode", catalogueItemTypeCodes)}
          and ${optionalJsonStringIn(rule, "conditionBandCode", commercialConditionBandCodes)}
          and ${optionalJsonStringIn(rule, "issueCode", catalogueIssueCodes)}
          and ${optionalJsonStringIn(rule, "addonCode", catalogueAddonCodes)}
          and ${optionalJsonStringIn(rule, "riskFlagCode", catalogueRiskCodes)}
          and ${optionalJsonStringIn(rule, "fibreMaterialCode", catalogueFibreCodes)}
          and ${optionalJsonStringIn(rule, "treatmentLevelCode", catalogueTreatmentCodes)}
          and ${optionalJsonStringIn(rule, "billingUnit", billingUnits)}
          and ${optionalJsonInteger(rule, "minutes", 0, 1_000_000)}
          and ${optionalJsonInteger(rule, "multiplierBasisPoints", 0, Number.MAX_SAFE_INTEGER)}
          and ${optionalJsonInteger(rule, "additionalSidePercentageBasisPoints", 0, 100_000)}
          and ${optionalJsonInteger(rule, "productivityHundredthsM2PerHour", 1, Number.MAX_SAFE_INTEGER)}
          and ${optionalJsonBoolean(rule, "manualAssessmentRequired")}
          and ${optionalJsonBoolean(rule, "declineOrReferRequired")}
          and ${optionalJsonString(rule, "notes", 4000)}
        )
      )
    else false
  end`;
}

function priceConfigurationIsWellFormed(
  configuration: SQL,
  priceBook: SQL,
  estimateInput: SQL,
): SQL {
  const vat = sql`${configuration} -> 'vatConfiguration'`;
  return sql`(
    ${exactJsonObject(configuration, [
      "id", "code", "name", "currency", "market", "customerSegment",
      "version", "status", "effectiveFrom", "effectiveUntil", "priceBasis",
      "vatConfiguration", "provisional", "approvedForPublication", "active",
      "rules",
    ])}
    and ${jsonString(sql`${configuration} -> 'id'`, 160)}
    and ${configuration} -> 'id' = ${priceBook} -> 'id'
    and ${configuration} -> 'code' = ${priceBook} -> 'code'
    and ${configuration} -> 'version' = ${priceBook} -> 'version'
    and ${configuration} -> 'status' = ${priceBook} -> 'status'
    and ${configuration} -> 'provisional' = ${priceBook} -> 'provisional'
    and ${configuration} -> 'approvedForPublication'
      = ${priceBook} -> 'approvedForPublication'
    and ${jsonString(sql`${configuration} -> 'name'`, 255)}
    and (${configuration} ->> 'currency') = 'EUR'
    and (${configuration} ->> 'market') = 'SOFIA'
    and ${configuration} -> 'customerSegment'
      = ${estimateInput} -> 'customerSegment'
    and ${jsonStringIn(sql`${configuration} -> 'priceBasis'`, priceBases)}
    and ${nullableJsonString(sql`${configuration} -> 'effectiveFrom'`, 64)}
    and ${nullableJsonString(sql`${configuration} -> 'effectiveUntil'`, 64)}
    and ${jsonBoolean(sql`${configuration} -> 'active'`)}
    and ${exactJsonObject(vat, ["mode", "rateBasisPoints"])}
    and ${jsonStringIn(sql`${vat} -> 'mode'`, vatModes)}
    and ${jsonInteger(sql`${vat} -> 'rateBasisPoints'`, 0, 10_000, true)}
    and (
      ((${vat} ->> 'mode') = 'VAT_UNRESOLVED'
        and jsonb_typeof(${vat} -> 'rateBasisPoints') = 'null')
      or ((${vat} ->> 'mode') <> 'VAT_UNRESOLVED'
        and jsonb_typeof(${vat} -> 'rateBasisPoints') = 'number')
    )
    and ${priceRulesAreWellFormed(sql`${configuration} -> 'rules'`)}
  )`;
}

function durationConfigurationIsWellFormed(
  configuration: SQL,
  durationModel: SQL,
): SQL {
  return sql`(
    ${exactJsonObject(configuration, [
      "id", "code", "name", "market", "version", "status", "effectiveFrom",
      "effectiveUntil", "provisional", "active", "rules",
    ])}
    and ${configuration} -> 'id' = ${durationModel} -> 'id'
    and ${configuration} -> 'code' = ${durationModel} -> 'code'
    and ${configuration} -> 'version' = ${durationModel} -> 'version'
    and ${configuration} -> 'status' = ${durationModel} -> 'status'
    and ${configuration} -> 'provisional' = ${durationModel} -> 'provisional'
    and ${jsonString(sql`${configuration} -> 'name'`, 255)}
    and (${configuration} ->> 'market') = 'SOFIA'
    and ${nullableJsonString(sql`${configuration} -> 'effectiveFrom'`, 64)}
    and ${nullableJsonString(sql`${configuration} -> 'effectiveUntil'`, 64)}
    and ${jsonBoolean(sql`${configuration} -> 'active'`)}
    and ${durationRulesAreWellFormed(sql`${configuration} -> 'rules'`)}
  )`;
}

function serviceAreaIsWellFormed(value: SQL, estimateInput: SQL): SQL {
  const name = sql`${value} -> 'name'`;
  return sql`case
    when jsonb_typeof(${value}) = 'null' then true
    when jsonb_typeof(${value}) = 'object' then
      ${exactJsonObject(value, [
        "code", "name", "active", "serviceEligible",
        "minimumOrderOverrideMinorUnits", "estimatedBaseTravelMinutes",
        "manualConfirmationRequired", "geographicMetadata", "notes",
      ])}
      and ${value} -> 'code' = ${estimateInput} -> 'travelZoneCode'
      and ${exactJsonObject(name, ["bg", "en"])}
      and ${jsonString(sql`${name} -> 'bg'`, 255)}
      and ${jsonString(sql`${name} -> 'en'`, 255)}
      and ${jsonBoolean(sql`${value} -> 'active'`)}
      and ${jsonBoolean(sql`${value} -> 'serviceEligible'`)}
      and ${jsonInteger(sql`${value} -> 'minimumOrderOverrideMinorUnits'`, 0, Number.MAX_SAFE_INTEGER, true)}
      and ${jsonInteger(sql`${value} -> 'estimatedBaseTravelMinutes'`, 0, 1_000_000, true)}
      and ${jsonBoolean(sql`${value} -> 'manualConfirmationRequired'`)}
      and jsonb_typeof(${value} -> 'geographicMetadata') in ('null', 'object')
      and ${jsonString(sql`${value} -> 'notes'`, 4000)}
    else false
  end`;
}

function schedulingPolicyIsWellFormed(value: SQL): SQL {
  return sql`(
    ${exactJsonObject(value, [
      "code", "name", "version", "status", "effectiveFrom", "effectiveUntil",
      "provisional", "active", "candidateIntervalMinutes",
      "interJobBufferMinutes", "largeJobReviewThresholdMinutes",
    ])}
    and ${jsonString(sql`${value} -> 'code'`, 96)}
    and ${jsonString(sql`${value} -> 'name'`, 255)}
    and ${jsonInteger(sql`${value} -> 'version'`, 1, 2_147_483_647)}
    and ${jsonStringIn(sql`${value} -> 'status'`, priceBookStatuses)}
    and ${nullableJsonString(sql`${value} -> 'effectiveFrom'`, 64)}
    and ${nullableJsonString(sql`${value} -> 'effectiveUntil'`, 64)}
    and ${jsonBoolean(sql`${value} -> 'provisional'`)}
    and ${jsonBoolean(sql`${value} -> 'active'`)}
    and ${jsonInteger(sql`${value} -> 'candidateIntervalMinutes'`, 1, 1_440)}
    and ${jsonInteger(sql`${value} -> 'interJobBufferMinutes'`, 0, 1_440)}
    and ${jsonInteger(sql`${value} -> 'largeJobReviewThresholdMinutes'`, 1, 1_000_000)}
  )`;
}

function travelProfileRulesAreWellFormed(value: SQL): SQL {
  const rule = sql.raw("travel_profile_rule.value");
  return sql`case
    when jsonb_typeof(${value}) = 'array'
    then jsonb_array_length(${value}) between 1 and 1000
      and not exists (
        select 1 from jsonb_array_elements(${value}) travel_profile_rule(value)
        where not (
          ${exactJsonObject(rule, [
            "id", "originZoneCode", "destinationZoneCode",
            "estimatedTravelMinutes", "bidirectional", "sameDistrictOnly",
            "manualAssessmentRequired", "priority", "active", "notes",
          ])}
          and ${jsonString(sql`${rule} -> 'id'`, 160)}
          and ${jsonStringIn(sql`${rule} -> 'originZoneCode'`, travelZoneCodes)}
          and ${jsonStringIn(sql`${rule} -> 'destinationZoneCode'`, travelZoneCodes)}
          and ${jsonInteger(sql`${rule} -> 'estimatedTravelMinutes'`, 0, 1_000_000, true)}
          and ${jsonBoolean(sql`${rule} -> 'bidirectional'`)}
          and ${jsonBoolean(sql`${rule} -> 'sameDistrictOnly'`)}
          and ${jsonBoolean(sql`${rule} -> 'manualAssessmentRequired'`)}
          and ${jsonInteger(sql`${rule} -> 'priority'`, 0, 2_147_483_647)}
          and ${jsonBoolean(sql`${rule} -> 'active'`)}
          and ${jsonString(sql`${rule} -> 'notes'`, 4000)}
        )
      )
    else false
  end`;
}

function travelProfileIsWellFormed(value: SQL): SQL {
  return sql`(
    ${exactJsonObject(value, [
      "id", "code", "name", "market", "version", "status", "effectiveFrom",
      "effectiveUntil", "defaultTravelMinutes", "interJobBufferMinutes",
      "provisional", "active", "rules",
    ])}
    and ${jsonString(sql`${value} -> 'id'`, 160)}
    and ${jsonString(sql`${value} -> 'code'`, 96)}
    and ${jsonString(sql`${value} -> 'name'`, 255)}
    and (${value} ->> 'market') = 'SOFIA'
    and ${jsonInteger(sql`${value} -> 'version'`, 1, 2_147_483_647)}
    and ${jsonStringIn(sql`${value} -> 'status'`, priceBookStatuses)}
    and ${nullableJsonString(sql`${value} -> 'effectiveFrom'`, 64)}
    and ${nullableJsonString(sql`${value} -> 'effectiveUntil'`, 64)}
    and ${jsonInteger(sql`${value} -> 'defaultTravelMinutes'`, 0, 1_000_000)}
    and ${jsonInteger(sql`${value} -> 'interJobBufferMinutes'`, 0, 1_440)}
    and ${jsonBoolean(sql`${value} -> 'provisional'`)}
    and ${jsonBoolean(sql`${value} -> 'active'`)}
    and ${travelProfileRulesAreWellFormed(sql`${value} -> 'rules'`)}
  )`;
}

function workingHourRulesAreWellFormed(value: SQL): SQL {
  const rule = sql.raw("working_hour_rule.value");
  return sql`case
    when jsonb_typeof(${value}) = 'array'
    then jsonb_array_length(${value}) between 1 and 100
      and not exists (
        select 1 from jsonb_array_elements(${value}) working_hour_rule(value)
        where not (
          ${exactJsonObject(rule, [
            "id", "weekday", "startMinute", "endMinute", "enabled", "teamCode",
          ])}
          and ${jsonString(sql`${rule} -> 'id'`, 160)}
          and ${jsonInteger(sql`${rule} -> 'weekday'`, 1, 7)}
          and ${jsonInteger(sql`${rule} -> 'startMinute'`, 0, 1_439)}
          and ${jsonInteger(sql`${rule} -> 'endMinute'`, 1, 1_440)}
          and (${rule} -> 'endMinute') > (${rule} -> 'startMinute')
          and ${jsonBoolean(sql`${rule} -> 'enabled'`)}
          and (jsonb_typeof(${rule} -> 'teamCode') = 'null'
            or ${jsonStringIn(sql`${rule} -> 'teamCode'`, operationsTeamCodes)})
        )
      )
    else false
  end`;
}

function workingHourPolicyIsWellFormed(value: SQL): SQL {
  return sql`(
    ${exactJsonObject(value, [
      "id", "code", "name", "timeZone", "version", "status", "effectiveFrom",
      "effectiveUntil", "provisional", "active", "rules",
    ])}
    and ${jsonString(sql`${value} -> 'id'`, 160)}
    and ${jsonString(sql`${value} -> 'code'`, 96)}
    and ${jsonString(sql`${value} -> 'name'`, 255)}
    and (${value} ->> 'timeZone') = 'Europe/Sofia'
    and ${jsonInteger(sql`${value} -> 'version'`, 1, 2_147_483_647)}
    and ${jsonStringIn(sql`${value} -> 'status'`, priceBookStatuses)}
    and ${nullableJsonString(sql`${value} -> 'effectiveFrom'`, 64)}
    and ${nullableJsonString(sql`${value} -> 'effectiveUntil'`, 64)}
    and ${jsonBoolean(sql`${value} -> 'provisional'`)}
    and ${jsonBoolean(sql`${value} -> 'active'`)}
    and ${workingHourRulesAreWellFormed(sql`${value} -> 'rules'`)}
  )`;
}

function appointmentWindowsAreWellFormed(value: SQL): SQL {
  const window = sql.raw("appointment_window.value");
  const name = sql`${window} -> 'name'`;
  return sql`case
    when jsonb_typeof(${value}) = 'array'
    then jsonb_array_length(${value}) between 1 and 100
      and not exists (
        select 1 from jsonb_array_elements(${value}) appointment_window(value)
        where not (
          ${exactJsonObject(window, [
            "id", "profileCode", "version", "status", "windowCode", "name",
            "startMinute", "endMinute", "provisional", "active",
          ])}
          and ${jsonString(sql`${window} -> 'id'`, 160)}
          and ${jsonString(sql`${window} -> 'profileCode'`, 96)}
          and ${jsonInteger(sql`${window} -> 'version'`, 1, 2_147_483_647)}
          and ${jsonStringIn(sql`${window} -> 'status'`, priceBookStatuses)}
          and ${jsonStringIn(sql`${window} -> 'windowCode'`, appointmentWindowCodes)}
          and ${exactJsonObject(name, ["bg", "en"])}
          and ${jsonString(sql`${name} -> 'bg'`, 255)}
          and ${jsonString(sql`${name} -> 'en'`, 255)}
          and ${jsonInteger(sql`${window} -> 'startMinute'`, 0, 1_439)}
          and ${jsonInteger(sql`${window} -> 'endMinute'`, 1, 1_440)}
          and (${window} -> 'endMinute') > (${window} -> 'startMinute')
          and ${jsonBoolean(sql`${window} -> 'provisional'`)}
          and ${jsonBoolean(sql`${window} -> 'active'`)}
        )
      )
    else false
  end`;
}

function availabilityConfigurationIsWellFormed(
  configuration: SQL,
  estimateInput: SQL,
  result: SQL,
): SQL {
  const serviceArea = sql`${configuration} -> 'serviceArea'`;
  const schedulingPolicy = sql`${configuration} -> 'schedulingPolicy'`;
  return sql`(
    ${exactJsonObject(configuration, [
      "serviceArea", "schedulingPolicy", "travelTimeProfile",
      "workingHourPolicy", "appointmentWindows",
    ])}
    and ${serviceAreaIsWellFormed(serviceArea, estimateInput)}
    and ${schedulingPolicyIsWellFormed(schedulingPolicy)}
    and ${travelProfileIsWellFormed(sql`${configuration} -> 'travelTimeProfile'`)}
    and ${workingHourPolicyIsWellFormed(sql`${configuration} -> 'workingHourPolicy'`)}
    and ${appointmentWindowsAreWellFormed(sql`${configuration} -> 'appointmentWindows'`)}
    and ${result} -> 'serviceEligible' = case
      when jsonb_typeof(${serviceArea}) = 'null' then 'null'::jsonb
      else ${serviceArea} -> 'serviceEligible'
    end
    and ${result} -> 'manualConfirmationRequired' = case
      when jsonb_typeof(${serviceArea}) = 'null' then 'true'::jsonb
      else ${serviceArea} -> 'manualConfirmationRequired'
    end
    and ${result} -> 'schedulingConfigurationReady'
      = ${schedulingPolicy} -> 'active'
  )`;
}

function jsonbScalar(value: SQL): SQL {
  return sql`coalesce(to_jsonb(${value}), 'null'::jsonb)`;
}

function jsonInstantMatchesTimestamp(value: SQL, timestamp: SQL): SQL {
  return sql`case
    when ${jsonIsoInstant(value)}
    then (${value} #>> '{}')::timestamptz = ${timestamp}
    else false
  end`;
}

function priceTotalsAreConsistent(result: SQL): SQL {
  const minimum = sql`${result} -> 'minimumVisitAdjustmentMinorUnits'`;
  const net = sql`${result} -> 'netAmountMinorUnits'`;
  const vatRate = sql`${result} -> 'vatRateBasisPoints'`;
  const vat = sql`${result} -> 'vatAmountMinorUnits'`;
  const gross = sql`${result} -> 'grossTotalMinorUnits'`;
  return sql`case
    when ${result} -> 'manualAssessmentRequired' = 'true'::jsonb
    then (
      (jsonb_typeof(${minimum}) = 'null'
        and jsonb_typeof(${net}) = 'null'
        and jsonb_typeof(${vat}) = 'null'
        and jsonb_typeof(${gross}) = 'null')
      or (jsonb_typeof(${minimum}) = 'number'
        and jsonb_typeof(${net}) = 'null'
        and jsonb_typeof(${vatRate}) = 'null'
        and jsonb_typeof(${vat}) = 'null'
        and jsonb_typeof(${gross}) = 'number'
        and (${minimum} #>> '{}') ~ '^[0-9]+$'
        and (${gross} #>> '{}') ~ '^[0-9]+$')
    )
    when ${result} -> 'manualAssessmentRequired' = 'false'::jsonb
      and jsonb_typeof(${minimum}) = 'number'
      and jsonb_typeof(${net}) = 'number'
      and jsonb_typeof(${vat}) = 'number'
      and jsonb_typeof(${gross}) = 'number'
      and (${net} #>> '{}') ~ '^[0-9]+$'
      and (${vat} #>> '{}') ~ '^[0-9]+$'
      and (${gross} #>> '{}') ~ '^[0-9]+$'
    then (${gross} #>> '{}')::numeric
      = (${net} #>> '{}')::numeric + (${vat} #>> '{}')::numeric
    else false
  end`;
}

function durationTotalsAreConsistent(result: SQL): SQL {
  const components = [
    "setupMinutes",
    "inspectionMinutes",
    "baseCleaningMinutes",
    "modifierMinutes",
    "addonMinutes",
    "cleanupMinutes",
  ] as const;
  const componentChecks = sql.join(
    components.map(
      (key) => sql`(${result} ->> ${key}) ~ '^[0-9]+$'`,
    ),
    sql` and `,
  );
  const componentSum = sql.join(
    components.map((key) => sql`(${result} ->> ${key})::numeric`),
    sql` + `,
  );
  return sql`case
    when ${componentChecks}
      and (${result} ->> 'partialEstimatedMinutes') ~ '^[0-9]+$'
    then (${result} ->> 'partialEstimatedMinutes')::numeric = ${componentSum}
      and case
        when ${result} -> 'manualAssessmentRequired' = 'true'::jsonb
        then jsonb_typeof(${result} -> 'totalEstimatedMinutes') = 'null'
        when ${result} -> 'manualAssessmentRequired' = 'false'::jsonb
        then ${result} -> 'totalEstimatedMinutes'
          = ${result} -> 'partialEstimatedMinutes'
        else false
      end
    else false
  end`;
}

export function completeEstimateEvidenceSql(evidence: {
  inputSnapshot: SQL;
  priceSnapshot: SQL;
  durationSnapshot: SQL;
  availabilitySnapshot: SQL;
  warnings: SQL;
  reviewReasonCodes: SQL;
  status: SQL;
  priceBookCode: SQL;
  priceBookVersion: SQL;
  durationModelCode: SQL;
  durationModelVersion: SQL;
  netAmountMinorUnits: SQL;
  vatRateBasisPoints: SQL;
  vatAmountMinorUnits: SQL;
  grossTotalMinorUnits: SQL;
  currency: SQL;
  estimatedServiceMinutes: SQL;
  estimatedTravelMinutes: SQL;
  manualAssessmentRequired: SQL;
  declineOrReferRequired: SQL;
  calculatedAt: SQL;
}): SQL {
  const input = evidence.inputSnapshot;
  const price = evidence.priceSnapshot;
  const priceBook = sql`${price} -> 'priceBook'`;
  const priceConfiguration = sql`${price} -> 'configuration'`;
  const priceInput = sql`${price} -> 'input'`;
  const priceResult = sql`${price} -> 'result'`;
  const duration = evidence.durationSnapshot;
  const durationModel = sql`${duration} -> 'durationModel'`;
  const durationConfiguration = sql`${duration} -> 'configuration'`;
  const durationInput = sql`${duration} -> 'input'`;
  const durationResult = sql`${duration} -> 'result'`;
  const availability = evidence.availabilitySnapshot;
  const availabilityConfiguration = sql`${availability} -> 'configuration'`;
  const availabilityResult = sql`${availability} -> 'result'`;

  return sql`(
    ${exactJsonObject(input, [
      "customerSegment",
      "items",
      "conditionBandCode",
      "travelZoneCode",
      "governanceReviewReasonCodes",
      "timingCategoryCode",
    ])}
    and ${jsonStringIn(sql`${input} -> 'customerSegment'`, customerSegments)}
    and ${estimateInputItemsAreWellFormed(sql`${input} -> 'items'`)}
    and ${jsonStringIn(sql`${input} -> 'conditionBandCode'`, commercialConditionBandCodes)}
    and ${jsonStringIn(sql`${input} -> 'travelZoneCode'`, travelZoneCodes)}
    and ${jsonStringArrayIn(
      sql`${input} -> 'governanceReviewReasonCodes'`,
      10,
      estimateGovernanceReviewReasonCodes,
    )}
    and ${jsonStringIn(sql`${input} -> 'timingCategoryCode'`, timingCategoryCodes)}

    and ${exactJsonObject(price, [
      "schemaVersion", "calculatedAt", "priceBook", "configuration", "input", "result",
    ])}
    and (${price} -> 'schemaVersion') = '1'::jsonb
    and ${jsonIsoInstant(sql`${price} -> 'calculatedAt'`)}
    and ${exactJsonObject(priceBook, [
      "id", "code", "version", "status", "provisional", "approvedForPublication",
    ])}
    and ${jsonString(sql`${priceBook} -> 'id'`, 160)}
    and ${jsonString(sql`${priceBook} -> 'code'`, 96)}
    and ${jsonInteger(sql`${priceBook} -> 'version'`, 1, 2_147_483_647)}
    and ${jsonStringIn(sql`${priceBook} -> 'status'`, priceBookStatuses)}
    and ${jsonBoolean(sql`${priceBook} -> 'provisional'`)}
    and ${jsonBoolean(sql`${priceBook} -> 'approvedForPublication'`)}
    and ${priceConfigurationIsWellFormed(
      priceConfiguration,
      priceBook,
      input,
    )}
    and ${priceInput} = jsonb_build_object(
      'items', ${input} -> 'items',
      'conditionBandCode', ${input} -> 'conditionBandCode',
      'travelZoneCode', ${input} -> 'travelZoneCode',
      'timingCategoryCode', ${input} -> 'timingCategoryCode'
    )
    and ${exactJsonObject(priceResult, [
      "lines", "subtotalMinorUnits", "minimumVisitAdjustmentMinorUnits",
      "netAmountMinorUnits", "vatRateBasisPoints", "vatAmountMinorUnits",
      "grossTotalMinorUnits", "currency", "warnings", "manualAssessmentRequired",
      "declineOrReferRequired", "appliedRuleIds",
    ])}
    and ${priceLinesAreWellFormed(sql`${priceResult} -> 'lines'`)}
    and ${jsonInteger(sql`${priceResult} -> 'subtotalMinorUnits'`, 0, Number.MAX_SAFE_INTEGER)}
    and ${jsonInteger(sql`${priceResult} -> 'minimumVisitAdjustmentMinorUnits'`, 0, Number.MAX_SAFE_INTEGER, true)}
    and ${jsonInteger(sql`${priceResult} -> 'netAmountMinorUnits'`, 0, Number.MAX_SAFE_INTEGER, true)}
    and ${jsonInteger(sql`${priceResult} -> 'vatRateBasisPoints'`, 0, 10_000, true)}
    and ${jsonInteger(sql`${priceResult} -> 'vatAmountMinorUnits'`, 0, Number.MAX_SAFE_INTEGER, true)}
    and ${jsonInteger(sql`${priceResult} -> 'grossTotalMinorUnits'`, 0, Number.MAX_SAFE_INTEGER, true)}
    and (${priceResult} ->> 'currency') = 'EUR'
    and ${jsonStringArray(sql`${priceResult} -> 'warnings'`, 100, 1000)}
    and ${jsonBoolean(sql`${priceResult} -> 'manualAssessmentRequired'`)}
    and ${jsonBoolean(sql`${priceResult} -> 'declineOrReferRequired'`)}
    and ${jsonStringArray(sql`${priceResult} -> 'appliedRuleIds'`, 1000, 160)}
    and not (
      (${priceResult} -> 'declineOrReferRequired') = 'true'::jsonb
      and (${priceResult} -> 'manualAssessmentRequired') <> 'true'::jsonb
    )
    and ${priceTotalsAreConsistent(priceResult)}
    and ${priceLineEvidenceIsConsistent(
      sql`${priceResult} -> 'lines'`,
      priceResult,
      priceConfiguration,
    )}
    and ${priceBook} -> 'code' = ${jsonbScalar(evidence.priceBookCode)}
    and ${priceBook} -> 'version' = ${jsonbScalar(evidence.priceBookVersion)}
    and ${priceResult} -> 'netAmountMinorUnits'
      = ${jsonbScalar(evidence.netAmountMinorUnits)}
    and ${priceResult} -> 'vatRateBasisPoints'
      = ${jsonbScalar(evidence.vatRateBasisPoints)}
    and ${priceResult} -> 'vatAmountMinorUnits'
      = ${jsonbScalar(evidence.vatAmountMinorUnits)}
    and ${priceResult} -> 'grossTotalMinorUnits'
      = ${jsonbScalar(evidence.grossTotalMinorUnits)}
    and ${priceResult} -> 'currency' = ${jsonbScalar(evidence.currency)}

    and ${exactJsonObject(duration, [
      "schemaVersion", "calculatedAt", "durationModel", "configuration", "input", "result",
    ])}
    and (${duration} -> 'schemaVersion') = '1'::jsonb
    and ${jsonIsoInstant(sql`${duration} -> 'calculatedAt'`)}
    and ${exactJsonObject(durationModel, [
      "id", "code", "version", "status", "provisional",
    ])}
    and ${jsonString(sql`${durationModel} -> 'id'`, 160)}
    and ${jsonString(sql`${durationModel} -> 'code'`, 96)}
    and ${jsonInteger(sql`${durationModel} -> 'version'`, 1, 2_147_483_647)}
    and ${jsonStringIn(sql`${durationModel} -> 'status'`, priceBookStatuses)}
    and ${jsonBoolean(sql`${durationModel} -> 'provisional'`)}
    and ${durationConfigurationIsWellFormed(
      durationConfiguration,
      durationModel,
    )}
    and ${durationInput} = jsonb_build_object(
      'items', ${input} -> 'items',
      'conditionBandCode', ${input} -> 'conditionBandCode'
    )
    and ${exactJsonObject(durationResult, [
      "lines", "setupMinutes", "inspectionMinutes", "baseCleaningMinutes",
      "modifierMinutes", "addonMinutes", "cleanupMinutes", "partialEstimatedMinutes",
      "totalEstimatedMinutes", "warnings", "manualAssessmentRequired",
      "declineOrReferRequired", "appliedRuleIds",
    ])}
    and ${durationLinesAreWellFormed(sql`${durationResult} -> 'lines'`)}
    and ${jsonInteger(sql`${durationResult} -> 'setupMinutes'`, 0, 1_000_000)}
    and ${jsonInteger(sql`${durationResult} -> 'inspectionMinutes'`, 0, 1_000_000)}
    and ${jsonInteger(sql`${durationResult} -> 'baseCleaningMinutes'`, 0, 1_000_000)}
    and ${jsonInteger(sql`${durationResult} -> 'modifierMinutes'`, 0, 1_000_000)}
    and ${jsonInteger(sql`${durationResult} -> 'addonMinutes'`, 0, 1_000_000)}
    and ${jsonInteger(sql`${durationResult} -> 'cleanupMinutes'`, 0, 1_000_000)}
    and ${jsonInteger(sql`${durationResult} -> 'partialEstimatedMinutes'`, 0, 1_000_000)}
    and ${jsonInteger(sql`${durationResult} -> 'totalEstimatedMinutes'`, 0, 1_000_000, true)}
    and ${jsonStringArray(sql`${durationResult} -> 'warnings'`, 100, 1000)}
    and ${jsonBoolean(sql`${durationResult} -> 'manualAssessmentRequired'`)}
    and ${jsonBoolean(sql`${durationResult} -> 'declineOrReferRequired'`)}
    and ${jsonStringArray(sql`${durationResult} -> 'appliedRuleIds'`, 1000, 160)}
    and not (
      (${durationResult} -> 'declineOrReferRequired') = 'true'::jsonb
      and (${durationResult} -> 'manualAssessmentRequired') <> 'true'::jsonb
    )
    and ${durationTotalsAreConsistent(durationResult)}
    and ${durationLineEvidenceIsConsistent(
      sql`${durationResult} -> 'lines'`,
      durationResult,
      durationConfiguration,
    )}
    and ${durationModel} -> 'code'
      = ${jsonbScalar(evidence.durationModelCode)}
    and ${durationModel} -> 'version'
      = ${jsonbScalar(evidence.durationModelVersion)}
    and ${durationResult} -> 'totalEstimatedMinutes'
      = ${jsonbScalar(evidence.estimatedServiceMinutes)}

    and ${exactJsonObject(availability, [
      "schemaVersion", "calculatedAt", "configuration", "result",
    ])}
    and (${availability} -> 'schemaVersion') = '1'::jsonb
    and ${jsonIsoInstant(sql`${availability} -> 'calculatedAt'`)}
    and ${exactJsonObject(availabilityResult, [
      "serviceEligible", "manualConfirmationRequired", "schedulingConfigurationReady",
    ])}
    and jsonb_typeof(${availabilityResult} -> 'serviceEligible') in ('null', 'boolean')
    and ${jsonBoolean(sql`${availabilityResult} -> 'manualConfirmationRequired'`)}
    and ${jsonBoolean(sql`${availabilityResult} -> 'schedulingConfigurationReady'`)}
    and ${availabilityConfigurationIsWellFormed(
      availabilityConfiguration,
      input,
      availabilityResult,
    )}

    and ${price} -> 'calculatedAt' = ${duration} -> 'calculatedAt'
    and ${price} -> 'calculatedAt' = ${availability} -> 'calculatedAt'
    and ${jsonInstantMatchesTimestamp(
      sql`${price} -> 'calculatedAt'`,
      evidence.calculatedAt,
    )}
    and ${jsonStringArray(evidence.warnings, 200, 1000)}
    and ${jsonStringArrayIn(
      evidence.reviewReasonCodes,
      100,
      estimateReviewReasonCodes,
    )}
    and ${evidence.warnings} = (${priceResult} -> 'warnings')
      || (${durationResult} -> 'warnings') || ${evidence.reviewReasonCodes}
    and ${evidence.manualAssessmentRequired} = (
      ${priceResult} -> 'manualAssessmentRequired' = 'true'::jsonb
      or ${durationResult} -> 'manualAssessmentRequired' = 'true'::jsonb
      or case when jsonb_typeof(${evidence.reviewReasonCodes}) = 'array'
        then jsonb_array_length(${evidence.reviewReasonCodes}) > 0
        else false
      end
    )
    and ${evidence.declineOrReferRequired} = (
      ${priceResult} -> 'declineOrReferRequired' = 'true'::jsonb
      or ${durationResult} -> 'declineOrReferRequired' = 'true'::jsonb
      or ${availabilityResult} -> 'serviceEligible' = 'false'::jsonb
    )
    and ${evidence.status} = case
      when ${evidence.declineOrReferRequired} then 'DECLINE_OR_REFER'
      when ${evidence.manualAssessmentRequired} then 'REVIEW_REQUIRED'
      else 'CALCULATED'
    end
    and ${evidence.estimatedTravelMinutes} is null
  )`;
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

type DatabaseDate = Date | string;

function dateValue(value: DatabaseDate): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.valueOf())) {
    throw new Error("Invalid database timestamp");
  }
  return date;
}

function nullableDateValue(value: DatabaseDate | null): Date | null {
  return value === null ? null : dateValue(value);
}

type StaffListRow = Omit<StaffRequestSummary, "submittedAt" | "updatedAt"> & {
  submittedAt: DatabaseDate;
  updatedAt: DatabaseDate;
  total: number | string;
};

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
    submittedAt: dateValue(row.submittedAt),
    updatedAt: dateValue(row.updatedAt),
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
  type StaffRequestDetailRow = Omit<
    StaffRequestDetail,
    "submittedAt" | "updatedAt" | "closedAt"
  > & {
    submittedAt: DatabaseDate;
    updatedAt: DatabaseDate;
    closedAt: DatabaseDate | null;
  };
  const result = await database.execute<StaffRequestDetailRow>(sql`
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
        select jsonb_agg(
          to_jsonb(estimate) || jsonb_build_object(
            'price_snapshot_sha256',
            ${priceSnapshotSha256Sql(sql`estimate.price_snapshot`)}
          ) order by estimate.estimate_version
        )
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
    closedAt: nullableDateValue(row.closedAt),
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
  type CustomerRequestRow = Omit<
    CustomerRequestSummary,
    "submittedAt" | "updatedAt"
  > & {
    submittedAt: DatabaseDate;
    updatedAt: DatabaseDate;
  };
  const result = await database.execute<CustomerRequestRow>(sql`
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
  return result.rows.map((row) => ({
    ...row,
    submittedAt: dateValue(row.submittedAt),
    updatedAt: dateValue(row.updatedAt),
  }));
}

export async function loadCustomerRequestRecord(
  database: Database,
  actorProfileId: string,
  requestReference: string,
): Promise<CustomerRequestDetail | null> {
  type CustomerRequestDetailRow = Omit<
    CustomerRequestDetail,
    "submittedAt" | "updatedAt"
  > & {
    submittedAt: DatabaseDate;
    updatedAt: DatabaseDate;
  };
  const result = await database.execute<CustomerRequestDetailRow>(sql`
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
  const row = result.rows[0];
  return row
    ? {
        ...row,
        submittedAt: dateValue(row.submittedAt),
        updatedAt: dateValue(row.updatedAt),
      }
    : null;
}

export async function listCustomerQuoteRecords(
  database: Database,
  actorProfileId: string,
): Promise<readonly CustomerQuoteSummary[]> {
  type CustomerQuoteRow = Omit<
    CustomerQuoteSummary,
    "validFrom" | "validUntil" | "issuedAt"
  > & {
    validFrom: DatabaseDate;
    validUntil: DatabaseDate;
    issuedAt: DatabaseDate;
  };
  const result = await database.execute<CustomerQuoteRow>(sql`
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
    validFrom: dateValue(row.validFrom),
    validUntil: dateValue(row.validUntil),
    issuedAt: dateValue(row.issuedAt),
  }));
}

export async function loadCustomerQuoteRecord(
  database: Database,
  actorProfileId: string,
  quoteReference: string,
): Promise<CustomerQuoteDetail | null> {
  type CustomerQuoteDetailRow = Omit<
    CustomerQuoteDetail,
    "validFrom" | "validUntil" | "issuedAt"
  > & {
    validFrom: DatabaseDate;
    validUntil: DatabaseDate;
    issuedAt: DatabaseDate;
  };
  const result = await database.execute<CustomerQuoteDetailRow>(sql`
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
    validFrom: dateValue(row.validFrom),
    validUntil: dateValue(row.validUntil),
    issuedAt: dateValue(row.issuedAt),
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
  updatedAt: DatabaseDate | null;
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
        updatedAt: dateValue(row.updatedAt),
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
        select estimate.id, estimate.input_snapshot, estimate.price_snapshot
        from ${requestEstimates} estimate
        where estimate.id = ${input.estimateId}::uuid
          and estimate.request_id = ${input.requestId}::uuid
          and estimate.source_request_version = (
            select version from target_request
          )
          and estimate.decline_or_refer_required = false
          and ${resolvedQuoteSourceVatSql(
            sql`estimate.price_snapshot`, sql`estimate.vat_rate_basis_points`,
          )}
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
            or (${jsonParameter(input.commercialSnapshot)}::jsonb
                #>> '{sourceEstimate,priceSnapshotSha256}')
              is distinct from (
                select ${priceSnapshotSha256Sql(sql`selected_estimate.price_snapshot`)}
                from selected_estimate
              )
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
      select estimate.id, estimate.input_snapshot, estimate.price_snapshot
      from ${requestEstimates} estimate
      join target on target.request_id = estimate.request_id
      where estimate.id = ${input.estimateId}::uuid
        and estimate.source_request_version = target.request_version
        and estimate.decline_or_refer_required = false
        and ${resolvedQuoteSourceVatSql(
          sql`estimate.price_snapshot`, sql`estimate.vat_rate_basis_points`,
        )}
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
          or not (select valid from line_validation)
          or (${jsonParameter(input.commercialSnapshot)}::jsonb
              #>> '{sourceEstimate,priceSnapshotSha256}')
            is distinct from (
              select ${priceSnapshotSha256Sql(sql`selected_estimate.price_snapshot`)}
              from selected_estimate
            )
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
          quote_record.customer_id as quote_customer_id,
          quote_record.property_id as quote_property_id,
          request.customer_resolution_status,
          request.customer_id, request.property_id,
          request.preferred_date, request.preferred_window_code,
          request.customer_notes as request_customer_notes,
          quote_record.currency, quote_record.price_basis,
          quote_record.net_amount_minor_units,
          quote_record.vat_rate_basis_points,
          quote_record.vat_amount_minor_units,
          quote_record.gross_total_minor_units,
          quote_record.estimated_duration_minutes,
          quote_record.commercial_snapshot, quote_record.terms_snapshot,
          quote_record.customer_notes as quote_customer_notes,
          quote_record.valid_from,
          quote_record.valid_until
        from ${quotes} quote_record
        join ${serviceRequests} request on request.id = quote_record.request_id
        where quote_record.id = ${input.quoteId}::uuid
          and ${staffRequestManageSql(actorProfileId)}
        for update of request, quote_record
      ),
      commercial_context as materialized (
        select customer.id as customer_id,
          customer.display_name as customer_display_name,
          customer.preferred_locale as customer_preferred_locale,
          customer.customer_type, customer.status as customer_status,
          customer.version as customer_version,
          property.id as property_id,
          property.customer_id as property_customer_id,
          property.property_type, property.label as property_label,
          property.city as property_city,
          property.district as property_district,
          property.street_address as property_street_address,
          property.postal_code as property_postal_code,
          property.latitude as property_latitude,
          property.longitude as property_longitude,
          property.access_notes as property_access_notes,
          property.parking_notes as property_parking_notes,
          property.service_zone_id, property.status as property_status,
          property.version as property_version,
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
        select zone.id as travel_zone_id, zone.code as travel_zone_code,
          zone.active as travel_zone_active,
          zone.default_parking_policy_id,
          zone.distance_threshold_hundredths_km,
          zone.travel_time_threshold_minutes,
          zone.boundary_notes, zone.service_eligible,
          zone.minimum_order_override_minor_units,
          zone.estimated_base_travel_minutes,
          zone.manual_confirmation_required,
          zone.geographic_metadata,
          zone.updated_at as travel_zone_updated_at
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
        select estimate.id as estimate_id,
          estimate.request_id as estimate_request_id,
          estimate.source_request_version as estimate_source_request_version,
          estimate.estimate_version, estimate.status as estimate_status,
          estimate.price_book_id, estimate.price_book_code,
          estimate.price_book_version, estimate.duration_model_id,
          estimate.duration_model_code, estimate.duration_model_version,
          estimate.input_snapshot, estimate.price_snapshot,
          estimate.duration_snapshot, estimate.availability_snapshot,
          estimate.net_amount_minor_units as estimate_net_amount_minor_units,
          estimate.vat_rate_basis_points as estimate_vat_rate_basis_points,
          estimate.vat_amount_minor_units as estimate_vat_amount_minor_units,
          estimate.gross_total_minor_units as estimate_gross_total_minor_units,
          estimate.currency as estimate_currency,
          estimate.estimated_service_minutes,
          estimate.estimated_travel_minutes,
          estimate.manual_assessment_required,
          estimate.decline_or_refer_required,
          estimate.warnings, estimate.review_reason_codes,
          estimate.calculated_at
        from target
        join ${requestEstimates} estimate
          on estimate.id = target.estimate_id
         and estimate.request_id = target.request_id
         and estimate.source_request_version = target.request_version
         and estimate.decline_or_refer_required = false
         and ${resolvedQuoteSourceVatSql(
           sql`estimate.price_snapshot`, sql`estimate.vat_rate_basis_points`,
         )}
        for share of estimate
      ),
      estimate_evidence_integrity as materialized (
        select 1 as valid
        from selected_estimate
        where ${completeEstimateEvidenceSql({
          inputSnapshot: sql`selected_estimate.input_snapshot`,
          priceSnapshot: sql`selected_estimate.price_snapshot`,
          durationSnapshot: sql`selected_estimate.duration_snapshot`,
          availabilitySnapshot: sql`selected_estimate.availability_snapshot`,
          warnings: sql`selected_estimate.warnings`,
          reviewReasonCodes: sql`selected_estimate.review_reason_codes`,
          status: sql`selected_estimate.estimate_status`,
          priceBookCode: sql`selected_estimate.price_book_code`,
          priceBookVersion: sql`selected_estimate.price_book_version`,
          durationModelCode: sql`selected_estimate.duration_model_code`,
          durationModelVersion: sql`selected_estimate.duration_model_version`,
          netAmountMinorUnits: sql`selected_estimate.estimate_net_amount_minor_units`,
          vatRateBasisPoints: sql`selected_estimate.estimate_vat_rate_basis_points`,
          vatAmountMinorUnits: sql`selected_estimate.estimate_vat_amount_minor_units`,
          grossTotalMinorUnits: sql`selected_estimate.estimate_gross_total_minor_units`,
          currency: sql`selected_estimate.estimate_currency`,
          estimatedServiceMinutes: sql`selected_estimate.estimated_service_minutes`,
          estimatedTravelMinutes: sql`selected_estimate.estimated_travel_minutes`,
          manualAssessmentRequired: sql`selected_estimate.manual_assessment_required`,
          declineOrReferRequired: sql`selected_estimate.decline_or_refer_required`,
          calculatedAt: sql`selected_estimate.calculated_at`,
        })}
      ),
      request_item_source_rows as materialized (
        select request_item.id, request_item.service_id,
          request_item.cleaning_item_type_id, request_item.cleaning_asset_id,
          request_item.measurement_mode_id,
          request_item.customer_reported_condition_level_id,
          request_item.normalized_condition_level_id,
          request_item.reported_fibre_material_id,
          request_item.normalized_fibre_material_id,
          request_item.reported_surface_construction_id,
          request_item.normalized_surface_construction_id,
          request_item.customer_description,
          request_item.normalized_description, request_item.quantity,
          request_item.area_hundredths_m2, request_item.seat_count,
          request_item.sides, request_item.sort_order, request_item.version
        from target
        join ${serviceRequestItems} request_item
          on request_item.request_id = target.request_id
        for share of request_item
      ),
      request_issue_source_rows as materialized (
        select selected_issue.request_item_id, selected_issue.issue_type_id,
          selected_issue.customer_reported, selected_issue.staff_confirmed,
          selected_issue.notes
        from request_item_source_rows request_item
        join ${serviceRequestItemIssues} selected_issue
          on selected_issue.request_item_id = request_item.id
        for share of selected_issue
      ),
      request_addon_source_rows as materialized (
        select selected_addon.request_item_id, selected_addon.addon_id,
          selected_addon.customer_requested, selected_addon.staff_included,
          selected_addon.notes
        from request_item_source_rows request_item
        join ${serviceRequestItemAddons} selected_addon
          on selected_addon.request_item_id = request_item.id
        for share of selected_addon
      ),
      quote_item_source_rows as materialized (
        select quote_item.id, quote_item.request_item_id,
          quote_item.service_id, quote_item.cleaning_item_type_id,
          quote_item.measurement_mode_id, quote_item.description_bg,
          quote_item.description_en, quote_item.quantity,
          quote_item.measurement_snapshot,
          quote_item.base_amount_minor_units,
          quote_item.modifier_amount_minor_units,
          quote_item.addon_amount_minor_units,
          quote_item.net_amount_minor_units,
          quote_item.vat_rate_basis_points,
          quote_item.vat_amount_minor_units,
          quote_item.gross_total_minor_units,
          quote_item.calculation_snapshot, quote_item.sort_order
        from target
        join ${quoteItems} quote_item on quote_item.quote_id = target.id
        for share of quote_item
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
      issued_source_snapshot as materialized (
        select jsonb_build_object(
          'schemaVersion', 1,
          'quote', jsonb_build_object(
            'id', target.id,
            'quoteReference', target.quote_reference,
            'quoteVersion', target.quote_version,
            'recordVersion', target.record_version + 1,
            'status', 'ISSUED',
            'requestId', target.request_id,
            'sourceRequestVersion', target.source_request_version,
            'customerId', target.quote_customer_id,
            'propertyId', target.quote_property_id,
            'estimateId', target.estimate_id,
            'currency', target.currency,
            'priceBasis', target.price_basis,
            'netAmountMinorUnits', target.net_amount_minor_units,
            'vatRateBasisPoints', target.vat_rate_basis_points,
            'vatAmountMinorUnits', target.vat_amount_minor_units,
            'grossTotalMinorUnits', target.gross_total_minor_units,
            'estimatedDurationMinutes', target.estimated_duration_minutes,
            'commercialSnapshot', target.commercial_snapshot,
            'termsSnapshot', target.terms_snapshot,
            'customerNotes', target.quote_customer_notes,
            'validFrom', target.valid_from,
            'validUntil', target.valid_until,
            'issuedAt', now()
          ),
          'request', jsonb_build_object(
            'id', target.request_id,
            'status', 'QUOTED',
            'version', target.request_version + 1,
            'sourceRequestVersion', target.source_request_version,
            'customerResolutionStatus', target.customer_resolution_status,
            'customerId', target.customer_id,
            'propertyId', target.property_id,
            'preferredDate', target.preferred_date,
            'preferredWindowCode', target.preferred_window_code,
            'customerNotes', target.request_customer_notes,
            'items', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', request_item.id,
                  'version', request_item.version,
                  'serviceId', request_item.service_id,
                  'cleaningItemTypeId', request_item.cleaning_item_type_id,
                  'cleaningAssetId', request_item.cleaning_asset_id,
                  'measurementModeId', request_item.measurement_mode_id,
                  'customerReportedConditionLevelId',
                    request_item.customer_reported_condition_level_id,
                  'normalizedConditionLevelId',
                    request_item.normalized_condition_level_id,
                  'reportedFibreMaterialId',
                    request_item.reported_fibre_material_id,
                  'normalizedFibreMaterialId',
                    request_item.normalized_fibre_material_id,
                  'reportedSurfaceConstructionId',
                    request_item.reported_surface_construction_id,
                  'normalizedSurfaceConstructionId',
                    request_item.normalized_surface_construction_id,
                  'customerDescription', request_item.customer_description,
                  'normalizedDescription', request_item.normalized_description,
                  'quantity', request_item.quantity,
                  'areaHundredthsM2', request_item.area_hundredths_m2,
                  'seatCount', request_item.seat_count,
                  'sides', request_item.sides,
                  'sortOrder', request_item.sort_order,
                  'issues', coalesce((
                    select jsonb_agg(
                      jsonb_build_object(
                        'issueTypeId', selected_issue.issue_type_id,
                        'customerReported', selected_issue.customer_reported,
                        'staffConfirmed', selected_issue.staff_confirmed,
                        'notes', selected_issue.notes
                      ) order by selected_issue.issue_type_id
                    )
                    from request_issue_source_rows selected_issue
                    where selected_issue.request_item_id = request_item.id
                  ), '[]'::jsonb),
                  'addons', coalesce((
                    select jsonb_agg(
                      jsonb_build_object(
                        'addonId', selected_addon.addon_id,
                        'customerRequested', selected_addon.customer_requested,
                        'staffIncluded', selected_addon.staff_included,
                        'notes', selected_addon.notes
                      ) order by selected_addon.addon_id
                    )
                    from request_addon_source_rows selected_addon
                    where selected_addon.request_item_id = request_item.id
                  ), '[]'::jsonb)
                ) order by request_item.sort_order, request_item.id
              )
              from request_item_source_rows request_item
            ), '[]'::jsonb)
          ),
          'estimate', jsonb_build_object(
            'id', selected_estimate.estimate_id,
            'requestId', selected_estimate.estimate_request_id,
            'sourceRequestVersion',
              selected_estimate.estimate_source_request_version,
            'estimateVersion', selected_estimate.estimate_version,
            'status', selected_estimate.estimate_status,
            'priceBookId', selected_estimate.price_book_id,
            'priceBookCode', selected_estimate.price_book_code,
            'priceBookVersion', selected_estimate.price_book_version,
            'durationModelId', selected_estimate.duration_model_id,
            'durationModelCode', selected_estimate.duration_model_code,
            'durationModelVersion', selected_estimate.duration_model_version,
            'inputSnapshot', selected_estimate.input_snapshot,
            'priceSnapshot', selected_estimate.price_snapshot,
            'durationSnapshot', selected_estimate.duration_snapshot,
            'availabilitySnapshot', selected_estimate.availability_snapshot,
            'netAmountMinorUnits',
              selected_estimate.estimate_net_amount_minor_units,
            'vatRateBasisPoints',
              selected_estimate.estimate_vat_rate_basis_points,
            'vatAmountMinorUnits',
              selected_estimate.estimate_vat_amount_minor_units,
            'grossTotalMinorUnits',
              selected_estimate.estimate_gross_total_minor_units,
            'currency', selected_estimate.estimate_currency,
            'estimatedServiceMinutes',
              selected_estimate.estimated_service_minutes,
            'estimatedTravelMinutes',
              selected_estimate.estimated_travel_minutes,
            'manualAssessmentRequired',
              selected_estimate.manual_assessment_required,
            'declineOrReferRequired',
              selected_estimate.decline_or_refer_required,
            'warnings', selected_estimate.warnings,
            'reviewReasonCodes', selected_estimate.review_reason_codes,
            'calculatedAt', selected_estimate.calculated_at
          ),
          'customer', jsonb_build_object(
            'id', commercial_context.customer_id,
            'displayName', commercial_context.customer_display_name,
            'preferredLocale', commercial_context.customer_preferred_locale,
            'customerType', commercial_context.customer_type,
            'status', commercial_context.customer_status,
            'version', commercial_context.customer_version
          ),
          'property', jsonb_build_object(
            'id', commercial_context.property_id,
            'customerId', commercial_context.property_customer_id,
            'propertyType', commercial_context.property_type,
            'label', commercial_context.property_label,
            'city', commercial_context.property_city,
            'district', commercial_context.property_district,
            'streetAddress', commercial_context.property_street_address,
            'postalCode', commercial_context.property_postal_code,
            'latitude', commercial_context.property_latitude,
            'longitude', commercial_context.property_longitude,
            'accessNotes', commercial_context.property_access_notes,
            'parkingNotes', commercial_context.property_parking_notes,
            'serviceZoneId', commercial_context.service_zone_id,
            'status', commercial_context.property_status,
            'version', commercial_context.property_version
          ),
          'travelZone', jsonb_build_object(
            'id', travel_context.travel_zone_id,
            'code', travel_context.travel_zone_code,
            'active', travel_context.travel_zone_active,
            'defaultParkingPolicyId',
              travel_context.default_parking_policy_id,
            'distanceThresholdHundredthsKm',
              travel_context.distance_threshold_hundredths_km,
            'travelTimeThresholdMinutes',
              travel_context.travel_time_threshold_minutes,
            'boundaryNotes', travel_context.boundary_notes,
            'serviceEligible', travel_context.service_eligible,
            'minimumOrderOverrideMinorUnits',
              travel_context.minimum_order_override_minor_units,
            'estimatedBaseTravelMinutes',
              travel_context.estimated_base_travel_minutes,
            'manualConfirmationRequired',
              travel_context.manual_confirmation_required,
            'geographicMetadata', travel_context.geographic_metadata,
            'updatedAt', travel_context.travel_zone_updated_at
          ),
          'quoteItems', coalesce((
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
                'modifierAmountMinorUnits',
                  quote_item.modifier_amount_minor_units,
                'addonAmountMinorUnits', quote_item.addon_amount_minor_units,
                'netAmountMinorUnits', quote_item.net_amount_minor_units,
                'vatRateBasisPoints', quote_item.vat_rate_basis_points,
                'vatAmountMinorUnits', quote_item.vat_amount_minor_units,
                'grossTotalMinorUnits', quote_item.gross_total_minor_units,
                'calculationSnapshot', quote_item.calculation_snapshot,
                'sortOrder', quote_item.sort_order
              ) order by quote_item.sort_order, quote_item.id
            )
            from quote_item_source_rows quote_item
          ), '[]'::jsonb)
        ) as value
        from target, commercial_context, travel_context, selected_estimate
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
          when (select quote_customer_id from target)
              is distinct from (select customer_id from target)
            or (select quote_property_id from target)
              is distinct from (select property_id from target)
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
            or not exists (select 1 from estimate_evidence_integrity)
            or not exists (select 1 from current_request_graph)
            or not exists (select 1 from issued_source_snapshot)
            or (select commercial_snapshot
                  #>> '{sourceEstimate,priceSnapshotSha256}' from target)
              is distinct from (
                select ${priceSnapshotSha256Sql(sql`selected_estimate.price_snapshot`)}
                from selected_estimate
              )
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
          acceptance_source_snapshot = issued_source_snapshot.value,
          record_version = quote_record.record_version + 1,
          updated_at = now(),
          updated_by_profile_id = ${actorProfileId}::uuid
        from decision, issued_source_snapshot
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
