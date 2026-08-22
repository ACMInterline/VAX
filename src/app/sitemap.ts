import type { MetadataRoute } from "next";
import { publicRouteMap } from "@/content/public-site/routes";
import { getSitemapBaseUrl } from "@/lib/public-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSitemapBaseUrl();

  return publicRouteMap.map((route) => ({
    url: new URL(route.path, baseUrl).toString(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
