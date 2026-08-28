import { describe, expect, it } from "vitest";
import {
  getHostedStagingEmailPolicy,
  isAuthEmailAllowedForDeployment,
} from "./staging-email-policy";

const hostedStaging = {
  NODE_ENV: "production",
  VAX_ENVIRONMENT: "staging",
  EMAIL_DELIVERY_MODE: "sandbox",
  STAGING_AUTH_EMAIL_ALLOWLIST:
    "owner+phase3m@example.invalid,technician+phase3m@example.invalid",
} as const;

describe("hosted staging email policy", () => {
  it("allows only exact normalized synthetic recipients", () => {
    const policy = getHostedStagingEmailPolicy(hostedStaging);

    expect(policy?.deliveryMode).toBe("sandbox");
    expect(
      isAuthEmailAllowedForDeployment(
        "OWNER+PHASE3M@example.invalid",
        hostedStaging,
      ),
    ).toBe(true);
    expect(
      isAuthEmailAllowedForDeployment("other@example.invalid", hostedStaging),
    ).toBe(false);
  });

  it.each([
    { EMAIL_DELIVERY_MODE: undefined },
    { EMAIL_DELIVERY_MODE: "blocked" },
    { STAGING_AUTH_EMAIL_ALLOWLIST: "" },
    { STAGING_AUTH_EMAIL_ALLOWLIST: "*@example.invalid" },
    {
      STAGING_AUTH_EMAIL_ALLOWLIST:
        "owner+phase3m@example.invalid,owner+phase3m@example.invalid",
    },
  ])("fails closed for an unsafe hosted staging policy", (override) => {
    const environment = { ...hostedStaging, ...override };
    expect(() => getHostedStagingEmailPolicy(environment)).toThrow(
      "Hosted staging email delivery is not configured safely.",
    );
    expect(
      isAuthEmailAllowedForDeployment(
        "owner+phase3m@example.invalid",
        environment,
      ),
    ).toBe(false);
  });

  it("does not impose a staging recipient list on development or production", () => {
    expect(
      getHostedStagingEmailPolicy({
        NODE_ENV: "development",
        VAX_ENVIRONMENT: "development",
      }),
    ).toBeUndefined();
    expect(
      getHostedStagingEmailPolicy({
        NODE_ENV: "production",
        VAX_ENVIRONMENT: "production",
      }),
    ).toBeUndefined();
  });
});
