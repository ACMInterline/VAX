import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  canonicalReferenceCollections,
  capabilityStatuses,
  cleaningItemTypeMeasurementModes,
  cleaningItemTypes,
  cleaningProductCategories,
  cleaningProducts,
  conditionLevels,
  fibreMaterials,
  issueHandlingClassifications,
  issueTypes,
  mechanicalActionLevels,
  measurementModes,
  publicRequestItemTypeCodes,
  riskFlags,
  serviceAddons,
  serviceCategories,
  serviceItemCapabilities,
  serviceTreatmentLevels,
  services,
  surfaceConstructions,
  treatmentApproaches,
  treatmentLevels,
} from "./catalogue";
import {
  conditionValues,
  requestServiceValues,
} from "@/modules/public-request/request-schema";

const requiredItemTypeCodes = [
  "CARPET_FIXED",
  "RUG",
  "RUNNER",
  "SOFA_2_SEAT",
  "SOFA_3_SEAT",
  "SOFA_4_PLUS",
  "SOFA_CORNER",
  "SOFA_U_SHAPED",
  "SOFA_BED",
  "ARMCHAIR",
  "DINING_CHAIR_UPHOLSTERED",
  "OFFICE_CHAIR_UPHOLSTERED",
  "BENCH_UPHOLSTERED",
  "OTTOMAN",
  "HEADBOARD",
  "MATTRESS_SINGLE",
  "MATTRESS_DOUBLE",
  "MATTRESS_KING_OR_LARGE",
  "MATTRESS_CHILD",
  "OFFICE_CARPET",
  "COMMERCIAL_UPHOLSTERY",
  "OTHER_TEXTILE_SURFACE",
] as const;

function collectKeys(value: unknown, keys: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectKeys(entry, keys));
  } else if (value && typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      keys.add(key.toLowerCase());
      collectKeys(nestedValue, keys);
    }
  }

  return keys;
}

function sourceFilesWithin(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) return sourceFilesWithin(entryPath);
    return /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")
      ? [entryPath]
      : [];
  });
}

