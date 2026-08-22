import { describe, expect, it } from "vitest";
import { developmentTravelTimeProfile } from "./development-config";
import {
  createDevelopmentTravelTimeEstimator,
  validateLocationInput,
} from "./travel";
import type { LocationInput, TravelTimeRequest } from "./types";

function location(
  zoneCode: LocationInput["zoneCode"],
  district: string,
): LocationInput {
  return {
    city: "Sofia",
    district,
    addressText: "Development fixture only",
    postalCode: "1000",
    latitude: null,
    longitude: null,
    accessNotes: null,
    parkingNotes: null,
    zoneCode,
  };
}

function request(
  origin: LocationInput,
  destination: LocationInput,
): TravelTimeRequest {
  return {
    origin,
    destination,
    departure: {
      localDate: "2026-08-24",
      minuteOfDay: 9 * 60,
      timeZone: "Europe/Sofia",
    },
  };
}

describe("development travel-time estimator", () => {
  const estimate = createDevelopmentTravelTimeEstimator(
    developmentTravelTimeProfile,
  );

  it("uses the same-core-area and configured zone matrix deterministically", () => {
    expect(
      estimate(
        request(
          location("SOFIA_CORE", "Lozenets"),
          location("SOFIA_CORE", "Lozenets"),
        ),
      ),
    ).toMatchObject({
      estimatedTravelMinutes: 15,
      distanceMetres: null,
      confidence: "DEVELOPMENT_ASSUMPTION",
      fallbackUsed: true,
      manualAssessmentRequired: false,
    });

    expect(
      estimate(
        request(
          location("SOFIA_CORE", "Lozenets"),
          location("SOFIA_CORE", "Center"),
        ),
      ).estimatedTravelMinutes,
    ).toBe(20);
    expect(
      estimate(
        request(
          location("SOFIA_CORE", "Center"),
          location("SOFIA_EXTENDED", "Mladost"),
        ),
      ).estimatedTravelMinutes,
    ).toBe(30);
    expect(
      estimate(
        request(
          location("SOFIA_EXTENDED", "Mladost"),
          location("SOFIA_OUTSKIRTS", "Outskirts fixture"),
        ),
      ).estimatedTravelMinutes,
    ).toBe(45);
    expect(
      estimate(
        request(
          location("SOFIA_EXTENDED", "Mladost"),
          location("SOFIA_CORE", "Center"),
        ),
      ).estimatedTravelMinutes,
    ).toBe(30);
    expect(
      estimate(
        request(
          location("SOFIA_CORE", "  LOZENETS "),
          location("SOFIA_CORE", "lozenets"),
        ),
      ).estimatedTravelMinutes,
    ).toBe(15);
  });

  it("never invents an automatic route for outside-Sofia work", () => {
    expect(
      estimate(
        request(
          location("SOFIA_CORE", "Center"),
          location("OUTSIDE_SOFIA", "External fixture"),
        ),
      ),
    ).toMatchObject({
      estimatedTravelMinutes: null,
      manualAssessmentRequired: true,
      fallbackUsed: true,
    });
  });

  it("validates coordinates as a pair without requiring them", () => {
    expect(() =>
      validateLocationInput({
        ...location("SOFIA_CORE", "Center"),
        latitude: 42.6977,
        longitude: null,
      }),
    ).toThrow(/latitude and longitude/i);
    expect(() =>
      validateLocationInput({
        ...location("SOFIA_CORE", "Center"),
        latitude: 42.6977,
        longitude: 23.3219,
      }),
    ).not.toThrow();
  });
});
