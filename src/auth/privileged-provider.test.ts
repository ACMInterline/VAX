import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { toPrivilegedAuthUserSummary } from "./neon-privileged-projection";
import {
  PrivilegedAuthenticationProviderError,
  validatePrivilegedAuthUserListRequest,
} from "./privileged-provider";

const authMocks = vi.hoisted(() => ({
  createNeonAuth: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@neondatabase/auth/next/server", () => authMocks);

describe("privileged authentication provider boundary", () => {
  it("normalizes pagination and optional email search", () => {
    expect(
      validatePrivilegedAuthUserListRequest({
        limit: 25,
        offset: 50,
        searchEmail: "  synthetic@example.invalid  ",
      }),
    ).toEqual({
      limit: 25,
      offset: 50,
      searchEmail: "synthetic@example.invalid",
    });
  });

  it.each([
    { limit: 0, offset: 0 },
    { limit: 101, offset: 0 },
    { limit: 10.5, offset: 0 },
    { limit: 10, offset: -1 },
    { limit: 10, offset: 0, searchEmail: " " },
  ])("rejects an invalid list request", (request) => {
    expect(() => validatePrivilegedAuthUserListRequest(request)).toThrowError(
      new PrivilegedAuthenticationProviderError("INVALID_REQUEST"),
    );
  });

  it("projects only safe provider user fields", () => {
    const result = toPrivilegedAuthUserSummary({
      id: "must-not-leave-the-adapter",
      email: " admin@example.invalid ",
      emailVerified: true,
      createdAt: "2026-08-24T00:00:00.000Z",
      role: "admin",
      token: "must-not-leave-the-adapter",
      sessionToken: "must-not-leave-the-adapter",
    });

    expect(result).toEqual({
      email: "admin@example.invalid",
      emailVerified: true,
      createdAt: "2026-08-24T00:00:00.000Z",
    });
    expect(Object.keys(result)).toEqual(["email", "emailVerified", "createdAt"]);
  });

  it.each([
    null,
    {},
    { email: "", emailVerified: true, createdAt: new Date() },
    { email: "admin@example.invalid", emailVerified: "yes", createdAt: new Date() },
    { email: "admin@example.invalid", emailVerified: true, createdAt: "invalid" },
  ])("rejects a malformed provider user response", (providerUser) => {
    expect(() => toPrivilegedAuthUserSummary(providerUser)).toThrowError(
      new PrivilegedAuthenticationProviderError("INVALID_PROVIDER_RESPONSE"),
    );
  });

  it("keeps unsupported session operations fail-closed in the Neon adapter", async () => {
    const providerSource = await readFile(
      path.join(process.cwd(), "src/auth/neon-provider.ts"),
      "utf8",
    );

    expect(providerSource).toContain("getNeonAuthClient().admin.listUsers");
    expect(providerSource).toContain('unavailableReason: "UNVALIDATED_PROVIDER_CONTRACT"');
    expect(providerSource).toContain('"RECENT_AUTHENTICATION_UNAVAILABLE"');
    expect(providerSource).not.toContain(".admin.listUserSessions");
    expect(providerSource).not.toContain(".admin.revokeUserSessions");
  });

  it("reports unavailable privileged session capabilities without constructing a client", async () => {
    const { getPrivilegedAuthenticationProvider } = await import("./neon-provider");
    const provider = getPrivilegedAuthenticationProvider();

    expect(provider.getCapabilities()).toMatchObject({
      listUsers: {
        availability: "SUPPORTED",
        requiresProviderAdmin: true,
      },
      listSessions: {
        availability: "UNAVAILABLE",
        unavailableReason: "UNVALIDATED_PROVIDER_CONTRACT",
      },
      revokeAllSessions: {
        availability: "UNAVAILABLE",
        unavailableReason: "RECENT_AUTHENTICATION_UNAVAILABLE",
      },
      recentAuthentication: {
        availability: "UNAVAILABLE",
        unavailableReason: "PROVIDER_NOT_SUPPORTED",
      },
    });
    await expect(provider.revokeAllSessions()).rejects.toEqual(
      new PrivilegedAuthenticationProviderError("RECENT_AUTHENTICATION_UNAVAILABLE"),
    );
    expect(authMocks.createNeonAuth).not.toHaveBeenCalled();
  });

  it("uses the typed provider list API and returns only the safe page projection", async () => {
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [
          {
            id: "must-not-leave-the-adapter",
            email: "provider-admin@example.invalid",
            emailVerified: true,
            createdAt: new Date("2026-08-24T01:00:00.000Z"),
            role: "admin",
            banned: false,
          },
        ],
        total: 1,
      },
      error: null,
    });
    authMocks.createNeonAuth.mockReturnValue({ admin: { listUsers } });
    const previousBaseUrl = process.env.NEON_AUTH_BASE_URL;
    const previousCookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
    process.env.NEON_AUTH_BASE_URL = "https://auth.example.invalid";
    process.env.NEON_AUTH_COOKIE_SECRET = "x".repeat(32);

    try {
      const { getPrivilegedAuthenticationProvider } = await import("./neon-provider");
      const page = await getPrivilegedAuthenticationProvider().listUsers({
        limit: 20,
        offset: 40,
        searchEmail: "example.invalid",
      });

      expect(listUsers).toHaveBeenCalledWith({
        query: {
          limit: 20,
          offset: 40,
          sortBy: "createdAt",
          sortDirection: "desc",
          searchValue: "example.invalid",
          searchField: "email",
          searchOperator: "contains",
        },
      });
      expect(page).toEqual({
        users: [
          {
            email: "provider-admin@example.invalid",
            emailVerified: true,
            createdAt: "2026-08-24T01:00:00.000Z",
          },
        ],
        total: 1,
        limit: 20,
        offset: 40,
      });
    } finally {
      if (previousBaseUrl === undefined) {
        delete process.env.NEON_AUTH_BASE_URL;
      } else {
        process.env.NEON_AUTH_BASE_URL = previousBaseUrl;
      }
      if (previousCookieSecret === undefined) {
        delete process.env.NEON_AUTH_COOKIE_SECRET;
      } else {
        process.env.NEON_AUTH_COOKIE_SECRET = previousCookieSecret;
      }
    }
  });

  it("keeps provider subjects and session credentials out of safe DTOs", async () => {
    const contractSource = await readFile(
      path.join(process.cwd(), "src/auth/privileged-provider.ts"),
      "utf8",
    );
    const summarySource = contractSource
      .split("export type PrivilegedAuthUserSummary")[1]
      ?.split("export type PrivilegedAuthUserListRequest")[0];

    expect(summarySource).toBeDefined();
    expect(summarySource).not.toMatch(/\b(?:id|token|sessionToken|providerUserId)\b/);
  });
});
