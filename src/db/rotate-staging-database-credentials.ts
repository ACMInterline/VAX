import { randomBytes } from "node:crypto";
import path from "node:path";
import { Client } from "pg";
import {
  vaxDatabaseRoles,
  vaxDatabaseTableNames,
  vaxMigrationHashes,
} from "./database-security-policy";
import {
  configuredStagingPostgresUrl,
  configuredStagingRolePostgresUrl,
  configuredStagingSecret,
  parseStagingCredentialRotationArguments,
  type StagingCredentialRotationArguments,
} from "./staging-credential-rotation";
import {
  isStagingTargetAuthorized,
  loadStagingTargetAuthorization,
  readSecureOwnerOnlyFile,
  replaceDurableOwnerOnlyFile,
  stagingTargetEnvironment,
  writeDurableOwnerOnlyFile,
  type StagingTargetAuthorization,
} from "./staging-environment";

type DatabaseIdentity = Readonly<{
  project_id: string | null;
  branch_id: string | null;
  database_name: string;
  role_name: string;
  rolsuper: boolean;
  rolinherit: boolean;
  rolcreaterole: boolean;
  rolcreatedb: boolean;
  rolreplication: boolean;
  rolbypassrls: boolean;
  membership_count: number;
  database_create: boolean;
  public_schema_create: boolean;
  owned_runtime_objects: number;
}>;

type ObservedSession = {
  client: Client;
  terminationError?: unknown;
};

let rotationPhase = "configuration";

const managedKeys = [
  "DATABASE_URL",
  "MIGRATION_DATABASE_URL",
  "DATABASE_ADMIN_URL",
  "VAX_ENVIRONMENT",
  "STAGING_ALLOW_LOCALHOST",
  "PUBLIC_SITE_URL",
  "NEON_AUTH_BASE_URL",
  "NEON_AUTH_COOKIE_SECRET",
  "AUTH_REQUIRE_VERIFIED_EMAIL",
  "AUTH_TRUSTED_ORIGINS",
  "RATE_LIMIT_BACKEND",
  "RATE_LIMIT_HASH_SECRET",
  "VAX_TRUSTED_PROXY_HOPS",
  "EMAIL_DELIVERY_MODE",
] as const;

const legacyStagingTargetKeys = new Set([
  "DATABASE_ADMIN_EXPECTED_ROLE",
  "DATABASE_MUTATION_ENVIRONMENT",
  "DATABASE_MUTATION_EXPECTED_PROJECT_ID",
  "DATABASE_MUTATION_EXPECTED_BRANCH_ID",
  "DATABASE_MUTATION_EXPECTED_HOST",
  "DATABASE_MUTATION_EXPECTED_DATABASE",
]);

function credential(): string {
  return randomBytes(36).toString("base64url");
}

function connectionUrl(base: URL, role: string, password: string): URL {
  const result = new URL(base);
  result.username = role;
  result.password = password;
  return result;
}

function connectionUrlForDatabase(base: URL, database: string): URL {
  const result = new URL(base);
  result.pathname = `/${encodeURIComponent(database)}`;
  return result;
}

function pooledRuntimeUrl(base: URL, password: string): URL {
  const result = connectionUrl(base, vaxDatabaseRoles.runtime, password);
  const hostParts = result.hostname.split(".");
  if (
    hostParts.length < 4 ||
    !hostParts[0]?.startsWith("ep-") ||
    hostParts[0].endsWith("-pooler") ||
    !result.hostname.endsWith(".neon.tech")
  ) {
    throw new Error("Staging database endpoint is not configured safely.");
  }
  hostParts[0] = `${hostParts[0]}-pooler`;
  result.hostname = hostParts.join(".");
  return result;
}

function environmentValue(contents: string, key: string): string | undefined {
  return contents
    .split(/\r?\n/)
    .map((line) => /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line))
    .find((match) => match?.[1] === key)?.[2];
}

function updatedEnvironmentFile(
  existing: string,
  values: Readonly<Record<(typeof managedKeys)[number], string>>,
): string {
  const managed = new Set<string>(managedKeys);
  const retained = existing
    .split(/\r?\n/)
    .filter((line) => {
      const match = /^([A-Z][A-Z0-9_]*)=/.exec(line);
      return !match ||
        (!managed.has(match[1]) && !legacyStagingTargetKeys.has(match[1]));
    })
    .filter((line, index, lines) => line || index < lines.length - 1);
  return [
    ...retained,
    ...managedKeys.map((key) => `${key}=${values[key]}`),
    "",
  ].join("\n");
}

