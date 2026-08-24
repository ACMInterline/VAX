import type { AccountStatus } from "./authorization";
import {
  applicationRoleCodes,
  canAssignRole,
  permissionCodes,
  type ApplicationRoleCode,
  type PermissionCode,
} from "./policy";

export const identityAdministrationPageSize = {
  default: 25,
  maximum: 100,
} as const;

export const recentAuthenticationMaximumAgeMs = 5 * 60 * 1000;

export type IdentityAdministrationActor = {
  profileId: string;
  status: AccountStatus;
  roles: ReadonlySet<ApplicationRoleCode>;
  permissions: ReadonlySet<PermissionCode>;
  authenticatedAt: Date | null;
};

export type IdentityAdministrationTarget = {
  profileId: string;
  status: AccountStatus;
  roles: ReadonlySet<ApplicationRoleCode>;
};

export type IdentityAdministrationListInput = {
  status?: string;
  roleCode?: string;
  search?: string;
  cursor?: string;
  limit?: number;
};

export type NormalizedIdentityAdministrationListInput = {
  status?: AccountStatus;
  roleCode?: ApplicationRoleCode;
  search?: string;
  cursor?: string;
  limit: number;
};

export type IdentityAdministrationListItem = {
  profileId: string;
  displayName: string;
  preferredLocale: "bg" | "en";
  status: AccountStatus;
  activeRoles: readonly ApplicationRoleCode[];
  createdAt: Date;
  lastSafeActivityAt: Date | null;
};

export type IdentityAdministrationListPage = {
  items: readonly IdentityAdministrationListItem[];
  nextCursor: string | null;
};

export type IdentityAdministrationRoleAssignment = {
  roleCode: ApplicationRoleCode;
  active: boolean;
  assignedAt: Date;
  revokedAt: Date | null;
};

export type IdentityAdministrationAuditRecord = {
  eventType: string;
  outcome: "SUCCESS" | "FAILURE" | "DENIED";
  occurredAt: Date;
  safeMetadata: Readonly<Record<string, string>>;
};

export type IdentityAdministrationDetail = IdentityAdministrationListItem & {
  phone: string | null;
  roleAssignments: readonly IdentityAdministrationRoleAssignment[];
  auditEvents: readonly IdentityAdministrationAuditRecord[];
};

export type IdentityAdministrationAuditEvent = {
  eventType: "ROLE_ASSIGNED" | "ROLE_REMOVED" | "ACCOUNT_STATUS_CHANGED";
  outcome: "SUCCESS";
  actorProfileId: string;
  subjectProfileId: string;
  safeMetadata: Readonly<{
    source: "PRIVILEGED_ADMINISTRATION";
    roleCode?: ApplicationRoleCode;
    previousStatus?: AccountStatus;
    newStatus?: AccountStatus;
  }>;
};

export type IdentityAdministrationRoleMutationCommand = {
  actorProfileId: string;
  targetProfileId: string;
  roleCode: ApplicationRoleCode;
  protectLastActiveOwner: boolean;
  audit: IdentityAdministrationAuditEvent;
};

export type IdentityAdministrationStatusMutationCommand = {
  actorProfileId: string;
  targetProfileId: string;
  previousStatus: AccountStatus;
  newStatus: AccountStatus;
  protectLastActiveOwner: boolean;
  audit: IdentityAdministrationAuditEvent;
};

export type IdentityAdministrationPersistenceResult =
  | "CHANGED"
  | "NO_CHANGE"
  | "ACTOR_UNAVAILABLE"
  | "TARGET_NOT_FOUND"
  | "ROLE_INACTIVE"
  | "PERMISSION_DENIED"
  | "LAST_ACTIVE_OWNER";

/**
 * Mutation implementations must revalidate actor, target, role activation and
 * last-owner protection inside the same transaction that writes the audit row.
 * The service checks them first for deterministic policy responses, but those
 * reads are not a substitute for the repository's transaction boundary.
 */
export interface IdentityAdministrationRepository {
  listIdentities(
    input: NormalizedIdentityAdministrationListInput,
  ): Promise<IdentityAdministrationListPage>;
  getIdentityDetail(profileId: string): Promise<IdentityAdministrationDetail | null>;
  getMutationTarget(profileId: string): Promise<IdentityAdministrationTarget | null>;
  getRoleActivation(roleCode: ApplicationRoleCode): Promise<boolean>;
  countActiveOwners(): Promise<number>;
  assignRoleAndAudit(
    command: IdentityAdministrationRoleMutationCommand,
  ): Promise<IdentityAdministrationPersistenceResult>;
  revokeRoleAndAudit(
    command: IdentityAdministrationRoleMutationCommand,
  ): Promise<IdentityAdministrationPersistenceResult>;
  changeStatusAndAudit(
    command: IdentityAdministrationStatusMutationCommand,
  ): Promise<IdentityAdministrationPersistenceResult>;
}

