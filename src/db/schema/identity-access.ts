import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

function managedTimestamps() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  };
}

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authProviderUserId: varchar("auth_provider_user_id", { length: 255 })
      .notNull()
      .unique(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    preferredLocale: varchar("preferred_locale", { length: 8 })
      .default("bg")
      .notNull(),
    phone: varchar("phone", { length: 40 }),
    status: varchar("status", { length: 16 }).default("ACTIVE").notNull(),
    ...managedTimestamps(),
  },
  (table) => [
    check(
      "user_profiles_locale_valid",
      sql`${table.preferredLocale} in ('bg', 'en')`,
    ),
    check(
      "user_profiles_status_valid",
      sql`${table.status} in ('ACTIVE', 'SUSPENDED', 'DISABLED')`,
    ),
    check(
      "user_profiles_display_name_not_blank",
      sql`length(trim(${table.displayName})) > 0`,
    ),
  ],
);

export const applicationRoles = pgTable("application_roles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  labelBg: varchar("label_bg", { length: 160 }).notNull(),
  labelEn: varchar("label_en", { length: 160 }).notNull(),
  description: text("description").notNull(),
  systemRole: boolean("system_role").default(true).notNull(),
  active: boolean("active").default(true).notNull(),
  ...managedTimestamps(),
});

export const permissions = pgTable("permissions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  code: varchar("code", { length: 96 }).notNull().unique(),
  description: text("description").notNull(),
  active: boolean("active").default(true).notNull(),
  ...managedTimestamps(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: integer("role_id")
      .notNull()
      .references(() => applicationRoles.id, { onDelete: "cascade" }),
    permissionId: integer("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionId] }),
  ],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userProfileId: uuid("user_profile_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => applicationRoles.id, { onDelete: "restrict" }),
    active: boolean("active").default(true).notNull(),
    assignmentSource: varchar("assignment_source", { length: 32 }).notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    assignedByProfileId: uuid("assigned_by_profile_id").references(
      (): AnyPgColumn => userProfiles.id,
      { onDelete: "set null" },
    ),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByProfileId: uuid("revoked_by_profile_id").references(
      (): AnyPgColumn => userProfiles.id,
      { onDelete: "set null" },
    ),
  },
  (table) => [
    primaryKey({ columns: [table.userProfileId, table.roleId] }),
    check(
      "user_roles_assignment_source_valid",
      sql`${table.assignmentSource} in ('CUSTOMER_SIGNUP', 'OWNER_BOOTSTRAP', 'PRIVILEGED_ASSIGNMENT')`,
    ),
    check(
      "user_roles_active_revocation_consistent",
      sql`(${table.active} = true and ${table.revokedAt} is null) or (${table.active} = false and ${table.revokedAt} is not null)`,
    ),
    check(
      "user_roles_revocation_after_assignment",
      sql`${table.revokedAt} is null or ${table.revokedAt} >= ${table.assignedAt}`,
    ),
  ],
);

export const authAuditEvents = pgTable(
  "auth_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    outcome: varchar("outcome", { length: 16 }).notNull(),
    actorProfileId: uuid("actor_profile_id").references(
      (): AnyPgColumn => userProfiles.id,
      { onDelete: "set null" },
    ),
    subjectProfileId: uuid("subject_profile_id").references(
      (): AnyPgColumn => userProfiles.id,
      { onDelete: "set null" },
    ),
    correlationId: uuid("correlation_id").defaultRandom().notNull(),
    safeMetadata: jsonb("safe_metadata").default(sql`'{}'::jsonb`).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("auth_audit_events_correlation_id_unique").on(
      table.correlationId,
    ),
    check(
      "auth_audit_events_outcome_valid",
      sql`${table.outcome} in ('SUCCESS', 'FAILURE', 'DENIED')`,
    ),
    check(
      "auth_audit_events_type_valid",
      sql`${table.eventType} in ('SIGNUP_SUCCEEDED', 'LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'LOGOUT_SUCCEEDED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'EMAIL_VERIFICATION_REQUESTED', 'EMAIL_VERIFIED', 'ROLE_ASSIGNED', 'ROLE_REMOVED', 'ACCOUNT_STATUS_CHANGED', 'OWNER_BOOTSTRAPPED')`,
    ),
  ],
);
