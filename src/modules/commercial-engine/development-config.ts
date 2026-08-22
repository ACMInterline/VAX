import {
  riskFlags,
  type CleaningItemTypeCode,
  type IssueTypeCode,
  type LocalizedReference,
  type RiskFlagCode,
  type ServiceAddonCode,
} from "@/modules/service-catalogue/catalogue";
import type {
  AdjustmentKind,
  BillingUnit,
  DurationModelDefinition,
  DurationRuleDefinition,
  ParkingPolicyCode,
  PriceBookDefinition,
  PriceRuleDefinition,
  TimingCategoryCode,
  TravelZoneCode,
} from "./types";

function reference<const Code extends string>(
  code: Code,
  sortOrder: number,
  labelBg: string,
  labelEn: string,
  descriptionBg: string,
  descriptionEn: string,
): LocalizedReference<Code> {
  return {
    code,
    label: { bg: labelBg, en: labelEn },
    description: { bg: descriptionBg, en: descriptionEn },
    sortOrder,
    active: true,
  };
}

export const commercialConditionBands = [
  reference(
    "NORMAL",
    10,
    "Нормална сложност",
    "Normal complexity",
    "Стандартна търговска сложност; не предписва техническа обработка.",
    "Standard commercial complexity; it does not prescribe treatment.",
  ),
  reference(
    "ENHANCED",
    20,
    "Повишена сложност",
    "Enhanced complexity",
    "Допълнителен измерим обхват след потвърждение, отделно от техническото ниво.",
    "Additional measurable scope after confirmation, separate from treatment level.",
  ),
  reference(
    "INTENSIVE",
    30,
    "Висока сложност",
    "Intensive complexity",
    "Съществено по-висока търговска сложност, която остава предмет на оценка.",
    "Materially higher commercial complexity that remains assessment-led.",
  ),
  reference(
    "ASSESSMENT_REQUIRED",
    40,
    "Необходима е оценка",
    "Assessment required",
    "Не се изчислява автоматична крайна цена или продължителност.",
    "No automatic final price or duration is calculated.",
  ),
] as const;

export const parkingPolicies = [
  reference(
    "PARKING_INCLUDED",
    10,
    "Паркирането е включено",
    "Parking included",
    "Паркирането е включено само когато изрично е одобрено в търговското правило.",
    "Parking is included only when the commercial rule explicitly approves it.",
  ),
  reference(
    "PARKING_PASS_THROUGH",
    20,
    "Паркирането се прехвърля по действителен разход",
    "Parking passed through",
    "Действителният одобрен разход за паркиране се третира отделно.",
    "An approved actual parking cost is treated separately.",
  ),
  reference(
    "PARKING_ESTIMATED",
    30,
    "Прогнозно паркиране",
    "Estimated parking",
    "Прогнозен разход, който изисква потвърждение.",
    "An estimated cost that requires confirmation.",
  ),
  reference(
    "PARKING_CUSTOM",
    40,
    "Индивидуално решение за паркиране",
    "Custom parking decision",
    "Политиката се определя за конкретния адрес или договор.",
    "Policy is determined for the specific address or agreement.",
  ),
] as const;

export type TravelZoneDefinition = LocalizedReference<TravelZoneCode> &
  Readonly<{
    defaultParkingPolicyCode: ParkingPolicyCode;
    distanceThresholdKm: number | null;
    travelTimeThresholdMinutes: number | null;
    boundaryNotes: string | null;
  }>;