export type IdentityAdministrationFailureCode =
  | "AUTHENTICATION_REQUIRED"
  | "ACCOUNT_UNAVAILABLE"
  | "PERMISSION_DENIED"
  | "INVALID_REQUEST"
  | "INVALID_ROLE"
  | "ROLE_INACTIVE"
  | "INVALID_STATUS"
  | "TARGET_NOT_FOUND"
  | "SELF_ACTION_FORBIDDEN"
  | "RECENT_AUTHENTICATION_REQUIRED"
  | "LAST_ACTIVE_OWNER"
  | "OPERATION_FAILED";

export class IdentityAdministrationError extends Error {
  readonly code: IdentityAdministrationFailureCode;

  constructor(code: IdentityAdministrationFailureCode) {
    super(code);
    this.name = "IdentityAdministrationError";
    this.code = code;
  }
}

export type IdentityAdministrationMutationResult = {
  status: "CHANGED" | "NO_CHANGE";
};

export type IdentityReconciliationState =
  | "ALIGNED"
  | "NO_IDENTITY_RECORD"
  | "PROVIDER_IDENTITY_WITHOUT_PROFILE"
  | "PROFILE_WITHOUT_PROVIDER_IDENTITY"
  | "PROFILE_WITHOUT_ACTIVE_ROLE"
  | "BLOCKED_PROFILE_WITH_ACTIVE_SESSIONS"
  | "PROVIDER_STATE_UNKNOWN";

export type IdentityReconciliationInput = {
  providerIdentityState: "PRESENT" | "MISSING" | "UNKNOWN";
  applicationProfile: {
    status: AccountStatus;
    activeRoleCount: number;
  } | null;
  activeProviderSessionCount: number | null;
};

export function deriveIdentityReconciliationStates(
  input: IdentityReconciliationInput,
): readonly IdentityReconciliationState[] {
  const states: IdentityReconciliationState[] = [];

  if (input.providerIdentityState === "UNKNOWN") {
    states.push("PROVIDER_STATE_UNKNOWN");
  } else if (
    input.providerIdentityState === "PRESENT" &&
    input.applicationProfile === null
  ) {
    states.push("PROVIDER_IDENTITY_WITHOUT_PROFILE");
  } else if (
    input.providerIdentityState === "MISSING" &&
    input.applicationProfile !== null
  ) {
    states.push("PROFILE_WITHOUT_PROVIDER_IDENTITY");
  }

  if (input.applicationProfile?.activeRoleCount === 0) {
    states.push("PROFILE_WITHOUT_ACTIVE_ROLE");
  }

  if (
    input.applicationProfile !== null &&
    input.applicationProfile.status !== "ACTIVE" &&
    input.activeProviderSessionCount !== null &&
    input.activeProviderSessionCount > 0
  ) {
    states.push("BLOCKED_PROFILE_WITH_ACTIVE_SESSIONS");
  }

  if (
    states.length === 0 &&
    input.providerIdentityState === "MISSING" &&
    input.applicationProfile === null
  ) {
    return ["NO_IDENTITY_RECORD"];
  }

  return states.length === 0 ? ["ALIGNED"] : states;
}

export type IdentityAdministrationService = {
  listIdentities(
    actor: IdentityAdministrationActor | null,
    input?: IdentityAdministrationListInput,
  ): Promise<IdentityAdministrationListPage>;
  getIdentityDetail(
    actor: IdentityAdministrationActor | null,
    input: { profileId: string },
  ): Promise<IdentityAdministrationDetail>;
  assignRole(
    actor: IdentityAdministrationActor | null,
    input: { targetProfileId: string; roleCode: string },
  ): Promise<IdentityAdministrationMutationResult>;
  revokeRole(
    actor: IdentityAdministrationActor | null,
    input: { targetProfileId: string; roleCode: string },
  ): Promise<IdentityAdministrationMutationResult>;
  changeStatus(
    actor: IdentityAdministrationActor | null,
    input: { targetProfileId: string; status: string },
  ): Promise<IdentityAdministrationMutationResult>;
};

