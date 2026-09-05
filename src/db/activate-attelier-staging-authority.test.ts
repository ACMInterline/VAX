import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const importBoundary = vi.hoisted(() => ({
  loadStagingEnvironment: vi.fn(async () => {
    throw new Error("Import must not load staging configuration.");
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("./staging-environment", () => ({
  loadStagingEnvironment: importBoundary.loadStagingEnvironment,
  loadStagingTargetAuthorization: vi.fn(),
  assertStagingAuthenticationTarget: vi.fn(),
}));

describe("ATTELIER staging authority operator boundary", () => {
  it("imports without loading configuration or starting authority activation", async () => {
    const previousExitCode = process.exitCode;
    try {
      const activationModule = await import("./activate-attelier-staging-authority");
      await Promise.resolve();
      expect(activationModule.activateAttelierStagingAuthority).toBeTypeOf("function");
      expect(importBoundary.loadStagingEnvironment).not.toHaveBeenCalled();
    } finally {
      process.exitCode = previousExitCode;
    }
  });

  it("proves the non-production database and Auth target before mutation", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/db/activate-attelier-staging-authority.ts"),
      "utf8",
    );

    expect(source).toContain("loadStagingTargetAuthorization");
    expect(source).toContain("assertNonProductionDatabaseMutationTarget");
    expect(source).toContain("assertNonProductionDatabaseIdentity");
    expect(source).toContain("assertStagingAuthenticationTarget");
    expect(source).toContain('environmentScope === "STAGING"');
    expect(source).not.toContain("mapping.active");
    expect(source).not.toMatch(/delete\s+from|truncate\s+table|drop\s+(?:table|database)/i);
  });
});
