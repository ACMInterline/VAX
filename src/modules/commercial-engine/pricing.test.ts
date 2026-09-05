import { describe, expect, it } from "vitest";
import {
  b2bDraftPriceBook,
  residentialDraftPriceBook,
} from "./development-config";
import {
  attelierB2bPriceBook,
  attelierResidentialPriceBook,
} from "./attelier-config";
import { calculatePrice, createPriceSnapshot } from "./pricing";
import type { PriceCalculationInput } from "./types";

const normalSofaInput = {
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
  conditionBandCode: "NORMAL",
  travelZoneCode: "SOFIA_CORE",
  timingCategoryCode: "STANDARD",
} as const satisfies PriceCalculationInput;

function areaInput(areaHundredthsM2: number): PriceCalculationInput {
  return {
    items: [
      {
        serviceCode: "CARPET_CARE",
        itemTypeCode: "CARPET_FIXED",
        quantity: 1,
        areaHundredthsM2,
        sides: 1,
        issueCodes: [],
        addonCodes: [],
        riskFlagCodes: [],
      },
    ],
    conditionBandCode: "NORMAL",
    travelZoneCode: "SOFIA_CORE",
    timingCategoryCode: "STANDARD",
  };
}

function baseLineAmount(result: ReturnType<typeof calculatePrice>): number {
  const line = result.lines.find(
    (entry) => entry.kind === "BASE_ITEM" || entry.kind === "PER_AREA_M2",
  );
  if (!line) {
    throw new Error("Expected a base-item calculation line.");
  }

  return line.amountMinorUnits;
}

describe("development price-book authority", () => {
  it("keeps residential and B2B drafts versioned, provisional and unpublished", () => {
    expect(residentialDraftPriceBook).toMatchObject({
      code: "SOFIA_RESIDENTIAL_V1_DRAFT",
      currency: "EUR",
      customerSegment: "RESIDENTIAL",
      version: 1,
      status: "DRAFT",
      provisional: true,
      approvedForPublication: false,
      active: false,
    });
    expect(b2bDraftPriceBook).toMatchObject({
      code: "SOFIA_B2B_V1_DRAFT",
      currency: "EUR",
      customerSegment: "B2B",
      version: 1,
      status: "DRAFT",
      provisional: true,
      approvedForPublication: false,
      active: false,
    });
    expect(b2bDraftPriceBook.rules).toEqual([]);
  });

  it("rejects a non-EUR book", () => {
    expect(() =>
      calculatePrice(
        { ...residentialDraftPriceBook, currency: "BGN" as "EUR" },
        normalSofaInput,
      ),
    ).toThrow(/EUR/);
  });
});

