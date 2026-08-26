import type { AccountStatus } from "@/modules/identity-access/authorization";
import type {
  ApplicationRoleCode,
  PermissionCode,
} from "@/modules/identity-access/policy";
import type {
  BookingStatus,
  SchedulingStatus,
} from "@/modules/booking-engine/types";
import type {
  CapabilityStatusCode,
  RiskFlagCode,
} from "@/modules/service-catalogue/catalogue";
import type {
  CompletionBlockReasonCode,
  CompletionItemEvidence,
  CompletionReadiness,
  DurationAnalytics,
  DurationAnalyticsInput,
  FrozenMeasurementSnapshot,
  InspectionSafetyDecision,
  InspectionSafetyInput,
  InspectionSafetyReasonCode,
  JobCreationAssessment,
  JobCreationRejectionReasonCode,
  JobPreparationReviewReasonCode,
  JobStatus,
  StaffCleaningPassportEntry,
  CustomerCleaningPassportEntry,
  TeamMembershipEvidence,
  TreatmentResultClassification,
  TreatmentExecutionConformance,
  TreatmentExecutionConformanceInput,
  TreatmentPlanDecision,
} from "./types";

export type JobActor = Readonly<{
  profileId: string;
  status: AccountStatus;
  roles: ReadonlySet<ApplicationRoleCode>;
  permissions: ReadonlySet<PermissionCode>;
}>;

export type JobAccessScope = "STAFF" | "ASSIGNED_TEAM";

export type JobAuthorizationFailureCode =
  | "AUTHENTICATION_REQUIRED"
  | "ACCOUNT_UNAVAILABLE"
  | "PERMISSION_DENIED"
  | "RECORD_NOT_FOUND_OR_FORBIDDEN";

export class JobAuthorizationError extends Error {
  readonly code: JobAuthorizationFailureCode;

  constructor(code: JobAuthorizationFailureCode) {
    super(code);
    this.name = "JobAuthorizationError";
    this.code = code;
  }
}

function requireActiveActor(actor: JobActor | null): JobActor {
  if (!actor) throw new JobAuthorizationError("AUTHENTICATION_REQUIRED");
  if (actor.status !== "ACTIVE" || actor.roles.size === 0) {
    throw new JobAuthorizationError("ACCOUNT_UNAVAILABLE");
  }
  return actor;
}

function hasPermissions(
  actor: JobActor,
  required: readonly PermissionCode[],
): boolean {
  return required.every((permission) => actor.permissions.has(permission));
}

function requirePermissions(
  actorInput: JobActor | null,
  required: readonly PermissionCode[],
): JobActor {
  const actor = requireActiveActor(actorInput);
  if (!hasPermissions(actor, required)) {
    throw new JobAuthorizationError("PERMISSION_DENIED");
  }
  return actor;
}

export function isTeamMembershipActiveAt(
  membership: TeamMembershipEvidence,
  at: Date,
): boolean {
  const atMs = at.valueOf();
  return (
    membership.active &&
    Number.isFinite(atMs) &&
    membership.validFrom.valueOf() <= atMs &&
    (membership.validUntil === null || membership.validUntil.valueOf() > atMs)
  );
}

function hasExactActiveTeamMembership(
  assignedTeamId: number | null,
  memberships: readonly TeamMembershipEvidence[],
  at: Date,
): boolean {
  return (
    assignedTeamId !== null &&
    memberships.some(
      (membership) =>
        membership.operationsTeamId === assignedTeamId &&
        isTeamMembershipActiveAt(membership, at),
    )
  );
}

const staffReadPermissions = [
  "CUSTOMER_RECORDS_READ",
  "OPERATIONS_READ",
  "SCHEDULE_READ",
  "FIELD_JOBS_READ",
] as const satisfies readonly PermissionCode[];

const assignedTeamReadPermissions = [
  "OPERATIONS_READ",
  "SCHEDULE_READ",
  "FIELD_JOBS_READ",
] as const satisfies readonly PermissionCode[];

const assignedTeamUpdatePermissions = [
  ...assignedTeamReadPermissions,
  "FIELD_JOBS_UPDATE",
] as const satisfies readonly PermissionCode[];

/**
 * Staff receive broad operational scope only from the complete staff
 * permission conjunction. Everyone else must prove a fresh, exact membership
 * in the Job's assigned team.
 */
