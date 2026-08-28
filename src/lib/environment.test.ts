import { describe, expect, it } from "vitest";
import {
  getDatabaseAdminUrl,
  getDatabaseUrl,
  getMigrationDatabaseUrl,
} from "./environment";

describe("getDatabaseUrl", () => {
  it("accepts a PostgreSQL URL", () => {
    const separator = String.fromCharCode(58, 47, 47);
    const databaseUrl = `postgresql${separator}vax_runtime:secret@localhost/database`;

    expect(getDatabaseUrl({ DATABASE_URL: databaseUrl })).toBe(databaseUrl);
  });

  it("keeps runtime and migration authority separate", () => {
    const runtimeUrl = "postgresql://vax_runtime:secret@localhost/database";
    const migrationUrl =
      "postgresql://vax_migrator:secret@localhost/database";

    expect(
      getMigrationDatabaseUrl({ MIGRATION_DATABASE_URL: migrationUrl }),
    ).toBe(migrationUrl);
    expect(() =>
      getDatabaseUrl({ DATABASE_URL: migrationUrl }),
    ).toThrow("DATABASE_URL does not use the required database role.");
    expect(() =>
      getMigrationDatabaseUrl({ MIGRATION_DATABASE_URL: runtimeUrl }),
    ).toThrow(
      "MIGRATION_DATABASE_URL does not use the required database role.",
    );
  });

  it.each([
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
  ])("rejects the %s connection-authority override for every credential", (key) => {
    const runtimeUrl = `postgresql://vax_runtime:secret@localhost/database?${key}=override`;
    const migrationUrl = `postgresql://vax_migrator:secret@localhost/database?${key}=override`;
    const adminUrl = `postgresql://development_admin:secret@localhost/database?${key}=override`;

    expect(() => getDatabaseUrl({ DATABASE_URL: runtimeUrl })).toThrow(
      "DATABASE_URL contains unsupported connection parameters.",
    );
    expect(() =>
      getMigrationDatabaseUrl({ MIGRATION_DATABASE_URL: migrationUrl }),
    ).toThrow(
      "MIGRATION_DATABASE_URL contains unsupported connection parameters.",
    );
    expect(() =>
      getDatabaseAdminUrl({
        DATABASE_ADMIN_URL: adminUrl,
        DATABASE_ADMIN_EXPECTED_ROLE: "development_admin",
      }),
    ).toThrow(
      "DATABASE_ADMIN_URL contains unsupported connection parameters.",
    );
  });

  it("rejects encoded, mixed-case, and unreviewed connection parameters", () => {
    for (const query of [
      "%75ser=vax_migrator",
      "UsEr=vax_migrator",
      "application_name=vax",
    ]) {
      expect(() =>
        getDatabaseUrl({
          DATABASE_URL: `postgresql://vax_runtime:secret@localhost/database?${query}`,
        }),
      ).toThrow("DATABASE_URL contains unsupported connection parameters.");
    }
  });

  it("retains the reviewed Neon TLS connection parameters", () => {
    const databaseUrl =
      "postgresql://vax_runtime:secret@localhost/database?sslmode=require&channel_binding=require";

    expect(getDatabaseUrl({ DATABASE_URL: databaseUrl })).toBe(databaseUrl);
  });

  it("rejects a disabled TLS mode in every environment", () => {
    expect(() =>
      getDatabaseUrl({
        DATABASE_URL:
          "postgresql://vax_runtime:secret@localhost/database?sslmode=disable",
      }),
    ).toThrow("DATABASE_URL does not require certificate verification.");
  });

  it.each([
    {
      label: "staging",
      environment: { VAX_ENVIRONMENT: "staging", NODE_ENV: "development" },
    },
    {
      label: "production deployment",
      environment: { VAX_ENVIRONMENT: "production", NODE_ENV: "production" },
    },
    {
      label: "production process",
      environment: { NODE_ENV: "production" },
    },
  ])("requires verify-full in $label", ({ environment }) => {
    const weakUrl =
      "postgresql://vax_runtime:secret@database.invalid/database?sslmode=require";
    const strictUrl = weakUrl.replace("sslmode=require", "sslmode=verify-full");

    expect(() =>
      getDatabaseUrl({ ...environment, DATABASE_URL: weakUrl }),
    ).toThrow("DATABASE_URL does not require certificate verification.");
    expect(() =>
      getDatabaseUrl({
        ...environment,
        DATABASE_URL: weakUrl.replace("?sslmode=require", ""),
      }),
    ).toThrow("DATABASE_URL does not require certificate verification.");
    expect(getDatabaseUrl({ ...environment, DATABASE_URL: strictUrl })).toBe(
      strictUrl,
    );
  });

  it("rejects ambiguous duplicate TLS modes", () => {
    expect(() =>
      getDatabaseUrl({
        DATABASE_URL:
          "postgresql://vax_runtime:secret@localhost/database?sslmode=verify-full&sslmode=disable",
      }),
    ).toThrow("DATABASE_URL does not require certificate verification.");
  });

  it("requires an explicitly named administrative identity", () => {
    const adminUrl =
      "postgresql://development_admin:secret@localhost/database";

    expect(
      getDatabaseAdminUrl({
        DATABASE_ADMIN_URL: adminUrl,
        DATABASE_ADMIN_EXPECTED_ROLE: "development_admin",
      }),
    ).toBe(adminUrl);
    expect(() =>
      getDatabaseAdminUrl({ DATABASE_ADMIN_URL: adminUrl }),
    ).toThrow("DATABASE_ADMIN_EXPECTED_ROLE is not configured.");
  });

  it("rejects a missing database configuration without echoing input", () => {
    expect(() => getDatabaseUrl({ DATABASE_URL: "" })).toThrow(
      "DATABASE_URL is not configured.",
    );
  });
});
