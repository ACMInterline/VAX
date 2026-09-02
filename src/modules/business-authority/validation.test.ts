import { describe, expect, it } from "vitest";
import { getReadinessConfigurationSubjectType } from "./registry";
import { authorityProposalSchema, authorityValueSchema } from "./validation";

describe("business-authority value validation", () => {
  it("accepts exact money, rate, time, duration and invoice-number values", () => {
    const values = [
      { kind: "MONEY", currency: "EUR", amountMinorUnits: 4_900, priceBasis: "GROSS" },
      { kind: "RATE", rateCode: "VAT_RATE", basisPoints: 2_000 },
      {
        kind: "DURATION_CALIBRATION",
        subjectCode: "SOFA_2_SEAT",
        plannedMinutes: 40,
        bufferMinutes: 10,
        observedSampleCount: 3,
        observedMedianMinutes: 38,
        observedP90Minutes: 44,
      },
      {
        kind: "TIME_WINDOWS",
        timeZone: "Europe/Sofia",
        windows: [{ code: "MORNING", labelBg: "Сутрин", labelEn: "Morning", startMinute: 540, endMinute: 720 }],
      },
      { kind: "INVOICE_NUMBERING", prefix: "STG-", startNumber: 1, paddingWidth: 6, documentTypes: ["STANDARD"] },
    ];

    for (const value of values) {
      expect(authorityValueSchema.safeParse(value).success).toBe(true);
    }
  });

  it("rejects fabricated observation summaries and malformed bounded values", () => {
    expect(
      authorityValueSchema.safeParse({
        kind: "DURATION_CALIBRATION",
        subjectCode: "SOFA_2_SEAT",
        plannedMinutes: 40,
        bufferMinutes: 10,
        observedSampleCount: 0,
        observedMedianMinutes: 38,
        observedP90Minutes: 44,
      }).success,
    ).toBe(false);
    expect(
      authorityValueSchema.safeParse({
        kind: "ENDPOINTS",
        publicWebsiteUrl: "http://example.test",
        applicationUrl: "https://user:pass@example.test",
        authTrustedOrigin: "https://example.test/?token=value",
        canonicalUrl: "https://example.test",
      }).success,
    ).toBe(false);
  });

  it("requires every deployment endpoint field to be an exact HTTPS origin", () => {
    const endpoints = {
      kind: "ENDPOINTS",
      publicWebsiteUrl: "https://www.example.test",
      applicationUrl: "https://app.example.test",
      authTrustedOrigin: "https://app.example.test",
      canonicalUrl: "https://www.example.test",
    };
    expect(authorityValueSchema.safeParse(endpoints).success).toBe(true);
    expect(
      authorityValueSchema.safeParse({
        ...endpoints,
        authTrustedOrigin: `${endpoints.authTrustedOrigin}/`,
      }).success,
    ).toBe(true);

    for (const field of [
      "publicWebsiteUrl",
      "applicationUrl",
      "authTrustedOrigin",
      "canonicalUrl",
    ] as const) {
      expect(
        authorityValueSchema.safeParse({
          ...endpoints,
          [field]: `${endpoints[field]}/unexpected-path`,
        }).success,
        field,
      ).toBe(false);
    }
    expect(
      authorityValueSchema.safeParse({
        ...endpoints,
        authTrustedOrigin: `${endpoints.authTrustedOrigin}/ignored/..`,
      }).success,
    ).toBe(false);
  });

  it("requires external evidence and an authority-specific value kind", () => {
    const parsed = authorityProposalSchema.safeParse({
      authorityKey: "VAT_TAX_STATUS",
      environmentScope: "PRODUCTION",
      value: { kind: "DECISION", decisionCode: "VAT_REGISTERED" },
      sourceReference: null,
      safeEvidenceSummary: null,
      internalNotes: null,
      effectiveFrom: new Date("2026-09-01T00:00:00Z"),
      effectiveUntil: null,
    });
    expect(parsed.success).toBe(false);

    const wrongKind = authorityProposalSchema.safeParse({
      authorityKey: "VAT_TAX_STATUS",
      environmentScope: "PRODUCTION",
      value: { kind: "MONEY", currency: "EUR", amountMinorUnits: 1 },
      sourceReference: "ACCOUNTANT-REVIEW-001",
      safeEvidenceSummary: "Qualified review retained outside broad audit metadata.",
      internalNotes: null,
      effectiveFrom: new Date("2026-09-01T00:00:00Z"),
      effectiveUntil: null,
    });
    expect(wrongKind.success).toBe(false);
  });

  it("rejects mass-assigned status, actor, approval and record-version fields", () => {
    const proposal = {
      authorityKey: "BRAND_IDENTITY",
      environmentScope: "STAGING" as const,
      value: {
        kind: "DECISION" as const,
        decisionCode: "APPROVE_TEMPORARY_BRAND",
      },
      sourceReference: null,
      safeEvidenceSummary: null,
      internalNotes: null,
      effectiveFrom: new Date("2026-09-01T00:00:00Z"),
      effectiveUntil: null,
    };
    expect(authorityProposalSchema.safeParse(proposal).success).toBe(true);

    for (const clientFact of [
      { status: "APPROVED_FOR_PRODUCTION" },
      { actorProfileId: "00000000-0000-4000-8000-000000000001" },
      { proposedByProfileId: "00000000-0000-4000-8000-000000000001" },
      { approvedByProfileId: "00000000-0000-4000-8000-000000000001" },
      { approvedAt: new Date("2026-09-01T00:00:00Z") },
      { recordVersion: 1 },
    ]) {
      expect(
        authorityProposalSchema.safeParse({ ...proposal, ...clientFact })
          .success,
      ).toBe(false);
    }
  });

  it("rejects credential-like evidence without echoing it", () => {
    const parsed = authorityProposalSchema.safeParse({
      authorityKey: "BRAND_IDENTITY",
      environmentScope: "STAGING",
      value: { kind: "DECISION", decisionCode: "BLOCK_PUBLICATION" },
      sourceReference: "password=not-allowed",
      safeEvidenceSummary: null,
      internalNotes: null,
      effectiveFrom: new Date("2026-09-01T00:00:00Z"),
      effectiveUntil: null,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects token and provider-identity content while retaining ordinary policy text", () => {
    const syntheticJwt =
      "eyJhbGciOiJub25lIn0.eyJzdWIiOiJzeW50aGV0aWMifQ.signature_placeholder";

    for (const value of [
      {
        kind: "DECISION",
        decisionCode: "REVIEW_REQUIRED",
        detailsEn: `token=${syntheticJwt}`,
      },
      {
        kind: "PROVIDER_DECISION",
        decisionCode: "REVIEW_REQUIRED",
        providerName: "neonAuthUserId=synthetic-provider-identity",
        conditions: [],
      },
      {
        kind: "PROVIDER_DECISION",
        decisionCode: "REVIEW_REQUIRED",
        conditions: [syntheticJwt],
      },
      {
        kind: "PROVIDER_DECISION",
        decisionCode: "REVIEW_REQUIRED",
        providerName: "provider_subject_id=synthetic-provider-identity",
        conditions: [],
      },
      {
        kind: "DECISION",
        decisionCode: "REVIEW_REQUIRED",
        detailsEn: '{"refreshToken":"synthetic-token-value"}',
      },
    ]) {
      expect(authorityValueSchema.safeParse(value).success).toBe(false);
    }

    for (const unsafeText of [
      "access_token=synthetic-token-value",
      "session-token: synthetic-token-value",
      "Authorization=Bearer synthetic-token-value",
      "authUserId=synthetic-provider-identity",
      "clerk-user-identifier=synthetic-provider-identity",
      "providerUid=synthetic-provider-identity",
      "providerId=synthetic-provider-identity",
      "userId=synthetic-user-identity",
      "sessionId=synthetic-session-identity",
      "neon_auth_sub=synthetic-provider-identity",
      "%74%6f%6b%65%6e%3Dsynthetic-token-value",
      "token%25253Dsynthetic-token-value",
      "%74%6f%6b%65%6e%3Dsynthetic-token-value%ZZ",
      Array.from({ length: 10 }).reduce<string>(
        (encoded) => encodeURIComponent(encoded),
        "token=synthetic-token-value",
      ),
      "refreshToken synthetic-token-value",
      "client_secret=synthetic-secret-value",
      "password_hash=synthetic-hash-value",
    ]) {
      expect(
        authorityProposalSchema.safeParse({
          authorityKey: "BRAND_IDENTITY",
          environmentScope: "STAGING",
          value: { kind: "DECISION", decisionCode: "BLOCK_PUBLICATION" },
          sourceReference: "OWNER-REVIEW-001",
          safeEvidenceSummary: unsafeText,
          internalNotes: null,
          effectiveFrom: new Date("2026-09-01T00:00:00Z"),
          effectiveUntil: null,
        }).success,
      ).toBe(false);
    }

    expect(
      authorityValueSchema.safeParse({
        kind: "PROVIDER_DECISION",
        decisionCode: "REVIEW_REQUIRED",
        providerName: "Neon Auth",
        conditions: [
          "Session token handling was reviewed; no credentials are recorded.",
          "The company secretary reviewed the policy.",
          "Provider ID storage is prohibited by policy.",
          "Confidence is 99% after review.",
        ],
      }).success,
    ).toBe(true);

    expect(
      authorityValueSchema.safeParse({
        kind: "BUSINESS_CONTACT",
        businessName: "VAX Example EOOD",
        email: "office@example.test",
        phone: "+359 2 000 0000",
        address: "1 Example Street, Sofia",
        serviceAreaBg: "Обслужване в София след потвърждение.",
        serviceAreaEn: "Service in Sofia after confirmation.",
      }).success,
    ).toBe(true);
  });

  it("requires configuration references to carry an exact content digest", () => {
    const base = {
      kind: "CONFIG_REFERENCE",
      subjectType: "PRICE_BOOK",
      subjectCode: "RESIDENTIAL_V1",
      subjectVersion: 1,
      contentSha256: "a".repeat(64),
    };
    expect(authorityValueSchema.safeParse(base).success).toBe(true);
    expect(
      authorityValueSchema.safeParse({
        kind: base.kind,
        subjectType: base.subjectType,
        subjectCode: base.subjectCode,
        subjectVersion: base.subjectVersion,
      }).success,
    ).toBe(false);
    expect(
      authorityValueSchema.safeParse({
        ...base,
        contentSha256: "A".repeat(64),
      }).success,
    ).toBe(false);
  });

  it("keeps inline catalog drafts proposal-valid but binds readiness references to their governed subject", () => {
    const proposal = {
      authorityKey: "SERVICE_SCOPE",
      environmentScope: "PRODUCTION" as const,
      sourceReference: null,
      safeEvidenceSummary: null,
      internalNotes: null,
      effectiveFrom: new Date("2026-09-01T00:00:00Z"),
      effectiveUntil: null,
    };
    expect(
      authorityProposalSchema.safeParse({
        ...proposal,
        value: {
          kind: "SCOPE_DECISIONS",
          entries: [{ code: "DRAFT_SERVICE", decision: "ASSESSMENT_ONLY" }],
        },
      }).success,
    ).toBe(true);

    const exactReference = {
      kind: "CONFIG_REFERENCE",
      subjectType: getReadinessConfigurationSubjectType(
        proposal.authorityKey,
      ),
      subjectCode: "VAX_SERVICE_CATALOG_V1",
      subjectVersion: 1,
      contentSha256: "a".repeat(64),
    };
    expect(
      authorityProposalSchema.safeParse({
        ...proposal,
        value: exactReference,
      }).success,
    ).toBe(true);
    expect(
      authorityProposalSchema.safeParse({
        ...proposal,
        value: { ...exactReference, subjectType: "UNKNOWN_CATALOG" },
      }).success,
    ).toBe(false);
  });

  it("validates production deployment scope, change window, and fingerprints", () => {
    const proposal = {
      authorityKey: "PRODUCTION_DEPLOYMENT_AUTHORIZATION",
      environmentScope: "PRODUCTION",
      value: {
        kind: "DEPLOYMENT_AUTHORIZATION",
        decisionCode: "GO",
        releaseCommitSha: "a".repeat(40),
        targetReference: "PRODUCTION_V1",
        changeWindowStart: "2026-09-01T00:00:00.000Z",
        changeWindowEnd: "2026-09-01T01:00:00.000Z",
        dependencyFingerprint: "b".repeat(64),
      },
      sourceReference: null,
      safeEvidenceSummary: null,
      internalNotes: null,
      effectiveFrom: new Date("2026-09-01T00:00:00Z"),
      effectiveUntil: null,
    };
    expect(authorityProposalSchema.safeParse(proposal).success).toBe(true);
    expect(
      authorityProposalSchema.safeParse({
        ...proposal,
        environmentScope: "STAGING",
      }).success,
    ).toBe(false);
    expect(
      authorityProposalSchema.safeParse({
        ...proposal,
        value: {
          ...proposal.value,
          changeWindowEnd: proposal.value.changeWindowStart,
        },
      }).success,
    ).toBe(false);
    expect(
      authorityProposalSchema.safeParse({
        ...proposal,
        value: {
          ...proposal.value,
          dependencyFingerprint: "not-a-fingerprint",
        },
      }).success,
    ).toBe(false);
    expect(
      authorityProposalSchema.safeParse({
        ...proposal,
        value: {
          ...proposal.value,
          releaseCommitSha: "not-a-commit",
        },
      }).success,
    ).toBe(false);
  });

  it("rejects malformed policy semantics before a proposal is stored", () => {
    const proposal = {
      authorityKey: "AUTH_SESSION_POLICY",
      environmentScope: "PRODUCTION" as const,
      value: {
        kind: "POLICY_SET" as const,
        entries: [
          {
            code: "MAXIMUM_LIFETIME",
            decision: "DEFINED",
            numericValue: 60,
            unit: "MINUTES" as const,
          },
          { code: "LOGOUT", decision: "DEFINED", numericValue: null, unit: null },
          { code: "SUSPENDED_USER", decision: "FAIL_CLOSED", numericValue: null, unit: null },
          { code: "COMPROMISED_ACCOUNT", decision: "DEFINED", numericValue: null, unit: null },
          { code: "EMERGENCY_RECOVERY", decision: "DEFINED", numericValue: null, unit: null },
        ],
      },
      sourceReference: null,
      safeEvidenceSummary: null,
      internalNotes: null,
      effectiveFrom: new Date("2026-09-01T00:00:00Z"),
      effectiveUntil: null,
    };

    expect(authorityProposalSchema.safeParse(proposal).success).toBe(true);
    for (const value of [
      {
        ...proposal.value,
        entries: proposal.value.entries.map((entry) =>
          entry.code === "MAXIMUM_LIFETIME"
            ? { ...entry, numericValue: 0 }
            : entry,
        ),
      },
      {
        ...proposal.value,
        entries: proposal.value.entries.map((entry) =>
          entry.code === "MAXIMUM_LIFETIME"
            ? { ...entry, unit: "BASIS_POINTS" as const }
            : entry,
        ),
      },
      {
        ...proposal.value,
        entries: [
          ...proposal.value.entries,
          { code: "EXTRA", decision: "DEFINED", numericValue: null, unit: null },
        ],
      },
      {
        ...proposal.value,
        entries: proposal.value.entries.map((entry) =>
          entry.code === "LOGOUT"
            ? { ...entry, numericValue: 1, unit: "COUNT" as const }
            : entry,
        ),
      },
    ]) {
      expect(
        authorityProposalSchema.safeParse({ ...proposal, value }).success,
      ).toBe(false);
    }
  });

  it("requires approved retention rules to resolve legal-review exceptions", () => {
    const proposal = {
      authorityKey: "PRIVACY_RETENTION",
      environmentScope: "PRODUCTION" as const,
      value: {
        kind: "RETENTION_POLICY" as const,
        rules: [
          {
            category: "AUTH_SECURITY" as const,
            status: "APPROVED" as const,
            retentionDays: 365,
            erasureException: "LEGAL_REVIEW_REQUIRED" as const,
          },
        ],
        automaticDeletionEnabled: false as const,
      },
      sourceReference: "LEGAL-RETENTION-001",
      safeEvidenceSummary: null,
      internalNotes: null,
      effectiveFrom: new Date("2026-09-01T00:00:00Z"),
      effectiveUntil: null,
    };

    expect(authorityProposalSchema.safeParse(proposal).success).toBe(false);
    expect(
      authorityProposalSchema.safeParse({
        ...proposal,
        value: {
          ...proposal.value,
          rules: proposal.value.rules.map((rule) => ({
            ...rule,
            erasureException: "RETAIN_REQUIRED" as const,
          })),
        },
      }).success,
    ).toBe(true);
  });
});
