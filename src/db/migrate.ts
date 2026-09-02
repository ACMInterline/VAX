import path from "node:path";
import { getMigrationDatabaseUrl } from "@/lib/environment";
import { runAtomicMigrations } from "./atomic-migration";
import { createDatabaseConnection } from "./client";
import {
  assertDevelopmentDatabaseIdentity,
  assertDevelopmentDatabaseMutationTarget,
  loadMigrationEnvironment,
} from "./migration-environment";
import { seedAvailabilityEngine } from "./seed-availability-engine";
import { seedCommercialEngine } from "./seed-commercial-engine";
import { seedIdentityAccess } from "./seed-identity-access";
import { seedCommunicationsDocuments } from "./seed-communications-documents";
import { seedBusinessAuthorityActorContext } from "./seed-business-authority-actor-context";
import { seedCanonicalServiceCatalogue } from "./seed-service-catalogue";

loadMigrationEnvironment();
assertDevelopmentDatabaseMutationTarget(process.env, "migration");

async function runMigrations(): Promise<void> {
  const migrationDatabaseUrl = getMigrationDatabaseUrl();
  const database = createDatabaseConnection(migrationDatabaseUrl);

  await assertDevelopmentDatabaseIdentity(database, "migration");

  await runAtomicMigrations(
    migrationDatabaseUrl,
    path.resolve(process.cwd(), "drizzle"),
  );
  await seedBusinessAuthorityActorContext(database);
  await seedCanonicalServiceCatalogue(database);
  await seedCommercialEngine(database);
  await seedAvailabilityEngine(database);
  await seedIdentityAccess(database);
  await seedCommunicationsDocuments(database);
}

runMigrations()
  .then(() => {
    process.stdout.write("Database migrations and canonical seeds completed.\n");
  })
  .catch(() => {
    process.stderr.write("Database migration failed.\n");
    process.exitCode = 1;
  });