describe("canonical service catalogue", () => {
  it("keeps stable machine codes unique and reference rows localized", () => {
    for (const collection of canonicalReferenceCollections) {
      const codes = collection.map((entry) => entry.code);

      expect(new Set(codes).size).toBe(codes.length);
      expect(codes).toEqual([...codes].sort((left, right) => {
        const leftEntry = collection.find((entry) => entry.code === left);
        const rightEntry = collection.find((entry) => entry.code === right);
        return (leftEntry?.sortOrder ?? 0) - (rightEntry?.sortOrder ?? 0);
      }));

      for (const entry of collection) {
        expect(entry.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
        expect(entry.label.bg.trim()).not.toBe("");
        expect(entry.label.en.trim()).not.toBe("");
        expect(entry.description.bg.trim()).not.toBe("");
        expect(entry.description.en.trim()).not.toBe("");
      }
    }
  });

  it("contains the approved cleaning-item and treatment vocabularies", () => {
    expect(serviceCategories.map((entry) => entry.code)).toEqual([
      "CARPET_FLOORING",
      "RUGS",
      "UPHOLSTERED_FURNITURE",
      "MATTRESSES",
      "COMMERCIAL_TEXTILE_SURFACES",
      "SPECIALIST_TEXTILE_CARE",
    ]);
    expect(services.map((entry) => entry.code)).toEqual([
      "CARPET_CARE",
      "RUG_RUNNER_CARE",
      "UPHOLSTERY_CARE",
      "MATTRESS_CARE",
      "COMMERCIAL_TEXTILE_CARE",
      "DELICATE_TEXTILE_ASSESSMENT",
    ]);
    expect(cleaningItemTypes.map((entry) => entry.code)).toEqual(
      requiredItemTypeCodes,
    );
    expect(measurementModes.map((entry) => entry.code)).toEqual([
      "AREA_M2",
      "PER_ITEM",
      "PER_SEAT",
      "LINEAR_METER",
      "CUSTOM_ASSESSMENT",
    ]);
    expect(treatmentLevels.map((entry) => entry.code)).toEqual([
      "GENTLE_CARE",
      "REFRESH",
      "DEEP_CLEAN",
      "INTENSIVE",
      "SPECIALIST_ASSESSMENT",
    ]);
    expect(treatmentLevels.every((entry) => !entry.customerSelectable)).toBe(
      true,
    );
  });

  it("contains the approved inspection and treatment-support vocabularies", () => {
    expect(fibreMaterials.map((entry) => entry.code)).toEqual([
      "UNKNOWN",
      "SYNTHETIC_GENERIC",
      "POLYESTER",
      "POLYPROPYLENE",
      "POLYAMIDE_NYLON",
      "ACRYLIC",
      "COTTON",
      "LINEN",
      "VISCOSE_RAYON",
      "WOOL",
      "WOOL_BLEND",
      "SILK",
      "MIXED_FIBRES",
      "NATURAL_SYNTHETIC_BLEND",
      "OTHER",
      "SPECIALIST_UNCERTAIN",
    ]);
    expect(surfaceConstructions.map((entry) => entry.code)).toEqual([
      "UNKNOWN",
      "WOVEN",
      "TUFTED",
      "LOOP_PILE",
      "CUT_PILE",
      "SHAG_HIGH_PILE",
      "FLATWEAVE",
      "VELVET",
      "CHENILLE",
      "MICROFIBRE_FINISH",
      "OTHER",
    ]);
    expect(conditionLevels.map((entry) => entry.code)).toEqual([
      "LIGHT_MAINTENANCE",
      "NORMAL",
      "NOTICEABLY_SOILED",
      "HEAVILY_SOILED",
      "SPECIALIST_ASSESSMENT_REQUIRED",
    ]);
    expect(issueHandlingClassifications.map((entry) => entry.code)).toEqual([
      "STANDARD",
      "ASSESSMENT_REQUIRED",
      "SPECIALIST_ONLY",
      "DECLINE_OR_REFER",
    ]);
    expect(issueTypes.map((entry) => entry.code)).toEqual([
      "GENERAL_SOIL",
      "DUST_ACCUMULATION",
      "FOOD_DRINK",
      "COFFEE_TEA",
      "WINE",
      "GREASE_OIL",
      "MUD",
      "PET_RELATED",
      "URINE_SUSPECTED",
      "ODOUR",
      "COSMETICS",
      "INK",
      "BLOOD_OR_BIOLOGICAL",
      "UNKNOWN_STAIN",
      "OLD_STAIN",
      "COLOUR_TRANSFER",
      "CHEWING_GUM",
      "WAX",
      "OTHER",
    ]);
    expect(riskFlags.map((entry) => entry.code)).toEqual([
      "DELICATE_MATERIAL",
      "UNKNOWN_FIBRE",
      "VALUABLE_ITEM",
      "ANTIQUE_OR_VINTAGE",
      "COLOURFASTNESS_CONCERN",
      "MOISTURE_SENSITIVE",
      "EXISTING_DAMAGE",
      "HEAVY_WEAR",
      "LOOSE_SEAMS",
      "FRAYING",
      "SHRINKAGE_RISK",
      "DYE_BLEED_RISK",
      "PREVIOUS_CHEMICAL_TREATMENT",
      "HANDMADE",
      "ORIENTAL_PERSIAN_STYLE",
      "CUSTOMER_DECLARED_SPECIAL_VALUE",
      "OTHER",
    ]);
    expect(mechanicalActionLevels.map((entry) => entry.code)).toEqual([
      "NONE",
      "MINIMAL",
      "LIGHT",
      "STANDARD",
      "ENHANCED",
      "SPECIALIST_ONLY",
    ]);
    expect(treatmentApproaches.map((entry) => entry.code)).toEqual([
      "LOW_MOISTURE",
      "EXTRACTION",
      "TARGETED_EXTRACTION",
      "SPECIALIST_METHOD",
      "NOT_DETERMINED",
    ]);
  });

  it("contains only approved neutral product, add-on and capability codes", () => {
    expect(cleaningProductCategories.map((entry) => entry.code)).toEqual([
      "GENERAL_CLEANING_AGENT",
      "PRE_TREATMENT",
      "EXTRACTION_AGENT",
      "RINSE_AGENT",
      "SPOT_TREATMENT_AGENT",
      "PROTECTIVE_TREATMENT_AGENT",
      "OTHER",
    ]);
    expect(serviceAddons.map((entry) => entry.code)).toEqual([
      "STAIN_TARGETING",
      "ODOUR_TREATMENT",
      "ADDITIONAL_EXTRACTION",
      "DELICATE_MATERIAL_ASSESSMENT",
      "PROTECTIVE_TREATMENT",
      "OTHER",
    ]);
    expect(capabilityStatuses.map((entry) => entry.code)).toEqual([
      "STANDARD",
      "ASSESSMENT_REQUIRED",
      "SPECIALIST_ONLY",
      "UNAVAILABLE",
    ]);
  });

  it("assigns each cleaning-item type one permitted default measurement", () => {
    const modeCodes = new Set(measurementModes.map((entry) => entry.code));

    for (const itemType of cleaningItemTypes) {
      const relationships = cleaningItemTypeMeasurementModes.filter(
        (entry) => entry.itemTypeCode === itemType.code,
      );

      expect(relationships.length).toBeGreaterThan(0);
      expect(relationships.filter((entry) => entry.isDefault)).toHaveLength(1);
      expect(
        relationships.every((entry) => modeCodes.has(entry.measurementModeCode)),
      ).toBe(true);
    }
  });

  it("keeps capability relationships inside the canonical code sets", () => {
    const serviceCodes = new Set(services.map((entry) => entry.code));
    const itemTypeCodes = new Set(cleaningItemTypes.map((entry) => entry.code));
    const treatmentCodes = new Set(treatmentLevels.map((entry) => entry.code));

    expect(
      serviceItemCapabilities.every(
        (entry) =>
          serviceCodes.has(entry.serviceCode) &&
          itemTypeCodes.has(entry.itemTypeCode),
      ),
    ).toBe(true);
    expect(
      serviceTreatmentLevels.every(
        (entry) =>
          serviceCodes.has(entry.serviceCode) &&
          treatmentCodes.has(entry.treatmentLevelCode),
      ),
    ).toBe(true);
  });

  it("seeds no money fields or evidence-gated treatment claims", () => {
    const seededCatalogue = {
      canonicalReferenceCollections,
      serviceItemCapabilities,
      serviceTreatmentLevels,
      serviceAddons,
      cleaningProducts,
    };
    const keys = collectKeys(seededCatalogue);
    const serialized = JSON.stringify(seededCatalogue);

    for (const monetaryKey of ["price", "amount", "currency", "cost"]) {
      expect(keys.has(monetaryKey)).toBe(false);
    }

    expect(cleaningProducts).toEqual([]);
    expect(serialized).not.toMatch(
      /ANTIBACTERIAL|ALLERGEN|DISINFECTION|STERILISATION|STERILIZATION/i,
    );
  });
});

describe("catalogue consumers", () => {
  it("uses canonical item and condition codes in the browser-only request form", () => {
    expect(requestServiceValues).toEqual(publicRequestItemTypeCodes);
    expect(conditionValues).toEqual(
      conditionLevels.map((condition) => condition.code),
    );
  });

  it("keeps static public modules independent from database configuration", () => {
    const projectRoot = process.cwd();
    const publicSourceRoots = [
      "src/app/(public)",
      "src/app/(public-en)",
      "src/components/public",
      "src/content/public-site",
      "src/modules/public-request",
      "src/modules/service-catalogue",
    ];

    for (const sourceRoot of publicSourceRoots) {
      for (const filePath of sourceFilesWithin(
        path.join(projectRoot, sourceRoot),
      )) {
        const source = readFileSync(filePath, "utf8");

        expect(source).not.toMatch(/(?:@\/db|src\/db|DATABASE_URL)/);
      }
    }
  });
});
