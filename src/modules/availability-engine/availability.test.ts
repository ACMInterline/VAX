import { describe, expect, it } from "vitest";
import {
  developmentEquipmentResources,
  developmentSchedulingPolicy,
  developmentServiceAreas,
  developmentTeams,
  developmentTravelTimeProfile,
  developmentWorkingHourPolicy,
} from "./development-config";
import {
  evaluateCapacityCandidate,
  generateAvailabilityForTeams,
  generateAvailableSlots,
  getWorkingWindowForDate,
} from "./availability";
import { createDevelopmentTravelTimeEstimator } from "./travel";
import type {
  JobCapacityInput,
  LocationInput,
  SchedulingBlock,
  TeamAvailabilityContext,
} from "./types";
import type {
  DurationCalculationResult,
  PriceCalculationResult,
} from "@/modules/commercial-engine/types";

const travelEstimator = createDevelopmentTravelTimeEstimator(
  developmentTravelTimeProfile,
);

function priceResult(manualAssessmentRequired = false): PriceCalculationResult {
  return {
    priceBookId: "price-book",
    priceBookCode: "TEST_EUR_BOOK",
    priceBookVersion: 1,
    priceBookStatus: "DRAFT",
    currency: "EUR",
    priceBasis: "GROSS",
    lines: [],
    subtotalMinorUnits: 10_000,
    minimumVisitAdjustmentMinorUnits: manualAssessmentRequired ? null : 0,
    netAmountMinorUnits: manualAssessmentRequired ? null : 8_333,
    vatRateBasisPoints: 2_000,
    vatAmountMinorUnits: manualAssessmentRequired ? null : 1_667,
    grossTotalMinorUnits: manualAssessmentRequired ? null : 10_000,
    warnings: [],
    manualAssessmentRequired,
    declineOrReferRequired: false,
    appliedRuleIds: ["test-price-rule"],
  };
}

function durationResult(
  minutes: number,
  manualAssessmentRequired = false,
): DurationCalculationResult {
  return {
    durationModelId: "duration-model",
    durationModelCode: "TEST_DURATION_MODEL",
    durationModelVersion: 1,
    lines: [],
    setupMinutes: 10,
    inspectionMinutes: 10,
    baseCleaningMinutes: Math.max(0, minutes - 30),
    modifierMinutes: 0,
    addonMinutes: 0,
    cleanupMinutes: 10,
    partialEstimatedMinutes: minutes,
    totalEstimatedMinutes: manualAssessmentRequired ? null : minutes,
    warnings: [],
    manualAssessmentRequired,
    declineOrReferRequired: false,
    appliedRuleIds: ["test-duration-rule"],
  };
}

function location(
  zoneCode: LocationInput["zoneCode"] = "SOFIA_CORE",
  district = "Lozenets",
): LocationInput {
  return {
    city: "Sofia",
    district,
    addressText: "Development fixture only",
    postalCode: null,
    latitude: null,
    longitude: null,
    accessNotes: null,
    parkingNotes: null,
    zoneCode,
  };
}

function serviceArea(zoneCode: LocationInput["zoneCode"]) {
  const zone = developmentServiceAreas.find((entry) => entry.code === zoneCode);
  if (!zone) throw new Error(`Missing development service area: ${zoneCode}`);
  return zone;
}

function request(
  overrides: Partial<JobCapacityInput> = {},
): JobCapacityInput {
  return {
    workDate: "2026-08-24",
    preferredWindow: null,
    location: location(),
    serviceArea: serviceArea("SOFIA_CORE"),
    priceCalculation: priceResult(),
    durationCalculation: durationResult(60),
    requiredCapabilityCodes: ["STANDARD_RESIDENTIAL"],
    requiredEquipmentCapabilityCodes: ["PORTABLE_EXTRACTION"],
    requiredTeamCount: 1,
    parkingBufferMinutes: 0,
    manualAssessmentRequired: false,
    ...overrides,
  };
}

function context(
  teamIndex = 0,
  occupancyBlocks: readonly SchedulingBlock[] = [],
): TeamAvailabilityContext {
  const team = developmentTeams[teamIndex];
  if (!team) throw new Error("Development team fixture is missing.");
  const workingWindow = getWorkingWindowForDate(
    developmentWorkingHourPolicy,
    "2026-08-24",
    team.code,
  );
  if (!workingWindow) throw new Error("Development working window is missing.");

  return {
    team,
    equipmentResources: developmentEquipmentResources,
    workingWindow,
    occupancyBlocks,
  };
}

