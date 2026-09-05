import { describe, expect, it } from "vitest";
import { publicBrand, publicLanguageConfig } from "@/config/public-site";
import { getPublicContent, getService } from ".";
import {
  forbiddenPublishedClaimPatterns,
  marketingClaimRegistry,
  unpublishedEvidencePatterns,
} from "./claims";
import {
  getLanguageSwitchHref,
  localizedPublicRoutes,
  requiredPublicRoutes,
  serviceSlugs,
} from "./routes";
import {
  getCanonicalServiceByPublicSlug,
  getCatalogueLabel,
  treatmentLevels,
} from "@/modules/service-catalogue/catalogue";

const expectedRoutes = [
  "/",
  "/services",
  "/services/carpet-cleaning",
  "/services/rug-cleaning",
  "/services/sofa-upholstery-cleaning",
  "/services/mattress-cleaning",
  "/services/office-carpet-cleaning",
  "/services/delicate-fabric-care",
  "/how-it-works",
  "/why-professional-cleaning",
  "/service-area",
  "/about",
  "/faq",
  "/contact",
  "/request",
] as const;

describe("public-site localization architecture", () => {
  it("uses the final ATTELIER identity without leaking superseded customer brands", () => {
    const publishedCopy = JSON.stringify({
      bg: getPublicContent("bg"),
      en: getPublicContent("en"),
    });

    expect(publicBrand).toMatchObject({
      status: "final",
      name: "ATTELIER",
      shortName: "ATTELIER",
    });
    expect(getPublicContent("bg").common.brand.descriptor).toBe(
      "Професионална грижа за текстила",
    );
    expect(getPublicContent("en").common.brand.descriptor).toBe("Textile Care");
    expect(publishedCopy).not.toMatch(/FabricCare|VAX portal|VAX портал/);
    expect(publishedCopy).not.toMatch(/[™®]/u);
  });

  it("keeps the internal planning rate out of all customer-visible copy", () => {
    const publishedCopy = JSON.stringify({
      bg: getPublicContent("bg"),
      en: getPublicContent("en"),
    });

    expect(publishedCopy).not.toMatch(/(?:23|25)\s*m²/iu);
    expect(publishedCopy).not.toMatch(/(?:23|25)\s*м²/iu);
  });

  it("makes Bulgarian primary and retains English as the secondary locale", () => {
    expect(publicLanguageConfig.primaryLocale).toBe("bg");
    expect(publicLanguageConfig.secondaryLocale).toBe("en");
    expect(getPublicContent().locale).toBe("bg");
    expect(getPublicContent("en").locale).toBe("en");
  });

  it("publishes equivalent Bulgarian and English route coverage", () => {
    expect(requiredPublicRoutes).toEqual(expectedRoutes);
    expect(localizedPublicRoutes).toHaveLength(expectedRoutes.length * 2);

    const bulgarianRoutes = localizedPublicRoutes
      .filter((route) => route.locale === "bg")
      .map((route) => route.path);
    const englishRoutes = localizedPublicRoutes
      .filter((route) => route.locale === "en")
      .map((route) => route.path);

    expect(bulgarianRoutes).toEqual(expectedRoutes);
    expect(englishRoutes).toEqual(
      expectedRoutes.map((path) => (path === "/" ? "/en" : `/en${path}`)),
    );
  });

  it("preserves the corresponding page when switching languages", () => {
    expect(getLanguageSwitchHref("en", "/services/rug-cleaning")).toBe(
      "/en/services/rug-cleaning",
    );
    expect(getLanguageSwitchHref("bg", "/en/services/rug-cleaning")).toBe(
      "/services/rug-cleaning",
    );
    expect(getLanguageSwitchHref("bg", "/en")).toBe("/");
    expect(getLanguageSwitchHref("en", "/unknown")).toBe("/en");
  });

  it("backs every service route with substantial content in both locales", () => {
    for (const locale of publicLanguageConfig.supportedLocales) {
      for (const slug of serviceSlugs) {
        const service = getService(locale, slug);

        expect(service).toBeDefined();
        expect(service?.process.length).toBeGreaterThanOrEqual(4);
        expect(service?.limitations.length).toBeGreaterThanOrEqual(3);
        expect(service?.related.length).toBeGreaterThanOrEqual(2);
        expect(service?.catalogueCode).toBe(
          getCanonicalServiceByPublicSlug(slug)?.code,
        );
      }
    }
  });

  it("keeps every navigation destination inside the base route map", () => {
    for (const locale of publicLanguageConfig.supportedLocales) {
      const navigation = getPublicContent(locale).navigation;
      const destinations = [
        ...navigation.primary.map((link) => link.href),
        ...navigation.serviceLinks.map((link) => link.href),
      ];

      for (const destination of destinations) {
        expect(requiredPublicRoutes).toContain(destination);
      }
    }
  });

  it("provides the required Bulgarian treatment model and FAQ coverage", () => {
    const content = getPublicContent("bg");

    expect(content.treatmentLevels.map((level) => level.name)).toEqual([
      "Деликатна грижа",
      "Освежаване",
      "Стандартно дълбоко почистване",
      "Интензивна обработка",
      "Възстановителна / специализирана грижа",
    ]);
    expect(content.faqs).toHaveLength(12);
    expect(content.faqs.map((faq) => faq.question)).toContain(
      "Вземате ли килимите за пране?",
    );
    expect(content.faqs.map((faq) => faq.question)).toContain(
      "Подходяща ли е услугата за домакинства, които обръщат специално внимание на прах и алергени?",
    );
  });

  it("aligns localized treatment presentation with canonical identities", () => {
    for (const locale of publicLanguageConfig.supportedLocales) {
      const publicTreatmentLevels = getPublicContent(locale).treatmentLevels;

      expect(publicTreatmentLevels.map((level) => level.catalogueCode)).toEqual(
        treatmentLevels.map((level) => level.code),
      );
      expect(publicTreatmentLevels.map((level) => level.name)).toEqual(
        treatmentLevels.map((level) => getCatalogueLabel(level, locale)),
      );
    }
  });
});

