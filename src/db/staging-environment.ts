import { constants, type Stats } from "node:fs";
import { open, readFile, rename } from "node:fs/promises";
import path from "node:path";
import { isLiteralLoopbackOrUnspecifiedHostname } from "../lib/url-security";

const stagingEnvironmentKeys = new Set([
  "DATABASE_URL",
  "MIGRATION_DATABASE_URL",
  "DATABASE_ADMIN_URL",
  "VAX_ENVIRONMENT",
  "STAGING_ALLOW_LOCALHOST",
  "PUBLIC_SITE_URL",
  "NEON_AUTH_BASE_URL",
  "NEON_AUTH_COOKIE_SECRET",
  "AUTH_REQUIRE_VERIFIED_EMAIL",
  "AUTH_TRUSTED_ORIGINS",
  "RATE_LIMIT_BACKEND",
  "RATE_LIMIT_HASH_SECRET",
  "VAX_TRUSTED_PROXY_HOPS",
  "EMAIL_DELIVERY_MODE",
  "STAGING_AUTH_EMAIL_ALLOWLIST",
]);

const stagingTargetEnvironmentKeys = [
  "DATABASE_ADMIN_EXPECTED_ROLE",
  "DATABASE_MUTATION_ENVIRONMENT",
  "DATABASE_MUTATION_EXPECTED_PROJECT_ID",
  "DATABASE_MUTATION_EXPECTED_BRANCH_ID",
  "DATABASE_MUTATION_EXPECTED_HOST",
  "DATABASE_MUTATION_EXPECTED_DATABASE",
  "NEON_AUTH_EXPECTED_BASE_URL",
] as const;

type StagingTargetEnvironmentKey =
  (typeof stagingTargetEnvironmentKeys)[number];
type StagingTargetEnvironment = Readonly<
  Record<StagingTargetEnvironmentKey, string>
>;

const stagingTargetAuthorizationBrand = Symbol(
  "vax-staging-target-authorization",
);

export type StagingTargetAuthorization = Readonly<{
  [stagingTargetAuthorizationBrand]: true;
  environment: StagingTargetEnvironment;
}>;

const stagingRuntimeEnvironmentKeys = [
  "DATABASE_URL",
  "VAX_ENVIRONMENT",
  "STAGING_ALLOW_LOCALHOST",
  "PUBLIC_SITE_URL",
  "NEON_AUTH_BASE_URL",
  "NEON_AUTH_COOKIE_SECRET",
  "AUTH_REQUIRE_VERIFIED_EMAIL",
  "AUTH_TRUSTED_ORIGINS",
  "RATE_LIMIT_BACKEND",
  "RATE_LIMIT_HASH_SECRET",
  "VAX_TRUSTED_PROXY_HOPS",
  "EMAIL_DELIVERY_MODE",
  "STAGING_AUTH_EMAIL_ALLOWLIST",
] as const;

const stagingOperatorEnvironmentKeys = [
  "MIGRATION_DATABASE_URL",
  "DATABASE_ADMIN_URL",
  "DATABASE_ADMIN_EXPECTED_ROLE",
  "DATABASE_MUTATION_ENVIRONMENT",
  "DATABASE_MUTATION_EXPECTED_PROJECT_ID",
  "DATABASE_MUTATION_EXPECTED_BRANCH_ID",
  "DATABASE_MUTATION_EXPECTED_HOST",
  "DATABASE_MUTATION_EXPECTED_DATABASE",
  "NEON_AUTH_EXPECTED_BASE_URL",
] as const;

const safeRuntimeAmbientKeys = [
  "CI",
  "FORCE_COLOR",
  "LANG",
  "LC_ALL",
  "NO_COLOR",
  "TEMP",
  "TERM",
  "TMP",
  "TMPDIR",
] as const;

