import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  businessAuthorityDefinitions,
  getReadinessConfigurationSubjectType,
} from "./registry";
import {
  createProductionDependencyFingerprint,
  deploymentAuthorizationMatchesSnapshot,
  evaluateProductionDependencies,
  evaluateProductionReadiness,
  type ConfigurationReferenceSnapshot,
} from "./readiness";
import {
  authorityValueSchema,
  policySetValueIsSemanticallyValid,
  type AuthorityValue,
} from "./validation";
import type {
  AuthorityDefinition,
  BusinessAuthorityEvent,
  BusinessAuthorityRecord,
} from "./types";

const readinessNow = new Date("2026-09-01T00:00:00Z");

function approvedRecord(
  definition: (typeof businessAuthorityDefinitions)[number],
  overrides: Partial<BusinessAuthorityRecord> = {},
): BusinessAuthorityRecord {
  const kind = definition.allowedValueKinds[0];
  const value =
    kind === "DECISION"
      ? {
          kind,
          decisionCode: definition.allowedDecisionCodes?.[0] ?? "APPROVED",
        }
      : kind === "CONFIG_REFERENCE"
        ? {
            kind,
            subjectType: "CONFIGURATION",
            subjectCode: "APPROVED_V1",
            subjectVersion: 1,
            contentSha256: "a".repeat(64),
          }
        : {
            kind: "POLICY_SET",
            entries: [
              {
                code: "APPROVAL",
                decision: "APPROVED",
                numericValue: null,
                unit: null,
              },
            ],
          };
  return {
    id: crypto.randomUUID(),
    contentHash: "a".repeat(64),
    authorityKey: definition.key,
    category: definition.category,
    version: 1,
    recordVersion: 2,
    environmentScope: "PRODUCTION",
    status: "APPROVED_FOR_PRODUCTION",
    evidenceClass: definition.evidenceClass,
    requiredAuthorityTypes: definition.requiredAuthorityTypes,
    value,
    sourceReference:
      definition.evidenceClass === "EXTERNAL_EVIDENCE_REQUIRED"
        ? "EVIDENCE-001"
        : null,
    safeEvidenceSummary: null,
    internalNotes: null,
    effectiveFrom: new Date("2026-08-01T00:00:00Z"),
    effectiveUntil: null,
    proposedByProfileId: null,
    approvedByProfileId: null,
    approvedAt: readinessNow,
    supersededAt: null,
    supersededById: null,
    createdAt: readinessNow,
    updatedAt: readinessNow,
    ...overrides,
  };
}

function approvalEventsFor(
  record: BusinessAuthorityRecord,
): readonly BusinessAuthorityEvent[] {
  return record.requiredAuthorityTypes.map((authorityType, index) => ({
    id: crypto.randomUUID(),
    authorityRecordId: record.id,
    eventType:
      index === record.requiredAuthorityTypes.length - 1
        ? "AUTHORITY_APPROVED"
        : "AUTHORITY_APPROVAL_RECORDED",
    previousStatus: "UNDER_REVIEW",
    nextStatus:
      index === record.requiredAuthorityTypes.length - 1
        ? record.status
        : "UNDER_REVIEW",
    decisionAuthorityType: authorityType,
    actorProfileId: "00000000-0000-4000-8000-000000000001",
    evidenceReference: record.sourceReference,
    safeEvidenceSummary: null,
    correlationId: crypto.randomUUID(),
    safeMetadata: {},
    occurredAt: record.approvedAt ?? record.updatedAt,
  }));
}

type ReadinessEnvironment = "STAGING" | "PRODUCTION";
type PolicyEntry = Extract<
  AuthorityValue,
  { kind: "POLICY_SET" }
>["entries"][number];

function configurationValue(definition: AuthorityDefinition): AuthorityValue {
  return {
    kind: "CONFIG_REFERENCE",
    subjectType: getReadinessConfigurationSubjectType(definition.key)!,
    subjectCode: definition.key,
    subjectVersion: 1,
    contentSha256: createHash("sha256").update(definition.key).digest("hex"),
  };
}

function policyValue(authorityKey: string): AuthorityValue {
  const entry = (
    code: string,
    decision: string,
    numericValue: number | null = null,
    unit:
      | "MINUTES"
      | "DAYS"
      | "COUNT"
      | "MINOR_UNITS"
      | "BASIS_POINTS"
      | null = null,
  ) => ({ code, decision, numericValue, unit });

  const entries = {
    AVAILABILITY_POLICY: [
      entry("QUOTE_MODE", "ASSESSMENT_REQUIRED"),
      entry("BOOKING_MODE", "STAFF_CONFIRMATION_REQUIRED"),
    ],
    QUOTE_BOOKING_TERMS: [
      entry("QUOTE_VALIDITY", "DEFINED", 30, "DAYS"),
      entry("BOOKING_CONFIRMATION", "DEFINED"),
      entry("CANCELLATION", "DEFINED"),
      entry("RESCHEDULING", "DEFINED"),
    ],
    JOB_OPERATING_POLICY: [
      entry("ARRIVAL", "DEFINED"),
      entry("INSPECTION", "REQUIRED"),
      entry("SAFETY_STOP", "REQUIRED"),
      entry("REFER_DECLINE", "DEFINED"),
      entry("SCOPE_CHANGE", "STAFF_APPROVAL_REQUIRED"),
      entry("COMPLETION", "DEFINED"),
      entry("CUSTOMER_HANDOVER", "REQUIRED"),
    ],
    PASSPORT_MAINTENANCE_POLICY: [
      entry("CUSTOMER_VISIBILITY", "DEFINED"),
      entry("MAINTENANCE_BASIS", "CONDITION_BASED"),
      entry("RETENTION", "DEFINED"),
    ],
    AUTH_SESSION_POLICY: [
      entry("MAXIMUM_LIFETIME", "DEFINED", 1_440, "MINUTES"),
      entry("LOGOUT", "DEFINED"),
      entry("SUSPENDED_USER", "FAIL_CLOSED"),
      entry("COMPROMISED_ACCOUNT", "DEFINED"),
      entry("EMERGENCY_RECOVERY", "DEFINED"),
    ],
    SMTP_SENDER_IDENTITY: [
      entry("PROVIDER", "SELECTED"),
      entry("FROM_IDENTITY", "VERIFIED"),
      entry("REPLY_TO_IDENTITY", "VERIFIED"),
      entry("SPF", "VERIFIED"),
      entry("DKIM", "VERIFIED"),
      entry("DMARC", "VERIFIED"),
    ],
    MONITORING_OWNERSHIP: [
      entry("ALERT_RECIPIENTS", "DEFINED"),
      entry("COVERAGE_LEVEL", "BUSINESS_HOURS"),
      entry("RESPONSE_HOURS", "DEFINED"),
      entry("SEVERITY", "DEFINED"),
      entry("ESCALATION", "DEFINED"),
    ],
    RECOVERY_OBJECTIVES: [
      entry("RPO", "DEFINED", 60, "MINUTES"),
      entry("RTO", "DEFINED", 240, "MINUTES"),
      entry("BACKUP_FREQUENCY", "DEFINED", 60, "MINUTES"),
      entry("BACKUP_RETENTION", "DEFINED", 30, "DAYS"),
      entry("RESTORE_AUTHORITY", "DEFINED"),
    ],
    PAYMENT_TERMS: [
      entry("PAYMENT_MODE", "DEFINED"),
      entry("DUE_DAYS", "DEFINED", 14, "DAYS"),
      entry("PREPAYMENT", "NOT_APPLICABLE"),
      entry("BUSINESS_TERMS", "DEFINED"),
    ],
    FINANCE_FISCAL_POLICY: [
      entry("DOCUMENT_TYPES", "DEFINED"),
      entry("CORRECTION_POLICY", "DEFINED"),
      entry("FISCAL_DECISION", "DEFINED"),
      entry("ACCOUNTING_INTEGRATION", "NOT_REQUIRED"),
      entry("REFUND_POLICY", "DEFINED"),
    ],
    PRODUCTION_DATABASE_BOOTSTRAP: [
      entry("BRANCH_PROTECTION", "VERIFIED"),
      entry("ROLE_SEPARATION", "VERIFIED"),
      entry("MIGRATIONS", "VERIFIED"),
      entry("GRANTS", "VERIFIED"),
      entry("RLS", "VERIFIED"),
      entry("SEEDS", "VERIFIED"),
      entry("FIRST_OWNER", "VERIFIED"),
      entry("RECOVERY_EVIDENCE", "VERIFIED"),
    ],
  }[authorityKey];
  if (!entries) throw new Error(`Missing policy fixture for ${authorityKey}.`);
  return { kind: "POLICY_SET", entries };
}

