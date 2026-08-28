import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import type { Database } from "./client";
import {
  loadStagingTargetAuthorization,
  type StagingTargetAuthorization,
} from "./staging-environment";
import {
  assertDevelopmentDatabaseIdentity,
  assertDevelopmentDatabaseMutationTarget,
  assertNonProductionDatabaseAdministratorIdentity,
  assertNonProductionDatabaseIdentity,
  assertNonProductionDatabaseMutationTarget,
  isEmptyDatabaseMigratorLeastPrivilege,
} from "./migration-environment";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];
const localDatabaseUrl =
  "postgresql://vax_runtime:secret@localhost/vax_local_test";
const hostedDatabaseUrl =
  "postgresql://vax_runtime:secret@localhost/vax_hosted_test";
const stagingTarget = {
  DATABASE_ADMIN_EXPECTED_ROLE: "staging_admin",
  DATABASE_MUTATION_ENVIRONMENT: "staging",
  DATABASE_MUTATION_EXPECTED_PROJECT_ID: "project-staging",
  DATABASE_MUTATION_EXPECTED_BRANCH_ID: "branch-staging",
  DATABASE_MUTATION_EXPECTED_HOST: "ep-staging.region.neon.tech",
  DATABASE_MUTATION_EXPECTED_DATABASE: "neondb",
  NEON_AUTH_EXPECTED_BASE_URL: "https://auth.staging.example.invalid",
} as const;

async function createStagingAuthorization(
  overrides: Readonly<Record<string, string>> = {},
): Promise<StagingTargetAuthorization> {
  const directory = await mkdtemp(path.join(tmpdir(), "vax-staging-target-"));
  temporaryDirectories.push(directory);
  const values = { ...stagingTarget, ...overrides };
  await writeFile(
    path.join(directory, ".env.staging.target.local"),
    [
      `DATABASE_ADMIN_EXPECTED_ROLE=${values.DATABASE_ADMIN_EXPECTED_ROLE}`,
      `DATABASE_MUTATION_ENVIRONMENT=${values.DATABASE_MUTATION_ENVIRONMENT}`,
      `DATABASE_MUTATION_EXPECTED_PROJECT_ID=${values.DATABASE_MUTATION_EXPECTED_PROJECT_ID}`,
      `DATABASE_MUTATION_EXPECTED_BRANCH_ID=${values.DATABASE_MUTATION_EXPECTED_BRANCH_ID}`,
      `DATABASE_MUTATION_EXPECTED_HOST=${values.DATABASE_MUTATION_EXPECTED_HOST}`,
      `DATABASE_MUTATION_EXPECTED_DATABASE=${values.DATABASE_MUTATION_EXPECTED_DATABASE}`,
      `NEON_AUTH_EXPECTED_BASE_URL=${values.NEON_AUTH_EXPECTED_BASE_URL}`,
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  return loadStagingTargetAuthorization(directory);
}

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
  for (const key of Object.keys(stagingTarget)) delete process.env[key];
});

