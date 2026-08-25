export const requestSources = [
  "PUBLIC_WEB",
  "CUSTOMER_PORTAL",
  "STAFF_CREATED",
] as const;
export type RequestSource = (typeof requestSources)[number];

export const requestStatuses = [
  "SUBMITTED",
  "IN_REVIEW",
  "NEEDS_REVIEW",
  "READY_TO_QUOTE",
  "QUOTED",
  "CLOSED",
  "DECLINED",
] as const;
export type RequestStatus = (typeof requestStatuses)[number];

export const customerResolutionStatuses = [
  "UNRESOLVED",
  "MATCH_CANDIDATE",
  "LINKED",
  "NEW_CUSTOMER_REQUIRED",
] as const;
export type CustomerResolutionStatus =
  (typeof customerResolutionStatuses)[number];

export const estimateStatuses = [
  "CALCULATED",
  "REVIEW_REQUIRED",
  "DECLINE_OR_REFER",
] as const;
export type EstimateStatus = (typeof estimateStatuses)[number];

export const quoteStatuses = [
  "DRAFT",
  "ISSUED",
  "SUPERSEDED",
  "EXPIRED",
  "WITHDRAWN",
] as const;
export type QuoteStatus = (typeof quoteStatuses)[number];

export const businessAuditEntityTypes = [
  "SERVICE_REQUEST",
  "REQUEST_ESTIMATE",
  "QUOTE",
] as const;
export type BusinessAuditEntityType = (typeof businessAuditEntityTypes)[number];

export const businessAuditEventTypes = [
  "REQUEST_SUBMITTED",
  "REQUEST_LINKED",
  "REQUEST_STATUS_CHANGED",
  "REQUEST_NORMALIZED",
  "ESTIMATE_CREATED",
  "QUOTE_DRAFT_CREATED",
  "QUOTE_DRAFT_UPDATED",
  "QUOTE_ISSUED",
  "QUOTE_SUPERSEDED",
  "QUOTE_WITHDRAWN",
  "QUOTE_EXPIRED",
] as const;
export type BusinessAuditEventType = (typeof businessAuditEventTypes)[number];

export const businessAuditSources = [
  "PUBLIC_WEB",
  "CUSTOMER_PORTAL",
  "STAFF",
  "SYSTEM",
] as const;
export type BusinessAuditSource = (typeof businessAuditSources)[number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  JsonPrimitive | { readonly [key: string]: JsonValue } | readonly JsonValue[];
export type JsonObject = Readonly<Record<string, JsonValue>>;

export type StoredPriceLine = Readonly<{
  kind: string;
  label: string;
  amountMinorUnits: number;
  ruleId: string;
}>;

/** Complete, immutable commercial evidence for a historical estimate. */
export type StoredPriceSnapshot = Readonly<{
  schemaVersion: 1;
  calculatedAt: string;
  priceBook: Readonly<{
    id: string;
    code: string;
    version: number;
    status: string;
    provisional: boolean;
    approvedForPublication: boolean;
  }>;
  configuration: JsonObject;
  input: JsonObject;
  result: Readonly<{
    lines: readonly StoredPriceLine[];
    subtotalMinorUnits: number;
    minimumVisitAdjustmentMinorUnits: number | null;
    netAmountMinorUnits: number | null;
    vatRateBasisPoints: number;
    vatAmountMinorUnits: number | null;
    grossTotalMinorUnits: number | null;
    currency: "EUR";
    warnings: readonly string[];
    manualAssessmentRequired: boolean;
    declineOrReferRequired: boolean;
    appliedRuleIds: readonly string[];
  }>;
}>;

export type StoredDurationLine = Readonly<{
  kind: string;
  label: string;
  minutes: number;
  ruleId: string;
}>;

/** Complete, immutable operational-duration evidence for a historical estimate. */
export type StoredDurationSnapshot = Readonly<{
  schemaVersion: 1;
  calculatedAt: string;
  durationModel: Readonly<{
    id: string;
    code: string;
    version: number;
    status: string;
    provisional: boolean;
  }>;
  configuration: JsonObject;
  input: JsonObject;
  result: Readonly<{
    lines: readonly StoredDurationLine[];
    setupMinutes: number;
    inspectionMinutes: number;
    baseCleaningMinutes: number;
    modifierMinutes: number;
    addonMinutes: number;
    cleanupMinutes: number;
    partialEstimatedMinutes: number;
    totalEstimatedMinutes: number | null;
    warnings: readonly string[];
    manualAssessmentRequired: boolean;
    declineOrReferRequired: boolean;
    appliedRuleIds: readonly string[];
  }>;
}>;

/** Staff-only advisory evidence. It never reserves time or creates occupancy. */
export type StoredAvailabilitySnapshot = Readonly<{
  schemaVersion: 1;
  calculatedAt: string;
  configuration: JsonObject;
  result: Readonly<{
    serviceEligible: boolean | null;
    manualConfirmationRequired: boolean;
    schedulingConfigurationReady: boolean;
  }>;
}>;

export type RequestItemInput = Readonly<{
  serviceId?: number | null;
  cleaningItemTypeId?: number | null;
  cleaningAssetId?: string | null;
  measurementModeId?: number | null;
  customerReportedConditionLevelId?: number | null;
  normalizedConditionLevelId?: number | null;
  reportedFibreMaterialId?: number | null;
  normalizedFibreMaterialId?: number | null;
  reportedSurfaceConstructionId?: number | null;
  normalizedSurfaceConstructionId?: number | null;
  customerDescription: string;
  normalizedDescription?: string | null;
  quantity: number;
  areaHundredthsM2?: number | null;
  seatCount?: number | null;
  sides?: 1 | 2 | null;
  sortOrder: number;
  issueTypeIds: readonly number[];
  addonIds: readonly number[];
}>;

/** Staff-owned interpretation; customer-reported source fields are excluded. */
export type NormalizeRequestItemInput = Readonly<
  Pick<
    RequestItemInput,
    | "serviceId"
    | "cleaningItemTypeId"
    | "cleaningAssetId"
    | "measurementModeId"
    | "normalizedConditionLevelId"
    | "normalizedFibreMaterialId"
    | "normalizedSurfaceConstructionId"
    | "normalizedDescription"
    | "quantity"
    | "areaHundredthsM2"
    | "seatCount"
    | "sides"
    | "sortOrder"
    | "issueTypeIds"
    | "addonIds"
  > & {
    itemId: string;
    expectedVersion: number;
  }
>;

export type QuoteLineInput = Readonly<{
  requestItemId?: string | null;
  serviceId?: number | null;
  cleaningItemTypeId?: number | null;
  measurementModeId?: number | null;
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

export type ManualReviewSignal =
  | "SPECIALIST_TEXTILE"
  | "UNSUPPORTED_CONTAMINATION"
  | "MISSING_MATERIAL"
  | "MISSING_MEASUREMENT"
  | "OUTSIDE_SOFIA"
  | "UNKNOWN_ITEM"
  | "UNAVAILABLE_CAPABILITY"
  | "UNCERTAIN_DURATION"
  | "MANUAL_PRICING_RULE";
