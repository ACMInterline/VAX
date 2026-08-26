import type {
  EquipmentCapabilityCode,
  TeamCapabilityCode,
} from "@/modules/availability-engine/types";

type JsonObject = Readonly<Record<string, unknown>>;

function object(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

/**
 * Reads service authority only from the immutable accepted-estimate duration
 * input carried by the Booking snapshot. Any missing or malformed element
 * fails closed instead of falling back to the mutable service catalogue.
 */
export function immutableServiceCodesFromDurationSnapshot(
  value: unknown,
): readonly string[] | null {
  const snapshot = object(value);
  const source = object(snapshot?.sourceEstimateDurationSnapshot);
  const input = object(source?.input);
  const items = input?.items;
  if (!Array.isArray(items) || items.length === 0) return null;

  const codes: string[] = [];
  for (const itemValue of items) {
    const item = object(itemValue);
    if (typeof item?.serviceCode !== "string" || !item.serviceCode) {
      return null;
    }
    codes.push(item.serviceCode);
  }
  return codes;
}

export type ImmutableOperationalRequirements = Readonly<{
  team: readonly TeamCapabilityCode[];
  equipment: readonly EquipmentCapabilityCode[];
}>;

export function immutableOperationalRequirementsFromDurationSnapshot(
  value: unknown,
  expectedBookingItemCount: number,
): ImmutableOperationalRequirements | null {
  if (
    !Number.isSafeInteger(expectedBookingItemCount) ||
    expectedBookingItemCount <= 0
  ) {
    return null;
  }
  const serviceCodes = immutableServiceCodesFromDurationSnapshot(value);
  if (!serviceCodes || serviceCodes.length !== expectedBookingItemCount) {
    return null;
  }

  const team = new Set<TeamCapabilityCode>();
  let needsEquipment = false;
  for (const code of serviceCodes) {
    if (code === "COMMERCIAL_TEXTILE_CARE") {
      team.add("COMMERCIAL_AREA");
      needsEquipment = true;
    } else if (code === "DELICATE_TEXTILE_ASSESSMENT") {
      team.add("SPECIALIST_ASSESSMENT");
    } else if (
      [
        "CARPET_CARE",
        "RUG_RUNNER_CARE",
        "UPHOLSTERY_CARE",
        "MATTRESS_CARE",
      ].includes(code)
    ) {
      team.add("STANDARD_RESIDENTIAL");
      needsEquipment = true;
    } else {
      return null;
    }
  }
  return {
    team: [...team].sort(),
    equipment: needsEquipment ? ["PORTABLE_EXTRACTION"] : [],
  };
}
