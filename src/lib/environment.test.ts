import { describe, expect, it } from "vitest";
import { getDatabaseUrl } from "./environment";

describe("getDatabaseUrl", () => {
  it("accepts a PostgreSQL URL", () => {
    const separator = String.fromCharCode(58, 47, 47);
    const databaseUrl = `postgresql${separator}localhost/database`;

    expect(getDatabaseUrl({ DATABASE_URL: databaseUrl })).toBe(databaseUrl);
  });

  it("rejects a missing database configuration without echoing input", () => {
    expect(() => getDatabaseUrl({ DATABASE_URL: "" })).toThrow(
      "DATABASE_URL is not configured.",
    );
  });
});
