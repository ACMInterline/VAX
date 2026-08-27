import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import {
  vaxDatabaseRoles,
  vaxDatabaseTableNames,
  vaxTriggerFunctionNames,
} from "./database-security-policy";

type ProvisionArguments = Readonly<{
  adoptCurrentDatabaseUrl: boolean;
  environment: string | null;
  projectId: string | null;
  branchId: string | null;
  host: string | null;
  database: string | null;
}>;

type DatabaseIdentity = Readonly<{
  project_id: string | null;
  branch_id: string | null;
  database_name: string;
  role_name: string;
  rolinherit: boolean;
  rolsuper: boolean;
  rolcreaterole: boolean;
  rolcreatedb: boolean;
  rolreplication: boolean;
  rolbypassrls: boolean;
  membership_count: number;
}>;

const managedEnvironmentKeys = [
  "DATABASE_URL",
  "MIGRATION_DATABASE_URL",
  "DATABASE_ADMIN_URL",
  "DATABASE_ADMIN_EXPECTED_ROLE",
  "DATABASE_MUTATION_ENVIRONMENT",
  "DATABASE_MUTATION_EXPECTED_PROJECT_ID",
  "DATABASE_MUTATION_EXPECTED_BRANCH_ID",
  "DATABASE_MUTATION_EXPECTED_HOST",
  "DATABASE_MUTATION_EXPECTED_DATABASE",
] as const;

function parseArguments(arguments_: readonly string[]): ProvisionArguments {
  const value = (name: string): string | null => {
    const index = arguments_.indexOf(name);
    return index >= 0 ? arguments_[index + 1]?.trim() || null : null;
  };
  return {
    adoptCurrentDatabaseUrl: arguments_.includes(
      "--adopt-current-database-url",
    ),
    environment: value("--environment"),
    projectId: value("--project-id"),
    branchId: value("--branch-id"),
    host: value("--host")?.toLowerCase() ?? null,
    database: value("--database"),
  };
}

function postgresUrl(value: string | undefined, variable: string): URL {
  try {
    if (!value) throw new Error("missing URL");
    const parsed = new URL(value);
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
      throw new Error("unsupported protocol");
    }
    if (!parsed.username || !parsed.password || !parsed.hostname) {
      throw new Error("incomplete URL");
    }
    return parsed;
  } catch {
    throw new Error(`${variable} is not configured.`);
  }
}

function connectionUrl(base: URL, role: string, password: string): string {
  const result = new URL(base);
  result.username = role;
  result.password = password;
  return result.toString();
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function rolePassword(): string {
  return randomBytes(36).toString("base64url");
}

function assertTransferableOwner(owner: string, adminRole: string): void {
  if (owner !== adminRole && owner !== vaxDatabaseRoles.migrator) {
    throw new Error("VAX database object has an unexpected owner.");
  }
}

async function readOptional(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

function updatedEnvironmentFile(
  existing: string,
  values: Readonly<Record<(typeof managedEnvironmentKeys)[number], string>>,
): string {
  const managed = new Set<string>(managedEnvironmentKeys);
  const retained = existing
    .split(/\r?\n/)
    .filter((line) => {
      const match = /^([A-Z][A-Z0-9_]*)=/.exec(line);
      return !match || !managed.has(match[1]);
    })
    .filter((line, index, lines) => line || index < lines.length - 1);
  const managedLines = managedEnvironmentKeys.map(
    (key) => `${key}=${values[key]}`,
  );
  return [...retained, ...managedLines, ""].join("\n");
}

async function databaseIdentity(client: Client): Promise<DatabaseIdentity> {
  const result = await client.query<DatabaseIdentity>(`
    select current_setting('neon.project_id', true) as project_id,
      current_setting('neon.branch_id', true) as branch_id,
      current_database() as database_name,
      current_user as role_name,
      role.rolinherit, role.rolsuper, role.rolcreaterole, role.rolcreatedb,
      role.rolreplication, role.rolbypassrls,
      (select count(*)::integer from pg_auth_members membership
        where membership.member = role.oid) as membership_count
    from pg_roles role where role.rolname = current_user
  `);
  if (!result.rows[0]) throw new Error("Database identity is unavailable.");
  return result.rows[0];
}

function assertDevelopmentAdmin(
  identity: DatabaseIdentity,
  target: URL,
  arguments_: ProvisionArguments,
): void {
  const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ""));
  if (
    process.env.NODE_ENV === "production" ||
    arguments_.environment !== "development" ||
    !arguments_.projectId ||
    !arguments_.branchId ||
    !arguments_.host ||
    !arguments_.database ||
    identity.project_id !== arguments_.projectId ||
    identity.branch_id !== arguments_.branchId ||
    target.hostname.toLowerCase() !== arguments_.host ||
    databaseName !== arguments_.database ||
    identity.database_name !== arguments_.database ||
    identity.role_name !== decodeURIComponent(target.username) ||
    identity.rolsuper ||
    !identity.rolcreaterole ||
    !identity.rolcreatedb ||
    !identity.rolbypassrls
  ) {
    throw new Error("Database role provisioning target is not authorized.");
  }
}

