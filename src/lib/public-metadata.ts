import type { Metadata } from "next";
import { publicBrand } from "@/config/public-site";

const localMetadataBaseUrl = new URL("http://localhost:3000");

export function getConfiguredPublicUrl(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): URL | undefined {
  const candidate = environment.PUBLIC_SITE_URL?.trim();

  if (!candidate) {
    return undefined;
  }

  try {
    const url = new URL(candidate);
    const isSecure = url.protocol === "https:";
    const isLocalHttp =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");

    if (!isSecure && !isLocalHttp) {
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

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
};

export function createPageMetadata({
  title,
  description,
  path,
}: PageMetadataInput): Metadata {
  const baseUrl = getConfiguredPublicUrl();
  const canonical = baseUrl ? new URL(path, baseUrl).toString() : undefined;

  return {
    title,
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      type: "website",
      title,
      description,
      siteName: publicBrand.name,
      locale: "en_GB",
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export function createRootMetadata(
  title: string,
  description: string,
): Metadata {
  const baseUrl = getConfiguredPublicUrl();

  return {
    ...(createPageMetadata({ title, description, path: "/" }) as Metadata),
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
  const baseUrl = getConfiguredPublicUrl();

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
  const baseUrl = getConfiguredPublicUrl();

  if (!baseUrl || !publicBrand.publicIdentityVerified) {
    return undefined;
  }

  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: publicBrand.name,
    url: baseUrl.toString(),
    areaServed: publicBrand.location,
  };
}
