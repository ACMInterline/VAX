import {
  riskFlags,
  type CleaningItemTypeCode,
  type IssueTypeCode,
  type RiskFlagCode,
  type ServiceAddonCode,
  type ServiceCode,
} from "@/modules/service-catalogue/catalogue";
import type {
  AdjustmentKind,
  BillingUnit,
  DurationModelDefinition,
  DurationRuleDefinition,
  PriceBookDefinition,
  PriceRuleDefinition,
  TimingCategoryCode,
  TravelZoneCode,
} from "./types";

export const attelierResidentialPriceBookCode =
  "ATTELIER_RESIDENTIAL_EUR_V1" as const;
export const attelierB2bPriceBookCode = "ATTELIER_B2B_EUR_V1" as const;
export const attelierDurationModelCode = "ATTELIER_OPERATIONS_V1" as const;

const fixedItemPrices = [
  ["DINING_CHAIR_UPHOLSTERED", 700, "PER_ITEM"],
  ["ARMCHAIR", 1_800, "PER_ITEM"],
  ["OTTOMAN", 1_200, "PER_ITEM"],
  ["SOFA_2_SEAT", 3_500, "PER_ITEM"],
  ["SOFA_3_SEAT", 4_500, "PER_ITEM"],
  ["SOFA_4_PLUS", 5_500, "PER_ITEM"],
  ["MATTRESS_SINGLE", 2_200, "PER_SIDE"],
  ["MATTRESS_DOUBLE", 3_000, "PER_SIDE"],
  ["MATTRESS_KING_OR_LARGE", 3_500, "PER_SIDE"],
] as const satisfies readonly [CleaningItemTypeCode, number, BillingUnit][];

const fromItemPrices = [
  ["OFFICE_CHAIR_UPHOLSTERED", 900],
  ["SOFA_CORNER", 6_000],
  ["SOFA_U_SHAPED", 8_000],
] as const satisfies readonly [CleaningItemTypeCode, number][];

const unpricedItemCodes = [
  "SOFA_BED",
  "BENCH_UPHOLSTERED",
  "HEADBOARD",
  "MATTRESS_CHILD",
] as const satisfies readonly CleaningItemTypeCode[];

const itemServiceCode = (itemTypeCode: CleaningItemTypeCode): ServiceCode =>
  itemTypeCode.startsWith("MATTRESS_")
    ? "MATTRESS_CARE"
    : "UPHOLSTERY_CARE";

const baseItemPriceRules: readonly PriceRuleDefinition[] = [
  ...fixedItemPrices.map(
    ([itemTypeCode, amountMinorUnits, billingUnit], index) => ({
      id: `${attelierResidentialPriceBookCode}_${itemTypeCode}`,
      type: "BASE_ITEM" as const,
      label: `ATTELIER ${itemTypeCode} fixed customer price`,
      adjustmentKind: "RATE_PER_UNIT" as const,
      active: true,
      priority: 100 + index,
      serviceCode: itemServiceCode(itemTypeCode),
      itemTypeCode,
      billingUnit,
      amountMinorUnits,
      additionalSidePercentageBasisPoints:
        billingUnit === "PER_SIDE" ? 5_000 : undefined,
    }),
  ),
  ...fromItemPrices.map(([itemTypeCode, amountMinorUnits], index) => ({
    id: `${attelierResidentialPriceBookCode}_${itemTypeCode}_FROM`,
    type: "BASE_ITEM" as const,
    label: `ATTELIER ${itemTypeCode} from-price`,
    adjustmentKind: "MANUAL_ASSESSMENT" as const,
    active: true,
    priority: 130 + index,
    serviceCode: "UPHOLSTERY_CARE" as const,
    itemTypeCode,
    billingUnit: "PER_ITEM" as const,
    amountMinorUnits,
    manualAssessmentRequired: true,
    notes: "The amount is a public starting price; staff must confirm final scope.",
  })),
  ...unpricedItemCodes.map((itemTypeCode, index) => ({
    id: `${attelierResidentialPriceBookCode}_${itemTypeCode}_ASSESS`,
    type: "CUSTOM_ASSESSMENT" as const,
    label: `ATTELIER ${itemTypeCode} individual assessment`,
    adjustmentKind: "MANUAL_ASSESSMENT" as const,
    active: true,
    priority: 150 + index,
    serviceCode: itemServiceCode(itemTypeCode),
    itemTypeCode,
    manualAssessmentRequired: true,
  })),
];

