import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  InMemoryAuthRateLimiter,
  SharedAuthRateLimiter,
  type AuthRateLimiter,
  type SharedRateLimitStore,
} from "./rate-limit";
import {
  deriveOpaqueAccountRateLimitKey,
  deriveOpaqueRateLimitKey,
  deriveOpaqueSourceRateLimitKey,
  evaluateRateLimitAttempt,
  sourceAddressFromHeaders,
} from "./enforce-rate-limit";

const hashSecret = "phase-3l-synthetic-hash-secret-000000000000";

describe("rate-limit enforcement", () => {
  it("derives a stable HMAC without retaining source identifiers", () => {
    const result = deriveOpaqueRateLimitKey(
      "192.0.2.10",
      "Person@Example.invalid",
      hashSecret,
    );

    expect(result).toMatch(/^[0-9a-f]{64}$/);
    expect(result).not.toContain("192.0.2.10");
    expect(result).not.toContain("Person");
    expect(result).toBe(
      deriveOpaqueRateLimitKey(
        "192.0.2.10",
        "person@example.invalid",
        hashSecret,
      ),
    );
    expect(result).not.toBe(
      deriveOpaqueSourceRateLimitKey("192.0.2.10", hashSecret),
    );
    expect(result).not.toBe(
      deriveOpaqueAccountRateLimitKey("person@example.invalid", hashSecret),
    );
    expect(
      deriveOpaqueAccountRateLimitKey("Person@Example.invalid", hashSecret),
    ).toBe(
      deriveOpaqueAccountRateLimitKey("person@example.invalid", hashSecret),
    );
    expect(
      deriveOpaqueSourceRateLimitKey("2001:0db8:0:0:0:0:0:1", hashSecret),
    ).toBe(deriveOpaqueSourceRateLimitKey("2001:db8::1", hashSecret));
  });

  it("ignores forwarding headers unless an exact proxy hop count is trusted", () => {
    const requestHeaders = new Headers({ "x-forwarded-for": "192.0.2.10" });

    expect(sourceAddressFromHeaders(requestHeaders, 0)).toBe("untrusted-proxy");
    expect(sourceAddressFromHeaders(requestHeaders, 1)).toBe("192.0.2.10");
  });

  it("fails closed for incomplete or malformed trusted proxy chains", () => {
    expect(
      sourceAddressFromHeaders(
        new Headers({ "x-forwarded-for": "192.0.2.10" }),
        2,
      ),
    ).toBe("unknown");
    expect(
      sourceAddressFromHeaders(
        new Headers({
          "x-forwarded-for": "192.0.2.10, attacker-controlled-value",
        }),
        1,
      ),
    ).toBe("unknown");
  });

  it("selects the verified suffix boundary instead of a client prefix", () => {
    expect(
      sourceAddressFromHeaders(
        new Headers({
          "x-forwarded-for": "192.0.2.10, 198.51.100.20, 203.0.113.30",
        }),
        2,
      ),
    ).toBe("198.51.100.20");
    expect(
      sourceAddressFromHeaders(
        new Headers({
          "x-forwarded-for": "192.0.2.10, 198.51.100.20",
        }),
        1,
      ),
    ).toBe("198.51.100.20");
  });

  it("passes only an opaque key to the selected limiter", async () => {
    const consume = vi.fn().mockResolvedValue({ allowed: true });
    const limiter = { consume } satisfies AuthRateLimiter;

    await expect(
      evaluateRateLimitAttempt(
        {
          scope: "LOGIN",
          accountKey: "person@example.invalid",
          requestHeaders: new Headers({ "x-forwarded-for": "192.0.2.10" }),
          trustedProxyHops: 1,
          hashSecret,
        },
        { limiter },
      ),
    ).resolves.toBe(true);
    expect(consume).toHaveBeenNthCalledWith(
      1,
      "LOGIN",
      expect.stringMatching(/^[0-9a-f]{64}$/),
      "SOURCE",
    );
    expect(consume).toHaveBeenNthCalledWith(
      2,
      "LOGIN",
      expect.stringMatching(/^[0-9a-f]{64}$/),
      "ACCOUNT",
    );
    expect(consume).toHaveBeenNthCalledWith(
      3,
      "LOGIN",
      expect.stringMatching(/^[0-9a-f]{64}$/),
      "SOURCE_ACCOUNT",
    );
    expect(new Set(consume.mock.calls.map((call) => call[1])).size).toBe(3);
    expect(JSON.stringify(consume.mock.calls)).not.toContain(
      "person@example.invalid",
    );
  });

  it("bounds one source even when it rotates account identifiers", async () => {
    const limiter = new InMemoryAuthRateLimiter();
    const requestHeaders = new Headers({
      "x-forwarded-for": "192.0.2.10",
    });

    for (let attempt = 0; attempt < 25; attempt += 1) {
      await expect(
        evaluateRateLimitAttempt(
          {
            scope: "LOGIN",
            accountKey: `person-${attempt}@example.invalid`,
            requestHeaders,
            trustedProxyHops: 1,
            hashSecret,
          },
          { limiter },
        ),
      ).resolves.toBe(true);
    }
    await expect(
      evaluateRateLimitAttempt(
        {
          scope: "LOGIN",
          accountKey: "another-person@example.invalid",
          requestHeaders,
          trustedProxyHops: 1,
          hashSecret,
        },
        { limiter },
      ),
    ).resolves.toBe(false);
  });

  it("does not create a global source bucket without a trusted proxy", async () => {
    const limiter = new InMemoryAuthRateLimiter();

    for (let attempt = 0; attempt < 25; attempt += 1) {
      await expect(
        evaluateRateLimitAttempt(
          {
            scope: "LOGIN",
            accountKey: `person-${attempt}@example.invalid`,
            requestHeaders: new Headers(),
            trustedProxyHops: 0,
            hashSecret,
          },
          { limiter },
        ),
      ).resolves.toBe(true);
    }
    await expect(
      evaluateRateLimitAttempt(
        {
          scope: "LOGIN",
          accountKey: "unrelated@example.invalid",
          requestHeaders: new Headers(),
          trustedProxyHops: 0,
          hashSecret,
        },
        { limiter },
      ),
    ).resolves.toBe(true);
  });

  it("fails a malformed trusted source without consuming a global bucket", async () => {
    const consume = vi.fn();
    await expect(
      evaluateRateLimitAttempt(
        {
          scope: "LOGIN",
          accountKey: "person@example.invalid",
          requestHeaders: new Headers({
            "x-forwarded-for": "attacker-controlled-value",
          }),
          trustedProxyHops: 1,
          hashSecret,
        },
        { limiter: { consume } },
      ),
    ).resolves.toBe(false);
    expect(consume).not.toHaveBeenCalled();
  });

  it("shares the source budget across logical application instances", async () => {
    const attempts = new Map<string, number>();
    const store: SharedRateLimitStore = {
      consumeWindow: async ({ keyHash }) => {
        const attemptCount = (attempts.get(keyHash) ?? 0) + 1;
        attempts.set(keyHash, attemptCount);
        return {
          attemptCount,
          resetsAt: new Date(Date.now() + 60_000),
        };
      },
    };
    const limiters = [
      new SharedAuthRateLimiter(store),
      new SharedAuthRateLimiter(store),
    ];
    const requestHeaders = new Headers({
      "x-forwarded-for": "2001:db8::1",
    });

    for (let attempt = 0; attempt < 25; attempt += 1) {
      await expect(
        evaluateRateLimitAttempt(
          {
            scope: "LOGIN",
            accountKey: `person-${attempt}@example.invalid`,
            requestHeaders,
            trustedProxyHops: 1,
            hashSecret,
          },
          { limiter: limiters[attempt % 2]! },
        ),
      ).resolves.toBe(true);
    }
    await expect(
      evaluateRateLimitAttempt(
        {
          scope: "LOGIN",
          accountKey: "another-person@example.invalid",
          requestHeaders,
          trustedProxyHops: 1,
          hashSecret,
        },
        { limiter: limiters[1]! },
      ),
    ).resolves.toBe(false);
  });

  it("retains the tighter per-account budget", async () => {
    const limiter = new InMemoryAuthRateLimiter();
    const input = {
      scope: "LOGIN" as const,
      accountKey: "person@example.invalid",
      requestHeaders: new Headers({ "x-forwarded-for": "192.0.2.10" }),
      trustedProxyHops: 1,
      hashSecret,
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        evaluateRateLimitAttempt(input, { limiter }),
      ).resolves.toBe(true);
    }
    await expect(
      evaluateRateLimitAttempt(input, { limiter }),
    ).resolves.toBe(false);
  });

  it("shares one account budget across distinct source addresses", async () => {
    const limiter = new InMemoryAuthRateLimiter();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        evaluateRateLimitAttempt(
          {
            scope: "LOGIN",
            accountKey: "person@example.invalid",
            requestHeaders: new Headers({
              "x-forwarded-for": `192.0.2.${attempt + 1}`,
            }),
            trustedProxyHops: 1,
            hashSecret,
          },
          { limiter },
        ),
      ).resolves.toBe(true);
    }
    await expect(
      evaluateRateLimitAttempt(
        {
          scope: "LOGIN",
          accountKey: "person@example.invalid",
          requestHeaders: new Headers({ "x-forwarded-for": "192.0.2.99" }),
          trustedProxyHops: 1,
          hashSecret,
        },
        { limiter },
      ),
    ).resolves.toBe(false);
    await expect(
      evaluateRateLimitAttempt(
        {
          scope: "LOGIN",
          accountKey: "other@example.invalid",
          requestHeaders: new Headers({ "x-forwarded-for": "192.0.2.99" }),
          trustedProxyHops: 1,
          hashSecret,
        },
        { limiter },
      ),
    ).resolves.toBe(true);
  });

  it("does not create one global account bucket for public requests", async () => {
    const consume = vi.fn().mockResolvedValue({ allowed: true });
    await expect(
      evaluateRateLimitAttempt(
        {
          scope: "PUBLIC_REQUEST",
          accountKey: "anonymous-request",
          requestHeaders: new Headers({ "x-forwarded-for": "192.0.2.10" }),
          trustedProxyHops: 1,
          hashSecret,
        },
        { limiter: { consume } },
      ),
    ).resolves.toBe(true);
    expect(consume.mock.calls.map((call) => call[2])).toEqual([
      "SOURCE",
      "SOURCE_ACCOUNT",
    ]);
  });

  it("does not consume an account bucket after the source is denied", async () => {
    const consume = vi
      .fn()
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 60 });

    await expect(
      evaluateRateLimitAttempt(
        {
          scope: "LOGIN",
          accountKey: "person@example.invalid",
          requestHeaders: new Headers({ "x-forwarded-for": "192.0.2.10" }),
          trustedProxyHops: 1,
          hashSecret,
        },
        { limiter: { consume } },
      ),
    ).resolves.toBe(false);
    expect(consume).toHaveBeenCalledTimes(1);
  });

  it("does not consume a source-account bucket after the account is denied", async () => {
    const consume = vi
      .fn()
      .mockResolvedValueOnce({ allowed: true })
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 60 });

    await expect(
      evaluateRateLimitAttempt(
        {
          scope: "LOGIN",
          accountKey: "person@example.invalid",
          requestHeaders: new Headers({ "x-forwarded-for": "192.0.2.10" }),
          trustedProxyHops: 1,
          hashSecret,
        },
        { limiter: { consume } },
      ),
    ).resolves.toBe(false);
    expect(consume.mock.calls.map((call) => call[2])).toEqual([
      "SOURCE",
      "ACCOUNT",
    ]);
  });

  it("fails closed if the account bucket backend fails", async () => {
    const reporter = { capture: vi.fn().mockResolvedValue(undefined) };
    const consume = vi
      .fn()
      .mockResolvedValueOnce({ allowed: true })
      .mockRejectedValueOnce(new Error("sensitive backend detail"));

    await expect(
      evaluateRateLimitAttempt(
        {
          scope: "LOGIN",
          accountKey: "person@example.invalid",
          requestHeaders: new Headers({ "x-forwarded-for": "192.0.2.10" }),
          trustedProxyHops: 1,
          hashSecret,
        },
        { limiter: { consume }, reporter },
      ),
    ).resolves.toBe(false);
    expect(reporter.capture).toHaveBeenCalledWith({
      eventCode: "RATE_LIMIT_BACKEND_FAILURE",
      status: "ERROR",
      route: "/auth",
      errorClass: "DEPENDENCY_UNAVAILABLE",
    });
  });

  it("fails closed and reports a sanitized event when the backend fails", async () => {
    const reporter = { capture: vi.fn().mockResolvedValue(undefined) };
    const limiter: AuthRateLimiter = {
      consume: vi.fn().mockRejectedValue(new Error("secret backend detail")),
    };

    await expect(
      evaluateRateLimitAttempt(
        {
          scope: "PASSWORD_RESET",
          accountKey: "sensitive-reset-token",
          requestHeaders: new Headers(),
          trustedProxyHops: 0,
          hashSecret,
        },
        { limiter, reporter },
      ),
    ).resolves.toBe(false);
    expect(reporter.capture).toHaveBeenCalledWith({
      eventCode: "RATE_LIMIT_BACKEND_FAILURE",
      status: "ERROR",
      route: "/auth",
      errorClass: "DEPENDENCY_UNAVAILABLE",
    });
    expect(JSON.stringify(reporter.capture.mock.calls)).not.toContain(
      "sensitive-reset-token",
    );
  });
});
