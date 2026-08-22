import { z } from "zod";
import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";

export const requestServiceValues = [
  "carpet",
  "rug",
  "sofa",
  "armchair",
  "dining-chair",
  "mattress",
  "office-carpet",
  "other-upholstery",
] as const;

export const propertyTypeValues = [
  "apartment",
  "house",
  "rented-home",
  "office",
  "hotel-guest-house",
  "serviced-apartment",
  "hospitality",
  "public-space",
  "other",
] as const;

export const conditionValues = [
  "routine",
  "visible-soil",
  "heavy-soil",
  "unsure",
] as const;

export const stainValues = ["yes", "no", "unsure"] as const;

export const preferredTimeValues = [
  "early-morning",
  "morning",
  "afternoon",
  "evening",
  "flexible",
] as const;

export function createPublicRequestSchema(locale: PublicLocale) {
  const messages = getPublicContent(locale).requestForm.validation;
  const optionalShortText = z.string().trim().max(120).optional();

  return z.object({
    name: z
      .string()
      .trim()
      .min(2, messages.nameRequired)
      .max(100, messages.nameTooLong),
    email: z.string().trim().email(messages.emailInvalid).max(254),
    phone: z
      .string()
      .trim()
      .min(6, messages.phoneRequired)
      .max(32, messages.phoneTooLong)
      .regex(/^[+()\d\s.-]+$/, messages.phoneInvalid),
    district: z
      .string()
      .trim()
      .min(2, messages.districtRequired)
      .max(100),
    propertyType: z.enum(propertyTypeValues, {
      error: messages.propertyTypeRequired,
    }),
    services: z
      .array(z.enum(requestServiceValues))
      .min(1, messages.serviceRequired),
    estimatedQuantity: optionalShortText,
    approximateArea: optionalShortText,
    condition: z.enum(conditionValues, {
      error: messages.conditionRequired,
    }),
    stainsPresent: z.enum(stainValues, {
      error: messages.stainsRequired,
    }),
    delicateMaterial: z.boolean(),
    preferredDate: z.string().trim().max(20).optional(),
    preferredTime: z.enum(preferredTimeValues),
    notes: z
      .string()
      .trim()
      .max(1500, messages.notesTooLong)
      .optional(),
  });
}

export type PublicRequestInput = z.infer<
  ReturnType<typeof createPublicRequestSchema>
>;

function optionalFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value : undefined;
}

function formString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export function readPublicRequestForm(formData: FormData) {
  return {
    name: formString(formData, "name"),
    email: formString(formData, "email"),
    phone: formString(formData, "phone"),
    district: formString(formData, "district"),
    propertyType: formString(formData, "propertyType"),
    services: formData
      .getAll("services")
      .filter((value): value is string => typeof value === "string"),
    estimatedQuantity: optionalFormString(formData, "estimatedQuantity"),
    approximateArea: optionalFormString(formData, "approximateArea"),
    condition: formString(formData, "condition"),
    stainsPresent: formString(formData, "stainsPresent"),
    delicateMaterial: formData.get("delicateMaterial") === "on",
    preferredDate: optionalFormString(formData, "preferredDate"),
    preferredTime: formString(formData, "preferredTime"),
    notes: optionalFormString(formData, "notes"),
  };
}
