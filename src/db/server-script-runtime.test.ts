import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const serverScriptTsconfig = "tsconfig.server-scripts.json";

async function readJson(file: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.resolve(file), "utf8")) as Record<
    string,
    unknown
  >;
}

function importWithServerScriptRuntime(modulePath: string): void {
  const environment = { ...process.env };
  delete environment.TSX_TSCONFIG_PATH;

  const result = spawnSync(
    path.resolve("node_modules/.bin/tsx"),
    [
      "--tsconfig",
      serverScriptTsconfig,
      "--input-type=module",
      "--eval",
      `await import(${JSON.stringify(`./${modulePath}`)})`,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: environment,
    },
  );

  expect({
    status: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
  }).toEqual({ status: 0, signal: null, stdout: "", stderr: "" });
}

describe("standalone server-script runtime", () => {
  it("keeps the server-only compatibility alias out of the Next.js config", async () => {
    const nextConfig = await readJson("tsconfig.json");
    const compilerOptions = nextConfig.compilerOptions as Record<string, unknown>;
    const paths = compilerOptions.paths as Record<string, unknown>;

    expect(paths["server-only"]).toBeUndefined();
  });

  it("loads the Phase 3N seed and rehearsal modules in the scoped Node runtime", () => {
    importWithServerScriptRuntime(
      "src/db/seed-business-authority-actor-context.ts",
    );
    importWithServerScriptRuntime(
      "src/db/rehearse-business-authority-concurrency.ts",
    );
    importWithServerScriptRuntime(
      "src/db/activate-attelier-staging-authority.ts",
    );
  });

  it("uses the scoped runtime for every Phase 3N database entry point", async () => {
    const packageJson = await readJson("package.json");
    const scripts = packageJson.scripts as Record<string, string>;

    expect(scripts["db:migrate"]).toContain(
      `tsx --tsconfig ${serverScriptTsconfig}`,
    );
    expect(scripts["db:migrate:staging"]).toContain(
      `tsx --tsconfig ${serverScriptTsconfig}`,
    );
    expect(scripts["db:rehearse-staging-rebuild"]).toContain(
      `tsx --tsconfig ${serverScriptTsconfig}`,
    );
    expect(scripts["authority:activate:attelier:staging"]).toContain(
      `tsx --tsconfig ${serverScriptTsconfig}`,
    );
    expect(scripts["authority:activate:attelier:staging"]).toContain(
      "src/db/run-attelier-staging-authority.ts",
    );
  });
});
