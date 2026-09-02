import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  businessAuthorityActorContextMetadataKey,
  deriveBusinessAuthorityActorContextKey,
} from "@/modules/business-authority/actor-context";
import { businessAuthorityActorContextSeedSql } from "./seed-business-authority-actor-context";

const environment = {
  VAX_ENVIRONMENT: "staging",
  NEON_AUTH_COOKIE_SECRET:
    "synthetic-test-cookie-secret-that-is-never-used-outside-tests",
};

describe("business-authority actor-context seed", () => {
  it("parameterizes only the derived verification key in protected metadata", () => {
    const compiled = new PgDialect().sqlToQuery(
      businessAuthorityActorContextSeedSql(environment),
    );
    const derivedKey = deriveBusinessAuthorityActorContextKey(environment);

    expect(compiled.sql).toContain("insert into public.system_metadata");
    expect(compiled.sql).toContain("jsonb_build_object('derivedKeyHex', $2::text)");
    expect(compiled.sql).toContain("on conflict (key) do update");
    expect(compiled.params).toEqual([
      businessAuthorityActorContextMetadataKey,
      derivedKey,
    ]);
    expect(compiled.sql).not.toContain(environment.NEON_AUTH_COOKIE_SECRET);
    expect(compiled.sql).not.toContain(derivedKey);
  });
});
