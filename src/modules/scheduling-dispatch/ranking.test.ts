import { describe, expect, it } from "vitest";
import type { ScheduleCandidateBase } from "./types";
import { rankScheduleCandidates } from "./ranking";

function candidate(
  key: string,
  overrides: Partial<ScheduleCandidateBase> = {},
): ScheduleCandidateBase {
  const serviceStart = new Date("2026-08-26T06:00:00.000Z");
  const serviceEnd = new Date("2026-08-26T08:00:00.000Z");
  return {
    key,
    teamId: 1,
    teamCode: "TEAM_A",
    teamName: "Team A",
    equipmentResourceId: null,
    equipmentLabel: null,
    workDate: "2026-08-26",
    serviceStart,
    serviceEnd,
    operationalStart: serviceStart,
    operationalEnd: serviceEnd,
    serviceDurationMinutes: 120,
    travelBeforeMinutes: 10,
    travelAfterMinutes: 10,
    travelMinutes: 20,
    bufferMinutes: 10,
    parkingBufferMinutes: 0,
    readiness: "READY",
    selectable: true,
    fallbackTravelUsed: false,
    manualReviewRequired: false,
    warnings: [],
    preferredWindowMatch: true,
    additionalTravelMinutes: 20,
    nearbyWorkContinuity: false,
    occupiedWorkloadMinutes: 300,
    ...overrides,
  };
}

describe("deterministic schedule candidate ranking", () => {
  it("applies every ranking factor in the documented order", () => {
    const input = [
      candidate("blocked", {
        selectable: false,
        readiness: "SCHEDULE_CONFLICT",
        additionalTravelMinutes: 0,
      }),
      candidate("non-preferred", {
        preferredWindowMatch: false,
        additionalTravelMinutes: 0,
      }),
      candidate("higher-travel", { additionalTravelMinutes: 30 }),
      candidate("no-continuity", { nearbyWorkContinuity: false }),
      candidate("higher-workload", {
        nearbyWorkContinuity: true,
        occupiedWorkloadMinutes: 400,
      }),
      candidate("later-start", {
        nearbyWorkContinuity: true,
        occupiedWorkloadMinutes: 100,
        serviceStart: new Date("2026-08-26T07:00:00.000Z"),
      }),
      candidate("team-b", {
        nearbyWorkContinuity: true,
        occupiedWorkloadMinutes: 100,
        teamCode: "TEAM_B",
      }),
      candidate("stable-b", {
        nearbyWorkContinuity: true,
        occupiedWorkloadMinutes: 100,
        key: "stable-b",
      }),
      candidate("stable-a", {
        nearbyWorkContinuity: true,
        occupiedWorkloadMinutes: 100,
        key: "stable-a",
      }),
    ];

    expect(rankScheduleCandidates(input).map(({ key, rank }) => [key, rank])).toEqual([
      ["stable-a", 1],
      ["stable-b", 2],
      ["team-b", 3],
      ["later-start", 4],
      ["higher-workload", 5],
      ["no-continuity", 6],
      ["higher-travel", 7],
      ["non-preferred", 8],
      ["blocked", 9],
    ]);
  });

  it("does not mutate the source candidate order", () => {
    const input = [
      candidate("later", { serviceStart: new Date("2026-08-26T07:00:00Z") }),
      candidate("earlier"),
    ];
    const before = input.map(({ key }) => key);
    expect(rankScheduleCandidates(input).map(({ key }) => key)).toEqual([
      "earlier",
      "later",
    ]);
    expect(input.map(({ key }) => key)).toEqual(before);
  });

  it("fails closed on invalid numeric ranking inputs", () => {
    expect(() =>
      rankScheduleCandidates([
        candidate("invalid", { additionalTravelMinutes: -1 }),
      ]),
    ).toThrow(/non-negative integer/i);
  });
});
