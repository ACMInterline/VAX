import "server-only";

import { asc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { travelZones } from "@/db/schema/commercial-engine";
import {
  cleaningItemTypes,
  conditionLevels,
  fibreMaterials,
  issueTypes,
  riskFlags,
  surfaceConstructions,
} from "@/db/schema/service-catalogue";
import type { PreferredLocale } from "./types";

export type CustomerCrmReferenceOption = Readonly<{
  id: number;
  label: string;
}>;

export type CustomerCrmCatalogueOptions = Readonly<{
  itemTypes: readonly CustomerCrmReferenceOption[];
  fibreMaterials: readonly CustomerCrmReferenceOption[];
  surfaceConstructions: readonly CustomerCrmReferenceOption[];
  conditionLevels: readonly CustomerCrmReferenceOption[];
  issueTypes: readonly CustomerCrmReferenceOption[];
  riskFlags: readonly CustomerCrmReferenceOption[];
  serviceZones: readonly CustomerCrmReferenceOption[];
}>;

/**
 * Reads the persisted canonical IDs used by CRM records. The adapter remains
 * server-only so form code receives options without gaining database access.
 */
export async function getCustomerCrmCatalogueOptions(
  database: Database,
  locale: PreferredLocale,
): Promise<CustomerCrmCatalogueOptions> {
  const [
    itemTypes,
    materials,
    constructions,
    conditions,
    issues,
    risks,
    zones,
  ] = await Promise.all([
    database
      .select({
        id: cleaningItemTypes.id,
        label:
          locale === "en"
            ? cleaningItemTypes.labelEn
            : cleaningItemTypes.labelBg,
      })
      .from(cleaningItemTypes)
      .where(eq(cleaningItemTypes.active, true))
      .orderBy(
        asc(cleaningItemTypes.sortOrder),
        asc(cleaningItemTypes.code),
        asc(cleaningItemTypes.id),
      ),
    database
      .select({
        id: fibreMaterials.id,
        label:
          locale === "en" ? fibreMaterials.labelEn : fibreMaterials.labelBg,
      })
      .from(fibreMaterials)
      .where(eq(fibreMaterials.active, true))
      .orderBy(
        asc(fibreMaterials.sortOrder),
        asc(fibreMaterials.code),
        asc(fibreMaterials.id),
      ),
    database
      .select({
        id: surfaceConstructions.id,
        label:
          locale === "en"
            ? surfaceConstructions.labelEn
            : surfaceConstructions.labelBg,
      })
      .from(surfaceConstructions)
      .where(eq(surfaceConstructions.active, true))
      .orderBy(
        asc(surfaceConstructions.sortOrder),
        asc(surfaceConstructions.code),
        asc(surfaceConstructions.id),
      ),
    database
      .select({
        id: conditionLevels.id,
        label:
          locale === "en" ? conditionLevels.labelEn : conditionLevels.labelBg,
      })
      .from(conditionLevels)
      .where(eq(conditionLevels.active, true))
      .orderBy(
        asc(conditionLevels.sortOrder),
        asc(conditionLevels.code),
        asc(conditionLevels.id),
      ),
    database
      .select({
        id: issueTypes.id,
        label: locale === "en" ? issueTypes.labelEn : issueTypes.labelBg,
      })
      .from(issueTypes)
      .where(eq(issueTypes.active, true))
      .orderBy(
        asc(issueTypes.sortOrder),
        asc(issueTypes.code),
        asc(issueTypes.id),
      ),
    database
      .select({
        id: riskFlags.id,
        label: locale === "en" ? riskFlags.labelEn : riskFlags.labelBg,
      })
      .from(riskFlags)
      .where(eq(riskFlags.active, true))
      .orderBy(
        asc(riskFlags.sortOrder),
        asc(riskFlags.code),
        asc(riskFlags.id),
      ),
    database
      .select({
        id: travelZones.id,
        label: locale === "en" ? travelZones.labelEn : travelZones.labelBg,
      })
      .from(travelZones)
      .where(eq(travelZones.active, true))
      .orderBy(
        asc(travelZones.sortOrder),
        asc(travelZones.code),
        asc(travelZones.id),
      ),
  ]);

  return {
    itemTypes,
    fibreMaterials: materials,
    surfaceConstructions: constructions,
    conditionLevels: conditions,
    issueTypes: issues,
    riskFlags: risks,
    serviceZones: zones,
  };
}
