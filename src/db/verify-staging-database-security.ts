import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  loadStagingEnvironment,
  loadStagingTargetAuthorization,
} from "./staging-environment";

async function main(): Promise<void> {
  await loadStagingEnvironment();
  await loadStagingTargetAuthorization();

  const result = spawnSync(
    process.execPath,
    [
      path.resolve(process.cwd(), "node_modules/vitest/vitest.mjs"),
      "run",
      "src/db/database-security-policy.test.ts",
      "src/db/database-security-postgres.integration.test.ts",
      "src/db/shared-rate-limit-postgres.integration.test.ts",
    ],
    {
      env: {
        ...process.env,
        RUN_PHASE3K_DATABASE_SECURITY_INTEGRATION: "1",
        RUN_PHASE3L_RATE_LIMIT_INTEGRATION: "1",
      },
      stdio: "inherit",
    },
  );

  if (result.error || result.status === null) {
    throw new Error("Staging security verification process failed.");
  }
  process.exitCode = result.status;
}

main().catch(() => {
  process.stderr.write("Staging database security verification failed safely.\n");
  process.exitCode = 1;
});
