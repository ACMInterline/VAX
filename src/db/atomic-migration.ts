import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

type SafeErrorCodeInspection = Readonly<{
  codes: readonly string[];
  complete: boolean;
}>;

const retryableConnectionErrorCodes = new Set([
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ETIMEDOUT",
]);

const connectionRetryDelaysMilliseconds = [0, 250, 1_000] as const;

function inspectSafeErrorCodes(
  error: unknown,
  depth = 0,
): SafeErrorCodeInspection {
  if (!error || typeof error !== "object" || depth > 3) {
    return { codes: [], complete: false };
  }
  if (
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z0-9_]{2,32}$/.test(error.code)
  ) {
    return { codes: [error.code], complete: true };
  }
  if ("cause" in error && error.cause !== undefined) {
    return inspectSafeErrorCodes(error.cause, depth + 1);
  }
  if (
    "errors" in error &&
    Array.isArray(error.errors) &&
    error.errors.length > 0
  ) {
    const nested = error.errors.map((candidate) =>
      inspectSafeErrorCodes(candidate, depth + 1),
    );
    return {
      codes: nested.flatMap((result) => result.codes),
      complete: nested.every((result) => result.complete),
    };
  }
  return { codes: [], complete: false };
}

export function safePostgresErrorCode(
  error: unknown,
): string | null {
  return inspectSafeErrorCodes(error).codes[0] ?? null;
}

function isRetryableConnectionFailure(error: unknown): boolean {
  const inspection = inspectSafeErrorCodes(error);
  return (
    inspection.complete &&
    inspection.codes.length > 0 &&
    inspection.codes.every((code) => retryableConnectionErrorCodes.has(code))
  );
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function connectAtomicMigrationClient(
  connectionString: string,
): Promise<Client> {
  for (
    let attempt = 0;
    attempt < connectionRetryDelaysMilliseconds.length;
    attempt += 1
  ) {
    if (connectionRetryDelaysMilliseconds[attempt] > 0) {
      await wait(connectionRetryDelaysMilliseconds[attempt]);
    }
    const client = new Client({ connectionString });
    try {
      await client.connect();
      return client;
    } catch (error) {
      await client.end().catch(() => undefined);
      if (
        attempt === connectionRetryDelaysMilliseconds.length - 1 ||
        !isRetryableConnectionFailure(error)
      ) {
        throw error;
      }
    }
  }
  throw new Error("Atomic migration connection failed.");
}

export async function runAtomicMigrations(
  connectionString: string,
  migrationsFolder: string,
): Promise<void> {
  const client = await connectAtomicMigrationClient(connectionString);
  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end();
  }
}
