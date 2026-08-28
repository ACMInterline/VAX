import "server-only";

import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  applicationRoles,
  authAuditEvents,
  permissions,
  rolePermissions,
  userProfiles,
  userRoles,
} from "@/db/schema/identity-access";
import type { AccountStatus } from "./authorization";
import type {
  IdentityAdministrationDetail,
  IdentityAdministrationListPage,
  IdentityAdministrationPersistenceResult,
  IdentityAdministrationRepository,
  IdentityAdministrationTarget,
  NormalizedIdentityAdministrationListInput,
} from "./administration";
import {
  applicationRoleCodes,
  type ApplicationRoleCode,
} from "./policy";

export const adminUserPageSizes = [10, 20, 50] as const;
export type AdminUserPageSize = (typeof adminUserPageSizes)[number];

export type AdminUserListInput = {
  page: number;
  pageSize: AdminUserPageSize;
  query?: string;
  role?: ApplicationRoleCode;
  status?: AccountStatus;
};

export type AdminUserSummary = {
  id: string;
  displayName: string;
  preferredLocale: "bg" | "en";
  status: AccountStatus;
  createdAt: Date;
  lastSafeActivityAt: Date | null;
  roles: readonly ApplicationRoleCode[];
};

export type AdminUserPage = {
  items: readonly AdminUserSummary[];
  page: number;
  pageSize: AdminUserPageSize;
  total: number;
};

export type AdminRoleAssignment = {
  role: ApplicationRoleCode;
  labelBg: string;
  labelEn: string;
  active: boolean;
  assignedAt: Date;
  revokedAt: Date | null;
};

export type SafeAdminAuditMetadata = {
  reasonCode?: string;
  roleCode?: ApplicationRoleCode;
  previousStatus?: AccountStatus;
  newStatus?: AccountStatus;
  source?: "PRIVILEGED_ADMINISTRATION";
};

export type AdminAuditEvent = {
  id: string;
  eventType: string;
  outcome: "SUCCESS" | "FAILURE" | "DENIED";
  occurredAt: Date;
  safeMetadata: SafeAdminAuditMetadata;
};

export type AdminUserDetail = AdminUserSummary & {
  phone: string | null;
  roleAssignments: readonly AdminRoleAssignment[];
  auditEvents: readonly AdminAuditEvent[];
};

export type InternalAdminUserDetail = {
  user: AdminUserDetail;
  providerUserId: string;
};

export type AdminMutationResult =
  | "CHANGED"
  | "NO_CHANGE"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "LAST_OWNER_PROTECTED";

type MutationRow = { result: AdminMutationResult };

async function executeLockedAdminMutation(
  database: Database,
  mutation: ReturnType<typeof sql>,
): Promise<AdminMutationResult> {
  // READ COMMITTED takes a new snapshot for each statement. Acquiring the lock
  // first ensures every authoritative check in the mutation sees changes made
  // by a transaction that held this lock before us.
  const [, , result] = await database.batch([
    database.execute(sql`set transaction isolation level read committed`),
    database.execute(
      sql`select pg_advisory_xact_lock(hashtext('vax-identity-administration'))`,
    ),
    database.execute<MutationRow>(mutation),
  ]);

  return result.rows[0]?.result ?? "FORBIDDEN";
}

function asLocale(value: string): "bg" | "en" {
  return value === "en" ? "en" : "bg";
}

function asStatus(value: string): AccountStatus {
  if (value === "ACTIVE" || value === "SUSPENDED" || value === "DISABLED") {
    return value;
  }
  return "DISABLED";
}

function asRole(value: string): ApplicationRoleCode | null {
  return (applicationRoleCodes as readonly string[]).includes(value)
    ? (value as ApplicationRoleCode)
    : null;
}

function asOutcome(value: string): AdminAuditEvent["outcome"] {
  if (value === "SUCCESS" || value === "FAILURE" || value === "DENIED") {
    return value;
  }
  return "DENIED";
}

