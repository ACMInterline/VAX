import {
  validateLocationInput,
} from "@/modules/availability-engine/travel";
import type {
  LocationInput,
  SchedulingBlock,
} from "@/modules/availability-engine/types";
import type { BookingOccupancyBlock } from "./types";

export type BookingAvailabilityAdapterResult =
  | Readonly<{ status: "READY"; blocks: readonly SchedulingBlock[] }>
  | Readonly<{
      status: "REVIEW_REQUIRED";
      blocks: readonly [];
      reasonCode: "MALFORMED_BOOKING_OCCUPANCY";
    }>;

export type BookingAvailabilityAdapterContext = Readonly<{
  workDate: string;
  teamCode: "TEAM_A" | "TEAM_B";
}>;

const locationSnapshotKeys = [
  "city",
  "district",
  "addressText",
  "postalCode",
  "latitude",
  "longitude",
  "accessNotes",
  "parkingNotes",
  "zoneCode",
] as const;

const travelSnapshotKeys = [
  "travelBeforeMinutes",
  "travelAfterMinutes",
  "bufferMinutes",
] as const;

function exactKeys(
  snapshot: Record<string, unknown>,
  expectedKeys: readonly string[],
): void {
  const actualKeys = Object.keys(snapshot).sort();
  const canonicalKeys = [...expectedKeys].sort();
  if (
    actualKeys.length !== canonicalKeys.length ||
    actualKeys.some((key, index) => key !== canonicalKeys[index])
  ) {
    throw new Error("Booking occupancy snapshot keys are invalid.");
  }
}

function snapshotValue(snapshot: Record<string, unknown>, key: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(snapshot, key)) {
    throw new Error("Booking occupancy snapshot is incomplete.");
  }
  return snapshot[key];
}

function requiredString(snapshot: Record<string, unknown>, key: string): string {
  const value = snapshotValue(snapshot, key);
  if (typeof value !== "string") {
    throw new Error("Booking occupancy snapshot has an invalid string.");
  }
  return value;
}

function nullableString(snapshot: Record<string, unknown>, key: string): string | null {
  const value = snapshotValue(snapshot, key);
  if (value === null || typeof value === "string") return value;
  throw new Error("Booking occupancy snapshot has an invalid nullable string.");
}

function nullableNumber(snapshot: Record<string, unknown>, key: string): number | null {
  const value = snapshotValue(snapshot, key);
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new Error("Booking occupancy snapshot has an invalid nullable number.");
}

function travelZoneCode(value: unknown): LocationInput["zoneCode"] {
  switch (value) {
    case "SOFIA_CORE":
    case "SOFIA_EXTENDED":
    case "SOFIA_OUTSKIRTS":
    case "OUTSIDE_SOFIA":
      return value;
    default:
      throw new Error("Booking occupancy has no supported travel zone.");
  }
}

function location(value: BookingOccupancyBlock["locationSnapshot"]): LocationInput {
  exactKeys(value, locationSnapshotKeys);
  const candidate: LocationInput = {
    city: requiredString(value, "city"),
    district: nullableString(value, "district"),
    addressText: nullableString(value, "addressText"),
    postalCode: nullableString(value, "postalCode"),
    latitude: nullableNumber(value, "latitude"),
    longitude: nullableNumber(value, "longitude"),
    accessNotes: nullableString(value, "accessNotes"),
    parkingNotes: nullableString(value, "parkingNotes"),
    zoneCode: travelZoneCode(snapshotValue(value, "zoneCode")),
  };
  validateLocationInput(candidate);
  return candidate;
}

function assertDateOnly(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new Error("Booking occupancy date is invalid.");
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Booking occupancy date is invalid.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("Booking occupancy date is invalid.");
  }
}

function assertNonBlank(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Booking occupancy provenance code is invalid.");
  }
}

function assertPositiveVersion(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error("Booking occupancy provenance version is invalid.");
  }
}

function nonNegativeSnapshotMinutes(
  snapshot: BookingOccupancyBlock["travelSnapshot"],
  key: string,
): number {
  const value = snapshotValue(snapshot, key);
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error("Invalid occupancy travel snapshot.");
  }
  return value as number;
}

/**
 * Converts only durable blocking booking occupancy into Phase 2B input. It
 * never derives a booking from request or catalogue data.
 */
