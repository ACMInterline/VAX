import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getBusinessAuthorityDefinition } from "./registry";
import { deriveBusinessAuthorityActorContextKey } from "./actor-context";
import {
  activeBusinessAuthorityOwnerSql,
  businessAuthorityActorContextSql,
  businessAuthorityProposalLockSql,
  businessAuthorityTransitionLockSql,
  proposalMutationSql,
  transitionMutationSql,
} from "./repository";

const dialect = new PgDialect();
const actorId = "10000000-0000-4000-8000-000000000001";
const recordId = "20000000-0000-4000-8000-000000000001";
const actorContextEnvironment = {
  VAX_ENVIRONMENT: "staging",
  NEON_AUTH_COOKIE_SECRET:
    "synthetic-test-cookie-secret-that-is-never-used-outside-tests",
};

function compile(query: SQL) {
  return dialect.sqlToQuery(query);
}

describe("business-authority repository security SQL", () => {
  it("sets a signed transaction-local actor and correlation binding", () => {
    const primaryCorrelationId = "30000000-0000-4000-8000-000000000001";
    const secondaryCorrelationId = "40000000-0000-4000-8000-000000000001";
    const providerUserId = "synthetic-provider-subject";
    const compiled = compile(
      businessAuthorityActorContextSql(
        actorId,
        providerUserId,
        primaryCorrelationId,
        secondaryCorrelationId,
        actorContextEnvironment,
        1_788_217_600,
      ),
    );

    expect(compiled.sql).toContain(
      "set_config('vax.business_authority.actor_profile_id'",
    );
    expect(compiled.sql).toContain(
      "set_config('vax.business_authority.provider_user_id'",
    );
    expect(compiled.sql).toContain(
      "set_config('vax.business_authority.primary_correlation_id'",
    );
    expect(compiled.sql).toContain(
      "set_config('vax.business_authority.secondary_correlation_id'",
    );
    expect(compiled.sql).toContain(
      "set_config('vax.business_authority.issued_at'",
    );
    expect(compiled.sql).toContain(
      "set_config('vax.business_authority.signature'",
    );
    expect(compiled.params).toEqual(
      expect.arrayContaining([
        actorId,
        providerUserId,
        primaryCorrelationId,
        secondaryCorrelationId,
        "1788217600",
        expect.stringMatching(/^[0-9a-f]{64}$/),
      ]),
    );
    expect(compiled.params).not.toContain(
      actorContextEnvironment.NEON_AUTH_COOKIE_SECRET,
    );
    expect(compiled.params).not.toContain(
      deriveBusinessAuthorityActorContextKey(actorContextEnvironment),
    );
  });

  it("rechecks active protected Owner authority at the database boundary", () => {
    const compiled = compile(activeBusinessAuthorityOwnerSql(actorId));
    expect(compiled.sql).toContain("actor_profile.status = 'ACTIVE'");
    expect(compiled.sql).toContain("actor_assignment.active = true");
    expect(compiled.sql).toContain("actor_role.active = true");
    expect(compiled.sql).toContain("actor_permission.active = true");
    expect(compiled.sql).toContain("owner_role.code = 'OWNER'");
    expect(compiled.params).toEqual(
      expect.arrayContaining([actorId, "SYSTEM_SETTINGS_MANAGE"]),
    );
  });

  it("creates only a proposed version and its append-only audit event", () => {
    const definition = getBusinessAuthorityDefinition("WORKING_HOURS")!;
    const compiled = compile(
      proposalMutationSql(
        actorId,
        {
          authorityKey: definition.key,
          definition,
          environmentScope: "STAGING",
          value: {
            kind: "CONFIG_REFERENCE",
            subjectType: "WORKING_HOURS",
            subjectCode: "STAGING_V1",
            subjectVersion: 1,
            contentSha256:
              "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          },
          sourceReference: null,
          safeEvidenceSummary: "Owner-provided staging proposal.",
          internalNotes: null,
          effectiveFrom: new Date("2026-09-01T00:00:00Z"),
          effectiveUntil: null,
        },
        "30000000-0000-4000-8000-000000000001",
      ),
    );
    expect(compiled.sql).toContain('insert into "business_authority_records"');
    expect(compiled.sql).toContain(
      'insert into "business_authority_audit_events"',
    );
    expect(compiled.sql).toContain("'PROPOSED'");
    expect(compiled.sql).toContain("'AUTHORITY_PROPOSED'");
    expect(compiled.sql).not.toContain("production_ready");
  });

  it("serializes proposals and approvals on the same authority-version lock", () => {
    const proposalLock = compile(
      businessAuthorityProposalLockSql("WORKING_HOURS", "STAGING"),
    );
    const transitionLock = compile(businessAuthorityTransitionLockSql(recordId));

    expect(proposalLock.params).toContain(
      "business-authority:WORKING_HOURS:STAGING",
    );
    expect(transitionLock.sql).toContain("locked_authority.authority_key");
    expect(transitionLock.sql).toContain("locked_authority.environment_scope");
    expect(transitionLock.params).toContain(recordId);
  });

  it("locks and rechecks version, environment, approval evidence and supersession atomically", () => {
    const compiled = compile(
      transitionMutationSql(
        actorId,
        {
          recordId,
          expectedAuthorityVersion: 7,
          expectedRecordVersion: 2,
          expectedContentHash: "a".repeat(64),
          productionDependencySnapshot: {
            configurationReferenceCount: 0,
            records: [
              {
                id: "60000000-0000-4000-8000-000000000001",
                authorityKey: "BUSINESS_CONTACT_DETAILS",
                version: 3,
                recordVersion: 4,
                contentHash: "b".repeat(64),
                status: "APPROVED_FOR_PRODUCTION",
              },
            ],
          },
          action: "APPROVE",
          decisionAuthorityType: "ACCOUNTANT",
          evidenceReference: "ACCOUNTANT-REVIEW-001",
          safeEvidenceSummary: "External review recorded.",
        },
        "40000000-0000-4000-8000-000000000001",
        "50000000-0000-4000-8000-000000000001",
      ),
    );
    expect(compiled.sql).toContain("for update of record");
    expect(compiled.sql).toContain("for update of prior");
    expect(compiled.sql).toContain("record.record_version =");
    expect(compiled.sql).toContain("record.version =");
    expect(compiled.sql).toContain("public.digest");
    expect(compiled.sql).toContain("record.authority_value");
    expect(compiled.sql).toContain("dependency_expectations");
    expect(compiled.sql).toContain("for share of dependency");
    expect(compiled.sql).toContain("dependency.effective_until");
    expect(compiled.params).toContainEqual(
      expect.stringContaining('"content_hash":"bbbbbbbb'),
    );
    expect(compiled.params).toContain("a".repeat(64));
    expect(compiled.sql).toContain(
      "target.environment_scope in ('STAGING', 'PRODUCTION')",
    );
    expect(compiled.sql).toContain("target.required_authority_types ?");
    expect(compiled.sql).toContain(
      "current_authority.effective_from > target.effective_from",
    );
    expect(compiled.sql).toContain(
      "newer_authority.version > record.version",
    );
    expect(compiled.sql).toContain(
      "prior.effective_from <= transition.effective_from",
    );
    expect(compiled.sql).toContain("AUTHORITY_APPROVAL_RECORDED");
    expect(compiled.sql).toContain("AUTHORITY_SUPERSEDED");
    expect(compiled.sql).not.toContain('update "quotes"');
    expect(compiled.sql).not.toContain('update "bookings"');
    expect(compiled.sql).not.toContain('update "invoices"');
    expect(compiled.sql).not.toContain('update "documents"');
  });
});
