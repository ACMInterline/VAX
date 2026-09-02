import "server-only";

import { sql, type SQL } from "drizzle-orm";
import type { Database } from "./client";
import {
  businessAuthorityActorContextMetadataKey,
  deriveBusinessAuthorityActorContextKey,
} from "@/modules/business-authority/actor-context";

export function businessAuthorityActorContextSeedSql(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): SQL {
  const derivedKeyHex = deriveBusinessAuthorityActorContextKey(environment);
  return sql`
    insert into public.system_metadata (key, value)
    values (
      ${businessAuthorityActorContextMetadataKey},
      jsonb_build_object('derivedKeyHex', ${derivedKeyHex}::text)
    )
    on conflict (key) do update
      set value = excluded.value,
        updated_at = clock_timestamp()
  `;
}

export async function seedBusinessAuthorityActorContext(
  database: Database,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<void> {
  await database.execute(businessAuthorityActorContextSeedSql(environment));
}
