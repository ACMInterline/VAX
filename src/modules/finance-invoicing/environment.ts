import { getVaxEnvironment } from "@/operations/environment";
import type { FinanceEnvironmentScope } from "./types";

export function getFinanceEnvironmentScope(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): FinanceEnvironmentScope {
  switch (getVaxEnvironment(environment)) {
    case "development":
      return "DEVELOPMENT";
    case "staging":
      return "STAGING";
    case "production":
      return "PRODUCTION";
  }
}