async function databaseIdentity(client: Client): Promise<DatabaseIdentity> {
  const result = await client.query<DatabaseIdentity>(`
    select current_setting('neon.project_id', true) as project_id,
      current_setting('neon.branch_id', true) as branch_id,
      current_database() as database_name, current_user as role_name,
      role.rolsuper, role.rolinherit, role.rolcreaterole, role.rolcreatedb,
      role.rolreplication, role.rolbypassrls,
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
    from pg_roles role where role.rolname = current_user
  `);
  if (!result.rows[0]) throw new Error("Staging database identity is unavailable.");
  return result.rows[0];
}

function assertStagingAdministrator(
  identity: DatabaseIdentity,
  target: URL,
  arguments_: StagingCredentialRotationArguments,
  authorization: StagingTargetAuthorization,
): void {
  const approved = stagingTargetEnvironment(authorization);
  if (
    process.env.NODE_ENV === "production" ||
    !arguments_.localRehearsal ||
    !isStagingTargetAuthorized(authorization, process.env) ||
    identity.project_id !== approved.DATABASE_MUTATION_EXPECTED_PROJECT_ID ||
    identity.branch_id !== approved.DATABASE_MUTATION_EXPECTED_BRANCH_ID ||
    identity.database_name !== approved.DATABASE_MUTATION_EXPECTED_DATABASE ||
    identity.role_name !== approved.DATABASE_ADMIN_EXPECTED_ROLE ||
    decodeURIComponent(target.username) !==
      approved.DATABASE_ADMIN_EXPECTED_ROLE ||
    target.hostname.toLowerCase() !==
      approved.DATABASE_MUTATION_EXPECTED_HOST ||
    decodeURIComponent(target.pathname.slice(1)) !==
      approved.DATABASE_MUTATION_EXPECTED_DATABASE ||
    identity.rolsuper ||
    !identity.rolcreaterole ||
    !identity.rolcreatedb ||
    !identity.rolbypassrls
  ) {
    throw new Error("Staging credential rotation target is not authorized.");
  }
}

async function assertBaseline(client: Client): Promise<void> {
  const tableResult = await client.query<{ table_name: string }>(`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `);
  const actual = tableResult.rows.map((row) => row.table_name);
  if (JSON.stringify(actual) !== JSON.stringify(vaxDatabaseTableNames)) {
    throw new Error("Staging database table inventory has diverged.");
  }
  const migrationResult = await client.query<{ hash: string }>(
    "select hash from drizzle.__drizzle_migrations order by id",
  );
  if (
    JSON.stringify(migrationResult.rows.map((row) => row.hash)) !==
      JSON.stringify(vaxMigrationHashes)
  ) {
    throw new Error("Staging migration history has diverged.");
  }
  const roleResult = await client.query<{
    rolname: string;
    rolcanlogin: boolean;
    rolsuper: boolean;
    rolinherit: boolean;
    rolcreaterole: boolean;
    rolcreatedb: boolean;
    rolreplication: boolean;
    rolbypassrls: boolean;
    membership_count: number;
    database_create: boolean;
    public_schema_create: boolean;
    owned_public_tables: number;
  }>(`
    select rolname, rolcanlogin, rolsuper, rolinherit, rolcreaterole,
      rolcreatedb, rolreplication, rolbypassrls,
      (select count(*)::integer from pg_auth_members membership
        where membership.member = role.oid) as membership_count,
      has_database_privilege(role.rolname, current_database(), 'CREATE')
        as database_create,
      has_schema_privilege(role.rolname, 'public', 'CREATE')
        as public_schema_create,
      (select count(*)::integer
        from pg_class owned_object
        join pg_namespace owned_schema
          on owned_schema.oid = owned_object.relnamespace
        where owned_object.relowner = role.oid
          and owned_schema.nspname = 'public'
          and owned_object.relkind in ('r', 'p')) as owned_public_tables
    from pg_roles role
    where role.rolname in ('vax_runtime', 'vax_migrator')
    order by rolname
  `);
  const runtimeRole = roleResult.rows.find(
    (role) => role.rolname === vaxDatabaseRoles.runtime,
  );
  const migratorRole = roleResult.rows.find(
    (role) => role.rolname === vaxDatabaseRoles.migrator,
  );
  if (
    roleResult.rows.length !== 2 ||
    roleResult.rows.some(
      (role) =>
        !role.rolcanlogin || role.rolsuper || role.rolinherit ||
        role.rolcreaterole || role.rolcreatedb || role.rolreplication ||
        role.rolbypassrls || role.membership_count !== 0,
    ) ||
    !runtimeRole || runtimeRole.database_create ||
    runtimeRole.public_schema_create || runtimeRole.owned_public_tables !== 0 ||
    !migratorRole || !migratorRole.database_create ||
    !migratorRole.public_schema_create ||
    migratorRole.owned_public_tables !== actual.length
  ) {
    throw new Error("Staging database role boundary has diverged.");
  }
}

