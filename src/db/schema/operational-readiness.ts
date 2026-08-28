import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const operationalRateLimits = pgTable(
  "operational_rate_limits",
  {
    scope: varchar("scope", { length: 40 }).notNull(),
    keyHash: varchar("key_hash", { length: 64 }).notNull(),
    attemptCount: integer("attempt_count").default(1).notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    resetsAt: timestamp("resets_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.scope, table.keyHash] }),
    index("operational_rate_limits_expiry_idx").on(table.resetsAt),
    check(
      "operational_rate_limits_scope_valid",
      sql`${table.scope} in ('LOGIN', 'SIGNUP', 'PASSWORD_RESET', 'EMAIL_VERIFICATION', 'ADMIN_MUTATION', 'BOOKING_MUTATION', 'JOB_MUTATION', 'FINANCE_MUTATION', 'COMMUNICATION_MUTATION', 'PUBLIC_REQUEST')`,
    ),
    check(
      "operational_rate_limits_key_hash_valid",
      sql`${table.keyHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "operational_rate_limits_attempt_count_positive",
      sql`${table.attemptCount} >= 1`,
    ),
    check(
      "operational_rate_limits_window_valid",
      sql`${table.resetsAt} > ${table.windowStartedAt}`,
    ),
    check(
      "operational_rate_limits_updated_at_valid",
      sql`${table.updatedAt} >= ${table.windowStartedAt}`,
    ),
  ],
);