export function parseStagingEnvironmentFile(
  contents: string,
): Readonly<Record<string, string>> {
  const values: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match || !stagingEnvironmentKeys.has(match[1])) {
      throw new Error("Staging environment file is invalid.");
    }
    const key = match[1];
    if (Object.hasOwn(values, key)) {
      throw new Error("Staging environment file is invalid.");
    }
    values[key] = match[2];
  }
  if (values.VAX_ENVIRONMENT !== "staging") {
    throw new Error("Staging environment file is invalid.");
  }
  return values;
}

export function parseStagingTargetEnvironmentFile(
  contents: string,
): StagingTargetEnvironment {
  const permittedKeys = new Set<string>(stagingTargetEnvironmentKeys);
  const values: Partial<Record<StagingTargetEnvironmentKey, string>> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match || !permittedKeys.has(match[1])) {
      throw new Error("Staging target manifest is invalid.");
    }
    const key = match[1] as StagingTargetEnvironmentKey;
    if (Object.hasOwn(values, key) || !match[2].trim()) {
      throw new Error("Staging target manifest is invalid.");
    }
    values[key] = match[2].trim();
  }
  let expectedAuthBaseUrl: string | undefined;
  try {
    const parsed = new URL(values.NEON_AUTH_EXPECTED_BASE_URL ?? "");
    if (
      parsed.protocol !== "https:" ||
      isLiteralLoopbackOrUnspecifiedHostname(parsed.hostname) ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.search !== "" ||
      parsed.hash !== ""
    ) {
      throw new Error("invalid");
    }
    expectedAuthBaseUrl = parsed.toString().replace(/\/$/, "");
  } catch {
    throw new Error("Staging target manifest is invalid.");
  }
  if (
    Object.keys(values).length !== stagingTargetEnvironmentKeys.length ||
    values.DATABASE_MUTATION_ENVIRONMENT !== "staging" ||
    values.DATABASE_MUTATION_EXPECTED_HOST !==
      values.DATABASE_MUTATION_EXPECTED_HOST?.toLowerCase() ||
    /[/:@?#]/.test(values.DATABASE_MUTATION_EXPECTED_HOST ?? "")
  ) {
    throw new Error("Staging target manifest is invalid.");
  }
  values.NEON_AUTH_EXPECTED_BASE_URL = expectedAuthBaseUrl;
  return values as StagingTargetEnvironment;
}

function secureOwnerOnlyFileStatus(
  status: Stats,
): boolean {
  const owner = typeof process.getuid === "function" ? process.getuid() : null;
  return (
    status.isFile() &&
    status.nlink === 1 &&
    (owner === null || status.uid === owner) &&
    (status.mode & 0o077) === 0 &&
    (status.mode & 0o400) !== 0
  );
}

