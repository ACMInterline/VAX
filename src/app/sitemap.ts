import type { MetadataRoute } from "next";
import { publicLanguageConfig } from "@/config/public-site";
import { publicRouteMap } from "@/content/public-site/routes";
import {
  getLocalizedUrls,
  getSitemapBaseUrl,
} from "@/lib/public-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSitemapBaseUrl();

  return publicRouteMap.flatMap((route) => {
    const urls = getLocalizedUrls(route.path, baseUrl);

    return publicLanguageConfig.supportedLocales.map((locale) => ({
      url: urls[locale],
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: {
        languages: {
          bg: urls.bg,
          en: urls.en,
          "x-default": urls.bg,
        },
      },
    }));
  });
}
