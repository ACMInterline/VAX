import { getAuthRuntimeConfiguration } from "@/auth/config";
import { bootstrapOwnerOperation } from "./bootstrap-owner-operation";
import { getDatabase } from "./client";
import {
  assertNonProductionDatabaseIdentity,
  assertNonProductionDatabaseMutationTarget,
} from "./migration-environment";
import {
  assertStagingAuthenticationTarget,
  loadStagingEnvironment,
  loadStagingTargetAuthorization,
} from "./staging-environment";

async function bootstrapStagingOwner(): Promise<"assigned" | "already-owner"> {
  await loadStagingEnvironment();
  const stagingAuthorization = await loadStagingTargetAuthorization();
  assertNonProductionDatabaseMutationTarget(
    process.env,
    "runtime",
    stagingAuthorization,
  );
  assertStagingAuthenticationTarget(
    stagingAuthorization,
    getAuthRuntimeConfiguration(process.env).baseUrl,
  );

  const database = getDatabase();
  await assertNonProductionDatabaseIdentity(
    database,
    "runtime",
    process.env,
    stagingAuthorization,
  );
  return bootstrapOwnerOperation(
    database,
    process.env.AUTH_BOOTSTRAP_PROVIDER_USER_ID,
  );
}

bootstrapStagingOwner()
  .then((result) => {
    process.stdout.write(
      result === "assigned"
        ? "Initial staging application owner assigned.\n"
        : "The selected staging application profile is already an owner.\n",
    );
  })
  .catch(() => {
    process.stderr.write("Staging owner bootstrap failed safely.\n");
    process.exitCode = 1;
  });
