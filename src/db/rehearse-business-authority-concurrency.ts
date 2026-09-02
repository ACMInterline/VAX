import "server-only";

import { randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { Client } from "pg";
import { getBusinessAuthorityDefinition } from "@/modules/business-authority/registry";
import {
  businessAuthorityActorContextSql,
  businessAuthorityRecordContentHashSql,
  proposalMutationSql,
  transitionMutationSql,
} from "@/modules/business-authority/repository";

const dialect = new PgDialect();

type MutationRow = Readonly<{
  result: string;
  recordId: string | null;
}>;

function compile(query: SQL): Readonly<{ sql: string; params: unknown[] }> {
  const compiled = dialect.sqlToQuery(query);
  return { sql: compiled.sql, params: compiled.params };
}

async function executeSql<T extends Record<string, unknown>>(
  client: Client,
  query: SQL,
) {
  const compiled = compile(query);
  return client.query<T>(compiled.sql, compiled.params);
}

async function withTransaction<T>(
  client: Client,
  operation: () => Promise<T>,
): Promise<T> {
  await client.query("BEGIN");
  try {
    const result = await operation();
    await client.query("SET CONSTRAINTS ALL IMMEDIATE");
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function createSyntheticOwner(
  migrator: Client,
): Promise<Readonly<{ profileId: string; providerUserId: string }>> {
  const profileId = randomUUID();
  const providerUserId = `phase3n-disposable-owner-${randomUUID()}`;
  await migrator.query(
    `insert into public.user_profiles (
       id, auth_provider_user_id, display_name, preferred_locale, status
     ) values ($1, $2, 'Phase 3N disposable concurrency owner', 'en', 'ACTIVE')`,
    [profileId, providerUserId],
  );
  await migrator.query(
    `insert into public.user_roles (
       user_profile_id, role_id, active, assignment_source,
       assigned_by_profile_id
     ) select $1, id, true, 'OWNER_BOOTSTRAP', $1
       from public.application_roles where code = 'OWNER'`,
    [profileId],
  );
  return { profileId, providerUserId };
}

async function createUnderReviewRecord(
  runtimeUrl: string,
  actor: Readonly<{ profileId: string; providerUserId: string }>,
): Promise<Readonly<{ recordId: string; contentHash: string }>> {
  const definition = getBusinessAuthorityDefinition("BUSINESS_CONTACT_DETAILS");
  if (!definition) {
    throw new Error(
      "Business-authority concurrency definition is unavailable.",
    );
  }
  const client = new Client({ connectionString: runtimeUrl });
  await client.connect();
  try {
    const proposalCorrelationId = randomUUID();
    const recordId = await withTransaction(client, async () => {
      await executeSql(
        client,
        businessAuthorityActorContextSql(
          actor.profileId,
          actor.providerUserId,
          proposalCorrelationId,
          null,
        ),
      );
      await client.query("select pg_advisory_xact_lock(hashtext($1))", [
        `${definition.key}:STAGING`,
      ]);
      const result = await executeSql<MutationRow>(
        client,
        proposalMutationSql(
          actor.profileId,
          {
            authorityKey: definition.key,
            definition,
            environmentScope: "STAGING",
            value: {
              kind: "BUSINESS_CONTACT",
              businessName: "Phase 3N disposable rehearsal",
              email: null,
              phone: null,
              address: null,
              serviceAreaBg: "Само синтетична проверка в еднократна база.",
              serviceAreaEn: "Synthetic disposable-database rehearsal only.",
            },
            sourceReference: null,
            safeEvidenceSummary:
              "Synthetic disposable-database concurrency rehearsal.",
            internalNotes: null,
            effectiveFrom: new Date(),
            effectiveUntil: null,
          },
          proposalCorrelationId,
        ),
      );
      const mutation = result.rows[0];
      if (mutation?.result !== "CHANGED" || !mutation.recordId) {
        throw new Error("Business-authority proposal rehearsal failed.");
      }
      return mutation.recordId;
    });

    const content = await executeSql<{
      authorityVersion: number;
      contentHash: string;
    }>(
      client,
      sql`select record.version as "authorityVersion",
        ${businessAuthorityRecordContentHashSql(sql.raw("record"))}
          as "contentHash"
        from public.business_authority_records record
        where record.id = ${recordId}::uuid`,
    );
    if (
      content.rows[0]?.authorityVersion !== 1 ||
      !/^[a-f0-9]{64}$/.test(content.rows[0].contentHash)
    ) {
      throw new Error("Business-authority content binding is unavailable.");
    }

    const reviewCorrelationId = randomUUID();
    const reviewSupersessionCorrelationId = randomUUID();
    await withTransaction(client, async () => {
      await executeSql(
        client,
        businessAuthorityActorContextSql(
          actor.profileId,
          actor.providerUserId,
          reviewCorrelationId,
          reviewSupersessionCorrelationId,
        ),
      );
      await client.query("select pg_advisory_xact_lock(hashtext($1))", [
        `business-authority:${recordId}`,
      ]);
      const result = await executeSql<MutationRow>(
        client,
        transitionMutationSql(
          actor.profileId,
          {
            recordId,
            expectedAuthorityVersion: content.rows[0].authorityVersion,
            expectedRecordVersion: 0,
            expectedContentHash: content.rows[0].contentHash,
            action: "SUBMIT_FOR_REVIEW",
            decisionAuthorityType: null,
            evidenceReference: null,
            safeEvidenceSummary: null,
            productionDependencySnapshot: null,
          },
          reviewCorrelationId,
          reviewSupersessionCorrelationId,
        ),
      );
      if (result.rows[0]?.result !== "CHANGED") {
        throw new Error("Business-authority review rehearsal failed.");
      }
    });
    return { recordId, contentHash: content.rows[0].contentHash };
  } finally {
    await client.end();
  }
}

type PreparedApproval = Readonly<{
  client: Client;
  actor: Readonly<{ profileId: string; providerUserId: string }>;
  recordId: string;
  contentHash: string;
  correlationId: string;
  supersessionCorrelationId: string;
}>;

async function prepareApproval(
  runtimeUrl: string,
  actor: Readonly<{ profileId: string; providerUserId: string }>,
  recordId: string,
  contentHash: string,
): Promise<PreparedApproval> {
  const client = new Client({ connectionString: runtimeUrl });
  const correlationId = randomUUID();
  const supersessionCorrelationId = randomUUID();
  await client.connect();
  try {
    await client.query("BEGIN");
    await executeSql(
      client,
      businessAuthorityActorContextSql(
        actor.profileId,
        actor.providerUserId,
        correlationId,
        supersessionCorrelationId,
      ),
    );
    return {
      client,
      actor,
      recordId,
      contentHash,
      correlationId,
      supersessionCorrelationId,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    await client.end();
    throw error;
  }
}

async function completeApproval(
  prepared: PreparedApproval,
): Promise<Readonly<{ changed: boolean; correlationId: string }>> {
  const {
    client,
    actor,
    recordId,
    contentHash,
    correlationId,
    supersessionCorrelationId,
  } = prepared;
  try {
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [
      `business-authority:${recordId}`,
    ]);
    const result = await executeSql<MutationRow>(
      client,
      transitionMutationSql(
        actor.profileId,
        {
          recordId,
          expectedAuthorityVersion: 1,
          expectedRecordVersion: 1,
          expectedContentHash: contentHash,
          action: "APPROVE",
          decisionAuthorityType: "OWNER",
          evidenceReference: null,
          safeEvidenceSummary: "Synthetic disposable-database approval race.",
          productionDependencySnapshot: null,
        },
        correlationId,
        supersessionCorrelationId,
      ),
    );
    const changed = result.rows[0]?.result === "CHANGED";
    await client.query("SET CONSTRAINTS ALL IMMEDIATE");
    await client.query("COMMIT");
    return { changed, correlationId };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

export async function rehearseBusinessAuthorityApprovalRace(
  runtimeUrl: string,
  migrationUrl: string,
): Promise<void> {
  const migrator = new Client({ connectionString: migrationUrl });
  await migrator.connect();
  try {
    const actor = await createSyntheticOwner(migrator);
    const { recordId, contentHash } = await createUnderReviewRecord(
      runtimeUrl,
      actor,
    );
    const prepared = await Promise.all([
      prepareApproval(runtimeUrl, actor, recordId, contentHash),
      prepareApproval(runtimeUrl, actor, recordId, contentHash),
    ]);
    const attempts = await Promise.all(prepared.map(completeApproval));
    const successful = attempts.filter((attempt) => attempt.changed);
    if (successful.length !== 1) {
      throw new Error(
        "Duplicate business-authority approval was not serialized.",
      );
    }

    const state = await migrator.query<{
      status: string;
      record_version: number;
      approval_events: number;
      approval_correlation_id: string | null;
    }>(
      `select record.status, record.record_version,
         count(event.id) filter (
           where event.event_type = 'AUTHORITY_APPROVED'
             and event.decision_authority_type = 'OWNER'
         )::integer as approval_events,
         max(event.correlation_id::text) filter (
           where event.event_type = 'AUTHORITY_APPROVED'
             and event.decision_authority_type = 'OWNER'
         ) as approval_correlation_id
       from public.business_authority_records record
       left join public.business_authority_audit_events event
         on event.authority_record_id = record.id
       where record.id = $1
       group by record.id`,
      [recordId],
    );
    const row = state.rows[0];
    if (
      row?.status !== "APPROVED_FOR_STAGING" ||
      row.record_version !== 2 ||
      row.approval_events !== 1 ||
      row.approval_correlation_id !== successful[0]?.correlationId
    ) {
      throw new Error("Business-authority approval race audit diverged.");
    }
  } finally {
    await migrator.end();
  }
}