function managedValuesFromFile(
  contents: string,
): Partial<Record<(typeof managedEnvironmentKeys)[number], string>> {
  const values: Partial<
    Record<(typeof managedEnvironmentKeys)[number], string>
  > = {};
  const managed = new Set<string>(managedEnvironmentKeys);
  for (const line of contents.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (match && managed.has(match[1])) {
      values[match[1] as (typeof managedEnvironmentKeys)[number]] = match[2];
    }
  }
  return values;
}

async function assertExactApplicationTables(client: Client): Promise<void> {
  const result = await client.query<{ table_name: string }>(`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `);
  const actual = result.rows.map((row) => row.table_name);
  if (JSON.stringify(actual) !== JSON.stringify(vaxDatabaseTableNames)) {
    throw new Error("Development VAX table inventory has diverged.");
  }
}

async function existingRoleNames(client: Client): Promise<Set<string>> {
  const result = await client.query<{ rolname: string }>(
    `select rolname from pg_roles where rolname = any($1::text[])`,
    [[vaxDatabaseRoles.migrator, vaxDatabaseRoles.runtime]],
  );
  return new Set(result.rows.map((row) => row.rolname));
}

async function createRoles(
  client: Client,
  passwords: Readonly<{ migrator: string; runtime: string }>,
): Promise<void> {
  await client.query("BEGIN");
  try {
    for (const [role, password] of [
      [vaxDatabaseRoles.migrator, passwords.migrator],
      [vaxDatabaseRoles.runtime, passwords.runtime],
    ] as const) {
      if (!/^[A-Za-z0-9_-]+$/.test(password)) {
        throw new Error("Generated database role credential is invalid.");
      }
      await client.query(
        `CREATE ROLE ${quoteIdentifier(role)} LOGIN NOINHERIT NOCREATEROLE ` +
          `NOCREATEDB NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`,
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function hardenOwnershipAndDefaults(
  client: Client,
  adminRole: string,
  databaseName: string,
): Promise<void> {
  const migrator = quoteIdentifier(vaxDatabaseRoles.migrator);
  const runtime = quoteIdentifier(vaxDatabaseRoles.runtime);
  const admin = quoteIdentifier(adminRole);

  await client.query("BEGIN");
  try {
    await client.query(
      `GRANT ${migrator}, ${runtime} TO ${admin} ` +
        "WITH SET TRUE, INHERIT FALSE",
    );
    await client.query(
      `GRANT CREATE ON DATABASE ${quoteIdentifier(databaseName)} TO ${migrator}`,
    );
    await client.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
    await client.query(
      "REVOKE USAGE ON SCHEMA public FROM authenticated, anonymous",
    );
    await client.query(`GRANT USAGE, CREATE ON SCHEMA public TO ${migrator}`);
    await client.query(`GRANT USAGE, CREATE ON SCHEMA drizzle TO ${migrator}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${runtime}`);
    await client.query(
      "REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public " +
        "FROM authenticated, anonymous",
    );
    await client.query(
      "REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public " +
        "FROM authenticated, anonymous",
    );
    const functionOwners = await client.query<{
      function_name: string;
      owner_role: string;
    }>(
      `
      select function_object.proname as function_name,
        owner.rolname as owner_role
      from pg_proc function_object
      join pg_namespace schema on schema.oid = function_object.pronamespace
      join pg_roles owner on owner.oid = function_object.proowner
      where schema.nspname = 'public'
        and function_object.proname = any($1::text[])
      order by function_object.proname
    `,
      [vaxTriggerFunctionNames],
    );
    const functionOwnerByName = new Map(
      functionOwners.rows.map((row) => [row.function_name, row.owner_role]),
    );
    for (const functionName of vaxTriggerFunctionNames) {
      const owner = functionOwnerByName.get(functionName);
      if (!owner) {
        throw new Error("VAX database function ownership is unavailable.");
      }
      assertTransferableOwner(owner, adminRole);
      if (owner === vaxDatabaseRoles.migrator) continue;
      await client.query(
        `REVOKE ALL PRIVILEGES ON FUNCTION public.${quoteIdentifier(functionName)}() ` +
          `FROM PUBLIC, authenticated, anonymous, ${runtime}`,
      );
    }
    await client.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${admin} IN SCHEMA public ` +
        "REVOKE ALL PRIVILEGES ON TABLES FROM authenticated, anonymous",
    );
    await client.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${admin} IN SCHEMA public ` +
        "REVOKE ALL PRIVILEGES ON SEQUENCES FROM authenticated, anonymous",
    );
    await client.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${admin} IN SCHEMA public ` +
        "REVOKE ALL PRIVILEGES ON FUNCTIONS FROM authenticated, anonymous",
    );

    const tableOwners = await client.query<{
      table_name: string;
      owner_role: string;
    }>(`
      select table_object.relname as table_name,
        owner.rolname as owner_role
      from pg_class table_object
      join pg_namespace schema on schema.oid = table_object.relnamespace
      join pg_roles owner on owner.oid = table_object.relowner
      where schema.nspname = 'public' and table_object.relkind = 'r'
      order by table_object.relname
    `);
    const tableOwnerByName = new Map(
      tableOwners.rows.map((row) => [row.table_name, row.owner_role]),
    );
    for (const tableName of vaxDatabaseTableNames) {
      const owner = tableOwnerByName.get(tableName);
      if (!owner) {
        throw new Error("VAX database table ownership is unavailable.");
      }
      assertTransferableOwner(owner, adminRole);
      if (owner === vaxDatabaseRoles.migrator) continue;
      await client.query(
        `ALTER TABLE public.${quoteIdentifier(tableName)} OWNER TO ${migrator}`,
      );
    }
    const sequences = await client.query<{
      sequence_name: string;
      owner_role: string;
    }>(
      `
      select sequence.relname as sequence_name,
        owner.rolname as owner_role
      from pg_class sequence
      join pg_namespace schema on schema.oid = sequence.relnamespace
      join pg_roles owner on owner.oid = sequence.relowner
      where schema.nspname = 'public' and sequence.relkind = 'S'
        and owner.rolname <> $1
      order by sequence.relname
    `,
      [vaxDatabaseRoles.migrator],
    );
    for (const {
      sequence_name: sequenceName,
      owner_role: owner,
    } of sequences.rows) {
      assertTransferableOwner(owner, adminRole);
      await client.query(
        `ALTER SEQUENCE public.${quoteIdentifier(sequenceName)} OWNER TO ${migrator}`,
      );
    }
    for (const functionName of vaxTriggerFunctionNames) {
      const owner = functionOwnerByName.get(functionName);
      if (!owner) {
        throw new Error("VAX database function ownership is unavailable.");
      }
      assertTransferableOwner(owner, adminRole);
      if (owner === vaxDatabaseRoles.migrator) continue;
      await client.query(
        `ALTER FUNCTION public.${quoteIdentifier(functionName)}() OWNER TO ${migrator}`,
      );
    }
    const drizzleTableOwner = await client.query<{ owner_role: string }>(`
      select owner.rolname as owner_role
      from pg_class table_object
      join pg_namespace schema on schema.oid = table_object.relnamespace
      join pg_roles owner on owner.oid = table_object.relowner
      where schema.nspname = 'drizzle'
        and table_object.relname = '__drizzle_migrations'
        and table_object.relkind = 'r'
    `);
    const ledgerOwner = drizzleTableOwner.rows[0]?.owner_role;
    if (!ledgerOwner) {
      throw new Error("Drizzle ledger ownership is unavailable.");
    }
    assertTransferableOwner(ledgerOwner, adminRole);
    if (ledgerOwner !== vaxDatabaseRoles.migrator) {
      await client.query(
        `ALTER TABLE drizzle.__drizzle_migrations OWNER TO ${migrator}`,
      );
    }
    const drizzleSequences = await client.query<{
      sequence_name: string;
      owner_role: string;
    }>(
      `
      select sequence.relname as sequence_name,
        owner.rolname as owner_role
      from pg_class sequence
      join pg_namespace schema on schema.oid = sequence.relnamespace
      join pg_roles owner on owner.oid = sequence.relowner
      where schema.nspname = 'drizzle' and sequence.relkind = 'S'
        and owner.rolname <> $1
      order by sequence.relname
    `,
      [vaxDatabaseRoles.migrator],
    );
    for (const {
      sequence_name: sequenceName,
      owner_role: owner,
    } of drizzleSequences.rows) {
      assertTransferableOwner(owner, adminRole);
      await client.query(
        `ALTER SEQUENCE drizzle.${quoteIdentifier(sequenceName)} OWNER TO ${migrator}`,
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function assertProvisionedRole(
  connectionString: string,
  expectedRole: string,
  expectedIdentity: DatabaseIdentity,
): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const identity = await databaseIdentity(client);
    if (
      identity.project_id !== expectedIdentity.project_id ||
      identity.branch_id !== expectedIdentity.branch_id ||
      identity.database_name !== expectedIdentity.database_name ||
      identity.role_name !== expectedRole ||
      identity.rolinherit ||
      identity.rolsuper ||
      identity.rolcreaterole ||
      identity.rolcreatedb ||
      identity.rolreplication ||
      identity.rolbypassrls ||
      identity.membership_count !== 0
    ) {
      throw new Error("Provisioned database role identity is invalid.");
    }
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const arguments_ = parseArguments(process.argv.slice(2));
  const configuredAdmin = process.env.DATABASE_ADMIN_URL;
  const adopted =
    !configuredAdmin && arguments_.adoptCurrentDatabaseUrl
      ? process.env.DATABASE_URL
      : configuredAdmin;
  const adminTarget = postgresUrl(adopted, "DATABASE_ADMIN_URL");
  const client = new Client({ connectionString: adminTarget.toString() });
  await client.connect();

  const localEnvironmentPath = path.resolve(process.cwd(), ".env.local");
  const pendingEnvironmentPath = `${localEnvironmentPath}.phase3k-pending`;
  let pendingEnvironmentWritten = false;
  try {
    const identity = await databaseIdentity(client);
    assertDevelopmentAdmin(identity, adminTarget, arguments_);
    await assertExactApplicationTables(client);

    const existingRoles = await existingRoleNames(client);
    const hasMigrator = existingRoles.has(vaxDatabaseRoles.migrator);
    const hasRuntime = existingRoles.has(vaxDatabaseRoles.runtime);
    if (hasMigrator !== hasRuntime) {
      throw new Error("VAX database role provisioning is incomplete.");
    }

    if (!hasMigrator) {
      const passwords = {
        migrator: rolePassword(),
        runtime: rolePassword(),
      };
      const migrationUrl = connectionUrl(
        adminTarget,
        vaxDatabaseRoles.migrator,
        passwords.migrator,
      );
      const runtimeUrl = connectionUrl(
        adminTarget,
        vaxDatabaseRoles.runtime,
        passwords.runtime,
      );
      const existingEnvironment = await readOptional(localEnvironmentPath);
      const nextEnvironment = updatedEnvironmentFile(existingEnvironment, {
        DATABASE_URL: runtimeUrl,
        MIGRATION_DATABASE_URL: migrationUrl,
        DATABASE_ADMIN_URL: adminTarget.toString(),
        DATABASE_ADMIN_EXPECTED_ROLE: identity.role_name,
        DATABASE_MUTATION_ENVIRONMENT: "development",
        DATABASE_MUTATION_EXPECTED_PROJECT_ID: identity.project_id ?? "",
        DATABASE_MUTATION_EXPECTED_BRANCH_ID: identity.branch_id ?? "",
        DATABASE_MUTATION_EXPECTED_HOST: adminTarget.hostname.toLowerCase(),
        DATABASE_MUTATION_EXPECTED_DATABASE: identity.database_name,
      });
      await writeFile(pendingEnvironmentPath, nextEnvironment, { mode: 0o600 });
      pendingEnvironmentWritten = true;
      await createRoles(client, passwords);
    } else {
      const pendingEnvironment = await readOptional(pendingEnvironmentPath);
      if (pendingEnvironment) {
        const values = managedValuesFromFile(pendingEnvironment);
        process.env.MIGRATION_DATABASE_URL = values.MIGRATION_DATABASE_URL;
        process.env.DATABASE_URL = values.DATABASE_URL;
        pendingEnvironmentWritten = true;
      }
      const migrationTarget = postgresUrl(
        process.env.MIGRATION_DATABASE_URL,
        "MIGRATION_DATABASE_URL",
      );
      const runtimeTarget = postgresUrl(
        process.env.DATABASE_URL,
        "DATABASE_URL",
      );
      if (
        decodeURIComponent(migrationTarget.username) !==
          vaxDatabaseRoles.migrator ||
        decodeURIComponent(runtimeTarget.username) !== vaxDatabaseRoles.runtime
      ) {
        throw new Error("Existing VAX database role credentials are invalid.");
      }
    }

    await hardenOwnershipAndDefaults(
      client,
      identity.role_name,
      identity.database_name,
    );
    const pendingEnvironment = pendingEnvironmentWritten
      ? managedValuesFromFile(await readOptional(pendingEnvironmentPath))
      : process.env;
    const migrationConnection = postgresUrl(
      pendingEnvironment.MIGRATION_DATABASE_URL,
      "MIGRATION_DATABASE_URL",
    );
    const runtimeConnection = postgresUrl(
      pendingEnvironment.DATABASE_URL,
      "DATABASE_URL",
    );
    await assertProvisionedRole(
      migrationConnection.toString(),
      vaxDatabaseRoles.migrator,
      identity,
    );
    await assertProvisionedRole(
      runtimeConnection.toString(),
      vaxDatabaseRoles.runtime,
      identity,
    );
    if (pendingEnvironmentWritten) {
      await rename(pendingEnvironmentPath, localEnvironmentPath);
    }
    process.stdout.write(
      "Development database roles and ownership boundary provisioned.\n",
    );
  } catch (error) {
    if (pendingEnvironmentWritten) {
      process.stderr.write(
        "Provisioning failed; generated credentials remain in the ignored pending environment file.\n",
      );
    }
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(() => {
  process.stderr.write("Database role provisioning failed safely.\n");
  process.exitCode = 1;
});
