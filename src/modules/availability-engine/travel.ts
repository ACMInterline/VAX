import { travelZoneCodes } from "@/modules/commercial-engine/types";
import type {
  LocationInput,
  TravelEstimate,
  TravelTimeEstimator,
  TravelTimeProfileDefinition,
  TravelTimeProvider,
  TravelTimeRequest,
} from "./types";
import { travelEstimateConfidenceCodes } from "./types";

function assertDateOnly(value: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error("Departure date must use YYYY-MM-DD format.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("Departure date must be a real calendar date.");
  }
}

function normalizedDistrict(value: string | null): string | null {
  const normalized = value?.trim().toLocaleLowerCase("en-US") ?? "";
  return normalized.length > 0 ? normalized : null;
}

export function validateLocationInput(location: LocationInput): void {
  if (location.city.trim().length === 0) {
    throw new Error("Location city is required.");
  }
  if (!travelZoneCodes.includes(location.zoneCode)) {
    throw new Error("Location uses an unsupported travel-zone code.");
  }

  const hasLatitude = location.latitude !== null;
  const hasLongitude = location.longitude !== null;
  if (hasLatitude !== hasLongitude) {
    throw new Error("Latitude and longitude must be supplied as a pair.");
  }
  if (location.latitude !== null) {
    if (!Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90) {
      throw new Error("Latitude must be between -90 and 90 degrees.");
    }
  }
  if (location.longitude !== null) {
    if (
      !Number.isFinite(location.longitude) ||
      Math.abs(location.longitude) > 180
    ) {
      throw new Error("Longitude must be between -180 and 180 degrees.");
    }
  }
}

export function validateTravelEstimate(estimate: TravelEstimate): void {
  if (
    estimate.estimatedTravelMinutes !== null &&
    (!Number.isSafeInteger(estimate.estimatedTravelMinutes) ||
      estimate.estimatedTravelMinutes <= 0)
  ) {
    throw new Error("Estimated travel minutes must be null or positive whole minutes.");
  }
  if (
    estimate.distanceMetres !== null &&
    (!Number.isSafeInteger(estimate.distanceMetres) || estimate.distanceMetres < 0)
  ) {
    throw new Error("Travel distance must be null or non-negative whole metres.");
  }
  if (!travelEstimateConfidenceCodes.includes(estimate.confidence)) {
    throw new Error("Travel estimate uses an unsupported confidence code.");
  }
  if (estimate.source.trim().length === 0) {
    throw new Error("Travel estimate source is required.");
  }
  if (
    typeof estimate.fallbackUsed !== "boolean" ||
    typeof estimate.manualAssessmentRequired !== "boolean"
  ) {
    throw new Error("Travel estimate flags must be boolean values.");
  }
  if (
    estimate.estimatedTravelMinutes === null &&
    !estimate.manualAssessmentRequired
  ) {
    throw new Error("A missing travel duration must require manual assessment.");
  }
  if (
    !Array.isArray(estimate.warnings) ||
    !estimate.warnings.every((warning) => typeof warning === "string")
  ) {
    throw new Error("Travel estimate warnings must be strings.");
  }
  if (
    estimate.appliedRuleId !== null &&
    typeof estimate.appliedRuleId !== "string"
  ) {
    throw new Error("Applied travel rule must be a string or null.");
  }
}

function validateRequest(request: TravelTimeRequest): void {
  validateLocationInput(request.origin);
  validateLocationInput(request.destination);
  assertDateOnly(request.departure.localDate);
  if (
    !Number.isSafeInteger(request.departure.minuteOfDay) ||
    request.departure.minuteOfDay < 0 ||
    request.departure.minuteOfDay >= 24 * 60
  ) {
    throw new Error("Departure minute must be within the local calendar day.");
  }
  if (request.departure.timeZone !== "Europe/Sofia") {
    throw new Error("The Phase 2B estimator accepts Europe/Sofia local time only.");
  }
}

function isRuleMatch(
  request: TravelTimeRequest,
  rule: TravelTimeProfileDefinition["rules"][number],
): boolean {
  const direct =
    rule.originZoneCode === request.origin.zoneCode &&
    rule.destinationZoneCode === request.destination.zoneCode;
  const reverse =
    rule.bidirectional &&
    rule.originZoneCode === request.destination.zoneCode &&
    rule.destinationZoneCode === request.origin.zoneCode;
  if (!direct && !reverse) return false;

  if (!rule.sameDistrictOnly) return true;
  const originDistrict = normalizedDistrict(request.origin.district);
  const destinationDistrict = normalizedDistrict(request.destination.district);
  return (
    originDistrict !== null &&
    destinationDistrict !== null &&
    originDistrict === destinationDistrict
  );
}

function manualEstimate(
  profile: TravelTimeProfileDefinition,
  warning: string,
): TravelEstimate {
  return {
    estimatedTravelMinutes: null,
    distanceMetres: null,
    confidence: "DEVELOPMENT_ASSUMPTION",
    source: profile.code,
    fallbackUsed: true,
    manualAssessmentRequired: true,
    warnings: [warning],
    appliedRuleId: null,
  };
}

export function createDevelopmentTravelTimeEstimator(
  profile: TravelTimeProfileDefinition,
): TravelTimeEstimator {
  if (!Number.isSafeInteger(profile.version) || profile.version <= 0) {
    throw new Error("Travel-time profile version must be a positive integer.");
  }
  if (
    !Number.isSafeInteger(profile.defaultTravelMinutes) ||
    profile.defaultTravelMinutes <= 0
  ) {
    throw new Error("Default travel minutes must be a positive integer.");
  }

  const rules = [...profile.rules]
    .filter((rule) => rule.active)
    .sort((left, right) => left.priority - right.priority);

  return (request) => {
    validateRequest(request);

    if (
      request.origin.zoneCode === "OUTSIDE_SOFIA" ||
      request.destination.zoneCode === "OUTSIDE_SOFIA"
    ) {
      return manualEstimate(
        profile,
        "Outside-Sofia travel requires manual route and service-area confirmation.",
      );
    }

    const rule = rules.find((candidate) => isRuleMatch(request, candidate));
    if (rule?.manualAssessmentRequired || rule?.estimatedTravelMinutes === null) {
      return {
        ...manualEstimate(
          profile,
          "The matching development travel rule requires manual confirmation.",
        ),
        appliedRuleId: rule?.id ?? null,
      };
    }

    const estimatedTravelMinutes =
      rule?.estimatedTravelMinutes ?? profile.defaultTravelMinutes;
    if (
      !Number.isSafeInteger(estimatedTravelMinutes) ||
      estimatedTravelMinutes <= 0
    ) {
      throw new Error("Travel-time rules must use positive whole minutes.");
    }

    return {
      estimatedTravelMinutes,
      distanceMetres: null,
      confidence: "DEVELOPMENT_ASSUMPTION",
      source: profile.code,
      fallbackUsed: true,
      manualAssessmentRequired: false,
      warnings: [
        rule
          ? "Deterministic development travel assumption; no live routing provider was called."
          : "Default development travel fallback; no matching matrix rule or live route was available.",
      ],
      appliedRuleId: rule?.id ?? null,
    };
  };
}

export function createTravelTimeProvider(
  estimator: TravelTimeEstimator,
): TravelTimeProvider {
  return {
    estimateTravel(request) {
      const estimate = estimator(request);
      validateTravelEstimate(estimate);
      return Promise.resolve(estimate);
    },
  };
}
