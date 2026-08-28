import { Client } from "pg";
import { getDatabaseAdminUrl } from "@/lib/environment";
import { assertNonProductionDatabaseMutationTarget } from "./migration-environment";
import {
  loadStagingEnvironment,
  loadStagingTargetAuthorization,
} from "./staging-environment";

type StagingInventory = Readonly<{
  tables: number;
  migrations: number;
  roles: number;
  permissions: number;
  mappings: number;
  business_rows: number;
  rate_limit_rows: number;
}>;

async function main(): Promise<void> {
  await loadStagingEnvironment();
  const stagingAuthorization = await loadStagingTargetAuthorization();
  assertNonProductionDatabaseMutationTarget(
    process.env,
    "admin",
    stagingAuthorization,
  );
  const client = new Client({ connectionString: getDatabaseAdminUrl() });
  await client.connect();
  try {
    const inventory = await client.query<StagingInventory>(`
      select
        (select count(*)::integer from information_schema.tables
          where table_schema = 'public' and table_type = 'BASE TABLE') as tables,
        (select count(*)::integer from drizzle.__drizzle_migrations) as migrations,
        (select count(*)::integer from public.application_roles) as roles,
        (select count(*)::integer from public.permissions) as permissions,
        (select count(*)::integer from public.role_permissions) as mappings,
        (
          (select count(*) from public.user_profiles) +
          (select count(*) from public.user_roles) +
          (select count(*) from public.auth_audit_events) +
          (select count(*) from public.customers) +
          (select count(*) from public.properties) +
          (select count(*) from public.service_requests) +
          (select count(*) from public.quotes) +
          (select count(*) from public.quote_acceptances) +
          (select count(*) from public.bookings) +
          (select count(*) from public.jobs) +
          (select count(*) from public.invoices) +
          (select count(*) from public.payments) +
          (select count(*) from public.documents) +
          (select count(*) from public.communication_intents)
        )::integer as business_rows,
        (select count(*)::integer from public.operational_rate_limits)
          as rate_limit_rows
    `);
    const authTables = await client.query<{ table_name: string }>(`
      select table_name from information_schema.tables
      where table_schema = 'neon_auth'
    `);
    let authUsers = 0;
    let authSessions = 0;
    for (const tableName of authTables.rows.map((row) => row.table_name)) {
      if (tableName === "user" || tableName === "users") {
        const result = await client.query<{ count: number }>(
          `select count(*)::integer as count from neon_auth."${tableName}"`,
        );
        authUsers += result.rows[0]?.count ?? 0;
      }
      if (tableName === "session" || tableName === "sessions") {
        const result = await client.query<{ count: number }>(
          `select count(*)::integer as count from neon_auth."${tableName}"`,
        );
        authSessions += result.rows[0]?.count ?? 0;
      }
    }
    const row = inventory.rows[0];
    if (
      !row ||
      row.tables !== 98 ||
      row.migrations !== 16 ||
      row.roles !== 5 ||
      row.permissions !== 28 ||
      row.mappings !== 76 ||
      row.business_rows !== 0 ||
      row.rate_limit_rows !== 0 ||
      authUsers !== 0 ||
      authSessions !== 0
    ) {
      throw new Error("Staging state has diverged.");
    }
    process.stdout.write(
      "Staging schema, canonical RBAC, business-data, Auth and session state verified.\n",
    );
  } finally {
    await client.end();
  }
}

main().catch(() => {
  process.stderr.write("Staging state verification failed safely.\n");
  process.exitCode = 1;
});
