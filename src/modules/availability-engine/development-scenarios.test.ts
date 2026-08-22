import { describe, expect, it } from "vitest";
import {
  developmentDurationModel,
  residentialDraftPriceBook,
} from "@/modules/commercial-engine/development-config";
import { calculateDuration } from "@/modules/commercial-engine/duration";
import { calculatePrice } from "@/modules/commercial-engine/pricing";
import {
  availabilityDevelopmentScenarios,
  itemsForScenarioMeasurement,
} from "./development-scenarios";

describe("availability development scenarios", () => {
  it("provides deterministic A-F fixtures", () => {
    expect(availabilityDevelopmentScenarios.map((scenario) => scenario.code)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
    ]);
  });

  it("exercises automatic, long-running and manual-assessment inputs", () => {
    const results = availabilityDevelopmentScenarios.map((scenario) => {
      const items = itemsForScenarioMeasurement(
        scenario,
        scenario.defaultMeasurement,
      );
      return {
        code: scenario.code,
        price: calculatePrice(residentialDraftPriceBook, {
          items,
          conditionBandCode: scenario.conditionBandCode,
          travelZoneCode: scenario.travelZoneCode,
          timingCategoryCode: "STANDARD",
        }),
        duration: calculateDuration(developmentDurationModel, {
          items,
          conditionBandCode: scenario.conditionBandCode,
        }),
      };
    });

    expect(results.find((result) => result.code === "A")?.duration.totalEstimatedMinutes).toBe(96);
    expect(results.find((result) => result.code === "D")?.duration.totalEstimatedMinutes).toBeGreaterThan(360);
    expect(results.find((result) => result.code === "E")).toMatchObject({
      price: { manualAssessmentRequired: true, grossTotalMinorUnits: null },
      duration: { manualAssessmentRequired: true, totalEstimatedMinutes: null },
    });
    expect(results.find((result) => result.code === "F")?.price.manualAssessmentRequired).toBe(true);
  });
});
