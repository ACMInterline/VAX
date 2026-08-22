import { describe, expect, it } from "vitest";
import { getPublicContent, getService } from ".";
import { forbiddenPublishedClaimPatterns } from "./claims";
import { requiredPublicRoutes, serviceSlugs } from "./routes";

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

describe("public-site content architecture", () => {
  it("publishes the complete Phase 1 route map without thin extra routes", () => {
    expect(requiredPublicRoutes).toEqual(expectedRoutes);
  });

  it("backs every service route with substantial structured content", () => {
    for (const slug of serviceSlugs) {
      const service = getService(slug);

      expect(service).toBeDefined();
      expect(service?.process.length).toBeGreaterThanOrEqual(4);
      expect(service?.limitations.length).toBeGreaterThanOrEqual(3);
      expect(service?.related.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("keeps every configured navigation destination inside the route map", () => {
    const navigation = getPublicContent().navigation;
    const destinations = [
      ...navigation.primary.map((link) => link.href),
      ...navigation.serviceLinks.map((link) => link.href),
    ];

    for (const destination of destinations) {
      expect(requiredPublicRoutes).toContain(destination);
    }
  });

  it("does not publish unsupported medical or absolute cleaning claims", () => {
    const publishedCopy = JSON.stringify(getPublicContent());

    for (const forbiddenPattern of forbiddenPublishedClaimPatterns) {
      expect(publishedCopy).not.toMatch(forbiddenPattern);
    }
  });

  it("does not invent commercial proof", () => {
    const publishedCopy = JSON.stringify(getPublicContent());
    const fabricatedProofPatterns = [
      /\b5[- ]star\b/i,
      /\baward[- ]winning\b/i,
      /\bthousands of customers\b/i,
      /\bcertified by\b/i,
    ];

    for (const pattern of fabricatedProofPatterns) {
      expect(publishedCopy).not.toMatch(pattern);
    }
  });
});