async function connectRoleConnection(
  connectionString: string,
  expectedRole: string,
  expected: DatabaseIdentity,
): Promise<Client> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const identity = await databaseIdentity(client);
    if (
      identity.project_id !== expected.project_id ||
      identity.branch_id !== expected.branch_id ||
      identity.database_name !== expected.database_name ||
      identity.role_name !== expectedRole ||
      identity.rolsuper || identity.rolinherit || identity.rolcreaterole ||
      identity.rolcreatedb || identity.rolreplication || identity.rolbypassrls ||
      identity.membership_count !== 0 ||
      (expectedRole === vaxDatabaseRoles.runtime &&
        (identity.database_create || identity.public_schema_create ||
          identity.owned_runtime_objects !== 0)) ||
      (expectedRole === vaxDatabaseRoles.migrator &&
        (!identity.database_create || !identity.public_schema_create))
    ) {
      throw new Error("Rotated staging database identity is invalid.");
    }
    return client;
  } catch (error) {
    await client.end();
    throw error;
  }
}

async function assertRoleConnection(
  connectionString: string,
  expectedRole: string,
  expected: DatabaseIdentity,
): Promise<void> {
  const client = await connectRoleConnection(
    connectionString,
    expectedRole,
    expected,
  );
  await client.end();
}

async function connectAdministratorConnection(
  connectionString: string,
  expected: DatabaseIdentity,
): Promise<Client> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const identity = await databaseIdentity(client);
    if (
      identity.project_id !== expected.project_id ||
      identity.branch_id !== expected.branch_id ||
      identity.database_name !== expected.database_name ||
      identity.role_name !== expected.role_name ||
      identity.rolsuper !== expected.rolsuper ||
      identity.rolinherit !== expected.rolinherit ||
      identity.rolcreaterole !== expected.rolcreaterole ||
      identity.rolcreatedb !== expected.rolcreatedb ||
      identity.rolreplication !== expected.rolreplication ||
      identity.rolbypassrls !== expected.rolbypassrls ||
      identity.membership_count !== expected.membership_count ||
      identity.database_create !== expected.database_create ||
      identity.public_schema_create !== expected.public_schema_create ||
      identity.owned_runtime_objects !== expected.owned_runtime_objects
    ) {
      throw new Error("Rotated staging administrator identity is invalid.");
    }
    return client;
  } catch (error) {
    await client.end();
    throw error;
  }
}

async function secondaryDatabase(client: Client): Promise<string> {
  const result = await client.query<{ datname: string }>(
    `select database.datname
     from pg_database database
     where database.datallowconn
       and not database.datistemplate
       and database.datname <> current_database()
       and has_database_privilege($1, database.datname, 'CONNECT')
       and has_database_privilege($2, database.datname, 'CONNECT')
     order by database.datname
     limit 1`,
    [vaxDatabaseRoles.runtime, vaxDatabaseRoles.migrator],
  );
  const database = result.rows[0]?.datname;
  if (!database) {
    throw new Error("Cross-database session invalidation is unproven.");
  }
  return database;
}

