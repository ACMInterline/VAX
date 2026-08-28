import type { Metadata } from "next";
import {
  publicBrand,
  publicLanguageConfig,
  type PublicLocale,
} from "@/config/public-site";
import { localizePublicPath } from "@/content/public-site/routes";
import { isLiteralLoopbackOrUnspecifiedHostname } from "@/lib/url-security";
import {
  getVaxEnvironment,
  isStrictHostedEnvironment,
} from "@/operations/environment";

const localMetadataBaseUrl = new URL("http://localhost:3000");

function getIndexablePublicUrl(): URL | undefined {
  try {
    return getVaxEnvironment() === "staging"
      ? undefined
      : getConfiguredPublicUrl();
  } catch {
    return undefined;
  }
}

export function getConfiguredPublicUrl(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): URL | undefined {
  const candidate = environment.PUBLIC_SITE_URL?.trim();

  if (!candidate) {
    return undefined;
  }

  try {
    const url = new URL(candidate);
    const isLoopback = isLiteralLoopbackOrUnspecifiedHostname(url.hostname);
    const isProductionLike = isStrictHostedEnvironment(environment);
    const isSecure = url.protocol === "https:";
    const isLocalHttp =
      !isProductionLike && url.protocol === "http:" && isLoopback;
    const hasNonOriginComponents =
      url.pathname !== "/" || url.search !== "" || url.hash !== "";

    if (
      (!isSecure && !isLocalHttp) ||
      (isProductionLike && (isLoopback || hasNonOriginComponents)) ||
      url.username !== "" ||
      url.password !== ""
    ) {
      return undefined;
    }

    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return undefined;
  }
}

export function getSitemapBaseUrl(): URL {
  return getConfiguredPublicUrl() ?? localMetadataBaseUrl;
}

export function getLocalizedUrls(path: string, baseUrl: URL) {
  return {
    bg: new URL(localizePublicPath("bg", path), baseUrl).toString(),
    en: new URL(localizePublicPath("en", path), baseUrl).toString(),
  };
}

type PageMetadataInput = {
  locale: PublicLocale;
  title: string;
  description: string;
  path: string;
};

export function createPageMetadata({
  locale,
  title,
  description,
  path,
}: PageMetadataInput): Metadata {
  const baseUrl = getIndexablePublicUrl();
  const urls = baseUrl ? getLocalizedUrls(path, baseUrl) : undefined;
  const canonical = urls?.[locale];
  const alternateLocale =
    locale === publicLanguageConfig.primaryLocale
      ? publicLanguageConfig.openGraphLocales.en
      : publicLanguageConfig.openGraphLocales.bg;

  return {
    title,
    description,
    alternates: urls
      ? {
          canonical,
          languages: {
            bg: urls.bg,
            en: urls.en,
            "x-default": urls.bg,
          },
        }
      : undefined,
    openGraph: {
      type: "website",
      title,
      description,
      siteName: publicBrand.name,
      locale: publicLanguageConfig.openGraphLocales[locale],
      alternateLocale,
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export function createRootMetadata({
  locale,
  title,
  description,
}: Omit<PageMetadataInput, "path">): Metadata {
  const baseUrl = getConfiguredPublicUrl();

  return {
    ...(createPageMetadata({ locale, title, description, path: "/" }) as Metadata),
    metadataBase: baseUrl ?? localMetadataBaseUrl,
    title: {
      default: title,
      template: `%s | ${publicBrand.name}`,
    },
    applicationName: publicBrand.name,
    category: "professional services",
  };
}

type BreadcrumbItem = {
  name: string;
  path: string;
};

export function buildBreadcrumbJsonLd(items: readonly BreadcrumbItem[]) {
  const baseUrl = getIndexablePublicUrl();

  if (!baseUrl) {
    return undefined;
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: new URL(item.path, baseUrl).toString(),
    })),
  };
}

export function buildBusinessJsonLd() {
  const baseUrl = getIndexablePublicUrl();

  if (!baseUrl || !publicBrand.publicIdentityVerified) {
    return undefined;
  }

  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: publicBrand.name,
    url: baseUrl.toString(),
    areaServed: publicBrand.location.city,
  };
}
