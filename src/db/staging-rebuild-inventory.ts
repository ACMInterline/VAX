import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { vaxMigrationHashes } from "./database-security-policy";

/** Read-only preflight: reject migration drift before provisioning a rehearsal. */
export async function expectedStagingRebuildMigrationHashes(
  migrationsDirectory = path.resolve(process.cwd(), "drizzle"),
): Promise<readonly string[]> {
  const files = (await readdir(migrationsDirectory))
    .filter((file) => /^\d{4}_[a-z0-9_]+\.sql$/.test(file))
    .sort();
  const hashes = await Promise.all(
    files.map(async (file) =>
      createHash("sha256")
        .update(await readFile(path.join(migrationsDirectory, file)))
        .digest("hex"),
    ),
  );
  if (
    hashes.length !== vaxMigrationHashes.length ||
    hashes.some((hash, index) => hash !== vaxMigrationHashes[index])
  ) {
    throw new Error("Staging rebuild migration inventory has diverged.");
  }
  return hashes;
}
