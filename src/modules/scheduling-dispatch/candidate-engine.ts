import type {
  EquipmentCapabilityCode,
  LocationInput,
  TeamCapabilityCode,
  TravelEstimate,
  TravelTimeEstimator,
  WorkingWindow,
} from "@/modules/availability-engine/types";
import type { SchedulingReadinessCode } from "./types";

export type SchedulingOccupancy = Readonly<{
  id: string;
  serviceStartMinute: number;
  serviceEndMinute: number;
  operationalStartMinute: number;
  operationalEndMinute: number;
  location: LocationInput | null;
}>;

export type SchedulingResourceBlock = Readonly<{
  operationalStartMinute: number;
  operationalEndMinute: number;
}>;

export type SchedulingCandidateEvaluation = Readonly<{
  serviceStartMinute: number;
  serviceEndMinute: number;
  operationalStartMinute: number;
  operationalEndMinute: number;
  travelBeforeMinutes: number;
  travelAfterMinutes: number;
  bufferMinutes: number;
  fallbackTravelUsed: boolean;
  manualReviewRequired: boolean;
  selectable: boolean;
  readiness: SchedulingReadinessCode;
  warnings: readonly string[];
  previousOccupancyId: string | null;
  nextOccupancyId: string | null;
  nearbyWorkContinuity: boolean;
}>;

export type SchedulingCandidateContext = Readonly<{
  workDate: string;
  serviceDurationMinutes: number;
  location: LocationInput;
  workingWindow: WorkingWindow;
  preferredWindow: WorkingWindow | null;
  candidateIntervalMinutes: number;
  interJobBufferMinutes: number;
  parkingBufferMinutes: number;
  largeJobReviewThresholdMinutes: number;
  configurationProvisional: boolean;
  teamActive: boolean;
  teamCapabilityCodes: readonly TeamCapabilityCode[];
  requiredCapabilityCodes: readonly TeamCapabilityCode[];
  equipmentActive: boolean;
  equipmentCapabilityCode: EquipmentCapabilityCode | null;
  requiredEquipmentCapabilityCodes: readonly EquipmentCapabilityCode[];
  occupancies: readonly SchedulingOccupancy[];
  equipmentOccupancies: readonly SchedulingResourceBlock[];
  travelEstimator: TravelTimeEstimator;
}>;

