import type { PublicRequestInput } from "./request-schema";
import type { JsonObject, JsonValue } from "@/modules/request-quote/types";

const preferredWindowCodes = {
  "early-morning": "EARLY_MORNING",
  morning: "MORNING",
  afternoon: "AFTERNOON",
  evening: "EVENING",
  flexible: "FLEXIBLE",
} as const;

function jsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(jsonValue);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, jsonValue(nested)]),
    );
  }
  return null;
}

export function publicSubmissionSnapshot(
  input: PublicRequestInput,
): JsonObject {
  return jsonValue({
    schemaVersion: 1,
    district: input.district,
    propertyType: input.propertyType,
    itemTypeCodes: input.services,
    estimatedQuantity: input.estimatedQuantity ?? null,
    approximateArea: input.approximateArea ?? null,
    conditionLevelCode: input.condition,
    stainsPresent: input.stainsPresent,
    delicateMaterial: input.delicateMaterial,
    preferredDate: input.preferredDate ?? null,
    preferredWindowCode: preferredWindowCodes[input.preferredTime],
    customerNotes: input.notes ?? null,
  }) as JsonObject;
}
