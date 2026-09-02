import { describe, expect, it } from "vitest";
import { getFinanceEnvironmentScope } from "./environment";

describe("finance environment scope", () => {
  it.each([
    ["development", "DEVELOPMENT"],
    ["staging", "STAGING"],
    ["production", "PRODUCTION"],
  ] as const)("maps explicit %s to %s", (configured, expected) => {
    expect(
      getFinanceEnvironmentScope({
        NODE_ENV: configured === "development" ? "development" : "production",
        VAX_ENVIRONMENT: configured,
      }),
    ).toBe(expected);
  });

  it("keeps hosted staging separate from production finance configuration", () => {
    expect(
      getFinanceEnvironmentScope({
        NODE_ENV: "production",
        VAX_ENVIRONMENT: "staging",
      }),
    ).toBe("STAGING");
  });

  it("fails closed when a hosted scope is absent or blank", () => {
    for (const environment of [
      { NODE_ENV: "production" },
      { NODE_ENV: "production", VAX_ENVIRONMENT: "   " },
    ]) {
      expect(() => getFinanceEnvironmentScope(environment)).toThrow(
        "VAX environment is not configured safely.",
      );
    }
    expect(getFinanceEnvironmentScope({ NODE_ENV: "development" })).toBe(
      "DEVELOPMENT",
    );
  });

  it("fails closed for invalid or unsafe environment identities", () => {
    expect(() =>
      getFinanceEnvironmentScope({
        NODE_ENV: "production",
        VAX_ENVIRONMENT: "preview",
      }),
    ).toThrow("VAX environment is not configured safely.");
    expect(() =>
      getFinanceEnvironmentScope({
        NODE_ENV: "production",
        VAX_ENVIRONMENT: "development",
      }),
    ).toThrow("VAX environment is not configured safely.");
  });
});
