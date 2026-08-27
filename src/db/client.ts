import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { getDatabaseUrl } from "@/lib/environment";
import * as schema from "./schema";

export function createDatabaseConnection(databaseUrl: string) {
  const client = neon(databaseUrl);

  return drizzle({ client, schema });
}

export type Database = ReturnType<typeof createDatabaseConnection>;

let database: Database | undefined;

export function getDatabase(): Database {
  database ??= createDatabaseConnection(getDatabaseUrl());

  return database;
}
