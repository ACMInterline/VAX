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
  profiles: number;
  customers: number;
  properties: number;
  assets: number;
  requests: number;
  quotes: number;
  acceptances: number;
  bookings: number;
  downstream_rows: number;
  authority_records: number;
  authority_audits: number;
  production_approvals: number;
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
        (select count(*)::integer from public.user_profiles) as profiles,
        (select count(*)::integer from public.customers) as customers,
        (select count(*)::integer from public.properties) as properties,
        (select count(*)::integer from public.cleaning_assets) as assets,
        (select count(*)::integer from public.service_requests) as requests,
        (select count(*)::integer from public.quotes) as quotes,
        (select count(*)::integer from public.quote_acceptances) as acceptances,
        (select count(*)::integer from public.bookings) as bookings,
        (
          (select count(*) from public.jobs) +
          (select count(*) from public.invoices) +
          (select count(*) from public.payments) +
          (select count(*) from public.documents) +
          (select count(*) from public.communication_intents)
        )::integer as downstream_rows,
        (select count(*)::integer from public.business_authority_records)
          as authority_records,
        (select count(*)::integer
          from public.business_authority_audit_events) as authority_audits,
        (select count(*)::integer from public.business_authority_records
          where status = 'APPROVED_FOR_PRODUCTION') as production_approvals,
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
      row.tables !== 100 ||
      row.migrations !== 17 ||
      row.roles !== 5 ||
      row.permissions !== 28 ||
      row.mappings !== 76 ||
      row.profiles !== 6 ||
      row.customers !== 2 ||
      row.properties !== 2 ||
      row.assets !== 2 ||
      row.requests !== 1 ||
      row.quotes !== 1 ||
      row.acceptances !== 1 ||
      row.bookings !== 1 ||
      row.downstream_rows !== 0 ||
      row.authority_records !== 0 ||
      row.authority_audits !== 0 ||
      row.production_approvals !== 0 ||
      row.rate_limit_rows !== 0 ||
      authUsers !== 6 ||
      authSessions !== 8
    ) {
      throw new Error("Staging state has diverged.");
    }
    process.stdout.write(
      "Staging schema, retained synthetic fixtures, canonical RBAC, Auth/session inventory, and zero authority approvals verified.\n",
    );
  } finally {
    await client.end();
  }
}

main().catch(() => {
  process.stderr.write("Staging state verification failed safely.\n");
  process.exitCode = 1;
});
