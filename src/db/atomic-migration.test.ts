import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  connect: vi.fn(),
  end: vi.fn(),
  migrate: vi.fn(),
  drizzle: vi.fn(() => ({ kind: "node-postgres-database" })),
  client: { kind: "node-postgres-client" },
}));

vi.mock("pg", () => ({
  Client: vi.fn(function MockClient() {
    return doubles.client;
  }),
}));
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: doubles.drizzle }));
vi.mock("drizzle-orm/node-postgres/migrator", () => ({
  migrate: doubles.migrate,
}));

import { Client } from "pg";
import {
  runAtomicMigrations,
  safePostgresErrorCode,
} from "./atomic-migration";

beforeEach(() => {
  vi.clearAllMocks();
  doubles.connect.mockReset();
  doubles.end.mockReset();
  doubles.migrate.mockReset();
  Object.assign(doubles.client, {
    connect: doubles.connect,
    end: doubles.end,
  });
  doubles.connect.mockResolvedValue(undefined);
  doubles.end.mockResolvedValue(undefined);
  doubles.migrate.mockResolvedValue(undefined);
});

describe("atomic node-postgres migration runner", () => {
  it("extracts an allowlisted PostgreSQL code through wrapped causes", () => {
    expect(
      safePostgresErrorCode({
        cause: { cause: { code: "42P07", message: "not returned" } },
      }),
    ).toBe("42P07");
    expect(
      safePostgresErrorCode({ code: "unsafe code with detail" }),
    ).toBeNull();
    expect(
      safePostgresErrorCode({
        cause: { cause: { cause: { cause: { cause: { code: "42P07" } } } } },
      }),
    ).toBeNull();
  });

  it("extracts a safe transport code from aggregate connection failures", () => {
    expect(
      safePostgresErrorCode(
        new AggregateError([
          Object.assign(new Error("not returned"), { code: "ETIMEDOUT" }),
          Object.assign(new Error("not returned"), { code: "EHOSTUNREACH" }),
        ]),
      ),
    ).toBe("ETIMEDOUT");
  });

  it("uses one connected node-postgres client and always closes it", async () => {
    await runAtomicMigrations("postgresql://synthetic.invalid/vax", "/migrations");

    expect(Client).toHaveBeenCalledWith({
      connectionString: "postgresql://synthetic.invalid/vax",
    });
    expect(doubles.connect).toHaveBeenCalledOnce();
    expect(doubles.drizzle).toHaveBeenCalledWith(doubles.client);
    expect(doubles.migrate).toHaveBeenCalledWith(
      { kind: "node-postgres-database" },
      { migrationsFolder: "/migrations" },
    );
    expect(doubles.end).toHaveBeenCalledOnce();
  });

  it("retries only a fresh connection after aggregate transport failure", async () => {
    doubles.connect
      .mockRejectedValueOnce(
        new AggregateError([
          Object.assign(new Error("not returned"), { code: "ETIMEDOUT" }),
          Object.assign(new Error("not returned"), { code: "EHOSTUNREACH" }),
        ]),
      )
      .mockResolvedValueOnce(undefined);

    await runAtomicMigrations(
      "postgresql://synthetic.invalid/vax",
      "/migrations",
    );

    expect(Client).toHaveBeenCalledTimes(2);
    expect(doubles.connect).toHaveBeenCalledTimes(2);
    expect(doubles.migrate).toHaveBeenCalledOnce();
    expect(doubles.end).toHaveBeenCalledTimes(2);
  });

  it("does not retry authentication or other non-transport failures", async () => {
    doubles.connect.mockRejectedValueOnce(
      Object.assign(new Error("not returned"), { code: "28P01" }),
    );

    await expect(
      runAtomicMigrations(
        "postgresql://synthetic.invalid/vax",
        "/migrations",
      ),
    ).rejects.toMatchObject({ code: "28P01" });
    expect(Client).toHaveBeenCalledOnce();
    expect(doubles.connect).toHaveBeenCalledOnce();
    expect(doubles.migrate).not.toHaveBeenCalled();
    expect(doubles.end).toHaveBeenCalledOnce();
  });

  it("propagates migration failure after closing the client", async () => {
    doubles.migrate.mockRejectedValueOnce(new Error("synthetic migration failure"));

    await expect(
      runAtomicMigrations("postgresql://synthetic.invalid/vax", "/migrations"),
    ).rejects.toThrow("synthetic migration failure");
    expect(Client).toHaveBeenCalledOnce();
    expect(doubles.connect).toHaveBeenCalledOnce();
    expect(doubles.migrate).toHaveBeenCalledOnce();
    expect(doubles.end).toHaveBeenCalledOnce();
  });

  it("routes every migration and rebuild caller through the atomic runner", async () => {
    for (const fileName of [
      "migrate.ts",
      "migrate-staging.ts",
      "rehearse-staging-rebuild.ts",
    ]) {
      const contents = await readFile(
        path.join(process.cwd(), "src/db", fileName),
        "utf8",
      );
      expect(contents).toContain("runAtomicMigrations(");
      expect(contents).toContain("seedBusinessAuthorityActorContext(");
      expect(contents).not.toContain("neon-http/migrator");
    }
  });
});
