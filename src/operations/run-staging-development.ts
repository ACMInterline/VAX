import { spawn } from "node:child_process";
import path from "node:path";
import {
  assertStagingNextEnvironmentFiles,
  createStagingRuntimeEnvironment,
  loadStagingEnvironment,
  loadStagingTargetAuthorization,
} from "@/db/staging-environment";
import { isStagingLocalRehearsal } from "./environment";
import { assertStagingRuntimeTargets } from "./staging-development";

async function main(): Promise<void> {
  await loadStagingEnvironment();
  const stagingAuthorization = await loadStagingTargetAuthorization();
  if (!isStagingLocalRehearsal(process.env)) {
    throw new Error("Local staging rehearsal is not authorized.");
  }
  assertStagingRuntimeTargets(process.env, stagingAuthorization);
  await assertStagingNextEnvironmentFiles();

  const child = spawn(
    process.execPath,
    [
      path.resolve(process.cwd(), "node_modules/next/dist/bin/next"),
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3000",
    ],
    { env: createStagingRuntimeEnvironment(process.env), stdio: "inherit" },
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => child.kill(signal));
  }
  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
  process.exitCode = exitCode;
}

main().catch(() => {
  process.stderr.write("Local staging rehearsal failed safely.\n");
  process.exitCode = 1;
});