describe("empty rebuild database migrator privilege boundary", () => {
  const exact = {
    rolcanlogin: true,
    rolsuper: false,
    rolinherit: false,
    rolcreaterole: false,
    rolcreatedb: false,
    rolreplication: false,
    rolbypassrls: false,
    membership_count: 0,
    database_create: true,
    public_schema_create: true,
    owned_runtime_objects: 0,
  } as const;

  it("accepts only the exact pre-migration least-privilege shape", () => {
    expect(isEmptyDatabaseMigratorLeastPrivilege(exact)).toBe(true);
    for (const drift of [
      { rolcanlogin: false },
      { rolsuper: true },
      { rolinherit: true },
      { rolcreaterole: true },
      { rolcreatedb: true },
      { rolreplication: true },
      { rolbypassrls: true },
      { membership_count: 1 },
      { database_create: false },
      { public_schema_create: false },
      { owned_runtime_objects: 1 },
    ]) {
      expect(
        isEmptyDatabaseMigratorLeastPrivilege({ ...exact, ...drift }),
      ).toBe(false);
    }
  });
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

  it("accepts staging only through the secured target authorization", async () => {
    const staging = {
      ...stagingTarget,
      NODE_ENV: "development",
      DATABASE_URL:
        "postgresql://vax_runtime:synthetic@ep-staging-pooler.region.neon.tech/neondb?sslmode=verify-full",
    };
    const authorization = await createStagingAuthorization();

    expect(() =>
      assertNonProductionDatabaseMutationTarget(
        staging,
        "runtime",
        authorization,
      ),
    ).not.toThrow();
    expect(() => assertNonProductionDatabaseMutationTarget(staging)).toThrow(
      "Database mutation target is not authorized.",
    );
    expect(() => assertDevelopmentDatabaseMutationTarget(staging)).toThrow(
      "Database mutation target is not authorized.",
    );
  });

  it("accepts only the exact Neon pooler sibling for runtime traffic", async () => {
    const environment = {
      ...stagingTarget,
      NODE_ENV: "development",
      DATABASE_URL:
        "postgresql://vax_runtime:synthetic@ep-staging-pooler.region.neon.tech/neondb?sslmode=verify-full",
    };
    const authorization = await createStagingAuthorization();

    expect(() =>
      assertNonProductionDatabaseMutationTarget(
        environment,
        "runtime",
        authorization,
      ),
    ).not.toThrow();
    expect(() =>
      assertNonProductionDatabaseMutationTarget(
        {
          ...environment,
          DATABASE_URL:
            "postgresql://vax_runtime:synthetic@ep-other-pooler.region.neon.tech/neondb?sslmode=verify-full",
        },
        "runtime",
        authorization,
      ),
    ).toThrow("Database mutation target is not authorized.");
    expect(() =>
      assertNonProductionDatabaseMutationTarget(
        {
          ...environment,
          MIGRATION_DATABASE_URL: environment.DATABASE_URL.replace(
            "vax_runtime",
            "vax_migrator",
          ),
        },
        "migration",
        authorization,
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

  it("accepts staging identity only through secured target authorization", async () => {
    const staging = {
      ...environment,
      DATABASE_ADMIN_EXPECTED_ROLE: "staging_admin",
      DATABASE_MUTATION_ENVIRONMENT: "staging",
      DATABASE_MUTATION_EXPECTED_HOST: "development.db.invalid",
      NEON_AUTH_EXPECTED_BASE_URL: "https://auth.staging.example.invalid",
    };
    const authorization = await createStagingAuthorization({
      DATABASE_MUTATION_EXPECTED_PROJECT_ID: "project-development",
      DATABASE_MUTATION_EXPECTED_BRANCH_ID: "branch-development",
      DATABASE_MUTATION_EXPECTED_HOST: "development.db.invalid",
    });
    await expect(
      assertNonProductionDatabaseIdentity(
        database("vax_runtime"),
        "runtime",
        staging,
        authorization,
      ),
    ).resolves.toBeUndefined();
    await expect(
      assertNonProductionDatabaseIdentity(
        database("vax_runtime"),
        "runtime",
        staging,
      ),
    ).rejects.toThrow("Database mutation identity is not authorized.");
    await expect(
      assertDevelopmentDatabaseIdentity(
        database("vax_runtime"),
        "runtime",
        staging,
      ),
    ).rejects.toThrow("Database mutation identity is not authorized.");
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

describe("assertNonProductionDatabaseAdministratorIdentity", () => {
  const environment = {
    ...stagingTarget,
    NODE_ENV: "development",
  };
  const identity = {
    project_id: "project-staging",
    branch_id: "branch-staging",
    database_name: "neondb",
    role_name: "staging_admin",
  };

  it("accepts only the exact secured non-production administrator identity", async () => {
    const authorization = await createStagingAuthorization();
    expect(() =>
      assertNonProductionDatabaseAdministratorIdentity(
        identity,
        environment,
        authorization,
      ),
    ).not.toThrow();
    expect(() =>
      assertNonProductionDatabaseAdministratorIdentity(identity, environment),
    ).toThrow("Database administrator identity is not authorized.");
    expect(() =>
      assertNonProductionDatabaseAdministratorIdentity(
        { ...identity, branch_id: "branch-production" },
        environment,
        authorization,
      ),
    ).toThrow("Database administrator identity is not authorized.");
    expect(() =>
      assertNonProductionDatabaseAdministratorIdentity(
        { ...identity, role_name: "another_admin" },
        environment,
        authorization,
      ),
    ).toThrow("Database administrator identity is not authorized.");
  });

  it("rejects production-mode and incomplete expectations", async () => {
    const authorization = await createStagingAuthorization();
    expect(() =>
      assertNonProductionDatabaseAdministratorIdentity(identity, {
        ...environment,
        NODE_ENV: "production",
      }, authorization),
    ).toThrow("Database administrator identity is not authorized.");
    expect(() =>
      assertNonProductionDatabaseAdministratorIdentity(identity, {
        ...environment,
        DATABASE_MUTATION_EXPECTED_BRANCH_ID: undefined,
      }, authorization),
    ).toThrow("Database administrator identity is not authorized.");
  });
});
