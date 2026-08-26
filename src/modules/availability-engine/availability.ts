import type {
  CandidateCapacityResult,
  CapacityCandidateInput,
  CapacityReasonCode,
  JobCapacityInput,
  MultiTeamAvailabilityInput,
  OperationsTeamCode,
  SchedulingBlock,
  SlotGenerationInput,
  TeamAvailabilityResult,
  TravelEstimate,
  TravelTimeRequest,
  WorkingHourPolicyDefinition,
  WorkingWindow,
} from "./types";
import { validateLocationInput, validateTravelEstimate } from "./travel";

function uniquePush<T extends string>(values: T[], value: T): void {
  if (!values.includes(value)) values.push(value);
}

function pushWarning(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

function parseDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Work date must use YYYY-MM-DD format.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Work date must be a real calendar date.");
  }
  return date;
}

function assertMinute(value: number, label: string, allowEndOfDay = false): void {
  const maximum = allowEndOfDay ? 24 * 60 : 24 * 60 - 1;
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${label} must be a whole minute within one local day.`);
  }
}

function assertWorkingWindow(window: WorkingWindow): void {
  assertMinute(window.startMinute, "Working-window start");
  assertMinute(window.endMinute, "Working-window end", true);
  if (window.startMinute >= window.endMinute) {
    throw new Error("Working window must have a positive duration.");
  }
}

function assertSchedulingPolicy(input: CapacityCandidateInput): void {
  const policy = input.schedulingPolicy;
  if (
    !Number.isSafeInteger(policy.candidateIntervalMinutes) ||
    policy.candidateIntervalMinutes <= 0
  ) {
    throw new Error("Candidate interval must be a positive whole minute value.");
  }
  if (
    !Number.isSafeInteger(policy.interJobBufferMinutes) ||
    policy.interJobBufferMinutes < 0
  ) {
    throw new Error("Inter-job buffer must be a non-negative whole minute value.");
  }
  if (
    !Number.isSafeInteger(policy.largeJobReviewThresholdMinutes) ||
    policy.largeJobReviewThresholdMinutes <= 0
  ) {
    throw new Error("Large-job threshold must be a positive whole minute value.");
  }
}

function validateBlock(block: SchedulingBlock): void {
  assertMinute(block.startMinute, `Block ${block.id} start`);
  assertMinute(block.endMinute, `Block ${block.id} end`, true);
  if (block.startMinute >= block.endMinute) {
    throw new Error(`Block ${block.id} must have a positive interval.`);
  }
}

function overlaps(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
): boolean {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function precedingJob(
  blocks: readonly SchedulingBlock[],
  candidateStart: number,
): SchedulingBlock | null {
  return (
    blocks
      .filter(
        (block) => block.type === "JOB" && block.endMinute <= candidateStart,
      )
      .sort((left, right) => right.endMinute - left.endMinute)[0] ?? null
  );
}

function followingJob(
  blocks: readonly SchedulingBlock[],
  candidateEnd: number,
): SchedulingBlock | null {
  return (
    blocks
      .filter(
        (block) => block.type === "JOB" && block.startMinute >= candidateEnd,
      )
      .sort((left, right) => left.startMinute - right.startMinute)[0] ?? null
  );
}

function addTravelWarnings(
  estimate: TravelEstimate,
  warnings: string[],
): void {
  for (const warning of estimate.warnings) pushWarning(warnings, warning);
}

function estimateTravelSafely(
  estimator: CapacityCandidateInput["travelEstimator"],
  request: TravelTimeRequest,
): TravelEstimate {
  try {
    const estimate = estimator(request);
    validateTravelEstimate(estimate);
    return estimate;
  } catch {
    return {
      estimatedTravelMinutes: null,
      distanceMetres: null,
      confidence: "FALLBACK",
      source: "AVAILABILITY_VALIDATION",
      fallbackUsed: true,
      manualAssessmentRequired: true,
      warnings: [
        "Travel could not be confirmed from a valid provider result; manual route review is required.",
      ],
      appliedRuleId: null,
    };
  }
}

function durationForCapacity(
  request: JobCapacityInput,
  reasons: CapacityReasonCode[],
  warnings: string[],
): number | null {
  const confirmed = request.durationCalculation.totalEstimatedMinutes;
  if (confirmed !== null) {
    if (!Number.isSafeInteger(confirmed) || confirmed <= 0) {
      throw new Error("Confirmed service duration must be positive whole minutes.");
    }
    return confirmed;
  }

  uniquePush(reasons, "MANUAL_ASSESSMENT_REQUIRED");
  const partial = request.durationCalculation.partialEstimatedMinutes;
  if (Number.isSafeInteger(partial) && partial > 0) {
    pushWarning(
      warnings,
      "Capacity uses the Phase 2A partial duration only as a review estimate.",
    );
    return partial;
  }
  uniquePush(reasons, "SERVICE_DURATION_UNAVAILABLE");
  return null;
}

export function getWorkingWindowForDate(
  policy: WorkingHourPolicyDefinition,
  localDate: string,
  teamCode: OperationsTeamCode,
): WorkingWindow | null {
  const date = parseDateOnly(localDate);
  const utcDay = date.getUTCDay();
  const weekday = utcDay === 0 ? 7 : utcDay;
  const teamRules = policy.rules.filter(
    (rule) => rule.weekday === weekday && rule.teamCode === teamCode,
  );
  const defaultRules = policy.rules.filter(
    (rule) => rule.weekday === weekday && rule.teamCode === null,
  );
  if (teamRules.length > 1) return null;
  const rule = teamRules[0] ??
    (defaultRules.length === 1 ? defaultRules[0] : undefined);
  if (!rule?.enabled) return null;

  const window = {
    startMinute: rule.startMinute,
    endMinute: rule.endMinute,
  };
  assertWorkingWindow(window);
  return window;
}

export function evaluateCapacityCandidate(
  input: CapacityCandidateInput,
): CandidateCapacityResult {
  assertSchedulingPolicy(input);
  parseDateOnly(input.request.workDate);
  assertMinute(input.candidateServiceStartMinute, "Candidate service start");
  assertWorkingWindow(input.teamContext.workingWindow);
  validateLocationInput(input.request.location);
  for (const block of input.teamContext.occupancyBlocks) {
    validateBlock(block);
    if (block.location !== null) validateLocationInput(block.location);
  }
  if (
    input.request.requiredTeamCount !== 1 &&
    input.request.requiredTeamCount !== 2
  ) {
    throw new Error("Required team count must be one or two.");
  }
  if (
    !Number.isSafeInteger(input.request.parkingBufferMinutes) ||
    input.request.parkingBufferMinutes < 0
  ) {
    throw new Error("Parking buffer must be a non-negative whole minute value.");
  }

  const reasons: CapacityReasonCode[] = [];
  const warnings: string[] = [
    ...input.request.durationCalculation.warnings,
    ...(input.request.priceCalculation?.warnings ?? []),
  ];
  const team = input.teamContext.team;

  if (!team.active) uniquePush(reasons, "TEAM_INACTIVE");
  for (const capability of input.request.requiredCapabilityCodes) {
    if (!team.capabilityCodes.includes(capability)) {
      uniquePush(reasons, "CAPABILITY_UNAVAILABLE");
    }
  }
  for (const capability of input.request.requiredEquipmentCapabilityCodes) {
    const available = input.teamContext.equipmentResources.some(
      (resource) =>
        resource.active &&
        resource.status === "ACTIVE" &&
        resource.capabilityCode === capability &&
        team.equipmentResourceCodes.includes(resource.code) &&
        (resource.assignedTeamCode === null ||
          resource.assignedTeamCode === team.code),
    );
    if (!available) uniquePush(reasons, "EQUIPMENT_UNAVAILABLE");
  }

  if (
    input.request.manualAssessmentRequired ||
    input.request.priceCalculation === null ||
    input.request.priceCalculation?.manualAssessmentRequired ||
    input.request.priceCalculation?.declineOrReferRequired ||
    input.request.durationCalculation.manualAssessmentRequired ||
    input.request.durationCalculation.declineOrReferRequired
  ) {
    uniquePush(reasons, "MANUAL_ASSESSMENT_REQUIRED");
  }
  if (input.request.location.zoneCode === "OUTSIDE_SOFIA") {
    uniquePush(reasons, "OUTSIDE_SOFIA_REVIEW");
  }
  if (
    !input.request.serviceArea.active ||
    !input.request.serviceArea.serviceEligible ||
    input.request.serviceArea.manualConfirmationRequired ||
    input.request.serviceArea.code !== input.request.location.zoneCode
  ) {
    uniquePush(reasons, "SERVICE_AREA_CONFIRMATION_REQUIRED");
  }
  if (input.request.requiredTeamCount === 2) {
    uniquePush(reasons, "MULTI_TEAM_REVIEW");
  }
  if (input.request.location.parkingNotes?.trim()) {
    uniquePush(reasons, "PARKING_CONFIRMATION_REQUIRED");
    pushWarning(
      warnings,
      "Parking notes require review; the configured parking buffer represents time only and never fabricates a parking cost.",
    );
  }

  const serviceMinutes = durationForCapacity(input.request, reasons, warnings);
  if (
    serviceMinutes !== null &&
    serviceMinutes > input.schedulingPolicy.largeJobReviewThresholdMinutes
  ) {
    uniquePush(reasons, "LARGE_JOB_REVIEW");
  }

  const serviceEndMinute =
    serviceMinutes === null
      ? null
      : input.candidateServiceStartMinute + serviceMinutes;
  let travelBefore: TravelEstimate | null = null;
  let travelAfter: TravelEstimate | null = null;
  let travelBeforeMinutes = 0;
  let travelAfterMinutes = 0;
  let travelConfirmed = true;
  let bufferBeforeMinutes = 0;
  let bufferAfterMinutes = 0;

  if (serviceEndMinute !== null) {
    const previous = precedingJob(
      input.teamContext.occupancyBlocks,
      input.candidateServiceStartMinute,
    );
    const next = followingJob(
      input.teamContext.occupancyBlocks,
      serviceEndMinute,
    );

    if (previous) {
      bufferBeforeMinutes = input.schedulingPolicy.interJobBufferMinutes;
      if (previous.location === null) {
        travelConfirmed = false;
        uniquePush(reasons, "TRAVEL_UNCONFIRMED");
        pushWarning(warnings, "The preceding job has no usable location.");
      } else {
        travelBefore = estimateTravelSafely(input.travelEstimator, {
          origin: previous.location,
          destination: input.request.location,
          departure: {
            localDate: input.request.workDate,
            minuteOfDay: previous.endMinute,
            timeZone: "Europe/Sofia",
          },
        });
        addTravelWarnings(travelBefore, warnings);
        travelBeforeMinutes = travelBefore.estimatedTravelMinutes ?? 0;
        if (
          travelBefore.manualAssessmentRequired ||
          travelBefore.estimatedTravelMinutes === null
        ) {
          uniquePush(reasons, "TRAVEL_UNCONFIRMED");
        }
        if (travelBefore.estimatedTravelMinutes === null) travelConfirmed = false;
      }
    }

    if (next) {
      bufferAfterMinutes = input.schedulingPolicy.interJobBufferMinutes;
      if (next.location === null) {
        travelConfirmed = false;
        uniquePush(reasons, "TRAVEL_UNCONFIRMED");
        pushWarning(warnings, "The following job has no usable location.");
      } else {
        travelAfter = estimateTravelSafely(input.travelEstimator, {
          origin: input.request.location,
          destination: next.location,
          departure: {
            localDate: input.request.workDate,
            minuteOfDay: serviceEndMinute,
            timeZone: "Europe/Sofia",
          },
        });
        addTravelWarnings(travelAfter, warnings);
        travelAfterMinutes = travelAfter.estimatedTravelMinutes ?? 0;
        if (
          travelAfter.manualAssessmentRequired ||
          travelAfter.estimatedTravelMinutes === null
        ) {
          uniquePush(reasons, "TRAVEL_UNCONFIRMED");
        }
        if (travelAfter.estimatedTravelMinutes === null) travelConfirmed = false;
      }
    }
  }

  const operationalStartMinute =
    serviceEndMinute === null
      ? null
      : input.candidateServiceStartMinute -
        travelBeforeMinutes -
        bufferBeforeMinutes -
        input.request.parkingBufferMinutes;
  const operationalEndMinute =
    serviceEndMinute === null
      ? null
      : serviceEndMinute + travelAfterMinutes + bufferAfterMinutes;

  if (
    serviceEndMinute !== null &&
    (operationalStartMinute === null ||
      operationalEndMinute === null ||
      operationalStartMinute < input.teamContext.workingWindow.startMinute ||
      operationalEndMinute > input.teamContext.workingWindow.endMinute)
  ) {
    uniquePush(reasons, "OUTSIDE_WORKING_HOURS");
  }
  const preferred = input.request.preferredWindow;
  if (
    preferred !== null &&
    (input.candidateServiceStartMinute < preferred.startMinute ||
      input.candidateServiceStartMinute >= preferred.endMinute)
  ) {
    uniquePush(reasons, "PREFERRED_WINDOW_MISMATCH");
  }
  if (
    operationalStartMinute !== null &&
    operationalEndMinute !== null &&
    input.teamContext.occupancyBlocks.some((block) =>
      overlaps(
        operationalStartMinute,
        operationalEndMinute,
        block.startMinute,
        block.endMinute,
      ),
    )
  ) {
    uniquePush(reasons, "OCCUPANCY_CONFLICT");
  }

  const blockingReasons: readonly CapacityReasonCode[] = [
    "TEAM_INACTIVE",
    "WORKING_HOURS_UNAVAILABLE",
    "OUTSIDE_WORKING_HOURS",
    "PREFERRED_WINDOW_MISMATCH",
    "OCCUPANCY_CONFLICT",
    "CAPABILITY_UNAVAILABLE",
    "EQUIPMENT_UNAVAILABLE",
    "SERVICE_DURATION_UNAVAILABLE",
  ];
  const hasOperationalBlock = reasons.some((reason) =>
    blockingReasons.includes(reason),
  );
  const operationallyFits =
    serviceMinutes !== null && !hasOperationalBlock && travelConfirmed;
  const reviewRequired = reasons.length > 0;
  const disposition = hasOperationalBlock
    ? "UNAVAILABLE"
    : reviewRequired
      ? "REQUEST_REVIEW"
      : "AVAILABLE";

  return {
    teamCode: team.code,
    disposition,
    feasible: disposition === "AVAILABLE",
    operationallyFits,
    serviceStartMinute: input.candidateServiceStartMinute,
    serviceEndMinute,
    operationalStartMinute,
    operationalEndMinute,
    travelBeforeMinutes,
    travelAfterMinutes,
    serviceMinutes,
    bufferMinutes: bufferBeforeMinutes + bufferAfterMinutes,
    reasonCodes: reasons,
    warnings: [...new Set(warnings)],
    travelBefore,
    travelAfter,
  };
}

export function generateAvailableSlots(
  input: SlotGenerationInput,
): TeamAvailabilityResult {
  assertWorkingWindow(input.teamContext.workingWindow);
  const interval = input.schedulingPolicy.candidateIntervalMinutes;
  if (!Number.isSafeInteger(interval) || interval <= 0) {
    throw new Error("Candidate interval must be a positive whole minute value.");
  }

  const rangeStart = Math.max(
    input.teamContext.workingWindow.startMinute,
    input.request.preferredWindow?.startMinute ?? 0,
  );
  const rangeEnd = Math.min(
    input.teamContext.workingWindow.endMinute,
    input.request.preferredWindow?.endMinute ?? 24 * 60,
  );
  const firstCandidate = Math.ceil(rangeStart / interval) * interval;
  const bookableSlots: CandidateCapacityResult[] = [];
  const reviewSlots: CandidateCapacityResult[] = [];
  const rejectedSlots: CandidateCapacityResult[] = [];
  const warnings: string[] = [];

  for (
    let candidate = firstCandidate;
    candidate < rangeEnd && candidate < 24 * 60;
    candidate += interval
  ) {
    const result = evaluateCapacityCandidate({
      ...input,
      candidateServiceStartMinute: candidate,
    });
    for (const warning of result.warnings) pushWarning(warnings, warning);
    if (result.disposition === "AVAILABLE") bookableSlots.push(result);
    else if (result.disposition === "REQUEST_REVIEW") reviewSlots.push(result);
    else rejectedSlots.push(result);
  }

  const earliest = bookableSlots[0] ?? reviewSlots[0] ?? null;
  return {
    teamCode: input.teamContext.team.code,
    bookableSlots,
    reviewSlots,
    rejectedSlots,
    earliestStartMinute: earliest?.serviceStartMinute ?? null,
    warnings,
  };
}

export function generateAvailabilityForTeams(
  input: MultiTeamAvailabilityInput,
): readonly TeamAvailabilityResult[] {
  return input.teamContexts.map((teamContext) =>
    generateAvailableSlots({
      request: input.request,
      teamContext,
      travelEstimator: input.travelEstimator,
      schedulingPolicy: input.schedulingPolicy,
    }),
  );
}
