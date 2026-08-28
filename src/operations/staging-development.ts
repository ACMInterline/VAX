import { getAuthRuntimeConfiguration } from "@/auth/config";
import { assertNonProductionDatabaseMutationTarget } from "@/db/migration-environment";
import {
  assertStagingAuthenticationTarget,
  type StagingTargetAuthorization,
} from "@/db/staging-environment";

export function assertStagingRuntimeTargets(
  environment: Readonly<Record<string, string | undefined>>,
  authorization: StagingTargetAuthorization,
): void {
  assertNonProductionDatabaseMutationTarget(
    environment,
    "runtime",
    authorization,
  );
  assertStagingAuthenticationTarget(
    authorization,
    getAuthRuntimeConfiguration(environment).baseUrl,
  );
}
