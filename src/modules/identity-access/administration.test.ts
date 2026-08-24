import { describe, expect, it } from "vitest";
import type { AccountStatus } from "./authorization";
import {
  createIdentityAdministrationService,
  deriveIdentityReconciliationStates,
  IdentityAdministrationError,
  type IdentityAdministrationActor,
  type IdentityAdministrationDetail,
  type IdentityAdministrationListPage,
  type IdentityAdministrationPersistenceResult,
  type IdentityAdministrationRepository,
  type IdentityAdministrationRoleMutationCommand,
  type IdentityAdministrationStatusMutationCommand,
  type IdentityAdministrationTarget,
  type IdentityAdministrationFailureCode,
} from "./administration";
import {
  rolePermissionMatrix,
  type ApplicationRoleCode,
} from "./policy";

const now = new Date("2026-08-24T09:00:00.000Z");
const recentAuthentication = new Date(now.getTime() - 60_000);

function actor(
  role: ApplicationRoleCode | null,
  options: {
    profileId?: string;
    status?: AccountStatus;
    authenticatedAt?: Date | null;
    permissions?: IdentityAdministrationActor["permissions"];
  } = {},
): IdentityAdministrationActor {
  return {
    profileId: options.profileId ?? "actor-profile",
    status: options.status ?? "ACTIVE",
    roles: new Set(role ? [role] : []),
    permissions:
      options.permissions ?? new Set(role ? rolePermissionMatrix[role] : []),
    authenticatedAt:
      options.authenticatedAt === undefined
        ? recentAuthentication
        : options.authenticatedAt,
  };
}

const listPage: IdentityAdministrationListPage = {
  items: [],
  nextCursor: null,
};

const detail: IdentityAdministrationDetail = {
  profileId: "target-profile",
  displayName: "Synthetic Target",
  preferredLocale: "en",
  status: "ACTIVE",
  activeRoles: ["CUSTOMER"],
  createdAt: new Date("2026-08-20T09:00:00.000Z"),
  lastSafeActivityAt: null,
  phone: null,
  roleAssignments: [],
  auditEvents: [],
};

type FakeRepositoryOptions = {
  target?: IdentityAdministrationTarget | null;
  detail?: IdentityAdministrationDetail | null;
  inactiveRoles?: readonly ApplicationRoleCode[];
  activeOwnerCount?: number;
  roleResult?: IdentityAdministrationPersistenceResult;
  statusResult?: IdentityAdministrationPersistenceResult;
};

function fakeRepository(options: FakeRepositoryOptions = {}) {
  let target =
    options.target === undefined
      ? {
          profileId: "target-profile",
          status: "ACTIVE" as const,
          roles: new Set<ApplicationRoleCode>(["CUSTOMER"]),
        }
      : options.target;
  const roleCommands: {
    operation: "ASSIGN" | "REVOKE";
    command: IdentityAdministrationRoleMutationCommand;
  }[] = [];
  const statusCommands: IdentityAdministrationStatusMutationCommand[] = [];
  const listInputs: Parameters<IdentityAdministrationRepository["listIdentities"]>[0][] = [];

  const repository: IdentityAdministrationRepository = {
    async listIdentities(input) {
      listInputs.push(input);
      return listPage;
    },
    async getIdentityDetail() {
      return options.detail === undefined ? detail : options.detail;
    },
    async getMutationTarget() {
      return target;
    },
    async getRoleActivation(roleCode) {
      return !(options.inactiveRoles ?? []).includes(roleCode);
    },
    async countActiveOwners() {
      return options.activeOwnerCount ?? 2;
    },
    async assignRoleAndAudit(command) {
      roleCommands.push({ operation: "ASSIGN", command });
      const result = options.roleResult ?? "CHANGED";
      if (result === "CHANGED" && target) {
        target = { ...target, roles: new Set([...target.roles, command.roleCode]) };
      }
      return result;
    },
    async revokeRoleAndAudit(command) {
      roleCommands.push({ operation: "REVOKE", command });
      const result = options.roleResult ?? "CHANGED";
      if (result === "CHANGED" && target) {
        const roles = new Set(target.roles);
        roles.delete(command.roleCode);
        target = { ...target, roles };
      }
      return result;
    },
    async changeStatusAndAudit(command) {
      statusCommands.push(command);
      const result = options.statusResult ?? "CHANGED";
      if (result === "CHANGED" && target) {
        target = { ...target, status: command.newStatus };
      }
      return result;
    },
  };

  return { repository, roleCommands, statusCommands, listInputs };
}

