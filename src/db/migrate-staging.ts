import path from "node:path";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { getMigrationDatabaseUrl } from "@/lib/environment";
import { createDatabaseConnection } from "./client";
import {
  assertNonProductionDatabaseIdentity,
  assertNonProductionDatabaseMutationTarget,
} from "./migration-environment";
import { seedAvailabilityEngine } from "./seed-availability-engine";
import { seedCommercialEngine } from "./seed-commercial-engine";
import { seedIdentityAccess } from "./seed-identity-access";
import { seedCommunicationsDocuments } from "./seed-communications-documents";
import { seedCanonicalServiceCatalogue } from "./seed-service-catalogue";
import {
  loadStagingEnvironment,
  loadStagingTargetAuthorization,
} from "./staging-environment";

async function runStagingMigrations(): Promise<void> {
  await loadStagingEnvironment();
  const stagingAuthorization = await loadStagingTargetAuthorization();
  if (process.env.DATABASE_MUTATION_ENVIRONMENT !== "staging") {
    throw new Error("Staging migration target is not authorized.");
  }
  assertNonProductionDatabaseMutationTarget(
    process.env,
    "migration",
    stagingAuthorization,
  );
  const database = createDatabaseConnection(getMigrationDatabaseUrl());
  await assertNonProductionDatabaseIdentity(
    database,
    "migration",
    process.env,
    stagingAuthorization,
  );

  await migrate(database, {
    migrationsFolder: path.resolve(process.cwd(), "drizzle"),
  });
  await seedCanonicalServiceCatalogue(database);
  await seedCommercialEngine(database);
  await seedAvailabilityEngine(database);
  await seedIdentityAccess(database);
  await seedCommunicationsDocuments(database);
}

runStagingMigrations()
  .then(() => {
    process.stdout.write("Staging migrations and canonical seeds completed.\n");
  })
  .catch(() => {
    process.stderr.write("Staging migration failed safely.\n");
    process.exitCode = 1;
  });