function safeMetadata(value: unknown): SafeAdminAuditMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const metadata: SafeAdminAuditMetadata = {};
  if (typeof record.reasonCode === "string") {
    metadata.reasonCode = record.reasonCode.slice(0, 96);
  }
  if (typeof record.roleCode === "string") {
    const role = asRole(record.roleCode);
    if (role) metadata.roleCode = role;
  }
  if (typeof record.previousStatus === "string") {
    metadata.previousStatus = asStatus(record.previousStatus);
  }
  if (typeof record.newStatus === "string") {
    metadata.newStatus = asStatus(record.newStatus);
  }
  if (record.source === "PRIVILEGED_ADMINISTRATION") {
    metadata.source = "PRIVILEGED_ADMINISTRATION";
  }
  return metadata;
}

export async function listAdminUsers(
  database: Database,
  input: AdminUserListInput,
): Promise<AdminUserPage> {
  const query = input.query?.trim().slice(0, 160);
  const conditions = [
    input.status ? eq(userProfiles.status, input.status) : undefined,
    query
      ? or(
          ilike(userProfiles.displayName, `%${query}%`),
          sql`${userProfiles.id}::text = ${query}`,
        )
      : undefined,
    input.role
      ? sql`exists (
          select 1
          from ${userRoles} filtered_assignment
          inner join ${applicationRoles} filtered_role
            on filtered_role.id = filtered_assignment.role_id
          where filtered_assignment.user_profile_id = ${userProfiles.id}
            and filtered_assignment.active = true
            and filtered_role.active = true
            and filtered_role.code = ${input.role}
        )`
      : undefined,
  ].filter((condition) => condition !== undefined);
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (input.page - 1) * input.pageSize;

  const [[totalRow], profileRows] = await Promise.all([
    database.select({ value: count() }).from(userProfiles).where(where),
    database
      .select({
        id: userProfiles.id,
        displayName: userProfiles.displayName,
        preferredLocale: userProfiles.preferredLocale,
        status: userProfiles.status,
        createdAt: userProfiles.createdAt,
        lastSafeActivityAt: sql<Date | null>`(
          select max(event.occurred_at)
          from ${authAuditEvents} event
          where event.subject_profile_id = ${userProfiles.id}
             or event.actor_profile_id = ${userProfiles.id}
        )`,
      })
      .from(userProfiles)
      .where(where)
      .orderBy(desc(userProfiles.createdAt), userProfiles.id)
      .limit(input.pageSize)
      .offset(offset),
  ]);

  const roleRows =
    profileRows.length === 0
      ? []
      : await database
          .select({
            profileId: userRoles.userProfileId,
            role: applicationRoles.code,
          })
          .from(userRoles)
          .innerJoin(applicationRoles, eq(userRoles.roleId, applicationRoles.id))
          .where(
            and(
              inArray(
                userRoles.userProfileId,
                profileRows.map((profile) => profile.id),
              ),
              eq(userRoles.active, true),
              eq(applicationRoles.active, true),
            ),
          );

  const rolesByProfile = new Map<string, ApplicationRoleCode[]>();
  for (const row of roleRows) {
    const role = asRole(row.role);
    if (!role) continue;
    const roles = rolesByProfile.get(row.profileId) ?? [];
    roles.push(role);
    rolesByProfile.set(row.profileId, roles);
  }

  return {
    items: profileRows.map((profile) => ({
      ...profile,
      preferredLocale: asLocale(profile.preferredLocale),
      status: asStatus(profile.status),
      roles: rolesByProfile.get(profile.id) ?? [],
    })),
    page: input.page,
    pageSize: input.pageSize,
    total: Number(totalRow?.value ?? 0),
  };
}

