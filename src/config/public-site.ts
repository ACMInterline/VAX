export const publicBrand = {
  status: "temporary",
  name: "FabricCare Sofia",
  shortName: "FabricCare",
  descriptor: "On-site carpet and upholstery care",
  tagline: "Professional fabric care, where your furniture already lives.",
  location: "Sofia, Bulgaria",
  serviceArea: "Sofia city, with surrounding areas subject to availability",
  contact: {
    phone: {
      label: "Phone to be confirmed",
      href: null,
    },
    email: {
      label: "Email to be confirmed",
      href: null,
    },
  },
  operatingHours: {
    shortLabel: "Appointments intended from 06:00 to 22:00",
    detail:
      "Early-morning and evening appointments are intended to be available, subject to building rules, local requirements, job conditions and availability.",
  },
  primaryCta: {
    label: "Describe what needs care",
    href: "/request",
  },
  publicIdentityVerified: false,
} as const;

export const publicLanguageConfig = {
  renderedLocale: "en",
  supportedLocales: ["bg", "en"],
  plannedPrimaryLocale: "bg",
} as const;

export type PublicLocale =
  (typeof publicLanguageConfig.supportedLocales)[number];
