import { describe, expect, it } from "vitest";
import {
  InMemoryAuthRateLimiter,
  ProductionRateLimiterRequired,
  createRuntimeAuthRateLimiter,
} from "./rate-limit";

describe("authentication rate-limit boundary", () => {
  it("limits repeated local login attempts and resets after the window", async () => {
    let now = 1_000;
    const limiter = new InMemoryAuthRateLimiter({ now: () => now });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(limiter.consume("LOGIN", "opaque-key")).resolves.toEqual({
        allowed: true,
      });
    }
    await expect(limiter.consume("LOGIN", "opaque-key")).resolves.toMatchObject({
      allowed: false,
    });
    now += 15 * 60 * 1_000;
    await expect(limiter.consume("LOGIN", "opaque-key")).resolves.toEqual({
      allowed: true,
    });
  });

  it("fails closed in production until a shared deployment adapter is selected", async () => {
    const limiter = createRuntimeAuthRateLimiter({ NODE_ENV: "production" });
    expect(limiter).toBeInstanceOf(ProductionRateLimiterRequired);
    await expect(limiter.consume("SIGNUP", "opaque-key")).resolves.toMatchObject({
      allowed: false,
    });
  });
});
