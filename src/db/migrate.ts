import path from "node:path";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { getDatabase } from "./client";
import { loadMigrationEnvironment } from "./migration-environment";
import { seedAvailabilityEngine } from "./seed-availability-engine";
import { seedCommercialEngine } from "./seed-commercial-engine";
import { seedCanonicalServiceCatalogue } from "./seed-service-catalogue";

loadMigrationEnvironment();

async function runMigrations(): Promise<void> {
  const database = getDatabase();

  await migrate(database, {
    migrationsFolder: path.resolve(process.cwd(), "drizzle"),
  });
  await seedCanonicalServiceCatalogue(database);
  await seedCommercialEngine(database);
  await seedAvailabilityEngine(database);
}

runMigrations()
  .then(() => {
    process.stdout.write("Database migrations and canonical seeds completed.\n");
  })
  .catch(() => {
    process.stderr.write("Database migration failed.\n");
    process.exitCode = 1;
  });