function overlaps(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
): boolean {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function assertMinute(value: number, label: string, allowEnd = false): void {
  const maximum = allowEnd ? 1_440 : 1_439;
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${label} must be a whole local-day minute.`);
  }
}

function addUnique(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

function safeTravelEstimate(
  estimator: TravelTimeEstimator,
  input: Parameters<TravelTimeEstimator>[0],
): TravelEstimate {
  try {
    const result = estimator(input);
    if (
      result.estimatedTravelMinutes === null ||
      !Number.isSafeInteger(result.estimatedTravelMinutes) ||
      result.estimatedTravelMinutes <= 0
    ) {
      throw new Error("Travel is not confirmed.");
    }
    return result;
  } catch {
    return {
      estimatedTravelMinutes: null,
      distanceMetres: null,
      confidence: "FALLBACK",
      source: "SCHEDULING_VALIDATION",
      fallbackUsed: true,
      manualAssessmentRequired: true,
      warnings: ["Travel requires manual route review."],
      appliedRuleId: null,
    };
  }
}

function evaluateOne(
  context: SchedulingCandidateContext,
  serviceStartMinute: number,
): SchedulingCandidateEvaluation {
  const serviceEndMinute =
    serviceStartMinute + context.serviceDurationMinutes;
  const warnings: string[] = [];
  const previous = [...context.occupancies]
    .filter((occupancy) => occupancy.serviceEndMinute <= serviceStartMinute)
    .sort(
      (left, right) =>
        right.serviceEndMinute - left.serviceEndMinute ||
        left.id.localeCompare(right.id),
    )[0];
  const next = [...context.occupancies]
    .filter((occupancy) => occupancy.serviceStartMinute >= serviceEndMinute)
    .sort(
      (left, right) =>
        left.serviceStartMinute - right.serviceStartMinute ||
        left.id.localeCompare(right.id),
    )[0];

  let travelBeforeMinutes = 0;
  let travelAfterMinutes = 0;
  let fallbackTravelUsed = false;
  let travelUnconfirmed = false;

  if (previous) {
    if (!previous.location) {
      travelUnconfirmed = true;
      addUnique(warnings, "The preceding appointment has no usable location.");
    } else {
      const estimate = safeTravelEstimate(context.travelEstimator, {
        origin: previous.location,
        destination: context.location,
        departure: {
          localDate: context.workDate,
          minuteOfDay: previous.serviceEndMinute,
          timeZone: "Europe/Sofia",
        },
      });
      fallbackTravelUsed ||= estimate.fallbackUsed;
      travelUnconfirmed ||=
        estimate.estimatedTravelMinutes === null ||
        estimate.manualAssessmentRequired;
      travelBeforeMinutes = estimate.estimatedTravelMinutes ?? 0;
      estimate.warnings.forEach((warning) => addUnique(warnings, warning));
    }
  }
  if (next) {
    if (!next.location) {
      travelUnconfirmed = true;
      addUnique(warnings, "The following appointment has no usable location.");
    } else {
      const estimate = safeTravelEstimate(context.travelEstimator, {
        origin: context.location,
        destination: next.location,
        departure: {
          localDate: context.workDate,
          minuteOfDay: serviceEndMinute,
          timeZone: "Europe/Sofia",
        },
      });
      fallbackTravelUsed ||= estimate.fallbackUsed;
      travelUnconfirmed ||=
        estimate.estimatedTravelMinutes === null ||
        estimate.manualAssessmentRequired;
      travelAfterMinutes = estimate.estimatedTravelMinutes ?? 0;
      estimate.warnings.forEach((warning) => addUnique(warnings, warning));
    }
  }

  const bufferBefore = previous ? context.interJobBufferMinutes : 0;
  const bufferAfter = next ? context.interJobBufferMinutes : 0;
  const operationalStartMinute =
    serviceStartMinute -
    travelBeforeMinutes -
    bufferBefore -
    context.parkingBufferMinutes;
  const operationalEndMinute =
    serviceEndMinute + travelAfterMinutes + bufferAfter;
  const teamMissing = !context.teamActive;
  const capabilityMissing = context.requiredCapabilityCodes.some(
    (code) => !context.teamCapabilityCodes.includes(code),
  );
  const equipmentMissing =
    context.requiredEquipmentCapabilityCodes.length > 0 &&
    (!context.equipmentActive ||
      context.equipmentCapabilityCode === null ||
      !context.requiredEquipmentCapabilityCodes.includes(
        context.equipmentCapabilityCode,
      ));
  const outsideWorkingHours =
    operationalStartMinute < context.workingWindow.startMinute ||
    operationalEndMinute > context.workingWindow.endMinute;
  const collision = context.occupancies.some((occupancy) =>
    overlaps(
      operationalStartMinute,
      operationalEndMinute,
      occupancy.operationalStartMinute,
      occupancy.operationalEndMinute,
    ),
  );
  const equipmentCollision = context.equipmentOccupancies.some((occupancy) =>
    overlaps(
      operationalStartMinute,
      operationalEndMinute,
      occupancy.operationalStartMinute,
      occupancy.operationalEndMinute,
    ),
  );
  const customerMismatch =
    context.preferredWindow !== null &&
    (serviceStartMinute < context.preferredWindow.startMinute ||
      serviceStartMinute >= context.preferredWindow.endMinute);
  const hardBlock =
    teamMissing ||
    capabilityMissing ||
    equipmentMissing ||
    outsideWorkingHours ||
    collision ||
    equipmentCollision ||
    customerMismatch ||
    travelUnconfirmed;

  if (outsideWorkingHours) addUnique(warnings, "Outside provisional working hours.");
  if (collision) addUnique(warnings, "Operational occupancy conflicts with another appointment.");
  if (equipmentCollision) {
    addUnique(warnings, "Required equipment conflicts with another appointment.");
  }
  if (context.configurationProvisional) {
    addUnique(
      warnings,
      "Draft scheduling configuration requires explicit staff review.",
    );
  }
  if (fallbackTravelUsed) {
    addUnique(
      warnings,
      "Deterministic travel fallback was used; no live routing provider was called.",
    );
  }
  const largeJob =
    context.serviceDurationMinutes > context.largeJobReviewThresholdMinutes;
  if (largeJob) addUnique(warnings, "Large job requires staff capacity review.");
  if (context.parkingBufferMinutes > 0) {
    addUnique(warnings, "Parking/access time requires staff confirmation.");
  }

  const readiness: SchedulingReadinessCode = teamMissing
    ? "MISSING_TEAM"
    : equipmentMissing
      ? "MISSING_EQUIPMENT"
      : capabilityMissing
        ? "CAPABILITY_REVIEW"
        : collision || equipmentCollision || outsideWorkingHours
          ? "SCHEDULE_CONFLICT"
          : customerMismatch
            ? "CUSTOMER_REVIEW"
            : fallbackTravelUsed || travelUnconfirmed
              ? "TRAVEL_REVIEW"
              : "READY";

  return {
    serviceStartMinute,
    serviceEndMinute,
    operationalStartMinute,
    operationalEndMinute,
    travelBeforeMinutes,
    travelAfterMinutes,
    bufferMinutes: bufferBefore + bufferAfter,
    fallbackTravelUsed,
    manualReviewRequired:
      context.configurationProvisional ||
      fallbackTravelUsed ||
      largeJob ||
      context.parkingBufferMinutes > 0,
    selectable: !hardBlock,
    readiness,
    warnings,
    previousOccupancyId: previous?.id ?? null,
    nextOccupancyId: next?.id ?? null,
    nearbyWorkContinuity: previous !== undefined || next !== undefined,
  };
}

export function generateSchedulingCandidates(
  context: SchedulingCandidateContext,
): readonly SchedulingCandidateEvaluation[] {
  assertMinute(context.workingWindow.startMinute, "Working start");
  assertMinute(context.workingWindow.endMinute, "Working end", true);
  if (
    !Number.isSafeInteger(context.serviceDurationMinutes) ||
    context.serviceDurationMinutes <= 0 ||
    !Number.isSafeInteger(context.candidateIntervalMinutes) ||
    context.candidateIntervalMinutes <= 0 ||
    !Number.isSafeInteger(context.interJobBufferMinutes) ||
    context.interJobBufferMinutes < 0 ||
    !Number.isSafeInteger(context.parkingBufferMinutes) ||
    context.parkingBufferMinutes < 0
  ) {
    throw new Error("Scheduling durations and intervals must be valid minutes.");
  }
  const start = Math.max(
    context.workingWindow.startMinute,
    context.preferredWindow?.startMinute ?? 0,
  );
  const end = Math.min(
    context.workingWindow.endMinute,
    context.preferredWindow?.endMinute ?? 1_440,
  );
  const first =
    Math.ceil(start / context.candidateIntervalMinutes) *
    context.candidateIntervalMinutes;
  const candidates: SchedulingCandidateEvaluation[] = [];
  for (
    let minute = first;
    minute < end;
    minute += context.candidateIntervalMinutes
  ) {
    candidates.push(evaluateOne(context, minute));
  }
  return candidates;
}
