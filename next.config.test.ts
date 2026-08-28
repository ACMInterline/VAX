import { describe, expect, it } from "vitest";
import { createBaselineSecurityHeaders } from "./next.config";

describe("Next.js security headers", () => {
  it("sets a restrictive baseline CSP and privacy headers", () => {
    const headers = createBaselineSecurityHeaders({ NODE_ENV: "production" });
    const byName = new Map(headers.map((header) => [header.key, header.value]));

    expect(byName.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(byName.get("Content-Security-Policy")).toContain("object-src 'none'");
    expect(byName.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(byName.get("Content-Security-Policy")).not.toContain("unsafe-eval");
    expect(byName.get("X-Frame-Options")).toBe("DENY");
    expect(byName.has("Strict-Transport-Security")).toBe(false);
  });

  it("sets HSTS only for an explicit HTTPS production-like origin", () => {
    expect(
      new Map(
        createBaselineSecurityHeaders({
          NODE_ENV: "production",
          VAX_ENVIRONMENT: "staging",
          PUBLIC_SITE_URL: "https://staging.example.invalid",
        }).map((header) => [header.key, header.value]),
      ).get("Strict-Transport-Security"),
    ).toBe("max-age=31536000; includeSubDomains");
    expect(
      createBaselineSecurityHeaders({
        NODE_ENV: "development",
        PUBLIC_SITE_URL: "http://127.0.0.1:3000",
      }).some((header) => header.key === "Strict-Transport-Security"),
    ).toBe(false);
  });
});