export function requireJobRead(
  actorInput: JobActor | null,
  input: Readonly<{
    assignedTeamId: number | null;
    memberships: readonly TeamMembershipEvidence[];
    at: Date;
  }>,
): JobAccessScope {
  const actor = requireActiveActor(actorInput);
  if (hasPermissions(actor, staffReadPermissions)) return "STAFF";
  if (!hasPermissions(actor, assignedTeamReadPermissions)) {
    throw new JobAuthorizationError("PERMISSION_DENIED");
  }
  if (
    !hasExactActiveTeamMembership(
      input.assignedTeamId,
      input.memberships,
      input.at,
    )
  ) {
    throw new JobAuthorizationError("RECORD_NOT_FOUND_OR_FORBIDDEN");
  }
  return "ASSIGNED_TEAM";
}

/** Owner/Admin execute through operational authority; technicians need team scope. */
export function requireJobExecutionUpdate(
  actorInput: JobActor | null,
  input: Readonly<{
    assignedTeamId: number | null;
    memberships: readonly TeamMembershipEvidence[];
    at: Date;
  }>,
): JobAccessScope {
  const actor = requirePermissions(actorInput, assignedTeamUpdatePermissions);
  if (actor.permissions.has("OPERATIONS_MANAGE")) return "STAFF";
  if (
    !hasExactActiveTeamMembership(
      input.assignedTeamId,
      input.memberships,
      input.at,
    )
  ) {
    throw new JobAuthorizationError("RECORD_NOT_FOUND_OR_FORBIDDEN");
  }
  return "ASSIGNED_TEAM";
}

export function requireJobAssignment(actor: JobActor | null): void {
  requirePermissions(actor, [
    "FIELD_JOBS_READ",
    "OPERATIONS_MANAGE",
    "SCHEDULE_MANAGE",
  ]);
}

export function requireJobCancellation(actor: JobActor | null): void {
  requirePermissions(actor, [
    "FIELD_JOBS_READ",
    "OPERATIONS_MANAGE",
    "SCHEDULE_MANAGE",
  ]);
}

export function requireStaffAssetHistoryRead(actor: JobActor | null): void {
  requirePermissions(actor, [
    "CUSTOMER_RECORDS_READ",
    "OPERATIONS_READ",
    "FIELD_JOBS_READ",
  ]);
}

export function requireCustomerCleaningPassportRead(
  actor: JobActor | null,
  hasExactActiveCustomerAssetLink: boolean,
): void {
  requirePermissions(actor, ["OWN_CUSTOMER_DATA_READ"]);
  if (!hasExactActiveCustomerAssetLink) {
    throw new JobAuthorizationError("RECORD_NOT_FOUND_OR_FORBIDDEN");
  }
}

export type JobCreationEvidence = Readonly<{
  existingJobReference: string | null;
  bookingExists: boolean;
  bookingStatus: BookingStatus | null;
  schedulingStatus: SchedulingStatus | null;
  customerPropertyConsistent: boolean;
  issuedQuoteSnapshotValid: boolean;
  bookingQuoteProvenanceConsistent: boolean;
  bookingItemsComplete: boolean;
  bookingItemsMatchIssuedSnapshot: boolean;
  assetReferencesConsistent: boolean;
  confirmedOccupancyConsistent: boolean;
  assignedTeamEligible: boolean;
  requiredCapabilitiesSatisfied: boolean;
  requiredEquipmentSatisfied: boolean;
}>;

/**
 * Determines whether immutable Booking evidence can be copied into a Job.
 * Provenance failures are rejected rather than repaired or recalculated.
 */
