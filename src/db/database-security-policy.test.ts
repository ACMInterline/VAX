import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";
import {
  databaseSecurityTablePolicy,
  type RuntimeTablePrivilege,
  vaxDatabaseTableNames,
  vaxMigrationHashes,
  vaxOperationalFunctionNames,
  vaxRuntimeLockPolicy,
  vaxRuntimeLockTableNames,
  vaxTriggerFunctionNames,
} from "./database-security-policy";

const root = process.cwd();
const migrationPath = path.join(
  root,
  "drizzle/0012_phase_3k_database_security.sql",
);
const lockingMigrationPath = path.join(
  root,
  "drizzle/0013_phase_3k_runtime_locking.sql",
);
const operationalMigrationPath = path.join(
  root,
  "drizzle/0014_phase_3l_shared_rate_limiting.sql",
);
const readinessMigrationPath = path.join(
  root,
  "drizzle/0015_phase_3l_readiness_attestation.sql",
);

const priorMigrationChecksums = {
  "0000_initialize_system_metadata.sql":
    "4f1bd455521b0546fb2aac66675347c68ecd761e88db35932f9b063eea1612d8",
  "0001_add_service_catalogue.sql":
    "82c358c2cd23ead4e2e88aff76419045e7fd5d31523e1bddd17b963c5237cc53",
  "0002_add_commercial_engine.sql":
    "57a638063cf4bcc870af51c21e477a5d4c3ffe73172fe1604dec0e7908c8832b",
  "0003_add_availability_capacity.sql":
    "9a7bdace95a77714d5a7050272b76ee2c60b1f10a1cf1b11cb34c04e04c45a84",
  "0004_add_identity_access.sql":
    "d5a2aeaa86e719759d5c7c10f65758b348eebcefbd7486f2cdca7bc7a329795c",
  "0005_add_customer_property_crm.sql":
    "36a13247e4a5475db3917dcbcf6d7092a5373c98e935af07dc9fb4e894d6fb8c",
  "0006_phase_3d_request_quote.sql":
    "4a1e002b5a1896629041328ca4c00e434232023afdefd11cf73b473e462cbf6e",
  "0007_phase_3e_booking_engine.sql":
    "c412a89227c7a54f0e7d812797a78d74ac7d65a370951d9f6a42fd77414fc6c2",
  "0008_phase_3f_job_execution.sql":
    "1e2de59c546b9f52f430b71a04d0461528a05d8ffea2e33bd1332e668b4bc9f9",
  "0009_phase_3g_scheduling_dispatch.sql":
    "89164bdf1a97e44ae4e8b048e63ffa1a063eb5ad185dcb9a0878f401163c81b7",
  "0010_phase_3h_finance_invoicing.sql":
    "ea06e7cb322f7b67f65bc45b7d6da78d6d0e8551d84a25c182d40fbf05955324",
  "0011_phase_3i_communications_documents.sql":
    "a82f5a727d2f80d8b467b3ab1dbb05d7ddea8985fd80299b536e6e3564c145f8",
  "0012_phase_3k_database_security.sql":
    "4ce1cf05447457ed6ba647505c694ad16461869e15f00230cf884afa75c624fb",
  "0013_phase_3k_runtime_locking.sql":
    "d6bf486d01734cc61a334171dc52be76209a39a1c0cdb4ee2c5dfcfa059cdbb6",
} as const;

function schemaTableNames(): readonly string[] {
  return [
    ...new Set(
      Object.values(schema)
        .filter((value) => is(value, PgTable))
        .map((table) => getTableName(table as PgTable)),
    ),
  ].sort();
}

function migrationPolicy(contents: string) {
  return Object.fromEntries(
    [...contents.matchAll(
      /\('([a-z][a-z0-9_]*)', (true|false), (true|false), (true|false), (true|false)\)/g,
    )].map((match) => [
      match[1],
      ["SELECT", "INSERT", "UPDATE", "DELETE"].filter(
        (_, index) => match[index + 2] === "true",
      ),
    ]),
  );
}