function service(repository: IdentityAdministrationRepository) {
  return createIdentityAdministrationService({
    repository,
    now: () => now,
  });
}

async function expectFailure(
  promise: Promise<unknown>,
  code: IdentityAdministrationFailureCode,
): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    name: "IdentityAdministrationError",
    code,
  });
}

describe("identity administration reads", () => {
  it("authorizes and normalizes a pagination-ready user list", async () => {
    const fake = fakeRepository();
    const result = await service(fake.repository).listIdentities(actor("ADMIN"), {
      status: "SUSPENDED",
      roleCode: "TECHNICIAN",
      search: "  Synthetic  ",
      cursor: "  next-page  ",
      limit: 40,
    });

    expect(result).toBe(listPage);
    expect(fake.listInputs).toEqual([
      {
        status: "SUSPENDED",
        roleCode: "TECHNICIAN",
        search: "Synthetic",
        cursor: "next-page",
        limit: 40,
      },
    ]);
  });

  it("requires authentication, an active role, and read permission", async () => {
    const administration = service(fakeRepository().repository);

    await expectFailure(
      administration.listIdentities(null),
      "AUTHENTICATION_REQUIRED",
    );
    await expectFailure(
      administration.listIdentities(actor(null)),
      "ACCOUNT_UNAVAILABLE",
    );
    await expectFailure(
      administration.listIdentities(actor("CUSTOMER")),
      "PERMISSION_DENIED",
    );
  });

  it.each(["SUSPENDED", "DISABLED"] as const)(
    "denies a %s administrative actor",
    async (status) => {
      await expectFailure(
        service(fakeRepository().repository).listIdentities(
          actor("OWNER", { status }),
        ),
        "ACCOUNT_UNAVAILABLE",
      );
    },
  );

  it("requires audit-read authority for identity detail", async () => {
    const administration = service(fakeRepository().repository);
    const userManagerWithoutAudit = actor("ADMIN", {
      permissions: new Set(["USER_ADMIN_READ"]),
    });

    await expectFailure(
      administration.getIdentityDetail(userManagerWithoutAudit, {
        profileId: "target-profile",
      }),
      "PERMISSION_DENIED",
    );
    await expect(
      administration.getIdentityDetail(actor("OWNER"), {
        profileId: "target-profile",
      }),
    ).resolves.toBe(detail);
  });

  it("rejects invalid list and detail input before repository access", async () => {
    const administration = service(fakeRepository().repository);

    await expectFailure(
      administration.listIdentities(actor("ADMIN"), { roleCode: "ROOT" }),
      "INVALID_ROLE",
    );
    await expectFailure(
      administration.listIdentities(actor("ADMIN"), { status: "DELETED" }),
      "INVALID_STATUS",
    );
    await expectFailure(
      administration.listIdentities(actor("ADMIN"), { limit: 101 }),
      "INVALID_REQUEST",
    );
    await expectFailure(
      administration.getIdentityDetail(actor("OWNER"), { profileId: " " }),
      "INVALID_REQUEST",
    );
  });

  it("returns a bounded missing-target result", async () => {
    const administration = service(
      fakeRepository({ detail: null }).repository,
    );
    await expectFailure(
      administration.getIdentityDetail(actor("OWNER"), {
        profileId: "missing-profile",
      }),
      "TARGET_NOT_FOUND",
    );
  });
});

