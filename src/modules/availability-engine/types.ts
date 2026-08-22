import type {
  DurationCalculationResult,
  PriceBookStatus,
  PriceCalculationResult,
  TravelZoneCode,
} from "@/modules/commercial-engine/types";

export type LocalizedText = Readonly<{ bg: string; en: string }>;

export type LocationInput = Readonly<{
  city: string;
  district: string | null;
  addressText: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  accessNotes: string | null;
  parkingNotes: string | null;
  zoneCode: TravelZoneCode;
}>;

export type LocalDepartureTime = Readonly<{
  localDate: string;
  minuteOfDay: number;
  timeZone: "Europe/Sofia";
}>;

export type TravelTimeRequest = Readonly<{
  origin: LocationInput;
  destination: LocationInput;
  departure: LocalDepartureTime;
}>;

export const travelEstimateConfidenceCodes = [
  "DEVELOPMENT_ASSUMPTION",
  "PROVIDER_ESTIMATE",
  "FALLBACK",
] as const;
export type TravelEstimateConfidence =
  (typeof travelEstimateConfidenceCodes)[number];

export type TravelEstimate = Readonly<{
  estimatedTravelMinutes: number | null;
  distanceMetres: number | null;
  confidence: TravelEstimateConfidence;
  source: string;
  fallbackUsed: boolean;
  manualAssessmentRequired: boolean;
  warnings: readonly string[];
  appliedRuleId: string | null;
}>;

export interface TravelTimeProvider {
  estimateTravel(request: TravelTimeRequest): Promise<TravelEstimate>;
}

export type TravelTimeEstimator = (
  request: TravelTimeRequest,
) => TravelEstimate;

export type TravelTimeMatrixRuleDefinition = Readonly<{
  id: string;
  originZoneCode: TravelZoneCode;
  destinationZoneCode: TravelZoneCode;
  estimatedTravelMinutes: number | null;
  bidirectional: boolean;
  sameDistrictOnly: boolean;
  manualAssessmentRequired: boolean;
  priority: number;
  active: boolean;
  notes: string;
}>;

export type TravelTimeProfileDefinition = Readonly<{
  id: string;
  code: string;
  name: string;
  market: "SOFIA";
  version: number;
  status: PriceBookStatus;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  defaultTravelMinutes: number;
  interJobBufferMinutes: number;
  provisional: boolean;
  active: boolean;
  rules: readonly TravelTimeMatrixRuleDefinition[];
}>;

export type ServiceAreaDefinition = Readonly<{
  code: TravelZoneCode;
  name: LocalizedText;
  active: boolean;
  serviceEligible: boolean;
  minimumOrderOverrideMinorUnits: number | null;
  estimatedBaseTravelMinutes: number | null;
  manualConfirmationRequired: boolean;
  geographicMetadata: Readonly<Record<string, unknown>> | null;
  notes: string;
}>;

export const operationsTeamCodes = ["TEAM_A", "TEAM_B"] as const;
export type OperationsTeamCode = (typeof operationsTeamCodes)[number];

export const teamCapabilityCodes = [
  "STANDARD_RESIDENTIAL",
  "COMMERCIAL_AREA",
  "SPECIALIST_ASSESSMENT",
  "PORTABLE_EXTRACTION",
] as const;
export type TeamCapabilityCode = (typeof teamCapabilityCodes)[number];

export const equipmentStatusCodes = [
  "ACTIVE",
  "UNAVAILABLE",
  "MAINTENANCE",
] as const;
export type EquipmentStatusCode = (typeof equipmentStatusCodes)[number];

export const equipmentTypeCodes = ["PORTABLE_CLEANING_MACHINE"] as const;
export type EquipmentTypeCode = (typeof equipmentTypeCodes)[number];

export const equipmentCapabilityCodes = ["PORTABLE_EXTRACTION"] as const;
export type EquipmentCapabilityCode =
  (typeof equipmentCapabilityCodes)[number];

