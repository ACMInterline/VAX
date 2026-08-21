import path from "node:path";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { getDatabase } from "./client";
import { loadMigrationEnvironment } from "./migration-environment";

loadMigrationEnvironment();

async function runMigrations(): Promise<void> {
  await migrate(getDatabase(), {
    migrationsFolder: path.resolve(process.cwd(), "drizzle"),
  });
}

runMigrations()
  .then(() => {
    process.stdout.write("Database migrations completed.\n");
  })
  .catch(() => {
    process.stderr.write("Database migration failed.\n");
    process.exitCode = 1;
  });
