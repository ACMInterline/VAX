import type { JsonObject } from "@/modules/request-quote/types";
import type {
  CapabilityStatusCode,
  ConditionLevelCode,
  IssueHandlingClassificationCode,
  RiskFlagCode,
} from "@/modules/service-catalogue/catalogue";

export const jobStatuses = [
  "PREPARED",
  "READY",
  "EN_ROUTE",
  "ARRIVED",
  "IN_PROGRESS",
  "REQUIRES_REVIEW",
  "COMPLETED",
  "CANCELLED",
] as const;
export type JobStatus = (typeof jobStatuses)[number];

export const jobItemStatuses = [
  "PENDING_INSPECTION",
  "INSPECTED",
  "TREATMENT_CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "DECLINED",
  "REFERRED",
  "REQUIRES_REVIEW",
] as const;
export type JobItemStatus = (typeof jobItemStatuses)[number];

export const treatmentPlanDecisions = [
  "PERFORM",
  "PERFORM_WITH_LIMITATIONS",
  "DECLINE",
  "REFER",
  "REQUIRES_REVIEW",
] as const;
export type TreatmentPlanDecision = (typeof treatmentPlanDecisions)[number];

export const treatmentExecutionStatuses = [
  "IN_PROGRESS",
  "COMPLETED",
] as const;
export type TreatmentExecutionStatus =
  (typeof treatmentExecutionStatuses)[number];

export const treatmentResultClassifications = [
  "COMPLETED_AS_PLANNED",
  "COMPLETED_WITH_LIMITATIONS",
  "PARTIAL_IMPROVEMENT",
  "NO_OBSERVABLE_IMPROVEMENT",
  "STOPPED_FOR_SAFETY",
] as const;
export type TreatmentResultClassification =
  (typeof treatmentResultClassifications)[number];

export const jobAuditEventTypes = [
  "JOB_CREATED",
  "TEAM_ASSIGNED",
  "JOB_READY",
  "EN_ROUTE",
  "ARRIVED",
  "WORK_STARTED",
  "INSPECTION_COMPLETED",
  "TREATMENT_CONFIRMED",
  "TREATMENT_STARTED",
  "TREATMENT_COMPLETED",
  "ITEM_DECLINED",
  "ITEM_REFERRED",
  "JOB_COMPLETED",
  "PASSPORT_ENTRY_CREATED",
  "JOB_CANCELLED",
  "REQUIRES_REVIEW",
] as const;
export type JobAuditEventType = (typeof jobAuditEventTypes)[number];

export const jobAuditSources = ["STAFF", "TECHNICIAN", "SYSTEM"] as const;
export type JobAuditSource = (typeof jobAuditSources)[number];

export const jobCancellationReasonCategories = [
  "CUSTOMER_REQUEST",
  "OPERATIONAL",
  "SAFETY",
  "DUPLICATE",
  "OTHER",
] as const;
export type JobCancellationReasonCategory =
  (typeof jobCancellationReasonCategories)[number];

export const itemResolutionReasonCategories = [
  "UNSAFE_CONTAMINATION",
  "UNSAFE_MATERIAL",
  "UNSAFE_STRUCTURE",
  "SEVERE_DYE_BLEED_RISK",
  "UNSUPPORTED_VALUABLE_TEXTILE",
  "SPECIALIST_HANDLING_REQUIRED",
  "CUSTOMER_DECLINED_CHANGED_SCOPE",
  "OTHER_RECORDED",
] as const;
export type ItemResolutionReasonCategory =
  (typeof itemResolutionReasonCategories)[number];

export type JobCreationRejectionReasonCode =
  | "BOOKING_NOT_FOUND"
  | "BOOKING_CANCELLED"
  | "BOOKING_STATUS_UNSUPPORTED"
  | "CUSTOMER_PROPERTY_INCONSISTENT"
  | "ISSUED_QUOTE_SNAPSHOT_INVALID"
  | "BOOKING_QUOTE_PROVENANCE_INCONSISTENT"
  | "BOOKING_ITEMS_INCOMPLETE"
  | "BOOKING_ITEMS_DO_NOT_MATCH_ISSUED_SNAPSHOT"
  | "ASSET_REFERENCE_INCONSISTENT";

export type JobPreparationReviewReasonCode =
  | "BOOKING_NOT_CONFIRMED"
  | "SCHEDULE_UNSCHEDULED"
  | "SCHEDULE_REVIEW_REQUIRED"
  | "CONFIRMED_OCCUPANCY_INCONSISTENT"
  | "TEAM_INELIGIBLE"
  | "CAPABILITY_MISMATCH"
  | "EQUIPMENT_MISMATCH";