const areaPriceRules = [
  ["CARPET_CARE", "CARPET_FIXED", 400],
  ["RUG_RUNNER_CARE", "RUG", 500],
  ["RUG_RUNNER_CARE", "RUNNER", 500],
] as const satisfies readonly [ServiceCode, CleaningItemTypeCode, number][];

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

const zonePolicies = [
  ["SOFIA_CORE", 4_500, false],
  ["SOFIA_EXTENDED", 6_000, false],
  ["SOFIA_OUTSKIRTS", 8_000, false],
  ["OUTSIDE_SOFIA", 10_000, true],
] as const satisfies readonly [TravelZoneCode, number, boolean][];

const timingPolicies = [
  ["STANDARD", false],
  ["EARLY_MORNING", false],
  ["EVENING", false],
  ["WEEKEND", false],
  ["URGENT", true],
] as const satisfies readonly [TimingCategoryCode, boolean][];

const residentialRules = [
  ...baseItemPriceRules,
  ...areaPriceRules.map(
    ([serviceCode, itemTypeCode, amountMinorUnits], index) => ({
      id: `${attelierResidentialPriceBookCode}_${itemTypeCode}_AREA`,
      type: "PER_AREA_M2" as const,
      label: `ATTELIER ${itemTypeCode} square-metre price`,
      adjustmentKind: "RATE_PER_UNIT" as const,
      active: true,
      priority: 200 + index,
      serviceCode,
      itemTypeCode,
      billingUnit: "AREA_M2" as const,
      amountMinorUnits,
      measurementMinHundredths: 1,
      measurementMaxHundredths: null,
    }),
  ),
  ...zonePolicies.map(([travelZoneCode, amountMinorUnits], index) => ({
    id: `${attelierResidentialPriceBookCode}_MINIMUM_${travelZoneCode}`,
    type: "MINIMUM_VISIT" as const,
    label: `ATTELIER ${travelZoneCode} minimum visit`,
    adjustmentKind: "FIXED" as const,
    active: true,
    priority: 300 + index,
    travelZoneCode,
    amountMinorUnits,
  })),
  ...([[
    "NORMAL",
    0,
    false,
  ], ["ENHANCED", 1_500, false], ["INTENSIVE", 3_000, false], [
    "ASSESSMENT_REQUIRED",
    0,
    true,
  ]] as const).map(([conditionBandCode, percentageBasisPoints, manual], index) => ({
    id: `${attelierResidentialPriceBookCode}_CONDITION_${conditionBandCode}`,
    type: "CONDITION_MODIFIER" as const,
    label: `ATTELIER ${conditionBandCode} condition factor`,
    adjustmentKind: manual ? "MANUAL_ASSESSMENT" as const : "PERCENTAGE" as const,
    active: true,
    priority: 400 + index,
    conditionBandCode,
    percentageBasisPoints,
    manualAssessmentRequired: manual,
  })),
  ...issuePolicies.map(
    ([issueCode, adjustmentKind, suggestedAddonCode], index) => ({
      id: `${attelierResidentialPriceBookCode}_ISSUE_${issueCode}`,
      type: "ISSUE_MODIFIER" as const,
      label: `ATTELIER ${issueCode} issue policy`,
      adjustmentKind,
      active: true,
      priority: 500 + index,
      issueCode,
      suggestedAddonCode,
      manualAssessmentRequired: adjustmentKind !== "NONE",
      declineOrReferRequired: adjustmentKind === "DECLINE_OR_REFER",
    }),
  ),
  ...addonCodes.map((addonCode, index) => ({
    id: `${attelierResidentialPriceBookCode}_ADDON_${addonCode}`,
    type: "ADD_ON" as const,
    label: `ATTELIER ${addonCode} requires confirmed scope`,
    adjustmentKind: "MANUAL_ASSESSMENT" as const,
    active: true,
    priority: 600 + index,
    addonCode,
    manualAssessmentRequired: true,
  })),
  ...riskFlags.map((riskFlag, index) => ({
    id: `${attelierResidentialPriceBookCode}_RISK_${riskFlag.code}`,
    type: "CUSTOM_ASSESSMENT" as const,
    label: `ATTELIER ${riskFlag.code} risk review`,
    adjustmentKind: "MANUAL_ASSESSMENT" as const,
    active: true,
    priority: 700 + index,
    riskFlagCode: riskFlag.code as RiskFlagCode,
    manualAssessmentRequired: true,
  })),
  ...zonePolicies.map(([travelZoneCode, , manual], index) => ({
    id: `${attelierResidentialPriceBookCode}_TRAVEL_${travelZoneCode}`,
    type: "TRAVEL_ZONE" as const,
    label: `ATTELIER ${travelZoneCode} route policy`,
    adjustmentKind: manual ? "MANUAL_ASSESSMENT" as const : "NONE" as const,
    active: true,
    priority: 800 + index,
    travelZoneCode,
    manualAssessmentRequired: manual,
    notes:
      travelZoneCode === "OUTSIDE_SOFIA"
        ? "Zone D starts at approximately 30–50 km; staff confirms the route. Beyond 50 km is exceptional."
        : "Travel is included under approved zone conditions.",
  })),
  ...timingPolicies.map(([timingCategoryCode, manual], index) => ({
    id: `${attelierResidentialPriceBookCode}_TIMING_${timingCategoryCode}`,
    type: "TIMING_MODIFIER" as const,
    label: `ATTELIER ${timingCategoryCode} timing policy`,
    adjustmentKind: manual ? "MANUAL_ASSESSMENT" as const : "NONE" as const,
    active: true,
    priority: 900 + index,
    timingCategoryCode,
    percentageBasisPoints: 0,
    manualAssessmentRequired: manual,
  })),
] as const satisfies readonly PriceRuleDefinition[];

