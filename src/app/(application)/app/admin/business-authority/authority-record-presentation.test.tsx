import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  ProductionAuthorizationPackage,
  ReadinessItem,
} from "@/modules/business-authority/readiness";
import type { BusinessAuthorityRecord } from "@/modules/business-authority/types";

vi.mock("./authority-record-actions", () => ({
  AuthorityRecordActions: () => null,
}));

import {
  AuthorityPackageSummary,
  AuthorityRecordDetails,
  AuthorityVersionHistory,
  projectAuthorityRecordForPresentation,
} from "./authority-record-presentation";

const baseTime = new Date("2026-08-31T09:00:00.000Z");

function record(
  overrides: Partial<BusinessAuthorityRecord> = {},
): BusinessAuthorityRecord {
  return {
    id: "20000000-0000-4000-8000-000000000001",
    contentHash: "a".repeat(64),
    authorityKey: "VAT_REGISTRATION_STATUS",
    category: "VAT_TAX",
    version: 1,
    recordVersion: 1,
    environmentScope: "PRODUCTION",
    status: "PROPOSED",
    evidenceClass: "EXTERNAL_EVIDENCE_REQUIRED",
    requiredAuthorityTypes: ["OWNER", "ACCOUNTANT"],
    value: {
      kind: "MONEY",
      currency: "EUR",
      amountMinorUnits: 4_900,
      priceBasis: "GROSS",
    },
    sourceReference: "ACCOUNTANT-REVIEW-001",
    safeEvidenceSummary: "Qualified review confirms the proposed amount.",
    internalNotes: "INTERNAL NOTE MUST NEVER RENDER",
    effectiveFrom: baseTime,
    effectiveUntil: null,
    proposedByProfileId: "20000000-0000-4000-8000-000000000091",
    approvedByProfileId: null,
    approvedAt: null,
    supersededAt: null,
    supersededById: null,
    createdAt: baseTime,
    updatedAt: baseTime,
    ...overrides,
  };
}

function item(overrides: Partial<ReadinessItem> = {}): ReadinessItem {
  return {
    authorityKey: "VAT_REGISTRATION_STATUS",
    category: "VAT_TAX",
    labelBg: "ДДС статус",
    labelEn: "VAT status",
    approved: true,
    version: 1,
    effectiveFrom: baseTime,
    sourceReference: "ACCOUNTANT-REVIEW-001",
    blockerCode: null,
    matrixStatus: "PASS",
    ...overrides,
  };
}