export async function loadAdminUserDetail(
  database: Database,
  profileId: string,
): Promise<InternalAdminUserDetail | null> {
  const [profile] = await database
    .select({
      id: userProfiles.id,
      providerUserId: userProfiles.authProviderUserId,
      displayName: userProfiles.displayName,
      preferredLocale: userProfiles.preferredLocale,
      phone: userProfiles.phone,
      status: userProfiles.status,
      createdAt: userProfiles.createdAt,
    })
    .from(userProfiles)
    .where(eq(userProfiles.id, profileId))
    .limit(1);

  if (!profile) return null;

  const [assignmentRows, eventRows] = await Promise.all([
    database
      .select({
        role: applicationRoles.code,
        labelBg: applicationRoles.labelBg,
        labelEn: applicationRoles.labelEn,
        active: userRoles.active,
        assignedAt: userRoles.assignedAt,
        revokedAt: userRoles.revokedAt,
      })
      .from(userRoles)
      .innerJoin(applicationRoles, eq(userRoles.roleId, applicationRoles.id))
      .where(eq(userRoles.userProfileId, profileId))
      .orderBy(desc(userRoles.active), applicationRoles.code),
    database
      .select({
        id: authAuditEvents.id,
        eventType: authAuditEvents.eventType,
        outcome: authAuditEvents.outcome,
        occurredAt: authAuditEvents.occurredAt,
        safeMetadata: authAuditEvents.safeMetadata,
      })
      .from(authAuditEvents)
      .where(
        or(
          eq(authAuditEvents.subjectProfileId, profileId),
          eq(authAuditEvents.actorProfileId, profileId),
        ),
      )
      .orderBy(desc(authAuditEvents.occurredAt))
      .limit(50),
  ]);

  const roleAssignments = assignmentRows.flatMap((row) => {
    const role = asRole(row.role);
    return role ? [{ ...row, role }] : [];
  });
  const auditEvents = eventRows.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    outcome: asOutcome(event.outcome),
    occurredAt: event.occurredAt,
    safeMetadata: safeMetadata(event.safeMetadata),
  }));

  return {
    providerUserId: profile.providerUserId,
    user: {
      id: profile.id,
      displayName: profile.displayName,
      preferredLocale: asLocale(profile.preferredLocale),
      phone: profile.phone,
      status: asStatus(profile.status),
      createdAt: profile.createdAt,
      lastSafeActivityAt: auditEvents[0]?.occurredAt ?? null,
      roles: roleAssignments
        .filter((assignment) => assignment.active)
        .map((assignment) => assignment.role),
      roleAssignments,
      auditEvents,
    },
  };
}

