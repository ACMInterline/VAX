import type {
  CommercialConditionBandCode,
  CommercialLineInput,
  TravelZoneCode,
} from "@/modules/commercial-engine/types";
import type {
  EquipmentCapabilityCode,
  LocationInput,
  TeamCapabilityCode,
} from "./types";

export type AvailabilityDevelopmentScenario = Readonly<{
  code: "A" | "B" | "C" | "D" | "E" | "F";
  name: string;
  description: string;
  items: readonly CommercialLineInput[];
  conditionBandCode: CommercialConditionBandCode;
  travelZoneCode: TravelZoneCode;
  location: LocationInput;
  measurementKind: "AREA_M2" | "PRIMARY_QUANTITY" | "FIXED";
  measurementLabel: string;
  defaultMeasurement: number;
  requiredCapabilityCodes: readonly TeamCapabilityCode[];
  requiredEquipmentCapabilityCodes: readonly EquipmentCapabilityCode[];
}>;

function location(
  zoneCode: TravelZoneCode,
  district: string,
): LocationInput {
  return {
    city: zoneCode === "OUTSIDE_SOFIA" ? "External development fixture" : "Sofia",
    district,
    addressText: "Development fixture only",
    postalCode: null,
    latitude: null,
    longitude: null,
    accessNotes: null,
    parkingNotes: null,
    zoneCode,
  };
}

