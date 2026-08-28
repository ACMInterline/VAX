import { execFile } from "node:child_process";
import {
  chmod,
  link,
  lstat,
  mkdtemp,
  mkdir,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertStagingAuthenticationTarget,
  assertStagingNextEnvironmentFiles,
  createStagingRuntimeEnvironment,
  isStagingTargetAuthorized,
  loadStagingEnvironment,
  loadStagingTargetAuthorization,
  parseStagingEnvironmentFile,
  parseStagingTargetEnvironmentFile,
  readSecureOwnerOnlyFile,
  writeDurableOwnerOnlyFile,
} from "./staging-environment";

const execFileAsync = promisify(execFile);
const targetKeys = [
  "DATABASE_ADMIN_EXPECTED_ROLE",
  "DATABASE_MUTATION_ENVIRONMENT",
  "DATABASE_MUTATION_EXPECTED_PROJECT_ID",
  "DATABASE_MUTATION_EXPECTED_BRANCH_ID",
  "DATABASE_MUTATION_EXPECTED_HOST",
  "DATABASE_MUTATION_EXPECTED_DATABASE",
  "NEON_AUTH_EXPECTED_BASE_URL",
] as const;

afterEach(() => {
  for (const key of targetKeys) delete process.env[key];
});

describe("staging environment boundary", () => {
  it("accepts only a staging-labeled allowlisted contract", () => {
    expect(
      parseStagingEnvironmentFile(
        [
          "VAX_ENVIRONMENT=staging",
          "DATABASE_URL=postgresql://synthetic",
          "RATE_LIMIT_BACKEND=database",
          "",
        ].join("\n"),
      ),
    ).toMatchObject({
      VAX_ENVIRONMENT: "staging",
      RATE_LIMIT_BACKEND: "database",
    });
  });

  it("rejects production labels, duplicate keys and arbitrary variables", () => {
    for (const contents of [
      "VAX_ENVIRONMENT=production\n",
      "VAX_ENVIRONMENT=staging\nDATABASE_MUTATION_ENVIRONMENT=staging\n",
      "VAX_ENVIRONMENT=staging\nVAX_ENVIRONMENT=staging\n",
      "VAX_ENVIRONMENT=staging\nNODE_OPTIONS=unsafe\n",
    ]) {
      expect(() => parseStagingEnvironmentFile(contents)).toThrow(
        "Staging environment file is invalid.",
      );
    }
  });

  it("loads a separate exact target manifest as an opaque authorization", async () => {
    const projectDirectory = await mkdtemp(
      path.join(tmpdir(), "vax-staging-target-"),
    );
    const contents = [
      "DATABASE_ADMIN_EXPECTED_ROLE=staging_admin",
      "DATABASE_MUTATION_ENVIRONMENT=staging",
      "DATABASE_MUTATION_EXPECTED_PROJECT_ID=project-staging",
      "DATABASE_MUTATION_EXPECTED_BRANCH_ID=branch-staging",
      "DATABASE_MUTATION_EXPECTED_HOST=staging.db.invalid",
      "DATABASE_MUTATION_EXPECTED_DATABASE=neondb",
      "NEON_AUTH_EXPECTED_BASE_URL=https://auth.staging.example.invalid/",
      "",
    ].join("\n");
    await writeFile(
      path.join(projectDirectory, ".env.staging.target.local"),
      contents,
      { mode: 0o600 },
    );

    expect(parseStagingTargetEnvironmentFile(contents)).toMatchObject({
      DATABASE_MUTATION_ENVIRONMENT: "staging",
      DATABASE_MUTATION_EXPECTED_BRANCH_ID: "branch-staging",
      NEON_AUTH_EXPECTED_BASE_URL: "https://auth.staging.example.invalid",
    });
    const authorization = await loadStagingTargetAuthorization(
      projectDirectory,
    );
    expect(isStagingTargetAuthorized(authorization, process.env)).toBe(true);
    expect(() =>
      assertStagingAuthenticationTarget(
        authorization,
        "https://auth.staging.example.invalid",
      ),
    ).not.toThrow();
    expect(() =>
      assertStagingAuthenticationTarget(
        authorization,
        "https://auth.other.example.invalid",
      ),
    ).toThrow("Staging authentication target is not authorized.");
    process.env.DATABASE_MUTATION_EXPECTED_BRANCH_ID = "branch-production";
    expect(isStagingTargetAuthorized(authorization, process.env)).toBe(false);
  });

  it("rejects incomplete, mixed or endpoint-shaped target manifests", () => {
    const valid = [
      "DATABASE_ADMIN_EXPECTED_ROLE=staging_admin",
      "DATABASE_MUTATION_ENVIRONMENT=staging",
      "DATABASE_MUTATION_EXPECTED_PROJECT_ID=project-staging",
      "DATABASE_MUTATION_EXPECTED_BRANCH_ID=branch-staging",
      "DATABASE_MUTATION_EXPECTED_HOST=staging.db.invalid",
      "DATABASE_MUTATION_EXPECTED_DATABASE=neondb",
      "NEON_AUTH_EXPECTED_BASE_URL=https://auth.staging.example.invalid",
    ];
    for (const contents of [
      valid.slice(1).join("\n"),
      [...valid, "UNRELATED=value"].join("\n"),
      valid.join("\n").replace("staging.db.invalid", "https://staging.db.invalid"),
      valid.join("\n").replace("=staging\n", "=production\n"),
      valid.join("\n").replace(
        "https://auth.staging.example.invalid",
        "http://127.0.0.1:3001",
      ),
      valid.join("\n").replace(
        "https://auth.staging.example.invalid",
        "https://user:password@auth.staging.example.invalid",
      ),
      valid.join("\n").replace(
        "https://auth.staging.example.invalid",
        "https://auth.staging.example.invalid?tenant=other",
      ),
      valid.join("\n").replace(
        "https://auth.staging.example.invalid",
        "https://auth.staging.example.invalid#other",
      ),
    ]) {
      expect(() => parseStagingTargetEnvironmentFile(contents)).toThrow(
        "Staging target manifest is invalid.",
      );
    }
  });

  it("builds a runtime-only child environment", () => {
    const environment = createStagingRuntimeEnvironment({
      PATH: "/synthetic/bin",
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://synthetic-runtime",
      MIGRATION_DATABASE_URL: "postgresql://synthetic-migrator",
      DATABASE_ADMIN_URL: "postgresql://synthetic-administrator",
      DATABASE_MUTATION_ENVIRONMENT: "staging",
      STAGING_ROTATION_EXPECTED_PROJECT_ID: "synthetic-project",
      UNRELATED_SECRET: "synthetic-secret",
      VAX_ENVIRONMENT: "staging",
      STAGING_ALLOW_LOCALHOST: "true",
      PUBLIC_SITE_URL: "http://127.0.0.1:3000",
      NEON_AUTH_BASE_URL: "https://auth.example.invalid",
      NEON_AUTH_COOKIE_SECRET: "synthetic-cookie-secret",
      RATE_LIMIT_BACKEND: "database",
      RATE_LIMIT_HASH_SECRET: "synthetic-rate-limit-secret",
    });

    expect(environment).toMatchObject({
      NODE_ENV: "development",
      NEXT_TELEMETRY_DISABLED: "1",
      DATABASE_URL: "postgresql://synthetic-runtime",
      VAX_ENVIRONMENT: "staging",
      NEON_AUTH_COOKIE_SECRET: "synthetic-cookie-secret",
      RATE_LIMIT_HASH_SECRET: "synthetic-rate-limit-secret",
    });
    expect(environment.MIGRATION_DATABASE_URL).toBe("");
    expect(environment.DATABASE_ADMIN_URL).toBe("");
    expect(environment.DATABASE_MUTATION_ENVIRONMENT).toBe("");
    expect(environment).not.toHaveProperty(
      "STAGING_ROTATION_EXPECTED_PROJECT_ID",
    );
    expect(environment).not.toHaveProperty("UNRELATED_SECRET");
    expect(environment).not.toHaveProperty("NODE_OPTIONS");
    expect(environment).not.toHaveProperty("NODE_EXTRA_CA_CERTS");
    expect(environment.PATH).not.toContain("/synthetic/bin");
    expect(JSON.stringify(environment)).not.toContain("synthetic-migrator");
    expect(JSON.stringify(environment)).not.toContain(
      "synthetic-administrator",
    );
  });

  it("prevents Next.js dotenv loading from restoring operator credentials", async () => {
    const projectDirectory = await mkdtemp(
      path.join(tmpdir(), "vax-staging-next-environment-"),
    );
    await writeFile(
      path.join(projectDirectory, ".env.local"),
      [
        "DATABASE_URL=postgresql://development-runtime",
        "MIGRATION_DATABASE_URL=postgresql://development-migrator",
        "DATABASE_ADMIN_URL=postgresql://development-administrator",
        "DATABASE_MUTATION_ENVIRONMENT=development",
        "",
      ].join("\n"),
      { mode: 0o600 },
    );
    await expect(
      assertStagingNextEnvironmentFiles(projectDirectory),
    ).resolves.toBeUndefined();

    const runtimeEnvironment = createStagingRuntimeEnvironment({
      PATH: process.env.PATH,
      DATABASE_URL: "postgresql://staging-runtime",
      VAX_ENVIRONMENT: "staging",
    });
    const script = [
      'const { loadEnvConfig } = require("@next/env");',
      "loadEnvConfig(process.argv[1], true);",
      "process.stdout.write(JSON.stringify({",
      'runtime: process.env.DATABASE_URL === "postgresql://staging-runtime",',
      'migrationMasked: process.env.MIGRATION_DATABASE_URL === "",',
      'administratorMasked: process.env.DATABASE_ADMIN_URL === "",',
      'mutationMasked: process.env.DATABASE_MUTATION_ENVIRONMENT === "",',
      "}));",
    ].join("");
    const { stdout } = await execFileAsync(process.execPath, ["-e", script, projectDirectory], {
      cwd: process.cwd(),
      env: runtimeEnvironment,
    });

    expect(JSON.parse(stdout)).toEqual({
      runtime: true,
      migrationMasked: true,
      administratorMasked: true,
      mutationMasked: true,
    });
  });

  it("rejects unrelated dotenv keys before starting staging", async () => {
    const projectDirectory = await mkdtemp(
      path.join(tmpdir(), "vax-staging-next-environment-"),
    );
    await writeFile(
      path.join(projectDirectory, ".env.development.local"),
      "UNRELATED_SECRET=synthetic\n",
      { mode: 0o600 },
    );

    await expect(
      assertStagingNextEnvironmentFiles(projectDirectory),
    ).rejects.toThrow("Local staging environment boundary is unsafe.");
  });

  it("requires owner-only file permissions", async () => {
    const projectDirectory = await mkdtemp(
      path.join(tmpdir(), "vax-staging-environment-"),
    );
    await mkdir(projectDirectory, { recursive: true });
    const filePath = path.join(projectDirectory, ".env.staging.local");
    const contents = "VAX_ENVIRONMENT=staging\n";
    await writeFile(filePath, contents, { mode: 0o644 });
    await expect(loadStagingEnvironment(projectDirectory)).rejects.toThrow(
      "Owner-only local configuration is unavailable or insecure.",
    );
    await chmod(filePath, 0o600);
    await expect(
      loadStagingEnvironment(projectDirectory),
    ).resolves.toBeUndefined();
  });

  it("clears every omitted managed key instead of inheriting ambient values", async () => {
    const projectDirectory = await mkdtemp(
      path.join(tmpdir(), "vax-staging-environment-authoritative-"),
    );
    await writeFile(
      path.join(projectDirectory, ".env.staging.local"),
      "VAX_ENVIRONMENT=staging\nVAX_TRUSTED_PROXY_HOPS=\n",
      { mode: 0o600 },
    );
    const previous = {
      DATABASE_URL: process.env.DATABASE_URL,
      MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL,
      DATABASE_ADMIN_URL: process.env.DATABASE_ADMIN_URL,
      NEON_AUTH_BASE_URL: process.env.NEON_AUTH_BASE_URL,
      NEON_AUTH_COOKIE_SECRET: process.env.NEON_AUTH_COOKIE_SECRET,
      RATE_LIMIT_HASH_SECRET: process.env.RATE_LIMIT_HASH_SECRET,
      NEON_AUTH_EXPECTED_BASE_URL: process.env.NEON_AUTH_EXPECTED_BASE_URL,
      VAX_ENVIRONMENT: process.env.VAX_ENVIRONMENT,
      VAX_TRUSTED_PROXY_HOPS: process.env.VAX_TRUSTED_PROXY_HOPS,
    };
    Object.assign(process.env, {
      DATABASE_URL: "postgresql://ambient-runtime",
      MIGRATION_DATABASE_URL: "postgresql://ambient-migrator",
      DATABASE_ADMIN_URL: "postgresql://ambient-administrator",
      NEON_AUTH_BASE_URL: "https://ambient-auth.example.invalid",
      NEON_AUTH_COOKIE_SECRET: "ambient-cookie-secret",
      RATE_LIMIT_HASH_SECRET: "ambient-rate-limit-secret",
      NEON_AUTH_EXPECTED_BASE_URL: "https://ambient-target.example.invalid",
    });

    try {
      await loadStagingEnvironment(projectDirectory);
      expect(process.env.VAX_ENVIRONMENT).toBe("staging");
      expect(process.env.VAX_TRUSTED_PROXY_HOPS).toBe("");
      for (const key of [
        "DATABASE_URL",
        "MIGRATION_DATABASE_URL",
        "DATABASE_ADMIN_URL",
        "NEON_AUTH_BASE_URL",
        "NEON_AUTH_COOKIE_SECRET",
        "RATE_LIMIT_HASH_SECRET",
        "NEON_AUTH_EXPECTED_BASE_URL",
      ]) {
        expect(process.env[key]).toBeUndefined();
      }
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("rejects symlinks, hard links and non-regular staging sources", async () => {
    const projectDirectory = await mkdtemp(
      path.join(tmpdir(), "vax-staging-environment-links-"),
    );
    const sourcePath = path.join(projectDirectory, "source");
    await writeFile(sourcePath, "VAX_ENVIRONMENT=staging\n", { mode: 0o600 });

    const symbolicPath = path.join(projectDirectory, "symbolic");
    await symlink(sourcePath, symbolicPath);
    await expect(readSecureOwnerOnlyFile(symbolicPath)).rejects.toThrow(
      "Owner-only local configuration is unavailable or insecure.",
    );

    const hardPath = path.join(projectDirectory, "hard");
    await link(sourcePath, hardPath);
    await expect(readSecureOwnerOnlyFile(hardPath)).rejects.toThrow(
      "Owner-only local configuration is unavailable or insecure.",
    );
    await expect(readSecureOwnerOnlyFile(projectDirectory)).rejects.toThrow(
      "Owner-only local configuration is unavailable or insecure.",
    );
  });

  it("creates a durable owner-only file exclusively", async () => {
    const projectDirectory = await mkdtemp(
      path.join(tmpdir(), "vax-staging-durable-file-"),
    );
    const filePath = path.join(projectDirectory, "pending");

    await writeDurableOwnerOnlyFile(filePath, "synthetic\n");
    expect((await lstat(filePath)).mode & 0o777).toBe(0o600);
    await expect(
      writeDurableOwnerOnlyFile(filePath, "replacement\n"),
    ).rejects.toMatchObject({ code: "EEXIST" });
  });
});
