import { loadEnvConfig } from "@next/env";
import { getDatabaseUrl } from "../lib/environment";

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
): void {
  const expectedHost = environment.DATABASE_MUTATION_EXPECTED_HOST
    ?.trim()
    .toLowerCase();
  const expectedDatabase =
    environment.DATABASE_MUTATION_EXPECTED_DATABASE?.trim();
  let actualHost: string | undefined;
  let actualDatabase: string | undefined;
  let hasAmbiguousConnectionParameter = true;
  try {
    const target = new URL(getDatabaseUrl(environment));
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
