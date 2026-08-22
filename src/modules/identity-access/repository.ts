import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
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
import {
  applicationRoleCodes,
  customerSelfRegistrationRoles,
  permissionCodes,
  type ApplicationRoleCode,
  type PermissionCode,
} from "./policy";

export type ApplicationProfile = {
  id: string;
  displayName: string;
  preferredLocale: "bg" | "en";
  phone: string | null;
  status: AccountStatus;
};

export type ApplicationAccess = {
  profile: ApplicationProfile;
  roles: ReadonlySet<ApplicationRoleCode>;
  permissions: ReadonlySet<PermissionCode>;
};

export type AuthAuditEventType =
  | "SIGNUP_SUCCEEDED"
  | "LOGIN_SUCCEEDED"
  | "LOGIN_FAILED"
  | "LOGOUT_SUCCEEDED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "EMAIL_VERIFICATION_REQUESTED"
  | "EMAIL_VERIFIED"
  | "ROLE_ASSIGNED"
  | "ROLE_REMOVED"
  | "ACCOUNT_STATUS_CHANGED"
  | "OWNER_BOOTSTRAPPED";

export type SafeAuthAuditMetadata = {
  locale?: "bg" | "en";
  reasonCode?: string;
  roleCode?: ApplicationRoleCode;
};

function asAccountStatus(value: string): AccountStatus {
  if (value === "ACTIVE" || value === "SUSPENDED" || value === "DISABLED") {
    return value;
  }
  return "DISABLED";
}

function asLocale(value: string): "bg" | "en" {
  return value === "en" ? "en" : "bg";
}

function isRoleCode(value: string): value is ApplicationRoleCode {
  return (applicationRoleCodes as readonly string[]).includes(value);
}

function isPermissionCode(value: string): value is PermissionCode {
  return (permissionCodes as readonly string[]).includes(value);
}

export async function loadApplicationAccess(
  database: Database,
  authProviderUserId: string,
): Promise<ApplicationAccess | null> {
  const [profileRow] = await database
    .select({
      id: userProfiles.id,
      displayName: userProfiles.displayName,
      preferredLocale: userProfiles.preferredLocale,
      phone: userProfiles.phone,
      status: userProfiles.status,
    })
    .from(userProfiles)
    .where(eq(userProfiles.authProviderUserId, authProviderUserId))
    .limit(1);

  if (!profileRow) {
    return null;
  }

  const [roleRows, permissionRows] = await Promise.all([
    database
      .select({ code: applicationRoles.code })
      .from(userRoles)
      .innerJoin(applicationRoles, eq(userRoles.roleId, applicationRoles.id))
      .where(
        and(
          eq(userRoles.userProfileId, profileRow.id),
          eq(userRoles.active, true),
          eq(applicationRoles.active, true),
        ),
      ),
    database
      .select({ code: permissions.code })
      .from(userRoles)
      .innerJoin(applicationRoles, eq(userRoles.roleId, applicationRoles.id))
      .innerJoin(rolePermissions, eq(applicationRoles.id, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(userRoles.userProfileId, profileRow.id),
          eq(userRoles.active, true),
          eq(applicationRoles.active, true),
          eq(permissions.active, true),
        ),
      ),
  ]);

  return {
    profile: {
      ...profileRow,
      preferredLocale: asLocale(profileRow.preferredLocale),
      status: asAccountStatus(profileRow.status),
    },
    roles: new Set(
      roleRows.map((row) => row.code).filter(isRoleCode),
    ),
    permissions: new Set(
      permissionRows.map((row) => row.code).filter(isPermissionCode),
    ),
  };
}

export async function provisionCustomerProfile(
  database: Database,
  input: {
    authProviderUserId: string;
    displayName: string;
    preferredLocale: "bg" | "en";
  },
): Promise<ApplicationProfile> {
  const existing = await loadApplicationAccess(database, input.authProviderUserId);
  if (existing) {
    return existing.profile;
  }

  const [customerRole] = await database
    .select({ id: applicationRoles.id })
    .from(applicationRoles)
    .where(
      and(
        eq(applicationRoles.code, customerSelfRegistrationRoles[0]),
        eq(applicationRoles.active, true),
      ),
    )
    .limit(1);
  if (!customerRole) {
    throw new Error("The canonical customer role is unavailable.");
  }

  const profileId = randomUUID();
  await database
    .batch([
      database.insert(userProfiles).values({
        id: profileId,
        authProviderUserId: input.authProviderUserId,
        displayName: input.displayName,
        preferredLocale: input.preferredLocale,
        status: "ACTIVE",
      }),
      database.insert(userRoles).values({
        userProfileId: profileId,
        roleId: customerRole.id,
        assignmentSource: "CUSTOMER_SIGNUP",
        active: true,
      }),
      database.insert(authAuditEvents).values({
        eventType: "SIGNUP_SUCCEEDED",
        outcome: "SUCCESS",
        actorProfileId: profileId,
        subjectProfileId: profileId,
        correlationId: randomUUID(),
        safeMetadata: { locale: input.preferredLocale },
      }),
      database.insert(authAuditEvents).values({
        eventType: "ROLE_ASSIGNED",
        outcome: "SUCCESS",
        actorProfileId: profileId,
        subjectProfileId: profileId,
        correlationId: randomUUID(),
        safeMetadata: { roleCode: customerSelfRegistrationRoles[0] },
      }),
    ])
    .catch(async (error: unknown) => {
      const concurrentlyCreated = await loadApplicationAccess(
        database,
        input.authProviderUserId,
      );
      if (!concurrentlyCreated) {
        throw error;
      }
    });

  const provisioned = await loadApplicationAccess(database, input.authProviderUserId);
  if (!provisioned) {
    throw new Error("Application profile provisioning failed.");
  }
  return provisioned.profile;
}

export async function recordAuthAuditEvent(
  database: Database,
  input: {
    eventType: AuthAuditEventType;
    outcome: "SUCCESS" | "FAILURE" | "DENIED";
    actorProfileId?: string;
    subjectProfileId?: string;
    safeMetadata?: SafeAuthAuditMetadata;
  },
): Promise<void> {
  await database.insert(authAuditEvents).values({
    eventType: input.eventType,
    outcome: input.outcome,
    actorProfileId: input.actorProfileId,
    subjectProfileId: input.subjectProfileId,
    safeMetadata: input.safeMetadata ?? {},
  });
}
