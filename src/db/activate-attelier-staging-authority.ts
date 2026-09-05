import "server-only";

import { sql } from "drizzle-orm";
import { getAuthRuntimeConfiguration } from "@/auth/config";
import { getDatabase } from "./client";
import {
  assertNonProductionDatabaseIdentity,
  assertNonProductionDatabaseMutationTarget,
} from "./migration-environment";
import {
  assertStagingAuthenticationTarget,
  loadStagingEnvironment,
  loadStagingTargetAuthorization,
} from "./staging-environment";
import { attelierStagingAuthorityPlan } from "@/modules/business-authority/attelier-staging-plan";
import { createDatabaseBusinessAuthorityRepository } from "@/modules/business-authority/repository";
import { createBusinessAuthorityService } from "@/modules/business-authority/service";
import type {
  AuthorityType,
  BusinessAuthorityActor,
  BusinessAuthorityRecord,
} from "@/modules/business-authority/types";

type OwnerRow = Readonly<{
  profileId: string;
  providerUserId: string;
}>;

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalValue(entry)]),
    );
  }
  return value;
}

function valuesMatch(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalValue(left)) === JSON.stringify(canonicalValue(right));
}

async function resolveUniqueStagingOwner(): Promise<OwnerRow> {
  const database = getDatabase();
  const result = await database.execute<OwnerRow>(sql`
    select profile.id::text as "profileId",
      profile.auth_provider_user_id as "providerUserId"
    from public.user_profiles profile
    join public.user_roles assignment
      on assignment.user_profile_id = profile.id
     and assignment.active = true
    join public.application_roles role
      on role.id = assignment.role_id
     and role.active = true
     and role.code = 'OWNER'
    where profile.status = 'ACTIVE'
      and exists (
        select 1
        from public.user_roles permission_assignment
        join public.application_roles permission_role
          on permission_role.id = permission_assignment.role_id
         and permission_role.active = true
        join public.role_permissions mapping
          on mapping.role_id = permission_role.id
        join public.permissions permission
          on permission.id = mapping.permission_id
         and permission.active = true
         and permission.code = 'SYSTEM_SETTINGS_MANAGE'
        where permission_assignment.user_profile_id = profile.id
          and permission_assignment.active = true
      )
    order by profile.id
  `);
  if (result.rows.length !== 1 || !result.rows[0]?.providerUserId.trim()) {
    throw new Error("A unique active staging Owner could not be proven.");
  }
  return result.rows[0];
}

function exactExistingRecord(
  records: readonly BusinessAuthorityRecord[],
  authorityKey: string,
  value: unknown,
  effectiveFrom: Date,
): BusinessAuthorityRecord | null {
  const relevant = records.filter(
    (record) =>
      record.authorityKey === authorityKey &&
      record.environmentScope === "STAGING" &&
      record.status !== "REJECTED" &&
      record.status !== "SUPERSEDED",
  );
  if (relevant.length === 0) return null;
  if (
    relevant.length !== 1 ||
    !valuesMatch(relevant[0]!.value, value) ||
    relevant[0]!.effectiveFrom.getTime() !== effectiveFrom.getTime()
  ) {
    throw new Error(`Existing staging authority diverges for ${authorityKey}.`);
  }
  return relevant[0]!;
}

function approvalTypesForRecord(
  state: Awaited<
    ReturnType<ReturnType<typeof createBusinessAuthorityService>["listState"]>
  >,
  recordId: string,
): Set<AuthorityType> {
  return new Set(
    state.events
      .filter(
        (event) =>
          event.authorityRecordId === recordId &&
          (event.eventType === "AUTHORITY_APPROVAL_RECORDED" ||
            event.eventType === "AUTHORITY_APPROVED") &&
          event.decisionAuthorityType !== null,
      )
      .map((event) => event.decisionAuthorityType!),
  );
}