function jobBlock(
  id: string,
  startMinute: number,
  endMinute: number,
  jobLocation: LocationInput,
): SchedulingBlock {
  return {
    id,
    type: "JOB",
    status: "CONFIRMED_FIXTURE",
    startMinute,
    endMinute,
    location: jobLocation,
    serviceMinutes: endMinute - startMinute,
    travelMinutes: 0,
    bufferMinutes: 0,
  };
}

describe("availability engine", () => {
  it("fails closed when working-hour authority is ambiguous or disabled", () => {
    const mondayRule = developmentWorkingHourPolicy.rules.find(
      (rule) => rule.weekday === 1 && rule.teamCode === null,
    );
    expect(mondayRule).toBeDefined();

    expect(getWorkingWindowForDate(
      {
        ...developmentWorkingHourPolicy,
        rules: [
          ...developmentWorkingHourPolicy.rules,
          { ...mondayRule!, id: "DUPLICATE_DEFAULT" },
        ],
      },
      "2026-08-24",
      "TEAM_A",
    )).toBeNull();

    const teamRule = {
      ...mondayRule!,
      id: "TEAM_A_OVERRIDE",
      teamCode: "TEAM_A" as const,
    };
    expect(getWorkingWindowForDate(
      {
        ...developmentWorkingHourPolicy,
        rules: [
          ...developmentWorkingHourPolicy.rules,
          teamRule,
          { ...teamRule, id: "DUPLICATE_TEAM_A_OVERRIDE" },
        ],
      },
      "2026-08-24",
      "TEAM_A",
    )).toBeNull();
    expect(getWorkingWindowForDate(
      {
        ...developmentWorkingHourPolicy,
        rules: [
          ...developmentWorkingHourPolicy.rules,
          { ...teamRule, enabled: false },
        ],
      },
      "2026-08-24",
      "TEAM_A",
    )).toBeNull();
  });

  it("supports both development teams without conflating their capacity", () => {
    const result = generateAvailabilityForTeams({
      request: request(),
      teamContexts: [context(0), context(1)],
      travelEstimator,
      schedulingPolicy: developmentSchedulingPolicy,
    });

    expect(result.map((entry) => entry.teamCode)).toEqual(["TEAM_A", "TEAM_B"]);
    expect(result.every((entry) => entry.bookableSlots.length > 0)).toBe(true);
  });

  it("honours 06:00 start, 22:00 completion and 30-minute candidates", () => {
    const result = generateAvailableSlots({
      request: request(),
      teamContext: context(),
      travelEstimator,
      schedulingPolicy: developmentSchedulingPolicy,
    });

    expect(result.bookableSlots[0]?.serviceStartMinute).toBe(6 * 60);
    expect(result.bookableSlots.at(-1)).toMatchObject({
      serviceStartMinute: 21 * 60,
      serviceEndMinute: 22 * 60,
    });
    expect(
      result.bookableSlots.every(
        (slot) => slot.serviceStartMinute % 30 === 0,
      ),
    ).toBe(true);
  });

  it("requires previous-job travel plus exactly one transition buffer", () => {
    const previous = jobBlock(
      "previous",
      8 * 60,
      9 * 60,
      location("SOFIA_CORE", "Center"),
    );
    const teamContext = context(0, [previous]);

    const tooEarly = evaluateCapacityCandidate({
      request: request(),
      teamContext,
      candidateServiceStartMinute: 9 * 60,
      travelEstimator,
      schedulingPolicy: developmentSchedulingPolicy,
    });
    const fits = evaluateCapacityCandidate({
      request: request(),
      teamContext,
      candidateServiceStartMinute: 9 * 60 + 30,
      travelEstimator,
      schedulingPolicy: developmentSchedulingPolicy,
    });

    expect(tooEarly.reasonCodes).toContain("OCCUPANCY_CONFLICT");
    expect(fits).toMatchObject({
      feasible: true,
      travelBeforeMinutes: 20,
      travelAfterMinutes: 0,
      bufferMinutes: 10,
      operationalStartMinute: 9 * 60,
    });
  });

  it("checks candidate-to-next-job travel and its transition buffer", () => {
    const candidateLocation = location("SOFIA_CORE", "Lozenets");
    const nextAt1330 = jobBlock(
      "next",
      13 * 60 + 30,
      14 * 60 + 30,
      location("SOFIA_CORE", "Center"),
    );
    const fits = evaluateCapacityCandidate({
      request: request({ location: candidateLocation }),
      teamContext: context(0, [nextAt1330]),
      candidateServiceStartMinute: 12 * 60,
      travelEstimator,
      schedulingPolicy: developmentSchedulingPolicy,
    });

    expect(fits).toMatchObject({
      feasible: true,
      travelAfterMinutes: 20,
      bufferMinutes: 10,
      operationalEndMinute: 13 * 60 + 30,
    });

    const nextAt1320 = { ...nextAt1330, startMinute: 13 * 60 + 20 };
    const conflict = evaluateCapacityCandidate({
      request: request({ location: candidateLocation }),
      teamContext: context(0, [nextAt1320]),
      candidateServiceStartMinute: 12 * 60,
      travelEstimator,
      schedulingPolicy: developmentSchedulingPolicy,
    });
    expect(conflict.reasonCodes).toContain("OCCUPANCY_CONFLICT");
  });

  it("uses one independent buffer for each neighbouring-job transition", () => {
    const result = evaluateCapacityCandidate({
      request: request(),
      teamContext: context(0, [
        jobBlock("previous", 8 * 60, 9 * 60, location("SOFIA_CORE", "Center")),
        jobBlock(
          "next",
          12 * 60,
          13 * 60,
          location("SOFIA_CORE", "Center"),
        ),
      ]),
      candidateServiceStartMinute: 10 * 60,
      travelEstimator,
      schedulingPolicy: developmentSchedulingPolicy,
    });

    expect(result).toMatchObject({
      feasible: true,
      travelBeforeMinutes: 20,
      travelAfterMinutes: 20,
      bufferMinutes: 20,
      operationalStartMinute: 9 * 60 + 30,
      operationalEndMinute: 11 * 60 + 30,
    });
  });

  it.each([Number.NaN, -120, 20.5])(
    "fails malformed provider travel minutes closed to review (%s)",
    (estimatedTravelMinutes) => {
      const previous = jobBlock(
        "previous",
        8 * 60,
        9 * 60,
        location("SOFIA_CORE", "Center"),
      );
      const result = evaluateCapacityCandidate({
        request: request(),
        teamContext: context(0, [previous]),
        candidateServiceStartMinute: 10 * 60,
        travelEstimator: () => ({
          estimatedTravelMinutes,
          distanceMetres: null,
          confidence: "PROVIDER_ESTIMATE",
          source: "invalid-provider-fixture",
          fallbackUsed: false,
          manualAssessmentRequired: false,
          warnings: [],
          appliedRuleId: null,
        }),
        schedulingPolicy: developmentSchedulingPolicy,
      });

      expect(result).toMatchObject({
        disposition: "REQUEST_REVIEW",
        feasible: false,
        operationallyFits: false,
        travelBeforeMinutes: 0,
      });
      expect(result.reasonCodes).toContain("TRAVEL_UNCONFIRMED");
    },
  );

  it("blocks non-working intervals and treats parking uncertainty as review", () => {
    const mealBreak: SchedulingBlock = {
      id: "meal",
      type: "MEAL_BREAK",
      status: "CONFIRMED_FIXTURE",
      startMinute: 12 * 60,
      endMinute: 12 * 60 + 30,
      location: null,
      serviceMinutes: 0,
      travelMinutes: 0,
      bufferMinutes: 0,
    };
    const conflict = evaluateCapacityCandidate({
      request: request(),
      teamContext: context(0, [mealBreak]),
      candidateServiceStartMinute: 12 * 60,
      travelEstimator,
      schedulingPolicy: developmentSchedulingPolicy,
    });
    expect(conflict.reasonCodes).toContain("OCCUPANCY_CONFLICT");

    const parkingReview = evaluateCapacityCandidate({
      request: request({
        location: {
          ...location(),
          parkingNotes: "Parking requires confirmation",
        },
        parkingBufferMinutes: 15,
      }),
      teamContext: context(),
      candidateServiceStartMinute: 10 * 60,
      travelEstimator,
      schedulingPolicy: developmentSchedulingPolicy,
    });
    expect(parkingReview).toMatchObject({
      disposition: "REQUEST_REVIEW",
      operationalStartMinute: 9 * 60 + 45,
    });
    expect(parkingReview.reasonCodes).toContain(
      "PARKING_CONFIRMATION_REQUIRED",
    );
  });

  it("does not add setup or cleanup to the Phase 2A total a second time", () => {
    const result = evaluateCapacityCandidate({
      request: request({ durationCalculation: durationResult(75) }),
      teamContext: context(),
      candidateServiceStartMinute: 10 * 60,
      travelEstimator,
      schedulingPolicy: developmentSchedulingPolicy,
    });

    expect(result).toMatchObject({
      serviceMinutes: 75,
      serviceStartMinute: 10 * 60,
      serviceEndMinute: 11 * 60 + 15,
      operationalStartMinute: 10 * 60,
      operationalEndMinute: 11 * 60 + 15,
      bufferMinutes: 0,
    });
  });

  it("rejects unavailable equipment and unavailable team capability", () => {
    const noEquipment = evaluateCapacityCandidate({
      request: request(),
      teamContext: {
        ...context(),
        equipmentResources: developmentEquipmentResources.map((resource) => ({
          ...resource,
          status: "MAINTENANCE" as const,
        })),
      },
      candidateServiceStartMinute: 10 * 60,
      travelEstimator,
      schedulingPolicy: developmentSchedulingPolicy,
    });
    expect(noEquipment.reasonCodes).toContain("EQUIPMENT_UNAVAILABLE");

    const noCapability = evaluateCapacityCandidate({
      request: request({
        requiredCapabilityCodes: ["SPECIALIST_ASSESSMENT"],
      }),
      teamContext: context(),
      candidateServiceStartMinute: 10 * 60,
      travelEstimator,
      schedulingPolicy: developmentSchedulingPolicy,
    });
    expect(noCapability.reasonCodes).toContain("CAPABILITY_UNAVAILABLE");
  });

  it("validates request locations and keeps inactive service areas in review", () => {
    expect(() =>
      evaluateCapacityCandidate({
        request: request({
          location: { ...location(), latitude: 42.7, longitude: null },
        }),
        teamContext: context(),
        candidateServiceStartMinute: 10 * 60,
        travelEstimator,
        schedulingPolicy: developmentSchedulingPolicy,
      }),
    ).toThrow(/latitude and longitude/i);

    const inactiveArea = evaluateCapacityCandidate({
      request: request({
        serviceArea: { ...serviceArea("SOFIA_CORE"), active: false },
      }),
      teamContext: context(),
      candidateServiceStartMinute: 10 * 60,
      travelEstimator,
      schedulingPolicy: developmentSchedulingPolicy,
    });
    expect(inactiveArea).toMatchObject({
      disposition: "REQUEST_REVIEW",
      feasible: false,
    });
    expect(inactiveArea.reasonCodes).toContain(
      "SERVICE_AREA_CONFIRMATION_REQUIRED",
    );
  });

  it.each([
    {
      name: "outside Sofia",
      overrides: {
        location: location("OUTSIDE_SOFIA", "External fixture"),
        serviceArea: serviceArea("OUTSIDE_SOFIA"),
      },
      reason: "OUTSIDE_SOFIA_REVIEW",
    },
    {
      name: "specialist or uncertain scope",
      overrides: {
        priceCalculation: priceResult(true),
        durationCalculation: durationResult(75, true),
        manualAssessmentRequired: true,
      },
      reason: "MANUAL_ASSESSMENT_REQUIRED",
    },
    {
      name: "large commercial duration",
      overrides: { durationCalculation: durationResult(361) },
      reason: "LARGE_JOB_REVIEW",
    },
    {
      name: "multi-team request",
      overrides: { requiredTeamCount: 2 as const },
      reason: "MULTI_TEAM_REVIEW",
    },
  ])("returns request review for $name", ({ overrides, reason }) => {
    const result = evaluateCapacityCandidate({
      request: request(overrides),
      teamContext: context(),
      candidateServiceStartMinute: 10 * 60,
      travelEstimator,
      schedulingPolicy: developmentSchedulingPolicy,
    });

    expect(result.disposition).toBe("REQUEST_REVIEW");
    expect(result.feasible).toBe(false);
    expect(result.reasonCodes).toContain(reason);
  });
});