describe("business-authority record presentation", () => {
  it("projects an explicit safe DTO before rendering", () => {
    const projected = projectAuthorityRecordForPresentation(record());

    expect(projected).toMatchObject({
      authorityKey: "VAT_REGISTRATION_STATUS",
      version: 1,
      contentHash: "a".repeat(64),
      sourceReference: "ACCOUNTANT-REVIEW-001",
    });
    expect(projected).not.toHaveProperty("internalNotes");
    expect(projected).not.toHaveProperty("proposedByProfileId");
    expect(projected).not.toHaveProperty("approvedByProfileId");
    expect(projected).not.toHaveProperty("transitionCorrelationId");
    expect(JSON.stringify(projected)).not.toContain(
      "INTERNAL NOTE MUST NEVER RENDER",
    );
  });

  it("renders the actual validated value and safe evidence but never private actor or internal-note data", () => {
    const value = record() as BusinessAuthorityRecord & {
      authProviderUserId: string;
      providerSubjectId: string;
    };
    value.authProviderUserId = "provider-user-must-not-render";
    value.providerSubjectId = "provider-subject-must-not-render";

    const html = renderToStaticMarkup(
      <AuthorityRecordDetails
        approvals={new Set(["OWNER"])}
        locale="en"
        record={projectAuthorityRecordForPresentation(value)}
      />,
    );

    expect(html).toContain("Governed value");
    expect(html).toContain("amountMinorUnits");
    expect(html).toContain("4900");
    expect(html).toContain("EUR");
    expect(html).toContain("GROSS");
    expect(html).toContain("ACCOUNTANT-REVIEW-001");
    expect(html).toContain("Qualified review confirms the proposed amount.");
    expect(html).not.toContain("INTERNAL NOTE MUST NEVER RENDER");
    expect(html).not.toContain("provider-user-must-not-render");
    expect(html).not.toContain("provider-subject-must-not-render");
    expect(html).not.toContain(value.proposedByProfileId!);
  });

  it("fails closed instead of rendering unsafe evidence or a value with unknown provider identity fields", () => {
    const html = renderToStaticMarkup(
      <AuthorityRecordDetails
        approvals={new Set()}
        locale="en"
        record={projectAuthorityRecordForPresentation(
          record({
            value: {
              kind: "DECISION",
              decisionCode: "APPROVE",
              providerSubjectId: "provider-subject-must-not-render",
            },
            sourceReference:
              "https://evidence.example/review?providerSubjectId=hidden",
            safeEvidenceSummary:
              "authProviderUserId: provider-user-must-not-render",
          }),
        )}
      />,
    );

    expect(html).toContain(
      "The value does not match the current strict format and is not displayed.",
    );
    expect(html).not.toContain("provider-subject-must-not-render");
    expect(html).not.toContain("provider-user-must-not-render");
    expect(html).not.toContain("?providerSubjectId=hidden");
  });

  it("does not project credential or raw connection-like governed values", () => {
    const projected = projectAuthorityRecordForPresentation(
      record({
        value: {
          kind: "PROVIDER_DECISION",
          decisionCode: "REVIEW_REQUIRED",
          providerName: "postgresql://raw-config-must-not-render",
          conditions: [],
        },
      }),
    );
    const html = renderToStaticMarkup(
      <AuthorityRecordDetails
        approvals={new Set()}
        locale="en"
        record={projected}
      />,
    );

    expect(projected.value).toBeNull();
    expect(html).not.toContain("raw-config-must-not-render");
    expect(html).toContain(
      "The value does not match the current strict format and is not displayed.",
    );
  });

  it("fails closed for legacy encoded token and provider-identity content at the presentation boundary", () => {
    const projected = projectAuthorityRecordForPresentation(
      record({
        value: {
          kind: "DECISION",
          decisionCode: "REVIEW_REQUIRED",
          detailsEn: "token%25253Dsynthetic-token-value",
        },
        sourceReference: "providerId=synthetic-provider-identity",
        safeEvidenceSummary:
          "%74%6f%6b%65%6e%3Dsynthetic-token-value%ZZ",
      }),
    );
    const html = renderToStaticMarkup(
      <AuthorityRecordDetails
        approvals={new Set()}
        locale="en"
        record={projected}
      />,
    );

    expect(projected.value).toBeNull();
    expect(projected.sourceReference).toBeNull();
    expect(projected.safeEvidenceSummary).toBeNull();
    expect(html).not.toContain("synthetic-provider-identity");
    expect(html).not.toContain("synthetic-token-value");
  });

  it("shows an older readiness-selected approval alongside newer rejected and proposed versions", () => {
    const selected = record({
      id: "20000000-0000-4000-8000-000000000011",
      version: 1,
      status: "APPROVED_FOR_PRODUCTION",
      value: { kind: "DECISION", decisionCode: "CURRENT_APPROVED_VALUE" },
    });
    const rejected = record({
      id: "20000000-0000-4000-8000-000000000012",
      version: 2,
      status: "REJECTED",
      value: { kind: "DECISION", decisionCode: "REJECTED_VALUE" },
      createdAt: new Date("2026-08-31T10:00:00.000Z"),
    });
    const proposed = record({
      id: "20000000-0000-4000-8000-000000000013",
      version: 3,
      status: "PROPOSED",
      value: { kind: "DECISION", decisionCode: "NEWER_PROPOSED_VALUE" },
      effectiveFrom: new Date("2026-09-30T09:00:00.000Z"),
      createdAt: new Date("2026-08-31T11:00:00.000Z"),
    });

    const html = renderToStaticMarkup(
      <AuthorityVersionHistory
        approvalsByRecord={new Map()}
        canControl={false}
        currentReadinessVersion={1}
        locale="en"
        records={[selected, rejected, proposed].map(
          projectAuthorityRecordForPresentation,
        )}
      />,
    );

    expect(html.indexOf("Version 3")).toBeLessThan(html.indexOf("Version 2"));
    expect(html.indexOf("Version 2")).toBeLessThan(html.indexOf("Version 1"));
    expect(html).toMatch(/Version 3[\s\S]*Latest version/);
    expect(html).toMatch(/Version 2[\s\S]*Historical version/);
    expect(html).toMatch(/Version 1[\s\S]*Current readiness-selected version/);
    expect(html).toContain("CURRENT_APPROVED_VALUE");
    expect(html).toContain("REJECTED_VALUE");
    expect(html).toContain("NEWER_PROPOSED_VALUE");
  });

  it("includes safe value and evidence details for approved and pending printable package items", () => {
    const approved = record({
      id: "20000000-0000-4000-8000-000000000021",
      authorityKey: "VAT_REGISTRATION_STATUS",
      version: 1,
      status: "APPROVED_FOR_PRODUCTION",
      value: { kind: "DECISION", decisionCode: "VAT_REGISTERED" },
      sourceReference: "ACCOUNTANT-REVIEW-APPROVED",
      safeEvidenceSummary: "Approved evidence summary.",
    });
    const pending = record({
      id: "20000000-0000-4000-8000-000000000022",
      authorityKey: "PAYMENT_TERMS",
      category: "FINANCE_FISCAL",
      version: 4,
      status: "UNDER_REVIEW",
      value: {
        kind: "POLICY_SET",
        entries: [
          {
            code: "DUE_DAYS",
            decision: "DEFINED",
            numericValue: 14,
            unit: "DAYS",
          },
        ],
      },
      sourceReference: "OWNER-PAYMENT-TERMS-DRAFT",
      safeEvidenceSummary: "Pending owner and accountant review.",
    });
    const pendingItem = item({
      authorityKey: "PAYMENT_TERMS",
      category: "FINANCE_FISCAL",
      labelBg: "Условия за плащане",
      labelEn: "Payment terms",
      approved: false,
      version: null,
      effectiveFrom: null,
      sourceReference: null,
      blockerCode: "PAYMENT_TERMS_NOT_APPROVED",
      matrixStatus: "ACCOUNTANT_APPROVAL_REQUIRED",
    });
    const report: ProductionAuthorizationPackage = {
      environmentScope: "PRODUCTION",
      generatedAt: baseTime,
      ready: false,
      approvedItems: [item()],
      pendingItems: [pendingItem],
      blockers: ["PAYMENT_TERMS_NOT_APPROVED"],
      categories: [
        { category: "VAT_TAX", status: "PASS", blockerCount: 0 },
        {
          category: "FINANCE_FISCAL",
          status: "BLOCKED",
          blockerCount: 1,
        },
      ],
    };

    const html = renderToStaticMarkup(
      <AuthorityPackageSummary
        approvalsByRecord={new Map()}
        locale="en"
        records={[approved, pending].map(projectAuthorityRecordForPresentation)}
        report={report}
      />,
    );

    expect(html).toContain("Approved dependencies");
    expect(html).toContain("VAT_REGISTERED");
    expect(html).toContain("ACCOUNTANT-REVIEW-APPROVED");
    expect(html).toContain("Approved evidence summary.");
    expect(html).toContain("Pending dependencies");
    expect(html).toContain("DUE_DAYS");
    expect(html).toContain("14");
    expect(html).toContain("OWNER-PAYMENT-TERMS-DRAFT");
    expect(html).toContain("Pending owner and accountant review.");
    expect(html).toContain(
      "Latest available version—not selected by readiness",
    );
  });
});
