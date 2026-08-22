import type {
  SchedulingBlock,
  TeamUtilisationInput,
  TeamUtilisationResult,
  WorkingWindow,
} from "./types";

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }
}

function assertWindow(window: WorkingWindow): void {
  assertNonNegativeInteger(window.startMinute, "Working-window start");
  assertNonNegativeInteger(window.endMinute, "Working-window end");
  if (window.startMinute >= window.endMinute || window.endMinute > 24 * 60) {
    throw new Error("Working window must be a positive interval within one day.");
  }
}

function validateBlock(block: SchedulingBlock): void {
  assertNonNegativeInteger(block.startMinute, `Block ${block.id} start`);
  assertNonNegativeInteger(block.endMinute, `Block ${block.id} end`);
  if (block.startMinute >= block.endMinute || block.endMinute > 24 * 60) {
    throw new Error(`Block ${block.id} must be a positive interval within one day.`);
  }
  assertNonNegativeInteger(block.serviceMinutes, `Block ${block.id} service`);
  assertNonNegativeInteger(block.travelMinutes, `Block ${block.id} travel`);
  assertNonNegativeInteger(block.bufferMinutes, `Block ${block.id} buffer`);
}

function roundRatio(numerator: number, denominator: number): number {
  assertNonNegativeInteger(numerator, "Ratio numerator");
  if (!Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new Error("Ratio denominator must be a positive safe integer.");
  }
  return Math.floor((numerator + denominator / 2) / denominator);
}

function multiplySafe(left: number, right: number, label: string): number {
  const result = left * right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${label} exceeds safe integer precision.`);
  }
  return result;
}

function unionMinutes(
  intervals: readonly Readonly<{ start: number; end: number }>[],
): number {
  const sorted = [...intervals].sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );
  let total = 0;
  let currentStart: number | null = null;
  let currentEnd: number | null = null;

  for (const interval of sorted) {
    if (currentStart === null || currentEnd === null) {
      currentStart = interval.start;
      currentEnd = interval.end;
      continue;
    }
    if (interval.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, interval.end);
      continue;
    }
    total += currentEnd - currentStart;
    currentStart = interval.start;
    currentEnd = interval.end;
  }

  return currentStart === null || currentEnd === null
    ? total
    : total + currentEnd - currentStart;
}

export function calculateTeamUtilisation(
  input: TeamUtilisationInput,
): TeamUtilisationResult {
  assertWindow(input.workingWindow);
  for (const block of input.occupancyBlocks) validateBlock(block);

  const workingWindowMinutes =
    input.workingWindow.endMinute - input.workingWindow.startMinute;
  const unavailableIntervals = input.occupancyBlocks
    .filter((block) => block.type !== "JOB")
    .map((block) => ({
      start: Math.max(block.startMinute, input.workingWindow.startMinute),
      end: Math.min(block.endMinute, input.workingWindow.endMinute),
    }))
    .filter((interval) => interval.start < interval.end);
  const unavailableMinutes = unionMinutes(unavailableIntervals);
  const availableTeamMinutes = workingWindowMinutes - unavailableMinutes;

  const jobs = input.occupancyBlocks.filter((block) => block.type === "JOB");
  const scheduledServiceMinutes = jobs.reduce(
    (sum, block) => sum + block.serviceMinutes,
    0,
  );
  const scheduledTravelMinutes = jobs.reduce(
    (sum, block) => sum + block.travelMinutes,
    0,
  );
  const scheduledBufferMinutes = jobs.reduce(
    (sum, block) => sum + block.bufferMinutes,
    0,
  );
  const occupiedTeamMinutes =
    scheduledServiceMinutes + scheduledTravelMinutes + scheduledBufferMinutes;
  if (!Number.isSafeInteger(occupiedTeamMinutes)) {
    throw new Error("Occupied team minutes exceed safe integer precision.");
  }
  if (occupiedTeamMinutes > availableTeamMinutes) {
    throw new Error("Scheduled job components exceed available team minutes.");
  }

  const idleMinutes = availableTeamMinutes - occupiedTeamMinutes;
  return {
    workingWindowMinutes,
    unavailableMinutes,
    availableTeamMinutes,
    scheduledServiceMinutes,
    scheduledTravelMinutes,
    scheduledBufferMinutes,
    occupiedTeamMinutes,
    idleMinutes,
    serviceUtilisationBasisPoints:
      availableTeamMinutes === 0
        ? 0
        : roundRatio(
            multiplySafe(
              scheduledServiceMinutes,
              10_000,
              "Service-utilisation numerator",
            ),
            availableTeamMinutes,
          ),
    occupiedUtilisationBasisPoints:
      availableTeamMinutes === 0
        ? 0
        : roundRatio(
            multiplySafe(
              occupiedTeamMinutes,
              10_000,
              "Occupied-utilisation numerator",
            ),
            availableTeamMinutes,
          ),
    travelShareBasisPoints:
      occupiedTeamMinutes === 0
        ? 0
        : roundRatio(
            multiplySafe(
              scheduledTravelMinutes,
              10_000,
              "Travel-share numerator",
            ),
            occupiedTeamMinutes,
          ),
  };
}

export function calculateTeamAndLabourTime(
  teamMinutes: number,
  crewSize: number,
) {
  assertNonNegativeInteger(teamMinutes, "Team minutes");
  if (!Number.isSafeInteger(crewSize) || crewSize <= 0) {
    throw new Error("Crew size must be a positive safe integer.");
  }
  const labourMinutes = multiplySafe(teamMinutes, crewSize, "Labour minutes");
  return {
    teamMinutes,
    labourMinutes,
    teamHoursHundredths: roundRatio(
      multiplySafe(teamMinutes, 100, "Team-hours numerator"),
      60,
    ),
    labourHoursHundredths: roundRatio(
      multiplySafe(labourMinutes, 100, "Labour-hours numerator"),
      60,
    ),
  };
}

export function calculateRevenueProductivity(input: {
  grossRevenueMinorUnits: number;
  estimatedContributionMinorUnits: number;
  occupiedTeamMinutes: number;
}) {
  assertNonNegativeInteger(input.grossRevenueMinorUnits, "Gross revenue");
  assertNonNegativeInteger(
    input.estimatedContributionMinorUnits,
    "Estimated contribution",
  );
  if (!Number.isSafeInteger(input.occupiedTeamMinutes) || input.occupiedTeamMinutes <= 0) {
    throw new Error("Occupied team minutes must be a positive safe integer.");
  }

  return {
    grossRevenuePerOccupiedTeamHourMinorUnits: roundRatio(
      multiplySafe(
        input.grossRevenueMinorUnits,
        60,
        "Revenue-productivity numerator",
      ),
      input.occupiedTeamMinutes,
    ),
    contributionPerOccupiedTeamHourMinorUnits: roundRatio(
      multiplySafe(
        input.estimatedContributionMinorUnits,
        60,
        "Contribution-productivity numerator",
      ),
      input.occupiedTeamMinutes,
    ),
  };
}