describe("pure price calculation", () => {
  it("calculates registered gross B2C VAT without changing the customer total", () => {
    const result = calculatePrice(residentialDraftPriceBook, normalSofaInput);

    expect(result.manualAssessmentRequired).toBe(false);
    expect(result.subtotalMinorUnits).toBe(4_900);
    expect(result.minimumVisitAdjustmentMinorUnits).toBe(0);
    expect(result.netAmountMinorUnits).toBe(4_083);
    expect(result.vatRateBasisPoints).toBe(2_000);
    expect(result.vatAmountMinorUnits).toBe(817);
    expect(result.grossTotalMinorUnits).toBe(4_900);
    expect(result.currency).toBe("EUR");
  });

  it("supports a non-VAT-registered calculation explicitly", () => {
    const result = calculatePrice(
      {
        ...residentialDraftPriceBook,
        vatConfiguration: {
          mode: "VAT_NOT_REGISTERED",
          rateBasisPoints: 0,
        },
      },
      normalSofaInput,
    );

    expect(result.netAmountMinorUnits).toBe(4_900);
    expect(result.vatAmountMinorUnits).toBe(0);
    expect(result.grossTotalMinorUnits).toBe(4_900);
  });

  it("supports future net-basis B2B-style tax presentation", () => {
    const result = calculatePrice(
      {
        ...residentialDraftPriceBook,
        priceBasis: "NET",
      },
      normalSofaInput,
    );

    expect(result.netAmountMinorUnits).toBe(4_900);
    expect(result.vatAmountMinorUnits).toBe(980);
    expect(result.grossTotalMinorUnits).toBe(5_880);
  });

  it("raises a low calculated order to the minimum instead of adding it twice", () => {
    const result = calculatePrice(residentialDraftPriceBook, {
      ...normalSofaInput,
      items: [
        {
          ...normalSofaInput.items[0],
          itemTypeCode: "ARMCHAIR",
        },
      ],
    });

    expect(result.subtotalMinorUnits).toBe(2_000);
    expect(result.minimumVisitAdjustmentMinorUnits).toBe(2_900);
    expect(result.grossTotalMinorUnits).toBe(4_900);
    expect(
      result.lines.find((line) => line.kind === "MINIMUM_VISIT_ADJUSTMENT"),
    ).toMatchObject({ amountMinorUnits: 2_900 });
  });

  it("applies an enhanced condition modifier to item work before the minimum", () => {
    const result = calculatePrice(residentialDraftPriceBook, {
      ...normalSofaInput,
      conditionBandCode: "ENHANCED",
    });

    expect(result.subtotalMinorUnits).toBe(5_635);
    expect(
      result.lines.find((line) => line.kind === "CONDITION_MODIFIER"),
    ).toMatchObject({ amountMinorUnits: 735 });
    expect(result.grossTotalMinorUnits).toBe(5_635);
  });

  it.each([
    [2_999, 10_796],
    [3_000, 10_800],
    [3_001, 9_003],
    [7_999, 23_997],
    [8_000, 24_000],
    [8_001, 20_803],
  ])(
    "uses selected-band pricing at %s hundredths of a square metre",
    (areaHundredthsM2, expectedBaseMinorUnits) => {
      const result = calculatePrice(
        residentialDraftPriceBook,
        areaInput(areaHundredthsM2),
      );

      expect(baseLineAmount(result)).toBe(expectedBaseMinorUnits);
      expect(result.manualAssessmentRequired).toBe(false);
    },
  );

  it("prices mattress sides and quantity as explicit dimensions", () => {
    const result = calculatePrice(residentialDraftPriceBook, {
      ...normalSofaInput,
      items: [
        {
          ...normalSofaInput.items[0],
          serviceCode: "MATTRESS_CARE",
          itemTypeCode: "MATTRESS_SINGLE",
          quantity: 2,
          sides: 2,
        },
      ],
    });

    expect(baseLineAmount(result)).toBe(9_200);
    expect(result.grossTotalMinorUnits).toBe(9_200);
  });

  it("leaves inactive timing categories at zero", () => {
    const result = calculatePrice(residentialDraftPriceBook, {
      ...normalSofaInput,
      timingCategoryCode: "WEEKEND",
    });

    expect(result.grossTotalMinorUnits).toBe(4_900);
    expect(result.lines.some((line) => line.kind === "TIMING_MODIFIER")).toBe(
      false,
    );
  });

  it("withholds a final price when an item requires assessment", () => {
    const result = calculatePrice(residentialDraftPriceBook, {
      ...normalSofaInput,
      items: [
        {
          ...normalSofaInput.items[0],
          itemTypeCode: "SOFA_U_SHAPED",
        },
      ],
    });

    expect(result.manualAssessmentRequired).toBe(true);
    expect(result.grossTotalMinorUnits).toBeNull();
    expect(result.appliedRuleIds).toContain(
      "SOFIA_RESIDENTIAL_V1_SOFA_U_SHAPED_ASSESS",
    );
  });

  it("declines biological auto-pricing and preserves known partial lines", () => {
    const result = calculatePrice(residentialDraftPriceBook, {
      ...normalSofaInput,
      items: [
        {
          ...normalSofaInput.items[0],
          issueCodes: ["BLOOD_OR_BIOLOGICAL"],
        },
      ],
    });

    expect(baseLineAmount(result)).toBe(4_900);
    expect(result.manualAssessmentRequired).toBe(true);
    expect(result.declineOrReferRequired).toBe(true);
    expect(result.grossTotalMinorUnits).toBeNull();
    expect(result.warnings.join(" ")).toMatch(/decline|refer/i);
  });

  it("requires confirmation for an unpriced add-on and outside-Sofia work", () => {
    const result = calculatePrice(residentialDraftPriceBook, {
      ...normalSofaInput,
      travelZoneCode: "OUTSIDE_SOFIA",
      items: [
        {
          ...normalSofaInput.items[0],
          addonCodes: ["ODOUR_TREATMENT"],
        },
      ],
    });

    expect(result.subtotalMinorUnits).toBe(4_900);
    expect(result.grossTotalMinorUnits).toBeNull();
    expect(result.manualAssessmentRequired).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/outside_sofia|odour/i);
  });

  it("returns deterministic, explainable lines and future snapshot provenance", () => {
    const first = calculatePrice(residentialDraftPriceBook, normalSofaInput);
    const second = calculatePrice(residentialDraftPriceBook, normalSofaInput);

    expect(second).toEqual(first);
    expect(first.lines.every((line) => line.ruleId.length > 0)).toBe(true);
    expect(first.appliedRuleIds).toContain(
      "SOFIA_RESIDENTIAL_V1_SOFA_3_SEAT",
    );

    const snapshot = createPriceSnapshot(
      normalSofaInput,
      first,
      "2026-08-22T00:00:00.000Z",
    );
    expect(snapshot).toMatchObject({
      priceBookCode: "SOFIA_RESIDENTIAL_V1_DRAFT",
      priceBookVersion: 1,
      currency: "EUR",
      calculatedAt: "2026-08-22T00:00:00.000Z",
      manualAssessmentRequired: false,
    });
  });
});

