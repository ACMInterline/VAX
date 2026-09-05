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
  staging_authority_approvals: number;
  staging_authority_pending: number;
  production_approvals: number;
  attelier_price_books: number;
  attelier_duration_models: number;
  attelier_working_hours: number;
  attelier_appointment_windows: number;
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
          where environment_scope = 'STAGING'
            and status = 'APPROVED_FOR_STAGING') as staging_authority_approvals,
        (select count(*)::integer from public.business_authority_records
          where environment_scope = 'STAGING'
            and status = 'UNDER_REVIEW') as staging_authority_pending,
        (select count(*)::integer from public.business_authority_records
          where status = 'APPROVED_FOR_PRODUCTION') as production_approvals,
        (select count(*)::integer from public.price_books
          where code in ('ATTELIER_RESIDENTIAL_EUR_V1', 'ATTELIER_B2B_EUR_V1')
            and status = 'DRAFT' and active = false and provisional = false
            and vat_mode = 'VAT_UNRESOLVED'
            and default_vat_rate_basis_points is null) as attelier_price_books,
        (select count(*)::integer from public.duration_models
          where code = 'ATTELIER_OPERATIONS_V1' and status = 'ACTIVE'
            and active = true and provisional = false) as attelier_duration_models,
        (select count(*)::integer from public.working_hour_policies
          where code = 'ATTELIER_WORKING_HOURS_V1' and status = 'ACTIVE'
            and active = true and provisional = false) as attelier_working_hours,
        (select count(*)::integer from public.appointment_window_definitions
          where profile_code = 'ATTELIER_APPOINTMENT_WINDOWS_V1'
            and status = 'ACTIVE' and active = true
            and provisional = false) as attelier_appointment_windows,
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
      row.migrations !== 19 ||
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
      row.authority_records !== 29 ||
      row.authority_audits !== 107 ||
      row.staging_authority_approvals !== 16 ||
      row.staging_authority_pending !== 13 ||
      row.production_approvals !== 0 ||
      row.attelier_price_books !== 2 ||
      row.attelier_duration_models !== 1 ||
      row.attelier_working_hours !== 1 ||
      row.attelier_appointment_windows !== 5 ||
      row.rate_limit_rows !== 0 ||
      authUsers !== 6 ||
      authSessions !== 8
    ) {
      throw new Error("Staging state has diverged.");
    }
    process.stdout.write(
      "ATTELIER staging schema, retained acceptance fixtures, canonical RBAC, Auth/session inventory, governed authority state and zero production approvals verified.\n",
    );
  } finally {
    await client.end();
  }
}

main().catch(() => {
  process.stderr.write("Staging state verification failed safely.\n");
  process.exitCode = 1;
});