export async function activateAttelierStagingAuthority(): Promise<void> {
  await loadStagingEnvironment();
  const target = await loadStagingTargetAuthorization();
  assertNonProductionDatabaseMutationTarget(process.env, "runtime", target);
  assertStagingAuthenticationTarget(
    target,
    getAuthRuntimeConfiguration(process.env).baseUrl,
  );
  const database = getDatabase();
  await assertNonProductionDatabaseIdentity(
    database,
    "runtime",
    process.env,
    target,
  );

  const owner = await resolveUniqueStagingOwner();
  const actor: BusinessAuthorityActor = {
    profileId: owner.profileId,
    status: "ACTIVE",
    roles: new Set(["OWNER"]),
    permissions: new Set(["SYSTEM_SETTINGS_READ", "SYSTEM_SETTINGS_MANAGE"]),
  };
  const service = createBusinessAuthorityService(
    createDatabaseBusinessAuthorityRepository(database, owner.providerUserId),
  );

  for (const item of attelierStagingAuthorityPlan) {
    let state = await service.listState(actor);
    let record = exactExistingRecord(
      state.records,
      item.proposal.authorityKey,
      item.proposal.value,
      item.proposal.effectiveFrom,
    );
    if (!record) {
      const created = await service.propose(actor, item.proposal);
      state = await service.listState(actor);
      record = state.records.find((candidate) => candidate.id === created.recordId) ?? null;
      if (!record) throw new Error("Created authority record is unavailable.");
    }

    if (record.status === "PROPOSED") {
      await service.decide(actor, {
        recordId: record.id,
        expectedAuthorityVersion: record.version,
        expectedRecordVersion: record.recordVersion,
        expectedContentHash: record.contentHash,
        action: "SUBMIT_FOR_REVIEW",
        decisionAuthorityType: null,
        evidenceReference: null,
        safeEvidenceSummary: null,
      });
    }

    for (const authorityType of item.approvalAuthorityTypes) {
      state = await service.listState(actor);
      record = state.records.find((candidate) => candidate.id === record!.id) ?? null;
      if (!record) throw new Error("Authority record disappeared during activation.");
      if (approvalTypesForRecord(state, record.id).has(authorityType)) continue;
      if (record.status !== "UNDER_REVIEW") {
        throw new Error("Authority record reached an unexpected status.");
      }
      await service.decide(actor, {
        recordId: record.id,
        expectedAuthorityVersion: record.version,
        expectedRecordVersion: record.recordVersion,
        expectedContentHash: record.contentHash,
        action: "APPROVE",
        decisionAuthorityType: authorityType,
        evidenceReference: item.proposal.sourceReference,
        safeEvidenceSummary: `${authorityType} attestation recorded for the exact ATTELIER staging proposal.`,
      });
    }

    state = await service.listState(actor);
    record = state.records.find((candidate) => candidate.id === record!.id) ?? null;
    if (!record || record.status !== item.expectedStatus) {
      throw new Error("ATTELIER staging authority activation did not reach its reviewed status.");
    }
  }

  const finalState = await service.listState(actor);
  const approvedKeys = new Set(
    finalState.records
      .filter((record) => record.status === "APPROVED_FOR_STAGING")
      .map((record) => record.authorityKey),
  );
  const pendingKeys = new Set(
    finalState.records
      .filter((record) => record.status === "UNDER_REVIEW")
      .map((record) => record.authorityKey),
  );
  if (
    finalState.records.some(
      (record) =>
        record.environmentScope !== "STAGING" ||
        record.status === "APPROVED_FOR_PRODUCTION",
    ) ||
    attelierStagingAuthorityPlan.some((item) =>
      item.expectedStatus === "APPROVED_FOR_STAGING"
        ? !approvedKeys.has(item.proposal.authorityKey)
        : !pendingKeys.has(item.proposal.authorityKey),
    )
  ) {
    throw new Error("Final ATTELIER authority state did not verify safely.");
  }

  process.stdout.write(
    `ATTELIER staging authority verified: ${approvedKeys.size} approved and ${pendingKeys.size} under review; production unchanged.\n`,
  );
}