export const travelZones = [
  {
    ...reference(
      "SOFIA_CORE",
      10,
      "Основна зона София",
      "Sofia core",
      "Развиваща зона без отделна такса над минималното посещение.",
      "Development zone with no separate fee above the minimum visit.",
    ),
    defaultParkingPolicyCode: "PARKING_PASS_THROUGH",
    distanceThresholdKm: null,
    travelTimeThresholdMinutes: null,
    boundaryNotes: null,
  },
  {
    ...reference(
      "SOFIA_EXTENDED",
      20,
      "Разширена зона София",
      "Sofia extended",
      "Границите и евентуалното по-високо минимално посещение още не са одобрени.",
      "Boundaries and any higher minimum visit are not yet approved.",
    ),
    defaultParkingPolicyCode: "PARKING_PASS_THROUGH",
    distanceThresholdKm: null,
    travelTimeThresholdMinutes: null,
    boundaryNotes: null,
  },
  {
    ...reference(
      "SOFIA_OUTSKIRTS",
      30,
      "Покрайнини на София",
      "Sofia outskirts",
      "Изисква конфигурирана добавка след одобряване на граници.",
      "Requires a configured adjustment after boundaries are approved.",
    ),
    defaultParkingPolicyCode: "PARKING_PASS_THROUGH",
    distanceThresholdKm: null,
    travelTimeThresholdMinutes: null,
    boundaryNotes: null,
  },
  {
    ...reference(
      "OUTSIDE_SOFIA",
      40,
      "Извън София",
      "Outside Sofia",
      "Винаги изисква индивидуална търговска и оперативна оценка.",
      "Always requires individual commercial and operational assessment.",
    ),
    defaultParkingPolicyCode: "PARKING_PASS_THROUGH",
    distanceThresholdKm: null,
    travelTimeThresholdMinutes: null,
    boundaryNotes: null,
  },
] as const satisfies readonly TravelZoneDefinition[];

export const timingCategories = [
  reference("STANDARD", 10, "Стандартен час", "Standard timing", "Стандартна категория без автоматична корекция.", "Standard category without an automatic adjustment."),
  reference("EARLY_MORNING", 20, "Рано сутрин", "Early morning", "Бъдеща категория; няма активна добавка.", "Future category; no adjustment is active."),
  reference("EVENING", 30, "Вечер", "Evening", "Бъдеща категория; няма активна добавка.", "Future category; no adjustment is active."),
  reference("WEEKEND", 40, "Уикенд", "Weekend", "Бъдеща категория; няма активна добавка.", "Future category; no adjustment is active."),
  reference("URGENT", 50, "Спешно", "Urgent", "Бъдеща категория; няма активна добавка.", "Future category; no adjustment is active."),
] as const;

const pricedItems = [
  ["SOFA_2_SEAT", 4_000, "PER_ITEM"],
  ["SOFA_3_SEAT", 4_900, "PER_ITEM"],
  ["SOFA_4_PLUS", 6_000, "PER_ITEM"],
  ["SOFA_CORNER", 7_900, "PER_ITEM"],
  ["SOFA_BED", 5_500, "PER_ITEM"],
  ["ARMCHAIR", 2_000, "PER_ITEM"],
  ["DINING_CHAIR_UPHOLSTERED", 800, "PER_ITEM"],
  ["OFFICE_CHAIR_UPHOLSTERED", 900, "PER_ITEM"],
  ["OTTOMAN", 1_500, "PER_ITEM"],
  ["MATTRESS_SINGLE", 2_300, "PER_SIDE"],
  ["MATTRESS_DOUBLE", 3_400, "PER_SIDE"],
  ["MATTRESS_KING_OR_LARGE", 4_000, "PER_SIDE"],
  ["MATTRESS_CHILD", 1_800, "PER_SIDE"],
] as const satisfies readonly [CleaningItemTypeCode, number, BillingUnit][];

const manualItemRules = [
  ["SOFA_U_SHAPED", "SOFIA_RESIDENTIAL_V1_SOFA_U_SHAPED_ASSESS"],
  ["BENCH_UPHOLSTERED", "SOFIA_RESIDENTIAL_V1_BENCH_ASSESS"],
  ["HEADBOARD", "SOFIA_RESIDENTIAL_V1_HEADBOARD_ASSESS"],
] as const satisfies readonly [CleaningItemTypeCode, string][];

const itemPriceRules = pricedItems.map(
  ([itemTypeCode, amountMinorUnits, billingUnit], index) =>
    ({
      id: `SOFIA_RESIDENTIAL_V1_${itemTypeCode}`,
      type: "BASE_ITEM",
      label: `Provisional ${itemTypeCode} base`,
      adjustmentKind: "RATE_PER_UNIT",
      active: true,
      priority: 100 + index,
      serviceCode: itemTypeCode.startsWith("MATTRESS_")
        ? "MATTRESS_CARE"
        : "UPHOLSTERY_CARE",
      itemTypeCode,
      billingUnit,
      amountMinorUnits,
    }) satisfies PriceRuleDefinition,
);

