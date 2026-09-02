import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildBusinessJsonLd,
  createPageMetadata,
  getConfiguredPublicUrl,
  getLocalizedUrls,
} from "./public-metadata";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("localized public metadata", () => {
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

  it("requires HTTPS for a production public origin", () => {
    expect(
      getConfiguredPublicUrl({
        PUBLIC_SITE_URL: "http://127.0.0.1:3000",
        NODE_ENV: "production",
        VAX_ENVIRONMENT: "production",
      }),
    ).toBeUndefined();
    expect(
      getConfiguredPublicUrl({
        PUBLIC_SITE_URL: "https://fabric.example",
        NODE_ENV: "production",
        VAX_ENVIRONMENT: "production",
      })?.href,
    ).toBe("https://fabric.example/");
  });

  it("requires an exact HTTPS origin for hosted staging", () => {
    expect(
      getConfiguredPublicUrl({
        VAX_ENVIRONMENT: "staging",
        PUBLIC_SITE_URL: "http://127.0.0.1:3000",
      }),
    ).toBeUndefined();
    expect(
      getConfiguredPublicUrl({
        VAX_ENVIRONMENT: "staging",
        PUBLIC_SITE_URL: "https://staging.fabric.example",
      })?.href,
    ).toBe("https://staging.fabric.example/");
  });

  it("allows loopback staging only for an explicit local rehearsal", () => {
    expect(
      getConfiguredPublicUrl({
        NODE_ENV: "development",
        VAX_ENVIRONMENT: "staging",
        STAGING_ALLOW_LOCALHOST: "true",
        PUBLIC_SITE_URL: "http://127.0.0.1:3000",
      })?.href,
    ).toBe("http://127.0.0.1:3000/");
  });

  it.each([
    "https://localhost",
    "https://public.localhost",
    "https://127.0.0.1",
    "https://0.0.0.0",
    "https://[::]",
    "https://[::1]",
    "https://[::127.0.0.1]",
    "https://[::ffff:127.0.0.1]",
    "https://[::ffff:0.0.0.0]",
    "https://fabric.example/path",
    "https://fabric.example?query=not-allowed",
    "https://fabric.example#not-allowed",
  ])("rejects an ambiguous production public origin", (publicSiteUrl) => {
    expect(
      getConfiguredPublicUrl({
        PUBLIC_SITE_URL: publicSiteUrl,
        NODE_ENV: "production",
      }),
    ).toBeUndefined();
  });

  it("rejects embedded credentials without exposing them as public metadata", () => {
    expect(
      getConfiguredPublicUrl({
        PUBLIC_SITE_URL: "https://operator:password@fabric.example",
        NODE_ENV: "production",
      }),
    ).toBeUndefined();
  });

  it("creates paired Bulgarian and English canonical URLs", () => {
    expect(
      getLocalizedUrls(
        "/services/carpet-cleaning",
        new URL("https://fabric.example"),
      ),
    ).toEqual({
      bg: "https://fabric.example/services/carpet-cleaning",
      en: "https://fabric.example/en/services/carpet-cleaning",
    });
  });

  it("adds locale canonicals, hreflang and Open Graph locale when configured", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "https://fabric.example");

    const bulgarian = createPageMetadata({
      locale: "bg",
      title: "Почистване на мокети",
      description: "Професионална грижа.",
      path: "/services/carpet-cleaning",
    });
    const english = createPageMetadata({
      locale: "en",
      title: "Carpet cleaning",
      description: "Professional carpet care.",
      path: "/services/carpet-cleaning",
    });

    expect(bulgarian.alternates).toMatchObject({
      canonical: "https://fabric.example/services/carpet-cleaning",
      languages: {
        bg: "https://fabric.example/services/carpet-cleaning",
        en: "https://fabric.example/en/services/carpet-cleaning",
        "x-default": "https://fabric.example/services/carpet-cleaning",
      },
    });
    expect(english.alternates).toMatchObject({
      canonical: "https://fabric.example/en/services/carpet-cleaning",
    });
    expect(bulgarian.openGraph).toMatchObject({
      locale: "bg_BG",
      alternateLocale: "en_GB",
    });
    expect(english.openGraph).toMatchObject({
      locale: "en_GB",
      alternateLocale: "bg_BG",
    });
  });

  it("does not invent a canonical domain when the site URL is absent", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "");

    const metadata = createPageMetadata({
      locale: "bg",
      title: "Почистване на мокети",
      description: "Професионална грижа.",
      path: "/services/carpet-cleaning",
    });

    expect(metadata.alternates).toBeUndefined();
  });

  it("does not publish canonical metadata from staging", () => {
    vi.stubEnv("VAX_ENVIRONMENT", "staging");
    vi.stubEnv("PUBLIC_SITE_URL", "https://staging.fabric.example");

    const metadata = createPageMetadata({
      locale: "en",
      title: "Carpet cleaning",
      description: "Professional carpet care.",
      path: "/services/carpet-cleaning",
    });

    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).toHaveProperty("url", undefined);
  });

  it("withholds LocalBusiness data until the public identity is verified", () => {
    expect(buildBusinessJsonLd()).toBeUndefined();
  });
});
