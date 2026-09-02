import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationBoundaryError } from "@/auth/principal-policy";
import { BusinessAuthorityPolicyError } from "@/modules/business-authority/policy";

const doubles = vi.hoisted(() => {
  const service = {
    propose: vi.fn(),
    decide: vi.fn(),
    listState: vi.fn(),
  };
  return {
    service,
    requireUserPermission: vi.fn(),
    isAuthAttemptAllowed: vi.fn(),
    revalidatePath: vi.fn(),
    repositoryFactory: vi.fn(() => ({})),
    serviceFactory: vi.fn(() => service),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: doubles.revalidatePath }));
vi.mock("@/auth/authorization-service", () => ({
  requireUserPermission: doubles.requireUserPermission,
}));
vi.mock("@/auth/enforce-rate-limit", () => ({
  isAuthAttemptAllowed: doubles.isAuthAttemptAllowed,
}));
vi.mock("@/db/client", () => ({ getDatabase: vi.fn(() => ({})) }));
vi.mock("@/modules/business-authority/repository", () => ({
  createDatabaseBusinessAuthorityRepository: doubles.repositoryFactory,
}));
vi.mock("@/modules/business-authority/service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/business-authority/service")
  >()),
  createBusinessAuthorityService: doubles.serviceFactory,
}));

import {
  createAuthorityProposalAction,
  transitionAuthorityAction,
} from "./actions";

const profileId = "10000000-0000-4000-8000-000000000001";
const recordId = "20000000-0000-4000-8000-000000000001";
const principal = {
  identity: { id: "provider-subject-never-rendered" },
  session: { id: "session-never-rendered" },
  profile: {
    id: profileId,
    displayName: "Owner",
    preferredLocale: "en" as const,
    phone: null,
    status: "ACTIVE" as const,
  },
  roles: new Set(["OWNER"] as const),
  permissions: new Set([
    "SYSTEM_SETTINGS_READ",
    "SYSTEM_SETTINGS_MANAGE",
  ] as const),
};
const initialState = { status: "IDLE" as const };

function form(entries: readonly (readonly [string, string])[]): FormData {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
}

function validProposal(): FormData {
  return form([
    ["authorityKey", "BRAND_IDENTITY"],
    ["environmentScope", "STAGING"],
    [
      "valueJson",
      JSON.stringify({
        kind: "DECISION",
        decisionCode: "APPROVE_TEMPORARY_BRAND",
      }),
    ],
    ["sourceReference", ""],
    ["safeEvidenceSummary", "Owner decision for staging review."],
    ["internalNotes", ""],
    ["effectiveFrom", "2026-09-01T00:00:00.000Z"],
    ["effectiveUntil", ""],
  ]);
}