export const availabilityDevelopmentScenarios = [
  {
    code: "A",
    name: "25 m² fitted carpet",
    description: "Normal-condition Sofia-core residential area fixture.",
    items: [
      {
        serviceCode: "CARPET_CARE",
        itemTypeCode: "CARPET_FIXED",
        quantity: 1,
        areaHundredthsM2: 2_500,
        issueCodes: [],
        addonCodes: [],
        riskFlagCodes: [],
      },
    ],
    conditionBandCode: "NORMAL",
    travelZoneCode: "SOFIA_CORE",
    location: location("SOFIA_CORE", "Lozenets"),
    measurementKind: "AREA_M2",
    measurementLabel: "Area (m²)",
    defaultMeasurement: 25,
    requiredCapabilityCodes: ["STANDARD_RESIDENTIAL"],
    requiredEquipmentCapabilityCodes: ["PORTABLE_EXTRACTION"],
  },
  {
    code: "B",
    name: "Sofa and two chairs",
    description: "Three-seat sofa plus two upholstered dining chairs, enhanced condition.",
    items: [
      {
        serviceCode: "UPHOLSTERY_CARE",
        itemTypeCode: "SOFA_3_SEAT",
        quantity: 1,
        issueCodes: [],
        addonCodes: [],
        riskFlagCodes: [],
      },
      {
        serviceCode: "UPHOLSTERY_CARE",
        itemTypeCode: "DINING_CHAIR_UPHOLSTERED",
        quantity: 2,
        issueCodes: [],
        addonCodes: [],
        riskFlagCodes: [],
      },
    ],
    conditionBandCode: "ENHANCED",
    travelZoneCode: "SOFIA_CORE",
    location: location("SOFIA_CORE", "Center"),
    measurementKind: "PRIMARY_QUANTITY",
    measurementLabel: "Sofa quantity",
    defaultMeasurement: 1,
    requiredCapabilityCodes: ["STANDARD_RESIDENTIAL"],
    requiredEquipmentCapabilityCodes: ["PORTABLE_EXTRACTION"],
  },
  {
    code: "C",
    name: "Corner sofa",
    description: "Extended-zone fixture that requires service-area confirmation.",
    items: [
      {
        serviceCode: "UPHOLSTERY_CARE",
        itemTypeCode: "SOFA_CORNER",
        quantity: 1,
        issueCodes: [],
        addonCodes: [],
        riskFlagCodes: [],
      },
    ],
    conditionBandCode: "NORMAL",
    travelZoneCode: "SOFIA_EXTENDED",
    location: location("SOFIA_EXTENDED", "Mladost"),
    measurementKind: "PRIMARY_QUANTITY",
    measurementLabel: "Corner-sofa quantity",
    defaultMeasurement: 1,
    requiredCapabilityCodes: ["STANDARD_RESIDENTIAL"],
    requiredEquipmentCapabilityCodes: ["PORTABLE_EXTRACTION"],
  },
  {
    code: "D",
    name: "Large office carpet",
    description: "200 m² commercial-area fixture intended to exercise all-day review logic.",
    items: [
      {
        serviceCode: "COMMERCIAL_TEXTILE_CARE",
        itemTypeCode: "OFFICE_CARPET",
        quantity: 1,
        areaHundredthsM2: 20_000,
        issueCodes: [],
        addonCodes: [],
        riskFlagCodes: [],
      },
    ],
    conditionBandCode: "NORMAL",
    travelZoneCode: "SOFIA_CORE",
    location: location("SOFIA_CORE", "Center"),
    measurementKind: "AREA_M2",
    measurementLabel: "Office area (m²)",
    defaultMeasurement: 200,
    requiredCapabilityCodes: ["COMMERCIAL_AREA"],
    requiredEquipmentCapabilityCodes: ["PORTABLE_EXTRACTION"],
  },
  {
    code: "E",
    name: "Specialist textile",
    description: "Unsupported textile fixture that must stay in manual assessment.",
    items: [
      {
        serviceCode: "DELICATE_TEXTILE_ASSESSMENT",
        itemTypeCode: "OTHER_TEXTILE_SURFACE",
        quantity: 1,
        issueCodes: [],
        addonCodes: [],
        riskFlagCodes: [],
      },
    ],
    conditionBandCode: "ASSESSMENT_REQUIRED",
    travelZoneCode: "SOFIA_CORE",
    location: location("SOFIA_CORE", "Lozenets"),
    measurementKind: "FIXED",
    measurementLabel: "Custom assessment",
    defaultMeasurement: 1,
    requiredCapabilityCodes: ["SPECIALIST_ASSESSMENT"],
    requiredEquipmentCapabilityCodes: [],
  },
  {
    code: "F",
    name: "Outside Sofia",
    description: "Standard item with an unapproved service area and manual travel requirement.",
    items: [
      {
        serviceCode: "UPHOLSTERY_CARE",
        itemTypeCode: "SOFA_3_SEAT",
        quantity: 1,
        issueCodes: [],
        addonCodes: [],
        riskFlagCodes: [],
      },
    ],
    conditionBandCode: "NORMAL",
    travelZoneCode: "OUTSIDE_SOFIA",
    location: location("OUTSIDE_SOFIA", "External fixture"),
    measurementKind: "PRIMARY_QUANTITY",
    measurementLabel: "Sofa quantity",
    defaultMeasurement: 1,
    requiredCapabilityCodes: ["STANDARD_RESIDENTIAL"],
    requiredEquipmentCapabilityCodes: ["PORTABLE_EXTRACTION"],
  },
] as const satisfies readonly AvailabilityDevelopmentScenario[];

export function itemsForScenarioMeasurement(
  scenario: AvailabilityDevelopmentScenario,
  measurement: number,
): readonly CommercialLineInput[] {
  if (!Number.isFinite(measurement) || measurement <= 0) {
    throw new Error("Scenario measurement must be greater than zero.");
  }
  if (scenario.measurementKind === "FIXED") return scenario.items;

  const first = scenario.items[0];
  if (!first) throw new Error("Development scenario has no service items.");
  const adjusted =
    scenario.measurementKind === "AREA_M2"
      ? {
          ...first,
          areaHundredthsM2: Math.round(measurement * 100),
        }
      : {
          ...first,
          quantity: Math.max(1, Math.round(measurement)),
        };
  return [adjusted, ...scenario.items.slice(1)];
}
