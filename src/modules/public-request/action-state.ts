import type { ZodError } from "zod";
import {
  conditionValues,
  preferredTimeValues,
  propertyTypeValues,
  requestServiceValues,
  stainValues,
} from "./request-schema";

export const publicRequestFieldNames = [
  "name",
  "email",
  "phone",
  "district",
  "propertyType",
  "services",
  "estimatedQuantity",
  "approximateArea",
  "condition",
  "stainsPresent",
  "delicateMaterial",
  "preferredDate",
  "preferredTime",
  "notes",
] as const;

export type PublicRequestFieldName = (typeof publicRequestFieldNames)[number];

export type PublicRequestFieldErrors = Readonly<
  Partial<Record<PublicRequestFieldName, readonly string[]>>
>;

export type PublicRequestRetainedValues = Readonly<
  Partial<
    Record<PublicRequestFieldName, string | readonly string[] | undefined>
  >
>;

export type PublicRequestActionState =
  | Readonly<{ status: "IDLE" }>
  | Readonly<{
      status: "ERROR";
      message?: string;
      fieldErrors?: PublicRequestFieldErrors;
      values?: PublicRequestRetainedValues;
    }>
  | Readonly<{
      status: "SUCCESS";
      requestReference: string;
    }>;

export type PublicRequestFormAction = (
  previousState: PublicRequestActionState,
  formData: FormData,
) => Promise<PublicRequestActionState>;

export const initialPublicRequestActionState: PublicRequestActionState = {
  status: "IDLE",
};

const retainedTextLimits = {
  name: 100,
  email: 254,
  phone: 32,
  district: 100,
  estimatedQuantity: 120,
  approximateArea: 120,
  preferredDate: 10,
  notes: 1_500,
} as const;

function retainedText(formData: FormData, name: keyof typeof retainedTextLimits) {
  const value = formData.get(name);
  if (typeof value !== "string") return undefined;
  return value.slice(0, retainedTextLimits[name]);
}

function retainedEnum<const Value extends string>(
  formData: FormData,
  name: string,
  allowedValues: readonly Value[],
): Value | undefined {
  const value = formData.get(name);
  return typeof value === "string" && allowedValues.includes(value as Value)
    ? (value as Value)
    : undefined;
}

/**
 * Retains only bounded public fields. In particular, this never reflects the
 * bot-trap field or arbitrary FormData keys back into rendered HTML.
 */
export function retainPublicRequestValues(
  formData: FormData,
): PublicRequestRetainedValues {
  const services = [
    ...new Set(
      formData
        .getAll("services")
        .filter(
          (value): value is (typeof requestServiceValues)[number] =>
            typeof value === "string" &&
            requestServiceValues.includes(
              value as (typeof requestServiceValues)[number],
            ),
        ),
    ),
  ].slice(0, requestServiceValues.length);

  return {
    name: retainedText(formData, "name"),
    email: retainedText(formData, "email"),
    phone: retainedText(formData, "phone"),
    district: retainedText(formData, "district"),
    propertyType: retainedEnum(
      formData,
      "propertyType",
      propertyTypeValues,
    ),
    services,
    estimatedQuantity: retainedText(formData, "estimatedQuantity"),
    approximateArea: retainedText(formData, "approximateArea"),
    condition: retainedEnum(formData, "condition", conditionValues),
    stainsPresent: retainedEnum(formData, "stainsPresent", stainValues),
    delicateMaterial:
      formData.get("delicateMaterial") === "on" ? "on" : undefined,
    preferredDate: retainedText(formData, "preferredDate"),
    preferredTime: retainedEnum(
      formData,
      "preferredTime",
      preferredTimeValues,
    ),
    notes: retainedText(formData, "notes"),
  };
}

export function publicRequestFieldErrorsFromZod(
  error: ZodError,
): PublicRequestFieldErrors {
  const fieldNames = new Set<string>(publicRequestFieldNames);
  const fieldErrors: Partial<
    Record<PublicRequestFieldName, readonly string[]>
  > = {};

  for (const issue of error.issues) {
    const [pathEntry] = issue.path;
    if (typeof pathEntry !== "string" || !fieldNames.has(pathEntry)) continue;
    const name = pathEntry as PublicRequestFieldName;
    fieldErrors[name] = [
      ...(fieldErrors[name] ?? []),
      issue.message.slice(0, 300),
    ].slice(0, 4);
  }

  return fieldErrors;
}

export function publicRequestFieldMessages(
  state: PublicRequestActionState,
  name: PublicRequestFieldName,
): readonly string[] {
  return state.status === "ERROR" ? (state.fieldErrors?.[name] ?? []) : [];
}

export function publicRequestStringValue(
  state: PublicRequestActionState,
  name: PublicRequestFieldName,
  fallback = "",
): string {
  if (state.status !== "ERROR") return fallback;
  const value = state.values?.[name];
  return typeof value === "string" ? value : fallback;
}

export function publicRequestStringValues(
  state: PublicRequestActionState,
  name: PublicRequestFieldName,
): readonly string[] {
  if (state.status !== "ERROR") return [];
  const value = state.values?.[name];
  if (Array.isArray(value)) return value;
  return typeof value === "string" ? [value] : [];
}
