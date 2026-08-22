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

export const publicRouteMap = requiredPublicRoutes.map((path) => ({
  path,
  changeFrequency: path === "/" ? "weekly" : "monthly",
  priority: path === "/" ? 1 : path === "/request" ? 0.9 : 0.7,
})) as readonly {
  path: PublicPath;
  changeFrequency: "weekly" | "monthly";
  priority: number;
}[];