describe("identity administration role policy", () => {
  it("lets an owner assign a protected role with a fresh session and atomic audit command", async () => {
    const fake = fakeRepository();
    const result = await service(fake.repository).assignRole(actor("OWNER"), {
      targetProfileId: "target-profile",
      roleCode: "ADMIN",
    });

    expect(result).toEqual({ status: "CHANGED" });
    expect(fake.roleCommands).toEqual([
      {
        operation: "ASSIGN",
        command: expect.objectContaining({
          actorProfileId: "actor-profile",
          targetProfileId: "target-profile",
          roleCode: "ADMIN",
          protectLastActiveOwner: false,
          audit: {
            eventType: "ROLE_ASSIGNED",
            outcome: "SUCCESS",
            actorProfileId: "actor-profile",
            subjectProfileId: "target-profile",
            safeMetadata: {
              source: "PRIVILEGED_ADMINISTRATION",
              roleCode: "ADMIN",
            },
          },
        }),
      },
    ]);
  });

  it.each(["DISPATCHER", "TECHNICIAN", "CUSTOMER"] as const)(
    "lets ADMIN assign the approved %s role",
    async (roleCode) => {
      const fake = fakeRepository({
        target: {
          profileId: "target-profile",
          status: "ACTIVE",
          roles: new Set(roleCode === "CUSTOMER" ? ["DISPATCHER"] : ["CUSTOMER"]),
        },
      });
      await expect(
        service(fake.repository).assignRole(actor("ADMIN"), {
          targetProfileId: "target-profile",
          roleCode,
        }),
      ).resolves.toEqual({ status: "CHANGED" });
    },
  );

  it.each(["OWNER", "ADMIN"] as const)(
    "denies ADMIN assignment of the protected %s role",
    async (roleCode) => {
      await expectFailure(
        service(fakeRepository().repository).assignRole(actor("ADMIN"), {
          targetProfileId: "target-profile",
          roleCode,
        }),
        "PERMISSION_DENIED",
      );
    },
  );

  it.each(["OWNER", "ADMIN"] as const)(
    "prevents ADMIN from mutating a target that already has %s",
    async (targetRole) => {
      const fake = fakeRepository({
        target: {
          profileId: "target-profile",
          status: "ACTIVE",
          roles: new Set([targetRole]),
        },
      });
      await expectFailure(
        service(fake.repository).assignRole(actor("ADMIN"), {
          targetProfileId: "target-profile",
          roleCode: "DISPATCHER",
        }),
        "PERMISSION_DENIED",
      );
    },
  );

  it.each(["DISPATCHER", "TECHNICIAN", "CUSTOMER"] as const)(
    "denies the non-administrative %s role",
    async (role) => {
      await expectFailure(
        service(fakeRepository().repository).assignRole(actor(role), {
          targetProfileId: "target-profile",
          roleCode: "DISPATCHER",
        }),
        "PERMISSION_DENIED",
      );
    },
  );

  it("denies missing role permission even when an OWNER role is supplied", async () => {
    await expectFailure(
      service(fakeRepository().repository).assignRole(
        actor("OWNER", { permissions: new Set(["USER_ADMIN_MANAGE"]) }),
        { targetProfileId: "target-profile", roleCode: "DISPATCHER" },
      ),
      "PERMISSION_DENIED",
    );
  });

  it("distinguishes invalid and inactive roles", async () => {
    await expectFailure(
      service(fakeRepository().repository).assignRole(actor("OWNER"), {
        targetProfileId: "target-profile",
        roleCode: "ROOT",
      }),
      "INVALID_ROLE",
    );
    await expectFailure(
      service(fakeRepository({ inactiveRoles: ["DISPATCHER"] }).repository).assignRole(
        actor("OWNER"),
        { targetProfileId: "target-profile", roleCode: "DISPATCHER" },
      ),
      "ROLE_INACTIVE",
    );
  });

  it("makes duplicate assignment and repeated revocation safe no-ops without audit writes", async () => {
    const assigned = fakeRepository();
    await expect(
      service(assigned.repository).assignRole(actor("ADMIN"), {
        targetProfileId: "target-profile",
        roleCode: "CUSTOMER",
      }),
    ).resolves.toEqual({ status: "NO_CHANGE" });
    expect(assigned.roleCommands).toHaveLength(0);

    const absent = fakeRepository();
    await expect(
      service(absent.repository).revokeRole(actor("ADMIN"), {
        targetProfileId: "target-profile",
        roleCode: "TECHNICIAN",
      }),
    ).resolves.toEqual({ status: "NO_CHANGE" });
    expect(absent.roleCommands).toHaveLength(0);
  });

  it("revokes an assignment through an append-oriented audit command", async () => {
    const fake = fakeRepository({
      target: {
        profileId: "target-profile",
        status: "ACTIVE",
        roles: new Set(["TECHNICIAN"]),
      },
    });
    await expect(
      service(fake.repository).revokeRole(actor("ADMIN"), {
        targetProfileId: "target-profile",
        roleCode: "TECHNICIAN",
      }),
    ).resolves.toEqual({ status: "CHANGED" });
    expect(fake.roleCommands[0]).toMatchObject({
      operation: "REVOKE",
      command: {
        audit: {
          eventType: "ROLE_REMOVED",
          outcome: "SUCCESS",
          safeMetadata: { roleCode: "TECHNICIAN" },
        },
      },
    });
  });

  it("blocks privileged self-role changes", async () => {
    const fake = fakeRepository({
      target: {
        profileId: "actor-profile",
        status: "ACTIVE",
        roles: new Set(["OWNER"]),
      },
    });
    await expectFailure(
      service(fake.repository).revokeRole(actor("OWNER"), {
        targetProfileId: "actor-profile",
        roleCode: "OWNER",
      }),
      "SELF_ACTION_FORBIDDEN",
    );
  });

  it("requires recent authentication for OWNER and ADMIN role changes", async () => {
    const staleActor = actor("OWNER", {
      authenticatedAt: new Date(now.getTime() - 300_000),
    });
    const cases = [
      { operation: "ASSIGN", roleCode: "OWNER" },
      { operation: "ASSIGN", roleCode: "ADMIN" },
      { operation: "REVOKE", roleCode: "OWNER" },
      { operation: "REVOKE", roleCode: "ADMIN" },
    ] as const;

    for (const testCase of cases) {
      const targetRoles =
        testCase.operation === "REVOKE"
          ? new Set<ApplicationRoleCode>([testCase.roleCode])
          : new Set<ApplicationRoleCode>(["CUSTOMER"]);
      const administration = service(
        fakeRepository({
          target: {
            profileId: "target-profile",
            status: "ACTIVE",
            roles: targetRoles,
          },
        }).repository,
      );
      const mutation =
        testCase.operation === "ASSIGN"
          ? administration.assignRole(staleActor, {
              targetProfileId: "target-profile",
              roleCode: testCase.roleCode,
            })
          : administration.revokeRole(staleActor, {
              targetProfileId: "target-profile",
              roleCode: testCase.roleCode,
            });

      await expectFailure(mutation, "RECENT_AUTHENTICATION_REQUIRED");
    }

    await expectFailure(
      service(fakeRepository().repository).assignRole(
        actor("OWNER", { authenticatedAt: null }),
        { targetProfileId: "target-profile", roleCode: "ADMIN" },
      ),
      "RECENT_AUTHENTICATION_REQUIRED",
    );
  });

  it("rejects removing the last active OWNER before any mutation or audit write", async () => {
    const fake = fakeRepository({
      target: {
        profileId: "target-profile",
        status: "ACTIVE",
        roles: new Set(["OWNER"]),
      },
      activeOwnerCount: 1,
    });

    await expectFailure(
      service(fake.repository).revokeRole(actor("OWNER"), {
        targetProfileId: "target-profile",
        roleCode: "OWNER",
      }),
      "LAST_ACTIVE_OWNER",
    );
    expect(fake.roleCommands).toHaveLength(0);
  });

  it("fails closed when the authoritative repository detects a last-owner race", async () => {
    const fake = fakeRepository({
      target: {
        profileId: "target-profile",
        status: "ACTIVE",
        roles: new Set(["OWNER"]),
      },
      activeOwnerCount: 2,
      roleResult: "LAST_ACTIVE_OWNER",
    });
    await expectFailure(
      service(fake.repository).revokeRole(actor("OWNER"), {
        targetProfileId: "target-profile",
        roleCode: "OWNER",
      }),
      "LAST_ACTIVE_OWNER",
    );
    expect(fake.roleCommands[0]?.command.protectLastActiveOwner).toBe(true);
  });
});

