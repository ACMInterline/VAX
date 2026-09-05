import "server-only";

import { asc, getTableColumns, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  businessAuthorityAuditEvents,
  businessAuthorityRecords,
} from "@/db/schema/business-authority";
import {
  applicationRoles,
  userProfiles,
  userRoles,
} from "@/db/schema/identity-access";
import { activeActorPermissionSql } from "@/modules/request-quote/repository";
import {
  authorityCategories,
  authorityEnvironmentScopes,
  authorityEvidenceClasses,
  authorityEventTypes,
  authorityStatuses,
  authorityTypes,
  type AuthorityCategory,
  type AuthorityEnvironmentScope,
  type AuthorityDefinition,
  type AuthorityEvidenceClass,
  type AuthorityEventType,
  type AuthorityStatus,
  type AuthorityType,
  type BusinessAuthorityEvent,
  type BusinessAuthorityRecord,
} from "./types";
import type {
  AuthorityDecisionInput,
  AuthorityProposalInput,
} from "./validation";
import type { ConfigurationReferenceSnapshot } from "./readiness";
import type { BusinessAuthorityRepository } from "./service";
import { signBusinessAuthorityActorContext } from "./actor-context";
import { resolveAttelierStagingConfigurationReferences } from "./attelier-staging-config";

export type BusinessAuthorityMutationResult =
  | Readonly<{ status: "CHANGED"; recordId: string }>
  | Readonly<{ status: "NOT_FOUND_OR_FORBIDDEN" }>
  | Readonly<{ status: "CONFLICT" }>;

export type BusinessAuthorityState = Readonly<{
  records: readonly BusinessAuthorityRecord[];
  events: readonly BusinessAuthorityEvent[];
  configurationReferences: readonly ConfigurationReferenceSnapshot[];
}>;

export type GovernedAuthorityProposalInput = AuthorityProposalInput &
  Readonly<{ definition: AuthorityDefinition }>;

export type ProductionDependencyRecordTarget = Readonly<{
  id: string;
  authorityKey: string;
  version: number;
  recordVersion: number;
  contentHash: string;
  status: "APPROVED_FOR_PRODUCTION";
}>;

export type ProductionDependencyApprovalSnapshot = Readonly<{
  records: readonly ProductionDependencyRecordTarget[];
  configurationReferenceCount: number;
}>;

export type GovernedAuthorityDecisionInput = AuthorityDecisionInput &
  Readonly<{
    productionDependencySnapshot: ProductionDependencyApprovalSnapshot | null;
  }>;

type MutationRow = { result: string; recordId: string | null };

function includes<const T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return (values as readonly string[]).includes(value);
}

function category(value: string): AuthorityCategory {
  return includes(authorityCategories, value)
    ? value
    : "DEPLOYMENT_AUTHORIZATION";
}

function environmentScope(value: string): AuthorityEnvironmentScope {
  return includes(authorityEnvironmentScopes, value) ? value : "DEVELOPMENT";
}

function status(value: string): AuthorityStatus {
  return includes(authorityStatuses, value) ? value : "REJECTED";
}

function evidenceClass(value: string): AuthorityEvidenceClass {
  return includes(authorityEvidenceClasses, value)
    ? value
    : "EXTERNAL_EVIDENCE_REQUIRED";
}

function authorityType(value: string | null): AuthorityType | null {
  return value && includes(authorityTypes, value) ? value : null;
}

