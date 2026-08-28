import { sql } from "drizzle-orm";
import type {
  AuthAttemptScope,
  SharedRateLimitStore,
  SharedRateLimitStoreResult,
} from "@/auth/rate-limit";
import { getDatabase, type Database } from "./client";

export class PostgresSharedRateLimitStore implements SharedRateLimitStore {
  constructor(private readonly database: Database = getDatabase()) {}

  async consumeWindow(input: Readonly<{
    scope: AuthAttemptScope;
    keyHash: string;
    limit: number;
    windowMilliseconds: number;
  }>): Promise<SharedRateLimitStoreResult> {
    if (
      !/^[0-9a-f]{64}$/.test(input.keyHash) ||
      !Number.isInteger(input.limit) ||
      input.limit < 1 ||
      !Number.isInteger(input.windowMilliseconds) ||
      input.windowMilliseconds < 1_000
    ) {
      throw new Error("Shared rate-limit operation is invalid.");
    }

    const result = await this.database.execute<{
      attempt_count: number;
      resets_at: Date | string;
    }>(sql`
      insert into operational_rate_limits (
        scope, key_hash, attempt_count, window_started_at, resets_at, updated_at
      ) values (
        ${input.scope}, ${input.keyHash}, 1, clock_timestamp(),
        clock_timestamp() + (${input.windowMilliseconds} * interval '1 millisecond'),
        clock_timestamp()
      )
      on conflict (scope, key_hash) do update set
        attempt_count = case
          when operational_rate_limits.resets_at <= clock_timestamp() then 1
          else least(
            operational_rate_limits.attempt_count + 1,
            ${input.limit + 1}
          )
        end,
        window_started_at = case
          when operational_rate_limits.resets_at <= clock_timestamp()
            then clock_timestamp()
          else operational_rate_limits.window_started_at
        end,
        resets_at = case
          when operational_rate_limits.resets_at <= clock_timestamp()
            then clock_timestamp() +
              (${input.windowMilliseconds} * interval '1 millisecond')
          else operational_rate_limits.resets_at
        end,
        updated_at = clock_timestamp()
      returning attempt_count, resets_at
    `);
    const row = result.rows[0];
    const resetsAt = row ? new Date(row.resets_at) : new Date(Number.NaN);
    if (
      !row ||
      !Number.isInteger(row.attempt_count) ||
      row.attempt_count < 1 ||
      Number.isNaN(resetsAt.getTime())
    ) {
      throw new Error("Shared rate-limit state is unavailable.");
    }
    return { attemptCount: row.attempt_count, resetsAt };
  }

  async pruneExpired(maximumRows: number): Promise<number> {
    if (!Number.isInteger(maximumRows) || maximumRows < 1 || maximumRows > 500) {
      throw new Error("Shared rate-limit cleanup is invalid.");
    }
    const result = await this.database.execute(sql`
      delete from operational_rate_limits
      where (scope, key_hash) in (
        select scope, key_hash from operational_rate_limits
        where resets_at <= clock_timestamp()
        order by resets_at
        limit ${maximumRows}
      )
      returning scope
    `);
    return result.rows.length;
  }
}
