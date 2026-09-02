import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  businessAuthorityActorContextPayload,
  deriveBusinessAuthorityActorContextKey,
  signBusinessAuthorityActorContext,
  type BusinessAuthorityActorContextInput,
} from "./actor-context";

const environment = {
  VAX_ENVIRONMENT: "staging",
  NEON_AUTH_COOKIE_SECRET:
    "synthetic-test-cookie-secret-that-is-never-used-outside-tests",
};
const input: BusinessAuthorityActorContextInput = {
  actorProfileId: "10000000-0000-4000-8000-000000000001",
  providerUserId: "synthetic-provider-subject",
  primaryCorrelationId: "20000000-0000-4000-8000-000000000001",
  secondaryCorrelationId: "30000000-0000-4000-8000-000000000001",
  issuedAtEpochSeconds: 1_788_217_600,
};

describe("business-authority signed actor context", () => {
  it("derives a domain-separated key and deterministic signature", () => {
    const derivedKey = deriveBusinessAuthorityActorContextKey(environment);
    const signature = signBusinessAuthorityActorContext(input, environment);

    expect(derivedKey).toMatch(/^[0-9a-f]{64}$/);
    expect(derivedKey).not.toContain(environment.NEON_AUTH_COOKIE_SECRET);
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
    expect(signBusinessAuthorityActorContext(input, environment)).toBe(
      signature,
    );
    expect(businessAuthorityActorContextPayload(input)).not.toContain(
      input.providerUserId,
    );
  });

  it.each([
    ["actorProfileId", "10000000-0000-4000-8000-000000000002"],
    ["providerUserId", "different-provider-subject"],
    ["primaryCorrelationId", "20000000-0000-4000-8000-000000000002"],
    ["secondaryCorrelationId", null],
    ["issuedAtEpochSeconds", input.issuedAtEpochSeconds + 1],
  ] as const)("binds %s into the signature", (field, value) => {
    expect(
      signBusinessAuthorityActorContext(
        { ...input, [field]: value },
        environment,
      ),
    ).not.toBe(signBusinessAuthorityActorContext(input, environment));
  });

  it("fails closed when the existing cookie secret is unavailable", () => {
    expect(() =>
      signBusinessAuthorityActorContext(input, {
        VAX_ENVIRONMENT: "staging",
      }),
    ).toThrow("Business-authority actor context is unavailable.");
  });

  it("fails closed without an explicit valid VAX environment", () => {
    expect(() =>
      signBusinessAuthorityActorContext(input, {
        NEON_AUTH_COOKIE_SECRET: environment.NEON_AUTH_COOKIE_SECRET,
      }),
    ).toThrow("Business-authority actor context is unavailable.");
  });

  it("cannot reuse a signature across environments even with the same cookie secret", () => {
    const stagingSignature = signBusinessAuthorityActorContext(input, environment);
    const productionSignature = signBusinessAuthorityActorContext(input, {
      ...environment,
      VAX_ENVIRONMENT: "production",
    });

    expect(productionSignature).not.toBe(stagingSignature);
  });
});
