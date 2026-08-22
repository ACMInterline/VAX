import { describe, expect, it } from "vitest";
import { getAuthLocaleSwitchHref } from "./auth";

describe("authentication locale navigation", () => {
  it.each([
    ["bg", "/en/login"],
    ["en", "/login"],
  ] as const)("links %s login to the alternate locale", (locale, expected) => {
    expect(getAuthLocaleSwitchHref(locale, "login")).toBe(expected);
  });

  it.each(["bg", "en"] as const)(
    "hides the %s reset language switch while a recovery token is active",
    (locale) => {
      expect(
        getAuthLocaleSwitchHref(locale, "reset-password", "sensitive-token"),
      ).toBeNull();
    },
  );

  it("allows locale switching when a reset token is missing", () => {
    expect(getAuthLocaleSwitchHref("bg", "reset-password")).toBe(
      "/en/reset-password",
    );
  });
});
