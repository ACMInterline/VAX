import { getDatabase } from "./client";
import {
  assertDevelopmentDatabaseIdentity,
  assertDevelopmentDatabaseMutationTarget,
  loadMigrationEnvironment,
} from "./migration-environment";
import { bootstrapOwnerOperation } from "./bootstrap-owner-operation";

loadMigrationEnvironment();
assertDevelopmentDatabaseMutationTarget();

async function bootstrapOwner(): Promise<"assigned" | "already-owner"> {
  const database = getDatabase();
  await assertDevelopmentDatabaseIdentity(database, "runtime");
  return bootstrapOwnerOperation(
    database,
    process.env.AUTH_BOOTSTRAP_PROVIDER_USER_ID,
  );
}

bootstrapOwner()
  .then((result) => {
    process.stdout.write(
      result === "assigned"
        ? "Initial application owner assigned.\n"
        : "The selected application profile is already an owner.\n",
    );
  })
  .catch(() => {
    process.stderr.write("Owner bootstrap failed safely.\n");
    process.exitCode = 1;
  });