export function assessJobCreation(
  evidence: JobCreationEvidence,
): JobCreationAssessment {
  if (evidence.existingJobReference) {
    return { state: "EXISTING", jobReference: evidence.existingJobReference };
  }

  const rejectionReasonCodes: JobCreationRejectionReasonCode[] = [];
  if (!evidence.bookingExists) rejectionReasonCodes.push("BOOKING_NOT_FOUND");
  if (evidence.bookingStatus === "CANCELLED") {
    rejectionReasonCodes.push("BOOKING_CANCELLED");
  } else if (
    evidence.bookingExists &&
    evidence.bookingStatus !== "PENDING_SCHEDULING" &&
    evidence.bookingStatus !== "CONFIRMED"
  ) {
    rejectionReasonCodes.push("BOOKING_STATUS_UNSUPPORTED");
  }
  if (!evidence.customerPropertyConsistent) {
    rejectionReasonCodes.push("CUSTOMER_PROPERTY_INCONSISTENT");
  }
  if (!evidence.issuedQuoteSnapshotValid) {
    rejectionReasonCodes.push("ISSUED_QUOTE_SNAPSHOT_INVALID");
  }
  if (!evidence.bookingQuoteProvenanceConsistent) {
    rejectionReasonCodes.push("BOOKING_QUOTE_PROVENANCE_INCONSISTENT");
  }
  if (!evidence.bookingItemsComplete) {
    rejectionReasonCodes.push("BOOKING_ITEMS_INCOMPLETE");
  }
  if (!evidence.bookingItemsMatchIssuedSnapshot) {
    rejectionReasonCodes.push("BOOKING_ITEMS_DO_NOT_MATCH_ISSUED_SNAPSHOT");
  }
  if (!evidence.assetReferencesConsistent) {
    rejectionReasonCodes.push("ASSET_REFERENCE_INCONSISTENT");
  }

  if (rejectionReasonCodes.length > 0) {
    return { state: "REJECTED", reasonCodes: rejectionReasonCodes };
  }

  const reviewReasonCodes: JobPreparationReviewReasonCode[] = [];
  if (evidence.bookingStatus !== "CONFIRMED") {
    reviewReasonCodes.push("BOOKING_NOT_CONFIRMED");
  }
  if (evidence.schedulingStatus === "UNSCHEDULED") {
    reviewReasonCodes.push("SCHEDULE_UNSCHEDULED");
  } else if (evidence.schedulingStatus !== "SCHEDULED") {
    reviewReasonCodes.push("SCHEDULE_REVIEW_REQUIRED");
  }
  if (!evidence.confirmedOccupancyConsistent) {
    reviewReasonCodes.push("CONFIRMED_OCCUPANCY_INCONSISTENT");
  }
  if (!evidence.assignedTeamEligible) {
    reviewReasonCodes.push("TEAM_INELIGIBLE");
  }
  if (!evidence.requiredCapabilitiesSatisfied) {
    reviewReasonCodes.push("CAPABILITY_MISMATCH");
  }
  if (!evidence.requiredEquipmentSatisfied) {
    reviewReasonCodes.push("EQUIPMENT_MISMATCH");
  }

  return reviewReasonCodes.length === 0
    ? { state: "READY", reviewReasonCodes: [] }
    : { state: "PREPARED", reviewReasonCodes };
}

export type JobTransitionDecision = Readonly<{
  state: "TRANSITION" | "NO_CHANGE" | "DENIED";
  serverTimestampField:
    | "enRouteAt"
    | "arrivedAt"
    | "startedAt"
    | "completedAt"
    | "cancelledAt"
    | null;
}>;

