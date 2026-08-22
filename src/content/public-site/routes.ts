import {
  publicLanguageConfig,
  type PublicLocale,
} from "@/config/public-site";
import type { ServiceSlug } from "./types";

export const serviceSlugs = [
  "carpet-cleaning",
  "rug-cleaning",
  "sofa-upholstery-cleaning",
  "mattress-cleaning",
  "office-carpet-cleaning",
  "delicate-fabric-care",
] as const satisfies readonly ServiceSlug[];

export const requiredPublicRoutes = [
  "/",
  "/services",
  ...serviceSlugs.map((slug) => `/services/${slug}` as const),
  "/how-it-works",
  "/why-professional-cleaning",
  "/service-area",
  "/about",
  "/faq",
  "/contact",
  "/request",
] as const;

export type PublicPath = (typeof requiredPublicRoutes)[number];

const publicPathSet = new Set<string>(requiredPublicRoutes);

export function localizePublicPath(
  locale: PublicLocale,
  path: PublicPath | string,
): string {
  const prefix = publicLanguageConfig.prefixes[locale];

  if (path === "/") {
    return prefix || "/";
  }

  return `${prefix}${path}`;
}

export function getBasePublicPath(pathname: string): PublicPath {
  const withoutEnglishPrefix =
    pathname === "/en"
      ? "/"
      : pathname.startsWith("/en/")
        ? pathname.slice(3)
        : pathname;

  return publicPathSet.has(withoutEnglishPrefix)
    ? (withoutEnglishPrefix as PublicPath)
    : "/";
}

export function getLanguageSwitchHref(
  targetLocale: PublicLocale,
  pathname: string,
): string {
  return localizePublicPath(targetLocale, getBasePublicPath(pathname));
}

export const publicRouteMap = requiredPublicRoutes.map((path) => ({
  path,
  changeFrequency: path === "/" ? "weekly" : "monthly",
  priority: path === "/" ? 1 : path === "/request" ? 0.9 : 0.7,
})) as readonly {
  path: PublicPath;
  changeFrequency: "weekly" | "monthly";
  priority: number;
}[];

export const localizedPublicRoutes = publicLanguageConfig.supportedLocales.flatMap(
  (locale) =>
    requiredPublicRoutes.map((path) => ({
      locale,
      basePath: path,
      path: localizePublicPath(locale, path),
    })),
);
