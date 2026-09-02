import { describe, expect, it } from "vitest";
import {
  getTrustedProxyHopCount,
  getVaxEnvironment,
  isStagingLocalRehearsal,
  isStrictHostedEnvironment,
} from "./environment";

describe("VAX operational environment", () => {
  it("requires an explicit hosted environment identity", () => {
    for (const environment of [
      { NODE_ENV: "production" },
      { NODE_ENV: "production", VAX_ENVIRONMENT: "   " },
    ]) {
      expect(() => getVaxEnvironment(environment)).toThrow(
        "VAX environment is not configured safely.",
      );
    }
    expect(getVaxEnvironment({ NODE_ENV: "development" })).toBe(
      "development",
    );
  });

  it("supports an explicit staging identity for a production build", () => {
    expect(
      getVaxEnvironment({ NODE_ENV: "production", VAX_ENVIRONMENT: "staging" }),
    ).toBe("staging");
  });

  it("does not let a production build identify as development", () => {
    expect(() =>
      getVaxEnvironment({
        NODE_ENV: "production",
        VAX_ENVIRONMENT: "development",
      }),
    ).toThrow("VAX environment is not configured safely.");
  });

  it("permits loopback staging only behind the explicit local rehearsal gate", () => {
    const localRehearsal = {
      NODE_ENV: "development",
      VAX_ENVIRONMENT: "staging",
      STAGING_ALLOW_LOCALHOST: "true",
    };

    expect(isStagingLocalRehearsal(localRehearsal)).toBe(true);
    expect(isStrictHostedEnvironment(localRehearsal)).toBe(false);
    expect(
      isStagingLocalRehearsal({ ...localRehearsal, NODE_ENV: "production" }),
    ).toBe(false);
    expect(
      isStrictHostedEnvironment({ ...localRehearsal, NODE_ENV: "production" }),
    ).toBe(true);
  });

  it("accepts only a small explicit trusted-proxy hop count", () => {
    expect(
      getTrustedProxyHopCount({ VAX_ENVIRONMENT: "development" }),
    ).toBe(0);
    expect(
      getTrustedProxyHopCount({
        NODE_ENV: "development",
        VAX_ENVIRONMENT: "staging",
        STAGING_ALLOW_LOCALHOST: "true",
      }),
    ).toBe(0);
    expect(
      getTrustedProxyHopCount({
        VAX_ENVIRONMENT: "development",
        VAX_TRUSTED_PROXY_HOPS: "2",
      }),
    ).toBe(2);
    for (const configured of ["0", "6", "1.5", "proxy"]) {
      expect(() =>
        getTrustedProxyHopCount({
          VAX_ENVIRONMENT: "development",
          VAX_TRUSTED_PROXY_HOPS: configured,
        }),
      ).toThrow("Trusted proxy configuration is invalid.");
    }
    for (const environment of [
      { NODE_ENV: "production", VAX_ENVIRONMENT: "production" },
      { NODE_ENV: "production", VAX_ENVIRONMENT: "staging" },
    ]) {
      expect(() => getTrustedProxyHopCount(environment)).toThrow(
        "Trusted proxy configuration is invalid.",
      );
    }
  });
});