export const attelierResidentialPriceBook = {
  id: attelierResidentialPriceBookCode,
  code: attelierResidentialPriceBookCode,
  name: "ATTELIER residential customer prices v1",
  currency: "EUR",
  market: "SOFIA",
  customerSegment: "RESIDENTIAL",
  version: 1,
  status: "DRAFT",
  effectiveFrom: null,
  effectiveUntil: null,
  priceBasis: "GROSS",
  vatConfiguration: { mode: "VAT_UNRESOLVED", rateBasisPoints: null },
  provisional: false,
  approvedForPublication: true,
  active: false,
  rules: residentialRules,
} as const satisfies PriceBookDefinition;

export const attelierB2bPriceBook = {
  id: attelierB2bPriceBookCode,
  code: attelierB2bPriceBookCode,
  name: "ATTELIER B2B quotation policy v1",
  currency: "EUR",
  market: "SOFIA",
  customerSegment: "B2B",
  version: 1,
  status: "DRAFT",
  effectiveFrom: null,
  effectiveUntil: null,
  priceBasis: "GROSS",
  vatConfiguration: { mode: "VAT_UNRESOLVED", rateBasisPoints: null },
  provisional: false,
  approvedForPublication: false,
  active: false,
  rules: [],
} as const satisfies PriceBookDefinition;

export const attelierPriceBooks = [
  attelierResidentialPriceBook,
  attelierB2bPriceBook,
] as const satisfies readonly PriceBookDefinition[];

const durationItems = [
  ["DINING_CHAIR_UPHOLSTERED", 10, "PER_ITEM", false],
  ["OFFICE_CHAIR_UPHOLSTERED", 15, "PER_ITEM", false],
  ["ARMCHAIR", 25, "PER_ITEM", false],
  ["OTTOMAN", 15, "PER_ITEM", false],
  ["SOFA_2_SEAT", 35, "PER_ITEM", false],
  ["SOFA_3_SEAT", 45, "PER_ITEM", false],
  ["SOFA_4_PLUS", 55, "PER_ITEM", false],
  ["SOFA_CORNER", 70, "PER_ITEM", true],
  ["SOFA_U_SHAPED", 90, "PER_ITEM", true],
  ["MATTRESS_SINGLE", 25, "PER_SIDE", false],
  ["MATTRESS_DOUBLE", 35, "PER_SIDE", false],
  ["MATTRESS_KING_OR_LARGE", 40, "PER_SIDE", false],
] as const satisfies readonly [CleaningItemTypeCode, number, BillingUnit, boolean][];

