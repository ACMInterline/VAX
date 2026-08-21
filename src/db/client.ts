import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { getDatabaseUrl } from "@/lib/environment";
import * as schema from "./schema";

function createDatabase(databaseUrl: string) {
  const client = neon(databaseUrl);

  return drizzle({ client, schema });
}

export type Database = ReturnType<typeof createDatabase>;

let database: Database | undefined;

export function getDatabase(): Database {
  database ??= createDatabase(getDatabaseUrl());

  return database;
}
