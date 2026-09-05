import type {
  CleaningItemTypeCode,
  FibreMaterialCode,
  IssueTypeCode,
  RiskFlagCode,
  ServiceAddonCode,
  ServiceCode,
  TreatmentLevelCode,
} from "@/modules/service-catalogue/catalogue";

export const priceBookStatuses = [
  "DRAFT",
  "ACTIVE",
  "SUPERSEDED",
  "ARCHIVED",
] as const;
export type PriceBookStatus = (typeof priceBookStatuses)[number];

export const customerSegments = ["RESIDENTIAL", "B2B"] as const;
export type CustomerSegment = (typeof customerSegments)[number];

export const vatModes = [
  "VAT_REGISTERED",
  "VAT_NOT_REGISTERED",
  "VAT_UNRESOLVED",
] as const;
export type VatMode = (typeof vatModes)[number];

export const priceBases = ["GROSS", "NET"] as const;
export type PriceBasis = (typeof priceBases)[number];

export const commercialConditionBandCodes = [
  "NORMAL",
  "ENHANCED",
  "INTENSIVE",
  "ASSESSMENT_REQUIRED",
] as const;
export type CommercialConditionBandCode =
  (typeof commercialConditionBandCodes)[number];

export const parkingPolicyCodes = [
  "PARKING_INCLUDED",
  "PARKING_PASS_THROUGH",
  "PARKING_ESTIMATED",
  "PARKING_CUSTOM",
] as const;
export type ParkingPolicyCode = (typeof parkingPolicyCodes)[number];

export const travelZoneCodes = [
  "SOFIA_CORE",
  "SOFIA_EXTENDED",
  "SOFIA_OUTSKIRTS",
  "OUTSIDE_SOFIA",
] as const;
export type TravelZoneCode = (typeof travelZoneCodes)[number];

export const timingCategoryCodes = [
  "STANDARD",
  "EARLY_MORNING",
  "EVENING",
  "WEEKEND",
  "URGENT",
] as const;
export type TimingCategoryCode = (typeof timingCategoryCodes)[number];

export const priceRuleTypes = [
  "BASE_ITEM",
  "PER_AREA_M2",
  "PER_ITEM",
  "PER_SEAT",
  "MINIMUM_VISIT",
  "CONDITION_MODIFIER",
  "ISSUE_MODIFIER",
  "ADD_ON",
  "TRAVEL_ZONE",
  "TIMING_MODIFIER",
  "VOLUME_TIER",
  "CUSTOM_ASSESSMENT",
] as const;
export type PriceRuleType = (typeof priceRuleTypes)[number];

export const adjustmentKinds = [
  "NONE",
  "FIXED",
  "RATE_PER_UNIT",
  "PERCENTAGE",
  "MANUAL_ASSESSMENT",
  "DECLINE_OR_REFER",
  "SUGGEST_ADD_ON",
] as const;
export type AdjustmentKind = (typeof adjustmentKinds)[number];

export const billingUnits = [
  "PER_ITEM",
  "PER_SIDE",
  "PER_SEAT",
  "AREA_M2",
] as const;
export type BillingUnit = (typeof billingUnits)[number];

export type VatConfiguration = Readonly<{
  mode: VatMode;
  rateBasisPoints: number | null;
}>;

export type PriceRuleDefinition = Readonly<{
  id: string;
  type: PriceRuleType;
  label: string;
  adjustmentKind: AdjustmentKind;
  active: boolean;
  priority: number;
  serviceCode?: ServiceCode;
  itemTypeCode?: CleaningItemTypeCode;
  conditionBandCode?: CommercialConditionBandCode;
  issueCode?: IssueTypeCode;
  addonCode?: ServiceAddonCode;
  suggestedAddonCode?: ServiceAddonCode;
  riskFlagCode?: RiskFlagCode;
  travelZoneCode?: TravelZoneCode;
  timingCategoryCode?: TimingCategoryCode;
  billingUnit?: BillingUnit;
  amountMinorUnits?: number;
  percentageBasisPoints?: number;
  additionalSidePercentageBasisPoints?: number;
  measurementMinHundredths?: number;
  measurementMaxHundredths?: number | null;
  manualAssessmentRequired?: boolean;
  declineOrReferRequired?: boolean;
  notes?: string;
}>;

export type PriceBookDefinition = Readonly<{
  id: string;
  code: string;
  name: string;
  currency: "EUR";
  market: "SOFIA";
  customerSegment: CustomerSegment;
  version: number;
  status: PriceBookStatus;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  priceBasis: PriceBasis;
  vatConfiguration: VatConfiguration;
  provisional: boolean;
  approvedForPublication: boolean;
  active: boolean;
  rules: readonly PriceRuleDefinition[];
}>;