function operationalValue(definition: AuthorityDefinition): AuthorityValue {
  if (
    definition.allowedValueKinds.includes("CONFIG_REFERENCE") &&
    (!definition.readinessValueKinds ||
      definition.readinessValueKinds.includes("CONFIG_REFERENCE"))
  ) {
    return configurationValue(definition);
  }

  switch (definition.key) {
    case "BRAND_IDENTITY":
      return { kind: "DECISION", decisionCode: "FINAL_BRAND_PROVIDED" };
    case "BUSINESS_CONTACT_DETAILS":
      return {
        kind: "BUSINESS_CONTACT",
        businessName: "VAX",
        email: "operations@example.invalid",
        phone: "+359 2 000 0000",
        address: "Controlled business address",
        serviceAreaBg: "Проверен обслужван район.",
        serviceAreaEn: "Verified service area.",
      };
    case "PUBLIC_CLAIMS":
      return {
        kind: "CLAIM_DECISIONS",
        entries: [
          {
            claimId: "verified-claim",
            decision: "WITHHELD",
            evidenceReference: null,
          },
        ],
      };
    case "SERVICE_SCOPE":
    case "ITEM_TAXONOMY_SCOPE":
    case "MATERIAL_SPECIALIST_SCOPE":
    case "TREATMENT_PRODUCT_POLICY":
      return {
        kind: "SCOPE_DECISIONS",
        entries: [{ code: "VERIFIED_SCOPE", decision: "SUPPORTED" }],
      };
    case "DRYING_REUSE_GUIDANCE":
      return {
        kind: "DURATION_CALIBRATION",
        subjectCode: "DRYING_REUSE",
        plannedMinutes: 180,
        bufferMinutes: 30,
        observedSampleCount: 1,
        observedMedianMinutes: 160,
        observedP90Minutes: 180,
      };
    case "VAT_TAX_STATUS":
      return { kind: "DECISION", decisionCode: "NOT_VAT_REGISTERED" };
    case "AVAILABILITY_POLICY":
    case "QUOTE_BOOKING_TERMS":
    case "JOB_OPERATING_POLICY":
    case "PASSPORT_MAINTENANCE_POLICY":
    case "AUTH_SESSION_POLICY":
    case "SMTP_SENDER_IDENTITY":
    case "MONITORING_OWNERSHIP":
    case "RECOVERY_OBJECTIVES":
    case "PAYMENT_TERMS":
    case "FINANCE_FISCAL_POLICY":
    case "PRODUCTION_DATABASE_BOOTSTRAP":
      return policyValue(definition.key);
    case "TRAVEL_PARKING_ROUTING":
      return {
        kind: "TRAVEL_POLICY",
        includedZoneCodes: ["SOFIA"],
        maximumDistanceHundredthsKm: 5_000,
        maximumTravelMinutes: 120,
        minimumTravelBufferMinutes: 30,
        routingDecision: "DETERMINISTIC_MATRIX_ACCEPTED",
        parkingDecision: "INCLUDED",
        parkingAmountMinorUnits: null,
      };
    case "AUTH_PROVIDER_RISK":
      return {
        kind: "PROVIDER_DECISION",
        decisionCode: "ACCEPT_FOR_INITIAL_PRODUCTION",
        conditions: [],
      };
    case "PRIVACY_RETENTION":
      return {
        kind: "RETENTION_POLICY",
        rules: [
          "AUTH_SECURITY",
          "CRM",
          "ANONYMOUS_REQUESTS",
          "QUOTES",
          "BOOKINGS",
          "JOBS",
          "PASSPORT",
          "FINANCE",
          "COMMUNICATIONS_DOCUMENTS",
        ].map((category) => ({
          category: category as
            | "AUTH_SECURITY"
            | "CRM"
            | "ANONYMOUS_REQUESTS"
            | "QUOTES"
            | "BOOKINGS"
            | "JOBS"
            | "PASSPORT"
            | "FINANCE"
            | "COMMUNICATIONS_DOCUMENTS",
          status: "APPROVED" as const,
          retentionDays: 365,
          erasureException: "NONE" as const,
        })),
        automaticDeletionEnabled: false,
      };
    case "PRODUCTION_DOMAIN_ORIGINS":
      return {
        kind: "ENDPOINTS",
        publicWebsiteUrl: "https://www.example.invalid",
        applicationUrl: "https://app.example.invalid",
        authTrustedOrigin: "https://app.example.invalid",
        canonicalUrl: "https://www.example.invalid",
      };
  }
  throw new Error(`Missing operational fixture for ${definition.key}.`);
}

function completeAuthorityFixture(environmentScope: ReadinessEnvironment) {
  const definitions = businessAuthorityDefinitions.filter(
    (definition) =>
      definition.productionRequired &&
      definition.key !== "PRODUCTION_DEPLOYMENT_AUTHORIZATION",
  );
  const status =
    environmentScope === "STAGING"
      ? ("APPROVED_FOR_STAGING" as const)
      : ("APPROVED_FOR_PRODUCTION" as const);
  const records = definitions.map((definition, index) =>
    approvedRecord(definition, {
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      environmentScope,
      status,
      value: operationalValue(definition),
    }),
  );
  const events = records.flatMap(approvalEventsFor);
  const configurationReferences = records.flatMap(
    (record): readonly ConfigurationReferenceSnapshot[] => {
      const value = record.value as AuthorityValue;
      if (value.kind !== "CONFIG_REFERENCE") return [];
      return [
        {
          resolverId: "canonical-vax-config",
          resolverVersion: "v1",
          subjectType: value.subjectType,
          subjectCode: value.subjectCode,
          subjectVersion: value.subjectVersion,
          contentSha256: value.contentSha256,
          environmentScope,
          status: "APPROVED",
          provisional: false,
          unresolvedManualReview: false,
          effectiveFrom: new Date("2026-08-01T00:00:00Z"),
          effectiveUntil: null,
          supersededAt: null,
          supersededByReference: null,
        },
      ];
    },
  );
  return { records, events, configurationReferences } as const;
}

