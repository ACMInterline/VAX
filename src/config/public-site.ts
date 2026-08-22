export const publicBrand = {
  status: "temporary",
  name: "FabricCare Sofia",
  shortName: "FabricCare",
  location: {
    city: "Sofia",
    countryCode: "BG",
  },
  contact: {
    phoneHref: null,
    emailHref: null,
  },
  intendedAppointmentWindow: {
    start: "06:00",
    end: "22:00",
  },
  publicIdentityVerified: false,
} as const;

export const publicLanguageConfig = {
  primaryLocale: "bg",
  secondaryLocale: "en",
  supportedLocales: ["bg", "en"],
  prefixes: {
    bg: "",
    en: "/en",
  },
  htmlLanguages: {
    bg: "bg",
    en: "en",
  },
  openGraphLocales: {
    bg: "bg_BG",
    en: "en_GB",
  },
} as const;

export type PublicLocale =
  (typeof publicLanguageConfig.supportedLocales)[number];

export function isPublicLocale(value: string): value is PublicLocale {
  return publicLanguageConfig.supportedLocales.some(
    (locale) => locale === value,
  );
}