function eventType(value: string): AuthorityEventType {
  return includes(authorityEventTypes, value) ? value : "AUTHORITY_REJECTED";
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function authorityTypeArray(value: unknown): readonly AuthorityType[] {
  return stringArray(value).filter((entry): entry is AuthorityType =>
    includes(authorityTypes, entry),
  );
}

function safeObject(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Hashes the complete immutable content envelope in PostgreSQL. Keeping this
 * derivation at the database boundary lets the read DTO and transition CAS use
 * byte-identical canonical JSONB semantics.
 */
export function businessAuthorityRecordContentHashSql(
  scope: SQL = sql.raw('"business_authority_records"'),
): SQL<string> {
  return sql<string>`encode(public.digest(convert_to(jsonb_build_object(
    'id', ${scope}.id,
    'authorityKey', ${scope}.authority_key,
    'category', ${scope}.category,
    'version', ${scope}.version,
    'environmentScope', ${scope}.environment_scope,
    'evidenceClass', ${scope}.evidence_class,
    'requiredAuthorityTypes', ${scope}.required_authority_types,
    'authorityValue', ${scope}.authority_value,
    'sourceReference', ${scope}.source_reference,
    'safeEvidenceSummary', ${scope}.safe_evidence_summary,
    'internalNotes', ${scope}.internal_notes,
    'effectiveFrom', ${scope}.effective_from,
    'effectiveUntil', ${scope}.effective_until,
    'proposedByProfileId', ${scope}.proposed_by_profile_id,
    'createdAt', ${scope}.created_at
  )::text, 'UTF8'), 'sha256'), 'hex')`;
}

/** Current active Owner plus the protected system-management permission. */
export function activeBusinessAuthorityOwnerSql(actorProfileId: string): SQL {
  return sql`${activeActorPermissionSql(actorProfileId, "SYSTEM_SETTINGS_MANAGE")}
    and exists (
      select 1
      from ${userRoles} owner_assignment
      join ${applicationRoles} owner_role
        on owner_role.id = owner_assignment.role_id
       and owner_role.active = true
       and owner_role.code = 'OWNER'
      where owner_assignment.user_profile_id = ${actorProfileId}::uuid
        and owner_assignment.active = true
    )`;
}

export function businessAuthorityActorContextSql(
  actorProfileId: string,
  providerUserId: string,
  primaryCorrelationId: string,
  secondaryCorrelationId: string | null,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  issuedAtEpochSeconds = Math.floor(Date.now() / 1_000),
): SQL {
  const normalizedProviderUserId = providerUserId.trim();
  if (!normalizedProviderUserId || normalizedProviderUserId.length > 255) {
    throw new Error("Business-authority actor context is unavailable.");
  }
  const signature = signBusinessAuthorityActorContext(
    {
      actorProfileId,
      providerUserId: normalizedProviderUserId,
      primaryCorrelationId,
      secondaryCorrelationId,
      issuedAtEpochSeconds,
    },
    environment,
  );
  return sql`select
    set_config('vax.business_authority.actor_profile_id', ${actorProfileId}, true),
    set_config('vax.business_authority.provider_user_id', ${normalizedProviderUserId}, true),
    set_config('vax.business_authority.primary_correlation_id', ${primaryCorrelationId}, true),
    set_config('vax.business_authority.secondary_correlation_id', ${secondaryCorrelationId ?? ""}, true),
    set_config('vax.business_authority.issued_at', ${issuedAtEpochSeconds.toString(10)}, true),
    set_config('vax.business_authority.signature', ${signature}, true)`;
}

export function businessAuthorityProposalLockSql(
  authorityKey: string,
  environmentScope: AuthorityEnvironmentScope,
): SQL {
  return sql`select pg_advisory_xact_lock(hashtext(${`business-authority:${authorityKey}:${environmentScope}`}))`;
}

export function businessAuthorityTransitionLockSql(recordId: string): SQL {
  return sql`select pg_advisory_xact_lock(hashtext(
      'business-authority:' || locked_authority.authority_key || ':' ||
      locked_authority.environment_scope
    ))
    from ${businessAuthorityRecords} locked_authority
    where locked_authority.id = ${recordId}::uuid`;
}

function actorRoleSnapshotSql(actorProfileId: string): SQL {
  return sql`(
    select coalesce(jsonb_agg(distinct actor_role.code order by actor_role.code), '[]'::jsonb)
    from ${userProfiles} actor_profile
    join ${userRoles} actor_assignment
      on actor_assignment.user_profile_id = actor_profile.id
     and actor_assignment.active = true
    join ${applicationRoles} actor_role
      on actor_role.id = actor_assignment.role_id
     and actor_role.active = true
    where actor_profile.id = ${actorProfileId}::uuid
      and actor_profile.status = 'ACTIVE'
  )`;
}

export async function listBusinessAuthorityState(
  database: Database,
  actorProfileId: string,
): Promise<BusinessAuthorityState> {
  const readAllowed = activeActorPermissionSql(
    actorProfileId,
    "SYSTEM_SETTINGS_READ",
  );
  const [recordRows, eventRows] = await Promise.all([
    database
      .select({
        ...getTableColumns(businessAuthorityRecords),
        contentHash: businessAuthorityRecordContentHashSql(),
      })
      .from(businessAuthorityRecords)
      .where(readAllowed)
      .orderBy(
        asc(businessAuthorityRecords.category),
        asc(businessAuthorityRecords.authorityKey),
        asc(businessAuthorityRecords.environmentScope),
        asc(businessAuthorityRecords.version),
      ),
    database
      .select()
      .from(businessAuthorityAuditEvents)
      .where(readAllowed)
      .orderBy(asc(businessAuthorityAuditEvents.occurredAt)),
  ]);

  return {
    records: recordRows.map((record) => ({
      id: record.id,
      contentHash: record.contentHash,
      authorityKey: record.authorityKey,
      category: category(record.category),
      version: record.version,
      recordVersion: record.recordVersion,
      environmentScope: environmentScope(record.environmentScope),
      status: status(record.status),
      evidenceClass: evidenceClass(record.evidenceClass),
      requiredAuthorityTypes: authorityTypeArray(record.requiredAuthorityTypes),
      value: record.authorityValue,
      sourceReference: record.sourceReference,
      safeEvidenceSummary: record.safeEvidenceSummary,
      internalNotes: record.internalNotes,
      effectiveFrom: record.effectiveFrom,
      effectiveUntil: record.effectiveUntil,
      proposedByProfileId: record.proposedByProfileId,
      approvedByProfileId: record.approvedByProfileId,
      approvedAt: record.approvedAt,
      supersededAt: record.supersededAt,
      supersededById: record.supersededByRecordId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })),
    events: eventRows.map((event) => ({
      id: event.id,
      authorityRecordId: event.authorityRecordId,
      eventType: eventType(event.eventType),
      previousStatus: event.previousStatus
        ? status(event.previousStatus)
        : null,
      nextStatus: status(event.nextStatus),
      decisionAuthorityType: authorityType(event.decisionAuthorityType),
      actorProfileId: event.actorProfileId,
      evidenceReference: event.evidenceReference,
      safeEvidenceSummary: event.safeEvidenceSummary,
      correlationId: event.correlationId,
      safeMetadata: safeObject(event.safeMetadata),
      occurredAt: event.occurredAt,
    })),
    // Only exact code-owned ATTELIER staging configurations are resolved.
    // An arbitrary authority-row reference is never echoed back as trusted,
    // and production intentionally has no resolver under this change.
    configurationReferences:
      resolveAttelierStagingConfigurationReferences(process.env),
  };
}

export function proposalMutationSql(
  actorProfileId: string,
  input: GovernedAuthorityProposalInput,
  correlationId: string,
): SQL {
  const definitionJson = JSON.stringify(input.value);
  const requiredAuthorities = JSON.stringify(
    input.definition.requiredAuthorityTypes,
  );
  return sql`
    with authorized_actor as materialized (
      select ${actorProfileId}::uuid as actor_id,
        ${actorRoleSnapshotSql(actorProfileId)} as actor_roles
      where ${activeBusinessAuthorityOwnerSql(actorProfileId)}
    ), next_version as materialized (
      select coalesce(max(existing.version), 0) + 1 as version
      from ${businessAuthorityRecords} existing
      where existing.authority_key = ${input.authorityKey}
        and existing.environment_scope = ${input.environmentScope}
    ), inserted as (
      insert into ${businessAuthorityRecords} (
        authority_key, category, version, record_version,
        environment_scope, status, evidence_class,
        required_authority_types, authority_value, source_reference,
        safe_evidence_summary, internal_notes, effective_from,
        effective_until, proposed_by_profile_id, transition_correlation_id
      )
      select ${input.authorityKey}, ${input.definition.category}, version, 0,
        ${input.environmentScope}, 'PROPOSED',
        ${input.definition.evidenceClass}, ${requiredAuthorities}::jsonb,
        ${definitionJson}::jsonb, ${input.sourceReference},
        ${input.safeEvidenceSummary}, ${input.internalNotes},
        ${input.effectiveFrom}, ${input.effectiveUntil}, actor_id,
        ${correlationId}::uuid
      from authorized_actor cross join next_version
      returning *
    ), audited as (
      insert into ${businessAuthorityAuditEvents} (
        authority_record_id, authority_key, authority_version,
        record_version, environment_scope, category, event_type,
        previous_status, next_status, decision_authority_type,
        actor_profile_id, actor_role_codes, evidence_reference,
        safe_evidence_summary, correlation_id, safe_metadata
      )
      select inserted.id, inserted.authority_key, inserted.version,
        inserted.record_version, inserted.environment_scope,
        inserted.category, 'AUTHORITY_PROPOSED', null, 'PROPOSED', null,
        inserted.proposed_by_profile_id, authorized_actor.actor_roles,
        inserted.source_reference, inserted.safe_evidence_summary,
        inserted.transition_correlation_id,
        jsonb_build_object('authorityKey', inserted.authority_key,
          'version', inserted.version,
          'environmentScope', inserted.environment_scope,
          'category', inserted.category)
      from inserted cross join authorized_actor
      returning authority_record_id
    )
    select 'CHANGED'::text as result,
      audited.authority_record_id::text as "recordId"
    from audited
  `;
}

function transitionEventSql(action: AuthorityDecisionInput["action"]): SQL {
  if (action === "SUBMIT_FOR_REVIEW") {
    return sql`'AUTHORITY_SUBMITTED_FOR_REVIEW'`;
  }
  if (action === "REJECT") return sql`'AUTHORITY_REJECTED'`;
  return sql`case when changed.approval_complete
    then 'AUTHORITY_APPROVED'
    else 'AUTHORITY_APPROVAL_RECORDED' end`;
}

export function transitionMutationSql(
  actorProfileId: string,
  input: GovernedAuthorityDecisionInput,
  correlationId: string,
  supersessionCorrelationId: string,
): SQL {
  const decisionAuthorityType = input.decisionAuthorityType;
  const action = input.action;
  const dependencySnapshot = input.productionDependencySnapshot;
  const dependencyTargets = JSON.stringify(
    (dependencySnapshot?.records ?? []).map((record) => ({
      id: record.id,
      authority_key: record.authorityKey,
      version: record.version,
      record_version: record.recordVersion,
      content_hash: record.contentHash,
      status: record.status,
    })),
  );
  return sql`
    with authorized_actor as materialized (
      select ${actorProfileId}::uuid as actor_id,
        ${actorRoleSnapshotSql(actorProfileId)} as actor_roles
      where ${activeBusinessAuthorityOwnerSql(actorProfileId)}
    ), dependency_expectations as materialized (
      select expected.*
      from jsonb_to_recordset(${dependencyTargets}::jsonb) as expected(
        id uuid,
        authority_key text,
        version integer,
        record_version integer,
        content_hash text,
        status text
      )
    ), locked_dependencies as materialized (
      select dependency.id
      from ${businessAuthorityRecords} dependency
      join dependency_expectations expected
        on expected.id = dependency.id
       and expected.authority_key = dependency.authority_key
       and expected.version = dependency.version
       and expected.record_version = dependency.record_version
       and expected.content_hash = ${businessAuthorityRecordContentHashSql(sql.raw("dependency"))}
       and expected.status = dependency.status
      where dependency.status = 'APPROVED_FOR_PRODUCTION'
        and dependency.environment_scope = 'PRODUCTION'
        and dependency.superseded_by_record_id is null
        and dependency.effective_from <= clock_timestamp()
        and (
          dependency.effective_until is null
          or dependency.effective_until > clock_timestamp()
        )
      for share of dependency
    ), dependency_validation as materialized (
      select (
        not ${dependencySnapshot !== null}
        or (
          ${dependencySnapshot?.configurationReferenceCount ?? 0} = 0
          and (select count(*) from dependency_expectations) =
            (select count(*) from locked_dependencies)
        )
      ) as valid
    ), target as materialized (
      select record.*
      from ${businessAuthorityRecords} record
      cross join authorized_actor
      cross join dependency_validation
      where record.id = ${input.recordId}::uuid
        and record.version = ${input.expectedAuthorityVersion}
        and record.record_version = ${input.expectedRecordVersion}
        and ${businessAuthorityRecordContentHashSql(sql.raw("record"))} = ${input.expectedContentHash}
        and dependency_validation.valid
        and (
          ${action} <> 'APPROVE'
          or not exists (
            select 1
            from ${businessAuthorityRecords} newer_authority
            where newer_authority.authority_key = record.authority_key
              and newer_authority.environment_scope = record.environment_scope
              and newer_authority.version > record.version
          )
        )
      for update of record
    ), transition as materialized (
      select target.*,
        case
          when ${action} = 'SUBMIT_FOR_REVIEW' then 'UNDER_REVIEW'
          when ${action} = 'REJECT' then 'REJECTED'
          when ${action} = 'APPROVE' and not exists (
            select 1
            from jsonb_array_elements_text(target.required_authority_types) required(value)
            where required.value <> ${decisionAuthorityType}
              and not exists (
                select 1
                from ${businessAuthorityAuditEvents} prior_approval
                where prior_approval.authority_record_id = target.id
                  and prior_approval.decision_authority_type = required.value
                  and prior_approval.event_type in (
                    'AUTHORITY_APPROVAL_RECORDED', 'AUTHORITY_APPROVED'
                  )
              )
          ) then case target.environment_scope
            when 'STAGING' then 'APPROVED_FOR_STAGING'
            when 'PRODUCTION' then 'APPROVED_FOR_PRODUCTION'
            else 'UNDER_REVIEW'
          end
          else 'UNDER_REVIEW'
        end as next_status,
        (${action} = 'APPROVE' and not exists (
          select 1
          from jsonb_array_elements_text(target.required_authority_types) required(value)
          where required.value <> ${decisionAuthorityType}
            and not exists (
              select 1
              from ${businessAuthorityAuditEvents} prior_approval
              where prior_approval.authority_record_id = target.id
                and prior_approval.decision_authority_type = required.value
                and prior_approval.event_type in (
                  'AUTHORITY_APPROVAL_RECORDED', 'AUTHORITY_APPROVED'
                )
            )
        )) as approval_complete
      from target
      where (
          ${action} = 'SUBMIT_FOR_REVIEW'
          and target.status = 'PROPOSED'
          and ${decisionAuthorityType}::text is null
        ) or (
          ${action} = 'REJECT'
          and target.status in ('PROPOSED', 'UNDER_REVIEW')
          and ${decisionAuthorityType}::text is null
        ) or (
          ${action} = 'APPROVE'
          and target.status = 'UNDER_REVIEW'
          and target.environment_scope in ('STAGING', 'PRODUCTION')
          and ${decisionAuthorityType}::text is not null
          and target.required_authority_types ? ${decisionAuthorityType}
          and not exists (
            select 1
            from ${businessAuthorityRecords} current_authority
            where current_authority.authority_key = target.authority_key
              and current_authority.environment_scope = target.environment_scope
              and current_authority.id <> target.id
              and current_authority.status in (
                'APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION'
              )
              and current_authority.effective_from > target.effective_from
          )
          and not exists (
            select 1 from ${businessAuthorityAuditEvents} duplicate_approval
            where duplicate_approval.authority_record_id = target.id
              and duplicate_approval.decision_authority_type = ${decisionAuthorityType}
              and duplicate_approval.event_type in (
                'AUTHORITY_APPROVAL_RECORDED', 'AUTHORITY_APPROVED'
              )
          )
          and (
            ${decisionAuthorityType} not in ('ACCOUNTANT', 'LEGAL')
            or ${input.evidenceReference}::text is not null
          )
        )
    ), prior_approved as materialized (
      select prior.*
      from ${businessAuthorityRecords} prior
      join transition
        on transition.approval_complete
       and prior.authority_key = transition.authority_key
       and prior.environment_scope = transition.environment_scope
       and prior.id <> transition.id
       and prior.status in ('APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION')
       and prior.effective_from <= transition.effective_from
      for update of prior
    ), superseded as (
      update ${businessAuthorityRecords} prior
      set status = 'SUPERSEDED',
        record_version = prior.record_version + 1,
        superseded_at = greatest(transition.effective_from, clock_timestamp()),
        superseded_by_record_id = transition.id,
        transition_correlation_id = ${supersessionCorrelationId}::uuid,
        updated_at = clock_timestamp()
      from prior_approved, transition
      where prior.id = prior_approved.id
      returning prior.*
    ), supersession_audit as (
      insert into ${businessAuthorityAuditEvents} (
        authority_record_id, authority_key, authority_version,
        record_version, environment_scope, category, event_type,
        previous_status, next_status, decision_authority_type,
        actor_profile_id, actor_role_codes, evidence_reference,
        safe_evidence_summary, correlation_id, safe_metadata
      )
      select superseded.id, superseded.authority_key, superseded.version,
        superseded.record_version, superseded.environment_scope,
        superseded.category, 'AUTHORITY_SUPERSEDED', prior_approved.status,
        'SUPERSEDED', null, authorized_actor.actor_id,
        authorized_actor.actor_roles, null, null,
        superseded.transition_correlation_id,
        jsonb_build_object('authorityKey', superseded.authority_key,
          'version', superseded.version,
          'environmentScope', superseded.environment_scope,
          'category', superseded.category)
      from superseded
      join prior_approved on prior_approved.id = superseded.id
      cross join authorized_actor
      returning authority_record_id
    ), supersession_barrier as materialized (
      select count(*) as count from supersession_audit
    ), changed as (
      update ${businessAuthorityRecords} record
      set status = transition.next_status,
        record_version = record.record_version + 1,
        approved_by_profile_id = case when transition.approval_complete
          then authorized_actor.actor_id else null end,
        approved_at = case when transition.approval_complete
          then clock_timestamp() else null end,
        transition_correlation_id = ${correlationId}::uuid,
        updated_at = clock_timestamp()
      from transition, authorized_actor, supersession_barrier
      where record.id = transition.id
      returning record.*, transition.status as previous_status,
        transition.approval_complete
    ), audited as (
      insert into ${businessAuthorityAuditEvents} (
        authority_record_id, authority_key, authority_version,
        record_version, environment_scope, category, event_type,
        previous_status, next_status, decision_authority_type,
        actor_profile_id, actor_role_codes, evidence_reference,
        safe_evidence_summary, correlation_id, safe_metadata
      )
      select changed.id, changed.authority_key, changed.version,
        changed.record_version, changed.environment_scope, changed.category,
        ${transitionEventSql(action)}, changed.previous_status,
        changed.status, ${decisionAuthorityType}, authorized_actor.actor_id,
        authorized_actor.actor_roles, ${input.evidenceReference},
        ${input.safeEvidenceSummary}, changed.transition_correlation_id,
        jsonb_build_object('authorityKey', changed.authority_key,
          'version', changed.version,
          'environmentScope', changed.environment_scope,
          'category', changed.category)
      from changed cross join authorized_actor
      returning authority_record_id
    )
    select 'CHANGED'::text as result,
      audited.authority_record_id::text as "recordId"
    from audited
  `;
}

function mutationResult(
  row: MutationRow | undefined,
): BusinessAuthorityMutationResult {
  if (row?.result === "CHANGED" && row.recordId) {
    return { status: "CHANGED", recordId: row.recordId };
  }
  return { status: "NOT_FOUND_OR_FORBIDDEN" };
}

function uniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505",
  );
}

