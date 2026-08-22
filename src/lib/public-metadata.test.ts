import { describe, expect, it } from "vitest";
import {
  buildBusinessJsonLd,
  createPageMetadata,
  getConfiguredPublicUrl,
} from "./public-metadata";

describe("public metadata", () => {
  it("accepts HTTPS and loopback metadata origins", () => {
    expect(
      getConfiguredPublicUrl({ PUBLIC_SITE_URL: "https://fabric.example/path" })
        ?.href,
    ).toBe("https://fabric.example/");
    expect(
      getConfiguredPublicUrl({ PUBLIC_SITE_URL: "http://127.0.0.1:3000" })
        ?.href,
    ).toBe("http://127.0.0.1:3000/");
  });

  it("does not publish an insecure or malformed canonical origin", () => {
    expect(
      getConfiguredPublicUrl({ PUBLIC_SITE_URL: "http://example.com" }),
    ).toBeUndefined();
    expect(
      getConfiguredPublicUrl({ PUBLIC_SITE_URL: "not a URL" }),
    ).toBeUndefined();
  });

  it("creates page metadata without inventing a canonical domain", () => {
    const metadata = createPageMetadata({
      title: "Carpet cleaning",
      description: "Professional carpet care.",
      path: "/services/carpet-cleaning",
    });

    expect(metadata.title).toBe("Carpet cleaning");
    expect(metadata.alternates).toBeUndefined();
  });

  it("withholds LocalBusiness data until the public identity is verified", () => {
    expect(buildBusinessJsonLd()).toBeUndefined();
  });
});