export function adaptBookingOccupanciesForAvailability(
  occupancies: readonly BookingOccupancyBlock[],
  expected: BookingAvailabilityAdapterContext,
): BookingAvailabilityAdapterResult {
  try {
    assertDateOnly(expected.workDate);
    if (expected.teamCode !== "TEAM_A" && expected.teamCode !== "TEAM_B") {
      throw new Error("Booking occupancy team context is invalid.");
    }
    const blocks = occupancies.map((occupancy): SchedulingBlock => {
      assertNonBlank(occupancy.id);
      assertDateOnly(occupancy.workDate);
      if (occupancy.teamCode !== "TEAM_A" && occupancy.teamCode !== "TEAM_B") {
        throw new Error("Booking occupancy team is invalid.");
      }
      if (
        occupancy.workDate !== expected.workDate ||
        occupancy.teamCode !== expected.teamCode ||
        occupancy.configurationReferencesMatch !== true
      ) {
        throw new Error("Booking occupancy provenance context is inconsistent.");
      }
      assertNonBlank(occupancy.schedulingPolicyCode);
      assertPositiveVersion(occupancy.schedulingPolicyVersion);
      assertNonBlank(occupancy.workingHourPolicyCode);
      assertPositiveVersion(occupancy.workingHourPolicyVersion);
      assertNonBlank(occupancy.travelTimeProfileCode);
      assertPositiveVersion(occupancy.travelTimeProfileVersion);
      assertPositiveVersion(occupancy.snapshotVersion);
      exactKeys(occupancy.travelSnapshot, travelSnapshotKeys);
      if (
        occupancy.status !== "PENDING" &&
        occupancy.status !== "CONFIRMED"
      ) {
        throw new Error("Only blocking occupancy may enter availability.");
      }
      if (
        !Number.isSafeInteger(occupancy.serviceStartMinute) ||
        !Number.isSafeInteger(occupancy.serviceEndMinute) ||
        !Number.isSafeInteger(occupancy.serviceDurationMinutes) ||
        !Number.isSafeInteger(occupancy.operationalStartMinute) ||
        !Number.isSafeInteger(occupancy.operationalEndMinute) ||
        occupancy.serviceStartMinute < 0 ||
        occupancy.serviceEndMinute > 24 * 60 ||
        occupancy.serviceDurationMinutes <= 0 ||
        occupancy.operationalStartMinute < 0 ||
        occupancy.operationalEndMinute > 24 * 60 ||
        occupancy.operationalStartMinute >= occupancy.operationalEndMinute ||
        occupancy.serviceStartMinute < occupancy.operationalStartMinute ||
        occupancy.serviceEndMinute > occupancy.operationalEndMinute ||
        occupancy.serviceStartMinute >= occupancy.serviceEndMinute ||
        occupancy.serviceEndMinute - occupancy.serviceStartMinute !==
          occupancy.serviceDurationMinutes
      ) {
        throw new Error("Invalid occupancy interval.");
      }
      const travelBeforeMinutes = nonNegativeSnapshotMinutes(
        occupancy.travelSnapshot,
        "travelBeforeMinutes",
      );
      const travelAfterMinutes = nonNegativeSnapshotMinutes(
        occupancy.travelSnapshot,
        "travelAfterMinutes",
      );
      const bufferMinutes = nonNegativeSnapshotMinutes(
        occupancy.travelSnapshot,
        "bufferMinutes",
      );
      const travelMinutes = travelBeforeMinutes + travelAfterMinutes;
      const representedOperationalMinutes = travelMinutes + bufferMinutes;
      const beforeServiceMinutes =
        occupancy.serviceStartMinute - occupancy.operationalStartMinute;
      const afterServiceMinutes =
        occupancy.operationalEndMinute - occupancy.serviceEndMinute;
      if (
        !Number.isSafeInteger(travelMinutes) ||
        !Number.isSafeInteger(representedOperationalMinutes) ||
        travelBeforeMinutes > beforeServiceMinutes ||
        travelAfterMinutes > afterServiceMinutes ||
        representedOperationalMinutes >
          beforeServiceMinutes + afterServiceMinutes
      ) {
        throw new Error("Occupancy travel provenance is inconsistent.");
      }
      return {
        id: occupancy.id,
        type: "JOB",
        status: occupancy.status,
        startMinute: occupancy.operationalStartMinute,
        endMinute: occupancy.operationalEndMinute,
        location: location(occupancy.locationSnapshot),
        serviceMinutes: occupancy.serviceDurationMinutes,
        travelMinutes,
        bufferMinutes,
      };
    });
    return { status: "READY", blocks };
  } catch {
    return {
      status: "REVIEW_REQUIRED",
      blocks: [],
      reasonCode: "MALFORMED_BOOKING_OCCUPANCY",
    };
  }
}
