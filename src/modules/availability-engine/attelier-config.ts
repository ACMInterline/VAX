import type {
  AppointmentWindowDefinition,
  ServiceAreaDefinition,
  WeekdayCode,
  WorkingHourPolicyDefinition,
} from "./types";

export const attelierWorkingHourPolicyCode =
  "ATTELIER_WORKING_HOURS_V1" as const;
export const attelierAppointmentWindowProfileCode =
  "ATTELIER_APPOINTMENT_WINDOWS_V1" as const;

export const attelierServiceAreas = [
  {
    code: "SOFIA_CORE",
    name: { bg: "Зона A — централна София", en: "Zone A — Sofia core" },
    active: true,
    serviceEligible: true,
    minimumOrderOverrideMinorUnits: 4_500,
    estimatedBaseTravelMinutes: null,
    manualConfirmationRequired: false,
    geographicMetadata: null,
    notes:
      "Travel is included. No unapproved district, postcode or polygon boundary is inferred.",
  },
  {
    code: "SOFIA_EXTENDED",
    name: { bg: "Зона B — външна София", en: "Zone B — outer Sofia" },
    active: true,
    serviceEligible: true,
    minimumOrderOverrideMinorUnits: 6_000,
    estimatedBaseTravelMinutes: null,
    manualConfirmationRequired: false,
    geographicMetadata: null,
    notes:
      "Travel is included. ATTELIER classifies a supplied address; uncertain classification requires review.",
  },
  {
    code: "SOFIA_OUTSKIRTS",
    name: {
      bg: "Зона C — до приблизително 30 км от София",
      en: "Zone C — up to approximately 30 km outside Sofia",
    },
    active: true,
    serviceEligible: true,
    minimumOrderOverrideMinorUnits: 8_000,
    estimatedBaseTravelMinutes: null,
    manualConfirmationRequired: false,
    geographicMetadata: { maximumApproximateDistanceKm: 30 },
    notes:
      "Travel is included under approved conditions. This distance band is not a fabricated routing polygon.",
  },
  {
    code: "OUTSIDE_SOFIA",
    name: {
      bg: "Зона D — приблизително 30–50 км от София",
      en: "Zone D — approximately 30–50 km outside Sofia",
    },
    active: true,
    serviceEligible: true,
    minimumOrderOverrideMinorUnits: 10_000,
    estimatedBaseTravelMinutes: null,
    manualConfirmationRequired: true,
    geographicMetadata: {
      minimumApproximateDistanceKm: 30,
      maximumApproximateDistanceKm: 50,
    },
    notes:
      "The minimum is a from-price and requires staff confirmation. Beyond approximately 50 km is exceptional quotation-only work.",
  },
] as const satisfies readonly ServiceAreaDefinition[];

export const attelierWorkingHourPolicy = {
  id: attelierWorkingHourPolicyCode,
  code: attelierWorkingHourPolicyCode,
  name: "ATTELIER daily operating hours v1",
  timeZone: "Europe/Sofia",
  version: 1,
  status: "ACTIVE",
  effectiveFrom: null,
  effectiveUntil: null,
  provisional: false,
  active: true,
  rules: Array.from({ length: 7 }, (_, index) => {
    const weekday = (index + 1) as WeekdayCode;
    return {
      id: `${attelierWorkingHourPolicyCode}_WEEKDAY_${weekday}`,
      weekday,
      startMinute: 6 * 60,
      endMinute: 22 * 60,
      enabled: true,
      teamCode: null,
    };
  }),
} as const satisfies WorkingHourPolicyDefinition;

const windowDefinitions = [
  ["EARLY_MORNING", "06:00–09:00", 6 * 60, 9 * 60],
  ["MORNING", "09:00–12:00", 9 * 60, 12 * 60],
  ["MIDDAY", "12:00–15:00", 12 * 60, 15 * 60],
  ["AFTERNOON", "15:00–18:00", 15 * 60, 18 * 60],
  ["EVENING", "18:00–22:00", 18 * 60, 22 * 60],
] as const;

export const attelierAppointmentWindows = windowDefinitions.map(
  ([windowCode, label, startMinute, endMinute]) => ({
    id: `${attelierAppointmentWindowProfileCode}_${windowCode}`,
    profileCode: attelierAppointmentWindowProfileCode,
    version: 1,
    status: "ACTIVE" as const,
    windowCode,
    name: { bg: label, en: label },
    startMinute,
    endMinute,
    provisional: false,
    active: true,
  }),
) satisfies readonly AppointmentWindowDefinition[];
