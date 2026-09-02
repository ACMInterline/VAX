import { describe, expect, it, vi } from "vitest";
import { rolePermissionMatrix } from "@/modules/identity-access/policy";
import * as readinessModule from "./readiness";
import { createBusinessAuthorityService } from "./service";
import type { BusinessAuthorityRepository } from "./service";
import type { BusinessAuthorityActor, BusinessAuthorityRecord } from "./types";

function actor(role: "OWNER" | "ADMIN"): BusinessAuthorityActor {
  return {
    profileId: "10000000-0000-4000-8000-000000000001",
    status: "ACTIVE",
    roles: new Set([role]),
    permissions: new Set(rolePermissionMatrix[role]),
  };
}

function record(
  overrides: Partial<BusinessAuthorityRecord> = {},
): BusinessAuthorityRecord {
  const now = new Date("2026-09-01T00:00:00Z");
  return {
    id: "20000000-0000-4000-8000-000000000001",
    contentHash: "a".repeat(64),
    authorityKey: "WORKING_HOURS",
    category: "SCHEDULING",
    version: 1,
    recordVersion: 1,
    environmentScope: "STAGING",
    status: "UNDER_REVIEW",
    evidenceClass: "OWNER_INPUT",
    requiredAuthorityTypes: ["OWNER"],
    value: {
      kind: "CONFIG_REFERENCE",
      subjectType: "WORKING_HOURS",
      subjectCode: "STAGING_V1",
      subjectVersion: 1,
      contentSha256: "a".repeat(64),
    },
    sourceReference: null,
    safeEvidenceSummary: null,
    internalNotes: null,
    effectiveFrom: now,
    effectiveUntil: null,
    proposedByProfileId: actor("OWNER").profileId,
    approvedByProfileId: null,
    approvedAt: null,
    supersededAt: null,
    supersededById: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function repository(records: readonly BusinessAuthorityRecord[] = []) {
  const value: BusinessAuthorityRepository = {
    listState: vi.fn(async () => ({
      records,
      events: [],
      configurationReferences: [],
    })),
    createProposal: vi.fn(async () => ({
      status: "CHANGED" as const,
      recordId: "30000000-0000-4000-8000-000000000001",
    })),
    transition: vi.fn(async () => ({
      status: "CHANGED" as const,
      recordId: records[0]?.id ?? "30000000-0000-4000-8000-000000000001",
    })),
  };
  return value;
}

describe("business-authority service", () => {
  it("allows Admin to inspect but never create or activate authority", async () => {
    const repo = repository([record()]);
    const service = createBusinessAuthorityService(repo);
    await expect(service.listState(actor("ADMIN"))).resolves.toBeDefined();
    await expect(
      service.propose(actor("ADMIN"), {
        authorityKey: "WORKING_HOURS",
        environmentScope: "STAGING",
        value: record().value as never,
        sourceReference: null,
        safeEvidenceSummary: null,
        internalNotes: null,
        effectiveFrom: new Date("2026-09-01T00:00:00Z"),
        effectiveUntil: null,
      }),
    ).rejects.toThrow("PERMISSION_DENIED");
    await expect(
      service.decide(actor("ADMIN"), {
        recordId: record().id,
        expectedAuthorityVersion: 1,
        expectedRecordVersion: 1,
        expectedContentHash: "a".repeat(64),
        action: "APPROVE",
        decisionAuthorityType: "OWNER",
        evidenceReference: null,
        safeEvidenceSummary: null,
      }),
    ).rejects.toThrow("PERMISSION_DENIED");
  });

  it("creates only a validated non-operative proposal", async () => {
    const repo = repository();
    const service = createBusinessAuthorityService(repo);
    await service.propose(actor("OWNER"), {
      authorityKey: "WORKING_HOURS",
      environmentScope: "STAGING",
      value: {
        kind: "CONFIG_REFERENCE",
        subjectType: "WORKING_HOURS",
        subjectCode: "STAGING_V1",
        subjectVersion: 1,
        contentSha256: "a".repeat(64),
      },
      sourceReference: null,
      safeEvidenceSummary: "Explicit staging proposal only.",
      internalNotes: null,
      effectiveFrom: new Date("2026-09-01T00:00:00Z"),
      effectiveUntil: null,
    });
    expect(repo.createProposal).toHaveBeenCalledOnce();
    const persisted = vi.mocked(repo.createProposal).mock.calls[0]![1];
    expect(persisted.definition.key).toBe("WORKING_HOURS");
    expect(persisted).not.toHaveProperty("status");
    expect(persisted).not.toHaveProperty("approvedByProfileId");
  });

  it("rejects sensitive content on direct service calls before persistence", async () => {
    const repo = repository();
    const service = createBusinessAuthorityService(repo);

    await expect(
      service.propose(actor("OWNER"), {
        authorityKey: "BRAND_IDENTITY",
        environmentScope: "STAGING",
        value: {
          kind: "DECISION",
          decisionCode: "APPROVE_TEMPORARY_BRAND",
          detailsEn: "refresh_token=synthetic-token-value",
        },
        sourceReference: null,
        safeEvidenceSummary: null,
        internalNotes: null,
        effectiveFrom: new Date("2026-09-01T00:00:00Z"),
        effectiveUntil: null,
      }),
    ).rejects.toThrow("INVALID_REQUEST");
    expect(repo.createProposal).not.toHaveBeenCalled();
  });

  it("fails closed before a production GO when any dependency is pending", async () => {
    const deployment = record({
      authorityKey: "PRODUCTION_DEPLOYMENT_AUTHORIZATION",
      category: "DEPLOYMENT_AUTHORIZATION",
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
    });
    const repo = repository([deployment]);
    const service = createBusinessAuthorityService(repo);
    await expect(
      service.decide(actor("OWNER"), {
        recordId: deployment.id,
        expectedAuthorityVersion: deployment.version,
        expectedRecordVersion: deployment.recordVersion,
        expectedContentHash: deployment.contentHash,
        action: "APPROVE",
        decisionAuthorityType: "OWNER",
        evidenceReference: null,
        safeEvidenceSummary: null,
      }),
    ).rejects.toThrow("DEPENDENCIES_NOT_APPROVED");
    expect(repo.transition).not.toHaveBeenCalled();
  });

  it("passes an exact approved dependency snapshot to the atomic transition boundary", async () => {
    const dependency = record({
      id: "20000000-0000-4000-8000-000000000010",
      authorityKey: "BUSINESS_CONTACT_DETAILS",
      category: "BRAND_CONTENT",
      environmentScope: "PRODUCTION",
      status: "APPROVED_FOR_PRODUCTION",
      approvedAt: new Date("2026-08-31T23:00:00.000Z"),
    });
    const deployment = record({
      authorityKey: "PRODUCTION_DEPLOYMENT_AUTHORIZATION",
      category: "DEPLOYMENT_AUTHORIZATION",
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
    });
    const readiness = vi
      .spyOn(readinessModule, "evaluateProductionDependencies")
      .mockReturnValueOnce({
        ready: true,
        fingerprint: "b".repeat(64),
        items: [],
        selectedRecords: [dependency],
        selectedConfigurationReferences: [],
      });
    const repo = repository([deployment, dependency]);
    const service = createBusinessAuthorityService(repo);

    await expect(
      service.decide(actor("OWNER"), {
        recordId: deployment.id,
        expectedAuthorityVersion: deployment.version,
        expectedRecordVersion: deployment.recordVersion,
        expectedContentHash: deployment.contentHash,
        action: "APPROVE",
        decisionAuthorityType: "OWNER",
        evidenceReference: null,
        safeEvidenceSummary: null,
      }),
    ).resolves.toMatchObject({ status: "CHANGED" });

    expect(repo.transition).toHaveBeenCalledWith(
      actor("OWNER").profileId,
      expect.objectContaining({
        productionDependencySnapshot: {
          configurationReferenceCount: 0,
          records: [
            expect.objectContaining({
              id: dependency.id,
              version: dependency.version,
              recordVersion: dependency.recordVersion,
              contentHash: dependency.contentHash,
              status: "APPROVED_FOR_PRODUCTION",
            }),
          ],
        },
      }),
      expect.any(String),
      expect.any(String),
    );
    readiness.mockRestore();
  });

  it("does not accept a stale record version", async () => {
    const target = record();
    const repo = repository([target]);
    const service = createBusinessAuthorityService(repo);
    await expect(
      service.decide(actor("OWNER"), {
        recordId: target.id,
        expectedAuthorityVersion: target.version,
        expectedRecordVersion: 0,
        expectedContentHash: target.contentHash,
        action: "REJECT",
        decisionAuthorityType: null,
        evidenceReference: null,
        safeEvidenceSummary: null,
      }),
    ).rejects.toThrow("OPERATION_CONFLICT");
  });

  it.each([
    {
      name: "authority version",
      expectedAuthorityVersion: 9,
      expectedContentHash: "a".repeat(64),
    },
    {
      name: "immutable content hash",
      expectedAuthorityVersion: 1,
      expectedContentHash: "b".repeat(64),
    },
  ])("does not approve a stale $name target", async (mismatch) => {
    const target = record();
    const repo = repository([target]);
    const service = createBusinessAuthorityService(repo);

    await expect(
      service.decide(actor("OWNER"), {
        recordId: target.id,
        expectedAuthorityVersion: mismatch.expectedAuthorityVersion,
        expectedRecordVersion: target.recordVersion,
        expectedContentHash: mismatch.expectedContentHash,
        action: "APPROVE",
        decisionAuthorityType: "OWNER",
        evidenceReference: null,
        safeEvidenceSummary: null,
      }),
    ).rejects.toThrow("OPERATION_CONFLICT");
    expect(repo.transition).not.toHaveBeenCalled();
  });

  it("does not approve an obsolete version after a newer proposal exists", async () => {
    const obsolete = record();
    const newer = record({
      id: "20000000-0000-4000-8000-000000000002",
      version: 2,
      recordVersion: 0,
      status: "PROPOSED",
    });
    const repo = repository([obsolete, newer]);
    const service = createBusinessAuthorityService(repo);

    await expect(
      service.decide(actor("OWNER"), {
        recordId: obsolete.id,
        expectedAuthorityVersion: obsolete.version,
        expectedRecordVersion: obsolete.recordVersion,
        expectedContentHash: obsolete.contentHash,
        action: "APPROVE",
        decisionAuthorityType: "OWNER",
        evidenceReference: null,
        safeEvidenceSummary: null,
      }),
    ).rejects.toThrow("OPERATION_CONFLICT");
    expect(repo.transition).not.toHaveBeenCalled();
  });

  it("maps a repository compare-and-set race to a fail-closed conflict", async () => {
    const target = record();
    const repo = repository([target]);
    vi.mocked(repo.transition).mockResolvedValueOnce({ status: "CONFLICT" });
    const service = createBusinessAuthorityService(repo);

    await expect(
      service.decide(actor("OWNER"), {
        recordId: target.id,
        expectedAuthorityVersion: target.version,
        expectedRecordVersion: target.recordVersion,
        expectedContentHash: target.contentHash,
        action: "REJECT",
        decisionAuthorityType: null,
        evidenceReference: null,
        safeEvidenceSummary: null,
      }),
    ).rejects.toThrow("OPERATION_CONFLICT");
    expect(repo.transition).toHaveBeenCalledOnce();
  });
});