export async function createBusinessAuthorityProposalRecord(
  database: Database,
  actorProfileId: string,
  providerUserId: string,
  input: GovernedAuthorityProposalInput,
  correlationId: string,
): Promise<BusinessAuthorityMutationResult> {
  try {
    const [, , , result] = await database.batch([
      database.execute(sql`set transaction isolation level read committed`),
      database.execute(
        businessAuthorityActorContextSql(
          actorProfileId,
          providerUserId,
          correlationId,
          null,
        ),
      ),
      database.execute(
        businessAuthorityProposalLockSql(
          input.authorityKey,
          input.environmentScope,
        ),
      ),
      database.execute<MutationRow>(
        proposalMutationSql(actorProfileId, input, correlationId),
      ),
    ]);
    return mutationResult(result.rows[0]);
  } catch (error) {
    if (uniqueViolation(error)) return { status: "CONFLICT" };
    throw error;
  }
}

export async function transitionBusinessAuthorityRecord(
  database: Database,
  actorProfileId: string,
  providerUserId: string,
  input: GovernedAuthorityDecisionInput,
  correlationId: string,
  supersessionCorrelationId: string,
): Promise<BusinessAuthorityMutationResult> {
  try {
    const [, , , result] = await database.batch([
      database.execute(sql`set transaction isolation level read committed`),
      database.execute(
        businessAuthorityActorContextSql(
          actorProfileId,
          providerUserId,
          correlationId,
          supersessionCorrelationId,
        ),
      ),
      database.execute(
        businessAuthorityTransitionLockSql(input.recordId),
      ),
      database.execute<MutationRow>(
        transitionMutationSql(
          actorProfileId,
          input,
          correlationId,
          supersessionCorrelationId,
        ),
      ),
    ]);
    return mutationResult(result.rows[0]);
  } catch (error) {
    if (uniqueViolation(error)) return { status: "CONFLICT" };
    throw error;
  }
}

export function createDatabaseBusinessAuthorityRepository(
  database: Database,
  providerUserId?: string,
): BusinessAuthorityRepository {
  const mutationProviderUserId = (): string => {
    const normalized = providerUserId?.trim();
    if (!normalized || normalized.length > 255) {
      throw new Error("Business-authority actor context is unavailable.");
    }
    return normalized;
  };
  return {
    listState: (actorProfileId) =>
      listBusinessAuthorityState(database, actorProfileId),
    createProposal: (actorProfileId, input, correlationId) =>
      createBusinessAuthorityProposalRecord(
        database,
        actorProfileId,
        mutationProviderUserId(),
        input,
        correlationId,
      ),
    transition: (
      actorProfileId,
      input,
      correlationId,
      supersessionCorrelationId,
    ) =>
      transitionBusinessAuthorityRecord(
        database,
        actorProfileId,
        mutationProviderUserId(),
        input,
        correlationId,
        supersessionCorrelationId,
      ),
  };
}
