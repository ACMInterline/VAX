import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  committedProbe: false,
  committedLedgerRows: 0,
  pendingProbe: false,
  pendingLedgerRows: 0,
  inTransaction: false,
  injectFailure: true,
  statements: [] as string[],
}));

const query = vi.hoisted(() =>
  vi.fn(async (configuration: { text?: string } | string) => {
    const text =
      typeof configuration === "string"
        ? configuration
        : (configuration.text ?? "");
    const normalized = text.trim().replace(/\s+/g, " ").toLowerCase();
    state.statements.push(normalized);

    if (normalized === "begin") {
      state.inTransaction = true;
      state.pendingProbe = state.committedProbe;
      state.pendingLedgerRows = state.committedLedgerRows;
    } else if (normalized === "commit") {
      state.committedProbe = state.pendingProbe;
      state.committedLedgerRows = state.pendingLedgerRows;
      state.inTransaction = false;
    } else if (normalized === "rollback") {
      state.pendingProbe = state.committedProbe;
      state.pendingLedgerRows = state.committedLedgerRows;
      state.inTransaction = false;
    } else if (normalized.includes('create table "atomic_migration_probe"')) {
      state.pendingProbe = true;
    } else if (
      normalized.includes("atomic-migration-fault-injection-point") &&
      state.injectFailure
    ) {
      state.injectFailure = false;
      throw new Error("synthetic statement failure");
    } else if (
      normalized.startsWith("insert into") &&
      normalized.includes("__drizzle_migrations")
    ) {
      state.pendingLedgerRows += 1;
    }

    if (
      normalized.startsWith("select id, hash, created_at from") &&
      normalized.includes("__drizzle_migrations")
    ) {
      return { rows: [] };
    }
    return { rows: [], rowCount: 0 };
  }),
);

const client = vi.hoisted(() => ({
  connect: vi.fn(async () => undefined),
  end: vi.fn(async () => undefined),
  query,
}));

vi.mock("pg", () => {
  class FakePool {}
  const types = {
    builtins: {
      TIMESTAMPTZ: 1184,
      TIMESTAMP: 1114,
      DATE: 1082,
      INTERVAL: 1186,
    },
    getTypeParser: vi.fn(),
  };
  return {
    Client: vi.fn(function MockClient() {
      return client;
    }),
    default: { Pool: FakePool, types },
  };
});

import { runAtomicMigrations } from "./atomic-migration";

beforeEach(() => {
  vi.clearAllMocks();
  state.committedProbe = false;
  state.committedLedgerRows = 0;
  state.pendingProbe = false;
  state.pendingLedgerRows = 0;
  state.inTransaction = false;
  state.injectFailure = true;
  state.statements.length = 0;
});

describe("atomic migration transaction", () => {
  it("rolls back the pending migration and ledger together, then retries cleanly", async () => {
    const fixtureFolder = path.join(
      process.cwd(),
      "src/db/__fixtures__/atomic-migrations",
    );

    await expect(
      runAtomicMigrations(
        "postgresql://synthetic.invalid/atomic-migration-test",
        fixtureFolder,
      ),
    ).rejects.toThrow("atomic-migration-fault-injection-point");
    expect(state.injectFailure).toBe(false);
    expect(state.statements).toContain("rollback");
    expect(state.committedProbe).toBe(false);
    expect(state.committedLedgerRows).toBe(0);

    await expect(
      runAtomicMigrations(
        "postgresql://synthetic.invalid/atomic-migration-test",
        fixtureFolder,
      ),
    ).resolves.toBeUndefined();
    expect(state.statements).toContain("commit");
    expect(state.committedProbe).toBe(true);
    expect(state.committedLedgerRows).toBe(1);
  });
});