export type JobCreationAssessment =
  | Readonly<{ state: "EXISTING"; jobReference: string }>
  | Readonly<{
      state: "REJECTED";
      reasonCodes: readonly JobCreationRejectionReasonCode[];
    }>
  | Readonly<{ state: "READY"; reviewReasonCodes: readonly [] }>
  | Readonly<{
      state: "PREPARED";
      reviewReasonCodes: readonly JobPreparationReviewReasonCode[];
    }>;

export type FrozenMeasurementSnapshot = Readonly<{
  measurementModeId: number;
  quantity: number;
  areaHundredthsM2: number | null;
  seatCount: number | null;
  sides: 1 | 2 | null;
}>;

/**
 * Execution authority copied from the immutable issued-quote/Booking chain.
 * Field observations are persisted separately and never update this shape.
 */
export type PlannedJobItemSnapshot = Readonly<{
  bookingItemId: string;
  requestItemId: string;
  cleaningAssetId: string | null;
  serviceId: number;
  cleaningItemTypeId: number;
  descriptionBg: string;
  descriptionEn: string;
  customerDescription: string;
  measurement: FrozenMeasurementSnapshot;
  plannedConditionLevelId: number | null;
  plannedFibreMaterialId: number | null;
  plannedSurfaceConstructionId: number | null;
  quotedAddonIds: readonly number[];
  treatmentAssumptions: JsonObject;
  sortOrder: number;
}>;

export type JobVisitContactSnapshot = Readonly<{
  contactName: string;
  email: string | null;
  phone: string | null;
  sourceContactId: string | null;
  sourceContactVersion: number | null;
  capturedAt: Date;
}>;

export type JobPropertySnapshot = Readonly<{
  label: string;
  address: string;
  accessNotes: string | null;
  parkingNotes: string | null;
}>;