export async function mutateAdminRole(
  database: Database,
  input: {
    actorProfileId: string;
    targetProfileId: string;
    role: ApplicationRoleCode;
    operation: "ASSIGN" | "REVOKE";
  },
): Promise<AdminMutationResult> {
  const eventType = input.operation === "ASSIGN" ? "ROLE_ASSIGNED" : "ROLE_REMOVED";
  return executeLockedAdminMutation(database, sql`
    with actor as materialized (
      select
        profile.id,
        bool_or(role.code = 'OWNER') as is_owner,
        bool_or(role.code = 'ADMIN') as is_admin,
        bool_or(permission.code = 'USER_ADMIN_MANAGE') as can_manage,
        bool_or(permission.code = 'ROLE_ASSIGN') as can_assign
      from ${userProfiles} profile
      join ${userRoles} assignment
        on assignment.user_profile_id = profile.id and assignment.active = true
      join ${applicationRoles} role
        on role.id = assignment.role_id and role.active = true
      left join ${rolePermissions} mapping on mapping.role_id = role.id
      left join ${permissions} permission
        on permission.id = mapping.permission_id and permission.active = true
      where profile.id = ${input.actorProfileId}::uuid
        and profile.status = 'ACTIVE'
      group by profile.id
    ),
    target as materialized (
      select
        profile.id,
        bool_or(role.code = 'OWNER' and assignment.active and role.active) as is_owner,
        bool_or(role.code = 'ADMIN' and assignment.active and role.active) as is_admin
      from ${userProfiles} profile
      left join ${userRoles} assignment on assignment.user_profile_id = profile.id
      left join ${applicationRoles} role on role.id = assignment.role_id
      where profile.id = ${input.targetProfileId}::uuid
      group by profile.id
    ),
    requested_role as materialized (
      select id, code
      from ${applicationRoles}
      where code = ${input.role}::text and active = true
    ),
    active_owner_count as materialized (
      select count(distinct profile.id)::integer as value
      from ${userProfiles} profile
      join ${userRoles} assignment
        on assignment.user_profile_id = profile.id and assignment.active = true
      join ${applicationRoles} role
        on role.id = assignment.role_id and role.active = true
      where profile.status = 'ACTIVE' and role.code = 'OWNER'
    ),
    current_assignment as materialized (
      select assignment.active
      from ${userRoles} assignment
      join requested_role role on role.id = assignment.role_id
      where assignment.user_profile_id = ${input.targetProfileId}::uuid
    ),
    decision as materialized (
      select case
        when not exists (select 1 from target) or not exists (select 1 from requested_role)
          then 'NOT_FOUND'
        when not exists (
          select 1 from actor
          where can_manage and can_assign and (is_owner or is_admin)
        ) then 'FORBIDDEN'
        when ${input.actorProfileId}::uuid = ${input.targetProfileId}::uuid
          then 'FORBIDDEN'
        when exists (select 1 from actor where is_admin and not is_owner)
          and (
            ${input.role}::text in ('OWNER', 'ADMIN')
            or exists (select 1 from target where is_owner or is_admin)
          ) then 'FORBIDDEN'
        when ${input.operation}::text = 'REVOKE'
          and ${input.role}::text = 'OWNER'
          and exists (select 1 from target where is_owner)
          and (select value from active_owner_count) <= 1
          then 'LAST_OWNER_PROTECTED'
        when ${input.operation}::text = 'ASSIGN'
          and exists (select 1 from current_assignment where active = true)
          then 'NO_CHANGE'
        when ${input.operation}::text = 'REVOKE'
          and not exists (select 1 from current_assignment where active = true)
          then 'NO_CHANGE'
        else 'CHANGED'
      end as result
    ),
    assigned as (
      insert into ${userRoles} (
        user_profile_id, role_id, active, assignment_source, assigned_at,
        assigned_by_profile_id, revoked_at, revoked_by_profile_id
      )
      select
        ${input.targetProfileId}::uuid,
        requested_role.id,
        true,
        'PRIVILEGED_ASSIGNMENT',
        now(),
        ${input.actorProfileId}::uuid,
        null,
        null
      from requested_role, decision
      where decision.result = 'CHANGED' and ${input.operation}::text = 'ASSIGN'
      on conflict (user_profile_id, role_id) do update set
        active = true,
        assignment_source = 'PRIVILEGED_ASSIGNMENT',
        assigned_at = now(),
        assigned_by_profile_id = ${input.actorProfileId}::uuid,
        revoked_at = null,
        revoked_by_profile_id = null
      returning user_profile_id
    ),
    revoked as (
      update ${userRoles} assignment
      set active = false,
          revoked_at = now(),
          revoked_by_profile_id = ${input.actorProfileId}::uuid
      from requested_role, decision
      where assignment.user_profile_id = ${input.targetProfileId}::uuid
        and assignment.role_id = requested_role.id
        and assignment.active = true
        and decision.result = 'CHANGED'
        and ${input.operation}::text = 'REVOKE'
      returning assignment.user_profile_id
    ),
    audited as (
      insert into ${authAuditEvents} (
        event_type, outcome, actor_profile_id, subject_profile_id, safe_metadata
      )
      select
        ${eventType}::text,
        'SUCCESS',
        ${input.actorProfileId}::uuid,
        ${input.targetProfileId}::uuid,
        jsonb_build_object(
          'roleCode', ${input.role}::text,
          'source', 'PRIVILEGED_ADMINISTRATION'
        )
      from decision
      where decision.result = 'CHANGED'
        and (exists (select 1 from assigned) or exists (select 1 from revoked))
      returning id
    )
    select result::text as result from decision
  `);
}

