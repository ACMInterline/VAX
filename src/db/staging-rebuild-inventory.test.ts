import { copyFile, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { vaxMigrationHashes } from "./database-security-policy";
import { expectedStagingRebuildMigrationHashes } from "./staging-rebuild-inventory";

const folders: string[] = [];

async function migrationFixture(): Promise<string> {
  const folder = await mkdtemp(path.join(tmpdir(), "vax-migration-inventory-test-"));
  folders.push(folder);
  const source = path.resolve("drizzle");
  for (const file of await readdir(source)) {
    if (/^\d{4}_[a-z0-9_]+\.sql$/.test(file)) {
      await copyFile(path.join(source, file), path.join(folder, file));
    }
  }
  return folder;
}

afterEach(async () => {
  await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true })));
});

describe("staging rebuild migration preflight", () => {
  it("accepts the exact current 19-entry migration history without database access", async () => {
    const hashes = await expectedStagingRebuildMigrationHashes();
    expect(hashes).toHaveLength(19);
    expect(hashes).toEqual(vaxMigrationHashes);
    expect(hashes[16]).toBe("b68fd05476b5d32567f2f8838df4943e2a2beaa5db28ae9098b6aeb719ccb244");
    expect(hashes[18]).toBe("ba11ad019442989b45c1b6d2c7cf29df1b803cc1c15d01b2610e442240c00f0a");
  });

  it.each(["missing", "changed", "extra"] as const)(
    "rejects %s migration history",
    async (variation) => {
      const folder = await migrationFixture();
      const last = path.join(folder, "0018_attelier_estimate_amount_compatibility.sql");
      if (variation === "missing") await rm(last);
      if (variation === "changed") await writeFile(last, "-- altered migration\n");
      if (variation === "extra") await writeFile(path.join(folder, "0019_unreviewed.sql"), "select 1;\n");
      await expect(expectedStagingRebuildMigrationHashes(folder)).rejects.toThrow(
        "Staging rebuild migration inventory has diverged.",
      );
    },
  );

  it("runs the read-only inventory preflight before opening a database client", async () => {
    const source = await readFile(path.resolve("src/db/rehearse-staging-rebuild.ts"), "utf8");
    const main = source.slice(source.indexOf("async function main():"));
    const preflight = main.indexOf("await expectedStagingRebuildMigrationHashes()");
    expect(preflight).toBeGreaterThan(0);
    expect(preflight).toBeLessThan(main.indexOf("new Client("));
    expect(preflight).toBeLessThan(main.indexOf("create database"));
  });
});