function deploymentAuthorization(
  dependencyFingerprint: string,
): BusinessAuthorityRecord {
  const definition = businessAuthorityDefinitions.find(
    (entry) => entry.key === "PRODUCTION_DEPLOYMENT_AUTHORIZATION",
  )!;
  return approvedRecord(definition, {
    id: "00000000-0000-4000-8000-000000000099",
    value: {
      kind: "DEPLOYMENT_AUTHORIZATION",
      decisionCode: "GO",
      releaseCommitSha: "a".repeat(40),
      targetReference: "PRODUCTION_V1",
      changeWindowStart: "2026-09-01T00:00:00.000Z",
      changeWindowEnd: "2026-09-01T01:00:00.000Z",
      dependencyFingerprint,
    },
  });
}

describe("production-readiness evaluator", () => {
  it("closes every governed dependency without self-authorizing production deployment", () => {
    const fixture = completeAuthorityFixture("PRODUCTION");
    const dependencies = evaluateProductionDependencies(fixture.records, {
      now: readinessNow,
      approvalEvents: fixture.events,
      configurationReferences: fixture.configurationReferences,
    });

    expect(dependencies.ready).toBe(true);
    expect(dependencies.items).toHaveLength(35);
    expect(dependencies.selectedRecords).toHaveLength(35);
    expect(fixture.configurationReferences).toHaveLength(30);
    expect(dependencies.items.every((item) => item.approved)).toBe(true);
    expect(dependencies.fingerprint).toMatch(/^[a-f0-9]{64}$/);

    const readiness = evaluateProductionReadiness(fixture.records, {
      now: readinessNow,
      approvalEvents: fixture.events,
      configurationReferences: fixture.configurationReferences,
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.pendingItems.map((item) => item.authorityKey)).toEqual([
      "PRODUCTION_DEPLOYMENT_AUTHORIZATION",
    ]);
    expect(readiness.blockers).toEqual(["DEPLOYMENT_NOT_AUTHORIZED"]);
  });

  it("invalidates an exact GO when any governed dependency snapshot changes", () => {
    const fixture = completeAuthorityFixture("PRODUCTION");
    const dependencySnapshot = evaluateProductionDependencies(fixture.records, {
      now: readinessNow,
      approvalEvents: fixture.events,
      configurationReferences: fixture.configurationReferences,
    });
    expect(dependencySnapshot.fingerprint).not.toBeNull();
    const authorization = deploymentAuthorization(
      dependencySnapshot.fingerprint!,
    );
    const releaseTarget = {
      releaseCommitSha: "a".repeat(40),
      targetReference: "PRODUCTION_V1",
    } as const;
    const records = [...fixture.records, authorization];
    const events = [...fixture.events, ...approvalEventsFor(authorization)];
    const evaluationNow = new Date("2026-09-01T00:30:00Z");
    const baselineOptions = {
      now: evaluationNow,
      approvalEvents: events,
      configurationReferences: fixture.configurationReferences,
      releaseTarget,
    } as const;

    expect(evaluateProductionReadiness(records, baselineOptions).ready).toBe(
      true,
    );

    const brandId = fixture.records.find(
      (record) => record.authorityKey === "BRAND_IDENTITY",
    )!.id;
    const priceBookId = fixture.records.find(
      (record) => record.authorityKey === "RESIDENTIAL_PRICE_BOOK",
    )!.id;
    const serviceScopeId = fixture.records.find(
      (record) => record.authorityKey === "SERVICE_SCOPE",
    )!.id;
    const materialScopeId = fixture.records.find(
      (record) => record.authorityKey === "MATERIAL_SPECIALIST_SCOPE",
    )!.id;
    const brandApprovalId = events.find(
      (event) => event.authorityRecordId === brandId,
    )!.id;
    const changedRecords = (
      recordId: string,
      change: (record: BusinessAuthorityRecord) => BusinessAuthorityRecord,
    ) =>
      records.map((record) =>
        record.id === recordId ? change(record) : record,
      );

    const adversarialCases = [
      {
        name: "authority version",
        records: changedRecords(brandId, (record) => ({
          ...record,
          version: record.version + 1,
          recordVersion: record.recordVersion + 1,
        })),
        approvalEvents: events,
        configurationReferences: fixture.configurationReferences,
      },
      {
        name: "authority value",
        records: changedRecords(brandId, (record) => ({
          ...record,
          value: {
            kind: "DECISION",
            decisionCode: "APPROVE_TEMPORARY_BRAND",
          },
        })),
        approvalEvents: events,
        configurationReferences: fixture.configurationReferences,
      },
      {
        name: "future effective boundary",
        records: changedRecords(serviceScopeId, (record) => ({
          ...record,
          effectiveFrom: new Date("2026-09-01T00:30:00.001Z"),
        })),
        approvalEvents: events,
        configurationReferences: fixture.configurationReferences,
      },
      {
        name: "configuration digest",
        records,
        approvalEvents: events,
        configurationReferences: fixture.configurationReferences.map(
          (reference) =>
            reference.subjectCode === "RESIDENTIAL_PRICE_BOOK"
              ? { ...reference, contentSha256: "f".repeat(64) }
              : reference,
        ),
      },
      {
        name: "environment scope",
        records: changedRecords(materialScopeId, (record) => ({
          ...record,
          environmentScope: "STAGING",
          status: "APPROVED_FOR_STAGING",
        })),
        approvalEvents: events,
        configurationReferences: fixture.configurationReferences,
      },
      {
        name: "required approval evidence",
        records,
        approvalEvents: events.filter((event) => event.id !== brandApprovalId),
        configurationReferences: fixture.configurationReferences,
      },
      {
        name: "configuration version",
        records: changedRecords(priceBookId, (record) => {
          const value = record.value as Extract<
            AuthorityValue,
            { kind: "CONFIG_REFERENCE" }
          >;
          return {
            ...record,
            value: { ...value, subjectVersion: value.subjectVersion + 1 },
          };
        }),
        approvalEvents: events,
        configurationReferences: fixture.configurationReferences,
      },
    ] as const;

    for (const candidate of adversarialCases) {
      const result = evaluateProductionReadiness(candidate.records, {
        now: evaluationNow,
        approvalEvents: candidate.approvalEvents,
        configurationReferences: candidate.configurationReferences,
        releaseTarget,
      });
      expect(result.ready, candidate.name).toBe(false);
      expect(
        result.pendingItems.some(
          (item) => item.authorityKey === "PRODUCTION_DEPLOYMENT_AUTHORIZATION",
        ),
        candidate.name,
      ).toBe(true);
    }
  });

  it("binds every eligible resolver-snapshot metadata field into the dependency fingerprint", () => {
    const fixture = completeAuthorityFixture("PRODUCTION");
    const evaluationNow = new Date("2026-09-01T00:30:00Z");
    const baseline = evaluateProductionDependencies(fixture.records, {
      now: evaluationNow,
      approvalEvents: fixture.events,
      configurationReferences: fixture.configurationReferences,
    });
    expect(baseline.ready).toBe(true);
    expect(baseline.fingerprint).not.toBeNull();
    expect(baseline.selectedConfigurationReferences).toHaveLength(30);

    const authorization = deploymentAuthorization(baseline.fingerprint!);
    const records = [...fixture.records, authorization];
    const approvalEvents = [
      ...fixture.events,
      ...approvalEventsFor(authorization),
    ];
    const releaseTarget = {
      releaseCommitSha: "a".repeat(40),
      targetReference: "PRODUCTION_V1",
    } as const;
    const variants = [
      {
        name: "resolver identity",
        change: (reference: ConfigurationReferenceSnapshot) => ({
          ...reference,
          resolverId: "canonical-vax-config-replacement",
        }),
      },
      {
        name: "resolver version",
        change: (reference: ConfigurationReferenceSnapshot) => ({
          ...reference,
          resolverVersion: "v2",
        }),
      },
      {
        name: "status",
        change: (reference: ConfigurationReferenceSnapshot) => ({
          ...reference,
          status: "ACTIVE" as const,
        }),
      },
      {
        name: "effective start",
        change: (reference: ConfigurationReferenceSnapshot) => ({
          ...reference,
          effectiveFrom: new Date("2026-08-02T00:00:00Z"),
        }),
      },
      {
        name: "effective end",
        change: (reference: ConfigurationReferenceSnapshot) => ({
          ...reference,
          effectiveUntil: new Date("2026-10-01T00:00:00Z"),
        }),
      },
    ] as const;

    for (const variant of variants) {
      const configurationReferences = fixture.configurationReferences.map(
        (reference, index) =>
          index === 0 ? variant.change(reference) : reference,
      );
      const changed = evaluateProductionDependencies(fixture.records, {
        now: evaluationNow,
        approvalEvents: fixture.events,
        configurationReferences,
      });
      expect(changed.ready, variant.name).toBe(true);
      expect(changed.fingerprint, variant.name).not.toBe(baseline.fingerprint);

      const readiness = evaluateProductionReadiness(records, {
        now: evaluationNow,
        approvalEvents,
        configurationReferences,
        releaseTarget,
      });
      expect(readiness.ready, variant.name).toBe(false);
      expect(
        readiness.pendingItems.some(
          (item) => item.authorityKey === "PRODUCTION_DEPLOYMENT_AUTHORIZATION",
        ),
        variant.name,
      ).toBe(true);
    }
  });

  it("keeps complete staging authority separate from the production gate", () => {
    const staging = completeAuthorityFixture("STAGING");
    const production = completeAuthorityFixture("PRODUCTION");

    const stagingResult = evaluateProductionReadiness(staging.records, {
      environmentScope: "STAGING",
      now: readinessNow,
      approvalEvents: staging.events,
      configurationReferences: staging.configurationReferences,
    });
    expect(stagingResult.ready).toBe(true);
    expect(stagingResult.approvedItems).toHaveLength(35);
    expect(stagingResult.categories).not.toContainEqual(
      expect.objectContaining({ category: "DEPLOYMENT_AUTHORIZATION" }),
    );

    expect(
      evaluateProductionReadiness(staging.records, {
        environmentScope: "PRODUCTION",
        now: readinessNow,
        approvalEvents: staging.events,
        configurationReferences: staging.configurationReferences,
      }).ready,
    ).toBe(false);
    expect(
      evaluateProductionReadiness(production.records, {
        environmentScope: "STAGING",
        now: readinessNow,
        approvalEvents: production.events,
        configurationReferences: production.configurationReferences,
      }).ready,
    ).toBe(false);
  });

  it("activates authority at, but never before, its exact effective boundary", () => {
    const vatStatus = businessAuthorityDefinitions.find(
      (definition) => definition.key === "VAT_TAX_STATUS",
    )!;
    const record = approvedRecord(vatStatus, { effectiveFrom: readinessNow });
    const approvalEvents = approvalEventsFor(record);

    const before = evaluateProductionDependencies([record], {
      now: new Date(readinessNow.getTime() - 1),
      approvalEvents,
    });
    const atBoundary = evaluateProductionDependencies([record], {
      now: readinessNow,
      approvalEvents,
    });

    expect(
      before.items.find((item) => item.authorityKey === vatStatus.key)
        ?.approved,
    ).toBe(false);
    expect(
      atBoundary.items.find((item) => item.authorityKey === vatStatus.key)
        ?.approved,
    ).toBe(true);
  });

  it("derives readiness from actual dependencies instead of one editable boolean", () => {
    const result = evaluateProductionReadiness([], {
      now: new Date("2026-09-01T00:00:00Z"),
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain("PRICE_BOOK_NOT_APPROVED");
    expect(result.blockers).toContain("AUTH_PROVIDER_RISK_UNACCEPTED");
    expect(result.blockers).toContain("DEPLOYMENT_NOT_AUTHORIZED");
    expect(result.pendingItems).toHaveLength(
      businessAuthorityDefinitions.length,
    );
  });

  it("does not accept staging approval as production authority", () => {
    const vatStatus = businessAuthorityDefinitions.find(
      (entry) => entry.key === "VAT_TAX_STATUS",
    )!;
    const stagingRecord = approvedRecord(vatStatus, {
      environmentScope: "STAGING",
      status: "APPROVED_FOR_STAGING",
    });
    const result = evaluateProductionReadiness([stagingRecord], {
      now: new Date("2026-09-01T00:00:00Z"),
      approvalEvents: approvalEventsFor(stagingRecord),
    });
    expect(
      result.pendingItems.find((item) => item.authorityKey === vatStatus.key)
        ?.blockerCode,
    ).toBe("VAT_STATUS_NOT_APPROVED");
  });

  it("does not require the production-only deployment decision for staging readiness", () => {
    const result = evaluateProductionReadiness([], {
      environmentScope: "STAGING",
      now: new Date("2026-09-01T00:00:00Z"),
    });

    expect(
      result.pendingItems.some(
        (item) => item.authorityKey === "PRODUCTION_DEPLOYMENT_AUTHORIZATION",
      ),
    ).toBe(false);
    expect(result.blockers).not.toContain("DEPLOYMENT_NOT_AUTHORIZED");
    expect(
      result.categories.some(
        (item) => item.category === "DEPLOYMENT_AUTHORIZATION",
      ),
    ).toBe(false);
  });

  it("does not apply future, expired, superseded or malformed authority", () => {
    const vatStatus = businessAuthorityDefinitions.find(
      (entry) => entry.key === "VAT_TAX_STATUS",
    )!;
    const cases = [
      approvedRecord(vatStatus, {
        effectiveFrom: new Date("2026-10-01T00:00:00Z"),
      }),
      approvedRecord(vatStatus, {
        effectiveUntil: new Date("2026-08-31T00:00:00Z"),
      }),
      approvedRecord(vatStatus, { supersededById: crypto.randomUUID() }),
      approvedRecord(vatStatus, {
        value: { kind: "DECISION", decisionCode: "not-valid" },
      }),
    ];
    for (const candidate of cases) {
      const result = evaluateProductionReadiness([candidate], {
        now: new Date("2026-09-01T00:00:00Z"),
        approvalEvents: approvalEventsFor(candidate),
      });
      expect(
        result.pendingItems.some((item) => item.authorityKey === vatStatus.key),
      ).toBe(true);
    }
  });

  it.each(["", "not-a-sha256", "A".repeat(64)])(
    "fails closed for a missing or malformed authority content hash: %s",
    (contentHash) => {
      const definition = businessAuthorityDefinitions.find(
        (entry) => entry.key === "VAT_TAX_STATUS",
      )!;
      const record = approvedRecord(definition, { contentHash });
      const result = evaluateProductionDependencies([record], {
        now: readinessNow,
        approvalEvents: approvalEventsFor(record),
      });

      expect(
        result.items.find((item) => item.authorityKey === definition.key)
          ?.approved,
      ).toBe(false);
    },
  );

  it("preserves the latest effective unsuperseded version", () => {
    const vatStatus = businessAuthorityDefinitions.find(
      (entry) => entry.key === "VAT_TAX_STATUS",
    )!;
    const oldRecord = approvedRecord(vatStatus, {
      version: 1,
      status: "SUPERSEDED",
      supersededAt: new Date("2026-08-15T00:00:00Z"),
      supersededById: crypto.randomUUID(),
    });
    const newRecord = approvedRecord(vatStatus, { version: 2 });
    const result = evaluateProductionReadiness([oldRecord, newRecord], {
      now: new Date("2026-09-01T00:00:00Z"),
      approvalEvents: [
        ...approvalEventsFor(oldRecord),
        ...approvalEventsFor(newRecord),
      ],
    });
    expect(
      result.approvedItems.find((item) => item.authorityKey === vatStatus.key)
        ?.version,
    ).toBe(2);
  });

  it("fails closed when an approved row lacks one required authority event", () => {
    const serviceScope = businessAuthorityDefinitions.find(
      (entry) => entry.key === "SERVICE_SCOPE",
    )!;
    const record = approvedRecord(serviceScope);
    const partialEvents = approvalEventsFor(record).slice(0, 1);
    const result = evaluateProductionReadiness([record], {
      now: new Date("2026-09-01T00:00:00Z"),
      approvalEvents: partialEvents,
    });
    expect(
      result.pendingItems.some(
        (item) => item.authorityKey === serviceScope.key,
      ),
    ).toBe(true);
  });

  it("does not turn an approved blocking decision into a readiness pass", () => {
    const authRisk = businessAuthorityDefinitions.find(
      (entry) => entry.key === "AUTH_PROVIDER_RISK",
    )!;
    const blocked = approvedRecord(authRisk, {
      value: {
        kind: "PROVIDER_DECISION",
        decisionCode: "BLOCK_PRODUCTION",
        conditions: [],
      },
    });
    const result = evaluateProductionReadiness([blocked], {
      now: new Date("2026-09-01T00:00:00Z"),
      approvalEvents: approvalEventsFor(blocked),
    });
    expect(
      result.pendingItems.find(
        (item) => item.authorityKey === "AUTH_PROVIDER_RISK",
      )?.matrixStatus,
    ).toBe("PROVIDER_LIMITATION");
  });

  it("requires an exact, verified configuration snapshot and content digest", () => {
    const priceBook = businessAuthorityDefinitions.find(
      (entry) => entry.key === "RESIDENTIAL_PRICE_BOOK",
    )!;
    const contentSha256 = "1".repeat(64);
    const priceBookRecord = approvedRecord(priceBook, {
      value: {
        kind: "CONFIG_REFERENCE",
        subjectType: "PRICE_BOOK",
        subjectCode: "RESIDENTIAL_V3",
        subjectVersion: 3,
        contentSha256,
      },
    });
    const exactReference: ConfigurationReferenceSnapshot = {
      resolverId: "canonical-vax-config",
      resolverVersion: "v1",
      subjectType: "PRICE_BOOK",
      subjectCode: "RESIDENTIAL_V3",
      subjectVersion: 3,
      contentSha256,
      environmentScope: "PRODUCTION",
      status: "APPROVED",
      provisional: false,
      unresolvedManualReview: false,
      effectiveFrom: new Date("2026-08-01T00:00:00Z"),
      effectiveUntil: null,
      supersededAt: null,
      supersededByReference: null,
    };
    const approvalEvents = approvalEventsFor(priceBookRecord);

    const exact = evaluateProductionDependencies([priceBookRecord], {
      now: readinessNow,
      approvalEvents,
      configurationReferences: [exactReference],
    });
    expect(
      exact.items.find((item) => item.authorityKey === priceBook.key)?.approved,
    ).toBe(true);

    const invalidReferenceSets: readonly (readonly ConfigurationReferenceSnapshot[])[] =
      [
        [],
        [{ ...exactReference, contentSha256: "2".repeat(64) }],
        [{ ...exactReference, subjectVersion: 2 }],
        [{ ...exactReference, environmentScope: "STAGING" }],
        [{ ...exactReference, provisional: true }],
        [{ ...exactReference, unresolvedManualReview: true }],
        [{ ...exactReference, resolverId: "" }],
        [{ ...exactReference, resolverVersion: "" }],
        [
          {
            ...exactReference,
            supersededAt: new Date("2026-08-15T00:00:00Z"),
            supersededByReference: "PRICE_BOOK:RESIDENTIAL_V4:4",
          },
        ],
        [
          {
            ...exactReference,
            effectiveFrom: new Date("2026-09-02T00:00:00Z"),
          },
        ],
        [{ ...exactReference, effectiveUntil: readinessNow }],
        [
          exactReference,
          {
            ...exactReference,
            subjectVersion: 4,
            contentSha256: "4".repeat(64),
          },
        ],
      ];
    for (const configurationReferences of invalidReferenceSets) {
      const result = evaluateProductionDependencies([priceBookRecord], {
        now: readinessNow,
        approvalEvents,
        configurationReferences,
      });
      expect(
        result.items.find((item) => item.authorityKey === priceBook.key)
          ?.approved,
      ).toBe(false);
    }
  });

  it.each(["STAGING", "PRODUCTION"] as const)(
    "rejects arbitrary inline leaves and qualitative markers for %s readiness",
    (environmentScope) => {
      const inlineDrafts = [
        [
          "BRAND_IDENTITY",
          { kind: "DECISION", decisionCode: "FINAL_BRAND_PROVIDED" },
        ],
        [
          "PUBLIC_CLAIMS",
          {
            kind: "CLAIM_DECISIONS",
            entries: [
              {
                claimId: "one-known-claim",
                decision: "WITHHELD",
                evidenceReference: null,
              },
            ],
          },
        ],
        [
          "SERVICE_SCOPE",
          {
            kind: "SCOPE_DECISIONS",
            entries: [{ code: "ONE_SERVICE", decision: "SUPPORTED" }],
          },
        ],
        [
          "ITEM_TAXONOMY_SCOPE",
          {
            kind: "SCOPE_DECISIONS",
            entries: [{ code: "ONE_ITEM", decision: "SUPPORTED" }],
          },
        ],
        [
          "MATERIAL_SPECIALIST_SCOPE",
          {
            kind: "SCOPE_DECISIONS",
            entries: [{ code: "ONE_MATERIAL", decision: "SUPPORTED" }],
          },
        ],
        [
          "TREATMENT_PRODUCT_POLICY",
          {
            kind: "SCOPE_DECISIONS",
            entries: [{ code: "ONE_PRODUCT", decision: "SUPPORTED" }],
          },
        ],
        [
          "DRYING_REUSE_GUIDANCE",
          {
            kind: "DURATION_CALIBRATION",
            subjectCode: "ONE_SERVICE",
            plannedMinutes: 180,
            bufferMinutes: 30,
            observedSampleCount: 1,
            observedMedianMinutes: 160,
            observedP90Minutes: 180,
          },
        ],
        [
          "DURATION_MODEL",
          {
            kind: "DURATION_CALIBRATION",
            subjectCode: "ONE_SERVICE",
            plannedMinutes: 60,
            bufferMinutes: 15,
            observedSampleCount: 0,
            observedMedianMinutes: null,
            observedP90Minutes: null,
          },
        ],
        [
          "WORKING_HOURS",
          {
            kind: "TIME_WINDOWS",
            timeZone: "Europe/Sofia",
            windows: [
              {
                code: "ONE_WINDOW",
                labelBg: "Един прозорец",
                labelEn: "One window",
                startMinute: 540,
                endMinute: 600,
              },
            ],
          },
        ],
        [
          "APPOINTMENT_WINDOWS",
          {
            kind: "TIME_WINDOWS",
            timeZone: "Europe/Sofia",
            windows: [
              {
                code: "ONE_WINDOW",
                labelBg: "Един прозорец",
                labelEn: "One window",
                startMinute: 540,
                endMinute: 600,
              },
            ],
          },
        ],
        [
          "SOFIA_SERVICE_ZONES",
          {
            kind: "TRAVEL_POLICY",
            includedZoneCodes: ["ONE_ZONE"],
            maximumDistanceHundredthsKm: 1_000,
            maximumTravelMinutes: 30,
            minimumTravelBufferMinutes: 10,
            routingDecision: "DETERMINISTIC_MATRIX_ACCEPTED",
            parkingDecision: "INCLUDED",
            parkingAmountMinorUnits: null,
          },
        ],
        [
          "TRAVEL_PARKING_ROUTING",
          {
            kind: "TRAVEL_POLICY",
            includedZoneCodes: ["ONE_ZONE"],
            maximumDistanceHundredthsKm: 1_000,
            maximumTravelMinutes: 30,
            minimumTravelBufferMinutes: 10,
            routingDecision: "DETERMINISTIC_MATRIX_ACCEPTED",
            parkingDecision: "INCLUDED",
            parkingAmountMinorUnits: null,
          },
        ],
        [
          "EQUIPMENT_INVENTORY",
          {
            kind: "SCOPE_DECISIONS",
            entries: [{ code: "ONE_MACHINE", decision: "SUPPORTED" }],
          },
        ],
        [
          "INVOICE_NUMBERING",
          {
            kind: "INVOICE_NUMBERING",
            prefix: "ONE-",
            startNumber: 1,
            paddingWidth: 6,
            documentTypes: ["STANDARD"],
          },
        ],
        ["QUOTE_BOOKING_TERMS", policyValue("QUOTE_BOOKING_TERMS")],
        ["JOB_OPERATING_POLICY", policyValue("JOB_OPERATING_POLICY")],
        [
          "PASSPORT_MAINTENANCE_POLICY",
          policyValue("PASSPORT_MAINTENANCE_POLICY"),
        ],
        [
          "AUTH_PROVIDER_RISK",
          {
            kind: "PROVIDER_DECISION",
            decisionCode: "ACCEPT_FOR_INITIAL_PRODUCTION",
            conditions: [],
          },
        ],
        ["AUTH_SESSION_POLICY", policyValue("AUTH_SESSION_POLICY")],
        ["SMTP_SENDER_IDENTITY", policyValue("SMTP_SENDER_IDENTITY")],
        ["MONITORING_OWNERSHIP", policyValue("MONITORING_OWNERSHIP")],
        ["RECOVERY_OBJECTIVES", policyValue("RECOVERY_OBJECTIVES")],
        ["PAYMENT_TERMS", policyValue("PAYMENT_TERMS")],
        ["FINANCE_FISCAL_POLICY", policyValue("FINANCE_FISCAL_POLICY")],
        [
          "PRODUCTION_DATABASE_BOOTSTRAP",
          policyValue("PRODUCTION_DATABASE_BOOTSTRAP"),
        ],
      ] as const satisfies readonly (readonly [string, AuthorityValue])[];

      for (const [authorityKey, value] of inlineDrafts) {
        const definition = businessAuthorityDefinitions.find(
          (entry) => entry.key === authorityKey,
        )!;
        const record = approvedRecord(definition, {
          environmentScope,
          status:
            environmentScope === "STAGING"
              ? "APPROVED_FOR_STAGING"
              : "APPROVED_FOR_PRODUCTION",
          value,
        });
        const result = evaluateProductionDependencies([record], {
          environmentScope,
          now: readinessNow,
          approvalEvents: approvalEventsFor(record),
        });

        expect(
          result.items.find((item) => item.authorityKey === authorityKey)
            ?.approved,
          authorityKey,
        ).toBe(false);
      }
    },
  );

  it("keeps marker-only dependencies blocked without a trusted substantive snapshot resolver", () => {
    const markerOnlyAuthorityKeys = [
      "BRAND_IDENTITY",
      "QUOTE_BOOKING_TERMS",
      "JOB_OPERATING_POLICY",
      "PASSPORT_MAINTENANCE_POLICY",
      "AUTH_PROVIDER_RISK",
      "AUTH_SESSION_POLICY",
      "SMTP_SENDER_IDENTITY",
      "MONITORING_OWNERSHIP",
      "RECOVERY_OBJECTIVES",
      "PAYMENT_TERMS",
      "FINANCE_FISCAL_POLICY",
      "PRODUCTION_DATABASE_BOOTSTRAP",
      "TRAVEL_PARKING_ROUTING",
    ] as const;

    for (const authorityKey of markerOnlyAuthorityKeys) {
      const definition = businessAuthorityDefinitions.find(
        (entry) => entry.key === authorityKey,
      )!;
      const record = approvedRecord(definition, {
        value: configurationValue(definition),
      });
      const result = evaluateProductionDependencies([record], {
        now: readinessNow,
        approvalEvents: approvalEventsFor(record),
        configurationReferences: [],
      });
      expect(
        result.items.find((item) => item.authorityKey === authorityKey)
          ?.approved,
        authorityKey,
      ).toBe(false);
    }
  });

  it("fails closed for omitted, unknown, unresolved, or ambiguous canonical snapshots", () => {
    const definition = businessAuthorityDefinitions.find(
      (entry) => entry.key === "SERVICE_SCOPE",
    )!;
    const value = configurationValue(definition) as Extract<
      AuthorityValue,
      { kind: "CONFIG_REFERENCE" }
    >;
    const record = approvedRecord(definition, { value });
    const exactReference: ConfigurationReferenceSnapshot = {
      resolverId: "canonical-vax-config",
      resolverVersion: "v1",
      ...value,
      environmentScope: "PRODUCTION",
      status: "APPROVED",
      provisional: false,
      unresolvedManualReview: false,
      effectiveFrom: new Date("2026-08-01T00:00:00Z"),
      effectiveUntil: null,
      supersededAt: null,
      supersededByReference: null,
    };
    const evaluate = (
      candidate: BusinessAuthorityRecord,
      references: readonly ConfigurationReferenceSnapshot[],
    ) =>
      evaluateProductionDependencies([candidate], {
        now: readinessNow,
        approvalEvents: approvalEventsFor(candidate),
        configurationReferences: references,
      }).items.find((item) => item.authorityKey === definition.key)?.approved;

    expect(evaluate(record, [exactReference])).toBe(true);
    expect(evaluate(record, [])).toBe(false);
    expect(evaluate(record, [exactReference, { ...exactReference }])).toBe(
      false,
    );
    expect(
      evaluate(record, [
        { ...exactReference, subjectCode: "OMITTED_GOVERNED_CATALOG" },
      ]),
    ).toBe(false);

    const unknownValue = {
      ...value,
      subjectType: "UNKNOWN_CATALOG",
    };
    const unknownRecord = approvedRecord(definition, { value: unknownValue });
    expect(
      evaluate(unknownRecord, [{ ...exactReference, ...unknownValue }]),
    ).toBe(false);
  });

  it.each(["email", "phone", "address"] as const)(
    "requires substantive business-contact %s content",
    (missingField) => {
      const definition = businessAuthorityDefinitions.find(
        (entry) => entry.key === "BUSINESS_CONTACT_DETAILS",
      )!;
      const value = operationalValue(definition) as Extract<
        AuthorityValue,
        { kind: "BUSINESS_CONTACT" }
      >;
      const record = approvedRecord(definition, {
        value: { ...value, [missingField]: null },
      });
      const result = evaluateProductionDependencies([record], {
        now: readinessNow,
        approvalEvents: approvalEventsFor(record),
      });
      expect(
        result.items.find((item) => item.authorityKey === definition.key)
          ?.approved,
      ).toBe(false);
    },
  );

  it("fails closed for partial or unapproved retention matrices", () => {
    const retention = businessAuthorityDefinitions.find(
      (entry) => entry.key === "PRIVACY_RETENTION",
    )!;
    const categories = [
      "AUTH_SECURITY",
      "CRM",
      "ANONYMOUS_REQUESTS",
      "QUOTES",
      "BOOKINGS",
      "JOBS",
      "PASSPORT",
      "FINANCE",
      "COMMUNICATIONS_DOCUMENTS",
    ] as const;
    const completeRules = categories.map((category) => ({
      category,
      status: "APPROVED" as const,
      retentionDays: 365,
      erasureException: "NONE" as const,
    }));
    const completeRecord = approvedRecord(retention, {
      value: {
        kind: "RETENTION_POLICY",
        rules: completeRules,
        automaticDeletionEnabled: false,
      },
      sourceReference: "LEGAL-RETENTION-001",
    });
    const complete = evaluateProductionDependencies([completeRecord], {
      now: readinessNow,
      approvalEvents: approvalEventsFor(completeRecord),
    });
    expect(
      complete.items.find((item) => item.authorityKey === retention.key)
        ?.approved,
    ).toBe(true);

    const incompleteValues = [
      completeRules.slice(0, -1),
      completeRules.map((rule, index) =>
        index === 0 ? { ...rule, retentionDays: null } : rule,
      ),
      completeRules.map((rule, index) =>
        index === 0
          ? { ...rule, status: "LEGAL_REVIEW_REQUIRED" as const }
          : rule,
      ),
      completeRules.map((rule, index) =>
        index === 0
          ? {
              ...rule,
              erasureException: "LEGAL_REVIEW_REQUIRED" as const,
            }
          : rule,
      ),
    ];
    for (const rules of incompleteValues) {
      const candidate = approvedRecord(retention, {
        value: {
          kind: "RETENTION_POLICY",
          rules,
          automaticDeletionEnabled: false,
        },
        sourceReference: "LEGAL-RETENTION-001",
      });
      const result = evaluateProductionDependencies([candidate], {
        now: readinessNow,
        approvalEvents: approvalEventsFor(candidate),
      });
      expect(
        result.items.find((item) => item.authorityKey === retention.key)
          ?.approved,
      ).toBe(false);
    }

    const resolvedException = approvedRecord(retention, {
      value: {
        kind: "RETENTION_POLICY",
        rules: completeRules.map((rule, index) =>
          index === 0
            ? { ...rule, erasureException: "RETAIN_REQUIRED" as const }
            : rule,
        ),
        automaticDeletionEnabled: false,
      },
      sourceReference: "LEGAL-RETENTION-001",
    });
    expect(
      evaluateProductionDependencies([resolvedException], {
        now: readinessNow,
        approvalEvents: approvalEventsFor(resolvedException),
      }).items.find((item) => item.authorityKey === retention.key)?.approved,
    ).toBe(true);
  });

  it("rejects incomplete, arbitrary, or semantically invalid policy sets", () => {
    const availability = businessAuthorityDefinitions.find(
      (entry) => entry.key === "AVAILABILITY_POLICY",
    )!;
    const completeEntries = [
      {
        code: "QUOTE_MODE",
        decision: "ASSESSMENT_REQUIRED",
        numericValue: null,
        unit: null,
      },
      {
        code: "BOOKING_MODE",
        decision: "STAFF_CONFIRMATION_REQUIRED",
        numericValue: null,
        unit: null,
      },
    ];
    const completeRecord = approvedRecord(availability, {
      value: { kind: "POLICY_SET", entries: completeEntries },
    });
    const complete = evaluateProductionDependencies([completeRecord], {
      now: readinessNow,
      approvalEvents: approvalEventsFor(completeRecord),
    });
    expect(
      complete.items.find((item) => item.authorityKey === availability.key)
        ?.approved,
    ).toBe(true);

    const invalidEntries = [
      completeEntries.slice(0, 1),
      [
        {
          code: "APPROVAL",
          decision: "APPROVED",
          numericValue: null,
          unit: null,
        },
      ],
      completeEntries.map((entry, index) =>
        index === 0 ? { ...entry, decision: "ARBITRARY_VALUE" } : entry,
      ),
    ];
    for (const entries of invalidEntries) {
      const candidate = approvedRecord(availability, {
        value: { kind: "POLICY_SET", entries },
      });
      const result = evaluateProductionDependencies([candidate], {
        now: readinessNow,
        approvalEvents: approvalEventsFor(candidate),
      });
      expect(
        result.items.find((item) => item.authorityKey === availability.key)
          ?.approved,
      ).toBe(false);
    }
  });

  it.each([
    ["QUOTE_BOOKING_TERMS", "QUOTE_VALIDITY", "DAYS", 1],
    ["AUTH_SESSION_POLICY", "MAXIMUM_LIFETIME", "MINUTES", 1],
    ["RECOVERY_OBJECTIVES", "RPO", "MINUTES", 1],
    ["RECOVERY_OBJECTIVES", "RTO", "MINUTES", 1],
    ["RECOVERY_OBJECTIVES", "BACKUP_FREQUENCY", "MINUTES", 1],
    ["RECOVERY_OBJECTIVES", "BACKUP_RETENTION", "DAYS", 1],
    ["PAYMENT_TERMS", "DUE_DAYS", "DAYS", 0],
  ] as const)(
    "enforces the semantic numeric contract for %s.%s",
    (authorityKey, numericCode, expectedUnit, minimum) => {
      const validEntriesByAuthority = {
        QUOTE_BOOKING_TERMS: [
          ["QUOTE_VALIDITY", "DEFINED"],
          ["BOOKING_CONFIRMATION", "DEFINED"],
          ["CANCELLATION", "DEFINED"],
          ["RESCHEDULING", "DEFINED"],
        ],
        AUTH_SESSION_POLICY: [
          ["MAXIMUM_LIFETIME", "DEFINED"],
          ["LOGOUT", "DEFINED"],
          ["SUSPENDED_USER", "FAIL_CLOSED"],
          ["COMPROMISED_ACCOUNT", "DEFINED"],
          ["EMERGENCY_RECOVERY", "DEFINED"],
        ],
        RECOVERY_OBJECTIVES: [
          ["RPO", "DEFINED"],
          ["RTO", "DEFINED"],
          ["BACKUP_FREQUENCY", "DEFINED"],
          ["BACKUP_RETENTION", "DEFINED"],
          ["RESTORE_AUTHORITY", "DEFINED"],
        ],
        PAYMENT_TERMS: [
          ["PAYMENT_MODE", "DEFINED"],
          ["DUE_DAYS", "DEFINED"],
          ["PREPAYMENT", "NOT_APPLICABLE"],
          ["BUSINESS_TERMS", "DEFINED"],
        ],
      } as const;
      const numericContracts = new Map<
        string,
        readonly ["MINUTES" | "DAYS", number]
      >([
        ["QUOTE_VALIDITY", ["DAYS", 1]],
        ["MAXIMUM_LIFETIME", ["MINUTES", 1]],
        ["RPO", ["MINUTES", 1]],
        ["RTO", ["MINUTES", 1]],
        ["BACKUP_FREQUENCY", ["MINUTES", 1]],
        ["BACKUP_RETENTION", ["DAYS", 1]],
        ["DUE_DAYS", ["DAYS", 0]],
      ] as const);
      const validEntries: PolicyEntry[] = validEntriesByAuthority[
        authorityKey
      ].map(([code, decision]) => {
        const contract = numericContracts.get(code);
        return {
          code,
          decision,
          numericValue: contract?.[1] ?? null,
          unit: contract?.[0] ?? null,
        };
      });
      const semanticallyValid = (entries: readonly PolicyEntry[]) =>
        policySetValueIsSemanticallyValid(authorityKey, {
          kind: "POLICY_SET",
          entries: [...entries],
        });

      expect(semanticallyValid(validEntries)).toBe(true);
      expect(
        semanticallyValid(
          validEntries.map((entry) =>
            entry.code === numericCode
              ? { ...entry, unit: expectedUnit === "DAYS" ? "MINUTES" : "DAYS" }
              : entry,
          ),
        ),
      ).toBe(false);
      if (minimum > 0) {
        expect(
          semanticallyValid(
            validEntries.map((entry) =>
              entry.code === numericCode
                ? { ...entry, numericValue: minimum - 1 }
                : entry,
            ),
          ),
        ).toBe(false);
      }
      expect(
        semanticallyValid([
          ...validEntries,
          {
            code: "UNEXPECTED",
            decision: "DEFINED",
            numericValue: null,
            unit: null,
          },
        ]),
      ).toBe(false);
      expect(
        semanticallyValid(
          validEntries.map((entry) =>
            entry.code !== numericCode
              ? { ...entry, numericValue: 1, unit: "COUNT" }
              : entry,
          ),
        ),
      ).toBe(false);
    },
  );

  it("does not borrow authority approvals from another record", () => {
    const definition = businessAuthorityDefinitions.find(
      (entry) => entry.key === "SERVICE_SCOPE",
    )!;
    const target = approvedRecord(definition);
    const other = approvedRecord(definition, { id: crypto.randomUUID() });
    const result = evaluateProductionDependencies([target], {
      now: readinessNow,
      approvalEvents: approvalEventsFor(other),
    });

    expect(
      result.items.find((item) => item.authorityKey === definition.key)
        ?.approved,
    ).toBe(false);
  });

  it("fails closed when more than one current authority record is eligible", () => {
    const vatStatus = businessAuthorityDefinitions.find(
      (entry) => entry.key === "VAT_TAX_STATUS",
    )!;
    const first = approvedRecord(vatStatus, { version: 1 });
    const second = approvedRecord(vatStatus, {
      id: crypto.randomUUID(),
      version: 2,
    });
    const result = evaluateProductionDependencies([first, second], {
      now: readinessNow,
      approvalEvents: [
        ...approvalEventsFor(first),
        ...approvalEventsFor(second),
      ],
    });
    const item = result.items.find(
      (entry) => entry.authorityKey === vatStatus.key,
    );
    expect(item?.approved).toBe(false);
    expect(item?.matrixStatus).toBe("TECHNICAL_BLOCKER");
    expect(result.selectedRecords).not.toContain(first);
    expect(result.selectedRecords).not.toContain(second);
  });

  it("binds production deployment GO to its exact window, release, target, and dependency fingerprint", () => {
    const dependency = approvedRecord(
      businessAuthorityDefinitions.find(
        (entry) => entry.key === "BRAND_IDENTITY",
      )!,
    );
    const originalFingerprint = createProductionDependencyFingerprint([
      dependency,
    ]);
    const changedFingerprint = createProductionDependencyFingerprint([
      { ...dependency, recordVersion: dependency.recordVersion + 1 },
    ]);
    const releaseTarget = {
      releaseCommitSha: "a".repeat(40),
      targetReference: "PRODUCTION_V1",
    };
    const authorization = {
      kind: "DEPLOYMENT_AUTHORIZATION",
      decisionCode: "GO",
      releaseCommitSha: releaseTarget.releaseCommitSha,
      targetReference: releaseTarget.targetReference,
      changeWindowStart: "2026-09-01T00:00:00.000Z",
      changeWindowEnd: "2026-09-01T01:00:00.000Z",
      dependencyFingerprint: originalFingerprint,
    };

    expect(
      deploymentAuthorizationMatchesSnapshot(
        authorization,
        originalFingerprint,
        releaseTarget,
        new Date("2026-09-01T00:30:00Z"),
      ),
    ).toBe(true);
    expect(
      deploymentAuthorizationMatchesSnapshot(
        authorization,
        changedFingerprint,
        releaseTarget,
        new Date("2026-09-01T00:30:00Z"),
      ),
    ).toBe(false);
    expect(
      deploymentAuthorizationMatchesSnapshot(
        authorization,
        originalFingerprint,
        { ...releaseTarget, releaseCommitSha: "b".repeat(40) },
        new Date("2026-09-01T00:30:00Z"),
      ),
    ).toBe(false);
    expect(
      deploymentAuthorizationMatchesSnapshot(
        authorization,
        originalFingerprint,
        { ...releaseTarget, targetReference: "PRODUCTION_V2" },
        new Date("2026-09-01T00:30:00Z"),
      ),
    ).toBe(false);
    expect(
      deploymentAuthorizationMatchesSnapshot(
        authorization,
        originalFingerprint,
        releaseTarget,
        new Date("2026-08-31T23:59:59Z"),
      ),
    ).toBe(false);
    expect(
      deploymentAuthorizationMatchesSnapshot(
        authorization,
        originalFingerprint,
        releaseTarget,
        new Date("2026-09-01T01:00:00Z"),
      ),
    ).toBe(false);
  });

  it("canonicalizes dependency order while binding readiness semantics and excluding presentation metadata", () => {
    const fixture = completeAuthorityFixture("PRODUCTION");
    const records = fixture.records.slice(0, 2);
    const references = fixture.configurationReferences.filter((reference) =>
      records.some((record) => {
        const parsed = authorityValueSchema.safeParse(record.value);
        return (
          parsed.success &&
          parsed.data.kind === "CONFIG_REFERENCE" &&
          parsed.data.subjectType === reference.subjectType &&
          parsed.data.subjectCode === reference.subjectCode
        );
      }),
    );
    const baseline = createProductionDependencyFingerprint(records, references);

    expect(
      createProductionDependencyFingerprint(
        [...records].reverse(),
        [...references].reverse(),
      ),
    ).toBe(baseline);

    const first = records[0]!;
    expect(
      createProductionDependencyFingerprint(
        [{ ...first, safeEvidenceSummary: "Presentation-only change." }, records[1]!],
        references,
      ),
    ).toBe(baseline);

    const semanticVariants: readonly BusinessAuthorityRecord[] = [
      { ...first, contentHash: "f".repeat(64) },
      { ...first, environmentScope: "STAGING" },
      { ...first, status: "APPROVED_FOR_STAGING" },
      { ...first, supersededAt: readinessNow, supersededById: crypto.randomUUID() },
    ];
    for (const changed of semanticVariants) {
      expect(
        createProductionDependencyFingerprint([changed, records[1]!], references),
      ).not.toBe(baseline);
    }

    const firstReference = references[0];
    if (firstReference) {
      expect(
        createProductionDependencyFingerprint(records, [
          {
            ...firstReference,
            supersededAt: readinessNow,
            supersededByReference: "replacement",
          },
          ...references.slice(1),
        ]),
      ).not.toBe(baseline);
    }
  });
});
