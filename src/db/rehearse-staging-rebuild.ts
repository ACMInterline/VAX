import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { Client } from "pg";
import { createDatabaseConnection } from "./client";
import {
  vaxDatabaseRoles,
  vaxDatabaseTableNames,
} from "./database-security-policy";
import {
  assertNonProductionDatabaseMutationTarget,
  isEmptyDatabaseMigratorLeastPrivilege,
  type EmptyDatabaseMigratorSecurity,
} from "./migration-environment";
import { seedAvailabilityEngine } from "./seed-availability-engine";
import { seedCommercialEngine } from "./seed-commercial-engine";
import { seedIdentityAccess } from "./seed-identity-access";
import { seedCommunicationsDocuments } from "./seed-communications-documents";
import { seedCanonicalServiceCatalogue } from "./seed-service-catalogue";
import {
  isStagingTargetAuthorized,
  loadStagingEnvironment,
  loadStagingTargetAuthorization,
  type StagingTargetAuthorization,
} from "./staging-environment";

const rehearsalDatabase = "vax_phase3l_rebuild_rehearsal";
const quotedRehearsalDatabase = `"${rehearsalDatabase}"`;

type DatabaseIdentity = Readonly<{
  project_id: string | null;
  branch_id: string | null;
  database_name: string;
  role_name: string;
}> & EmptyDatabaseMigratorSecurity;

function connectionForDatabase(connectionString: string, database: string): string {
  const result = new URL(connectionString);
  result.pathname = `/${database}`;
  return result.toString();
}

async function assertIdentity(
  client: Client,
  expectedDatabase: string,
  expectedRole: string,
  stagingAuthorization: StagingTargetAuthorization,
): Promise<void> {
  const result = await client.query<DatabaseIdentity>(`
    select current_setting('neon.project_id', true) as project_id,
      current_setting('neon.branch_id', true) as branch_id,
      current_database() as database_name,
      current_user as role_name,
      role.rolcanlogin, role.rolsuper, role.rolinherit, role.rolcreaterole,
      role.rolcreatedb, role.rolreplication, role.rolbypassrls,
      (select count(*)::integer from pg_auth_members membership
        where membership.member = role.oid) as membership_count,
      has_database_privilege(current_user, current_database(), 'CREATE')
        as database_create,
      has_schema_privilege(current_user, 'public', 'CREATE')
        as public_schema_create,
      (select count(*)::integer
        from pg_class owned_object
        join pg_namespace owned_schema
          on owned_schema.oid = owned_object.relnamespace
        where owned_object.relowner = role.oid
          and owned_schema.nspname in ('public', 'drizzle'))
        as owned_runtime_objects
    from pg_roles role
    where role.rolname = current_user
  `);
  const identity = result.rows[0];
  if (
    !identity ||
    process.env.DATABASE_MUTATION_ENVIRONMENT !== "staging" ||
    !isStagingTargetAuthorized(stagingAuthorization, process.env) ||
    identity.project_id !== process.env.DATABASE_MUTATION_EXPECTED_PROJECT_ID ||
    identity.branch_id !== process.env.DATABASE_MUTATION_EXPECTED_BRANCH_ID ||
    identity.database_name !== expectedDatabase ||
    identity.role_name !== expectedRole ||
    (expectedRole === vaxDatabaseRoles.migrator &&
      !isEmptyDatabaseMigratorLeastPrivilege(identity))
  ) {
    throw new Error("Staging rebuild target is not authorized.");
  }
}

async function expectedMigrationHashes(): Promise<readonly string[]> {
  const migrationsDirectory = path.resolve(process.cwd(), "drizzle");
  const files = (await readdir(migrationsDirectory))
    .filter((file) => /^\d{4}_[a-z0-9_]+\.sql$/.test(file))
    .sort();
  if (
    files.length !== 16 ||
    files[15] !== "0015_phase_3l_readiness_attestation.sql"
  ) {
    throw new Error("Staging rebuild migration inventory has diverged.");
  }
  return Promise.all(
    files.map(async (file) =>
      createHash("sha256")
        .update(await readFile(path.join(migrationsDirectory, file)))
        .digest("hex"),
    ),
  );
}

