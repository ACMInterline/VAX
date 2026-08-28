import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadStagingTargetAuthorization,
  stagingTargetEnvironment,
} from "@/db/staging-environment";
import { assertStagingRuntimeTargets } from "./staging-development";

async function stagingAuthorization() {
  const projectDirectory = await mkdtemp(
    path.join(tmpdir(), "vax-staging-runtime-target-"),
  );
  await writeFile(
    path.join(projectDirectory, ".env.staging.target.local"),
    [
      "DATABASE_ADMIN_EXPECTED_ROLE=staging_admin",
      "DATABASE_MUTATION_ENVIRONMENT=staging",
      "DATABASE_MUTATION_EXPECTED_PROJECT_ID=project-staging",
      "DATABASE_MUTATION_EXPECTED_BRANCH_ID=branch-staging",
      "DATABASE_MUTATION_EXPECTED_HOST=ep-staging.region.neon.tech",
      "DATABASE_MUTATION_EXPECTED_DATABASE=neondb",
      "NEON_AUTH_EXPECTED_BASE_URL=https://auth.staging.example.invalid/",
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  return loadStagingTargetAuthorization(projectDirectory);
}

describe("local staging runtime target preflight", () => {
  it("accepts only the authorized pooled database sibling and Auth endpoint", async () => {
    const authorization = await stagingAuthorization();
    const environment = {
      ...stagingTargetEnvironment(authorization),
      NODE_ENV: "development",
      VAX_ENVIRONMENT: "staging",
      STAGING_ALLOW_LOCALHOST: "true",
      DATABASE_URL:
        "postgresql://vax_runtime:synthetic@ep-staging-pooler.region.neon.tech/neondb?sslmode=verify-full",
      PUBLIC_SITE_URL: "http://127.0.0.1:3000",
      AUTH_TRUSTED_ORIGINS: "http://127.0.0.1:3000",
      NEON_AUTH_BASE_URL: "https://auth.staging.example.invalid",
      NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
      AUTH_REQUIRE_VERIFIED_EMAIL: "true",
    };

    expect(() =>
      assertStagingRuntimeTargets(environment, authorization),
    ).not.toThrow();
    for (const unsafe of [
      {
        DATABASE_URL:
          "postgresql://vax_runtime:synthetic@ep-other-pooler.region.neon.tech/neondb?sslmode=verify-full",
      },
      {
        DATABASE_URL:
          "postgresql://vax_runtime:synthetic@ep-staging-pooler.region.neon.tech/other?sslmode=verify-full",
      },
      {
        DATABASE_URL:
          "postgresql://vax_runtime:synthetic@ep-staging-pooler.region.neon.tech/neondb?sslmode=require",
      },
      { NEON_AUTH_BASE_URL: "https://auth.other.example.invalid" },
      { DATABASE_MUTATION_EXPECTED_BRANCH_ID: "branch-other" },
    ]) {
      expect(() =>
        assertStagingRuntimeTargets(
          { ...environment, ...unsafe },
          authorization,
        ),
      ).toThrow();
    }
  });
});
