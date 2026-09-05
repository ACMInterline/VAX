import { describe, expect, it } from "vitest";
import { getBusinessAuthorityDefinition } from "./registry";
import {
  attelierApprovedStagingAuthorityKeys,
  attelierPendingStagingAuthorityKeys,
  attelierStagingAuthorityPlan,
} from "./attelier-staging-plan";
import { authorityProposalSchema } from "./validation";

describe("ATTELIER staging authority activation plan", () => {
  it("contains valid, unique, staging-only proposals", () => {
    expect(
      new Set(attelierStagingAuthorityPlan.map((item) => item.proposal.authorityKey))
        .size,
    ).toBe(attelierStagingAuthorityPlan.length);
    for (const item of attelierStagingAuthorityPlan) {
      expect(authorityProposalSchema.safeParse(item.proposal).success).toBe(true);
      expect(item.proposal.environmentScope).toBe("STAGING");
      expect(item.proposal.internalNotes).toMatch(/Production is not authorized/);
    }
  });

  it("approves only records whose complete conceptual authority set is attested", () => {
    for (const item of attelierStagingAuthorityPlan) {
      const required = getBusinessAuthorityDefinition(
        item.proposal.authorityKey,
      )!.requiredAuthorityTypes;
      if (item.expectedStatus === "APPROVED_FOR_STAGING") {
        expect(new Set(item.approvalAuthorityTypes)).toEqual(new Set(required));
      } else {
        expect(item.approvalAuthorityTypes.length).toBeLessThan(required.length);
      }
    }
  });

  it("keeps Accountant, Legal, real capacity, product and tax gates under review", () => {
    expect(attelierPendingStagingAuthorityKeys).toEqual(
      expect.arrayContaining([
        "RESIDENTIAL_PRICE_BOOK",
        "B2B_PRICE_BOOK",
        "TIMING_SURCHARGES",
        "VAT_TAX_STATUS",
        "TREATMENT_PRODUCT_POLICY",
        "QUOTE_BOOKING_TERMS",
        "TEAM_CAPACITY",
        "EQUIPMENT_INVENTORY",
        "PRIVACY_RETENTION",
        "PAYMENT_TERMS",
        "FINANCE_FISCAL_POLICY",
      ]),
    );
    expect(attelierApprovedStagingAuthorityKeys).not.toEqual(
      expect.arrayContaining(attelierPendingStagingAuthorityKeys),
    );
    expect(
      attelierStagingAuthorityPlan.flatMap((item) => item.approvalAuthorityTypes),
    ).not.toEqual(expect.arrayContaining(["ACCOUNTANT", "LEGAL"]));
  });
});