const manualPriceRules = manualItemRules.map(
  ([itemTypeCode, id], index) =>
    ({
      id,
      type: "CUSTOM_ASSESSMENT",
      label: `${itemTypeCode} requires assessment`,
      adjustmentKind: "MANUAL_ASSESSMENT",
      active: true,
      priority: 200 + index,
      serviceCode: "UPHOLSTERY_CARE",
      itemTypeCode,
      manualAssessmentRequired: true,
    }) satisfies PriceRuleDefinition,
);

const areaPriceRules = [
  {
    id: "SOFIA_RESIDENTIAL_V1_CARPET_AREA_0001_3000",
    type: "PER_AREA_M2",
    label: "Fitted carpet 0.01–30.00 m² selected-band rate",
    adjustmentKind: "RATE_PER_UNIT",
    active: true,
    priority: 300,
    serviceCode: "CARPET_CARE",
    itemTypeCode: "CARPET_FIXED",
    billingUnit: "AREA_M2",
    amountMinorUnits: 360,
    measurementMinHundredths: 1,
    measurementMaxHundredths: 3_000,
  },
  {
    id: "SOFIA_RESIDENTIAL_V1_CARPET_AREA_3001_8000",
    type: "PER_AREA_M2",
    label: "Fitted carpet 30.01–80.00 m² selected-band rate",
    adjustmentKind: "RATE_PER_UNIT",
    active: true,
    priority: 301,
    serviceCode: "CARPET_CARE",
    itemTypeCode: "CARPET_FIXED",
    billingUnit: "AREA_M2",
    amountMinorUnits: 300,
    measurementMinHundredths: 3_001,
    measurementMaxHundredths: 8_000,
  },
  {
    id: "SOFIA_RESIDENTIAL_V1_CARPET_AREA_8001_PLUS",
    type: "PER_AREA_M2",
    label: "Fitted carpet 80.01+ m² selected-band rate",
    adjustmentKind: "RATE_PER_UNIT",
    active: true,
    priority: 302,
    serviceCode: "CARPET_CARE",
    itemTypeCode: "CARPET_FIXED",
    billingUnit: "AREA_M2",
    amountMinorUnits: 260,
    measurementMinHundredths: 8_001,
    measurementMaxHundredths: null,
  },
] as const satisfies readonly PriceRuleDefinition[];

const conditionPriceRules = [
  ["NORMAL", 0, false],
  ["ENHANCED", 1_500, false],
  ["INTENSIVE", 3_000, false],
  ["ASSESSMENT_REQUIRED", 0, true],
] as const;

const issuePolicies = [
  ["GENERAL_SOIL", "NONE"],
  ["DUST_ACCUMULATION", "NONE"],
  ["FOOD_DRINK", "NONE"],
  ["COFFEE_TEA", "SUGGEST_ADD_ON", "STAIN_TARGETING"],
  ["WINE", "SUGGEST_ADD_ON", "STAIN_TARGETING"],
  ["GREASE_OIL", "MANUAL_ASSESSMENT"],
  ["MUD", "NONE"],
  ["PET_RELATED", "MANUAL_ASSESSMENT"],
  ["URINE_SUSPECTED", "MANUAL_ASSESSMENT"],
  ["ODOUR", "SUGGEST_ADD_ON", "ODOUR_TREATMENT"],
  ["COSMETICS", "MANUAL_ASSESSMENT"],
  ["INK", "MANUAL_ASSESSMENT"],
  ["BLOOD_OR_BIOLOGICAL", "DECLINE_OR_REFER"],
  ["UNKNOWN_STAIN", "MANUAL_ASSESSMENT"],
  ["OLD_STAIN", "MANUAL_ASSESSMENT"],
  ["COLOUR_TRANSFER", "MANUAL_ASSESSMENT"],
  ["CHEWING_GUM", "MANUAL_ASSESSMENT"],
  ["WAX", "MANUAL_ASSESSMENT"],
  ["OTHER", "MANUAL_ASSESSMENT"],
] as const satisfies readonly [
  IssueTypeCode,
  AdjustmentKind,
  ServiceAddonCode?,
][];

const addonCodes = [
  "STAIN_TARGETING",
  "ODOUR_TREATMENT",
  "ADDITIONAL_EXTRACTION",
  "DELICATE_MATERIAL_ASSESSMENT",
] as const satisfies readonly ServiceAddonCode[];