describe("ATTELIER staging commercial calibration", () => {
  it.each([
    ["DINING_CHAIR_UPHOLSTERED", "UPHOLSTERY_CARE", 700],
    ["ARMCHAIR", "UPHOLSTERY_CARE", 1_800],
    ["OTTOMAN", "UPHOLSTERY_CARE", 1_200],
    ["SOFA_2_SEAT", "UPHOLSTERY_CARE", 3_500],
    ["SOFA_3_SEAT", "UPHOLSTERY_CARE", 4_500],
    ["SOFA_4_PLUS", "UPHOLSTERY_CARE", 5_500],
    ["MATTRESS_SINGLE", "MATTRESS_CARE", 2_200],
    ["MATTRESS_DOUBLE", "MATTRESS_CARE", 3_000],
    ["MATTRESS_KING_OR_LARGE", "MATTRESS_CARE", 3_500],
  ] as const)(
    "preserves the approved one-unit %s customer price",
    (itemTypeCode, serviceCode, expectedAmount) => {
      const result = calculatePrice(attelierResidentialPriceBook, {
        ...normalSofaInput,
        items: [
          {
            ...normalSofaInput.items[0],
            itemTypeCode,
            serviceCode,
          },
        ],
      });

      expect(baseLineAmount(result)).toBe(expectedAmount);
    },
  );

  it("uses exact carpet/rug rates, condition factors and zone minimums", () => {
    const carpet = calculatePrice(attelierResidentialPriceBook, {
      ...areaInput(1_000),
      conditionBandCode: "ENHANCED",
      travelZoneCode: "SOFIA_OUTSKIRTS",
    });
    const rug = calculatePrice(attelierResidentialPriceBook, {
      ...areaInput(1_000),
      items: [
        {
          ...areaInput(1_000).items[0]!,
          serviceCode: "RUG_RUNNER_CARE",
          itemTypeCode: "RUG",
        },
      ],
      conditionBandCode: "INTENSIVE",
      travelZoneCode: "SOFIA_EXTENDED",
    });

    expect(baseLineAmount(carpet)).toBe(4_000);
    expect(carpet.subtotalMinorUnits).toBe(4_600);
    expect(carpet.minimumVisitAdjustmentMinorUnits).toBe(3_400);
    expect(carpet.grossTotalMinorUnits).toBe(8_000);
    expect(baseLineAmount(rug)).toBe(5_000);
    expect(rug.subtotalMinorUnits).toBe(6_500);
    expect(rug.minimumVisitAdjustmentMinorUnits).toBe(0);
    expect(rug.grossTotalMinorUnits).toBe(6_500);
  });

  it("prices a second mattress side at fifty percent and preserves unresolved VAT", () => {
    const result = calculatePrice(attelierResidentialPriceBook, {
      ...normalSofaInput,
      items: [
        {
          ...normalSofaInput.items[0],
          serviceCode: "MATTRESS_CARE",
          itemTypeCode: "MATTRESS_DOUBLE",
          sides: 2,
        },
      ],
    });

    expect(baseLineAmount(result)).toBe(4_500);
    expect(result).toMatchObject({
      netAmountMinorUnits: null,
      vatRateBasisPoints: null,
      vatAmountMinorUnits: null,
      grossTotalMinorUnits: 4_500,
      manualAssessmentRequired: true,
    });
    expect(result.warnings.join(" ")).toMatch(/VAT status is unresolved/);
  });

  it("keeps from-prices and biological contamination under staff control", () => {
    const fromPrice = calculatePrice(attelierResidentialPriceBook, {
      ...normalSofaInput,
      items: [
        {
          ...normalSofaInput.items[0],
          itemTypeCode: "SOFA_CORNER",
        },
      ],
    });
    const biological = calculatePrice(attelierResidentialPriceBook, {
      ...normalSofaInput,
      items: [
        {
          ...normalSofaInput.items[0],
          issueCodes: ["BLOOD_OR_BIOLOGICAL"],
        },
      ],
    });

    expect(baseLineAmount(fromPrice)).toBe(6_000);
    expect(fromPrice.grossTotalMinorUnits).toBeNull();
    expect(fromPrice.manualAssessmentRequired).toBe(true);
    expect(biological.declineOrReferRequired).toBe(true);
    expect(biological.grossTotalMinorUnits).toBeNull();
  });

  it("keeps timing surcharges and B2B automatic pricing inactive", () => {
    const early = calculatePrice(attelierResidentialPriceBook, {
      ...normalSofaInput,
      timingCategoryCode: "EARLY_MORNING",
    });
    const b2b = calculatePrice(attelierB2bPriceBook, {
      ...normalSofaInput,
    });

    expect(early.subtotalMinorUnits).toBe(4_500);
    expect(early.lines.some((line) => line.kind === "TIMING_MODIFIER")).toBe(
      false,
    );
    expect(b2b.manualAssessmentRequired).toBe(true);
    expect(b2b.grossTotalMinorUnits).toBeNull();
  });
});