function validDecision(): FormData {
  return form([
    ["recordId", recordId],
    ["expectedAuthorityVersion", "4"],
    ["expectedRecordVersion", "2"],
    ["expectedContentHash", "a".repeat(64)],
    ["action", "APPROVE"],
    ["decisionAuthorityType", "OWNER"],
    ["evidenceReference", ""],
    ["safeEvidenceSummary", "Owner approval recorded."],
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  doubles.requireUserPermission.mockResolvedValue(principal);
  doubles.isAuthAttemptAllowed.mockResolvedValue(true);
  doubles.service.propose.mockResolvedValue({
    status: "CHANGED",
    recordId,
  });
  doubles.service.decide.mockResolvedValue({
    status: "CHANGED",
    recordId,
  });
});

describe("business-authority server action boundary", () => {
  it("reauthenticates and authorizes both mutations before reading FormData", async () => {
    for (const action of [
      createAuthorityProposalAction,
      transitionAuthorityAction,
    ]) {
      doubles.requireUserPermission.mockRejectedValueOnce(
        new AuthenticationBoundaryError("AUTHENTICATION_REQUIRED"),
      );
      const submitted = new FormData();
      const getAll = vi.spyOn(submitted, "getAll");
      const keys = vi.spyOn(submitted, "keys");

      await expect(action(initialState, submitted)).resolves.toEqual({
        status: "ERROR",
        message: "Действието не е разрешено.",
      });
      expect(getAll).not.toHaveBeenCalled();
      expect(keys).not.toHaveBeenCalled();
    }
    expect(doubles.requireUserPermission).toHaveBeenCalledWith(
      "SYSTEM_SETTINGS_MANAGE",
    );
    expect(doubles.service.propose).not.toHaveBeenCalled();
    expect(doubles.service.decide).not.toHaveBeenCalled();
  });

  it("applies ADMIN_MUTATION before parsing any browser-controlled field", async () => {
    doubles.isAuthAttemptAllowed.mockResolvedValue(false);
    const submitted = validProposal();
    const getAll = vi.spyOn(submitted, "getAll");
    const keys = vi.spyOn(submitted, "keys");

    await expect(
      createAuthorityProposalAction(initialState, submitted),
    ).resolves.toEqual({
      status: "ERROR",
      message: "This action is temporarily limited. Try again later.",
    });
    expect(doubles.isAuthAttemptAllowed).toHaveBeenCalledWith(
      "ADMIN_MUTATION",
      profileId,
    );
    expect(getAll).not.toHaveBeenCalled();
    expect(keys).not.toHaveBeenCalled();
  });

  it("passes only a strict proposal to the Owner-only service", async () => {
    await expect(
      createAuthorityProposalAction(initialState, validProposal()),
    ).resolves.toEqual({
      status: "SUCCESS",
      message: "The action was appended to the immutable audit trail.",
    });

    expect(doubles.service.propose).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId,
        roles: principal.roles,
        permissions: principal.permissions,
      }),
      {
        authorityKey: "BRAND_IDENTITY",
        environmentScope: "STAGING",
        value: {
          kind: "DECISION",
          decisionCode: "APPROVE_TEMPORARY_BRAND",
        },
        sourceReference: null,
        safeEvidenceSummary: "Owner decision for staging review.",
        internalNotes: null,
        effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
        effectiveUntil: null,
      },
    );
    const submitted = vi.mocked(doubles.service.propose).mock.calls[0]![1];
    expect(submitted).not.toHaveProperty("status");
    expect(submitted).not.toHaveProperty("actorProfileId");
    expect(submitted).not.toHaveProperty("approvedByProfileId");
    expect(doubles.revalidatePath).toHaveBeenCalledWith(
      "/app/admin/business-authority",
    );
    expect(doubles.repositoryFactory).toHaveBeenCalledWith(
      expect.anything(),
      principal.identity.id,
    );
  });

  it("rejects a crafted development proposal before service invocation", async () => {
    const submitted = validProposal();
    submitted.set("environmentScope", "DEVELOPMENT");

    await expect(
      createAuthorityProposalAction(initialState, submitted),
    ).resolves.toEqual({
      status: "ERROR",
      message: "The request is invalid or contains unexpected fields.",
    });
    expect(doubles.service.propose).not.toHaveBeenCalled();
  });

  it("rejects sensitive authority content before either service mutation", async () => {
    const proposal = validProposal();
    proposal.set(
      "valueJson",
      JSON.stringify({
        kind: "DECISION",
        decisionCode: "APPROVE_TEMPORARY_BRAND",
        detailsEn: "accessToken=synthetic-token-value",
      }),
    );
    await expect(
      createAuthorityProposalAction(initialState, proposal),
    ).resolves.toMatchObject({ status: "ERROR" });

    const decision = validDecision();
    decision.set(
      "safeEvidenceSummary",
      "providerSubjectId=synthetic-provider-identity",
    );
    await expect(
      transitionAuthorityAction(initialState, decision),
    ).resolves.toMatchObject({ status: "ERROR" });

    expect(doubles.service.propose).not.toHaveBeenCalled();
    expect(doubles.service.decide).not.toHaveBeenCalled();
  });

  it("rejects duplicate, unexpected, and client-asserted governance fields", async () => {
    const duplicate = validProposal();
    duplicate.append("authorityKey", "BUSINESS_CONTACT_DETAILS");
    expect(
      (await createAuthorityProposalAction(initialState, duplicate)).status,
    ).toBe("ERROR");

    const asserted = validProposal();
    asserted.append("status", "APPROVED_FOR_PRODUCTION");
    asserted.append("approvedByProfileId", profileId);
    expect(
      (await createAuthorityProposalAction(initialState, asserted)).status,
    ).toBe("ERROR");
    expect(doubles.service.propose).not.toHaveBeenCalled();

    for (const [name, value] of [
      ["environmentScope", "PRODUCTION"],
      ["status", "APPROVED_FOR_PRODUCTION"],
      ["actorProfileId", profileId],
      ["approvedByProfileId", profileId],
    ] as const) {
      const transition = validDecision();
      transition.append(name, value);
      expect(
        (await transitionAuthorityAction(initialState, transition)).status,
      ).toBe("ERROR");
    }
    expect(doubles.service.decide).not.toHaveBeenCalled();

    const ambiguousDate = validProposal();
    ambiguousDate.set("effectiveFrom", "09/01/2026");
    expect(
      (await createAuthorityProposalAction(initialState, ambiguousDate)).status,
    ).toBe("ERROR");

    const oversized = validProposal();
    oversized.set("valueJson", " ".repeat(16_385));
    expect(
      (await createAuthorityProposalAction(initialState, oversized)).status,
    ).toBe("ERROR");
    expect(doubles.service.propose).not.toHaveBeenCalled();
  });

  it("passes only the record version and explicit decision to the service", async () => {
    await transitionAuthorityAction(initialState, validDecision());
    expect(doubles.service.decide).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      {
        recordId,
        expectedAuthorityVersion: 4,
        expectedRecordVersion: 2,
        expectedContentHash: "a".repeat(64),
        action: "APPROVE",
        decisionAuthorityType: "OWNER",
        evidenceReference: null,
        safeEvidenceSummary: "Owner approval recorded.",
      },
    );
  });

  it("rejects missing or malformed immutable approval target bindings", async () => {
    const missingVersion = validDecision();
    missingVersion.delete("expectedAuthorityVersion");
    const malformedHash = validDecision();
    malformedHash.set("expectedContentHash", "not-a-content-digest");

    for (const submitted of [missingVersion, malformedHash]) {
      await expect(
        transitionAuthorityAction(initialState, submitted),
      ).resolves.toMatchObject({ status: "ERROR" });
    }
    expect(doubles.service.decide).not.toHaveBeenCalled();
  });

  it("returns a localized safe denial without exposing policy details", async () => {
    doubles.service.decide.mockRejectedValueOnce(
      new BusinessAuthorityPolicyError("PERMISSION_DENIED"),
    );
    await expect(
      transitionAuthorityAction(initialState, validDecision()),
    ).resolves.toEqual({
      status: "ERROR",
      message: "This action is not permitted.",
    });
  });
});
