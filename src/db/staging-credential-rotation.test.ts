import { describe, expect, it } from "vitest";
import {
  configuredStagingPostgresUrl,
  configuredStagingRolePostgresUrl,
  configuredStagingSecret,
  parseStagingCredentialRotationArguments,
} from "./staging-credential-rotation";

describe("staging credential rotation target", () => {
  it("requires certificate-verifying TLS for the administrator URL", () => {
    const strict =
      "postgresql://staging_admin:secret@staging.db.invalid/neondb?sslmode=verify-full";

    expect(configuredStagingPostgresUrl(strict).toString()).toBe(strict);
    for (const suffix of [
      "sslmode=disable",
      "sslmode=require",
      "sslmode=verify-full&sslmode=disable",
      "channel_binding=require",
    ]) {
      expect(() =>
        configuredStagingPostgresUrl(
          `postgresql://staging_admin:secret@staging.db.invalid/neondb?${suffix}`,
        ),
      ).toThrow("Staging database administrator is not configured.");
    }
  });

  it("preserves existing application secrets during database rotation", () => {
    const secret = "synthetic-existing-staging-secret-000000000000";

    expect(configuredStagingSecret(secret)).toBe(secret);
    expect(() => configuredStagingSecret("short")).toThrow(
      "Existing staging application secret is unavailable.",
    );
  });

  it("preserves exact pooled and direct role credential URLs", () => {
    const runtime =
      "postgresql://vax_runtime:old-runtime@staging-pooler.db.invalid/neondb?sslmode=verify-full";
    const migrator =
      "postgresql://vax_migrator:old-migrator@staging.db.invalid/neondb?sslmode=verify-full";

    expect(
      configuredStagingRolePostgresUrl(runtime, "vax_runtime").toString(),
    ).toBe(runtime);
    expect(
      configuredStagingRolePostgresUrl(migrator, "vax_migrator").toString(),
    ).toBe(migrator);
    expect(() =>
      configuredStagingRolePostgresUrl(runtime, "vax_migrator"),
    ).toThrow("Previous staging role credential is unavailable.");
  });

  it("accepts only the explicit local rehearsal acknowledgement", () => {
    expect(
      parseStagingCredentialRotationArguments(["--local-rehearsal"]),
    ).toEqual({ localRehearsal: true });
  });

  it("rejects missing or per-run target overrides", () => {
    for (const arguments_ of [
      [],
      ["--project-id", "project", "--local-rehearsal"],
      ["--local-rehearsal", "--host", "staging.db.invalid"],
    ]) {
      expect(() => parseStagingCredentialRotationArguments(arguments_)).toThrow(
        "Staging credential rotation arguments are invalid.",
      );
    }
  });
});
