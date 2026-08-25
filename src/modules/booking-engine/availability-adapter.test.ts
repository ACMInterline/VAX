import { describe, expect, it } from "vitest";
import {
  adaptBookingOccupanciesForAvailability as adaptOccupancies,
} from "./availability-adapter";
import type { BookingOccupancyBlock } from "./types";

const occupancy: BookingOccupancyBlock = {
  id: "booking-occupancy-1",
  teamCode: "TEAM_A",
  workDate: "2026-09-01",
  serviceStartMinute: 600,
  serviceEndMinute: 660,
  operationalStartMinute: 570,
  operationalEndMinute: 680,
  status: "CONFIRMED",
  locationSnapshot: {
    city: "Sofia",
    district: "Centre",
    addressText: "Synthetic address",
    postalCode: null,
    latitude: null,
    longitude: null,
    accessNotes: null,
    parkingNotes: null,
    zoneCode: "SOFIA_CORE",
  },
  serviceDurationMinutes: 60,
  travelSnapshot: {
    travelBeforeMinutes: 20,
    travelAfterMinutes: 10,
    bufferMinutes: 10,
  },
  schedulingPolicyCode: "APPROVED_TEST_POLICY",
  schedulingPolicyVersion: 1,
  workingHourPolicyCode: "APPROVED_TEST_HOURS",
  workingHourPolicyVersion: 1,
  travelTimeProfileCode: "APPROVED_TEST_TRAVEL",
  travelTimeProfileVersion: 1,
  snapshotVersion: 1,
  configurationReferencesMatch: true,
};

function adaptBookingOccupanciesForAvailability(
  occupancies: readonly BookingOccupancyBlock[],
) {
  return adaptOccupancies(occupancies, {
    workDate: "2026-09-01",
    teamCode: "TEAM_A",
  });
}

