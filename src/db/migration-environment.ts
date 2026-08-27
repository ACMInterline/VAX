import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";
import {
  getDatabaseAdminUrl,
  getDatabaseUrl,
  getMigrationDatabaseUrl,
} from "../lib/environment";
import type { Database } from "./client";
import { vaxDatabaseRoles } from "./database-security-policy";

const ambiguousConnectionParameters = new Set([
  "database",
  "dbname",
  "host",
  "hostaddr",
  "options",
  "passfile",
  "password",
  "port",
  "service",
  "servicefile",
  "user",
  "username",
]);

export function loadMigrationEnvironment(
  projectDirectory: string = process.cwd(),
): void {
  loadEnvConfig(projectDirectory);
}

export function assertDevelopmentDatabaseMutationTarget(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  credential: "runtime" | "migration" | "admin" = "runtime",
): void {
  const expectedHost =
    environment.DATABASE_MUTATION_EXPECTED_HOST?.trim().toLowerCase();
  const expectedDatabase =
    environment.DATABASE_MUTATION_EXPECTED_DATABASE?.trim();
  let actualHost: string | undefined;
  let actualDatabase: string | undefined;
  let hasAmbiguousConnectionParameter = true;
  try {
    const databaseUrl =
      credential === "runtime"
        ? getDatabaseUrl(environment)
        : credential === "migration"
          ? getMigrationDatabaseUrl(environment)
          : getDatabaseAdminUrl(environment);
    const target = new URL(databaseUrl);
    actualHost = target.hostname.toLowerCase();
    actualDatabase = decodeURIComponent(target.pathname.slice(1));
    hasAmbiguousConnectionParameter = [...target.searchParams.keys()].some(
      (key) => ambiguousConnectionParameters.has(key.toLowerCase()),
    );
  } catch {
    // The mutation boundary deliberately exposes one safe failure mode.
  }

  if (
    environment.NODE_ENV === "production" ||
    environment.DATABASE_MUTATION_ENVIRONMENT !== "development" ||
    !expectedHost ||
    !expectedDatabase ||
    !actualHost ||
    !actualDatabase ||
    hasAmbiguousConnectionParameter ||
    actualHost !== expectedHost ||
    actualDatabase !== expectedDatabase
  ) {
    throw new Error("Database mutation target is not authorized.");
  }
}

export async function assertDevelopmentDatabaseIdentity(
  database: Database,
  credential: "runtime" | "migration",
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<void> {
  const expectedProjectId =
    environment.DATABASE_MUTATION_EXPECTED_PROJECT_ID?.trim();
  const expectedBranchId =
    environment.DATABASE_MUTATION_EXPECTED_BRANCH_ID?.trim();
  const expectedDatabase =
    environment.DATABASE_MUTATION_EXPECTED_DATABASE?.trim();
  const expectedRole =
    credential === "runtime"
      ? vaxDatabaseRoles.runtime
      : vaxDatabaseRoles.migrator;
  const result = await database.execute<{
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
  }>(sql`
    select current_setting('neon.project_id', true) as project_id,
      current_setting('neon.branch_id', true) as branch_id,
      current_database() as database_name,
      current_user as role_name,
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
    from pg_roles role
    where role.rolname = current_user
  `);
  const identity = result.rows[0];
  if (
    environment.NODE_ENV === "production" ||
    environment.DATABASE_MUTATION_ENVIRONMENT !== "development" ||
    !expectedProjectId ||
    !expectedBranchId ||
    !expectedDatabase ||
    identity?.project_id !== expectedProjectId ||
    identity.branch_id !== expectedBranchId ||
    identity.database_name !== expectedDatabase ||
    identity.role_name !== expectedRole ||
    identity.rolsuper ||
    identity.rolinherit ||
    identity.rolcreaterole ||
    identity.rolcreatedb ||
    identity.rolreplication ||
    identity.rolbypassrls ||
    identity.membership_count !== 0 ||
    (credential === "runtime" &&
      (identity.database_create ||
        identity.public_schema_create ||
        identity.owned_runtime_objects !== 0)) ||
    (credential === "migration" &&
      (!identity.database_create || !identity.public_schema_create))
  ) {
    throw new Error("Database mutation identity is not authorized.");
  }
}
