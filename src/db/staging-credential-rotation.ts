export type StagingCredentialRotationArguments = Readonly<{
  localRehearsal: boolean;
}>;

export function configuredStagingPostgresUrl(value: string | undefined): URL {
  try {
    if (!value) throw new Error("missing");
    const parsed = new URL(value);
    const sslModes = [...parsed.searchParams.entries()]
      .filter(([key]) => key.toLowerCase() === "sslmode")
      .map(([, mode]) => mode.trim().toLowerCase());
    if (
      (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") ||
      !parsed.username ||
      !parsed.password ||
      !parsed.hostname ||
      sslModes.length !== 1 ||
      sslModes[0] !== "verify-full" ||
      [...parsed.searchParams.keys()].some(
        (key) =>
          key.toLowerCase() !== "sslmode" &&
          key.toLowerCase() !== "channel_binding",
      )
    ) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new Error("Staging database administrator is not configured.");
  }
}

export function configuredStagingRolePostgresUrl(
  value: string | undefined,
  expectedRole: string,
): URL {
  const parsed = configuredStagingPostgresUrl(value);
  if (decodeURIComponent(parsed.username) !== expectedRole) {
    throw new Error("Previous staging role credential is unavailable.");
  }
  return parsed;
}

export function configuredStagingSecret(value: string | undefined): string {
  const secret = value?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("Existing staging application secret is unavailable.");
  }
  return secret;
}

export function parseStagingCredentialRotationArguments(
  arguments_: readonly string[],
): StagingCredentialRotationArguments {
  if (
    arguments_.length !== 1 ||
    arguments_[0] !== "--local-rehearsal"
  ) {
    throw new Error("Staging credential rotation arguments are invalid.");
  }
  return { localRehearsal: true };
}