async function verifyRebuiltDatabase(
  client: Client,
  expectedHashes: readonly string[],
): Promise<void> {
  const tables = await client.query<{ table_name: string }>(`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `);
  const migrationHistory = await client.query<{ hash: string }>(
    "select hash from drizzle.__drizzle_migrations order by id",
  );
  const seeds = await client.query<{
    roles: number;
    permissions: number;
    mappings: number;
  }>(`
    select
      (select count(*)::integer from public.application_roles) as roles,
      (select count(*)::integer from public.permissions) as permissions,
      (select count(*)::integer from public.role_permissions) as mappings
  `);
  if (
    JSON.stringify(tables.rows.map((row) => row.table_name)) !==
      JSON.stringify(vaxDatabaseTableNames) ||
    JSON.stringify(migrationHistory.rows.map((row) => row.hash)) !==
      JSON.stringify(expectedHashes) ||
    JSON.stringify(seeds.rows[0]) !==
      JSON.stringify({ roles: 5, permissions: 28, mappings: 76 })
  ) {
    throw new Error("Staging rebuild verification failed.");
  }
}

async function rehearseTransactionalFailure(client: Client): Promise<void> {
  const before = await client.query<{ count: number }>(
    "select count(*)::integer as count from drizzle.__drizzle_migrations",
  );
  await client.query("BEGIN");
  try {
    await client.query("create table public.phase3l_failure_probe (id integer)");
    await client.query("select 1 / 0");
    throw new Error("Controlled migration failure did not fail.");
  } catch {
    await client.query("ROLLBACK");
  }
  const after = await client.query<{
    count: number;
    residue: string | null;
  }>(`
    select
      (select count(*)::integer from drizzle.__drizzle_migrations) as count,
      to_regclass('public.phase3l_failure_probe')::text as residue
  `);
  if (
    before.rows[0]?.count !== 16 ||
    after.rows[0]?.count !== before.rows[0]?.count ||
    after.rows[0]?.residue !== null
  ) {
    throw new Error("Controlled migration rollback verification failed.");
  }
}

async function main(): Promise<void> {
  await loadStagingEnvironment();
  const stagingAuthorization = await loadStagingTargetAuthorization();
  assertNonProductionDatabaseMutationTarget(
    process.env,
    "admin",
    stagingAuthorization,
  );
  assertNonProductionDatabaseMutationTarget(
    process.env,
    "migration",
    stagingAuthorization,
  );

  const adminUrl = process.env.DATABASE_ADMIN_URL!;
  const migrationUrl = process.env.MIGRATION_DATABASE_URL!;
  const admin = new Client({ connectionString: adminUrl });
  let migrator: Client | undefined;
  let created = false;
  let rehearsalPassed = false;
  await admin.connect();
  try {
    await assertIdentity(
      admin,
      process.env.DATABASE_MUTATION_EXPECTED_DATABASE!,
      process.env.DATABASE_ADMIN_EXPECTED_ROLE!,
      stagingAuthorization,
    );
    const existing = await admin.query<{ exists: boolean }>(
      "select exists(select 1 from pg_database where datname = $1) as exists",
      [rehearsalDatabase],
    );
    if (existing.rows[0]?.exists) {
      throw new Error("Staging rebuild database already exists; cleanup requires review.");
    }

    await admin.query(
      `create database ${quotedRehearsalDatabase} owner "${vaxDatabaseRoles.migrator}"`,
    );
    created = true;
    const rehearsalUrl = connectionForDatabase(migrationUrl, rehearsalDatabase);
    migrator = new Client({ connectionString: rehearsalUrl });
    await migrator.connect();
    await assertIdentity(
      migrator,
      rehearsalDatabase,
      vaxDatabaseRoles.migrator,
      stagingAuthorization,
    );

    const database = createDatabaseConnection(rehearsalUrl);
    await migrate(database, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
    await seedCanonicalServiceCatalogue(database);
    await seedCommercialEngine(database);
    await seedAvailabilityEngine(database);
    await seedIdentityAccess(database);
    await seedCommunicationsDocuments(database);

    const expectedHashes = await expectedMigrationHashes();
    await verifyRebuiltDatabase(migrator, expectedHashes);
    await rehearseTransactionalFailure(migrator);
    rehearsalPassed = true;
  } finally {
    await migrator?.end().catch(() => undefined);
    try {
      if (created) {
        await admin.query(`set role "${vaxDatabaseRoles.migrator}"`);
        await admin.query(
          `drop database ${quotedRehearsalDatabase} with (force)`,
        );
      }
    } finally {
      await admin.end();
    }
  }
  if (rehearsalPassed) {
    process.stdout.write(
      "Staging rebuild, rollback, and cleanup rehearsal passed.\n",
    );
  }
}

main().catch(() => {
  process.stderr.write("Staging rebuild rehearsal failed safely.\n");
  process.exitCode = 1;
});
