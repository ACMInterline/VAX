import { publicLanguageConfig, type PublicLocale } from "@/config/public-site";
import { englishPublicContent } from "./en";
import type { ServiceContent, ServiceSlug } from "./types";

const publicContentByLocale = {
  en: englishPublicContent,
} as const;

export function getPublicContent(
  locale: PublicLocale = publicLanguageConfig.renderedLocale,
) {
  if (locale !== "en") {
    return englishPublicContent;
  }

  return publicContentByLocale[locale];
}

export function getService(slug: string): ServiceContent | undefined {
  return getPublicContent().services.find((service) => service.slug === slug);
}

export function isServiceSlug(slug: string): slug is ServiceSlug {
  return getService(slug) !== undefined;
}
