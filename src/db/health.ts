import { sql } from "drizzle-orm";
import { getDatabase } from "./client";

export type DatabaseHealth = "connected" | "unavailable";
export type DatabaseProbe = () => Promise<void>;

async function executeConnectivityProbe(): Promise<void> {
  await getDatabase().execute(sql`select 1`);
}

export async function checkDatabaseConnection(
  probe: DatabaseProbe = executeConnectivityProbe,
): Promise<DatabaseHealth> {
  try {
    await probe();
    return "connected";
  } catch {
    return "unavailable";
  }
}