export type CommercialLineInput = Readonly<{
  serviceCode: ServiceCode;
  itemTypeCode: CleaningItemTypeCode;
  quantity: number;
  areaHundredthsM2?: number;
  seatCount?: number;
  sides?: 1 | 2;
  issueCodes: readonly IssueTypeCode[];
  addonCodes: readonly ServiceAddonCode[];
  riskFlagCodes: readonly RiskFlagCode[];
  fibreMaterialCode?: FibreMaterialCode;
  treatmentLevelCode?: TreatmentLevelCode;
}>;

export type PriceCalculationInput = Readonly<{
  items: readonly CommercialLineInput[];
  conditionBandCode: CommercialConditionBandCode;
  travelZoneCode: TravelZoneCode;
  timingCategoryCode: TimingCategoryCode;
  vatConfiguration?: VatConfiguration;
}>;

export type PriceCalculationLine = Readonly<{
  kind: PriceRuleType | "MINIMUM_VISIT_ADJUSTMENT";
  label: string;
  amountMinorUnits: number;
  ruleId: string;
}>;

export type PriceCalculationResult = Readonly<{
  priceBookId: string;
  priceBookCode: string;
  priceBookVersion: number;
  priceBookStatus: PriceBookStatus;
  currency: "EUR";
  priceBasis: PriceBasis;
  lines: readonly PriceCalculationLine[];
  subtotalMinorUnits: number;
  minimumVisitAdjustmentMinorUnits: number | null;
  netAmountMinorUnits: number | null;
  vatRateBasisPoints: number | null;
  vatAmountMinorUnits: number | null;
  grossTotalMinorUnits: number | null;
  warnings: readonly string[];
  manualAssessmentRequired: boolean;
  declineOrReferRequired: boolean;
  appliedRuleIds: readonly string[];
}>;

export type FuturePriceSnapshot = Readonly<{
  priceBookId: string;
  priceBookCode: string;
  priceBookVersion: number;
  ruleIds: readonly string[];
  inputs: PriceCalculationInput;
  calculationLines: readonly PriceCalculationLine[];
  netAmountMinorUnits: number | null;
  vatRateBasisPoints: number | null;
  vatAmountMinorUnits: number | null;
  grossTotalMinorUnits: number | null;
  currency: "EUR";
  calculatedAt: string;
  manualAssessmentRequired: boolean;
}>;

export const durationRuleTypes = [
  "JOB_SETUP",
  "JOB_INSPECTION",
  "JOB_CLEANUP",
  "ITEM_BASE",
  "AREA_PRODUCTIVITY",
  "CONDITION_MULTIPLIER",
  "ISSUE_COMPLEXITY",
  "MATERIAL_SENSITIVITY",
  "TREATMENT_COMPLEXITY",
  "ADD_ON_TIME",
  "CUSTOM_ASSESSMENT",
] as const;
export type DurationRuleType = (typeof durationRuleTypes)[number];

export type DurationRuleDefinition = Readonly<{
  id: string;
  type: DurationRuleType;
  label: string;
  active: boolean;
  priority: number;
  serviceCode?: ServiceCode;
  itemTypeCode?: CleaningItemTypeCode;
  conditionBandCode?: CommercialConditionBandCode;
  issueCode?: IssueTypeCode;
  addonCode?: ServiceAddonCode;
  riskFlagCode?: RiskFlagCode;
  fibreMaterialCode?: FibreMaterialCode;
  treatmentLevelCode?: TreatmentLevelCode;
  billingUnit?: BillingUnit;
  minutes?: number;
  multiplierBasisPoints?: number;
  additionalSidePercentageBasisPoints?: number;
  productivityHundredthsM2PerHour?: number;
  manualAssessmentRequired?: boolean;
  declineOrReferRequired?: boolean;
  notes?: string;
}>;

export type DurationModelDefinition = Readonly<{
  id: string;
  code: string;
  name: string;
  market: "SOFIA";
  version: number;
  status: PriceBookStatus;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  provisional: boolean;
  active: boolean;
  rules: readonly DurationRuleDefinition[];
}>;

export type DurationCalculationInput = Readonly<{
  items: readonly CommercialLineInput[];
  conditionBandCode: CommercialConditionBandCode;
}>;

export type DurationCalculationLine = Readonly<{
  kind: DurationRuleType;
  label: string;
  minutes: number;
  ruleId: string;
}>;

export type DurationCalculationResult = Readonly<{
  durationModelId: string;
  durationModelCode: string;
  durationModelVersion: number;
  lines: readonly DurationCalculationLine[];
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

export type ContributionInputs = Readonly<{
  grossRevenueMinorUnits: number;
  vatAmountMinorUnits: number;
  estimatedTeamMinutes: number;
  labourCostPerTeamHourMinorUnits: number;
  estimatedConsumablesMinorUnits: number;
  estimatedTravelCostMinorUnits: number;
}>;

export type ContributionEstimate = Readonly<{
  estimatedTeamMinutes: number;
  estimatedLabourCostMinorUnits: number;
  estimatedConsumablesMinorUnits: number;
  estimatedTravelCostMinorUnits: number;
  estimatedContributionMinorUnits: number;
  contributionPerTeamHourMinorUnits: number | null;
}>;
