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

  it("withholds LocalBusiness data until the public identity is verified", () => {
    expect(buildBusinessJsonLd()).toBeUndefined();
  });
});