function isApplicationRoleCode(value: string): value is ApplicationRoleCode {
  return (applicationRoleCodes as readonly string[]).includes(value);
}

function isPermissionCode(value: string): value is PermissionCode {
  return (permissionCodes as readonly string[]).includes(value);
}

function isAccountStatus(value: string): value is AccountStatus {
  return value === "ACTIVE" || value === "SUSPENDED" || value === "DISABLED";
}

function requireActorPermissions(
  actor: IdentityAdministrationActor | null,
  requiredPermissions: readonly PermissionCode[],
): IdentityAdministrationActor {
  if (!actor) {
    throw new IdentityAdministrationError("AUTHENTICATION_REQUIRED");
  }
  if (actor.status !== "ACTIVE" || actor.roles.size === 0) {
    throw new IdentityAdministrationError("ACCOUNT_UNAVAILABLE");
  }
  if (
    requiredPermissions.some(
      (permission) => !isPermissionCode(permission) || !actor.permissions.has(permission),
    )
  ) {
    throw new IdentityAdministrationError("PERMISSION_DENIED");
  }
  return actor;
}

function normalizedProfileId(value: string): string {
  if (typeof value !== "string") {
    throw new IdentityAdministrationError("INVALID_REQUEST");
  }
  const profileId = value.trim();
  if (!profileId || profileId.length > 255) {
    throw new IdentityAdministrationError("INVALID_REQUEST");
  }
  return profileId;
}

function normalizedListInput(
  input: IdentityAdministrationListInput,
): NormalizedIdentityAdministrationListInput {
  const normalized: NormalizedIdentityAdministrationListInput = {
    limit: input.limit ?? identityAdministrationPageSize.default,
  };

  if (
    !Number.isInteger(normalized.limit) ||
    normalized.limit < 1 ||
    normalized.limit > identityAdministrationPageSize.maximum
  ) {
    throw new IdentityAdministrationError("INVALID_REQUEST");
  }

  if (input.status !== undefined) {
    if (!isAccountStatus(input.status)) {
      throw new IdentityAdministrationError("INVALID_STATUS");
    }
    normalized.status = input.status;
  }

  if (input.roleCode !== undefined) {
    if (!isApplicationRoleCode(input.roleCode)) {
      throw new IdentityAdministrationError("INVALID_ROLE");
    }
    normalized.roleCode = input.roleCode;
  }

  if (input.search !== undefined && typeof input.search !== "string") {
    throw new IdentityAdministrationError("INVALID_REQUEST");
  }
  const search = input.search?.trim();
  if (search) {
    if (search.length > 255) {
      throw new IdentityAdministrationError("INVALID_REQUEST");
    }
    normalized.search = search;
  }

  if (input.cursor !== undefined && typeof input.cursor !== "string") {
    throw new IdentityAdministrationError("INVALID_REQUEST");
  }
  const cursor = input.cursor?.trim();
  if (cursor) {
    if (cursor.length > 512) {
      throw new IdentityAdministrationError("INVALID_REQUEST");
    }
    normalized.cursor = cursor;
  }

  return normalized;
}

function actorCanManageTarget(
  actor: IdentityAdministrationActor,
  target: IdentityAdministrationTarget,
): boolean {
  if (actor.roles.has("OWNER")) {
    return true;
  }
  return (
    actor.roles.has("ADMIN") &&
    !target.roles.has("OWNER") &&
    !target.roles.has("ADMIN")
  );
}

function requireRecentAuthentication(
  actor: IdentityAdministrationActor,
  now: Date,
  maximumAgeMs: number,
): void {
  const authenticatedAt = actor.authenticatedAt;
  const authenticatedTime = authenticatedAt?.getTime() ?? Number.NaN;
  const age = now.getTime() - authenticatedTime;
  if (!Number.isFinite(age) || age < 0 || age >= maximumAgeMs) {
    throw new IdentityAdministrationError("RECENT_AUTHENTICATION_REQUIRED");
  }
}

function persistenceFailure(
  result: Exclude<IdentityAdministrationPersistenceResult, "CHANGED" | "NO_CHANGE">,
): IdentityAdministrationError {
  switch (result) {
    case "ACTOR_UNAVAILABLE":
      return new IdentityAdministrationError("ACCOUNT_UNAVAILABLE");
    case "TARGET_NOT_FOUND":
      return new IdentityAdministrationError("TARGET_NOT_FOUND");
    case "ROLE_INACTIVE":
      return new IdentityAdministrationError("ROLE_INACTIVE");
    case "PERMISSION_DENIED":
      return new IdentityAdministrationError("PERMISSION_DENIED");
    case "LAST_ACTIVE_OWNER":
      return new IdentityAdministrationError("LAST_ACTIVE_OWNER");
  }
}

