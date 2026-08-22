import type { MetadataRoute } from "next";
import {
  getConfiguredPublicUrl,
  getSitemapBaseUrl,
} from "@/lib/public-metadata";

export default function robots(): MetadataRoute.Robots {
  const configuredUrl = getConfiguredPublicUrl();

  return {
    rules: configuredUrl
      ? {
          userAgent: "*",
          allow: "/",
          disallow: [
            "/internal/",
            "/app/",
            "/login",
            "/signup",
            "/forgot-password",
            "/reset-password",
            "/verify-email",
            "/en/login",
            "/en/signup",
            "/en/forgot-password",
            "/en/reset-password",
            "/en/verify-email",
          ],
        }
      : { userAgent: "*", disallow: "/" },
    sitemap: configuredUrl
      ? new URL("/sitemap.xml", getSitemapBaseUrl()).toString()
      : undefined,
  };
}
