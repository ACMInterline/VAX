import type {
  ScheduleCandidate,
  ScheduleCandidateBase,
} from "./types";

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertRankingCandidate(candidate: ScheduleCandidateBase): void {
  if (!candidate.key || !candidate.teamCode) {
    throw new Error("Candidate ranking requires stable key and team code.");
  }
  for (const [label, value] of [
    ["additional travel", candidate.additionalTravelMinutes],
    ["occupied workload", candidate.occupiedWorkloadMinutes],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Candidate ${label} must be a non-negative integer.`);
    }
  }
  if (Number.isNaN(candidate.serviceStart.valueOf())) {
    throw new Error("Candidate service start must be a valid instant.");
  }
}

export function compareScheduleCandidates(
  left: ScheduleCandidateBase,
  right: ScheduleCandidateBase,
): number {
  assertRankingCandidate(left);
  assertRankingCandidate(right);
  if (left.selectable !== right.selectable) {
    return left.selectable ? -1 : 1;
  }
  if (left.preferredWindowMatch !== right.preferredWindowMatch) {
    return left.preferredWindowMatch ? -1 : 1;
  }
  if (left.additionalTravelMinutes !== right.additionalTravelMinutes) {
    return left.additionalTravelMinutes - right.additionalTravelMinutes;
  }
  if (left.nearbyWorkContinuity !== right.nearbyWorkContinuity) {
    return left.nearbyWorkContinuity ? -1 : 1;
  }
  if (left.occupiedWorkloadMinutes !== right.occupiedWorkloadMinutes) {
    return left.occupiedWorkloadMinutes - right.occupiedWorkloadMinutes;
  }
  if (left.serviceStart.valueOf() !== right.serviceStart.valueOf()) {
    return left.serviceStart.valueOf() - right.serviceStart.valueOf();
  }
  const teamOrder = compareText(left.teamCode, right.teamCode);
  return teamOrder || compareText(left.key, right.key);
}

export function rankScheduleCandidates(
  candidates: readonly ScheduleCandidateBase[],
): readonly ScheduleCandidate[] {
  for (const candidate of candidates) {
    assertRankingCandidate(candidate);
  }
  return [...candidates]
    .sort(compareScheduleCandidates)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}