const travelRulePolicies = [
  ["SOFIA_CORE", "NONE", false],
  ["SOFIA_EXTENDED", "MANUAL_ASSESSMENT", true],
  ["SOFIA_OUTSKIRTS", "MANUAL_ASSESSMENT", true],
  ["OUTSIDE_SOFIA", "MANUAL_ASSESSMENT", true],
] as const satisfies readonly [TravelZoneCode, AdjustmentKind, boolean][];

const priceRules = [
  ...itemPriceRules,
  ...manualPriceRules,
  ...areaPriceRules,
  {
    id: "SOFIA_RESIDENTIAL_V1_MINIMUM_VISIT",
    type: "MINIMUM_VISIT",
    label: "Provisional residential minimum visit",
    adjustmentKind: "FIXED",
    active: true,
    priority: 400,
    amountMinorUnits: 4_900,
  },
  ...conditionPriceRules.map(
    ([conditionBandCode, percentageBasisPoints, manual], index) =>
      ({
        id: `SOFIA_RESIDENTIAL_V1_CONDITION_${conditionBandCode}`,
        type: "CONDITION_MODIFIER",
        label: `${conditionBandCode} commercial complexity`,
        adjustmentKind: manual ? "MANUAL_ASSESSMENT" : "PERCENTAGE",
        active: true,
        priority: 500 + index,
        conditionBandCode,
        percentageBasisPoints,
        manualAssessmentRequired: manual,
      }) satisfies PriceRuleDefinition,
  ),
  ...issuePolicies.map(
    ([issueCode, adjustmentKind, suggestedAddonCode], index) =>
      ({
        id: `SOFIA_RESIDENTIAL_V1_ISSUE_${issueCode}`,
        type: "ISSUE_MODIFIER",
        label: `${issueCode} issue policy`,
        adjustmentKind,
        active: true,
        priority: 600 + index,
        issueCode,
        suggestedAddonCode,
        manualAssessmentRequired:
          adjustmentKind !== "NONE",
        declineOrReferRequired: adjustmentKind === "DECLINE_OR_REFER",
      }) satisfies PriceRuleDefinition,
  ),
  ...addonCodes.map(
    (addonCode, index) =>
      ({
        id: `SOFIA_RESIDENTIAL_V1_ADDON_${addonCode}`,
        type: "ADD_ON",
        label: `${addonCode} requires a confirmed scope`,
        adjustmentKind: "MANUAL_ASSESSMENT",
        active: true,
        priority: 700 + index,
        addonCode,
        manualAssessmentRequired: true,
      }) satisfies PriceRuleDefinition,
  ),
  ...riskFlags.map(
    (riskFlag, index) =>
      ({
        id: `SOFIA_RESIDENTIAL_V1_RISK_${riskFlag.code}`,
        type: "CUSTOM_ASSESSMENT",
        label: `${riskFlag.code} assessment flag`,
        adjustmentKind: "MANUAL_ASSESSMENT",
        active: true,
        priority: 800 + index,
        riskFlagCode: riskFlag.code,
        manualAssessmentRequired: true,
      }) satisfies PriceRuleDefinition,
  ),
  ...travelRulePolicies.map(
    ([travelZoneCode, adjustmentKind, manual], index) =>
      ({
        id: `SOFIA_RESIDENTIAL_V1_TRAVEL_${travelZoneCode}`,
        type: "TRAVEL_ZONE",
        label: `${travelZoneCode} travel policy`,
        adjustmentKind,
        active: true,
        priority: 900 + index,
        travelZoneCode,
        manualAssessmentRequired: manual,
      }) satisfies PriceRuleDefinition,
  ),
  ...(["STANDARD", "EARLY_MORNING", "EVENING", "WEEKEND", "URGENT"] as const satisfies readonly TimingCategoryCode[]).map(
    (timingCategoryCode, index) =>
      ({
        id: `SOFIA_RESIDENTIAL_V1_TIMING_${timingCategoryCode}`,
        type: "TIMING_MODIFIER",
        label: `${timingCategoryCode} timing policy`,
        adjustmentKind: "NONE",
        active: false,
        priority: 1_000 + index,
        timingCategoryCode,
        percentageBasisPoints: 0,
      }) satisfies PriceRuleDefinition,
  ),
] as const satisfies readonly PriceRuleDefinition[];