const allowedJobTransitions: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  PREPARED: ["READY", "REQUIRES_REVIEW", "CANCELLED"],
  READY: ["EN_ROUTE", "REQUIRES_REVIEW", "CANCELLED"],
  EN_ROUTE: ["ARRIVED", "REQUIRES_REVIEW", "CANCELLED"],
  ARRIVED: ["IN_PROGRESS", "REQUIRES_REVIEW", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "REQUIRES_REVIEW"],
  REQUIRES_REVIEW: ["CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const transitionTimestampFields: Partial<
  Record<
    JobStatus,
    Exclude<JobTransitionDecision["serverTimestampField"], null>
  >
> = {
  EN_ROUTE: "enRouteAt",
  ARRIVED: "arrivedAt",
  IN_PROGRESS: "startedAt",
  COMPLETED: "completedAt",
  CANCELLED: "cancelledAt",
};

export function decideJobTransition(
  current: JobStatus,
  target: JobStatus,
): JobTransitionDecision {
  if (current === target) {
    return { state: "NO_CHANGE", serverTimestampField: null };
  }
  if (!allowedJobTransitions[current].includes(target)) {
    return { state: "DENIED", serverTimestampField: null };
  }
  return {
    state: "TRANSITION",
    serverTimestampField: transitionTimestampFields[target] ?? null,
  };
}

export function decideJobCancellation(
  current: JobStatus,
  startedAt: Date | null,
): JobTransitionDecision {
  if (current === "CANCELLED") {
    return { state: "NO_CHANGE", serverTimestampField: null };
  }
  if (current === "COMPLETED" || current === "IN_PROGRESS" || startedAt) {
    return { state: "DENIED", serverTimestampField: null };
  }
  return { state: "TRANSITION", serverTimestampField: "cancelledAt" };
}

export function decideTeamAssignment(input: Readonly<{
  status: JobStatus;
  currentTeamId: number | null;
  targetTeamId: number;
}>): "ASSIGN" | "NO_CHANGE" | "DENIED" {
  if (input.currentTeamId === input.targetTeamId) return "NO_CHANGE";
  return input.status === "PREPARED" || input.status === "READY"
    ? "ASSIGN"
    : "DENIED";
}

function measurementsMatch(
  planned: FrozenMeasurementSnapshot,
  observed: FrozenMeasurementSnapshot,
): boolean {
  return (
    planned.measurementModeId === observed.measurementModeId &&
    planned.quantity === observed.quantity &&
    planned.areaHundredthsM2 === observed.areaHundredthsM2 &&
    planned.seatCount === observed.seatCount &&
    planned.sides === observed.sides
  );
}

const elevatedReviewRisks = new Set<RiskFlagCode>([
  "DELICATE_MATERIAL",
  "UNKNOWN_FIBRE",
  "VALUABLE_ITEM",
  "ANTIQUE_OR_VINTAGE",
  "COLOURFASTNESS_CONCERN",
  "MOISTURE_SENSITIVE",
  "LOOSE_SEAMS",
  "FRAYING",
  "SHRINKAGE_RISK",
  "DYE_BLEED_RISK",
  "HANDMADE",
  "CUSTOMER_DECLARED_SPECIAL_VALUE",
]);

function capabilityRequiresReview(status: CapabilityStatusCode): boolean {
  return status === "SPECIALIST_ONLY" || status === "UNAVAILABLE";
}

/**
 * Fail-closed on any material scope, safety, specialist or unquoted-add-on
 * difference. The result never changes price or rewrites planned evidence.
 */
export function assessInspectionSafety(
  input: InspectionSafetyInput,
): InspectionSafetyDecision {
  const reasonCodes: InspectionSafetyReasonCode[] = [];
  if (input.unsafeContaminationObserved) {
    reasonCodes.push("UNSAFE_CONTAMINATION");
  }
  if (input.unsafeStructuralConditionObserved) {
    reasonCodes.push("UNSAFE_STRUCTURAL_CONDITION");
  }
  if (input.issueHandlingClassifications.includes("DECLINE_OR_REFER")) {
    reasonCodes.push("DECLINE_OR_REFER_ISSUE");
  }
  if (input.plannedCleaningItemTypeId !== input.observedCleaningItemTypeId) {
    reasonCodes.push("CLEANING_ITEM_TYPE_CHANGED");
  }
  if (!measurementsMatch(input.plannedMeasurement, input.observedMeasurement)) {
    reasonCodes.push("MEASUREMENT_CHANGED");
  }
  if (input.issueHandlingClassifications.includes("SPECIALIST_ONLY")) {
    reasonCodes.push("SPECIALIST_ISSUE");
  }
  if (input.riskCodes.some((code) => elevatedReviewRisks.has(code))) {
    reasonCodes.push("ELEVATED_MATERIAL_RISK");
  }
  if (capabilityRequiresReview(input.serviceCapabilityStatus)) {
    reasonCodes.push("SERVICE_CAPABILITY_REQUIRES_REVIEW");
  }
  if (capabilityRequiresReview(input.treatmentCapabilityStatus)) {
    reasonCodes.push("TREATMENT_CAPABILITY_REQUIRES_REVIEW");
  }
  const quotedAddonIds = new Set(input.quotedAddonIds);
  if (input.requiredAddonIds.some((id) => !quotedAddonIds.has(id))) {
    reasonCodes.push("UNQUOTED_ADDON_REQUIRED");
  }

  const declineOrReferReasons: readonly InspectionSafetyReasonCode[] = [
    "UNSAFE_CONTAMINATION",
    "UNSAFE_STRUCTURAL_CONDITION",
    "DECLINE_OR_REFER_ISSUE",
  ];
  if (reasonCodes.some((reason) => declineOrReferReasons.includes(reason))) {
    return { state: "DECLINE_OR_REFER", reasonCodes };
  }
  return reasonCodes.length > 0
    ? { state: "REQUIRES_REVIEW", reasonCodes }
    : { state: "PROCEED", reasonCodes: [] };
}

export type TreatmentPlanSafetyDecision = Readonly<{
  state: "ALLOWED" | "REQUIRES_REVIEW" | "INVALID_DECISION";
  reasonCodes: readonly (
    | "INSPECTION_REQUIRES_REVIEW"
    | "DECLINE_OR_REFER_REQUIRED"
    | "MATERIAL_SCOPE_CHANGE"
  )[];
}>;

export function assessTreatmentPlanSafety(input: Readonly<{
  inspectionDecision: InspectionSafetyDecision["state"];
  treatmentDecision: TreatmentPlanDecision;
  materialScopeChange: boolean;
}>): TreatmentPlanSafetyDecision {
  if (input.materialScopeChange) {
    return input.treatmentDecision === "REQUIRES_REVIEW"
      ? { state: "REQUIRES_REVIEW", reasonCodes: ["MATERIAL_SCOPE_CHANGE"] }
      : { state: "INVALID_DECISION", reasonCodes: ["MATERIAL_SCOPE_CHANGE"] };
  }
  if (input.inspectionDecision === "DECLINE_OR_REFER") {
    return input.treatmentDecision === "DECLINE" ||
      input.treatmentDecision === "REFER"
      ? { state: "ALLOWED", reasonCodes: ["DECLINE_OR_REFER_REQUIRED"] }
      : {
          state: "INVALID_DECISION",
          reasonCodes: ["DECLINE_OR_REFER_REQUIRED"],
        };
  }
  if (input.inspectionDecision === "REQUIRES_REVIEW") {
    return input.treatmentDecision === "REQUIRES_REVIEW"
      ? {
          state: "REQUIRES_REVIEW",
          reasonCodes: ["INSPECTION_REQUIRES_REVIEW"],
        }
      : {
          state: "INVALID_DECISION",
          reasonCodes: ["INSPECTION_REQUIRES_REVIEW"],
        };
  }
  return input.treatmentDecision === "REQUIRES_REVIEW"
    ? {
        state: "REQUIRES_REVIEW",
        reasonCodes: ["INSPECTION_REQUIRES_REVIEW"],
      }
    : { state: "ALLOWED", reasonCodes: [] };
}

/** A safety stop is recorded but cannot be treated as a resolved item. */
export function executionResultResolution(
  result: TreatmentResultClassification,
): "RESOLVED" | "REQUIRES_REVIEW" {
  return result === "STOPPED_FOR_SAFETY" ? "REQUIRES_REVIEW" : "RESOLVED";
}

function sameReferenceSet(left: readonly number[], right: readonly number[]) {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    new Set(right).size === right.length &&
    left.every((value) => right.includes(value))
  );
}

