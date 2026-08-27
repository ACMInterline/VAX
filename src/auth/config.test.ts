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

  it("keeps email verification mandatory when production explicitly supplies false", () => {
    expect(
      getAuthRuntimeConfiguration({
        NEON_AUTH_BASE_URL: "https://auth.example.invalid",
        NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
        AUTH_REQUIRE_VERIFIED_EMAIL: "false",
        NODE_ENV: "production",
      }).requireVerifiedEmail,
    ).toBe(true);
  });

  it("allows an explicit development verification override", () => {
    expect(
      getAuthRuntimeConfiguration({
        NEON_AUTH_BASE_URL: "https://auth.example.invalid",
        NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
        AUTH_REQUIRE_VERIFIED_EMAIL: "true",
        NODE_ENV: "development",
      }).requireVerifiedEmail,
    ).toBe(true);
  });

  it("allows loopback HTTP only outside production", () => {
    expect(
      getAuthRuntimeConfiguration({
        NEON_AUTH_BASE_URL: "http://127.0.0.1:3001/auth",
        NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
        NODE_ENV: "development",
      }).baseUrl,
    ).toBe("http://127.0.0.1:3001/auth");

    expect(() =>
      getAuthRuntimeConfiguration({
        NEON_AUTH_BASE_URL: "http://127.0.0.1:3001/auth",
        NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
        NODE_ENV: "production",
      }),
    ).toThrowError("Authentication service is not configured.");
  });

  it.each([
    ["https://operator:password@auth.example.invalid/path", "operator"],
    ["https://auth.example.invalid/path?token=not-allowed", "not-allowed"],
    ["https://auth.example.invalid/path#not-allowed", "not-allowed"],
    ["https://auth.example.invalid/path?", "path?"],
    ["https://auth.example.invalid/path#", "path#"],
    ["https://auth.example.invalid/path?#", "path?#"],
  ])("rejects unsafe provider URL components without echoing them", (supplied, sentinel) => {
    expect(() =>
      getAuthRuntimeConfiguration({
        NEON_AUTH_BASE_URL: supplied,
        NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
        NODE_ENV: "production",
      }),
    ).toThrowError("Authentication service is not configured.");

    try {
      getAuthRuntimeConfiguration({
        NEON_AUTH_BASE_URL: supplied,
        NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
        NODE_ENV: "production",
      });
    } catch (error) {
      expect(String(error)).not.toContain(supplied);
      expect(String(error)).not.toContain(sentinel);
    }
  });

  it.each([
    "https://localhost/auth",
    "https://auth.localhost/auth",
    "https://127.0.0.1/auth",
    "https://0.0.0.0/auth",
    "https://[::]/auth",
    "https://[::1]/auth",
    "https://[::127.0.0.1]/auth",
    "https://[::ffff:127.0.0.1]/auth",
    "https://[::ffff:0.0.0.0]/auth",
  ])("rejects a production loopback provider endpoint", (baseUrl) => {
    expect(() =>
      getAuthRuntimeConfiguration({
        NEON_AUTH_BASE_URL: baseUrl,
        NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
        NODE_ENV: "production",
      }),
    ).toThrowError("Authentication service is not configured.");
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
