import { z } from "zod";

export const requestServiceOptions = [
  { value: "carpet", label: "Carpet" },
  { value: "rug", label: "Rug" },
  { value: "sofa", label: "Sofa" },
  { value: "armchair", label: "Armchair" },
  { value: "dining-chair", label: "Dining chair" },
  { value: "mattress", label: "Mattress" },
  { value: "office-carpet", label: "Office carpet" },
  { value: "other-upholstery", label: "Other upholstery" },
] as const;

const requestServiceValues = requestServiceOptions.map(
  (service) => service.value,
) as [
  (typeof requestServiceOptions)[number]["value"],
  ...(typeof requestServiceOptions)[number]["value"][],
];

const optionalShortText = z.string().trim().max(120).optional();

export const publicRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your name.")
    .max(100, "Keep the name under 100 characters."),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(254),
  phone: z
    .string()
    .trim()
    .min(6, "Enter a phone number.")
    .max(32, "Keep the phone number under 32 characters.")
    .regex(/^[+()\d\s.-]+$/, "Use a valid phone-number format."),
  district: z
    .string()
    .trim()
    .min(2, "Enter a Sofia area or district.")
    .max(100),
  propertyType: z.enum([
    "apartment",
    "house",
    "rented-home",
    "office",
    "hotel-guest-house",
    "serviced-apartment",
    "hospitality",
    "public-space",
    "other",
  ]),
  services: z
    .array(z.enum(requestServiceValues))
    .min(1, "Select at least one service."),
  estimatedQuantity: optionalShortText,
  approximateArea: optionalShortText,
  condition: z.enum(["routine", "visible-soil", "heavy-soil", "unsure"]),
  stainsPresent: z.enum(["yes", "no", "unsure"]),
  delicateMaterial: z.boolean(),
  preferredDate: z.string().trim().max(20).optional(),
  preferredTime: z.enum([
    "early-morning",
    "morning",
    "afternoon",
    "evening",
    "flexible",
  ]),
  notes: z
    .string()
    .trim()
    .max(1500, "Keep notes under 1,500 characters.")
    .optional(),
});

export type PublicRequestInput = z.infer<typeof publicRequestSchema>;

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