const durationRules = [
  {
    id: `${attelierDurationModelCode}_SETUP`,
    type: "JOB_SETUP",
    label: "ATTELIER setup allowance",
    active: true,
    priority: 10,
    minutes: 10,
  },
  {
    id: `${attelierDurationModelCode}_INSPECTION`,
    type: "JOB_INSPECTION",
    label: "ATTELIER inspection allowance",
    active: true,
    priority: 20,
    minutes: 10,
  },
  {
    id: `${attelierDurationModelCode}_COMPLETION`,
    type: "JOB_CLEANUP",
    label: "ATTELIER completion and pack-up allowance",
    active: true,
    priority: 30,
    minutes: 10,
  },
  ...durationItems.map(
    ([itemTypeCode, minutes, billingUnit, manualAssessmentRequired], index) => ({
      id: `${attelierDurationModelCode}_${itemTypeCode}`,
      type: "ITEM_BASE" as const,
      label: `ATTELIER ${itemTypeCode} planning duration`,
      active: true,
      priority: 100 + index,
      serviceCode: itemServiceCode(itemTypeCode),
      itemTypeCode,
      billingUnit,
      minutes,
      additionalSidePercentageBasisPoints:
        billingUnit === "PER_SIDE" ? 6_000 : undefined,
      manualAssessmentRequired,
      notes: "Internal two-person-team scheduling assumption; not a customer guarantee.",
    }),
  ),
  ...([[
    "CARPET_FIXED",
    "CARPET_CARE",
  ], ["RUG", "RUG_RUNNER_CARE"], ["RUNNER", "RUG_RUNNER_CARE"], [
    "OFFICE_CARPET",
    "COMMERCIAL_TEXTILE_CARE",
  ]] as const).map(([itemTypeCode, serviceCode], index) => ({
    id: `${attelierDurationModelCode}_AREA_${itemTypeCode}`,
    type: "AREA_PRODUCTIVITY" as const,
    label: `ATTELIER ${itemTypeCode} internal area planning`,
    active: true,
    priority: 200 + index,
    serviceCode,
    itemTypeCode,
    billingUnit: "AREA_M2" as const,
    productivityHundredthsM2PerHour: 2_300,
    notes: "Internal two-person-team scheduling assumption; never publish as throughput.",
  })),
  ...([[
    "NORMAL",
    10_000,
    false,
  ], ["ENHANCED", 12_000, false], ["INTENSIVE", 14_000, false], [
    "ASSESSMENT_REQUIRED",
    10_000,
    true,
  ]] as const).map(([conditionBandCode, multiplierBasisPoints, manual], index) => ({
    id: `${attelierDurationModelCode}_CONDITION_${conditionBandCode}`,
    type: "CONDITION_MULTIPLIER" as const,
    label: `ATTELIER ${conditionBandCode} duration factor`,
    active: true,
    priority: 300 + index,
    conditionBandCode,
    multiplierBasisPoints,
    manualAssessmentRequired: manual,
  })),
  ...issuePolicies.map(([issueCode, adjustmentKind], index) => ({
    id: `${attelierDurationModelCode}_ISSUE_${issueCode}`,
    type: "ISSUE_COMPLEXITY" as const,
    label: `ATTELIER ${issueCode} duration policy`,
    active: true,
    priority: 400 + index,
    issueCode,
    minutes: adjustmentKind === "NONE" ? 0 : undefined,
    manualAssessmentRequired: adjustmentKind !== "NONE",
    declineOrReferRequired: adjustmentKind === "DECLINE_OR_REFER",
  })),
  ...addonCodes.map((addonCode, index) => ({
    id: `${attelierDurationModelCode}_ADDON_${addonCode}`,
    type: "ADD_ON_TIME" as const,
    label: `ATTELIER ${addonCode} duration requires confirmation`,
    active: true,
    priority: 500 + index,
    addonCode,
    manualAssessmentRequired: true,
  })),
  ...riskFlags.map((riskFlag, index) => ({
    id: `${attelierDurationModelCode}_RISK_${riskFlag.code}`,
    type: "CUSTOM_ASSESSMENT" as const,
    label: `ATTELIER ${riskFlag.code} duration review`,
    active: true,
    priority: 600 + index,
    riskFlagCode: riskFlag.code as RiskFlagCode,
    manualAssessmentRequired: true,
  })),
  {
    id: `${attelierDurationModelCode}_MATERIAL_SPECIALIST_UNCERTAIN`,
    type: "MATERIAL_SENSITIVITY",
    label: "ATTELIER specialist or uncertain material review",
    active: true,
    priority: 700,
    fibreMaterialCode: "SPECIALIST_UNCERTAIN",
    manualAssessmentRequired: true,
  },
  {
    id: `${attelierDurationModelCode}_TREATMENT_ADVANCED`,
    type: "TREATMENT_COMPLEXITY",
    label: "ATTELIER restorative or advanced-care review",
    active: true,
    priority: 710,
    treatmentLevelCode: "SPECIALIST_ASSESSMENT",
    manualAssessmentRequired: true,
  },
] as const satisfies readonly DurationRuleDefinition[];

export const attelierDurationModel = {
  id: attelierDurationModelCode,
  code: attelierDurationModelCode,
  name: "ATTELIER two-person-team planning model v1",
  market: "SOFIA",
  version: 1,
  status: "ACTIVE",
  effectiveFrom: null,
  effectiveUntil: null,
  provisional: false,
  active: true,
  rules: durationRules,
} as const satisfies DurationModelDefinition;

export const attelierDurationModels = [attelierDurationModel] as const;