describe("durable booking occupancy availability adapter", () => {
  it.each(["PENDING", "CONFIRMED"] as const)(
    "maps %s occupancy to a real Phase 2B blocking job",
    (status) => {
      const result = adaptBookingOccupanciesForAvailability([
        { ...occupancy, status },
      ]);
      expect(result).toEqual({
        status: "READY",
        blocks: [
          expect.objectContaining({
            id: occupancy.id,
            type: "JOB",
            status,
            startMinute: 570,
            endMinute: 680,
            serviceMinutes: 60,
            travelMinutes: 30,
            bufferMinutes: 10,
          }),
        ],
      });
    },
  );

  it("fails closed instead of interpreting cancelled or malformed occupancy", () => {
    expect(
      adaptBookingOccupanciesForAvailability([
        { ...occupancy, status: "CANCELLED" as "CONFIRMED" },
      ]),
    ).toEqual({
      status: "REVIEW_REQUIRED",
      blocks: [],
      reasonCode: "MALFORMED_BOOKING_OCCUPANCY",
    });
    expect(
      adaptBookingOccupanciesForAvailability([
        { ...occupancy, serviceDurationMinutes: 61 },
      ]),
    ).toMatchObject({ status: "REVIEW_REQUIRED", blocks: [] });
    expect(
      adaptBookingOccupanciesForAvailability([
        {
          ...occupancy,
          locationSnapshot: {
            ...occupancy.locationSnapshot,
            zoneCode: "UNCLASSIFIED",
          },
        },
      ]),
    ).toMatchObject({ status: "REVIEW_REQUIRED", blocks: [] });
  });

  it.each([
    ["district", 42],
    ["addressText", { unsafe: true }],
    ["postalCode", false],
    ["accessNotes", 12],
    ["parkingNotes", ["unexpected"]],
    ["latitude", "42.6977"],
    ["longitude", "23.3219"],
  ] as const)(
    "fails closed when %s has the wrong durable snapshot type",
    (field, malformedValue) => {
      const result = adaptBookingOccupanciesForAvailability([
        {
          ...occupancy,
          locationSnapshot: {
            ...occupancy.locationSnapshot,
            [field]: malformedValue,
          },
        },
      ]);
      expect(result).toEqual({
        status: "REVIEW_REQUIRED",
        blocks: [],
        reasonCode: "MALFORMED_BOOKING_OCCUPANCY",
      });
    },
  );

  it("requires every declared location field and rejects one malformed block as a batch", () => {
    const incompleteLocation = { ...occupancy.locationSnapshot };
    delete incompleteLocation.parkingNotes;
    const result = adaptBookingOccupanciesForAvailability([
      occupancy,
      { ...occupancy, id: "booking-occupancy-2", locationSnapshot: incompleteLocation },
    ]);
    expect(result).toEqual({
      status: "REVIEW_REQUIRED",
      blocks: [],
      reasonCode: "MALFORMED_BOOKING_OCCUPANCY",
    });
  });

  it.each([
    ["schedulingPolicyCode", ""],
    ["workingHourPolicyCode", "   "],
    ["travelTimeProfileCode", ""],
    ["schedulingPolicyVersion", 0],
    ["workingHourPolicyVersion", 0],
    ["travelTimeProfileVersion", 0],
    ["snapshotVersion", 0],
  ] as const)("fails closed for invalid %s provenance", (field, value) => {
    expect(
      adaptBookingOccupanciesForAvailability([
        { ...occupancy, [field]: value },
      ]),
    ).toEqual({
      status: "REVIEW_REQUIRED",
      blocks: [],
      reasonCode: "MALFORMED_BOOKING_OCCUPANCY",
    });
  });

  it.each([
    ["id", ""],
    ["workDate", "2026-02-30"],
    ["workDate", "2026-9-1"],
    ["teamCode", "TEAM_C"],
    ["serviceStartMinute", 600.5],
    ["serviceEndMinute", Number.POSITIVE_INFINITY],
    ["serviceDurationMinutes", 0],
    ["operationalStartMinute", -1],
    ["operationalEndMinute", 1_441],
    ["schedulingPolicyCode", 7],
    ["schedulingPolicyVersion", 1.5],
    ["workingHourPolicyVersion", Number.MAX_SAFE_INTEGER + 1],
  ] as const)("fails closed for malformed top-level %s", (field, value) => {
    expect(
      adaptBookingOccupanciesForAvailability([
        { ...occupancy, [field]: value } as BookingOccupancyBlock,
      ]),
    ).toMatchObject({ status: "REVIEW_REQUIRED", blocks: [] });
  });

  it("requires exact location and travel snapshot keys", () => {
    expect(
      adaptBookingOccupanciesForAvailability([
        {
          ...occupancy,
          locationSnapshot: {
            ...occupancy.locationSnapshot,
            unexpected: "value",
          },
        },
      ]),
    ).toMatchObject({ status: "REVIEW_REQUIRED", blocks: [] });
    expect(
      adaptBookingOccupanciesForAvailability([
        {
          ...occupancy,
          travelSnapshot: {
            ...occupancy.travelSnapshot,
            unexpected: 0,
          },
        },
      ]),
    ).toMatchObject({ status: "REVIEW_REQUIRED", blocks: [] });
  });

  it("binds every block to the requested team/date and referenced configuration", () => {
    for (const malformed of [
      { ...occupancy, teamCode: "TEAM_B" as const },
      { ...occupancy, workDate: "2026-09-02" },
      { ...occupancy, configurationReferencesMatch: false },
    ]) {
      expect(
        adaptBookingOccupanciesForAvailability([occupancy, malformed]),
      ).toMatchObject({ status: "REVIEW_REQUIRED", blocks: [] });
    }
  });

  it("rejects an invalid requested context", () => {
    expect(
      adaptOccupancies([occupancy], {
        workDate: "2026-02-30",
        teamCode: "TEAM_A",
      }),
    ).toMatchObject({ status: "REVIEW_REQUIRED", blocks: [] });
  });

  it.each([
    {
      travelBeforeMinutes: Number.MAX_SAFE_INTEGER,
      travelAfterMinutes: Number.MAX_SAFE_INTEGER,
      bufferMinutes: 0,
    },
    { travelBeforeMinutes: 31, travelAfterMinutes: 10, bufferMinutes: 0 },
    { travelBeforeMinutes: 20, travelAfterMinutes: 21, bufferMinutes: 0 },
    { travelBeforeMinutes: 20, travelAfterMinutes: 10, bufferMinutes: 21 },
  ])("fails closed for impossible travel provenance %#", (travelSnapshot) => {
    expect(
      adaptBookingOccupanciesForAvailability([
        { ...occupancy, travelSnapshot },
      ]),
    ).toMatchObject({ status: "REVIEW_REQUIRED", blocks: [] });
  });

  it("rejects missing, wrong-type, negative and fractional travel values", () => {
    const missing = { ...occupancy.travelSnapshot };
    delete missing.travelAfterMinutes;
    for (const travelSnapshot of [
      missing,
      { ...occupancy.travelSnapshot, travelBeforeMinutes: "20" },
      { ...occupancy.travelSnapshot, travelAfterMinutes: -1 },
      { ...occupancy.travelSnapshot, bufferMinutes: 1.5 },
    ]) {
      expect(
        adaptBookingOccupanciesForAvailability([
          { ...occupancy, travelSnapshot },
        ]),
      ).toMatchObject({ status: "REVIEW_REQUIRED", blocks: [] });
    }
  });

  it("preserves legitimate explicit nulls without coercion", () => {
    const result = adaptBookingOccupanciesForAvailability([occupancy]);
    expect(result).toMatchObject({
      status: "READY",
      blocks: [
        {
          location: {
            postalCode: null,
            latitude: null,
            longitude: null,
            accessNotes: null,
            parkingNotes: null,
          },
        },
      ],
    });
  });
});
