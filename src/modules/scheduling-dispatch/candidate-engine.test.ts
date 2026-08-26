import { describe, expect, it } from "vitest";
import type {
  LocationInput,
  TravelEstimate,
  TravelTimeEstimator,
} from "@/modules/availability-engine/types";
import {
  generateSchedulingCandidates,
  type SchedulingCandidateContext,
  type SchedulingOccupancy,
} from "./candidate-engine";

function location(district: string): LocationInput {
  return {
    city: "Sofia",
    district,
    addressText: `${district} fixture`,
    postalCode: "1000",
    latitude: null,
    longitude: null,
    accessNotes: null,
    parkingNotes: null,
    zoneCode: "SOFIA_CORE",
  };
}

function estimate(
  minutes: number | null,
  overrides: Partial<TravelEstimate> = {},
): TravelEstimate {
  return {
    estimatedTravelMinutes: minutes,
    distanceMetres: null,
    confidence: "PROVIDER_ESTIMATE",
    source: "PHASE_3G_TEST",
    fallbackUsed: false,
    manualAssessmentRequired: false,
    warnings: [],
    appliedRuleId: "phase-3g-test",
    ...overrides,
  };
}

const noTravel: TravelTimeEstimator = () => estimate(1);

function context(
  overrides: Partial<SchedulingCandidateContext> = {},
): SchedulingCandidateContext {
  return {
    workDate: "2026-08-26",
    serviceDurationMinutes: 60,
    location: location("Current"),
    workingWindow: { startMinute: 6 * 60, endMinute: 22 * 60 },
    preferredWindow: null,
    candidateIntervalMinutes: 30,
    interJobBufferMinutes: 10,
    parkingBufferMinutes: 0,
    largeJobReviewThresholdMinutes: 360,
    configurationProvisional: false,
    teamActive: true,
    teamCapabilityCodes: ["STANDARD_RESIDENTIAL"],
    requiredCapabilityCodes: ["STANDARD_RESIDENTIAL"],
    equipmentActive: true,
    equipmentCapabilityCode: "PORTABLE_EXTRACTION",
    requiredEquipmentCapabilityCodes: ["PORTABLE_EXTRACTION"],
    occupancies: [],
    equipmentOccupancies: [],
    travelEstimator: noTravel,
    ...overrides,
  };
}

function occupancy(
  id: string,
  serviceStartMinute: number,
  serviceEndMinute: number,
  operationalStartMinute: number,
  operationalEndMinute: number,
  district: string,
): SchedulingOccupancy {
  return {
    id,
    serviceStartMinute,
    serviceEndMinute,
    operationalStartMinute,
    operationalEndMinute,
    location: location(district),
  };
}

function at(
  candidates: ReturnType<typeof generateSchedulingCandidates>,
  serviceStartMinute: number,
) {
  const candidate = candidates.find(
    (item) => item.serviceStartMinute === serviceStartMinute,
  );
  expect(candidate, `candidate at minute ${serviceStartMinute}`).toBeDefined();
  return candidate!;
}

