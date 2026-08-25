import { z } from "zod";
import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import {
  publicConditionLevelCodes,
  publicRequestItemTypeCodes,
} from "@/modules/service-catalogue/catalogue";

export const requestServiceValues = publicRequestItemTypeCodes;

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

export const conditionValues = publicConditionLevelCodes;

export const stainValues = ["yes", "no", "unsure"] as const;

export const preferredTimeValues = [
  "early-morning",
  "morning",
  "afternoon",
  "evening",
  "flexible",
] as const;

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function createPublicRequestSchema(locale: PublicLocale) {
  const messages = getPublicContent(locale).requestForm.validation;
  const boundaryMessages =
    locale === "bg"
      ? {
          duplicateService: "Изберете всяка повърхност или артикул само веднъж.",
          invalidDate: "Въведете валидна дата.",
          textTooLong: "Текстът е по-дълъг от допустимото.",
        }
      : {
          duplicateService: "Select each surface or item only once.",
          invalidDate: "Enter a valid date.",
          textTooLong: "The text is longer than allowed.",
        };
  const optionalShortText = z
    .string()
    .trim()
    .max(120, boundaryMessages.textTooLong)
    .optional();

  return z
    .object({
      name: z
        .string()
        .trim()
        .min(2, messages.nameRequired)
        .max(100, messages.nameTooLong),
      email: z
        .string()
        .trim()
        .max(254, messages.emailInvalid)
        .email(messages.emailInvalid)
        .transform((value) => value.toLowerCase()),
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
        .max(100, boundaryMessages.textTooLong),
      propertyType: z.enum(propertyTypeValues, {
        error: messages.propertyTypeRequired,
      }),
      services: z
        .array(z.enum(requestServiceValues))
        .min(1, messages.serviceRequired)
        .max(requestServiceValues.length, messages.serviceRequired)
        .refine((values) => new Set(values).size === values.length, {
          message: boundaryMessages.duplicateService,
        }),
      estimatedQuantity: optionalShortText,
      approximateArea: optionalShortText,
      condition: z.enum(conditionValues, {
        error: messages.conditionRequired,
      }),
      stainsPresent: z.enum(stainValues, {
        error: messages.stainsRequired,
      }),
      delicateMaterial: z.boolean(),
      preferredDate: z
        .string()
        .trim()
        .max(10, boundaryMessages.invalidDate)
        .refine(isCalendarDate, boundaryMessages.invalidDate)
        .optional(),
      preferredTime: z.enum(preferredTimeValues),
      notes: z
        .string()
        .trim()
        .max(1_500, messages.notesTooLong)
        .optional(),
      website: z.literal("").default(""),
    })
    .strict()
    .transform(({ website, ...request }) => {
      void website;
      return request;
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
    website: formString(formData, "website"),
  };
}

export type PublicRequestRawInput = ReturnType<typeof readPublicRequestForm>;