export type EquipmentResourceDefinition = Readonly<{
  id: string;
  code: string;
  name: string;
  equipmentTypeCode: EquipmentTypeCode;
  capabilityCode: EquipmentCapabilityCode;
  status: EquipmentStatusCode;
  active: boolean;
  assignedTeamCode: OperationsTeamCode | null;
  serialNumber: string | null;
  notes: string;
}>;

export type OperationsTeamDefinition = Readonly<{
  id: string;
  code: OperationsTeamCode;
  name: string;
  active: boolean;
  defaultCrewSize: number;
  workingHourPolicyCode: string;
  capabilityCodes: readonly TeamCapabilityCode[];
  equipmentResourceCodes: readonly string[];
  notes: string;
}>;

export type WeekdayCode = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type WorkingHourRuleDefinition = Readonly<{
  id: string;
  weekday: WeekdayCode;
  startMinute: number;
  endMinute: number;
  enabled: boolean;
  teamCode: OperationsTeamCode | null;
}>;

export type WorkingHourPolicyDefinition = Readonly<{
  id: string;
  code: string;
  name: string;
  timeZone: "Europe/Sofia";
  version: number;
  status: PriceBookStatus;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  provisional: boolean;
  active: boolean;
  rules: readonly WorkingHourRuleDefinition[];
}>;

export const appointmentWindowCodes = [
  "EARLY_MORNING",
  "MORNING",
  "MIDDAY",
  "AFTERNOON",
  "EVENING",
] as const;
export type AppointmentWindowCode =
  (typeof appointmentWindowCodes)[number];

export type AppointmentWindowDefinition = Readonly<{
  id: string;
  profileCode: string;
  version: number;
  status: PriceBookStatus;
  windowCode: AppointmentWindowCode;
  name: LocalizedText;
  startMinute: number;
  endMinute: number;
  provisional: boolean;
  active: boolean;
}>;

export type SchedulingPolicyDefinition = Readonly<{
  code: string;
  name: string;
  version: number;
  status: PriceBookStatus;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  provisional: boolean;
  active: boolean;
  candidateIntervalMinutes: number;
  interJobBufferMinutes: number;
  largeJobReviewThresholdMinutes: number;
}>;

export const schedulingBlockTypes = [
  "JOB",
  "MEAL_BREAK",
  "MAINTENANCE",
  "TRAINING",
  "PRIVATE_BLOCK",
  "UNAVAILABLE",
  "HOLIDAY",
  "SICKNESS",
  "OPERATIONAL_HOLD",
] as const;
export type SchedulingBlockType = (typeof schedulingBlockTypes)[number];

export type SchedulingBlock = Readonly<{
  id: string;
  type: SchedulingBlockType;
  status: string;
  startMinute: number;
  endMinute: number;
  location: LocationInput | null;
  serviceMinutes: number;
  travelMinutes: number;
  bufferMinutes: number;
}>;

export type WorkingWindow = Readonly<{
  startMinute: number;
  endMinute: number;
}>;

export type JobCapacityInput = Readonly<{
  priceCalculation: PriceCalculationResult | null;
  durationCalculation: DurationCalculationResult;
  location: LocationInput;
  serviceArea: ServiceAreaDefinition;
  workDate: string;
  preferredWindow: AppointmentWindowDefinition | null;
  requiredCapabilityCodes: readonly TeamCapabilityCode[];
  requiredEquipmentCapabilityCodes: readonly EquipmentCapabilityCode[];
  requiredTeamCount: 1 | 2;
  parkingBufferMinutes: number;
  manualAssessmentRequired: boolean;
}>;

export type TeamAvailabilityContext = Readonly<{
  team: OperationsTeamDefinition;
  equipmentResources: readonly EquipmentResourceDefinition[];
  workingWindow: WorkingWindow;
  occupancyBlocks: readonly SchedulingBlock[];
}>;

export const capacityDispositionCodes = [
  "AVAILABLE",
  "UNAVAILABLE",
  "REQUEST_REVIEW",
] as const;
export type CapacityDisposition =
  (typeof capacityDispositionCodes)[number];

