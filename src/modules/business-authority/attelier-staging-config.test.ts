import { describe, expect, it } from "vitest";
import {
  attelierExactConfigurationDefinitions,
  exactConfigurationSha256,
  resolveAttelierStagingConfigurationReferences,
} from "./attelier-staging-config";

describe("ATTELIER exact staging configuration resolver", () => {
  it("resolves only the closed set of exact staging configurations", () => {
    const references = resolveAttelierStagingConfigurationReferences({
      VAX_ENVIRONMENT: "staging",
    });

    expect(references).toHaveLength(attelierExactConfigurationDefinitions.length);
    expect(references.length).toBeGreaterThan(0);
    expect(references.every((entry) => entry.environmentScope === "STAGING")).toBe(
      true,
    );
    expect(references.every((entry) => entry.status === "ACTIVE")).toBe(true);
    expect(references.every((entry) => !entry.provisional)).toBe(true);
    expect(references.every((entry) => !entry.unresolvedManualReview)).toBe(
      true,
    );
  });

  it("never exposes the staging resolver in development or production", () => {
    expect(
      resolveAttelierStagingConfigurationReferences({
        VAX_ENVIRONMENT: "development",
      }),
    ).toEqual([]);
    expect(
      resolveAttelierStagingConfigurationReferences({
        VAX_ENVIRONMENT: "production",
        NODE_ENV: "production",
      }),
    ).toEqual([]);
  });

  it("binds each reference to exact content rather than a named-row assertion", () => {
    const brand = attelierExactConfigurationDefinitions.find(
      (entry) => entry.authorityKey === "BRAND_IDENTITY",
    );
    expect(brand?.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(exactConfigurationSha256({ ...(brand?.value as object), extra: true })).not.toBe(
      brand?.contentSha256,
    );
  });

  it("does not pretend to resolve accountant, legal, seller or real inventory authority", () => {
    const keys = attelierExactConfigurationDefinitions.map(
      (entry) => entry.authorityKey,
    );
    expect(keys).not.toEqual(
      expect.arrayContaining([
        "RESIDENTIAL_PRICE_BOOK",
        "B2B_PRICE_BOOK",
        "TIMING_SURCHARGES",
        "VAT_TAX_STATUS",
        "SELLER_LEGAL_PROFILE",
        "QUOTE_BOOKING_TERMS",
        "TEAM_CAPACITY",
        "EQUIPMENT_INVENTORY",
        "PRIVACY_RETENTION",
        "PAYMENT_TERMS",
        "FINANCE_FISCAL_POLICY",
      ]),
    );
  });
});
