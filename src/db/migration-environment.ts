import { loadEnvConfig } from "@next/env";

export function loadMigrationEnvironment(
  projectDirectory: string = process.cwd(),
): void {
  loadEnvConfig(projectDirectory);
}