describe("Phase 3K database security policy", () => {
  it("classifies every VAX table exactly once", () => {
    expect(vaxDatabaseTableNames).toHaveLength(98);
    expect(vaxDatabaseTableNames).toEqual(schemaTableNames());
    expect(
      Object.values(databaseSecurityTablePolicy).every(
        (policy) => policy.category.length > 0,
      ),
    ).toBe(true);
  });

  it("keeps immutable/history records free of runtime UPDATE and DELETE", () => {
    const violations = Object.entries(databaseSecurityTablePolicy)
      .filter(([, policy]) => policy.immutable)
      .filter(([, policy]) =>
        policy.runtime.some(
          (privilege) => privilege === "UPDATE" || privilege === "DELETE",
        ),
      );

    expect(violations).toEqual([]);
    expect(
      Object.entries(databaseSecurityTablePolicy)
        .filter(([, policy]) =>
          (policy.runtime as readonly RuntimeTablePrivilege[]).includes(
            "DELETE",
          ),
        )
        .map(([table]) => table)
        .sort(),
    ).toEqual([
      "operational_rate_limits",
      "quote_items",
      "service_request_item_addons",
      "service_request_item_issues",
    ]);
  });

  it("keeps the SQL migration synchronized with the reviewed DML matrix", async () => {
    const contents = await readFile(migrationPath, "utf8");
    const expected = Object.fromEntries(
      Object.entries(databaseSecurityTablePolicy)
        .filter(([table]) => table !== "operational_rate_limits")
        .map(([table, policy]) => [table, [...policy.runtime]]),
    );

    expect(migrationPolicy(contents)).toEqual(expected);
    expect(contents).toContain("ENABLE ROW LEVEL SECURITY");
    expect(contents).not.toContain("FORCE ROW LEVEL SECURITY");
    expect(contents).not.toMatch(/neon_auth\s*\./);
    expect(contents).not.toMatch(/CREATE\s+ROLE/i);
  });

  it("applies explicit least-privilege security to the shared rate-limit table", async () => {
    const contents = await readFile(operationalMigrationPath, "utf8");

    expect(contents).toContain(
      "Phase 3L rate-limit migration requires vax_migrator",
    );
    expect(contents).toContain(
      "ALTER TABLE public.operational_rate_limits ENABLE ROW LEVEL SECURITY",
    );
    expect(contents).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE",
    );
    expect(contents).toContain("TO vax_runtime");
    expect(contents).toContain("FROM PUBLIC, authenticated, anonymous, vax_runtime");
    expect(contents).toContain("FOR DELETE TO vax_runtime USING (resets_at <= clock_timestamp())");
    expect(contents).not.toContain("FORCE ROW LEVEL SECURITY");
    expect(contents).not.toMatch(/neon_auth\s*\./);
    expect(contents).not.toMatch(/CREATE\s+ROLE/i);
  });

  it("revokes direct invocation of every VAX trigger function", async () => {
    const contents = await readFile(migrationPath, "utf8");
    for (const functionName of vaxTriggerFunctionNames) {
      expect(contents).toContain(`'${functionName}'`);
    }
    expect(contents).toContain(
      "FROM PUBLIC, vax_runtime",
    );
  });

  it("exposes only a narrow migration-ledger attestation to runtime", async () => {
    const contents = await readFile(readinessMigrationPath, "utf8");

    expect(vaxOperationalFunctionNames).toEqual([
      "vax_migration_history_hashes",
    ]);
    expect(contents).toContain("SECURITY DEFINER");
    expect(contents).toContain("SET search_path = pg_catalog, pg_temp");
    expect(contents).toContain("FROM drizzle.__drizzle_migrations");
    expect(contents).toContain("FROM PUBLIC, authenticated, anonymous");
    expect(contents).toContain("TO vax_runtime");
    expect(contents).not.toContain("GRANT SELECT");
    expect(contents).not.toMatch(/neon_auth\s*\./);
  });

  it("keeps repository row locks distinct from runtime UPDATE authority", async () => {
    expect(vaxRuntimeLockTableNames).toHaveLength(28);
    for (const tableName of vaxRuntimeLockTableNames) {
      expect(databaseSecurityTablePolicy[tableName].runtime).toContain(
        "SELECT",
      );
      expect(databaseSecurityTablePolicy[tableName].runtime).not.toContain(
        "UPDATE",
      );
    }

    const contents = await readFile(lockingMigrationPath, "utf8");
    const migratedPolicy = [
      ...contents.matchAll(
        /\('([a-z][a-z0-9_]*)', '([a-z][a-z0-9_]*)'\)/g,
      ),
    ].map((match) => ({
      tableName: match[1],
      columnName: match[2],
    }));
    expect(migratedPolicy).toEqual(vaxRuntimeLockPolicy);
    expect(contents).toContain("GRANT UPDATE (%I)");
    expect(contents).toContain("WITH CHECK (false)");
    expect(contents).not.toContain("GRANT UPDATE ON TABLE");
  });

  it("preserves every prior migration byte-for-byte", async () => {
    for (const [fileName, expected] of Object.entries(
      priorMigrationChecksums,
    )) {
      const contents = await readFile(path.join(root, "drizzle", fileName));
      expect(createHash("sha256").update(contents).digest("hex")).toBe(
        expected,
      );
    }
  });

  it("keeps the runtime readiness hash contract synchronized", async () => {
    const migrationFiles = [
      "0000_initialize_system_metadata.sql",
      "0001_add_service_catalogue.sql",
      "0002_add_commercial_engine.sql",
      "0003_add_availability_capacity.sql",
      "0004_add_identity_access.sql",
      "0005_add_customer_property_crm.sql",
      "0006_phase_3d_request_quote.sql",
      "0007_phase_3e_booking_engine.sql",
      "0008_phase_3f_job_execution.sql",
      "0009_phase_3g_scheduling_dispatch.sql",
      "0010_phase_3h_finance_invoicing.sql",
      "0011_phase_3i_communications_documents.sql",
      "0012_phase_3k_database_security.sql",
      "0013_phase_3k_runtime_locking.sql",
      "0014_phase_3l_shared_rate_limiting.sql",
      "0015_phase_3l_readiness_attestation.sql",
    ];
    const hashes = await Promise.all(
      migrationFiles.map(async (fileName) =>
        createHash("sha256")
          .update(await readFile(path.join(root, "drizzle", fileName)))
          .digest("hex"),
      ),
    );

    expect(hashes).toEqual(vaxMigrationHashes);
  });

  it("registers Phase 3L directly after both Phase 3K migrations", async () => {
    const journal = JSON.parse(
      await readFile(path.join(root, "drizzle/meta/_journal.json"), "utf8"),
    ) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries.slice(-5)).toEqual([
      {
        idx: 11,
        version: "7",
        when: 1787784768012,
        tag: "0011_phase_3i_communications_documents",
        breakpoints: true,
      },
      {
        idx: 12,
        version: "7",
        when: 1787851719777,
        tag: "0012_phase_3k_database_security",
        breakpoints: true,
      },
      {
        idx: 13,
        version: "7",
        when: 1787854657991,
        tag: "0013_phase_3k_runtime_locking",
        breakpoints: true,
      },
      {
        idx: 14,
        version: "7",
        when: 1787866611886,
        tag: "0014_phase_3l_shared_rate_limiting",
        breakpoints: true,
      },
      {
        idx: 15,
        version: "7",
        when: 1787875198634,
        tag: "0015_phase_3l_readiness_attestation",
        breakpoints: true,
      },
    ]);
  });
});
