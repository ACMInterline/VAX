import { describe, expect, it } from "vitest";
import {
  calculateRevenueProductivity,
  calculateTeamAndLabourTime,
  calculateTeamUtilisation,
} from "./utilisation";

describe("operational utilisation", () => {
  it("separates service, travel, buffer, idle and unavailable minutes", () => {
    const result = calculateTeamUtilisation({
      workingWindow: { startMinute: 6 * 60, endMinute: 22 * 60 },
      occupancyBlocks: [
        {
          id: "job-1",
          type: "JOB",
          status: "CONFIRMED_FIXTURE",
          startMinute: 9 * 60,
          endMinute: 11 * 60 + 40,
          location: null,
          serviceMinutes: 120,
          travelMinutes: 30,
          bufferMinutes: 10,
        },
        {
          id: "meal",
          type: "MEAL_BREAK",
          status: "CONFIRMED_FIXTURE",
          startMinute: 12 * 60,
          endMinute: 12 * 60 + 30,
          location: null,
          serviceMinutes: 0,
          travelMinutes: 0,
          bufferMinutes: 0,
        },
      ],
    });

    expect(result).toEqual({
      workingWindowMinutes: 960,
      unavailableMinutes: 30,
      availableTeamMinutes: 930,
      scheduledServiceMinutes: 120,
      scheduledTravelMinutes: 30,
      scheduledBufferMinutes: 10,
      occupiedTeamMinutes: 160,
      idleMinutes: 770,
      serviceUtilisationBasisPoints: 1_290,
      occupiedUtilisationBasisPoints: 1_720,
      travelShareBasisPoints: 1_875,
    });
  });

  it("distinguishes team-hours from labour-hours for a two-person crew", () => {
    expect(calculateTeamAndLabourTime(120, 2)).toEqual({
      teamMinutes: 120,
      labourMinutes: 240,
      teamHoursHundredths: 200,
      labourHoursHundredths: 400,
    });
  });

  it("does not double-count overlapping non-working blocks", () => {
    const result = calculateTeamUtilisation({
      workingWindow: { startMinute: 6 * 60, endMinute: 22 * 60 },
      occupancyBlocks: [
        {
          id: "break-a",
          type: "MEAL_BREAK",
          status: "FIXTURE",
          startMinute: 12 * 60,
          endMinute: 13 * 60,
          location: null,
          serviceMinutes: 0,
          travelMinutes: 0,
          bufferMinutes: 0,
        },
        {
          id: "hold-b",
          type: "OPERATIONAL_HOLD",
          status: "FIXTURE",
          startMinute: 12 * 60 + 30,
          endMinute: 13 * 60 + 30,
          location: null,
          serviceMinutes: 0,
          travelMinutes: 0,
          bufferMinutes: 0,
        },
      ],
    });

    expect(result.unavailableMinutes).toBe(90);
    expect(result.availableTeamMinutes).toBe(870);
  });

  it("is ready for gross revenue and contribution per occupied team-hour", () => {
    expect(
      calculateRevenueProductivity({
        grossRevenueMinorUnits: 12_000,
        estimatedContributionMinorUnits: 5_200,
        occupiedTeamMinutes: 120,
      }),
    ).toEqual({
      grossRevenuePerOccupiedTeamHourMinorUnits: 6_000,
      contributionPerOccupiedTeamHourMinorUnits: 2_600,
    });
  });
});
