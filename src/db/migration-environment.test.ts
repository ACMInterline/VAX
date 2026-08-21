import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

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
