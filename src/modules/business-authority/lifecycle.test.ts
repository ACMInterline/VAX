import { describe, expect, it } from "vitest";
import { evaluateAuthorityTransition } from "./lifecycle";
import type { BusinessAuthorityRecord } from "./types";

function record(
  overrides: Partial<BusinessAuthorityRecord> = {},
): BusinessAuthorityRecord {
  const now = new Date("2026-09-01T00:00:00Z");
  return {
    id: "00000000-0000-4000-8000-000000000001",
    contentHash: "a".repeat(64),
    authorityKey: "VAT_TAX_STATUS",
    category: "VAT_TAX",
    version: 1,
    recordVersion: 1,
    environmentScope: "PRODUCTION",
    status: "PROPOSED",
    evidenceClass: "EXTERNAL_EVIDENCE_REQUIRED",
    requiredAuthorityTypes: ["OWNER", "ACCOUNTANT"],
    value: { kind: "DECISION", decisionCode: "REVIEW_REQUIRED" },
    sourceReference: "ACCOUNTANT-REVIEW-001",
    safeEvidenceSummary: null,
    internalNotes: null,
    effectiveFrom: now,
    effectiveUntil: null,
    proposedByProfileId: null,
    approvedByProfileId: null,
    approvedAt: null,
    supersededAt: null,
    supersededById: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("business-authority lifecycle", () => {
  it("requires an explicit review transition before approval", () => {
    expect(
      evaluateAuthorityTransition(record(), { action: "SUBMIT_FOR_REVIEW" }),
    ).toMatchObject({ nextStatus: "UNDER_REVIEW" });
    expect(() =>
      evaluateAuthorityTransition(record(), {
        action: "APPROVE",
        decisionAuthorityType: "OWNER",
        existingApprovalTypes: new Set(),
      }),
    ).toThrow("INVALID_AUTHORITY_TRANSITION");
  });

  it("keeps review open until every required authority is recorded", () => {
    const underReview = record({ status: "UNDER_REVIEW" });
    expect(
      evaluateAuthorityTransition(underReview, {
        action: "APPROVE",
        decisionAuthorityType: "OWNER",
        existingApprovalTypes: new Set(),
      }),
    ).toMatchObject({
      nextStatus: "UNDER_REVIEW",
      approvalCompletesRecord: false,
    });
    expect(
      evaluateAuthorityTransition(underReview, {
        action: "APPROVE",
        decisionAuthorityType: "ACCOUNTANT",
        existingApprovalTypes: new Set(["OWNER"]),
      }),
    ).toMatchObject({
      nextStatus: "APPROVED_FOR_PRODUCTION",
      approvalCompletesRecord: true,
    });
  });

  it("never turns a staging record into production authority", () => {
    const staging = record({
      authorityKey: "WORKING_HOURS",
      category: "SCHEDULING",
      environmentScope: "STAGING",
      status: "UNDER_REVIEW",
      requiredAuthorityTypes: ["OPERATIONS"],
    });
    expect(
      evaluateAuthorityTransition(staging, {
        action: "APPROVE",
        decisionAuthorityType: "OPERATIONS",
        existingApprovalTypes: new Set(),
      }).nextStatus,
    ).toBe("APPROVED_FOR_STAGING");
  });

  it("keeps terminal states terminal", () => {
    for (const status of [
      "REJECTED",
      "SUPERSEDED",
      "APPROVED_FOR_PRODUCTION",
    ] as const) {
      expect(() =>
        evaluateAuthorityTransition(record({ status }), { action: "REJECT" }),
      ).toThrow("INVALID_AUTHORITY_TRANSITION");
    }
  });
});
