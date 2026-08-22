import { loadEnvConfig } from "@next/env";
import { getDatabaseUrl } from "../lib/environment";

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
  let actualHost: string | undefined;
  try {
    actualHost = new URL(getDatabaseUrl(environment)).hostname.toLowerCase();
  } catch {
    // The mutation boundary deliberately exposes one safe failure mode.
  }

  if (
    environment.NODE_ENV === "production" ||
    environment.DATABASE_MUTATION_ENVIRONMENT !== "development" ||
    !expectedHost ||
    !actualHost ||
    actualHost !== expectedHost
  ) {
    throw new Error("Database mutation target is not authorized.");
  }
}