describe("identity administration status policy", () => {
  it("changes status with previous/new state in the atomic audit command", async () => {
    const fake = fakeRepository();
    await expect(
      service(fake.repository).changeStatus(actor("ADMIN"), {
        targetProfileId: "target-profile",
        status: "SUSPENDED",
      }),
    ).resolves.toEqual({ status: "CHANGED" });
    expect(fake.statusCommands).toEqual([
      expect.objectContaining({
        previousStatus: "ACTIVE",
        newStatus: "SUSPENDED",
        audit: {
          eventType: "ACCOUNT_STATUS_CHANGED",
          outcome: "SUCCESS",
          actorProfileId: "actor-profile",
          subjectProfileId: "target-profile",
          safeMetadata: {
            source: "PRIVILEGED_ADMINISTRATION",
            previousStatus: "ACTIVE",
            newStatus: "SUSPENDED",
          },
        },
      }),
    ]);
  });

  it("requires recent authentication only for an actual DISABLED transition", async () => {
    const staleActor = actor("ADMIN", {
      authenticatedAt: new Date(now.getTime() - 300_000),
    });
    await expectFailure(
      service(fakeRepository().repository).changeStatus(staleActor, {
        targetProfileId: "target-profile",
        status: "DISABLED",
      }),
      "RECENT_AUTHENTICATION_REQUIRED",
    );

    await expect(
      service(fakeRepository().repository).changeStatus(staleActor, {
        targetProfileId: "target-profile",
        status: "SUSPENDED",
      }),
    ).resolves.toEqual({ status: "CHANGED" });

    const alreadyDisabled = fakeRepository({
      target: {
        profileId: "target-profile",
        status: "DISABLED",
        roles: new Set(["CUSTOMER"]),
      },
    });
    await expect(
      service(alreadyDisabled.repository).changeStatus(staleActor, {
        targetProfileId: "target-profile",
        status: "DISABLED",
      }),
    ).resolves.toEqual({ status: "NO_CHANGE" });
    expect(alreadyDisabled.statusCommands).toHaveLength(0);
  });

  it("prevents ADMIN status changes to OWNER or ADMIN targets", async () => {
    for (const protectedRole of ["OWNER", "ADMIN"] as const) {
      await expectFailure(
        service(
          fakeRepository({
            target: {
              profileId: "target-profile",
              status: "ACTIVE",
              roles: new Set([protectedRole]),
            },
          }).repository,
        ).changeStatus(actor("ADMIN"), {
          targetProfileId: "target-profile",
          status: "SUSPENDED",
        }),
        "PERMISSION_DENIED",
      );
    }
  });

  it("protects the last active owner at the repository boundary", async () => {
    const fake = fakeRepository({
      target: {
        profileId: "target-profile",
        status: "ACTIVE",
        roles: new Set(["OWNER"]),
      },
      activeOwnerCount: 2,
      statusResult: "LAST_ACTIVE_OWNER",
    });
    await expectFailure(
      service(fake.repository).changeStatus(actor("OWNER"), {
        targetProfileId: "target-profile",
        status: "SUSPENDED",
      }),
      "LAST_ACTIVE_OWNER",
    );
    expect(fake.statusCommands[0]?.protectLastActiveOwner).toBe(true);
  });

  it("rejects blocking the last active OWNER before any mutation or audit write", async () => {
    const fake = fakeRepository({
      target: {
        profileId: "target-profile",
        status: "ACTIVE",
        roles: new Set(["OWNER"]),
      },
      activeOwnerCount: 1,
    });

    await expectFailure(
      service(fake.repository).changeStatus(actor("OWNER"), {
        targetProfileId: "target-profile",
        status: "SUSPENDED",
      }),
      "LAST_ACTIVE_OWNER",
    );
    expect(fake.statusCommands).toHaveLength(0);
  });

  it("blocks self-disable and invalid status input", async () => {
    const self = fakeRepository({
      target: {
        profileId: "actor-profile",
        status: "ACTIVE",
        roles: new Set(["OWNER"]),
      },
    });
    await expectFailure(
      service(self.repository).changeStatus(actor("OWNER"), {
        targetProfileId: "actor-profile",
        status: "DISABLED",
      }),
      "SELF_ACTION_FORBIDDEN",
    );
    await expectFailure(
      service(fakeRepository().repository).changeStatus(actor("OWNER"), {
        targetProfileId: "target-profile",
        status: "DELETED",
      }),
      "INVALID_STATUS",
    );
  });
});