export async function mutateAdminStatus(
  database: Database,
  input: {
    actorProfileId: string;
    targetProfileId: string;
    status: AccountStatus;
  },
): Promise<AdminMutationResult> {
  return executeLockedAdminMutation(database, sql`
    with actor as materialized (
      select
        profile.id,
        bool_or(role.code = 'OWNER') as is_owner,
        bool_or(role.code = 'ADMIN') as is_admin,
        bool_or(permission.code = 'USER_ADMIN_MANAGE') as can_manage
      from ${userProfiles} profile
      join ${userRoles} assignment
        on assignment.user_profile_id = profile.id and assignment.active = true
      join ${applicationRoles} role
        on role.id = assignment.role_id and role.active = true
      left join ${rolePermissions} mapping on mapping.role_id = role.id
      left join ${permissions} permission
        on permission.id = mapping.permission_id and permission.active = true
      where profile.id = ${input.actorProfileId}::uuid
        and profile.status = 'ACTIVE'
      group by profile.id
    ),
    target as materialized (
      select
        profile.id,
        profile.status,
        bool_or(role.code = 'OWNER' and assignment.active and role.active) as is_owner,
        bool_or(role.code = 'ADMIN' and assignment.active and role.active) as is_admin
      from ${userProfiles} profile
      left join ${userRoles} assignment on assignment.user_profile_id = profile.id
      left join ${applicationRoles} role on role.id = assignment.role_id
      where profile.id = ${input.targetProfileId}::uuid
      group by profile.id, profile.status
    ),
    active_owner_count as materialized (
      select count(distinct profile.id)::integer as value
      from ${userProfiles} profile
      join ${userRoles} assignment
        on assignment.user_profile_id = profile.id and assignment.active = true
      join ${applicationRoles} role
        on role.id = assignment.role_id and role.active = true
      where profile.status = 'ACTIVE' and role.code = 'OWNER'
    ),
    decision as materialized (
      select case
        when not exists (select 1 from target) then 'NOT_FOUND'
        when not exists (
          select 1 from actor where can_manage and (is_owner or is_admin)
        ) then 'FORBIDDEN'
        when ${input.actorProfileId}::uuid = ${input.targetProfileId}::uuid
          then 'FORBIDDEN'
        when exists (select 1 from actor where is_admin and not is_owner)
          and exists (select 1 from target where is_owner or is_admin)
          then 'FORBIDDEN'
        when ${input.status}::text <> 'ACTIVE'
          and exists (select 1 from target where is_owner and status = 'ACTIVE')
          and (select value from active_owner_count) <= 1
          then 'LAST_OWNER_PROTECTED'
        when exists (select 1 from target where status = ${input.status})
          then 'NO_CHANGE'
        else 'CHANGED'
      end as result
    ),
    changed as (
      update ${userProfiles} profile
      set status = ${input.status}, updated_at = now()
      from decision
      where profile.id = ${input.targetProfileId}::uuid
        and decision.result = 'CHANGED'
      returning profile.id, profile.status,
        (select status from target) as previous_status
    ),
    audited as (
      insert into ${authAuditEvents} (
        event_type, outcome, actor_profile_id, subject_profile_id, safe_metadata
      )
      select
        'ACCOUNT_STATUS_CHANGED',
        'SUCCESS',
        ${input.actorProfileId}::uuid,
        changed.id,
        jsonb_build_object(
          'previousStatus', changed.previous_status,
          'newStatus', changed.status,
          'source', 'PRIVILEGED_ADMINISTRATION'
        )
      from changed
      returning id
    )
    select result::text as result from decision
  `);
}

function persistenceResult(
  result: AdminMutationResult,
): IdentityAdministrationPersistenceResult {
  switch (result) {
    case "CHANGED":
    case "NO_CHANGE":
      return result;
    case "NOT_FOUND":
      return "TARGET_NOT_FOUND";
    case "LAST_OWNER_PROTECTED":
      return "LAST_ACTIVE_OWNER";
    case "FORBIDDEN":
      return "PERMISSION_DENIED";
  }
}

async function loadMutationTarget(
  database: Database,
  profileId: string,
): Promise<IdentityAdministrationTarget | null> {
  const [profile] = await database
    .select({ id: userProfiles.id, status: userProfiles.status })
    .from(userProfiles)
    .where(eq(userProfiles.id, profileId))
    .limit(1);
  if (!profile) return null;

  const roleRows = await database
    .select({ role: applicationRoles.code })
    .from(userRoles)
    .innerJoin(applicationRoles, eq(userRoles.roleId, applicationRoles.id))
    .where(
      and(
        eq(userRoles.userProfileId, profileId),
        eq(userRoles.active, true),
        eq(applicationRoles.active, true),
      ),
    );

  return {
    profileId,
    status: asStatus(profile.status),
    roles: new Set(
      roleRows.flatMap((row) => {
        const role = asRole(row.role);
        return role ? [role] : [];
      }),
    ),
  };
}

