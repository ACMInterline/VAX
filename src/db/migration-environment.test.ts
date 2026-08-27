import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import type { Database } from "./client";
import {
  assertDevelopmentDatabaseIdentity,
  assertDevelopmentDatabaseMutationTarget,
} from "./migration-environment";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];
const localDatabaseUrl =
  "postgresql://vax_runtime:secret@localhost/vax_local_test";
const hostedDatabaseUrl =
  "postgresql://vax_runtime:secret@localhost/vax_hosted_test";

async function createProjectDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "vax-migration-env-"));
  temporaryDirectories.push(directory);

  await writeFile(
    path.join(directory, ".env.local"),
    `DATABASE_URL=${localDatabaseUrl}\n`,
    { mode: 0o600 },
  );

  return directory;
}

async function readLoadedDatabaseUrl(
  projectDirectory: string,
  databaseUrl?: string,
): Promise<string> {
  const runnerPath = path.resolve("node_modules/.bin/tsx");
  const modulePath = path.resolve("src/db/migration-environment.ts");
  const childEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "development",
  };

  if (databaseUrl === undefined) {
    delete childEnvironment.DATABASE_URL;
  } else {
    childEnvironment.DATABASE_URL = databaseUrl;
  }

  const script = [
    `import { loadMigrationEnvironment } from ${JSON.stringify(modulePath)};`,
    "loadMigrationEnvironment(process.cwd());",
    "process.stdout.write(process.env.DATABASE_URL ?? 'missing');",
  ].join("\n");

  const { stdout } = await execFileAsync(runnerPath, ["--eval", script], {
    cwd: projectDirectory,
    env: childEnvironment,
  });

  return stdout;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("loadMigrationEnvironment", () => {
  it("loads DATABASE_URL from a local-only environment file", async () => {
    const projectDirectory = await createProjectDirectory();

    await expect(readLoadedDatabaseUrl(projectDirectory)).resolves.toBe(
      localDatabaseUrl,
    );
  });

  it("preserves a host-provided DATABASE_URL", async () => {
    const projectDirectory = await createProjectDirectory();

    await expect(
      readLoadedDatabaseUrl(projectDirectory, hostedDatabaseUrl),
    ).resolves.toBe(hostedDatabaseUrl);
  });
});

describe("assertDevelopmentDatabaseMutationTarget", () => {
  const developmentUrl =
    "postgresql://vax_runtime:synthetic@development.db.invalid/neondb?sslmode=require&channel_binding=require";

  it("accepts only an explicit development target with an exact hostname and database", () => {
    expect(() =>
      assertDevelopmentDatabaseMutationTarget({
        NODE_ENV: "development",
        DATABASE_URL: developmentUrl,
        DATABASE_MUTATION_ENVIRONMENT: "development",
        DATABASE_MUTATION_EXPECTED_HOST: "development.db.invalid",
        DATABASE_MUTATION_EXPECTED_DATABASE: "neondb",
      }),
    ).not.toThrow();
  });

  it("requires the dedicated migrator URL without a runtime fallback", () => {
    const migrationUrl = developmentUrl.replace("vax_runtime", "vax_migrator");
    const environment = {
      NODE_ENV: "development",
      MIGRATION_DATABASE_URL: migrationUrl,
      DATABASE_MUTATION_ENVIRONMENT: "development",
      DATABASE_MUTATION_EXPECTED_HOST: "development.db.invalid",
      DATABASE_MUTATION_EXPECTED_DATABASE: "neondb",
    };

    expect(() =>
      assertDevelopmentDatabaseMutationTarget(environment, "migration"),
    ).not.toThrow();
    expect(() =>
      assertDevelopmentDatabaseMutationTarget(
        { ...environment, MIGRATION_DATABASE_URL: undefined },
        "migration",
      ),
    ).toThrow("Database mutation target is not authorized.");
  });

  it.each([
    {
      NODE_ENV: "production",
      DATABASE_URL: developmentUrl,
      DATABASE_MUTATION_ENVIRONMENT: "development",
      DATABASE_MUTATION_EXPECTED_HOST: "development.db.invalid",
      DATABASE_MUTATION_EXPECTED_DATABASE: "neondb",
    },
    {
      NODE_ENV: "development",
      DATABASE_URL: developmentUrl,
      DATABASE_MUTATION_ENVIRONMENT: "production",
      DATABASE_MUTATION_EXPECTED_HOST: "development.db.invalid",
      DATABASE_MUTATION_EXPECTED_DATABASE: "neondb",
    },
    {
      NODE_ENV: "development",
      DATABASE_URL: developmentUrl,
      DATABASE_MUTATION_ENVIRONMENT: "development",
      DATABASE_MUTATION_EXPECTED_HOST: "production.db.invalid",
      DATABASE_MUTATION_EXPECTED_DATABASE: "neondb",
    },
    {
      NODE_ENV: "development",
      DATABASE_URL: developmentUrl,
      DATABASE_MUTATION_ENVIRONMENT: "development",
      DATABASE_MUTATION_EXPECTED_HOST: "development.db.invalid",
      DATABASE_MUTATION_EXPECTED_DATABASE: "another_database",
    },
    {
      NODE_ENV: "development",
      DATABASE_MUTATION_ENVIRONMENT: "development",
      DATABASE_MUTATION_EXPECTED_HOST: "development.db.invalid",
      DATABASE_MUTATION_EXPECTED_DATABASE: "neondb",
    },
    {
      NODE_ENV: "development",
      DATABASE_URL: "not-a-postgres-url",
      DATABASE_MUTATION_ENVIRONMENT: "development",
      DATABASE_MUTATION_EXPECTED_HOST: "development.db.invalid",
      DATABASE_MUTATION_EXPECTED_DATABASE: "neondb",
    },
    {
      NODE_ENV: "development",
      DATABASE_URL: developmentUrl,
      DATABASE_MUTATION_ENVIRONMENT: "development",
      DATABASE_MUTATION_EXPECTED_HOST: "development.db.invalid",
    },
  ])("rejects an unauthorized mutation environment", (environment) => {
    expect(() => assertDevelopmentDatabaseMutationTarget(environment)).toThrow(
      "Database mutation target is not authorized.",
    );
  });

  it.each([
    "host=production.db.invalid",
    "hostaddr=192.0.2.1",
    "port=6432",
    "dbname=another_database",
    "database=another_database",
    "user=another_user",
    "password=another_password",
    "service=production",
    "options=endpoint%3Dproduction",
  ])(
    "rejects an alternate connection target or identity parameter",
    (query) => {
      expect(() =>
        assertDevelopmentDatabaseMutationTarget({
          NODE_ENV: "development",
          DATABASE_URL: `postgresql://vax_runtime:synthetic@development.db.invalid/neondb?${query}`,
          DATABASE_MUTATION_ENVIRONMENT: "development",
          DATABASE_MUTATION_EXPECTED_HOST: "development.db.invalid",
          DATABASE_MUTATION_EXPECTED_DATABASE: "neondb",
        }),
      ).toThrow("Database mutation target is not authorized.");
    },
  );
});