/**
 * Actual execution is compared with the confirmed plan. Deviations are kept as
 * observed facts but block ordinary completion for staff review.
 */
export function assessTreatmentExecutionConformance(
  input: TreatmentExecutionConformanceInput,
): TreatmentExecutionConformance {
  if (
    input.treatmentPlanDecision !== "PERFORM" &&
    input.treatmentPlanDecision !== "PERFORM_WITH_LIMITATIONS"
  ) {
    return { state: "DENIED", reasonCodes: ["PLAN_NOT_PERFORMABLE"] };
  }

  const reasonCodes: TreatmentExecutionConformance["reasonCodes"][number][] =
    [];
  if (input.plannedTreatmentLevelId !== input.performedTreatmentLevelId) {
    reasonCodes.push("TREATMENT_LEVEL_CHANGED");
  }
  if (
    input.plannedMechanicalActionLevelId !==
    input.performedMechanicalActionLevelId
  ) {
    reasonCodes.push("MECHANICAL_ACTION_CHANGED");
  }
  if (
    input.plannedTreatmentApproachId !== input.performedTreatmentApproachId
  ) {
    reasonCodes.push("TREATMENT_APPROACH_CHANGED");
  }
  if (!sameReferenceSet(input.plannedAddonIds, input.performedAddonIds)) {
    reasonCodes.push("ADDONS_CHANGED");
  }
  if (input.plannedCleaningProductId !== input.performedCleaningProductId) {
    reasonCodes.push("PRODUCT_CHANGED");
  }
  if (input.resultClassification === "STOPPED_FOR_SAFETY") {
    reasonCodes.push("STOPPED_FOR_SAFETY");
  }

  return reasonCodes.length === 0
    ? { state: "CONFORMS", reasonCodes: [] }
    : { state: "REQUIRES_REVIEW", reasonCodes };
}

