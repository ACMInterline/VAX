import { describe, expect, it } from "vitest";
import { getAuthRuntimeConfiguration } from "./config";

describe("authentication runtime configuration", () => {
  it("accepts a secure provider URL and sufficiently long cookie secret", () => {
    const result = getAuthRuntimeConfiguration({
      NEON_AUTH_BASE_URL: "https://auth.example.invalid/path",
      NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
      NODE_ENV: "development",
    });
    expect(result.baseUrl).toBe("https://auth.example.invalid/path");
    expect(result.requireVerifiedEmail).toBe(false);
  });

  it("requires email verification by default in production", () => {
    expect(
      getAuthRuntimeConfiguration({
        NEON_AUTH_BASE_URL: "https://auth.example.invalid",
        NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
        NODE_ENV: "production",
      }).requireVerifiedEmail,
    ).toBe(true);
  });

  it("rejects unsafe configuration without echoing a supplied value", () => {
    const supplied = "sensitive-but-too-short";
    expect(() =>
      getAuthRuntimeConfiguration({
        NEON_AUTH_BASE_URL: "http://public.example.invalid",
        NEON_AUTH_COOKIE_SECRET: supplied,
      }),
    ).toThrowError("Authentication cookie security is not configured.");
    try {
      getAuthRuntimeConfiguration({
        NEON_AUTH_BASE_URL: "https://auth.example.invalid",
        NEON_AUTH_COOKIE_SECRET: supplied,
      });
    } catch (error) {
      expect(String(error)).not.toContain(supplied);
    }
  });
});
