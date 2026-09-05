import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import {
  runAtomicMigrations,
  safePostgresErrorCode,
} from "./atomic-migration";
import { createDatabaseConnection } from "./client";
import { expectedStagingRebuildMigrationHashes } from "./staging-rebuild-inventory";
import { rehearseBusinessAuthorityApprovalRace } from "./rehearse-business-authority-concurrency";
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
import { seedBusinessAuthorityActorContext } from "./seed-business-authority-actor-context";
import { seedCanonicalServiceCatalogue } from "./seed-service-catalogue";
import {
  isStagingTargetAuthorized,
  loadStagingEnvironment,
  loadStagingTargetAuthorization,
  type StagingTargetAuthorization,
} from "./staging-environment";

const rehearsalDatabase = "vax_phase3l_rebuild_rehearsal";
const quotedRehearsalDatabase = `"${rehearsalDatabase}"`;
let stagingRebuildPhase = "startup";
let stagingRebuildFailureCode: string | null = null;

type DatabaseIdentity = Readonly<{
  project_id: string | null;
  branch_id: string | null;
  database_name: string;
  role_name: string;
}> &
  EmptyDatabaseMigratorSecurity;

function connectionForDatabase(
  connectionString: string,
  database: string,
): string {
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

async function createPriorMigrationFolder(): Promise<string> {
  const sourceDirectory = path.resolve(process.cwd(), "drizzle");
  const sourceJournalPath = path.join(sourceDirectory, "meta/_journal.json");
  const migrationFiles = (await readdir(sourceDirectory))
    .filter((file) => /^\d{4}_[a-z0-9_]+\.sql$/.test(file))
    .sort();
  const journal = JSON.parse(
    await readFile(sourceJournalPath, "utf8"),
  ) as Readonly<{
    version: string;
    dialect: string;
    entries: readonly Readonly<Record<string, unknown>>[];
  }>;
  if (
    migrationFiles.length !== 19 ||
    migrationFiles[16] !== "0016_phase_3n_business_authority.sql" ||
    migrationFiles[17] !== "0017_attelier_staging_calibration.sql" ||
    migrationFiles[18] !== "0018_attelier_estimate_amount_compatibility.sql" ||
    !Array.isArray(journal.entries) ||
    journal.entries.length !== 19 ||
    journal.entries[16]?.tag !== "0016_phase_3n_business_authority" ||
    journal.entries[17]?.tag !== "0017_attelier_staging_calibration" ||
    journal.entries[18]?.tag !== "0018_attelier_estimate_amount_compatibility"
  ) {
    throw new Error("ATTELIER migration inventory has diverged.");
  }

  const folder = await mkdtemp(
    path.join(tmpdir(), "vax-phase3n-prior-migrations-"),
  );
  try {
    await mkdir(path.join(folder, "meta"));
    for (const file of migrationFiles.slice(0, 16)) {
      await copyFile(path.join(sourceDirectory, file), path.join(folder, file));
    }
    await writeFile(
      path.join(folder, "meta/_journal.json"),
      `${JSON.stringify({ ...journal, entries: journal.entries.slice(0, 16) }, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    return folder;
  } catch (error) {
    await rm(folder, { recursive: true, force: true });
    throw error;
  }
}

function isDuplicateRelationFailure(error: unknown): boolean {
  return safePostgresErrorCode(error) === "42P07";
}

async function rehearsePhase3NMigrationFailureAndRetry(
  client: Client,
  connectionString: string,
  expectedHashes: readonly string[],
): Promise<void> {
  stagingRebuildPhase = "prepare-prior-migrations";
  const priorMigrationsFolder = await createPriorMigrationFolder();
  try {
    stagingRebuildPhase = "rebuild-prior-migrations";
    await runAtomicMigrations(connectionString, priorMigrationsFolder);
    const priorHistory = await client.query<{ hash: string }>(
      "select hash from drizzle.__drizzle_migrations order by id",
    );
    if (
      JSON.stringify(priorHistory.rows.map((row) => row.hash)) !==
      JSON.stringify(expectedHashes.slice(0, 16))
    ) {
      throw new Error("Prior migration reconstruction diverged.");
    }

    stagingRebuildPhase = "inject-controlled-migration-failure";
    await client.query(
      "create table public.phase3n_0016_fault_control (id integer not null)",
    );
    await client.query(`
      create unique index business_authority_audit_events_correlation_unique
      on public.phase3n_0016_fault_control (id)
    `);

    let failure: unknown;
    try {
      stagingRebuildPhase = "run-controlled-migration-failure";
      await runAtomicMigrations(
        connectionString,
        path.resolve(process.cwd(), "drizzle"),
      );
    } catch (error) {
      failure = error;
      stagingRebuildFailureCode = safePostgresErrorCode(error);
    }
    if (!isDuplicateRelationFailure(failure)) {
      throw new Error("Controlled Phase 3N migration failure did not fail.");
    }

    stagingRebuildPhase = "verify-controlled-migration-rollback";
    const rolledBackHistory = await client.query<{ hash: string }>(
      "select hash from drizzle.__drizzle_migrations order by id",
    );
    const rolledBackObjects = await client.query<{
      records_table: string | null;
      events_table: string | null;
      actor_function: string | null;
      record_guard_function: string | null;
    }>(`
      select
        to_regclass('public.business_authority_records')::text
          as records_table,
        to_regclass('public.business_authority_audit_events')::text
          as events_table,
        to_regprocedure(
          'public.vax_business_authority_assert_actor_context(uuid,uuid)'
        )::text as actor_function,
        to_regprocedure(
          'public.vax_business_authority_guard_record()'
        )::text as record_guard_function
    `);
    const rolledBackConstraints = await client.query<{
      constraint_name: string;
      definition: string;
    }>(
      `
      select constraint_object.conname as constraint_name,
        pg_get_constraintdef(constraint_object.oid) as definition
      from pg_constraint constraint_object
      join pg_class table_object
        on table_object.oid = constraint_object.conrelid
      join pg_namespace schema_object
        on schema_object.oid = table_object.relnamespace
      where schema_object.nspname = 'public'
        and constraint_object.conname = any($1::text[])
      order by constraint_object.conname
    `,
      [
        [
          "business_legal_profiles_environment_valid",
          "invoice_numbering_policies_environment_valid",
          "invoice_policies_environment_valid",
          "invoices_environment_valid",
        ],
      ],
    );
    const expectedEnvironmentConstraints = [
      "business_legal_profiles_environment_valid",
      "invoice_numbering_policies_environment_valid",
      "invoice_policies_environment_valid",
      "invoices_environment_valid",
    ];
    if (
      JSON.stringify(rolledBackHistory.rows.map((row) => row.hash)) !==
        JSON.stringify(expectedHashes.slice(0, 16)) ||
      rolledBackObjects.rows[0]?.records_table !== null ||
      rolledBackObjects.rows[0]?.events_table !== null ||
      rolledBackObjects.rows[0]?.actor_function !== null ||
      rolledBackObjects.rows[0]?.record_guard_function !== null ||
      JSON.stringify(
        rolledBackConstraints.rows.map((row) => row.constraint_name),
      ) !== JSON.stringify(expectedEnvironmentConstraints) ||
      rolledBackConstraints.rows.some(
        (row) =>
          !row.definition.includes("DEVELOPMENT") ||
          !row.definition.includes("PRODUCTION") ||
          row.definition.includes("STAGING"),
      )
    ) {
      throw new Error("Phase 3N migration rollback verification failed.");
    }

    stagingRebuildPhase = "retry-phase-3n-migration";
    await client.query(
      "drop index public.business_authority_audit_events_correlation_unique",
    );
    await client.query("drop table public.phase3n_0016_fault_control");
    await runAtomicMigrations(
      connectionString,
      path.resolve(process.cwd(), "drizzle"),
    );
    stagingRebuildPhase = "verify-phase-3n-migration-retry";
    const retriedHistory = await client.query<{ hash: string }>(
      "select hash from drizzle.__drizzle_migrations order by id",
    );
    const retriedConstraints = await client.query<{ definition: string }>(
      `
      select pg_get_constraintdef(constraint_object.oid) as definition
      from pg_constraint constraint_object
      join pg_class table_object
        on table_object.oid = constraint_object.conrelid
      join pg_namespace schema_object
        on schema_object.oid = table_object.relnamespace
      where schema_object.nspname = 'public'
        and constraint_object.conname = any($1::text[])
      order by constraint_object.conname
    `,
      [expectedEnvironmentConstraints],
    );
    if (
      JSON.stringify(retriedHistory.rows.map((row) => row.hash)) !==
        JSON.stringify(expectedHashes) ||
      retriedConstraints.rows.length !== 4 ||
      retriedConstraints.rows.some(
        (row) =>
          !row.definition.includes("DEVELOPMENT") ||
          !row.definition.includes("STAGING") ||
          !row.definition.includes("PRODUCTION"),
      )
    ) {
      throw new Error("Phase 3N migration retry verification failed.");
    }
  } finally {
    await rm(priorMigrationsFolder, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  stagingRebuildPhase = "load-staging-configuration";
  await loadStagingEnvironment();
  const stagingAuthorization = await loadStagingTargetAuthorization();
  stagingRebuildPhase = "verify-staging-target-guards";
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
  assertNonProductionDatabaseMutationTarget(
    process.env,
    "runtime",
    stagingAuthorization,
  );

  stagingRebuildPhase = "verify-migration-inventory";
  const expectedHashes = await expectedStagingRebuildMigrationHashes();

  const adminUrl = process.env.DATABASE_ADMIN_URL!;
  const migrationUrl = process.env.MIGRATION_DATABASE_URL!;
  const admin = new Client({ connectionString: adminUrl });
  let migrator: Client | undefined;
  let created = false;
  let rehearsalPassed = false;
  stagingRebuildPhase = "connect-staging-administrator";
  await admin.connect();
  try {
    stagingRebuildPhase = "verify-staging-administrator";
    await assertIdentity(
      admin,
      process.env.DATABASE_MUTATION_EXPECTED_DATABASE!,
      process.env.DATABASE_ADMIN_EXPECTED_ROLE!,
      stagingAuthorization,
    );
    stagingRebuildPhase = "check-disposable-database-absence";
    const existing = await admin.query<{ exists: boolean }>(
      "select exists(select 1 from pg_database where datname = $1) as exists",
      [rehearsalDatabase],
    );
    if (existing.rows[0]?.exists) {
      throw new Error(
        "Staging rebuild database already exists; cleanup requires review.",
      );
    }

    stagingRebuildPhase = "create-disposable-database";
    await admin.query(
      `create database ${quotedRehearsalDatabase} owner "${vaxDatabaseRoles.migrator}"`,
    );
    created = true;
    const rehearsalUrl = connectionForDatabase(migrationUrl, rehearsalDatabase);
    const rehearsalRuntimeUrl = connectionForDatabase(
      process.env.DATABASE_URL!,
      rehearsalDatabase,
    );
    migrator = new Client({ connectionString: rehearsalUrl });
    stagingRebuildPhase = "connect-disposable-migrator";
    await migrator.connect();
    stagingRebuildPhase = "verify-disposable-migrator";
    await assertIdentity(
      migrator,
      rehearsalDatabase,
      vaxDatabaseRoles.migrator,
      stagingAuthorization,
    );

    await rehearsePhase3NMigrationFailureAndRetry(
      migrator,
      rehearsalUrl,
      expectedHashes,
    );

    stagingRebuildPhase = "seed-rebuilt-database";
    const database = createDatabaseConnection(rehearsalUrl);
    await seedBusinessAuthorityActorContext(database);
    await seedCanonicalServiceCatalogue(database);
    await seedCommercialEngine(database);
    await seedAvailabilityEngine(database);
    await seedIdentityAccess(database);
    await seedCommunicationsDocuments(database);

    stagingRebuildPhase = "verify-rebuilt-database";
    await verifyRebuiltDatabase(migrator, expectedHashes);
    stagingRebuildPhase = "rehearse-authority-concurrency";
    await rehearseBusinessAuthorityApprovalRace(
      rehearsalRuntimeUrl,
      rehearsalUrl,
    );
    rehearsalPassed = true;
  } finally {
    const failurePhase = stagingRebuildPhase;
    stagingRebuildPhase = "cleanup-disposable-database";
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
    if (!rehearsalPassed) stagingRebuildPhase = failurePhase;
  }
  if (rehearsalPassed) {
    process.stdout.write(
      "Staging rebuild, atomic retry, authority concurrency, and cleanup rehearsal passed.\n",
    );
  }
}

main().catch((error: unknown) => {
  stagingRebuildFailureCode ??= safePostgresErrorCode(error);
  process.stderr.write(
    `Staging rebuild rehearsal failed safely at phase ${stagingRebuildPhase}` +
      ` with code ${stagingRebuildFailureCode ?? "UNKNOWN"}.\n`,
  );
  process.exitCode = 1;
});
