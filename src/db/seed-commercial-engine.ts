import { sql } from "drizzle-orm";
import type { Database } from "./client";
import {
  commercialConditionBands,
  developmentDurationModels,
  developmentPriceBooks,
  parkingPolicies,
  timingCategories,
  travelZones,
} from "@/modules/commercial-engine/development-config";
import {
  attelierDurationModels,
  attelierPriceBooks,
} from "@/modules/commercial-engine/attelier-config";
import type {
  BillingUnit,
  DurationRuleDefinition,
  PriceRuleDefinition,
} from "@/modules/commercial-engine/types";
import type { LocalizedReference } from "@/modules/service-catalogue/catalogue";
import * as commercialTables from "./schema/commercial-engine";
import * as catalogueTables from "./schema/service-catalogue";

const seededPriceBooks = [...developmentPriceBooks, ...attelierPriceBooks];
const seededDurationModels = [
  ...developmentDurationModels,
  ...attelierDurationModels,
];

function referenceRows(entries: readonly LocalizedReference[]) {
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
    throw new Error(`Required commercial reference code was not persisted: ${code}`);
  }
  return id;
}

function optionalId(
  ids: ReadonlyMap<string, number>,
  code: string | undefined,
): number | null {
  return code === undefined ? null : requiredId(ids, code);
}

function measurementModeCode(
  billingUnit: BillingUnit | undefined,
): "AREA_M2" | "PER_ITEM" | "PER_SEAT" | undefined {
  switch (billingUnit) {
    case "AREA_M2":
      return "AREA_M2";
    case "PER_SEAT":
      return "PER_SEAT";
    case "PER_ITEM":
    case "PER_SIDE":
      return "PER_ITEM";
    default:
      return undefined;
  }
}

