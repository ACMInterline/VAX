import { describe, expect, it } from "vitest";
import {
  rolePermissionMatrix,
  type ApplicationRoleCode,
  type PermissionCode,
} from "@/modules/identity-access/policy";
import {
  requireBusinessAuthorityDecision,
  requireBusinessAuthorityProposal,
  requireBusinessAuthorityRead,
  requireBusinessAuthorityStatusDecision,
} from "./policy";
import type { BusinessAuthorityActor, BusinessAuthorityRecord } from "./types";

function actor(
  role: ApplicationRoleCode,
  overrides: Readonly<{
    status?: BusinessAuthorityActor["status"];
    permissions?: ReadonlySet<PermissionCode>;
  }> = {},
): BusinessAuthorityActor {
  return {
    profileId: "00000000-0000-4000-8000-000000000001",
    status: overrides.status ?? "ACTIVE",
    roles: new Set([role]),
    permissions: overrides.permissions ?? new Set(rolePermissionMatrix[role]),
  };
}

function record(
  overrides: Partial<BusinessAuthorityRecord> = {},
): BusinessAuthorityRecord {
  const now = new Date("2026-09-01T00:00:00Z");
  return {
    id: "00000000-0000-4000-8000-000000000002",
    contentHash: "a".repeat(64),
    authorityKey: "WORKING_HOURS",
    category: "SCHEDULING",
    version: 1,
    recordVersion: 1,
    environmentScope: "STAGING",
    status: "UNDER_REVIEW",
    evidenceClass: "OWNER_INPUT",
    requiredAuthorityTypes: ["OPERATIONS"],
    value: {
      kind: "CONFIG_REFERENCE",
      subjectType: "WORKING_HOUR_POLICY",
      subjectCode: "STAGING_V1",
      subjectVersion: 1,
      contentSha256: "a".repeat(64),
    },
    sourceReference: null,
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

describe("business-authority authorization", () => {
  it("allows only Owner and Admin to read the authority register", () => {
    expect(() => requireBusinessAuthorityRead(actor("OWNER"))).not.toThrow();
    expect(() => requireBusinessAuthorityRead(actor("ADMIN"))).not.toThrow();
    for (const role of ["DISPATCHER", "TECHNICIAN", "CUSTOMER"] as const) {
      expect(() => requireBusinessAuthorityRead(actor(role))).toThrow(
        "PERMISSION_DENIED",
      );
    }
  });

  it.each(["ADMIN", "DISPATCHER", "TECHNICIAN", "CUSTOMER"] as const)(
    "denies every %s authority mutation path",
    (role) => {
      const candidate = actor(role);
      expect(() =>
        requireBusinessAuthorityProposal(candidate, "WORKING_HOURS", "STAGING"),
      ).toThrow("PERMISSION_DENIED");
      expect(() =>
        requireBusinessAuthorityDecision(
          candidate,
          record(),
          "OPERATIONS",
          null,
        ),
      ).toThrow("PERMISSION_DENIED");
      expect(() =>
        requireBusinessAuthorityStatusDecision(candidate, record()),
      ).toThrow("PERMISSION_DENIED");
    },
  );

  it.each(["SUSPENDED", "DISABLED"] as const)(
    "denies an otherwise privileged %s Owner",
    (status) => {
      const candidate = actor("OWNER", { status });
      expect(() => requireBusinessAuthorityRead(candidate)).toThrow(
        "ACCOUNT_UNAVAILABLE",
      );
      expect(() =>
        requireBusinessAuthorityProposal(candidate, "WORKING_HOURS", "STAGING"),
      ).toThrow("ACCOUNT_UNAVAILABLE");
      expect(() =>
        requireBusinessAuthorityDecision(
          candidate,
          record(),
          "OPERATIONS",
          null,
        ),
      ).toThrow("ACCOUNT_UNAVAILABLE");
      expect(() =>
        requireBusinessAuthorityStatusDecision(candidate, record()),
      ).toThrow("ACCOUNT_UNAVAILABLE");
    },
  );

  it("does not infer Owner authority from a forged permission set", () => {
    const managePermissions = new Set<PermissionCode>([
      "SYSTEM_SETTINGS_READ",
      "SYSTEM_SETTINGS_MANAGE",
    ]);
    const forgedAdmin = actor("ADMIN", { permissions: managePermissions });
    const strippedOwner = actor("OWNER", { permissions: new Set() });

    expect(() =>
      requireBusinessAuthorityProposal(
        forgedAdmin,
        "WORKING_HOURS",
        "PRODUCTION",
      ),
    ).toThrow("PERMISSION_DENIED");
    expect(() =>
      requireBusinessAuthorityDecision(
        forgedAdmin,
        record({ environmentScope: "PRODUCTION" }),
        "OPERATIONS",
        null,
      ),
    ).toThrow("PERMISSION_DENIED");
    expect(() =>
      requireBusinessAuthorityStatusDecision(forgedAdmin, record()),
    ).toThrow("PERMISSION_DENIED");
    expect(() =>
      requireBusinessAuthorityProposal(
        strippedOwner,
        "WORKING_HOURS",
        "STAGING",
      ),
    ).toThrow("PERMISSION_DENIED");
  });

  it("keeps proposals owner-controlled and blocks self-asserted system evidence", () => {
    expect(() =>
      requireBusinessAuthorityProposal(
        actor("ADMIN"),
        "WORKING_HOURS",
        "STAGING",
      ),
    ).toThrow("PERMISSION_DENIED");
    expect(() =>
      requireBusinessAuthorityProposal(
        actor("OWNER"),
        "WORKING_HOURS",
        "STAGING",
      ),
    ).not.toThrow();
    expect(() =>
      requireBusinessAuthorityProposal(
        actor("OWNER"),
        "PRODUCTION_DATABASE_BOOTSTRAP",
        "PRODUCTION",
      ),
    ).toThrow("SYSTEM_EVIDENCE_REQUIRED");
  });

  it("does not let Admin impersonate a conceptual staging authority", () => {
    expect(() =>
      requireBusinessAuthorityDecision(
        actor("ADMIN"),
        record(),
        "OPERATIONS",
        null,
      ),
    ).toThrow("PERMISSION_DENIED");
    expect(() =>
      requireBusinessAuthorityDecision(
        actor("OWNER"),
        record(),
        "OPERATIONS",
        null,
      ),
    ).not.toThrow();
    expect(() =>
      requireBusinessAuthorityDecision(
        actor("ADMIN"),
        record({ environmentScope: "PRODUCTION" }),
        "OPERATIONS",
        null,
      ),
    ).toThrow("PERMISSION_DENIED");
  });

  it("keeps pricing, seller, tax, legal and privacy approval owner-only", () => {
    expect(() =>
      requireBusinessAuthorityDecision(
        actor("ADMIN"),
        record({
          authorityKey: "VAT_TAX_STATUS",
          category: "VAT_TAX",
          requiredAuthorityTypes: ["ACCOUNTANT"],
          evidenceClass: "EXTERNAL_EVIDENCE_REQUIRED",
        }),
        "ACCOUNTANT",
        "ACCOUNTANT-REVIEW-001",
      ),
    ).toThrow("PERMISSION_DENIED");
  });

  it("requires external evidence when the owner records professional authority", () => {
    const vat = record({
      authorityKey: "VAT_TAX_STATUS",
      category: "VAT_TAX",
      requiredAuthorityTypes: ["ACCOUNTANT"],
      evidenceClass: "EXTERNAL_EVIDENCE_REQUIRED",
    });
    expect(() =>
      requireBusinessAuthorityDecision(actor("OWNER"), vat, "ACCOUNTANT", null),
    ).toThrow("EXTERNAL_EVIDENCE_REQUIRED");
  });
});