async function connectSecondaryRoleSession(
  connectionString: string,
  expectedDatabase: string,
  expectedRole: string,
  expected: DatabaseIdentity,
): Promise<Client> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const identity = await databaseIdentity(client);
    if (
      identity.project_id !== expected.project_id ||
      identity.branch_id !== expected.branch_id ||
      identity.database_name !== expectedDatabase ||
      identity.role_name !== expectedRole ||
      identity.rolsuper || identity.rolinherit || identity.rolcreaterole ||
      identity.rolcreatedb || identity.rolreplication || identity.rolbypassrls ||
      identity.membership_count !== 0
    ) {
      throw new Error("Old staging session identity is invalid.");
    }
    return client;
  } catch (error) {
    await client.end();
    throw error;
  }
}

function observeSession(client: Client): ObservedSession {
  const observation: ObservedSession = { client };
  client.on("error", (error: unknown) => {
    observation.terminationError = error;
  });
  return observation;
}

async function captureRoleSessionPids(
  client: Client,
  roleNames: readonly string[],
): Promise<readonly number[]> {
  const sessions = await client.query<{ pid: number }>(
    `select pid from pg_stat_activity
     where usename = any($1::text[])
     order by pid`,
    [roleNames],
  );
  if (sessions.rows.length === 0) {
    throw new Error("Old staging session inventory is unproven.");
  }
  return sessions.rows.map((row) => row.pid);
}

async function terminateRoleSessions(
  client: Client,
  roleNames: readonly string[],
  oldSessionPids: readonly number[],
): Promise<void> {
  // A backend may disappear between the catalog snapshot and this call. The
  // authoritative check is that no captured pre-rotation PID remains below.
  await client.query(
    `select pg_terminate_backend(pid, 5000) as terminated
     from pg_stat_activity
     where pid <> pg_backend_pid()
       and pid = any($1::integer[])
       and usename = any($2::text[])`,
    [oldSessionPids, roleNames],
  );
  const remaining = await client.query<{ count: number }>(
    `select count(*)::integer as count from pg_stat_activity
     where pid <> pg_backend_pid()
       and pid = any($1::integer[])
       and usename = any($2::text[])`,
    [oldSessionPids, roleNames],
  );
  if (remaining.rows[0]?.count !== 0) {
    throw new Error("Old staging session termination is unproven.");
  }
}

function expectedSessionTermination(error: unknown): boolean {
  const code = (error as { code?: unknown } | undefined)?.code;
  return typeof code === "string" && new Set([
    "28P01",
    "57P01",
    "57P02",
    "57P03",
    "ECONNRESET",
    "EPIPE",
  ]).has(code);
}

async function assertEstablishedSessionRejected(
  session: ObservedSession,
): Promise<void> {
  if (session.terminationError) {
    if (!expectedSessionTermination(session.terminationError)) {
      throw new Error("Old staging session invalidation is unproven.");
    }
    await session.client.end().catch(() => undefined);
    return;
  }
  try {
    await session.client.query("select 1");
  } catch (error) {
    if (expectedSessionTermination(error)) {
      await session.client.end().catch(() => undefined);
      return;
    }
    throw new Error("Old staging session invalidation is unproven.");
  }
  await session.client.end();
  throw new Error("Old staging session remains valid.");
}

async function assertOldCredentialRejected(connectionString: string): Promise<void> {
  const client = new Client({ connectionString, connectionTimeoutMillis: 8_000 });
  try {
    await client.connect();
  } catch (error) {
    if ((error as { code?: string }).code === "28P01") return;
    throw new Error("Old staging credential invalidation is unproven.");
  } finally {
    await client.end().catch(() => undefined);
  }
  throw new Error("Old staging credential remains valid.");
}

