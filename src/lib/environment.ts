import { z } from "zod";
import { vaxDatabaseRoles } from "../db/database-security-policy";
import { getVaxEnvironment } from "../operations/environment";

const postgresUrlSchema = z.url({ protocol: /^postgres(?:ql)?$/ });
const allowedPostgresConnectionParameters = new Set([
  "channel_binding",
  "sslmode",
]);

function configuredDatabaseUrl(
  environment: Readonly<Record<string, string | undefined>>,
  variable: string,
  expectedRole: string,
): string {
  const result = postgresUrlSchema.safeParse(environment[variable]);
  if (!result.success) {
    throw new Error(`${variable} is not configured.`);
  }

  let role: string;
  let target: URL;
  try {
    target = new URL(result.data);
    role = decodeURIComponent(target.username);
  } catch {
    throw new Error(`${variable} is not configured.`);
  }
  if (
    [...target.searchParams.keys()].some(
      (key) => !allowedPostgresConnectionParameters.has(key.toLowerCase()),
    )
  ) {
    throw new Error(`${variable} contains unsupported connection parameters.`);
  }
  const sslModes = [...target.searchParams.entries()]
    .filter(([key]) => key.toLowerCase() === "sslmode")
    .map(([, value]) => value.trim().toLowerCase());
  const requiresStrictTls =
    environment.NODE_ENV === "production" ||
    getVaxEnvironment(environment) !== "development";
  if (
    sslModes.length > 1 ||
    sslModes.includes("disable") ||
    (requiresStrictTls &&
      (sslModes.length !== 1 || sslModes[0] !== "verify-full"))
  ) {
    throw new Error(`${variable} does not require certificate verification.`);
  }
  if (role !== expectedRole) {
    throw new Error(`${variable} does not use the required database role.`);
  }
  return result.data;
}

export function getDatabaseUrl(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  return configuredDatabaseUrl(
    environment,
    "DATABASE_URL",
    vaxDatabaseRoles.runtime,
  );
}

export function getMigrationDatabaseUrl(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  return configuredDatabaseUrl(
    environment,
    "MIGRATION_DATABASE_URL",
    vaxDatabaseRoles.migrator,
  );
}

export function getDatabaseAdminUrl(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const expectedRole = environment.DATABASE_ADMIN_EXPECTED_ROLE?.trim();
  if (!expectedRole) {
    throw new Error("DATABASE_ADMIN_EXPECTED_ROLE is not configured.");
  }
  return configuredDatabaseUrl(environment, "DATABASE_ADMIN_URL", expectedRole);
}
