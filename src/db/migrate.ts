import path from "node:path";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { getDatabase } from "./client";
import { loadMigrationEnvironment } from "./migration-environment";
import { seedCanonicalServiceCatalogue } from "./seed-service-catalogue";

loadMigrationEnvironment();

async function runMigrations(): Promise<void> {
  const database = getDatabase();

  await migrate(database, {
    migrationsFolder: path.resolve(process.cwd(), "drizzle"),
  });
  await seedCanonicalServiceCatalogue(database);
}

runMigrations()
  .then(() => {
    process.stdout.write("Database migrations and canonical seeds completed.\n");
  })
  .catch(() => {
    process.stderr.write("Database migration failed.\n");
    process.exitCode = 1;
  });
