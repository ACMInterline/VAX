export type VaxEnvironment = "development" | "staging" | "production";

const vaxEnvironments = new Set<VaxEnvironment>([
  "development",
  "staging",
  "production",
]);

export function getVaxEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): VaxEnvironment {
  const configured = environment.VAX_ENVIRONMENT?.trim();

  if (configured) {
    if (!vaxEnvironments.has(configured as VaxEnvironment)) {
      throw new Error("VAX environment is not configured safely.");
    }
    if (environment.NODE_ENV === "production" && configured === "development") {
      throw new Error("VAX environment is not configured safely.");
    }
    return configured as VaxEnvironment;
  }

  if (environment.NODE_ENV === "production") {
    throw new Error("VAX environment is not configured safely.");
  }
  return "development";
}
export function isStagingLocalRehearsal(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    getVaxEnvironment(environment) === "staging" &&
    environment.NODE_ENV !== "production" &&
    environment.STAGING_ALLOW_LOCALHOST === "true"
  );
}

export function isStrictHostedEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const deployment = getVaxEnvironment(environment);
  return deployment === "production" ||
    (deployment === "staging" && !isStagingLocalRehearsal(environment));
}

export function getTrustedProxyHopCount(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const configured = environment.VAX_TRUSTED_PROXY_HOPS?.trim();
  if (!configured) {
    const deployment = getVaxEnvironment(environment);
    if (
      deployment === "production" ||
      (deployment === "staging" && !isStagingLocalRehearsal(environment))
    ) {
      throw new Error("Trusted proxy configuration is invalid.");
    }
    return 0;
  }

  const hops = Number(configured);
  if (!Number.isInteger(hops) || hops < 1 || hops > 5) {
    throw new Error("Trusted proxy configuration is invalid.");
  }
  return hops;
}
