import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationName = "0016_phase_3n_business_authority.sql";

function migrationStatements(sql: string): string[] {
  return sql
    .split(/\s*--> statement-breakpoint\s*/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

const priorChecksums = {
  "0000_initialize_system_metadata.sql": "4f1bd455521b0546fb2aac66675347c68ecd761e88db35932f9b063eea1612d8",
  "0001_add_service_catalogue.sql": "82c358c2cd23ead4e2e88aff76419045e7fd5d31523e1bddd17b963c5237cc53",
  "0002_add_commercial_engine.sql": "57a638063cf4bcc870af51c21e477a5d4c3ffe73172fe1604dec0e7908c8832b",
  "0003_add_availability_capacity.sql": "9a7bdace95a77714d5a7050272b76ee2c60b1f10a1cf1b11cb34c04e04c45a84",
  "0004_add_identity_access.sql": "d5a2aeaa86e719759d5c7c10f65758b348eebcefbd7486f2cdca7bc7a329795c",
  "0005_add_customer_property_crm.sql": "36a13247e4a5475db3917dcbcf6d7092a5373c98e935af07dc9fb4e894d6fb8c",
  "0006_phase_3d_request_quote.sql": "4a1e002b5a1896629041328ca4c00e434232023afdefd11cf73b473e462cbf6e",
  "0007_phase_3e_booking_engine.sql": "c412a89227c7a54f0e7d812797a78d74ac7d65a370951d9f6a42fd77414fc6c2",
  "0008_phase_3f_job_execution.sql": "1e2de59c546b9f52f430b71a04d0461528a05d8ffea2e33bd1332e668b4bc9f9",
  "0009_phase_3g_scheduling_dispatch.sql": "89164bdf1a97e44ae4e8b048e63ffa1a063eb5ad185dcb9a0878f401163c81b7",
  "0010_phase_3h_finance_invoicing.sql": "ea06e7cb322f7b67f65bc45b7d6da78d6d0e8551d84a25c182d40fbf05955324",
  "0011_phase_3i_communications_documents.sql": "a82f5a727d2f80d8b467b3ab1dbb05d7ddea8985fd80299b536e6e3564c145f8",
  "0012_phase_3k_database_security.sql": "4ce1cf05447457ed6ba647505c694ad16461869e15f00230cf884afa75c624fb",
  "0013_phase_3k_runtime_locking.sql": "d6bf486d01734cc61a334171dc52be76209a39a1c0cdb4ee2c5dfcfa059cdbb6",
  "0014_phase_3l_shared_rate_limiting.sql": "d89eb981700427987f5e812ee7ff33ae7d30223776c0a617313520de5db9ccfc",
  "0015_phase_3l_readiness_attestation.sql": "502a03b6d2b20954f601feb244c90e75b40cf46f0033e8cfaf9f87786080c4b1",
} as const;

describe("Phase 3N migration boundary", () => {
  it("preserves every Phase 0-3M migration byte-for-byte", async () => {
    for (const [name, expected] of Object.entries(priorChecksums)) {
      const bytes = await readFile(path.join(root, "drizzle", name));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(expected);
    }
  });

  it("adds only the authority tables plus the explicit finance staging scope", async () => {
    const sql = await readFile(path.join(root, "drizzle", migrationName), "utf8");
    expect([...sql.matchAll(/CREATE TABLE /g)]).toHaveLength(2);
    expect(sql).toContain('CREATE TABLE "business_authority_records"');
    expect(sql).toContain('CREATE TABLE "business_authority_audit_events"');
    expect(sql).toContain("in ('DEVELOPMENT', 'STAGING', 'PRODUCTION')");
    expect(sql).not.toMatch(/ALTER TABLE "(?:quotes|bookings|jobs|invoice_items|documents)"/);
    expect(sql).not.toMatch(/INSERT\s+INTO\s+(?:public\.)?(?:price|seller|invoice|business_authority)/i);
    expect(sql).not.toMatch(/neon_auth\s*\./);
    expect(sql).not.toMatch(/CREATE\s+ROLE/i);
  });

  it("enforces no self-activation, immutable audit and exact transition evidence", async () => {
    const sql = await readFile(path.join(root, "drizzle", migrationName), "utf8");
    expect([...sql.matchAll(/CREATE FUNCTION public\.vax_business_authority_/g)]).toHaveLength(4);
    expect([...sql.matchAll(/CREATE (?:CONSTRAINT )?TRIGGER vax_business_authority_/g)]).toHaveLength(4);
    expect(sql).toContain("business-authority records must start as PROPOSED");
    expect(sql).toContain("runtime cannot self-assert system-verified authority");
    expect(sql).toContain("business-authority content is immutable; create a new version");
    expect(sql).toContain("business-authority audit events are append-only");
    expect(sql).toContain("business-authority transition lacks exact audit evidence");
    expect(sql).toContain("target_event.record_version <> target_record.record_version");
    expect(sql).toContain(
      "target_event.correlation_id <> target_record.transition_correlation_id",
    );
    expect(sql).toContain(
      "target_event.previous_status IS DISTINCT FROM prior_event.next_status",
    );
    expect(sql).toContain("business-authority audit transition lacks prior state");
    expect(sql).toContain("business-authority audit transition chain is invalid");
    expect(sql).toContain("business-authority audit approval type is duplicated");
    expect(sql).toContain("business-authority transition requires an active Owner");
    expect(sql).toContain("business-authority approval is incomplete");
    expect(sql).toContain(
      "replacement.effective_from >= target_record.effective_from",
    );
    expect(sql).toContain("business-authority supersession chronology is invalid");
    expect(sql).toContain("business-authority supersession target is invalid");
  });

  it("binds every runtime transition to a fresh signed actor context exactly once", async () => {
    const sql = await readFile(path.join(root, "drizzle", migrationName), "utf8");

    expect(sql).toContain(
      "CREATE FUNCTION public.vax_business_authority_assert_actor_context(",
    );
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = pg_catalog, pg_temp");
    expect(sql).toContain("session_user <> 'vax_runtime'");
    expect(sql).toContain("vax.business_authority.actor_profile_id");
    expect(sql).toContain("vax.business_authority.provider_user_id");
    expect(sql).toContain("vax.business_authority.primary_correlation_id");
    expect(sql).toContain("vax.business_authority.secondary_correlation_id");
    expect(sql).toContain("vax.business_authority.issued_at");
    expect(sql).toContain("vax.business_authority.signature");
    expect(sql).toContain("public.hmac(");
    expect(sql).toContain("profile.auth_provider_user_id = provider_user_id");
    expect(sql).toContain("permission.code = 'SYSTEM_SETTINGS_MANAGE'");
    expect(sql).toContain("role.code = 'OWNER'");
    expect(sql).toContain("business_authority_actor_context_use:");
    expect(sql).toContain(
      "metadata.value->>'transactionId' = txid_current()::text",
    );
    expect(sql).toContain(
      "PERFORM public.vax_business_authority_assert_actor_context(",
    );
    expect(sql).toContain("TO vax_runtime");
    expect(sql).not.toContain("NEON_AUTH_COOKIE_SECRET");
  });

  it("uses valid PostgreSQL syntax for multi-function privilege revocation", async () => {
    const sql = await readFile(path.join(root, "drizzle", migrationName), "utf8");
    const revoke = migrationStatements(sql).find(
      (statement) =>
        statement.startsWith("REVOKE ALL PRIVILEGES") &&
        statement.includes("vax_business_authority_guard_record"),
    );

    expect(revoke).toBeDefined();
    expect(revoke).not.toMatch(/,\s*FUNCTION\s/i);
    expect(revoke).toContain(
      "ON FUNCTION public.vax_business_authority_guard_record(),\n" +
        "  public.vax_business_authority_guard_audit(),\n" +
        "  public.vax_business_authority_validate_graph()",
    );
  });

  it("retains the exact prior snapshot and a 100-table Drizzle model", async () => {
    const snapshot = JSON.parse(
      await readFile(path.join(root, "drizzle/meta/0016_snapshot.json"), "utf8"),
    ) as { prevId: string; tables: Record<string, unknown> };
    expect(snapshot.prevId).toBe("3026c573-a874-48f8-9203-d5e3cba4881d");
    expect(Object.keys(snapshot.tables)).toHaveLength(100);
  });
});
