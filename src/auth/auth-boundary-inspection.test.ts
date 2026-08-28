import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("authentication route and schema boundaries", () => {
  it("provides every required Bulgarian and English authentication route", async () => {
    const paths = [
      "login",
      "signup",
      "forgot-password",
      "reset-password",
      "verify-email",
    ];
    for (const route of paths) {
      await expect(
        readFile(path.join(root, "src/app/(public)", route, "page.tsx"), "utf8"),
      ).resolves.toContain("createAuthPageMetadata");
      await expect(
        readFile(path.join(root, "src/app/(public-en)/en", route, "page.tsx"), "utf8"),
      ).resolves.toContain("createAuthPageMetadata");
    }
    const metadataSource = await readFile(
      path.join(root, "src/components/auth/auth-page.tsx"),
      "utf8",
    );
    expect(metadataSource).toContain("index: false");
  });

  it("derives the protected document language from the application profile", async () => {
    const layoutSource = await readFile(
      path.join(root, "src/app/(application)/app/layout.tsx"),
      "utf8",
    );
    expect(layoutSource).toContain("requireApplicationPrincipal");
    expect(layoutSource).toContain("principal.profile.preferredLocale");
    expect(layoutSource).not.toContain('<html lang="bg">');
  });

  it("keeps the generated migration additive and outside provider-managed schemas", async () => {
    const migration = await readFile(
      path.join(root, "drizzle/0004_add_identity_access.sql"),
      "utf8",
    );
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE)\b/i);
    expect(migration).not.toContain("neon_auth");
    expect(migration).not.toMatch(
      /CREATE TABLE "(?:customers|properties|requests|quotes|bookings|payments|invoices)"/,
    );
  });

  it("does not log credentials or provider results", async () => {
    const actionSource = await readFile(
      path.join(root, "src/app/auth-actions.ts"),
      "utf8",
    );
    const providerSource = await readFile(
      path.join(root, "src/auth/neon-provider.ts"),
      "utf8",
    );
    expect(actionSource).not.toMatch(/console\.(?:log|info|warn|error)/);
    expect(providerSource).not.toMatch(/console\.(?:log|info|warn|error)/);
    expect(providerSource).toContain('logLevel: "silent"');
  });

  it("does not expose the managed provider API or token routes", async () => {
    await expect(
      access(path.join(root, "src/app/api/auth/[...path]/route.ts")),
    ).rejects.toThrow();
  });

  it("keeps signup responses uniform and defers application provisioning to login", async () => {
    const actionSource = await readFile(
      path.join(root, "src/app/auth-actions.ts"),
      "utf8",
    );
    const signupSource = actionSource
      .split("export async function signupAction")[1]
      ?.split("export async function forgotPasswordAction")[0];

    expect(signupSource).toBeDefined();
    expect(signupSource).not.toContain("provisionCustomerProfile");
    expect(signupSource).toContain('status: "SUCCESS"');
    expect(signupSource).toContain("signupRequested");
    expect(signupSource).toContain("withVerificationNextStep");
  });

  it("links an unverified login state to the verification flow", async () => {
    const actionSource = await readFile(
      path.join(root, "src/app/auth-actions.ts"),
      "utf8",
    );
    const loginSource = actionSource
      .split("export async function loginAction")[1]
      ?.split("export async function signupAction")[0];

    expect(loginSource).toBeDefined();
    expect(loginSource).toContain("EMAIL_UNVERIFIED");
    expect(loginSource).toContain("withVerificationNextStep");
  });

  it("requires exact environment guards on privileged database scripts", async () => {
    const migrationSource = await readFile(
      path.join(root, "src/db/migrate.ts"),
      "utf8",
    );
    const bootstrapSource = await readFile(
      path.join(root, "src/db/bootstrap-owner.ts"),
      "utf8",
    );
    const stagingBootstrapSource = await readFile(
      path.join(root, "src/db/bootstrap-owner-staging.ts"),
      "utf8",
    );
    expect(migrationSource).toContain(
      'assertDevelopmentDatabaseMutationTarget(process.env, "migration")',
    );
    expect(migrationSource).toContain(
      'assertDevelopmentDatabaseIdentity(database, "migration")',
    );
    expect(bootstrapSource).toContain(
      "assertDevelopmentDatabaseMutationTarget()",
    );
    expect(bootstrapSource).toContain(
      'assertDevelopmentDatabaseIdentity(database, "runtime")',
    );
    expect(stagingBootstrapSource).toContain(
      "loadStagingTargetAuthorization()",
    );
    expect(stagingBootstrapSource).toContain(
      "assertNonProductionDatabaseMutationTarget(",
    );
    expect(stagingBootstrapSource).toContain(
      "assertStagingAuthenticationTarget(",
    );
    expect(stagingBootstrapSource).toContain(
      "getAuthRuntimeConfiguration(process.env).baseUrl",
    );
    expect(stagingBootstrapSource).toContain(
      '"runtime",\n    process.env,\n    stagingAuthorization',
    );
    expect(
      stagingBootstrapSource.indexOf("assertStagingAuthenticationTarget("),
    ).toBeLessThan(
      stagingBootstrapSource.indexOf("const database = getDatabase()"),
    );
  });

  it("retains the development-only internal-lab gate", async () => {
    const internalLayout = await readFile(
      path.join(root, "src/app/internal/layout.tsx"),
      "utf8",
    );
    const developmentGate = await readFile(
      path.join(root, "src/app/internal/development-only.ts"),
      "utf8",
    );
    expect(internalLayout).toContain("requireDevelopmentServer");
    expect(developmentGate).toContain('process.env.NODE_ENV !== "development"');
    expect(developmentGate).toContain("notFound()");
  });
});