describe("assertDevelopmentDatabaseIdentity", () => {
  const environment = {
    NODE_ENV: "development",
    DATABASE_MUTATION_ENVIRONMENT: "development",
    DATABASE_MUTATION_EXPECTED_PROJECT_ID: "project-development",
    DATABASE_MUTATION_EXPECTED_BRANCH_ID: "branch-development",
    DATABASE_MUTATION_EXPECTED_DATABASE: "neondb",
  };

  function database(
    roleName: string,
    branchId = "branch-development",
    overrides: Readonly<Record<string, unknown>> = {},
  ): Database {
    return {
      execute: async () => ({
        rows: [
          {
            project_id: "project-development",
            branch_id: branchId,
            database_name: "neondb",
            role_name: roleName,
            rolsuper: false,
            rolinherit: false,
            rolcreaterole: false,
            rolcreatedb: false,
            rolreplication: false,
            rolbypassrls: false,
            membership_count: 0,
            database_create: roleName === "vax_migrator",
            public_schema_create: roleName === "vax_migrator",
            owned_runtime_objects: roleName === "vax_runtime" ? 0 : 158,
            ...overrides,
          },
        ],
      }),
    } as unknown as Database;
  }

  it("accepts the exact live runtime and migration identities", async () => {
    await expect(
      assertDevelopmentDatabaseIdentity(
        database("vax_runtime"),
        "runtime",
        environment,
      ),
    ).resolves.toBeUndefined();
    await expect(
      assertDevelopmentDatabaseIdentity(
        database("vax_migrator"),
        "migration",
        environment,
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects a different branch or owner-class identity", async () => {
    await expect(
      assertDevelopmentDatabaseIdentity(
        database("vax_runtime", "branch-production"),
        "runtime",
        environment,
      ),
    ).rejects.toThrow("Database mutation identity is not authorized.");
    await expect(
      assertDevelopmentDatabaseIdentity(
        database("neondb_owner"),
        "runtime",
        environment,
      ),
    ).rejects.toThrow("Database mutation identity is not authorized.");
  });

  it("rejects a named VAX role when its live privileges have drifted", async () => {
    await expect(
      assertDevelopmentDatabaseIdentity(
        database("vax_runtime", "branch-development", {
          rolbypassrls: true,
          membership_count: 1,
        }),
        "runtime",
        environment,
      ),
    ).rejects.toThrow("Database mutation identity is not authorized.");
    await expect(
      assertDevelopmentDatabaseIdentity(
        database("vax_migrator", "branch-development", {
          database_create: false,
        }),
        "migration",
        environment,
      ),
    ).rejects.toThrow("Database mutation identity is not authorized.");
  });
});
