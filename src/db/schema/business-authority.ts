import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AuthorityType } from "@/modules/business-authority/types";
import type { AuthorityValue } from "@/modules/business-authority/validation";
import { userProfiles } from "./identity-access";

export const businessAuthorityRecords = pgTable(
  "business_authority_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authorityKey: varchar("authority_key", { length: 96 }).notNull(),
    category: varchar("category", { length: 32 }).notNull(),
    version: integer("version").notNull(),
    recordVersion: integer("record_version").default(0).notNull(),
    environmentScope: varchar("environment_scope", { length: 16 }).notNull(),
    status: varchar("status", { length: 32 }).default("PROPOSED").notNull(),
    evidenceClass: varchar("evidence_class", { length: 32 }).notNull(),
    requiredAuthorityTypes: jsonb("required_authority_types")
      .$type<AuthorityType[]>()
      .notNull(),
    authorityValue: jsonb("authority_value").$type<AuthorityValue>().notNull(),
    sourceReference: varchar("source_reference", { length: 500 }),
    safeEvidenceSummary: text("safe_evidence_summary"),
    internalNotes: text("internal_notes"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    proposedByProfileId: uuid("proposed_by_profile_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "restrict" }),
    approvedByProfileId: uuid("approved_by_profile_id").references(
      () => userProfiles.id,
      { onDelete: "restrict" },
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    supersededByRecordId: uuid("superseded_by_record_id"),
    transitionCorrelationId: uuid("transition_correlation_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("business_authority_records_key_environment_version_unique").on(
      table.authorityKey,
      table.environmentScope,
      table.version,
    ),
    uniqueIndex("business_authority_records_transition_correlation_unique").on(
      table.transitionCorrelationId,
    ),
    uniqueIndex("business_authority_records_current_approved_unique")
      .on(table.authorityKey, table.environmentScope)
      .where(
        sql`${table.status} in ('APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION')`,
      ),
    index("business_authority_records_readiness_idx").on(
      table.environmentScope,
      table.category,
      table.status,
      table.effectiveFrom,
    ),
    foreignKey({
      name: "business_authority_records_superseded_by_fk",
      columns: [table.supersededByRecordId],
      foreignColumns: [table.id],
    }).onDelete("restrict"),
    check(
      "business_authority_records_key_valid",
      sql`${table.authorityKey} ~ '^[A-Z][A-Z0-9_]{1,95}$'`,
    ),
    check(
      "business_authority_records_category_valid",
      sql`${table.category} in ('BRAND_CONTENT', 'SERVICE_SCOPE', 'PRICING', 'VAT_TAX', 'SELLER_LEGAL', 'SCHEDULING', 'TRAVEL', 'TEAMS_EQUIPMENT', 'AUTH', 'PRIVACY_RETENTION', 'EMAIL', 'MONITORING', 'BACKUP_RECOVERY', 'FINANCE_FISCAL', 'DATABASE', 'DOMAIN_TLS', 'DEPLOYMENT_AUTHORIZATION')`,
    ),
    check(
      "business_authority_records_environment_valid",
      sql`${table.environmentScope} in ('DEVELOPMENT', 'STAGING', 'PRODUCTION')`,
    ),
    check(
      "business_authority_records_status_valid",
      sql`${table.status} in ('PROPOSED', 'UNDER_REVIEW', 'APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION', 'SUPERSEDED', 'REJECTED')`,
    ),
    check(
      "business_authority_records_evidence_class_valid",
      sql`${table.evidenceClass} in ('OWNER_INPUT', 'SYSTEM_VERIFIED', 'EXTERNAL_EVIDENCE_REQUIRED')`,
    ),
    check(
      "business_authority_records_version_valid",
      sql`${table.version} >= 1 and ${table.recordVersion} >= 0`,
    ),
    check(
      "business_authority_records_authority_types_valid",
      sql`jsonb_typeof(${table.requiredAuthorityTypes}) = 'array' and jsonb_array_length(${table.requiredAuthorityTypes}) > 0 and not jsonb_path_exists(${table.requiredAuthorityTypes}, '$[*] ? (@ != "OWNER" && @ != "ACCOUNTANT" && @ != "LEGAL" && @ != "OPERATIONS" && @ != "TECHNICAL" && @ != "CONTENT_CLAIMS")')`,
    ),
    check(
      "business_authority_records_value_valid",
      sql`jsonb_typeof(${table.authorityValue}) = 'object' and jsonb_typeof(${table.authorityValue}->'kind') = 'string'`,
    ),
    check(
      "business_authority_records_external_evidence_present",
      sql`${table.evidenceClass} <> 'EXTERNAL_EVIDENCE_REQUIRED' or ${table.sourceReference} is not null`,
    ),
    check(
      "business_authority_records_effective_window_valid",
      sql`${table.effectiveUntil} is null or ${table.effectiveUntil} > ${table.effectiveFrom}`,
    ),
    check(
      "business_authority_records_environment_approval_valid",
      sql`(${table.status} <> 'APPROVED_FOR_STAGING' or ${table.environmentScope} = 'STAGING') and (${table.status} <> 'APPROVED_FOR_PRODUCTION' or ${table.environmentScope} = 'PRODUCTION')`,
    ),
    check(
      "business_authority_records_lifecycle_valid",
      sql`(${table.status} in ('PROPOSED', 'UNDER_REVIEW', 'REJECTED') and ${table.approvedByProfileId} is null and ${table.approvedAt} is null and ${table.supersededAt} is null and ${table.supersededByRecordId} is null) or (${table.status} in ('APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION') and ${table.approvedByProfileId} is not null and ${table.approvedAt} is not null and ${table.supersededAt} is null and ${table.supersededByRecordId} is null) or (${table.status} = 'SUPERSEDED' and ${table.approvedByProfileId} is not null and ${table.approvedAt} is not null and ${table.supersededAt} is not null and ${table.supersededByRecordId} is not null and ${table.supersededAt} >= ${table.approvedAt})`,
    ),
  ],
);

export const businessAuthorityAuditEvents = pgTable(
  "business_authority_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authorityRecordId: uuid("authority_record_id")
      .notNull()
      .references(() => businessAuthorityRecords.id, { onDelete: "restrict" }),
    authorityKey: varchar("authority_key", { length: 96 }).notNull(),
    authorityVersion: integer("authority_version").notNull(),
    recordVersion: integer("record_version").notNull(),
    environmentScope: varchar("environment_scope", { length: 16 }).notNull(),
    category: varchar("category", { length: 32 }).notNull(),
    eventType: varchar("event_type", { length: 48 }).notNull(),
    previousStatus: varchar("previous_status", { length: 32 }),
    nextStatus: varchar("next_status", { length: 32 }).notNull(),
    decisionAuthorityType: varchar("decision_authority_type", { length: 32 }),
    actorProfileId: uuid("actor_profile_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "restrict" }),
    actorRoleCodes: jsonb("actor_role_codes").$type<string[]>().notNull(),
    evidenceReference: varchar("evidence_reference", { length: 500 }),
    safeEvidenceSummary: text("safe_evidence_summary"),
    correlationId: uuid("correlation_id").notNull(),
    safeMetadata: jsonb("safe_metadata")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("business_authority_audit_events_correlation_unique").on(
      table.correlationId,
    ),
    uniqueIndex("business_authority_audit_events_record_version_unique").on(
      table.authorityRecordId,
      table.recordVersion,
    ),
    index("business_authority_audit_events_record_time_idx").on(
      table.authorityRecordId,
      table.occurredAt,
    ),
    check(
      "business_authority_audit_events_version_valid",
      sql`${table.authorityVersion} >= 1 and ${table.recordVersion} >= 0`,
    ),
    check(
      "business_authority_audit_events_environment_valid",
      sql`${table.environmentScope} in ('DEVELOPMENT', 'STAGING', 'PRODUCTION')`,
    ),
    check(
      "business_authority_audit_events_status_valid",
      sql`(${table.previousStatus} is null or ${table.previousStatus} in ('PROPOSED', 'UNDER_REVIEW', 'APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION', 'SUPERSEDED', 'REJECTED')) and ${table.nextStatus} in ('PROPOSED', 'UNDER_REVIEW', 'APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION', 'SUPERSEDED', 'REJECTED')`,
    ),
    check(
      "business_authority_audit_events_event_valid",
      sql`${table.eventType} in ('AUTHORITY_PROPOSED', 'AUTHORITY_SUBMITTED_FOR_REVIEW', 'AUTHORITY_APPROVAL_RECORDED', 'AUTHORITY_APPROVED', 'AUTHORITY_REJECTED', 'AUTHORITY_SUPERSEDED')`,
    ),
    check(
      "business_authority_audit_events_authority_type_valid",
      sql`${table.decisionAuthorityType} is null or ${table.decisionAuthorityType} in ('OWNER', 'ACCOUNTANT', 'LEGAL', 'OPERATIONS', 'TECHNICAL', 'CONTENT_CLAIMS')`,
    ),
    check(
      "business_authority_audit_events_role_snapshot_valid",
      sql`jsonb_typeof(${table.actorRoleCodes}) = 'array' and jsonb_array_length(${table.actorRoleCodes}) > 0`,
    ),
    check(
      "business_authority_audit_events_metadata_valid",
      sql`jsonb_typeof(${table.safeMetadata}) = 'object'`,
    ),
    check(
      "business_authority_audit_events_semantics_valid",
      sql`(${table.eventType} = 'AUTHORITY_PROPOSED' and ${table.previousStatus} is null and ${table.nextStatus} = 'PROPOSED' and ${table.decisionAuthorityType} is null) or (${table.eventType} = 'AUTHORITY_SUBMITTED_FOR_REVIEW' and ${table.previousStatus} = 'PROPOSED' and ${table.nextStatus} = 'UNDER_REVIEW' and ${table.decisionAuthorityType} is null) or (${table.eventType} = 'AUTHORITY_APPROVAL_RECORDED' and ${table.previousStatus} = 'UNDER_REVIEW' and ${table.nextStatus} = 'UNDER_REVIEW' and ${table.decisionAuthorityType} is not null) or (${table.eventType} = 'AUTHORITY_APPROVED' and ${table.previousStatus} = 'UNDER_REVIEW' and ${table.nextStatus} in ('APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION') and ${table.decisionAuthorityType} is not null) or (${table.eventType} = 'AUTHORITY_REJECTED' and ${table.previousStatus} in ('PROPOSED', 'UNDER_REVIEW') and ${table.nextStatus} = 'REJECTED' and ${table.decisionAuthorityType} is null) or (${table.eventType} = 'AUTHORITY_SUPERSEDED' and ${table.previousStatus} in ('APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION') and ${table.nextStatus} = 'SUPERSEDED' and ${table.decisionAuthorityType} is null)`,
    ),
  ],
);