export async function readSecureOwnerOnlyFile(
  filePath: string,
): Promise<string> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(
      filePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    if (!secureOwnerOnlyFileStatus(await handle.stat())) {
      throw new Error("unsafe");
    }
    return await handle.readFile("utf8");
  } catch {
    throw new Error("Owner-only local configuration is unavailable or insecure.");
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function syncParentDirectory(filePath: string): Promise<void> {
  const directory = await open(
    path.dirname(filePath),
    constants.O_RDONLY | constants.O_DIRECTORY,
  );
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}

export async function writeDurableOwnerOnlyFile(
  filePath: string,
  contents: string,
): Promise<void> {
  const handle = await open(
    filePath,
    constants.O_CREAT |
      constants.O_EXCL |
      constants.O_WRONLY |
      constants.O_NOFOLLOW,
    0o600,
  );
  try {
    if (!secureOwnerOnlyFileStatus(await handle.stat())) {
      throw new Error("Owner-only local configuration is unavailable or insecure.");
    }
    await handle.writeFile(contents, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncParentDirectory(filePath);
}

export async function replaceDurableOwnerOnlyFile(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  await rename(sourcePath, destinationPath);
  await syncParentDirectory(destinationPath);
}

export function createStagingRuntimeEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string>> & { readonly NODE_ENV: "development" } {
  const runtimeEnvironment: Record<string, string> = {
    NEXT_TELEMETRY_DISABLED: "1",
    NODE_ENV: "development",
    PATH: [
      path.dirname(process.execPath),
      "/usr/bin",
      "/bin",
      "/usr/sbin",
      "/sbin",
    ].join(path.delimiter),
  };
  for (const key of safeRuntimeAmbientKeys) {
    const value = environment[key];
    if (value !== undefined) runtimeEnvironment[key] = value;
  }
  // Next.js loads .env.development.local/.env.local after process startup.
  // Explicit entries preserve the staging contract and empty operator entries
  // prevent those files from reintroducing privileged database values.
  for (const key of stagingRuntimeEnvironmentKeys) {
    runtimeEnvironment[key] = environment[key] ?? "";
  }
  for (const key of stagingOperatorEnvironmentKeys) {
    runtimeEnvironment[key] = "";
  }
  return runtimeEnvironment as Readonly<Record<string, string>> & {
    readonly NODE_ENV: "development";
  };
}

export async function assertStagingNextEnvironmentFiles(
  projectDirectory: string = process.cwd(),
): Promise<void> {
  const permittedKeys = new Set<string>([
    ...stagingRuntimeEnvironmentKeys,
    ...stagingOperatorEnvironmentKeys,
  ]);
  for (const fileName of [
    ".env.development.local",
    ".env.local",
    ".env.development",
    ".env",
  ]) {
    const contents = await readFile(
      path.resolve(projectDirectory, fileName),
      "utf8",
    ).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = /^([A-Z][A-Z0-9_]*)=/.exec(line);
      if (!match || !permittedKeys.has(match[1])) {
        throw new Error("Local staging environment boundary is unsafe.");
      }
    }
  }
}

export async function loadStagingEnvironment(
  projectDirectory: string = process.cwd(),
): Promise<void> {
  const filePath = path.resolve(projectDirectory, ".env.staging.local");
  const values = parseStagingEnvironmentFile(
    await readSecureOwnerOnlyFile(filePath),
  );
  for (const key of stagingEnvironmentKeys) delete process.env[key];
  for (const key of stagingTargetEnvironmentKeys) delete process.env[key];
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
}

export async function loadStagingTargetAuthorization(
  projectDirectory: string = process.cwd(),
): Promise<StagingTargetAuthorization> {
  const filePath = path.resolve(projectDirectory, ".env.staging.target.local");
  const environment = parseStagingTargetEnvironmentFile(
    await readSecureOwnerOnlyFile(filePath),
  );
  for (const [key, value] of Object.entries(environment)) {
    process.env[key] = value;
  }
  return Object.freeze({
    [stagingTargetAuthorizationBrand]: true as const,
    environment,
  });
}

export function isStagingTargetAuthorized(
  authorization: StagingTargetAuthorization | undefined,
  environment: Readonly<Record<string, string | undefined>>,
): boolean {
  return Boolean(
    authorization?.[stagingTargetAuthorizationBrand] &&
      stagingTargetEnvironmentKeys.every(
        (key) => authorization.environment[key] === environment[key],
      ),
  );
}

export function stagingTargetEnvironment(
  authorization: StagingTargetAuthorization,
): StagingTargetEnvironment {
  if (!isStagingTargetAuthorized(authorization, authorization.environment)) {
    throw new Error("Staging target authorization is invalid.");
  }
  return authorization.environment;
}

export function assertStagingAuthenticationTarget(
  authorization: StagingTargetAuthorization | undefined,
  configuredBaseUrl: string,
): void {
  if (
    !authorization?.[stagingTargetAuthorizationBrand] ||
    configuredBaseUrl !== authorization.environment.NEON_AUTH_EXPECTED_BASE_URL
  ) {
    throw new Error("Staging authentication target is not authorized.");
  }
}
