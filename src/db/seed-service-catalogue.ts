import { sql } from "drizzle-orm";
import type { Database } from "./client";
import * as catalogue from "@/modules/service-catalogue/catalogue";
import * as tables from "./schema/service-catalogue";

function referenceRows(
  entries: readonly catalogue.LocalizedReference[],
) {
  return entries.map((entry) => ({
    code: entry.code,
    labelBg: entry.label.bg,
    labelEn: entry.label.en,
    descriptionBg: entry.description.bg,
    descriptionEn: entry.description.en,
    sortOrder: entry.sortOrder,
    active: entry.active,
  }));
}

const referenceUpdate = {
  labelBg: sql`excluded."label_bg"`,
  labelEn: sql`excluded."label_en"`,
  descriptionBg: sql`excluded."description_bg"`,
  descriptionEn: sql`excluded."description_en"`,
  sortOrder: sql`excluded."sort_order"`,
  active: sql`excluded."active"`,
  updatedAt: sql`now()`,
};

function idMap(rows: readonly { id: number; code: string }[]) {
  return new Map(rows.map((row) => [row.code, row.id]));
}

function requiredId(ids: ReadonlyMap<string, number>, code: string): number {
  const id = ids.get(code);
  if (id === undefined) {
    throw new Error(`Canonical reference code was not persisted: ${code}`);
  }
  return id;
}