async function main(): Promise<void> {
  const projectDirectory = process.cwd();
  const stagingPath = path.resolve(projectDirectory, ".env.staging.local");
  const pendingPath = `${stagingPath}.phase3l-pending`;
  const existingStaging = await readSecureOwnerOnlyFile(stagingPath);
  const stagingEnvironment = Object.fromEntries(
    managedKeys.map((key) => [key, environmentValue(existingStaging, key)]),
  );
  const stagingAuthorization = await loadStagingTargetAuthorization(
    projectDirectory,
  );
  const arguments_ = parseStagingCredentialRotationArguments(
    process.argv.slice(2),
  );
  const adminTarget = configuredStagingPostgresUrl(
    stagingEnvironment.DATABASE_ADMIN_URL,
  );
  const authBaseUrl = stagingEnvironment.NEON_AUTH_BASE_URL?.trim();
  if (!authBaseUrl) throw new Error("Staging Auth is not configured.");
  const authUrl = new URL(authBaseUrl);
  if (
    authUrl.protocol !== "https:" || authUrl.username || authUrl.password ||
    authUrl.search || authUrl.hash
  ) {
    throw new Error("Staging Auth is not configured.");
  }

  const previousRuntime = configuredStagingRolePostgresUrl(
    environmentValue(existingStaging, "DATABASE_URL"),
    vaxDatabaseRoles.runtime,
  );
  const previousMigrator = configuredStagingRolePostgresUrl(
    environmentValue(existingStaging, "MIGRATION_DATABASE_URL"),
    vaxDatabaseRoles.migrator,
  );
  const oldStagingRuntime = connectionUrl(
    adminTarget,
    vaxDatabaseRoles.runtime,
    decodeURIComponent(previousRuntime.password),
  );
  const expectedPooledRuntime = pooledRuntimeUrl(
    adminTarget,
    decodeURIComponent(previousRuntime.password),
  );
  if (
    previousRuntime.hostname !== expectedPooledRuntime.hostname ||
    previousMigrator.hostname !== adminTarget.hostname
  ) {
    throw new Error("Previous staging role credential is unavailable.");
  }
  const existingAuthCookieSecret = configuredStagingSecret(
    stagingEnvironment.NEON_AUTH_COOKIE_SECRET,
  );
  const existingRateLimitSecret = configuredStagingSecret(
    stagingEnvironment.RATE_LIMIT_HASH_SECRET,
  );

  const admin = new Client({ connectionString: adminTarget.toString() });
  rotationPhase = "administrator-connection";
  await admin.connect();
  let administratorClosed = false;
  let replacementAdministrator: Client | undefined;
  const oldSessions: ObservedSession[] = [];
  let pendingWritten = false;
  try {
    const identity = await databaseIdentity(admin);
    rotationPhase = "administrator-identity";
    assertStagingAdministrator(
      identity,
      adminTarget,
      arguments_,
      stagingAuthorization,
    );
    rotationPhase = "baseline";
    await assertBaseline(admin);
    const otherDatabase = await secondaryDatabase(admin);
    rotationPhase = "inherited-pooled-runtime";
    oldSessions.push(
      observeSession(
        await connectRoleConnection(
          previousRuntime.toString(),
          vaxDatabaseRoles.runtime,
          identity,
        ),
      ),
    );
    rotationPhase = "inherited-direct-runtime";
    await assertRoleConnection(
      oldStagingRuntime.toString(),
      vaxDatabaseRoles.runtime,
      identity,
    );
    rotationPhase = "inherited-migrator";
    oldSessions.push(
      observeSession(
        await connectRoleConnection(
          previousMigrator.toString(),
          vaxDatabaseRoles.migrator,
          identity,
        ),
      ),
    );
    rotationPhase = "inherited-cross-database-runtime";
    oldSessions.push(
      observeSession(
        await connectSecondaryRoleSession(
          connectionUrlForDatabase(previousRuntime, otherDatabase).toString(),
          otherDatabase,
          vaxDatabaseRoles.runtime,
          identity,
        ),
      ),
    );
    rotationPhase = "inherited-cross-database-migrator";
    oldSessions.push(
      observeSession(
        await connectSecondaryRoleSession(
          connectionUrlForDatabase(previousMigrator, otherDatabase).toString(),
          otherDatabase,
          vaxDatabaseRoles.migrator,
          identity,
        ),
      ),
    );
    rotationPhase = "inherited-administrator";
    oldSessions.push(
      observeSession(
        await connectAdministratorConnection(adminTarget.toString(), identity),
      ),
    );
    const oldSessionPids = await captureRoleSessionPids(admin, [
      vaxDatabaseRoles.runtime,
      vaxDatabaseRoles.migrator,
      identity.role_name,
    ]);

    const runtimePassword = credential();
    const migratorPassword = credential();
    const administratorPassword = credential();
    const runtimeUrl = pooledRuntimeUrl(adminTarget, runtimePassword);
    const migrationUrl = connectionUrl(
      adminTarget,
      vaxDatabaseRoles.migrator,
      migratorPassword,
    );
    const administratorUrl = connectionUrl(
      adminTarget,
      identity.role_name,
      administratorPassword,
    );
    const nextEnvironment = updatedEnvironmentFile(existingStaging, {
      DATABASE_URL: runtimeUrl.toString(),
      MIGRATION_DATABASE_URL: migrationUrl.toString(),
      DATABASE_ADMIN_URL: administratorUrl.toString(),
      VAX_ENVIRONMENT: "staging",
      STAGING_ALLOW_LOCALHOST: "true",
      PUBLIC_SITE_URL: "http://127.0.0.1:3000",
      NEON_AUTH_BASE_URL: authUrl.toString().replace(/\/$/, ""),
      NEON_AUTH_COOKIE_SECRET: existingAuthCookieSecret,
      AUTH_REQUIRE_VERIFIED_EMAIL: "true",
      AUTH_TRUSTED_ORIGINS: "http://127.0.0.1:3000",
      RATE_LIMIT_BACKEND: "database",
      RATE_LIMIT_HASH_SECRET: existingRateLimitSecret,
      VAX_TRUSTED_PROXY_HOPS: "",
      EMAIL_DELIVERY_MODE: "blocked",
    });
    rotationPhase = "pending-environment";
    await writeDurableOwnerOnlyFile(pendingPath, nextEnvironment);
    pendingWritten = true;

    rotationPhase = "role-rotation";
    await admin.query("BEGIN");
    try {
      await admin.query(
        `ALTER ROLE "${vaxDatabaseRoles.runtime}" PASSWORD '${runtimePassword}'`,
      );
      await admin.query(
        `ALTER ROLE "${vaxDatabaseRoles.migrator}" PASSWORD '${migratorPassword}'`,
      );
      await admin.query(
        `ALTER ROLE "${identity.role_name}" PASSWORD '${administratorPassword}'`,
      );
      await admin.query("COMMIT");
    } catch (error) {
      await admin.query("ROLLBACK");
      throw error;
    }

    rotationPhase = "rotated-runtime";
    await assertRoleConnection(
      runtimeUrl.toString(),
      vaxDatabaseRoles.runtime,
      identity,
    );
    rotationPhase = "rotated-migrator";
    await assertRoleConnection(
      migrationUrl.toString(),
      vaxDatabaseRoles.migrator,
      identity,
    );
    rotationPhase = "rotated-administrator";
    replacementAdministrator = await connectAdministratorConnection(
      administratorUrl.toString(),
      identity,
    );
    await admin.end();
    administratorClosed = true;
    rotationPhase = "old-backend-session-termination";
    await terminateRoleSessions(replacementAdministrator, [
      vaxDatabaseRoles.runtime,
      vaxDatabaseRoles.migrator,
      identity.role_name,
    ], oldSessionPids);
    rotationPhase = "old-established-session-rejection";
    for (const session of oldSessions) {
      await assertEstablishedSessionRejected(session);
    }
    oldSessions.splice(0);
    rotationPhase = "old-pooled-runtime-rejection";
    await assertOldCredentialRejected(previousRuntime.toString());
    rotationPhase = "old-direct-runtime-rejection";
    await assertOldCredentialRejected(oldStagingRuntime.toString());
    rotationPhase = "old-migrator-rejection";
    await assertOldCredentialRejected(previousMigrator.toString());
    rotationPhase = "old-administrator-rejection";
    await assertOldCredentialRejected(adminTarget.toString());
    rotationPhase = "post-rotation-baseline";
    await assertBaseline(replacementAdministrator);
    rotationPhase = "local-environment-finalization";
    await replaceDurableOwnerOnlyFile(pendingPath, stagingPath);
    pendingWritten = false;
    process.stdout.write(
      "Staging database credentials rotated and local staging configuration updated.\n",
    );
  } catch (error) {
    if (pendingWritten) {
      process.stderr.write(
        "Rotation failed safely; recovery credentials remain in the ignored pending file.\n",
      );
    }
    throw error;
  } finally {
    for (const session of oldSessions) {
      await session.client.end().catch(() => undefined);
    }
    await replacementAdministrator?.end().catch(() => undefined);
    if (!administratorClosed) await admin.end().catch(() => undefined);
  }
}

main().catch(() => {
  process.stderr.write(
    `Staging credential rotation failed safely at ${rotationPhase}.\n`,
  );
  process.exitCode = 1;
});
