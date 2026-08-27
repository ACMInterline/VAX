import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { assertDevelopmentDatabaseMutationTarget } from "./migration-environment";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];
const localDatabaseUrl = "postgresql://localhost/vax_local_test";
const hostedDatabaseUrl = "postgresql://localhost/vax_hosted_test";

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
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
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
    "postgresql://synthetic:synthetic@development.db.invalid/neondb?sslmode=require&channel_binding=require";

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
  ])("rejects an alternate connection target or identity parameter", (query) => {
    expect(() =>
      assertDevelopmentDatabaseMutationTarget({
        NODE_ENV: "development",
        DATABASE_URL: `postgresql://synthetic:synthetic@development.db.invalid/neondb?${query}`,
        DATABASE_MUTATION_ENVIRONMENT: "development",
        DATABASE_MUTATION_EXPECTED_HOST: "development.db.invalid",
        DATABASE_MUTATION_EXPECTED_DATABASE: "neondb",
      }),
    ).toThrow("Database mutation target is not authorized.");
  });
});
