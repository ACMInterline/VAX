import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/auth/neon-provider", () => ({
  checkAuthenticationProviderAvailability: vi.fn(),
}));

import {
  createReadinessResponseFactory,
  createReadinessSnapshot,
} from "./readiness";

const readyDatabase = {
  connected: true,
  runtimeIdentitySafe: true,
  migrationReady: true,
  rateLimitPrivilegesReady: true,
};
const stagingEnvironment = {
  NODE_ENV: "development",
  VAX_ENVIRONMENT: "staging",
  STAGING_ALLOW_LOCALHOST: "true",
  PUBLIC_SITE_URL: "http://127.0.0.1:3000",
  AUTH_TRUSTED_ORIGINS: "http://127.0.0.1:3000",
  NEON_AUTH_BASE_URL: "https://auth.example.invalid",
  NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
  AUTH_REQUIRE_VERIFIED_EMAIL: "true",
  RATE_LIMIT_BACKEND: "database",
  RATE_LIMIT_HASH_SECRET: "y".repeat(32),
  EMAIL_DELIVERY_MODE: "sandbox",
} as const;

describe("operational readiness", () => {
  it("reports ready only when every staging dependency is ready", async () => {
    await expect(
      createReadinessSnapshot({
        environment: stagingEnvironment,
        database: async () => readyDatabase,
        authAvailability: async () => true,
      }),
    ).resolves.toEqual({
      status: "ready",
      checks: {
        database: "READY",
        auth: "READY",
        migrations: "READY",
        rateLimit: "READY",
        email: "READY",
      },
    });
  });

  it("requires an exact recipient allowlist for hosted staging email readiness", async () => {
    const hostedStaging = {
      ...stagingEnvironment,
      NODE_ENV: "production",
      STAGING_ALLOW_LOCALHOST: undefined,
      PUBLIC_SITE_URL: "https://staging.example.invalid",
      AUTH_TRUSTED_ORIGINS: "https://staging.example.invalid",
    };

    await expect(
      createReadinessSnapshot({
        environment: hostedStaging,
        database: async () => readyDatabase,
        authAvailability: async () => true,
      }),
    ).resolves.toMatchObject({
      status: "not_ready",
      checks: { email: "NOT_READY" },
    });

    await expect(
      createReadinessSnapshot({
        environment: {
          ...hostedStaging,
          STAGING_AUTH_EMAIL_ALLOWLIST: "owner+phase3m@example.invalid",
        },
        database: async () => readyDatabase,
        authAvailability: async () => true,
      }),
    ).resolves.toMatchObject({
      status: "ready",
      checks: { email: "READY" },
    });
  });

  it("fails readiness closed during partial dependency outages", async () => {
    const createResponse = createReadinessResponseFactory({
      dependencies: {
        environment: { ...stagingEnvironment, EMAIL_DELIVERY_MODE: "blocked" },
        database: async () => ({
          ...readyDatabase,
          connected: false,
          runtimeIdentitySafe: false,
          migrationReady: false,
          rateLimitPrivilegesReady: false,
        }),
        authAvailability: async () => false,
      },
    });
    const response = await createResponse();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "not_ready",
      checks: {
        database: "NOT_READY",
        auth: "NOT_READY",
        migrations: "NOT_READY",
        rateLimit: "NOT_READY",
        email: "NOT_READY",
      },
    });
  });

  it("never exposes configuration, provider, or database details", async () => {
    const createResponse = createReadinessResponseFactory({
      dependencies: {
        environment: {
          ...stagingEnvironment,
          NEON_AUTH_BASE_URL: "https://sensitive-provider.example.invalid",
        },
        database: async () => readyDatabase,
        authAvailability: async () => false,
      },
    });
    const response = await createResponse();
    const serialized = JSON.stringify(await response.json());

    expect(serialized).not.toContain("sensitive-provider");
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain("NEON_AUTH");
  });

  it("coalesces concurrent probes and rechecks after the short TTL", async () => {
    let now = 1_000;
    const database = vi.fn(async () => readyDatabase);
    const authAvailability = vi.fn(async () => true);
    const createResponse = createReadinessResponseFactory({
      dependencies: {
        environment: stagingEnvironment,
        database,
        authAvailability,
      },
      now: () => now,
      ttlMilliseconds: 5_000,
    });

    const [first, second] = await Promise.all([
      createResponse(),
      createResponse(),
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first).not.toBe(second);
    expect(database).toHaveBeenCalledTimes(1);
    expect(authAvailability).toHaveBeenCalledTimes(1);

    now += 4_999;
    await createResponse();
    expect(database).toHaveBeenCalledTimes(1);

    now += 2;
    await createResponse();
    expect(database).toHaveBeenCalledTimes(2);
    expect(authAvailability).toHaveBeenCalledTimes(2);
  });

  it("coalesces dependency failures into a generic no-store 503", async () => {
    const database = vi.fn().mockRejectedValue(new Error("sensitive detail"));
    const authAvailability = vi.fn(async () => true);
    const createResponse = createReadinessResponseFactory({
      dependencies: {
        environment: stagingEnvironment,
        database,
        authAvailability,
      },
    });

    const [first, second] = await Promise.all([
      createResponse(),
      createResponse(),
    ]);
    expect(database).toHaveBeenCalledTimes(1);
    for (const response of [first, second]) {
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const serialized = JSON.stringify(await response.json());
      expect(serialized).not.toContain("sensitive detail");
      expect(serialized).not.toContain("example.invalid");
    }
  });

  it("does not serve a stale ready snapshot after an expired probe fails", async () => {
    let now = 1_000;
    const database = vi
      .fn()
      .mockResolvedValueOnce(readyDatabase)
      .mockRejectedValueOnce(new Error("sensitive outage"))
      .mockResolvedValueOnce(readyDatabase);
    const createResponse = createReadinessResponseFactory({
      dependencies: {
        environment: stagingEnvironment,
        database,
        authAvailability: async () => true,
      },
      now: () => now,
      ttlMilliseconds: 5_000,
    });

    expect((await createResponse()).status).toBe(200);
    now += 5_001;
    expect((await createResponse()).status).toBe(503);
    expect(database).toHaveBeenCalledTimes(2);

    now += 5_001;
    expect((await createResponse()).status).toBe(200);
    expect(database).toHaveBeenCalledTimes(3);
  });

  it("bounds a hung probe without accumulating unresolved dependency work", async () => {
    let now = 1_000;
    let resolveFirstProbe: ((value: typeof readyDatabase) => void) | undefined;
    const database = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<typeof readyDatabase>((resolve) => {
            resolveFirstProbe = resolve;
          }),
      )
      .mockResolvedValue(readyDatabase);
    const createResponse = createReadinessResponseFactory({
      dependencies: {
        environment: stagingEnvironment,
        database,
        authAvailability: async () => true,
      },
      now: () => now,
      probeTimeoutMilliseconds: 5,
      ttlMilliseconds: 10,
    });

    const timedOut = await createResponse();
    expect(timedOut.status).toBe(503);
    expect(database).toHaveBeenCalledTimes(1);

    now += 11;
    const stillUnavailable = await createResponse();
    expect(stillUnavailable.status).toBe(503);
    expect(database).toHaveBeenCalledTimes(1);

    resolveFirstProbe?.(readyDatabase);
    await new Promise<void>((resolve) => setImmediate(resolve));
    now += 11;
    const recovered = await createResponse();
    expect(recovered.status).toBe(200);
    expect(database).toHaveBeenCalledTimes(2);
  });
});