export const residentialDraftPriceBook = {
  id: "SOFIA_RESIDENTIAL_V1_DRAFT",
  code: "SOFIA_RESIDENTIAL_V1_DRAFT",
  name: "Sofia residential provisional development book v1",
  currency: "EUR",
  market: "SOFIA",
  customerSegment: "RESIDENTIAL",
  version: 1,
  status: "DRAFT",
  effectiveFrom: null,
  effectiveUntil: null,
  priceBasis: "GROSS",
  vatConfiguration: {
    mode: "VAT_REGISTERED",
    rateBasisPoints: 2_000,
  },
  provisional: true,
  approvedForPublication: false,
  active: false,
  rules: priceRules,
} as const satisfies PriceBookDefinition;

export const b2bDraftPriceBook = {
  id: "SOFIA_B2B_V1_DRAFT",
  code: "SOFIA_B2B_V1_DRAFT",
  name: "Sofia B2B provisional development book v1",
  currency: "EUR",
  market: "SOFIA",
  customerSegment: "B2B",
  version: 1,
  status: "DRAFT",
  effectiveFrom: null,
  effectiveUntil: null,
  priceBasis: "NET",
  vatConfiguration: {
    mode: "VAT_REGISTERED",
    rateBasisPoints: 2_000,
  },
  provisional: true,
  approvedForPublication: false,
  active: false,
  rules: [],
} as const satisfies PriceBookDefinition;

export const developmentPriceBooks = [
  residentialDraftPriceBook,
  b2bDraftPriceBook,
] as const satisfies readonly PriceBookDefinition[];

const durationItemValues = [
  ["SOFA_2_SEAT", 35, "PER_ITEM"],
  ["SOFA_3_SEAT", 45, "PER_ITEM"],
  ["SOFA_4_PLUS", 55, "PER_ITEM"],
  ["SOFA_CORNER", 70, "PER_ITEM"],
  ["SOFA_U_SHAPED", 90, "PER_ITEM"],
  ["SOFA_BED", 55, "PER_ITEM"],
  ["ARMCHAIR", 20, "PER_ITEM"],
  ["DINING_CHAIR_UPHOLSTERED", 8, "PER_ITEM"],
  ["OFFICE_CHAIR_UPHOLSTERED", 10, "PER_ITEM"],
  ["OTTOMAN", 12, "PER_ITEM"],
  ["MATTRESS_SINGLE", 25, "PER_SIDE"],
  ["MATTRESS_DOUBLE", 35, "PER_SIDE"],
  ["MATTRESS_KING_OR_LARGE", 40, "PER_SIDE"],
  ["MATTRESS_CHILD", 20, "PER_SIDE"],
] as const satisfies readonly [CleaningItemTypeCode, number, BillingUnit][];

const areaDurationItems = [
  ["CARPET_FIXED", "CARPET_CARE"],
  ["RUG", "RUG_RUNNER_CARE"],
  ["RUNNER", "RUG_RUNNER_CARE"],
  ["OFFICE_CARPET", "COMMERCIAL_TEXTILE_CARE"],
] as const;

