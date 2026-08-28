import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "./robots";

afterEach(() => vi.unstubAllEnvs());

describe("robots staging boundary", () => {
  it("disallows all crawling in staging even with a configured URL", () => {
    vi.stubEnv("VAX_ENVIRONMENT", "staging");
    vi.stubEnv("PUBLIC_SITE_URL", "https://staging.example.invalid");

    expect(robots()).toEqual({
      rules: { userAgent: "*", disallow: "/" },
      sitemap: undefined,
    });
  });
});
