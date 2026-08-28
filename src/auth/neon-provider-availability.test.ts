import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  createNeonAuth: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@neondatabase/auth/next/server", () => ({
  createNeonAuth: authMocks.createNeonAuth,
}));

describe("Neon Auth availability boundary", () => {
  const previousEnvironment: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const key of [
      "VAX_ENVIRONMENT",
      "NEON_AUTH_BASE_URL",
      "NEON_AUTH_COOKIE_SECRET",
    ]) {
      previousEnvironment[key] = process.env[key];
    }
    Object.assign(process.env, {
      VAX_ENVIRONMENT: "development",
      NEON_AUTH_BASE_URL: "https://auth.example.invalid",
      NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
    });
    authMocks.createNeonAuth.mockReturnValue({
      getSession: authMocks.getSession,
    });
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("forces a live provider read only for the availability probe", async () => {
    authMocks.getSession.mockResolvedValue({ data: null, error: null });
    const {
      checkAuthenticationProviderAvailability,
      getAuthenticationProvider,
    } = await import("./neon-provider");

    await expect(checkAuthenticationProviderAvailability()).resolves.toBe(true);
    expect(authMocks.getSession).toHaveBeenLastCalledWith({
      query: { disableCookieCache: "true" },
    });

    authMocks.getSession.mockClear();
    await expect(getAuthenticationProvider().getSession()).resolves.toBeNull();
    expect(authMocks.getSession).toHaveBeenCalledWith();
  });

  it("fails availability closed for provider errors and exceptions", async () => {
    const { checkAuthenticationProviderAvailability } = await import(
      "./neon-provider"
    );
    authMocks.getSession.mockResolvedValueOnce({
      data: null,
      error: { status: 503 },
    });
    await expect(checkAuthenticationProviderAvailability()).resolves.toBe(false);
    authMocks.getSession.mockRejectedValueOnce(new Error("sensitive detail"));
    await expect(checkAuthenticationProviderAvailability()).resolves.toBe(false);
  });
});
