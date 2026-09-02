import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

export function safePostgresErrorCode(
  error: unknown,
  depth = 0,
): string | null {
  if (!error || typeof error !== "object" || depth > 3) return null;
  if (
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z0-9_]{2,32}$/.test(error.code)
  ) {
    return error.code;
  }
  return "cause" in error
    ? safePostgresErrorCode(error.cause, depth + 1)
    : null;
}

export async function runAtomicMigrations(
  connectionString: string,
  migrationsFolder: string,
): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end();
  }
}