describe("scheduling candidate engine", () => {
  it("accounts independently for travel from the previous and to the following appointment", () => {
    const travelEstimator: TravelTimeEstimator = ({ origin, destination }) => {
      if (origin.district === "Previous" && destination.district === "Current") {
        return estimate(20);
      }
      if (origin.district === "Current" && destination.district === "Following") {
        return estimate(30);
      }
      throw new Error("Unexpected route in fixture.");
    };
    const candidate = at(
      generateSchedulingCandidates(
        context({
          preferredWindow: { startMinute: 10 * 60, endMinute: 11 * 60 },
          occupancies: [
            occupancy("previous", 8 * 60, 9 * 60, 8 * 60, 9 * 60, "Previous"),
            occupancy("following", 12 * 60, 13 * 60, 12 * 60, 13 * 60, "Following"),
          ],
          travelEstimator,
        }),
      ),
      10 * 60,
    );

    expect(candidate).toMatchObject({
      previousOccupancyId: "previous",
      nextOccupancyId: "following",
      travelBeforeMinutes: 20,
      travelAfterMinutes: 30,
      operationalStartMinute: 9 * 60 + 30,
      operationalEndMinute: 11 * 60 + 40,
      selectable: true,
      readiness: "READY",
      nearbyWorkContinuity: true,
    });
  });

  it("fails an impossible operational gap but permits an exactly adjacent half-open boundary", () => {
    const overlapping = at(
      generateSchedulingCandidates(
        context({
          preferredWindow: { startMinute: 10 * 60, endMinute: 11 * 60 },
          occupancies: [
            occupancy("previous", 8 * 60, 9 * 60, 8 * 60, 9 * 60 + 50, "Previous"),
          ],
          travelEstimator: () => estimate(20),
        }),
      ),
      10 * 60,
    );
    expect(overlapping).toMatchObject({
      operationalStartMinute: 9 * 60 + 30,
      selectable: false,
      readiness: "SCHEDULE_CONFLICT",
    });
    expect(overlapping.warnings).toContain(
      "Operational occupancy conflicts with another appointment.",
    );

    const adjacent = at(
      generateSchedulingCandidates(
        context({
          preferredWindow: { startMinute: 10 * 60, endMinute: 11 * 60 },
          occupancies: [
            occupancy("previous", 8 * 60, 9 * 60, 8 * 60, 9 * 60 + 30, "Previous"),
          ],
          travelEstimator: () => estimate(20),
        }),
      ),
      10 * 60,
    );
    expect(adjacent).toMatchObject({
      operationalStartMinute: 9 * 60 + 30,
      selectable: true,
      readiness: "READY",
    });
  });

  it("rejects equipment occupied by another team without treating it as a travel neighbor", () => {
    const candidate = at(
      generateSchedulingCandidates(
        context({
          preferredWindow: { startMinute: 10 * 60, endMinute: 11 * 60 },
          equipmentOccupancies: [
            {
              operationalStartMinute: 10 * 60 + 30,
              operationalEndMinute: 11 * 60 + 30,
            },
          ],
        }),
      ),
      10 * 60,
    );

    expect(candidate).toMatchObject({
      selectable: false,
      readiness: "SCHEDULE_CONFLICT",
      previousOccupancyId: null,
      nextOccupancyId: null,
    });
    expect(candidate.warnings).toContain(
      "Required equipment conflicts with another appointment.",
    );
  });

  it("enforces operational working boundaries including access and parking time", () => {
    const opening = at(
      generateSchedulingCandidates(
        context({
          preferredWindow: { startMinute: 6 * 60, endMinute: 7 * 60 },
          requiredEquipmentCapabilityCodes: [],
          equipmentActive: false,
          equipmentCapabilityCode: null,
        }),
      ),
      6 * 60,
    );
    expect(opening).toMatchObject({
      operationalStartMinute: 6 * 60,
      selectable: true,
      readiness: "READY",
    });

    const beforeOpening = at(
      generateSchedulingCandidates(
        context({
          preferredWindow: { startMinute: 6 * 60, endMinute: 7 * 60 },
          requiredEquipmentCapabilityCodes: [],
          equipmentActive: false,
          equipmentCapabilityCode: null,
          parkingBufferMinutes: 15,
        }),
      ),
      6 * 60,
    );
    expect(beforeOpening).toMatchObject({
      operationalStartMinute: 5 * 60 + 45,
      selectable: false,
      readiness: "SCHEDULE_CONFLICT",
      manualReviewRequired: true,
    });

    const closing = at(
      generateSchedulingCandidates(
        context({
          preferredWindow: { startMinute: 21 * 60, endMinute: 22 * 60 },
          requiredEquipmentCapabilityCodes: [],
          equipmentActive: false,
          equipmentCapabilityCode: null,
        }),
      ),
      21 * 60,
    );
    expect(closing).toMatchObject({
      operationalEndMinute: 22 * 60,
      selectable: true,
      readiness: "READY",
    });
  });

  it.each([
    {
      label: "inactive team",
      overrides: { teamActive: false },
      readiness: "MISSING_TEAM",
    },
    {
      label: "missing team capability",
      overrides: { teamCapabilityCodes: [] },
      readiness: "CAPABILITY_REVIEW",
    },
    {
      label: "inactive equipment",
      overrides: { equipmentActive: false },
      readiness: "MISSING_EQUIPMENT",
    },
    {
      label: "wrong equipment capability",
      overrides: { equipmentCapabilityCode: "UNKNOWN" as never },
      readiness: "MISSING_EQUIPMENT",
    },
  ])("fails closed for $label", ({ overrides, readiness }) => {
    const candidate = at(
      generateSchedulingCandidates(
        context({
          ...overrides,
          preferredWindow: { startMinute: 9 * 60, endMinute: 10 * 60 },
        }),
      ),
      9 * 60,
    );
    expect(candidate.selectable).toBe(false);
    expect(candidate.readiness).toBe(readiness);
  });

  it("keeps an otherwise fitting large job selectable only with explicit manual review", () => {
    const candidate = at(
      generateSchedulingCandidates(
        context({
          serviceDurationMinutes: 361,
          preferredWindow: { startMinute: 8 * 60, endMinute: 9 * 60 },
          requiredEquipmentCapabilityCodes: [],
          equipmentActive: false,
          equipmentCapabilityCode: null,
        }),
      ),
      8 * 60,
    );
    expect(candidate).toMatchObject({
      selectable: true,
      readiness: "READY",
      manualReviewRequired: true,
    });
    expect(candidate.warnings).toContain(
      "Large job requires staff capacity review.",
    );
  });

  it("marks deterministic fallback as reviewable but blocks unconfirmed travel", () => {
    const occupancies = [
      occupancy("previous", 8 * 60, 9 * 60, 8 * 60, 9 * 60, "Previous"),
    ];
    const reviewable = at(
      generateSchedulingCandidates(
        context({
          preferredWindow: { startMinute: 10 * 60, endMinute: 11 * 60 },
          configurationProvisional: true,
          occupancies,
          travelEstimator: () =>
            estimate(20, {
              confidence: "DEVELOPMENT_ASSUMPTION",
              fallbackUsed: true,
              warnings: ["Development travel assumption."],
            }),
        }),
      ),
      10 * 60,
    );
    expect(reviewable).toMatchObject({
      selectable: true,
      readiness: "TRAVEL_REVIEW",
      fallbackTravelUsed: true,
      manualReviewRequired: true,
    });
    expect(reviewable.warnings).toEqual(
      expect.arrayContaining([
        "Development travel assumption.",
        "Draft scheduling configuration requires explicit staff review.",
        "Deterministic travel fallback was used; no live routing provider was called.",
      ]),
    );

    const blocked = at(
      generateSchedulingCandidates(
        context({
          preferredWindow: { startMinute: 10 * 60, endMinute: 11 * 60 },
          occupancies,
          travelEstimator: () =>
            estimate(null, {
              confidence: "FALLBACK",
              fallbackUsed: true,
              manualAssessmentRequired: true,
              warnings: ["Route cannot be established."],
            }),
        }),
      ),
      10 * 60,
    );
    expect(blocked).toMatchObject({
      selectable: false,
      readiness: "TRAVEL_REVIEW",
      fallbackTravelUsed: true,
      manualReviewRequired: true,
    });
  });
});