export const capacityReasonCodes = [
  "TEAM_INACTIVE",
  "WORKING_HOURS_UNAVAILABLE",
  "OUTSIDE_WORKING_HOURS",
  "PREFERRED_WINDOW_MISMATCH",
  "OCCUPANCY_CONFLICT",
  "CAPABILITY_UNAVAILABLE",
  "EQUIPMENT_UNAVAILABLE",
  "MANUAL_ASSESSMENT_REQUIRED",
  "OUTSIDE_SOFIA_REVIEW",
  "SERVICE_AREA_CONFIRMATION_REQUIRED",
  "TRAVEL_UNCONFIRMED",
  "SERVICE_DURATION_UNAVAILABLE",
  "LARGE_JOB_REVIEW",
  "MULTI_TEAM_REVIEW",
  "PARKING_CONFIRMATION_REQUIRED",
] as const;
export type CapacityReasonCode = (typeof capacityReasonCodes)[number];

export type CandidateCapacityResult = Readonly<{
  teamCode: OperationsTeamCode;
  disposition: CapacityDisposition;
  feasible: boolean;
  operationallyFits: boolean;
  serviceStartMinute: number;
  serviceEndMinute: number | null;
  operationalStartMinute: number | null;
  operationalEndMinute: number | null;
  travelBeforeMinutes: number;
  travelAfterMinutes: number;
  serviceMinutes: number | null;
  bufferMinutes: number;
  reasonCodes: readonly CapacityReasonCode[];
  warnings: readonly string[];
  travelBefore: TravelEstimate | null;
  travelAfter: TravelEstimate | null;
}>;

export type TeamAvailabilityResult = Readonly<{
  teamCode: OperationsTeamCode;
  bookableSlots: readonly CandidateCapacityResult[];
  reviewSlots: readonly CandidateCapacityResult[];
  rejectedSlots: readonly CandidateCapacityResult[];
  earliestStartMinute: number | null;
  warnings: readonly string[];
}>;

export type CapacityCandidateInput = Readonly<{
  request: JobCapacityInput;
  teamContext: TeamAvailabilityContext;
  candidateServiceStartMinute: number;
  travelEstimator: TravelTimeEstimator;
  schedulingPolicy: SchedulingPolicyDefinition;
}>;

export type SlotGenerationInput = Readonly<{
  request: JobCapacityInput;
  teamContext: TeamAvailabilityContext;
  travelEstimator: TravelTimeEstimator;
  schedulingPolicy: SchedulingPolicyDefinition;
}>;

export type MultiTeamAvailabilityInput = Readonly<{
  request: JobCapacityInput;
  teamContexts: readonly TeamAvailabilityContext[];
  travelEstimator: TravelTimeEstimator;
  schedulingPolicy: SchedulingPolicyDefinition;
}>;

export type TeamUtilisationInput = Readonly<{
  workingWindow: WorkingWindow;
  occupancyBlocks: readonly SchedulingBlock[];
}>;

export type TeamUtilisationResult = Readonly<{
  workingWindowMinutes: number;
  unavailableMinutes: number;
  availableTeamMinutes: number;
  scheduledServiceMinutes: number;
  scheduledTravelMinutes: number;
  scheduledBufferMinutes: number;
  occupiedTeamMinutes: number;
  idleMinutes: number;
  serviceUtilisationBasisPoints: number;
  occupiedUtilisationBasisPoints: number;
  travelShareBasisPoints: number;
}>;

export type FutureSchedulingOccupancy = Readonly<{
  id: string;
  teamCode: OperationsTeamCode;
  workDate: string;
  serviceStartMinute: number;
  serviceEndMinute: number;
  status: string;
  location: LocationInput;
  serviceDurationMinutes: number;
  travelBefore: TravelEstimate | null;
  travelAfter: TravelEstimate | null;
  bufferMinutes: number;
  requiredEquipmentCapabilityCodes: readonly EquipmentCapabilityCode[];
  schedulingPolicyCode: string;
  schedulingPolicyVersion: number;
  workingHourPolicyCode: string;
  travelTimeProfileCode: string;
  schedulingSnapshotVersion: number;
}>;
