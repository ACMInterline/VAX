import type { ApplicationStatusTone } from "@/components/application/status-badge";
import type {
  JobItemStatus as DomainJobItemStatus,
  JobStatus as DomainJobStatus,
  TreatmentPlanDecision,
  TreatmentResultClassification,
} from "@/modules/job-execution/types";

export type JobStatus = DomainJobStatus;
export type JobItemStatus = DomainJobItemStatus;
export type { TreatmentPlanDecision, TreatmentResultClassification };

export type JobOption = Readonly<{
  id: string;
  label: string;
}>;

export type TechnicianJobListItem = Readonly<{
  reference: string;
  status: JobStatus;
  scheduledStart: Date | null;
  plannedDurationMinutes: number | null;
  customerDisplayName: string;
  propertyLabel: string;
  serviceAddress: string;
  assignedTeamLabel: string | null;
  itemLabels: readonly string[];
  reviewReasons: readonly string[];
}>;

export type PlannedJobItemView = Readonly<{
  serviceLabel: string;
  itemLabel: string;
  quantityLabel: string;
  measurementLabel: string | null;
  reportedConditionLabel: string | null;
  reportedMaterialLabel: string | null;
  reportedConstructionLabel: string | null;
  reportedIssueLabels: readonly string[];
  requestedAddonLabels: readonly string[];
  customerDescription: string | null;
}>;

export type ObservedJobItemView = Readonly<{
  inspectedAt: Date;
  conditionLabel: string;
  materialLabel: string | null;
  constructionLabel: string | null;
  measurementLabel: string | null;
  issueLabels: readonly string[];
  riskLabels: readonly string[];
}>;

export type ConfirmedTreatmentView = Readonly<{
  confirmedAt: Date;
  decision: TreatmentPlanDecision;
  methodLabel: string | null;
  addonLabels: readonly string[];
  productLabel: string | null;
}>;

export type PerformedTreatmentView = Readonly<{
  startedAt: Date | null;
  completedAt: Date | null;
  resultClassification: TreatmentResultClassification;
  methodLabel: string | null;
  addonLabels: readonly string[];
  productLabel: string | null;
  customerVisibleSummary: string | null;
  careInstructions: string | null;
}>;

export type TechnicianJobItem = Readonly<{
  id: string;
  status: JobItemStatus;
  planned: PlannedJobItemView;
  observed: ObservedJobItemView | null;
  confirmedTreatment: ConfirmedTreatmentView | null;
  performed: PerformedTreatmentView | null;
}>;

export type TechnicianJobDetail = Readonly<{
  reference: string;
  status: JobStatus;
  version: number;
  scheduledStart: Date | null;
  plannedDurationMinutes: number | null;
  customerDisplayName: string;
  propertyLabel: string;
  serviceAddress: string;
  assignedTeamLabel: string | null;
  visitContact: Readonly<{
    name: string;
    phone: string | null;
  }> | null;
  accessInstructions: string | null;
  parkingInstructions: string | null;
  customerServiceNotes: string | null;
  reviewReasons: readonly string[];
  items: readonly TechnicianJobItem[];
}>;

export type StaffCleaningHistoryEntry = Readonly<{
  id: string;
  jobReference: string;
  completedAt: Date;
  serviceDescription: string;
  observedConditionSummary: string;
  treatmentSummary: string;
  resultClassification: TreatmentResultClassification;
  inspectionIssueSummary: readonly string[];
  inspectionRiskSummary: readonly string[];
  careRecommendation: string | null;
  maintenanceRecommendation: Readonly<{
    recommendedReviewDate: string | null;
    suggestedIntervalMonths: number | null;
    reason: string;
  }> | null;
}>;

export type StaffAssetHistory = Readonly<{
  assetLabel: string;
  propertyLabel: string;
  entries: readonly StaffCleaningHistoryEntry[];
}>;

export type CustomerCleaningPassportEntry = Readonly<{
  jobReference: string;
  completedAt: Date;
  serviceDescription: string;
  observedConditionSummary: string;
  treatmentSummary: string;
  resultClassification: TreatmentResultClassification;
  careRecommendation: string | null;
  maintenanceRecommendation: Readonly<{
    recommendedReviewDate: string | null;
    suggestedIntervalMonths: number | null;
    reason: string;
  }> | null;
}>;

export type CustomerCleaningPassport = Readonly<{
  assetLabel: string;
  propertyLabel: string;
  entries: readonly CustomerCleaningPassportEntry[];
}>;

export type JobActionState = Readonly<{
  status: "IDLE" | "ERROR" | "SUCCESS";
  message?: string;
  fieldErrors?: Readonly<Record<string, readonly string[] | undefined>>;
}>;

export type JobFormAction = (
  previousState: JobActionState,
  formData: FormData,
) => Promise<JobActionState>;

export type JobProgressOperation =
  | "START_TRAVEL"
  | "MARK_ARRIVED"
  | "START_WORK";

export type JobItemProgressOperation = "START_TREATMENT";

export type InspectionFormOptions = Readonly<{
  cleaningItemTypes: readonly JobOption[];
  measurementModes: readonly JobOption[];
  conditions: readonly JobOption[];
  materials: readonly JobOption[];
  constructions: readonly JobOption[];
  issues: readonly JobOption[];
  risks: readonly JobOption[];
}>;

export type TreatmentPlanFormOptions = Readonly<{
  treatmentLevels: readonly JobOption[];
  mechanicalActions: readonly JobOption[];
  treatmentApproaches: readonly JobOption[];
  addons: readonly JobOption[];
  products: readonly JobOption[];
}>;

export type TreatmentExecutionFormOptions = TreatmentPlanFormOptions;

export type JobStatusPresentation = Readonly<{
  label: string;
  tone: ApplicationStatusTone;
}>;
