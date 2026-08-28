import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/client";

vi.mock("server-only", () => ({}));

import {
  mutateAdminRole,
  mutateAdminStatus,
  type AdminMutationResult,
} from "./admin-repository";

const actorProfileId = "10000000-0000-4000-8000-000000000001";
const targetProfileId = "10000000-0000-4000-8000-000000000002";

function databaseDouble(result: AdminMutationResult) {
  const execute = vi.fn((query: SQL) => query);
  const batch = vi.fn(async () => [
    { rows: [] },
    { rows: [] },
    { rows: [{ result }] },
  ]);

  return {
    database: { execute, batch } as unknown as Database,
    execute,
    batch,
  };
}

function compiledStatements(execute: ReturnType<typeof vi.fn>): string[] {
  const dialect = new PgDialect();
  return execute.mock.calls.map(([query]) =>
    dialect.sqlToQuery(query as SQL).sql,
  );
}

describe("identity administration transaction serialization", () => {
  it.each(["ASSIGN", "REVOKE"] as const)(
    "acquires the advisory lock before the %s role snapshot",
    async (operation) => {
      const { database, execute, batch } = databaseDouble("CHANGED");

      await expect(
        mutateAdminRole(database, {
          actorProfileId,
          targetProfileId,
          role: "DISPATCHER",
          operation,
        }),
      ).resolves.toBe("CHANGED");

      expect(batch).toHaveBeenCalledOnce();
      const [isolationStatement, lockStatement, mutationStatement] =
        compiledStatements(execute);
      expect(isolationStatement).toBe(
        "set transaction isolation level read committed",
      );
      expect(lockStatement).toMatch(/select pg_advisory_xact_lock/);
      expect(mutationStatement).toMatch(/with actor as materialized/);
      expect(mutationStatement.match(/\$\d+::text/g)).toHaveLength(10);
      expect(mutationStatement).not.toContain("pg_advisory_xact_lock");
      expect(mutationStatement).not.toContain("lock_acquired");
    },
  );

  it("acquires the advisory lock before the status and owner-count snapshot", async () => {
    const { database, execute, batch } = databaseDouble(
      "LAST_OWNER_PROTECTED",
    );

    await expect(
      mutateAdminStatus(database, {
        actorProfileId,
        targetProfileId,
        status: "SUSPENDED",
      }),
    ).resolves.toBe("LAST_OWNER_PROTECTED");

    expect(batch).toHaveBeenCalledOnce();
    const [isolationStatement, lockStatement, mutationStatement] =
      compiledStatements(execute);
    expect(isolationStatement).toBe(
      "set transaction isolation level read committed",
    );
    expect(lockStatement).toMatch(/select pg_advisory_xact_lock/);
    expect(mutationStatement).toContain("active_owner_count as materialized");
    expect(mutationStatement).toMatch(/\$\d+::text <> 'ACTIVE'/);
    expect(mutationStatement).not.toContain("pg_advisory_xact_lock");
    expect(mutationStatement).not.toContain("lock_acquired");
  });
});