export async function seedCanonicalServiceCatalogue(
  database: Database,
): Promise<void> {
  await database
    .insert(tables.serviceCategories)
    .values(referenceRows(catalogue.serviceCategories))
    .onConflictDoUpdate({
      target: tables.serviceCategories.code,
      set: referenceUpdate,
    });
  await database
    .insert(tables.measurementModes)
    .values(referenceRows(catalogue.measurementModes))
    .onConflictDoUpdate({
      target: tables.measurementModes.code,
      set: referenceUpdate,
    });
  await database
    .insert(tables.reuseAdvisoryCategories)
    .values(referenceRows(catalogue.reuseAdvisoryCategories))
    .onConflictDoUpdate({
      target: tables.reuseAdvisoryCategories.code,
      set: referenceUpdate,
    });
  await database
    .insert(tables.fibreMaterials)
    .values(referenceRows(catalogue.fibreMaterials))
    .onConflictDoUpdate({
      target: tables.fibreMaterials.code,
      set: referenceUpdate,
    });
  await database
    .insert(tables.surfaceConstructions)
    .values(referenceRows(catalogue.surfaceConstructions))
    .onConflictDoUpdate({
      target: tables.surfaceConstructions.code,
      set: referenceUpdate,
    });
  await database
    .insert(tables.conditionLevels)
    .values(referenceRows(catalogue.conditionLevels))
    .onConflictDoUpdate({
      target: tables.conditionLevels.code,
      set: referenceUpdate,
    });
  await database
    .insert(tables.issueHandlingClassifications)
    .values(referenceRows(catalogue.issueHandlingClassifications))
    .onConflictDoUpdate({
      target: tables.issueHandlingClassifications.code,
      set: referenceUpdate,
    });
  await database
    .insert(tables.riskFlags)
    .values(referenceRows(catalogue.riskFlags))
    .onConflictDoUpdate({
      target: tables.riskFlags.code,
      set: referenceUpdate,
    });
  await database
    .insert(tables.treatmentLevels)
    .values(
      catalogue.treatmentLevels.map((entry) => ({
        ...referenceRows([entry])[0],
        customerSelectable: entry.customerSelectable,
      })),
    )
    .onConflictDoUpdate({
      target: tables.treatmentLevels.code,
      set: {
        ...referenceUpdate,
        customerSelectable: sql`excluded."customer_selectable"`,
      },
    });
  await database
    .insert(tables.mechanicalActionLevels)
    .values(referenceRows(catalogue.mechanicalActionLevels))
    .onConflictDoUpdate({
      target: tables.mechanicalActionLevels.code,
      set: referenceUpdate,
    });
  await database
    .insert(tables.treatmentApproaches)
    .values(referenceRows(catalogue.treatmentApproaches))
    .onConflictDoUpdate({
      target: tables.treatmentApproaches.code,
      set: referenceUpdate,
    });
  await database
    .insert(tables.cleaningProductCategories)
    .values(referenceRows(catalogue.cleaningProductCategories))
    .onConflictDoUpdate({
      target: tables.cleaningProductCategories.code,
      set: referenceUpdate,
    });
  await database
    .insert(tables.serviceAddons)
    .values(referenceRows(catalogue.serviceAddons))
    .onConflictDoUpdate({
      target: tables.serviceAddons.code,
      set: referenceUpdate,
    });
  await database
    .insert(tables.capabilityStatuses)
    .values(referenceRows(catalogue.capabilityStatuses))
    .onConflictDoUpdate({
      target: tables.capabilityStatuses.code,
      set: referenceUpdate,
    });

  const categoryIds = idMap(
    await database
      .select({ id: tables.serviceCategories.id, code: tables.serviceCategories.code })
      .from(tables.serviceCategories),
  );
  const reuseAdvisoryIds = idMap(
    await database
      .select({
        id: tables.reuseAdvisoryCategories.id,
        code: tables.reuseAdvisoryCategories.code,
      })
      .from(tables.reuseAdvisoryCategories),
  );
  const issueHandlingIds = idMap(
    await database
      .select({
        id: tables.issueHandlingClassifications.id,
        code: tables.issueHandlingClassifications.code,
      })
      .from(tables.issueHandlingClassifications),
  );

  await database
    .insert(tables.services)
    .values(
      catalogue.services.map((entry) => ({
        ...referenceRows([entry])[0],
        categoryId: requiredId(categoryIds, entry.categoryCode),
        publicSlug: entry.publicSlug,
        baseSetupMinutes: entry.baseSetupMinutes,
        durationMinutesPerUnit: entry.durationMinutesPerUnit,
        complexityMultiplierEligible: entry.complexityMultiplierEligible,
        minimumServiceDurationMinutes: entry.minimumServiceDurationMinutes,
        inspectionRequired: entry.inspectionRequired,
        instantQuoteEligible: entry.instantQuoteEligible,
        reuseAdvisoryCategoryId: requiredId(
          reuseAdvisoryIds,
          entry.reuseAdvisoryCategoryCode,
        ),
      })),
    )
    .onConflictDoUpdate({
      target: tables.services.code,
      set: {
        ...referenceUpdate,
        categoryId: sql`excluded."category_id"`,
        publicSlug: sql`excluded."public_slug"`,
        baseSetupMinutes: sql`excluded."base_setup_minutes"`,
        durationMinutesPerUnit: sql`excluded."duration_minutes_per_unit"`,
        complexityMultiplierEligible:
          sql`excluded."complexity_multiplier_eligible"`,
        minimumServiceDurationMinutes:
          sql`excluded."minimum_service_duration_minutes"`,
        inspectionRequired: sql`excluded."inspection_required"`,
        instantQuoteEligible: sql`excluded."instant_quote_eligible"`,
        reuseAdvisoryCategoryId:
          sql`excluded."reuse_advisory_category_id"`,
      },
    });

  await database
    .insert(tables.cleaningItemTypes)
    .values(
      catalogue.cleaningItemTypes.map((entry) => ({
        ...referenceRows([entry])[0],
        categoryId: requiredId(categoryIds, entry.categoryCode),
      })),
    )
    .onConflictDoUpdate({
      target: tables.cleaningItemTypes.code,
      set: {
        ...referenceUpdate,
        categoryId: sql`excluded."category_id"`,
      },
    });

  await database
    .insert(tables.issueTypes)
    .values(
      catalogue.issueTypes.map((entry) => ({
        ...referenceRows([entry])[0],
        handlingClassificationId: requiredId(
          issueHandlingIds,
          entry.handlingClassificationCode,
        ),
      })),
    )
    .onConflictDoUpdate({
      target: tables.issueTypes.code,
      set: {
        ...referenceUpdate,
        handlingClassificationId:
          sql`excluded."handling_classification_id"`,
      },
    });

  const serviceIds = idMap(
    await database
      .select({ id: tables.services.id, code: tables.services.code })
      .from(tables.services),
  );
  const itemTypeIds = idMap(
    await database
      .select({ id: tables.cleaningItemTypes.id, code: tables.cleaningItemTypes.code })
      .from(tables.cleaningItemTypes),
  );
  const measurementModeIds = idMap(
    await database
      .select({ id: tables.measurementModes.id, code: tables.measurementModes.code })
      .from(tables.measurementModes),
  );
  const treatmentLevelIds = idMap(
    await database
      .select({ id: tables.treatmentLevels.id, code: tables.treatmentLevels.code })
      .from(tables.treatmentLevels),
  );
  const materialIds = idMap(
    await database
      .select({ id: tables.fibreMaterials.id, code: tables.fibreMaterials.code })
      .from(tables.fibreMaterials),
  );
  const addonIds = idMap(
    await database
      .select({ id: tables.serviceAddons.id, code: tables.serviceAddons.code })
      .from(tables.serviceAddons),
  );
  const statusIds = idMap(
    await database
      .select({ id: tables.capabilityStatuses.id, code: tables.capabilityStatuses.code })
      .from(tables.capabilityStatuses),
  );

  await database
    .insert(tables.cleaningItemTypeMeasurementModes)
    .values(
      catalogue.cleaningItemTypeMeasurementModes.map((entry) => ({
        itemTypeId: requiredId(itemTypeIds, entry.itemTypeCode),
        measurementModeId: requiredId(
          measurementModeIds,
          entry.measurementModeCode,
        ),
        isDefault: entry.isDefault,
      })),
    )
    .onConflictDoUpdate({
      target: [
        tables.cleaningItemTypeMeasurementModes.itemTypeId,
        tables.cleaningItemTypeMeasurementModes.measurementModeId,
      ],
      set: { isDefault: sql`excluded."is_default"`, updatedAt: sql`now()` },
    });

  await database
    .insert(tables.serviceItemCapabilities)
    .values(
      catalogue.serviceItemCapabilities.map((entry) => ({
        serviceId: requiredId(serviceIds, entry.serviceCode),
        itemTypeId: requiredId(itemTypeIds, entry.itemTypeCode),
        statusId: requiredId(statusIds, entry.statusCode),
        inspectionRequired: entry.inspectionRequired,
        instantQuoteEligible: entry.instantQuoteEligible,
      })),
    )
    .onConflictDoUpdate({
      target: [
        tables.serviceItemCapabilities.serviceId,
        tables.serviceItemCapabilities.itemTypeId,
      ],
      set: {
        statusId: sql`excluded."status_id"`,
        inspectionRequired: sql`excluded."inspection_required"`,
        instantQuoteEligible: sql`excluded."instant_quote_eligible"`,
        updatedAt: sql`now()`,
      },
    });

  await database
    .insert(tables.serviceTreatmentLevels)
    .values(
      catalogue.serviceTreatmentLevels.map((entry) => ({
        serviceId: requiredId(serviceIds, entry.serviceCode),
        treatmentLevelId: requiredId(
          treatmentLevelIds,
          entry.treatmentLevelCode,
        ),
        statusId: requiredId(statusIds, entry.statusCode),
      })),
    )
    .onConflictDoUpdate({
      target: [
        tables.serviceTreatmentLevels.serviceId,
        tables.serviceTreatmentLevels.treatmentLevelId,
      ],
      set: { statusId: sql`excluded."status_id"`, updatedAt: sql`now()` },
    });

  await database
    .insert(tables.materialTreatmentConsiderations)
    .values(
      catalogue.materialTreatmentConsiderations.map((entry) => ({
        materialId: requiredId(materialIds, entry.materialCode),
        treatmentLevelId: requiredId(
          treatmentLevelIds,
          entry.treatmentLevelCode,
        ),
        statusId: requiredId(statusIds, entry.statusCode),
        notesBg: entry.notes.bg,
        notesEn: entry.notes.en,
      })),
    )
    .onConflictDoUpdate({
      target: [
        tables.materialTreatmentConsiderations.materialId,
        tables.materialTreatmentConsiderations.treatmentLevelId,
      ],
      set: {
        statusId: sql`excluded."status_id"`,
        notesBg: sql`excluded."notes_bg"`,
        notesEn: sql`excluded."notes_en"`,
        updatedAt: sql`now()`,
      },
    });

  await database
    .insert(tables.serviceAddonCapabilities)
    .values(
      catalogue.serviceAddonCapabilities.map((entry) => ({
        serviceId: requiredId(serviceIds, entry.serviceCode),
        addonId: requiredId(addonIds, entry.addonCode),
        statusId: requiredId(statusIds, entry.statusCode),
      })),
    )
    .onConflictDoUpdate({
      target: [
        tables.serviceAddonCapabilities.serviceId,
        tables.serviceAddonCapabilities.addonId,
      ],
      set: { statusId: sql`excluded."status_id"`, updatedAt: sql`now()` },
    });
}
