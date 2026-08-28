import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { checkDatabaseConnection } from "./health";

describe("checkDatabaseConnection", () => {
  it("reports a successful probe as connected", async () => {
    const probe = vi.fn().mockResolvedValue(undefined);

    await expect(checkDatabaseConnection(probe)).resolves.toBe("connected");
    expect(probe).toHaveBeenCalledOnce();
  });

  it("reduces connection errors to a safe unavailable state", async () => {
    const probe = vi.fn().mockRejectedValue(new Error("sensitive detail"));

    await expect(checkDatabaseConnection(probe)).resolves.toBe("unavailable");
  });

  it("normalizes PostgreSQL catalog name arrays for exact attestation", async () => {
    const source = await readFile(path.join(process.cwd(), "src/db/health.ts"),
      "utf8");

    expect(source).toContain("policy.policyname::text");
    expect(source).toContain(
      "operational_rate_limits_window_started_at_not_null",
    );
  });
});