export function createIdentityAdministrationService(input: {
  repository: IdentityAdministrationRepository;
  now?: () => Date;
  recentAuthenticationMaxAgeMs?: number;
}): IdentityAdministrationService {
  const repository = input.repository;
  const now = input.now ?? (() => new Date());
  const recentAuthenticationMaxAge =
    input.recentAuthenticationMaxAgeMs ?? recentAuthenticationMaximumAgeMs;

  if (
    !Number.isFinite(recentAuthenticationMaxAge) ||
    recentAuthenticationMaxAge <= 0
  ) {
    throw new IdentityAdministrationError("INVALID_REQUEST");
  }

  async function getTarget(profileId: string): Promise<IdentityAdministrationTarget> {
    try {
      const target = await repository.getMutationTarget(profileId);
      if (!target) {
        throw new IdentityAdministrationError("TARGET_NOT_FOUND");
      }
      return target;
    } catch (error) {
      if (error instanceof IdentityAdministrationError) {
        throw error;
      }
      throw new IdentityAdministrationError("OPERATION_FAILED");
    }
  }

  async function requireActiveRole(roleCode: ApplicationRoleCode): Promise<void> {
    try {
      if (!(await repository.getRoleActivation(roleCode))) {
        throw new IdentityAdministrationError("ROLE_INACTIVE");
      }
    } catch (error) {
      if (error instanceof IdentityAdministrationError) {
        throw error;
      }
      throw new IdentityAdministrationError("OPERATION_FAILED");
    }
  }

  async function persist(
    operation: () => Promise<IdentityAdministrationPersistenceResult>,
  ): Promise<IdentityAdministrationMutationResult> {
    let result: IdentityAdministrationPersistenceResult;
    try {
      result = await operation();
    } catch {
      throw new IdentityAdministrationError("OPERATION_FAILED");
    }
    if (result === "CHANGED" || result === "NO_CHANGE") {
      return { status: result };
    }
    throw persistenceFailure(result);
  }

  async function protectLastOwnerIfNeeded(
    target: IdentityAdministrationTarget,
  ): Promise<boolean> {
    if (target.status !== "ACTIVE" || !target.roles.has("OWNER")) {
      return false;
    }
    let activeOwnerCount: number;
    try {
      activeOwnerCount = await repository.countActiveOwners();
    } catch {
      throw new IdentityAdministrationError("OPERATION_FAILED");
    }
    if (activeOwnerCount <= 1) {
      throw new IdentityAdministrationError("LAST_ACTIVE_OWNER");
    }
    return true;
  }

  return {
    async listIdentities(actor, listInput = {}) {
      requireActorPermissions(actor, ["USER_ADMIN_READ"]);
      const normalized = normalizedListInput(listInput);
      try {
        return await repository.listIdentities(normalized);
      } catch {
        throw new IdentityAdministrationError("OPERATION_FAILED");
      }
    },

    async getIdentityDetail(actor, detailInput) {
      requireActorPermissions(actor, ["USER_ADMIN_READ", "AUDIT_READ"]);
      const profileId = normalizedProfileId(detailInput.profileId);
      try {
        const detail = await repository.getIdentityDetail(profileId);
        if (!detail) {
          throw new IdentityAdministrationError("TARGET_NOT_FOUND");
        }
        return detail;
      } catch (error) {
        if (error instanceof IdentityAdministrationError) {
          throw error;
        }
        throw new IdentityAdministrationError("OPERATION_FAILED");
      }
    },

    async assignRole(actorInput, roleInput) {
      const actor = requireActorPermissions(actorInput, [
        "USER_ADMIN_MANAGE",
        "ROLE_ASSIGN",
      ]);
      if (!isApplicationRoleCode(roleInput.roleCode)) {
        throw new IdentityAdministrationError("INVALID_ROLE");
      }
      const roleCode = roleInput.roleCode;
      await requireActiveRole(roleCode);
      const target = await getTarget(normalizedProfileId(roleInput.targetProfileId));
      if (actor.profileId === target.profileId) {
        throw new IdentityAdministrationError("SELF_ACTION_FORBIDDEN");
      }
      if (!actorCanManageTarget(actor, target) || !canAssignRole(actor.roles, roleCode)) {
        throw new IdentityAdministrationError("PERMISSION_DENIED");
      }
      if (target.roles.has(roleCode)) {
        return { status: "NO_CHANGE" };
      }
      if (roleCode === "OWNER" || roleCode === "ADMIN") {
        requireRecentAuthentication(actor, now(), recentAuthenticationMaxAge);
      }

      const audit: IdentityAdministrationAuditEvent = {
        eventType: "ROLE_ASSIGNED",
        outcome: "SUCCESS",
        actorProfileId: actor.profileId,
        subjectProfileId: target.profileId,
        safeMetadata: {
          source: "PRIVILEGED_ADMINISTRATION",
          roleCode,
        },
      };
      return persist(() =>
        repository.assignRoleAndAudit({
          actorProfileId: actor.profileId,
          targetProfileId: target.profileId,
          roleCode,
          protectLastActiveOwner: false,
          audit,
        }),
      );
    },

    async revokeRole(actorInput, roleInput) {
      const actor = requireActorPermissions(actorInput, [
        "USER_ADMIN_MANAGE",
        "ROLE_ASSIGN",
      ]);
      if (!isApplicationRoleCode(roleInput.roleCode)) {
        throw new IdentityAdministrationError("INVALID_ROLE");
      }
      const roleCode = roleInput.roleCode;
      await requireActiveRole(roleCode);
      const target = await getTarget(normalizedProfileId(roleInput.targetProfileId));
      if (actor.profileId === target.profileId) {
        throw new IdentityAdministrationError("SELF_ACTION_FORBIDDEN");
      }
      if (!actorCanManageTarget(actor, target) || !canAssignRole(actor.roles, roleCode)) {
        throw new IdentityAdministrationError("PERMISSION_DENIED");
      }
      if (!target.roles.has(roleCode)) {
        return { status: "NO_CHANGE" };
      }
      if (roleCode === "OWNER" || roleCode === "ADMIN") {
        requireRecentAuthentication(actor, now(), recentAuthenticationMaxAge);
      }
      const protectLastActiveOwner =
        roleCode === "OWNER" ? await protectLastOwnerIfNeeded(target) : false;

      const audit: IdentityAdministrationAuditEvent = {
        eventType: "ROLE_REMOVED",
        outcome: "SUCCESS",
        actorProfileId: actor.profileId,
        subjectProfileId: target.profileId,
        safeMetadata: {
          source: "PRIVILEGED_ADMINISTRATION",
          roleCode,
        },
      };
      return persist(() =>
        repository.revokeRoleAndAudit({
          actorProfileId: actor.profileId,
          targetProfileId: target.profileId,
          roleCode,
          protectLastActiveOwner,
          audit,
        }),
      );
    },

    async changeStatus(actorInput, statusInput) {
      const actor = requireActorPermissions(actorInput, ["USER_ADMIN_MANAGE"]);
      if (!isAccountStatus(statusInput.status)) {
        throw new IdentityAdministrationError("INVALID_STATUS");
      }
      const status = statusInput.status;
      const target = await getTarget(normalizedProfileId(statusInput.targetProfileId));
      if (actor.profileId === target.profileId) {
        throw new IdentityAdministrationError("SELF_ACTION_FORBIDDEN");
      }
      if (!actorCanManageTarget(actor, target)) {
        throw new IdentityAdministrationError("PERMISSION_DENIED");
      }
      if (target.status === status) {
        return { status: "NO_CHANGE" };
      }
      if (status === "DISABLED") {
        requireRecentAuthentication(actor, now(), recentAuthenticationMaxAge);
      }
      const protectLastActiveOwner =
        target.status === "ACTIVE" && status !== "ACTIVE"
          ? await protectLastOwnerIfNeeded(target)
          : false;

      const audit: IdentityAdministrationAuditEvent = {
        eventType: "ACCOUNT_STATUS_CHANGED",
        outcome: "SUCCESS",
        actorProfileId: actor.profileId,
        subjectProfileId: target.profileId,
        safeMetadata: {
          source: "PRIVILEGED_ADMINISTRATION",
          previousStatus: target.status,
          newStatus: status,
        },
      };
      return persist(() =>
        repository.changeStatusAndAudit({
          actorProfileId: actor.profileId,
          targetProfileId: target.profileId,
          previousStatus: target.status,
          newStatus: status,
          protectLastActiveOwner,
          audit,
        }),
      );
    },
  };
}
