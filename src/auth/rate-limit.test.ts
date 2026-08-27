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
    await expect(
      limiter.consume("PUBLIC_REQUEST", "anonymous-source"),
    ).resolves.toMatchObject({ allowed: false });
  });

  it("bounds repeated local public requests per opaque source key", async () => {
    const limiter = new InMemoryAuthRateLimiter();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        limiter.consume("PUBLIC_REQUEST", "anonymous-source"),
      ).resolves.toEqual({ allowed: true });
    }
    await expect(
      limiter.consume("PUBLIC_REQUEST", "anonymous-source"),
    ).resolves.toMatchObject({ allowed: false });
  });

  it("bounds booking mutations on their own protected scope", async () => {
    const limiter = new InMemoryAuthRateLimiter();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(
        limiter.consume("BOOKING_MUTATION", "actor-key"),
      ).resolves.toEqual({ allowed: true });
    }
    await expect(
      limiter.consume("BOOKING_MUTATION", "actor-key"),
    ).resolves.toMatchObject({ allowed: false });
  });

  it("bounds field-job mutations independently from booking actions", async () => {
    const limiter = new InMemoryAuthRateLimiter();
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await expect(
        limiter.consume("JOB_MUTATION", "technician-key"),
      ).resolves.toEqual({ allowed: true });
    }
    await expect(
      limiter.consume("JOB_MUTATION", "technician-key"),
    ).resolves.toMatchObject({ allowed: false });
    await expect(
      limiter.consume("BOOKING_MUTATION", "technician-key"),
    ).resolves.toEqual({ allowed: true });
  });

  it("bounds communication materialization on its own protected scope", async () => {
    const limiter = new InMemoryAuthRateLimiter();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await expect(
        limiter.consume("COMMUNICATION_MUTATION", "staff-key"),
      ).resolves.toEqual({ allowed: true });
    }
    await expect(
      limiter.consume("COMMUNICATION_MUTATION", "staff-key"),
    ).resolves.toMatchObject({ allowed: false });
    await expect(
      limiter.consume("FINANCE_MUTATION", "staff-key"),
    ).resolves.toEqual({ allowed: true });
  });
});
