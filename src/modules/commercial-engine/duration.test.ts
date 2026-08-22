import { describe, expect, it } from "vitest";
import { developmentDurationModel } from "./development-config";
import { calculateDuration } from "./duration";
import type { DurationCalculationInput } from "./types";

const sofaInput = {
  items: [
    {
      serviceCode: "UPHOLSTERY_CARE",
      itemTypeCode: "SOFA_3_SEAT",
      quantity: 1,
      sides: 1,
      issueCodes: [],
      addonCodes: [],
      riskFlagCodes: [],
    },
  ],
  conditionBandCode: "ENHANCED",
} as const satisfies DurationCalculationInput;

describe("duration calculation", () => {
  it("keeps setup, inspection, cleaning, modifier and cleanup explainable", () => {
    const result = calculateDuration(developmentDurationModel, sofaInput);

    expect(result).toMatchObject({
      setupMinutes: 10,
      inspectionMinutes: 10,
      baseCleaningMinutes: 45,
      modifierMinutes: 7,
      addonMinutes: 0,
      cleanupMinutes: 10,
      totalEstimatedMinutes: 82,
      manualAssessmentRequired: false,
      durationModelCode: "SOFIA_OPERATIONS_V1_DRAFT",
      durationModelVersion: 1,
    });
    expect(result.lines.map((line) => line.minutes)).toEqual([
      10, 10, 45, 7, 10,
    ]);
  });

  it("uses the conservative 23 m²/hour productivity independently of price", () => {
    const result = calculateDuration(developmentDurationModel, {
      items: [
        {
          serviceCode: "CARPET_CARE",
          itemTypeCode: "CARPET_FIXED",
          quantity: 1,
          sides: 1,
          areaHundredthsM2: 2_300,
          issueCodes: [],
          addonCodes: [],
          riskFlagCodes: [],
        },
      ],
      conditionBandCode: "NORMAL",
    });

    expect(result.baseCleaningMinutes).toBe(60);
    expect(result.totalEstimatedMinutes).toBe(90);
    expect(result.appliedRuleIds).toContain(
      "SOFIA_OPERATIONS_V1_AREA_PRODUCTIVITY",
    );
  });

  it("supports mattress side count and quantity", () => {
    const result = calculateDuration(developmentDurationModel, {
      items: [
        {
          serviceCode: "MATTRESS_CARE",
          itemTypeCode: "MATTRESS_DOUBLE",
          quantity: 1,
          sides: 2,
          issueCodes: [],
          addonCodes: [],
          riskFlagCodes: [],
        },
      ],
      conditionBandCode: "NORMAL",
    });

    expect(result.baseCleaningMinutes).toBe(70);
    expect(result.totalEstimatedMinutes).toBe(100);
  });

  it("withholds an automatic total for assessment-led work", () => {
    const result = calculateDuration(developmentDurationModel, {
      ...sofaInput,
      conditionBandCode: "NORMAL",
      items: [
        {
          ...sofaInput.items[0],
          itemTypeCode: "SOFA_U_SHAPED",
        },
      ],
    });

    expect(result.baseCleaningMinutes).toBe(90);
    expect(result.partialEstimatedMinutes).toBe(120);
    expect(result.totalEstimatedMinutes).toBeNull();
    expect(result.manualAssessmentRequired).toBe(true);
  });

  it("does not invent automatic time for biological contamination", () => {
    const result = calculateDuration(developmentDurationModel, {
      ...sofaInput,
      conditionBandCode: "NORMAL",
      items: [
        {
          ...sofaInput.items[0],
          issueCodes: ["BLOOD_OR_BIOLOGICAL"],
        },
      ],
    });

    expect(result.totalEstimatedMinutes).toBeNull();
    expect(result.manualAssessmentRequired).toBe(true);
    expect(result.declineOrReferRequired).toBe(true);
  });

  it("is deterministic and has no pricing input", () => {
    const first = calculateDuration(developmentDurationModel, sofaInput);
    const second = calculateDuration(developmentDurationModel, sofaInput);

    expect(second).toEqual(first);
    expect("grossTotalMinorUnits" in first).toBe(false);
    expect(first.appliedRuleIds.every((id) => id.length > 0)).toBe(true);
  });
});