export function assessCompletionReadiness(input: Readonly<{
  jobStatus: JobStatus;
  items: readonly CompletionItemEvidence[];
}>): CompletionReadiness {
  const reasons = new Set<CompletionBlockReasonCode>();
  if (input.jobStatus !== "IN_PROGRESS") reasons.add("JOB_NOT_IN_PROGRESS");
  if (input.items.length === 0) reasons.add("NO_JOB_ITEMS");

  for (const item of input.items) {
    if (item.status === "REQUIRES_REVIEW") reasons.add("REVIEW_REQUIRED");
    if (!item.inspectionRecorded) reasons.add("INSPECTION_MISSING");
    if (!item.treatmentPlanRecorded) reasons.add("TREATMENT_PLAN_MISSING");

    if (item.status === "COMPLETED") {
      if (!item.treatmentExecutionCompleted) {
        reasons.add("TREATMENT_EXECUTION_INCOMPLETE");
      }
      continue;
    }
    if (item.status === "DECLINED" || item.status === "REFERRED") continue;
    reasons.add("ITEM_UNRESOLVED");
  }

  const reasonCodes = [...reasons];
  return reasonCodes.length === 0
    ? { state: "READY", reasonCodes: [] }
    : { state: "BLOCKED", reasonCodes };
}

/** Whitelist-only customer projection; internal notes, risks and snapshots stay out. */
export function toCustomerCleaningPassportEntry(
  entry: StaffCleaningPassportEntry,
): CustomerCleaningPassportEntry {
  return {
    jobReference: entry.jobReference,
    completedAt: entry.completedAt,
    serviceDescription: entry.serviceDescription,
    observedConditionSummary: entry.observedConditionSummary,
    treatmentSummary: entry.treatmentSummary,
    resultClassification: entry.resultClassification,
    careRecommendation: entry.careRecommendation,
    maintenanceRecommendation: entry.maintenanceRecommendation,
  };
}

function requireNonnegativeSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a nonnegative safe integer.`);
  }
}

function requirePositiveSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${field} must be a positive safe integer.`);
  }
}

function safeProduct(left: number, right: number, field: string): number {
  const result = left * right;
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`${field} exceeds the safe integer range.`);
  }
  return result;
}

/**
 * Derives operational analytics from stored facts. An optional immutable Quote
 * aggregate is accepted only to calculate a ratio; no price is created or
 * changed by this module.
 */
export function deriveDurationAnalytics(
  input: DurationAnalyticsInput,
): DurationAnalytics {
  if (input.plannedDurationMinutes !== null) {
    requireNonnegativeSafeInteger(
      input.plannedDurationMinutes,
      "plannedDurationMinutes",
    );
  }
  requireNonnegativeSafeInteger(
    input.actualProductiveMinutes,
    "actualProductiveMinutes",
  );
  requireNonnegativeSafeInteger(
    input.actualOccupiedMinutes,
    "actualOccupiedMinutes",
  );
  if (input.actualProductiveMinutes > input.actualOccupiedMinutes) {
    throw new RangeError(
      "actualProductiveMinutes cannot exceed actualOccupiedMinutes.",
    );
  }
  requirePositiveSafeInteger(
    input.plannedTechnicianCount,
    "plannedTechnicianCount",
  );
  requirePositiveSafeInteger(
    input.actualTechnicianCount,
    "actualTechnicianCount",
  );
  if (
    input.immutableQuotedRevenueMinorUnits !== undefined &&
    input.immutableQuotedRevenueMinorUnits !== null
  ) {
    requireNonnegativeSafeInteger(
      input.immutableQuotedRevenueMinorUnits,
      "immutableQuotedRevenueMinorUnits",
    );
  }

  const plannedTeamMinutes =
    input.plannedDurationMinutes === null
      ? null
      : safeProduct(
          input.plannedDurationMinutes,
          input.plannedTechnicianCount,
          "plannedTeamMinutes",
        );
  const actualTeamMinutes = safeProduct(
    input.actualOccupiedMinutes,
    input.actualTechnicianCount,
    "actualTeamMinutes",
  );
  const quotedRevenue = input.immutableQuotedRevenueMinorUnits ?? null;

  return {
    plannedDurationMinutes: input.plannedDurationMinutes,
    actualProductiveMinutes: input.actualProductiveMinutes,
    productiveVarianceMinutes:
      input.plannedDurationMinutes === null
        ? null
        : input.actualProductiveMinutes - input.plannedDurationMinutes,
    actualOccupiedMinutes: input.actualOccupiedMinutes,
    plannedTeamMinutes,
    actualTeamMinutes,
    plannedTeamHours:
      plannedTeamMinutes === null ? null : plannedTeamMinutes / 60,
    actualTeamHours: actualTeamMinutes / 60,
    immutableQuotedRevenuePerActualTeamHourMinorUnits:
      quotedRevenue === null || actualTeamMinutes === 0
        ? null
        : Math.round((quotedRevenue / actualTeamMinutes) * 60),
  };
}
