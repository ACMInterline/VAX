import { createHash, randomBytes } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SharedAuthRateLimiter } from "@/auth/rate-limit";
import { createDatabaseConnection } from "./client";
import {
  getDatabaseAdminUrl,
  getDatabaseUrl,
} from "@/lib/environment";
import {
  assertNonProductionDatabaseMutationTarget,
  loadMigrationEnvironment,
} from "./migration-environment";
import { PostgresSharedRateLimitStore } from "./shared-rate-limit-store";
import {
  loadStagingTargetAuthorization,
  type StagingTargetAuthorization,
} from "./staging-environment";

vi.mock("server-only", () => ({}));

const runLiveIntegration =
  process.env.RUN_PHASE3L_RATE_LIMIT_INTEGRATION === "1";

describe.runIf(runLiveIntegration)("Phase 3L shared PostgreSQL rate limiter", () => {
  let admin: Client;
  let stagingAuthorization: StagingTargetAuthorization | undefined;
  const testKeys = new Set<string>();

  beforeAll(async () => {
    loadMigrationEnvironment();
    if (process.env.DATABASE_MUTATION_ENVIRONMENT === "staging") {
      stagingAuthorization = await loadStagingTargetAuthorization();
    }
    assertNonProductionDatabaseMutationTarget(
      process.env,
      "runtime",
      stagingAuthorization,
    );
    assertNonProductionDatabaseMutationTarget(
      process.env,
      "admin",
      stagingAuthorization,
    );
    admin = new Client({ connectionString: getDatabaseAdminUrl() });
    await admin.connect();
  });

  afterAll(async () => {
    if (admin && testKeys.size > 0) {
      await admin.query(
        "delete from public.operational_rate_limits where key_hash = any($1::text[])",
        [[...testKeys]],
      );
    }
    await admin?.end();
  });

  function key(label: string): string {
    const value = createHash("sha256")
      .update(label)
      .update(randomBytes(12))
      .digest("hex");
    testKeys.add(value);
    return value;
  }

  it("enforces one atomic window across concurrent application instances", async () => {
    const database = createDatabaseConnection(getDatabaseUrl());
    const first = new SharedAuthRateLimiter(
      new PostgresSharedRateLimitStore(database),
    );
    const second = new SharedAuthRateLimiter(
      new PostgresSharedRateLimitStore(database),
    );
    const sharedKey = key("multi-instance");
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        (index % 2 === 0 ? first : second).consume("LOGIN", sharedKey),
      ),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(7);
    const persisted = await admin.query<{
      scope: string;
      key_hash: string;
      attempt_count: number;
    }>(
      "select scope, key_hash, attempt_count from public.operational_rate_limits where key_hash = $1",
      [sharedKey],
    );
    expect(persisted.rows).toEqual([
      { scope: "LOGIN", key_hash: sharedKey, attempt_count: 6 },
    ]);
  });

  it("keeps independent keys isolated and lets runtime prune only expired rows", async () => {
    const database = createDatabaseConnection(getDatabaseUrl());
    const store = new PostgresSharedRateLimitStore(database);
    const firstKey = key("first-key");
    const secondKey = key("second-key");

    await store.consumeWindow({
      scope: "PUBLIC_REQUEST",
      keyHash: firstKey,
      limit: 5,
      windowMilliseconds: 60_000,
    });
    await store.consumeWindow({
      scope: "PUBLIC_REQUEST",
      keyHash: secondKey,
      limit: 5,
      windowMilliseconds: 60_000,
    });
    await admin.query(
      "update public.operational_rate_limits set window_started_at = clock_timestamp() - interval '2 seconds', resets_at = clock_timestamp() - interval '1 second', updated_at = clock_timestamp() where key_hash = $1",
      [firstKey],
    );

    await expect(store.pruneExpired(100)).resolves.toBeGreaterThanOrEqual(1);
    const remaining = await admin.query<{ key_hash: string }>(
      "select key_hash from public.operational_rate_limits where key_hash = any($1::text[]) order by key_hash",
      [[firstKey, secondKey]],
    );
    expect(remaining.rows).toEqual([{ key_hash: secondKey }]);
  });
});