export async function seedCommercialEngine(database: Database): Promise<void> {
  await database
    .insert(commercialTables.commercialConditionBands)
    .values(referenceRows(commercialConditionBands))
    .onConflictDoUpdate({
      target: commercialTables.commercialConditionBands.code,
      set: referenceUpdate,
    });
  await database
    .insert(commercialTables.parkingPolicies)
    .values(referenceRows(parkingPolicies))
    .onConflictDoUpdate({
      target: commercialTables.parkingPolicies.code,
      set: referenceUpdate,
    });
  await database
    .insert(commercialTables.timingCategories)
    .values(referenceRows(timingCategories))
    .onConflictDoUpdate({
      target: commercialTables.timingCategories.code,
      set: referenceUpdate,
    });

  const parkingPolicyIds = idMap(
    await database
      .select({
        id: commercialTables.parkingPolicies.id,
        code: commercialTables.parkingPolicies.code,
      })
      .from(commercialTables.parkingPolicies),
  );

  await database
    .insert(commercialTables.travelZones)
    .values(
      travelZones.map((zone) => ({
        ...referenceRows([zone])[0],
        defaultParkingPolicyId: requiredId(
          parkingPolicyIds,
          zone.defaultParkingPolicyCode,
        ),
        distanceThresholdHundredthsKm:
          zone.distanceThresholdKm === null
            ? null
            : Math.round(zone.distanceThresholdKm * 100),
        travelTimeThresholdMinutes: zone.travelTimeThresholdMinutes,
        boundaryNotes: zone.boundaryNotes,
      })),
    )
    .onConflictDoUpdate({
      target: commercialTables.travelZones.code,
      set: {
        ...referenceUpdate,
        defaultParkingPolicyId: sql`excluded."default_parking_policy_id"`,
        distanceThresholdHundredthsKm:
          sql`excluded."distance_threshold_hundredths_km"`,
        travelTimeThresholdMinutes:
          sql`excluded."travel_time_threshold_minutes"`,
        boundaryNotes: sql`excluded."boundary_notes"`,
      },
    });

  await database
    .insert(commercialTables.priceBooks)
    .values(
      seededPriceBooks.map((book) => ({
        code: book.code,
        name: book.name,
        currency: book.currency,
        market: book.market,
        customerSegment: book.customerSegment,
        version: book.version,
        status: book.status,
        effectiveFrom: null,
        effectiveUntil: null,
        vatMode: book.vatConfiguration.mode,
        priceBasis: book.priceBasis,
        defaultVatRateBasisPoints: book.vatConfiguration.rateBasisPoints,
        provisional: book.provisional,
        approvedForPublication: book.approvedForPublication,
        active: book.active,
      })),
    )
    .onConflictDoNothing({ target: commercialTables.priceBooks.code });

  await database
    .insert(commercialTables.durationModels)
    .values(
      seededDurationModels.map((model) => ({
        code: model.code,
        name: model.name,
        market: model.market,
        version: model.version,
        status: model.status,
        effectiveFrom: null,
        effectiveUntil: null,
        provisional: model.provisional,
        active: model.active,
      })),
    )
    .onConflictDoNothing({ target: commercialTables.durationModels.code });

  const [
    priceBookIds,
    durationModelIds,
    serviceIds,
    itemTypeIds,
    measurementModeIds,
    conditionBandIds,
    issueTypeIds,
    addonIds,
    riskFlagIds,
    travelZoneIds,
    timingCategoryIds,
    fibreMaterialIds,
    treatmentLevelIds,
  ] = await Promise.all([
    database
      .select({ id: commercialTables.priceBooks.id, code: commercialTables.priceBooks.code })
      .from(commercialTables.priceBooks)
      .then(idMap),
    database
      .select({ id: commercialTables.durationModels.id, code: commercialTables.durationModels.code })
      .from(commercialTables.durationModels)
      .then(idMap),
    database.select({ id: catalogueTables.services.id, code: catalogueTables.services.code }).from(catalogueTables.services).then(idMap),
    database.select({ id: catalogueTables.cleaningItemTypes.id, code: catalogueTables.cleaningItemTypes.code }).from(catalogueTables.cleaningItemTypes).then(idMap),
    database.select({ id: catalogueTables.measurementModes.id, code: catalogueTables.measurementModes.code }).from(catalogueTables.measurementModes).then(idMap),
    database.select({ id: commercialTables.commercialConditionBands.id, code: commercialTables.commercialConditionBands.code }).from(commercialTables.commercialConditionBands).then(idMap),
    database.select({ id: catalogueTables.issueTypes.id, code: catalogueTables.issueTypes.code }).from(catalogueTables.issueTypes).then(idMap),
    database.select({ id: catalogueTables.serviceAddons.id, code: catalogueTables.serviceAddons.code }).from(catalogueTables.serviceAddons).then(idMap),
    database.select({ id: catalogueTables.riskFlags.id, code: catalogueTables.riskFlags.code }).from(catalogueTables.riskFlags).then(idMap),
    database.select({ id: commercialTables.travelZones.id, code: commercialTables.travelZones.code }).from(commercialTables.travelZones).then(idMap),
    database.select({ id: commercialTables.timingCategories.id, code: commercialTables.timingCategories.code }).from(commercialTables.timingCategories).then(idMap),
    database.select({ id: catalogueTables.fibreMaterials.id, code: catalogueTables.fibreMaterials.code }).from(catalogueTables.fibreMaterials).then(idMap),
    database.select({ id: catalogueTables.treatmentLevels.id, code: catalogueTables.treatmentLevels.code }).from(catalogueTables.treatmentLevels).then(idMap),
  ]);

  const priceRuleRows = seededPriceBooks.flatMap((book) =>
    book.rules.map((rule: PriceRuleDefinition) => {
      const modeCode = measurementModeCode(rule.billingUnit);
      return {
        priceBookId: requiredId(priceBookIds, book.code),
        code: rule.id,
        ruleType: rule.type,
        label: rule.label,
        adjustmentKind: rule.adjustmentKind,
        serviceId: optionalId(serviceIds, rule.serviceCode),
        itemTypeId: optionalId(itemTypeIds, rule.itemTypeCode),
        measurementModeId: optionalId(measurementModeIds, modeCode),
        conditionBandId: optionalId(
          conditionBandIds,
          rule.conditionBandCode,
        ),
        issueTypeId: optionalId(issueTypeIds, rule.issueCode),
        addonId: optionalId(addonIds, rule.addonCode),
        suggestedAddonId: optionalId(addonIds, rule.suggestedAddonCode),
        riskFlagId: optionalId(riskFlagIds, rule.riskFlagCode),
        travelZoneId: optionalId(travelZoneIds, rule.travelZoneCode),
        timingCategoryId: optionalId(
          timingCategoryIds,
          rule.timingCategoryCode,
        ),
        billingUnit: rule.billingUnit ?? null,
        amountMinorUnits: rule.amountMinorUnits ?? null,
        percentageBasisPoints: rule.percentageBasisPoints ?? null,
        additionalSidePercentageBasisPoints:
          rule.additionalSidePercentageBasisPoints ?? null,
        measurementMinHundredths: rule.measurementMinHundredths ?? null,
        measurementMaxHundredths:
          rule.measurementMaxHundredths === undefined
            ? null
            : rule.measurementMaxHundredths,
        manualAssessmentRequired:
          rule.manualAssessmentRequired ?? false,
        declineOrReferRequired: rule.declineOrReferRequired ?? false,
        priority: rule.priority,
        active: rule.active,
        notes:
          rule.notes ??
          "Development-only provisional rule; not approved for publication.",
      };
    }),
  );

  if (priceRuleRows.length > 0) {
    await database
      .insert(commercialTables.priceRules)
      .values(priceRuleRows)
      .onConflictDoNothing({ target: commercialTables.priceRules.code });
  }

  const durationRuleRows = seededDurationModels.flatMap((model) =>
    model.rules.map((rule: DurationRuleDefinition) => ({
      durationModelId: requiredId(durationModelIds, model.code),
      code: rule.id,
      ruleType: rule.type,
      label: rule.label,
      serviceId: optionalId(serviceIds, rule.serviceCode),
      itemTypeId: optionalId(itemTypeIds, rule.itemTypeCode),
      conditionBandId: optionalId(conditionBandIds, rule.conditionBandCode),
      issueTypeId: optionalId(issueTypeIds, rule.issueCode),
      addonId: optionalId(addonIds, rule.addonCode),
      riskFlagId: optionalId(riskFlagIds, rule.riskFlagCode),
      fibreMaterialId: optionalId(fibreMaterialIds, rule.fibreMaterialCode),
      treatmentLevelId: optionalId(
        treatmentLevelIds,
        rule.treatmentLevelCode,
      ),
      billingUnit: rule.billingUnit ?? null,
      minutes: rule.minutes ?? null,
      multiplierBasisPoints: rule.multiplierBasisPoints ?? null,
      additionalSidePercentageBasisPoints:
        rule.additionalSidePercentageBasisPoints ?? null,
      productivityHundredthsM2PerHour:
        rule.productivityHundredthsM2PerHour ?? null,
      manualAssessmentRequired: rule.manualAssessmentRequired ?? false,
      declineOrReferRequired: rule.declineOrReferRequired ?? false,
      priority: rule.priority,
      active: rule.active,
      notes:
        rule.notes ??
        "Development-only provisional duration assumption; field validation required.",
    })),
  );

  if (durationRuleRows.length > 0) {
    await database
      .insert(commercialTables.durationRules)
      .values(durationRuleRows)
      .onConflictDoNothing({ target: commercialTables.durationRules.code });
  }
}
