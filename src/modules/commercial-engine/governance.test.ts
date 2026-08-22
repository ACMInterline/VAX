import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { estimateContribution } from "./analytics";
import {
  developmentDurationModel,
  developmentPriceBooks,
  residentialDraftPriceBook,
  timingCategories,
  travelZones,
} from "./development-config";

describe("commercial data governance", () => {
  it("keeps every version and rule identifier unique", () => {
    const bookCodes = developmentPriceBooks.map((book) => book.code);
    const priceRuleIds = developmentPriceBooks.flatMap((book) =>
      book.rules.map((rule) => rule.id),
    );
    const durationRuleIds = developmentDurationModel.rules.map(
      (rule) => rule.id,
    );

    expect(new Set(bookCodes).size).toBe(bookCodes.length);
    expect(new Set(priceRuleIds).size).toBe(priceRuleIds.length);
    expect(new Set(durationRuleIds).size).toBe(durationRuleIds.length);
  });

  it("uses exact integer minor units and basis points", () => {
    for (const rule of residentialDraftPriceBook.rules) {
      if ("amountMinorUnits" in rule && rule.amountMinorUnits !== undefined) {
        expect(Number.isSafeInteger(rule.amountMinorUnits)).toBe(true);
      }
      if (
        "percentageBasisPoints" in rule &&
        rule.percentageBasisPoints !== undefined
      ) {
        expect(Number.isSafeInteger(rule.percentageBasisPoints)).toBe(true);
      }
    }
    expect(
      Number.isSafeInteger(
        residentialDraftPriceBook.vatConfiguration.rateBasisPoints,
      ),
    ).toBe(true);
  });

  it("leaves timing adjustments inactive and zone boundaries unresolved", () => {
    expect(timingCategories).toHaveLength(5);
    expect(
      residentialDraftPriceBook.rules
        .filter((rule) => rule.type === "TIMING_MODIFIER")
        .every((rule) => !rule.active && rule.percentageBasisPoints === 0),
    ).toBe(true);
    expect(
      travelZones.every(
        (zone) =>
          zone.distanceThresholdKm === null &&
          zone.travelTimeThresholdMinutes === null &&
          zone.boundaryNotes === null,
      ),
    ).toBe(true);
  });

  it("contains no unsupported antibacterial, allergen or sanitisation offer", () => {
    expect(JSON.stringify(developmentPriceBooks)).not.toMatch(
      /ANTIBACTERIAL|ANTI_ALLERGEN|CERTIFIED_SANITISATION|STERILISATION|STERILIZATION/i,
    );
  });

  it("uses insert-only conflict handling for versioned commercial values", () => {
    const seedSource = readFileSync(
      path.join(process.cwd(), "src/db/seed-commercial-engine.ts"),
      "utf8",
    );

    expect(seedSource).toMatch(
      /insert\(commercialTables\.priceBooks\)[\s\S]*?onConflictDoNothing/,
    );
    expect(seedSource).toMatch(
      /insert\(commercialTables\.priceRules\)[\s\S]*?onConflictDoNothing/,
    );
    expect(seedSource).toMatch(
      /insert\(commercialTables\.durationModels\)[\s\S]*?onConflictDoNothing/,
    );
  });
});

describe("contribution foundation", () => {
  it("accepts cost assumptions externally without seeding labour costs", () => {
    expect(
      estimateContribution({
        grossRevenueMinorUnits: 12_000,
        vatAmountMinorUnits: 2_000,
        estimatedTeamMinutes: 120,
        labourCostPerTeamHourMinorUnits: 2_000,
        estimatedConsumablesMinorUnits: 500,
        estimatedTravelCostMinorUnits: 300,
      }),
    ).toEqual({
      estimatedTeamMinutes: 120,
      estimatedLabourCostMinorUnits: 4_000,
      estimatedConsumablesMinorUnits: 500,
      estimatedTravelCostMinorUnits: 300,
      estimatedContributionMinorUnits: 5_200,
      contributionPerTeamHourMinorUnits: 2_600,
    });
  });
});
