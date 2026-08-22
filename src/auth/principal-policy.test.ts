import { describe, expect, it } from "vitest";
import type { Session } from "./contracts";
import {
  AuthenticationBoundaryError,
  resolveAuthenticatedPrincipal,
} from "./principal-policy";
import type { ApplicationAccess } from "@/modules/identity-access/repository";

const session: Session = {
  user: {
    id: "provider-user",
    email: "synthetic@example.invalid",
    displayName: "Synthetic User",
    emailVerified: true,
  },
  expiresAt: null,
};

function access(status: ApplicationAccess["profile"]["status"] = "ACTIVE"): ApplicationAccess {
  return {
    profile: {
      id: "profile-id",
      displayName: "Synthetic User",
      preferredLocale: "en",
      phone: null,
      status,
    },
    roles: new Set(["CUSTOMER"]),
    permissions: new Set(["IDENTITY_SELF_READ"]),
  };
}

describe("authenticated principal resolution", () => {
  it("rejects an unauthenticated request", () => {
    expect(() => resolveAuthenticatedPrincipal(null, null, false)).toThrowError(
      new AuthenticationBoundaryError("AUTHENTICATION_REQUIRED"),
    );
  });

  it("rejects a provider account without an application profile", () => {
    expect(() => resolveAuthenticatedPrincipal(session, null, false)).toThrowError(
      new AuthenticationBoundaryError("ACCOUNT_NOT_PROVISIONED"),
    );
  });

  it.each(["SUSPENDED", "DISABLED"] as const)("rejects a %s profile", (status) => {
    expect(() => resolveAuthenticatedPrincipal(session, access(status), false)).toThrowError(
      new AuthenticationBoundaryError("ACCOUNT_UNAVAILABLE"),
    );
  });

  it("enforces email verification when the runtime policy requires it", () => {
    expect(() =>
      resolveAuthenticatedPrincipal(
        { ...session, user: { ...session.user, emailVerified: false } },
        access(),
        true,
      ),
    ).toThrowError(new AuthenticationBoundaryError("EMAIL_VERIFICATION_REQUIRED"));
  });

  it("rejects an active profile without an active application role", () => {
    expect(() =>
      resolveAuthenticatedPrincipal(
        session,
        { ...access(), roles: new Set(), permissions: new Set() },
        false,
      ),
    ).toThrowError(new AuthenticationBoundaryError("ACCOUNT_UNAVAILABLE"));
  });

  it("returns only an active, allowed principal", () => {
    expect(resolveAuthenticatedPrincipal(session, access(), true).profile.status).toBe(
      "ACTIVE",
    );
  });
});
