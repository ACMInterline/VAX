import type { MetadataRoute } from "next";
import {
  getConfiguredPublicUrl,
  getSitemapBaseUrl,
} from "@/lib/public-metadata";

export default function robots(): MetadataRoute.Robots {
  const configuredUrl = getConfiguredPublicUrl();

  return {
    rules: configuredUrl
      ? { userAgent: "*", allow: "/" }
      : { userAgent: "*", disallow: "/" },
    sitemap: configuredUrl
      ? new URL("/sitemap.xml", getSitemapBaseUrl()).toString()
      : undefined,
  };
}
