import type { MetadataRoute } from "next";
import {
  getConfiguredPublicUrl,
  getSitemapBaseUrl,
} from "@/lib/public-metadata";
import { getVaxEnvironment } from "@/operations/environment";

export default function robots(): MetadataRoute.Robots {
  const configuredUrl = getConfiguredPublicUrl();
  let indexable = false;
  try {
    indexable = Boolean(configuredUrl) && getVaxEnvironment() !== "staging";
  } catch {
    indexable = false;
  }

  return {
    rules: indexable
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
    sitemap: indexable && configuredUrl
      ? new URL("/sitemap.xml", getSitemapBaseUrl()).toString()
      : undefined,
  };
}
