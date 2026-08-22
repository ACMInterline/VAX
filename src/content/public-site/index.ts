import {
  publicLanguageConfig,
  type PublicLocale,
} from "@/config/public-site";
import { bulgarianPublicContent } from "./bg";
import { bulgarianPublicSiteCopy } from "./copy.bg";
import { englishPublicSiteCopy } from "./copy.en";
import { englishPublicContent } from "./en";
import type {
  PublicSiteContent,
  ServiceContent,
  ServiceSlug,
} from "./types";

const publicContentByLocale = {
  bg: { ...bulgarianPublicContent, ...bulgarianPublicSiteCopy },
  en: { ...englishPublicContent, ...englishPublicSiteCopy },
} as const satisfies Record<PublicLocale, PublicSiteContent>;

export function getPublicContent(
  locale: PublicLocale = publicLanguageConfig.primaryLocale,
): PublicSiteContent {
  return publicContentByLocale[locale];
}

export function getService(
  locale: PublicLocale,
  slug: string,
): ServiceContent | undefined {
  return getPublicContent(locale).services.find(
    (service) => service.slug === slug,
  );
}

export function isServiceSlug(slug: string): slug is ServiceSlug {
  return getService(publicLanguageConfig.primaryLocale, slug) !== undefined;
}