describe("public claim authority", () => {
  const publishedCopy = JSON.stringify({
    bg: getPublicContent("bg"),
    en: getPublicContent("en"),
  });

  it("supports every reviewed claim-authority status", () => {
    expect(
      [...new Set(marketingClaimRegistry.map((claim) => claim.status))].sort(),
    ).toEqual(
      [
        "verified",
        "qualified",
        "manufacturer_evidence_required",
        "legal_verification_required",
        "prohibited",
      ].sort(),
    );
  });

  it("does not publish unsupported medical or absolute cleaning claims", () => {
    for (const forbiddenPattern of forbiddenPublishedClaimPatterns) {
      expect(publishedCopy).not.toMatch(forbiddenPattern);
    }
  });

  it("withholds manufacturer, acoustic and product-performance evidence claims", () => {
    for (const evidencePattern of unpublishedEvidencePatterns) {
      expect(publishedCopy).not.toMatch(evidencePattern);
    }

    for (const claim of marketingClaimRegistry) {
      if (
        claim.status === "manufacturer_evidence_required" ||
        claim.status === "legal_verification_required" ||
        claim.status === "prohibited"
      ) {
        expect(claim.publicationWording).toBeNull();
      }
    }
  });

  it("does not invent commercial proof", () => {
    const fabricatedProofPatterns = [
      /\b5[- ]star\b/i,
      /\baward[- ]winning\b/i,
      /\bthousands of customers\b/i,
      /\bcertified by\b/i,
      /хиляди клиенти/iu,
      /награждаван/iu,
    ];

    for (const pattern of fabricatedProofPatterns) {
      expect(publishedCopy).not.toMatch(pattern);
    }
  });
});
