import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { EstimateEngineInput } from "./estimate";
import { calculateStaffEstimate } from "./estimate";

const normalInput: EstimateEngineInput = {
  customerSegment: "RESIDENTIAL",
  conditionBandCode: "NORMAL",
  travelZoneCode: "SOFIA_CORE",
  timingCategoryCode: "STANDARD",
  governanceReviewReasonCodes: [],
  items: [
    {
      serviceCode: "UPHOLSTERY_CARE",
      itemTypeCode: "SOFA_2_SEAT",
      quantity: 1,
      issueCodes: [],
      addonCodes: [],
      riskFlagCodes: [],
    },
  ],
};

describe("persistent estimate orchestration", () => {
  it("captures complete versioned engine definitions, inputs and results", () => {
    const calculatedAt = "2026-08-24T12:00:00.000Z";
    const result = calculateStaffEstimate(normalInput, calculatedAt);

    expect(result.audience).toBe("STAFF_ONLY");
    expect(result.priceSnapshot).toMatchObject({
      schemaVersion: 1,
      calculatedAt,
      priceBook: {
        code: "SOFIA_RESIDENTIAL_V1_DRAFT",
        version: 1,
      },
      input: {
        items: normalInput.items,
        conditionBandCode: "NORMAL",
        travelZoneCode: "SOFIA_CORE",
        timingCategoryCode: "STANDARD",
      },
      result: {
        currency: "EUR",
      },
    });
    expect(result.priceSnapshot.configuration).toHaveProperty("rules");
    expect(result.durationSnapshot).toMatchObject({
      schemaVersion: 1,
      calculatedAt,
      durationModel: {
        code: "SOFIA_OPERATIONS_V1_DRAFT",
        version: 1,
      },
      result: {},
    });
    expect(result.durationSnapshot.configuration).toHaveProperty("rules");
  });

  it("forces manual review for inactive provisional development configuration", () => {
    const result = calculateStaffEstimate(
      normalInput,
      "2026-08-24T12:00:00.000Z",
    );

    expect(result.disposition).toBe("MANUAL_REVIEW_REQUIRED");
    expect(result.manualReviewRequired).toBe(true);
    expect(result.reviewReasonCodes).toEqual(
      expect.arrayContaining([
        "PRICE_BOOK_NOT_ACTIVE",
        "PRICE_BOOK_PROVISIONAL",
        "PRICE_BOOK_NOT_PUBLICATION_APPROVED",
        "DURATION_MODEL_NOT_ACTIVE",
        "DURATION_MODEL_PROVISIONAL",
        "SCHEDULING_POLICY_NOT_ACTIVE",
      ]),
    );
    expect(result.grossTotalMinorUnits).toBeGreaterThan(0);
    expect(result.totalEstimatedMinutes).not.toBeNull();
  });

  it("aggregates engine and service-area decline/refer conditions", () => {
    const result = calculateStaffEstimate(
      {
        ...normalInput,
        travelZoneCode: "OUTSIDE_SOFIA",
        items: [
          {
            ...normalInput.items[0]!,
            issueCodes: ["BLOOD_OR_BIOLOGICAL"],
          },
        ],
      },
      "2026-08-24T12:00:00.000Z",
    );

    expect(result.disposition).toBe("DECLINE_OR_REFER");
    expect(result.declineOrReferRequired).toBe(true);
    expect(result.reviewReasonCodes).toEqual(
      expect.arrayContaining([
        "PRICE_DECLINE_OR_REFER",
        "DURATION_DECLINE_OR_REFER",
        "SERVICE_AREA_NOT_ELIGIBLE",
      ]),
    );
  });

  it("preserves catalogue and missing-input governance reasons in the immutable result", () => {
    const result = calculateStaffEstimate(
      {
        ...normalInput,
        governanceReviewReasonCodes: [
          "CATALOGUE_SPECIALIST_ONLY",
          "MISSING_MATERIAL",
          "MISSING_MEASUREMENT",
        ],
      },
      "2026-08-24T12:00:00.000Z",
    );

    expect(result.manualReviewRequired).toBe(true);
    expect(result.reviewReasonCodes).toEqual(
      expect.arrayContaining([
        "CATALOGUE_SPECIALIST_ONLY",
        "MISSING_MATERIAL",
        "MISSING_MEASUREMENT",
      ]),
    );
  });

  it("rejects invalid snapshot instants", () => {
    expect(() => calculateStaffEstimate(normalInput, "not-a-date")).toThrow(
      "Estimate timestamp",
    );
  });
});
