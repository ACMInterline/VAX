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
});