function serviceListPage(
  page: AdminUserPage,
): IdentityAdministrationListPage {
  const lastPage = Math.max(1, Math.ceil(page.total / page.pageSize));
  return {
    items: page.items.map((item) => ({
      profileId: item.id,
      displayName: item.displayName,
      preferredLocale: item.preferredLocale,
      status: item.status,
      activeRoles: item.roles,
      createdAt: item.createdAt,
      lastSafeActivityAt: item.lastSafeActivityAt,
    })),
    nextCursor: page.page < lastPage ? String(page.page + 1) : null,
  };
}

function serviceDetail(detail: AdminUserDetail): IdentityAdministrationDetail {
  return {
    profileId: detail.id,
    displayName: detail.displayName,
    preferredLocale: detail.preferredLocale,
    status: detail.status,
    activeRoles: detail.roles,
    createdAt: detail.createdAt,
    lastSafeActivityAt: detail.lastSafeActivityAt,
    phone: detail.phone,
    roleAssignments: detail.roleAssignments.map((assignment) => ({
      roleCode: assignment.role,
      active: assignment.active,
      assignedAt: assignment.assignedAt,
      revokedAt: assignment.revokedAt,
    })),
    auditEvents: detail.auditEvents.map((event) => ({
      eventType: event.eventType,
      outcome: event.outcome,
      occurredAt: event.occurredAt,
      safeMetadata: Object.fromEntries(
        Object.entries(event.safeMetadata).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      ),
    })),
  };
}

export function createDatabaseIdentityAdministrationRepository(
  database: Database,
): IdentityAdministrationRepository {
  return {
    async listIdentities(
      input: NormalizedIdentityAdministrationListInput,
    ): Promise<IdentityAdministrationListPage> {
      const requestedPage = Number.parseInt(input.cursor ?? "1", 10);
      const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;
      const pageSize: AdminUserPageSize = input.limit <= 10
        ? 10
        : input.limit <= 20
          ? 20
          : 50;
      return serviceListPage(
        await listAdminUsers(database, {
          page,
          pageSize,
          query: input.search,
          role: input.roleCode,
          status: input.status,
        }),
      );
    },

    async getIdentityDetail(profileId) {
      const detail = await loadAdminUserDetail(database, profileId);
      return detail ? serviceDetail(detail.user) : null;
    },

    getMutationTarget(profileId) {
      return loadMutationTarget(database, profileId);
    },

    async getRoleActivation(roleCode) {
      const [role] = await database
        .select({ active: applicationRoles.active })
        .from(applicationRoles)
        .where(eq(applicationRoles.code, roleCode))
        .limit(1);
      return role?.active === true;
    },

    async countActiveOwners() {
      const [row] = await database
        .select({ value: count() })
        .from(userProfiles)
        .innerJoin(
          userRoles,
          and(
            eq(userRoles.userProfileId, userProfiles.id),
            eq(userRoles.active, true),
          ),
        )
        .innerJoin(
          applicationRoles,
          and(
            eq(applicationRoles.id, userRoles.roleId),
            eq(applicationRoles.active, true),
            eq(applicationRoles.code, "OWNER"),
          ),
        )
        .where(eq(userProfiles.status, "ACTIVE"));
      return Number(row?.value ?? 0);
    },

    async assignRoleAndAudit(command) {
      return persistenceResult(
        await mutateAdminRole(database, {
          actorProfileId: command.actorProfileId,
          targetProfileId: command.targetProfileId,
          role: command.roleCode,
          operation: "ASSIGN",
        }),
      );
    },

    async revokeRoleAndAudit(command) {
      return persistenceResult(
        await mutateAdminRole(database, {
          actorProfileId: command.actorProfileId,
          targetProfileId: command.targetProfileId,
          role: command.roleCode,
          operation: "REVOKE",
        }),
      );
    },

    async changeStatusAndAudit(command) {
      return persistenceResult(
        await mutateAdminStatus(database, {
          actorProfileId: command.actorProfileId,
          targetProfileId: command.targetProfileId,
          status: command.newStatus,
        }),
      );
    },
  };
}