describe("identity reconciliation", () => {
  it("derives aligned and empty states without inventing provider facts", () => {
    expect(
      deriveIdentityReconciliationStates({
        providerIdentityState: "PRESENT",
        applicationProfile: { status: "ACTIVE", activeRoleCount: 1 },
        activeProviderSessionCount: 1,
      }),
    ).toEqual(["ALIGNED"]);
    expect(
      deriveIdentityReconciliationStates({
        providerIdentityState: "MISSING",
        applicationProfile: null,
        activeProviderSessionCount: 0,
      }),
    ).toEqual(["NO_IDENTITY_RECORD"]);
  });

  it("reports provider/profile orphan states without automatic repair", () => {
    expect(
      deriveIdentityReconciliationStates({
        providerIdentityState: "PRESENT",
        applicationProfile: null,
        activeProviderSessionCount: 0,
      }),
    ).toEqual(["PROVIDER_IDENTITY_WITHOUT_PROFILE"]);
    expect(
      deriveIdentityReconciliationStates({
        providerIdentityState: "MISSING",
        applicationProfile: { status: "ACTIVE", activeRoleCount: 1 },
        activeProviderSessionCount: 0,
      }),
    ).toEqual(["PROFILE_WITHOUT_PROVIDER_IDENTITY"]);
  });

  it("can report multiple application discrepancies independently", () => {
    expect(
      deriveIdentityReconciliationStates({
        providerIdentityState: "MISSING",
        applicationProfile: { status: "SUSPENDED", activeRoleCount: 0 },
        activeProviderSessionCount: 2,
      }),
    ).toEqual([
      "PROFILE_WITHOUT_PROVIDER_IDENTITY",
      "PROFILE_WITHOUT_ACTIVE_ROLE",
      "BLOCKED_PROFILE_WITH_ACTIVE_SESSIONS",
    ]);
  });

  it("keeps provider outages distinct from a missing provider identity", () => {
    expect(
      deriveIdentityReconciliationStates({
        providerIdentityState: "UNKNOWN",
        applicationProfile: { status: "ACTIVE", activeRoleCount: 1 },
        activeProviderSessionCount: null,
      }),
    ).toEqual(["PROVIDER_STATE_UNKNOWN"]);
  });
});

describe("identity administration failure hygiene", () => {
  it("uses a stable bounded error object", () => {
    const error = new IdentityAdministrationError("OPERATION_FAILED");
    expect(error.message).toBe("OPERATION_FAILED");
    expect(error).not.toHaveProperty("cause");
  });
});
