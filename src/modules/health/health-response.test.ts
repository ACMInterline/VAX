import { describe, expect, it } from "vitest";
import { createHealthResponse } from "./health-response";

describe("createHealthResponse", () => {
  it("returns the public healthy contract when PostgreSQL is reachable", async () => {
    const response = await createHealthResponse(async () => "connected");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      database: "connected",
    });
  });

  it("returns a sanitized degraded contract when PostgreSQL is unavailable", async () => {
    const response = await createHealthResponse(async () => "unavailable");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: "degraded",
      database: "unavailable",
    });
  });

  it("returns the safe degraded contract when DATABASE_URL is missing", async () => {
    const configuredDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      const response = await createHealthResponse();

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        status: "degraded",
        database: "unavailable",
      });
    } finally {
      if (configuredDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = configuredDatabaseUrl;
      }
    }
  });
});