const durationRules = [
  {
    id: "SOFIA_OPERATIONS_V1_SETUP",
    type: "JOB_SETUP",
    label: "Setup allowance",
    active: true,
    priority: 10,
    minutes: 10,
  },
  {
    id: "SOFIA_OPERATIONS_V1_INSPECTION",
    type: "JOB_INSPECTION",
    label: "Initial inspection allowance",
    active: true,
    priority: 20,
    minutes: 10,
  },
  {
    id: "SOFIA_OPERATIONS_V1_CLEANUP",
    type: "JOB_CLEANUP",
    label: "Cleanup and handover allowance",
    active: true,
    priority: 30,
    minutes: 10,
  },
  ...durationItemValues.map(
    ([itemTypeCode, minutes, billingUnit], index) =>
      ({
        id: `SOFIA_OPERATIONS_V1_${itemTypeCode}`,
        type: "ITEM_BASE",
        label: `${itemTypeCode} provisional cleaning time`,
        active: true,
        priority: 100 + index,
        serviceCode: itemTypeCode.startsWith("MATTRESS_")
          ? "MATTRESS_CARE"
          : "UPHOLSTERY_CARE",
        itemTypeCode,
        billingUnit,
        minutes,
        manualAssessmentRequired: itemTypeCode === "SOFA_U_SHAPED",
      }) satisfies DurationRuleDefinition,
  ),
  ...areaDurationItems.map(
    ([itemTypeCode, serviceCode], index) =>
      ({
        id:
          itemTypeCode === "CARPET_FIXED"
            ? "SOFIA_OPERATIONS_V1_AREA_PRODUCTIVITY"
            : `SOFIA_OPERATIONS_V1_AREA_PRODUCTIVITY_${itemTypeCode}`,
        type: "AREA_PRODUCTIVITY",
        label: `${itemTypeCode} provisional area productivity`,
        active: true,
        priority: 200 + index,
        serviceCode,
        itemTypeCode,
        billingUnit: "AREA_M2",
        productivityHundredthsM2PerHour: 2_300,
      }) satisfies DurationRuleDefinition,
  ),
  ...conditionPriceRules.map(
    ([conditionBandCode, percentageBasisPoints, manual], index) =>
      ({
        id: `SOFIA_OPERATIONS_V1_CONDITION_${conditionBandCode}`,
        type: "CONDITION_MULTIPLIER",
        label: `${conditionBandCode} duration complexity`,
        active: true,
        priority: 300 + index,
        conditionBandCode,
        multiplierBasisPoints: 10_000 + percentageBasisPoints,
        manualAssessmentRequired: manual,
      }) satisfies DurationRuleDefinition,
  ),
  ...issuePolicies.map(
    ([issueCode, adjustmentKind], index) =>
      ({
        id: `SOFIA_OPERATIONS_V1_ISSUE_${issueCode}`,
        type: "ISSUE_COMPLEXITY",
        label: `${issueCode} duration policy`,
        active: true,
        priority: 400 + index,
        issueCode,
        minutes: adjustmentKind === "NONE" ? 0 : undefined,
        manualAssessmentRequired: adjustmentKind !== "NONE",
        declineOrReferRequired: adjustmentKind === "DECLINE_OR_REFER",
      }) satisfies DurationRuleDefinition,
  ),
  ...addonCodes.map(
    (addonCode, index) =>
      ({
        id: `SOFIA_OPERATIONS_V1_ADDON_${addonCode}`,
        type: "ADD_ON_TIME",
        label: `${addonCode} duration requires confirmation`,
        active: true,
        priority: 500 + index,
        addonCode,
        manualAssessmentRequired: true,
      }) satisfies DurationRuleDefinition,
  ),
  ...riskFlags.map(
    (riskFlag, index) =>
      ({
        id: `SOFIA_OPERATIONS_V1_RISK_${riskFlag.code}`,
        type: "CUSTOM_ASSESSMENT",
        label: `${riskFlag.code} duration assessment`,
        active: true,
        priority: 600 + index,
        riskFlagCode: riskFlag.code as RiskFlagCode,
        manualAssessmentRequired: true,
      }) satisfies DurationRuleDefinition,
  ),
  {
    id: "SOFIA_OPERATIONS_V1_MATERIAL_SPECIALIST_UNCERTAIN",
    type: "MATERIAL_SENSITIVITY",
    label: "Specialist or uncertain material assessment",
    active: true,
    priority: 700,
    fibreMaterialCode: "SPECIALIST_UNCERTAIN",
    manualAssessmentRequired: true,
  },
  {
    id: "SOFIA_OPERATIONS_V1_TREATMENT_SPECIALIST_ASSESSMENT",
    type: "TREATMENT_COMPLEXITY",
    label: "Specialist treatment assessment",
    active: true,
    priority: 710,
    treatmentLevelCode: "SPECIALIST_ASSESSMENT",
    manualAssessmentRequired: true,
  },
] as const satisfies readonly DurationRuleDefinition[];

export const developmentDurationModel = {
  id: "SOFIA_OPERATIONS_V1_DRAFT",
  code: "SOFIA_OPERATIONS_V1_DRAFT",
  name: "Sofia provisional operations duration model v1",
  market: "SOFIA",
  version: 1,
  status: "DRAFT",
  effectiveFrom: null,
  effectiveUntil: null,
  provisional: true,
  active: false,
  rules: durationRules,
} as const satisfies DurationModelDefinition;

export const developmentDurationModels = [
  developmentDurationModel,
] as const satisfies readonly DurationModelDefinition[];