export type JobSummary = Readonly<{
  jobReference: string;
  bookingReference: string;
  status: JobStatus;
  manualReviewRequired: boolean;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  customerDisplayName: string;
  propertyLabel: string;
  propertyAddress: string;
  assignedTeamCode: string | null;
  assignedTeamName: string | null;
  itemCount: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export type JobInspectionIssue = Readonly<{
  issueTypeId: number;
  handlingClassification: IssueHandlingClassificationCode;
  technicianNote: string | null;
}>;

export type JobInspectionRisk = Readonly<{
  riskFlagId: number;
  code: RiskFlagCode;
  technicianNote: string | null;
}>;

export type JobItemInspection = Readonly<{
  id: string;
  sourceJobItemVersion: number;
  observedCleaningItemTypeId: number;
  observedMeasurement: FrozenMeasurementSnapshot;
  observedConditionLevelId: number;
  observedConditionCode: ConditionLevelCode;
  confirmedFibreMaterialId: number;
  confirmedSurfaceConstructionId: number;
  existingDamageObserved: boolean;
  existingDamageNotes: string | null;
  colourfastnessConcern: boolean;
  moistureSensitivity: boolean;
  unsafeContaminationObserved: boolean;
  unsafeStructuralConditionObserved: boolean;
  technicianNotes: string | null;
  issues: readonly JobInspectionIssue[];
  risks: readonly JobInspectionRisk[];
  inspectedAt: Date;
  inspectedByProfileId: string | null;
}>;

export type JobItemTreatmentPlan = Readonly<{
  id: string;
  sourceJobItemVersion: number;
  decision: TreatmentPlanDecision;
  treatmentLevelId: number | null;
  mechanicalActionLevelId: number | null;
  treatmentApproachId: number | null;
  addonIds: readonly number[];
  cleaningProductId: number | null;
  materialScopeChange: boolean;
  technicianRationale: string;
  confirmedAt: Date;
  confirmedByProfileId: string | null;
}>;

export type JobItemTreatmentExecution = Readonly<{
  id: string;
  status: TreatmentExecutionStatus;
  performedTreatmentLevelId: number;
  performedMechanicalActionLevelId: number;
  performedTreatmentApproachId: number;
  performedAddonIds: readonly number[];
  cleaningProductId: number | null;
  technicianNotes: string | null;
  resultClassification: TreatmentResultClassification | null;
  startedAt: Date;
  completedAt: Date | null;
  performedByProfileId: string | null;
  version: number;
}>;

export type JobItemDetail = Readonly<{
  id: string;
  status: JobItemStatus;
  planned: PlannedJobItemSnapshot;
  inspection: JobItemInspection | null;
  treatmentPlan: JobItemTreatmentPlan | null;
  treatmentExecution: JobItemTreatmentExecution | null;
  resolutionReasonCategory: ItemResolutionReasonCategory | null;
  resolutionNotes: string | null;
  version: number;
}>;

/** Technician-safe operational detail. Commercial totals and CRM history are absent. */
export type TechnicianJobDetail = JobSummary &
  Readonly<{
    property: JobPropertySnapshot;
    visitContact: Readonly<{
      contactName: string;
      email: string | null;
      phone: string | null;
    }> | null;
    customerServiceNotes: string | null;
    plannedDurationMinutes: number | null;
    enRouteAt: Date | null;
    arrivedAt: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    actualProductiveMinutes: number | null;
    actualOccupiedTeamMinutes: number | null;
    items: readonly JobItemDetail[];
  }>;

export type JobAuditItem = Readonly<{
  eventType: JobAuditEventType;
  source: JobAuditSource;
  safeMetadata: JsonObject;
  createdAt: Date;
}>;

export type StaffJobDetail = TechnicianJobDetail &
  Readonly<{
    internalCompletionNotes: string | null;
    preparationReviewReasonCodes: readonly JobPreparationReviewReasonCode[];
    auditTimeline: readonly JobAuditItem[];
  }>;

export type JobListInput = Readonly<{
  search?: string;
  status?: JobStatus;
  teamId?: number;
  scheduledFrom?: Date;
  scheduledTo?: Date;
  manualReviewRequired?: boolean;
  limit: number;
  offset: number;
}>;

export type JobPage = Readonly<{
  items: readonly JobSummary[];
  total: number;
  limit: number;
  offset: number;
}>;

export type MaintenanceRecommendation = Readonly<{
  recommendedReviewDate: string | null;
  suggestedIntervalMonths: number | null;
  reason: string;
  sourceType: "TECHNICIAN_ASSESSMENT";
}>;

export type CustomerCleaningPassportEntry = Readonly<{
  jobReference: string;
  completedAt: Date;
  serviceDescription: string;
  observedConditionSummary: string;
  treatmentSummary: string;
  resultClassification: TreatmentResultClassification;
  careRecommendation: string | null;
  maintenanceRecommendation: MaintenanceRecommendation | null;
}>;

export type StaffCleaningPassportEntry = CustomerCleaningPassportEntry &
  Readonly<{
    id: string;
    jobItemId: string;
    inspectionIssueSummary: readonly string[];
    inspectionRiskSummary: readonly string[];
    internalTechnicianNotes: string | null;
    immutableSnapshot: JsonObject;
  }>;

export type CleaningPassportPage = Readonly<{
  assetLabel: string;
  entries: readonly CustomerCleaningPassportEntry[];
}>;

export type JobMutationResult =
  | Readonly<{
      status: "CHANGED" | "NO_CHANGE";
      jobReference: string;
      version: number;
    }>
  | Readonly<{
      status:
        | "NOT_FOUND_OR_FORBIDDEN"
        | "CONFLICT"
        | "INVALID_TRANSITION"
        | "REQUIRES_REVIEW"
        | "INCOMPLETE";
      reasonCodes?: readonly string[];
    }>;

export type JobCreationResult =
  | Readonly<{
      status: "CREATED";
      jobReference: string;
      jobStatus: "PREPARED" | "READY";
    }>
  | Readonly<{
      status: "EXISTING";
      jobReference: string;
      jobStatus: JobStatus;
    }>
  | Readonly<{
      status: "REVIEW_REQUIRED" | "INELIGIBLE";
      reasonCodes: readonly string[];
    }>
  | Readonly<{ status: "NOT_FOUND_OR_FORBIDDEN" | "REFERENCE_CONFLICT" }>;

export type JobItemMutationResult =
  | Readonly<{
      status: "CHANGED" | "NO_CHANGE";
      jobReference: string;
      jobVersion: number;
      jobItemVersion: number;
    }>
  | Readonly<{
      status:
        | "NOT_FOUND_OR_FORBIDDEN"
        | "CONFLICT"
        | "INVALID_TRANSITION"
        | "REQUIRES_REVIEW"
        | "INCOMPLETE";
      reasonCodes?: readonly string[];
    }>;

export type TeamMembershipEvidence = Readonly<{
  operationsTeamId: number;
  active: boolean;
  validFrom: Date;
  validUntil: Date | null;
}>;

export type InspectionSafetyInput = Readonly<{
  plannedCleaningItemTypeId: number;
  observedCleaningItemTypeId: number;
  plannedMeasurement: FrozenMeasurementSnapshot;
  observedMeasurement: FrozenMeasurementSnapshot;
  issueHandlingClassifications: readonly IssueHandlingClassificationCode[];
  riskCodes: readonly RiskFlagCode[];
  serviceCapabilityStatus: CapabilityStatusCode;
  treatmentCapabilityStatus: CapabilityStatusCode;
  requiredAddonIds: readonly number[];
  quotedAddonIds: readonly number[];
  unsafeContaminationObserved: boolean;
  unsafeStructuralConditionObserved: boolean;
}>;

export type InspectionSafetyReasonCode =
  | "UNSAFE_CONTAMINATION"
  | "UNSAFE_STRUCTURAL_CONDITION"
  | "DECLINE_OR_REFER_ISSUE"
  | "CLEANING_ITEM_TYPE_CHANGED"
  | "MEASUREMENT_CHANGED"
  | "SPECIALIST_ISSUE"
  | "ELEVATED_MATERIAL_RISK"
  | "SERVICE_CAPABILITY_REQUIRES_REVIEW"
  | "TREATMENT_CAPABILITY_REQUIRES_REVIEW"
  | "UNQUOTED_ADDON_REQUIRED";

export type InspectionSafetyDecision = Readonly<{
  state: "PROCEED" | "REQUIRES_REVIEW" | "DECLINE_OR_REFER";
  reasonCodes: readonly InspectionSafetyReasonCode[];
}>;

export type CompletionItemEvidence = Readonly<{
  status: JobItemStatus;
  inspectionRecorded: boolean;
  treatmentPlanRecorded: boolean;
  treatmentExecutionCompleted: boolean;
}>;

export type CompletionBlockReasonCode =
  | "JOB_NOT_IN_PROGRESS"
  | "NO_JOB_ITEMS"
  | "INSPECTION_MISSING"
  | "TREATMENT_PLAN_MISSING"
  | "TREATMENT_EXECUTION_INCOMPLETE"
  | "ITEM_UNRESOLVED"
  | "REVIEW_REQUIRED";

export type CompletionReadiness = Readonly<{
  state: "READY" | "BLOCKED";
  reasonCodes: readonly CompletionBlockReasonCode[];
}>;

export type TreatmentExecutionConformanceInput = Readonly<{
  treatmentPlanDecision: TreatmentPlanDecision;
  plannedTreatmentLevelId: number | null;
  plannedMechanicalActionLevelId: number | null;
  plannedTreatmentApproachId: number | null;
  plannedAddonIds: readonly number[];
  plannedCleaningProductId: number | null;
  performedTreatmentLevelId: number;
  performedMechanicalActionLevelId: number;
  performedTreatmentApproachId: number;
  performedAddonIds: readonly number[];
  performedCleaningProductId: number | null;
  resultClassification: TreatmentResultClassification;
}>;

export type TreatmentExecutionConformance = Readonly<{
  state: "CONFORMS" | "REQUIRES_REVIEW" | "DENIED";
  reasonCodes: readonly (
    | "PLAN_NOT_PERFORMABLE"
    | "TREATMENT_LEVEL_CHANGED"
    | "MECHANICAL_ACTION_CHANGED"
    | "TREATMENT_APPROACH_CHANGED"
    | "ADDONS_CHANGED"
    | "PRODUCT_CHANGED"
    | "STOPPED_FOR_SAFETY"
  )[];
}>;

export type DurationAnalyticsInput = Readonly<{
  plannedDurationMinutes: number | null;
  actualProductiveMinutes: number;
  actualOccupiedMinutes: number;
  plannedTechnicianCount: number;
  actualTechnicianCount: number;
  /** Optional immutable Quote aggregate supplied by the analytics caller. */
  immutableQuotedRevenueMinorUnits?: number | null;
}>;

export type DurationAnalytics = Readonly<{
  plannedDurationMinutes: number | null;
  actualProductiveMinutes: number;
  productiveVarianceMinutes: number | null;
  actualOccupiedMinutes: number;
  plannedTeamMinutes: number | null;
  actualTeamMinutes: number;
  plannedTeamHours: number | null;
  actualTeamHours: number;
  immutableQuotedRevenuePerActualTeamHourMinorUnits: number | null;
}>;
