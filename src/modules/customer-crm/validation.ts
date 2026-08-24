import { z } from "zod";
import {
  customerIdentityRelationshipTypes,
  customerRecordStatuses,
  customerTypes,
  preferredContactMethods,
  preferredLocales,
  propertyAreaTypes,
  propertyTypes,
} from "./types";

const uuid = z.uuid();
const nonBlank = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .nullable()
    .transform((value) => value?.trim() || null)
    .optional();
const email = z
  .string()
  .trim()
  .max(254)
  .email()
  .transform((value) => value.toLowerCase());
const optionalEmail = email.nullable().optional();
const phone = z.string().trim().min(6).max(40).regex(/^[+()\d\s.-]+$/);
const optionalPhone = phone.nullable().optional();
const positiveReferenceId = z.number().int().positive();
const optionalReferenceId = positiveReferenceId.nullable().optional();
const expectedVersion = z.number().int().positive();

export const customerListInputSchema = z
  .object({
    search: z.string().trim().max(160).optional(),
    status: z.enum(customerRecordStatuses).optional(),
    customerType: z.enum(customerTypes).optional(),
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).max(100_000).default(0),
  })
  .strict()
  .transform((value) => ({
    ...value,
    search: value.search || undefined,
  }));

export const customerIdSchema = z.object({ customerId: uuid }).strict();

const initialContactSchema = z
  .object({
    contactName: nonBlank(160),
    email: optionalEmail,
    phone: optionalPhone,
    roleTitle: optionalText(160),
    preferredContactMethod: z.enum(preferredContactMethods),
    locale: z.enum(preferredLocales),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.email && !value.phone) {
      context.addIssue({
        code: "custom",
        message: "A contact email or phone is required.",
        path: ["email"],
      });
    }
    if (value.preferredContactMethod === "EMAIL" && !value.email) {
      context.addIssue({
        code: "custom",
        message: "The preferred email channel requires an email.",
        path: ["preferredContactMethod"],
      });
    }
    if (value.preferredContactMethod === "PHONE" && !value.phone) {
      context.addIssue({
        code: "custom",
        message: "The preferred phone channel requires a phone.",
        path: ["preferredContactMethod"],
      });
    }
  });

export const createCustomerSchema = z
  .object({
    customerType: z.enum(customerTypes),
    displayName: nonBlank(160),
    legalName: optionalText(255),
    preferredLocale: z.enum(preferredLocales),
    primaryEmail: optionalEmail,
    primaryPhone: optionalPhone,
    internalNotes: optionalText(4_000),
    initialContact: initialContactSchema.optional(),
  })
  .strict()
  .refine(
    (value) => value.customerType !== "BUSINESS" || value.initialContact !== undefined,
    {
      message: "A business customer requires an initial primary contact.",
      path: ["initialContact"],
    },
  );

export const updateCustomerSchema = z
  .object({
    customerId: uuid,
    expectedVersion,
    customerType: z.enum(customerTypes).optional(),
    displayName: nonBlank(160).optional(),
    legalName: optionalText(255),
    preferredLocale: z.enum(preferredLocales).optional(),
    primaryEmail: optionalEmail,
    primaryPhone: optionalPhone,
    internalNotes: optionalText(4_000),
  })
  .strict()
  .refine(
    (value) =>
      [
        value.customerType,
        value.displayName,
        value.legalName,
        value.preferredLocale,
        value.primaryEmail,
        value.primaryPhone,
        value.internalNotes,
      ].some((entry) => entry !== undefined),
    { message: "At least one customer field must be supplied." },
  );

export const archiveCustomerSchema = z
  .object({ customerId: uuid, expectedVersion })
  .strict();

export const createContactSchema = z
  .object({
    customerId: uuid,
    contactName: nonBlank(160),
    email: optionalEmail,
    phone: optionalPhone,
    roleTitle: optionalText(160),
    isPrimary: z.boolean().default(false),
    preferredContactMethod: z.enum(preferredContactMethods),
    locale: z.enum(preferredLocales),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.email && !value.phone) {
      context.addIssue({
        code: "custom",
        message: "A contact email or phone is required.",
        path: ["email"],
      });
    }
    if (value.preferredContactMethod === "EMAIL" && !value.email) {
      context.addIssue({
        code: "custom",
        message: "The preferred email channel requires an email.",
        path: ["preferredContactMethod"],
      });
    }
    if (value.preferredContactMethod === "PHONE" && !value.phone) {
      context.addIssue({
        code: "custom",
        message: "The preferred phone channel requires a phone.",
        path: ["preferredContactMethod"],
      });
    }
  });

export const archiveContactSchema = z
  .object({ contactId: uuid, expectedVersion })
  .strict();

const coordinateFields = {
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z
    .number()
    .min(-180)
    .max(180)
    .nullable()
    .optional(),
} as const;

function coordinatePairIsComplete(value: {
  latitude?: number | null;
  longitude?: number | null;
}): boolean {
  const hasLatitude = value.latitude !== undefined && value.latitude !== null;
  const hasLongitude = value.longitude !== undefined && value.longitude !== null;
  return hasLatitude === hasLongitude;
}

export const createPropertySchema = z
  .object({
    customerId: uuid,
    propertyType: z.enum(propertyTypes),
    label: nonBlank(160),
    city: nonBlank(160),
    district: optionalText(160),
    streetAddress: nonBlank(300),
    postalCode: optionalText(20),
    ...coordinateFields,
    accessNotes: optionalText(2_000),
    parkingNotes: optionalText(2_000),
    serviceZoneId: optionalReferenceId,
  })
  .strict()
  .refine(coordinatePairIsComplete, {
    message: "Latitude and longitude must be supplied as a pair.",
    path: ["longitude"],
  });

export const updatePropertySchema = z
  .object({
    propertyId: uuid,
    expectedVersion,
    propertyType: z.enum(propertyTypes).optional(),
    label: nonBlank(160).optional(),
    city: nonBlank(160).optional(),
    district: optionalText(160),
    streetAddress: nonBlank(300).optional(),
    postalCode: optionalText(20),
    ...coordinateFields,
    accessNotes: optionalText(2_000),
    parkingNotes: optionalText(2_000),
    serviceZoneId: optionalReferenceId,
  })
  .strict()
  .refine(coordinatePairIsComplete, {
    message: "Latitude and longitude must be supplied as a pair.",
    path: ["longitude"],
  })
  .refine(
    (value) =>
      [
        value.propertyType,
        value.label,
        value.city,
        value.district,
        value.streetAddress,
        value.postalCode,
        value.latitude,
        value.longitude,
        value.accessNotes,
        value.parkingNotes,
        value.serviceZoneId,
      ].some((entry) => entry !== undefined),
    { message: "At least one property field must be supplied." },
  );

export const archivePropertySchema = z
  .object({ propertyId: uuid, expectedVersion })
  .strict();

export const createPropertyAreaSchema = z
  .object({
    propertyId: uuid,
    areaType: z.enum(propertyAreaTypes),
    customLabel: optionalText(160),
    floorLevel: optionalText(64),
    notes: optionalText(2_000),
  })
  .strict()
  .refine((value) => value.areaType !== "OTHER" || Boolean(value.customLabel), {
    message: "A custom label is required for an OTHER area.",
    path: ["customLabel"],
  });

export const archivePropertyAreaSchema = z
  .object({ areaId: uuid, expectedVersion })
  .strict();

const distinctReferenceIds = z
  .array(positiveReferenceId)
  .max(100)
  .default([])
  .refine((values) => new Set(values).size === values.length, {
    message: "Reference identifiers must be unique.",
  });

export const createCleaningAssetSchema = z
  .object({
    propertyId: uuid,
    areaId: uuid.nullable().optional(),
    cleaningItemTypeId: positiveReferenceId,
    label: nonBlank(160),
    approximateLengthCm: z.number().int().positive().max(100_000).nullable().optional(),
    approximateWidthCm: z.number().int().positive().max(100_000).nullable().optional(),
    approximateAreaHundredthsM2: z.number().int().positive().max(100_000_000).nullable().optional(),
    approximateSeatCount: z.number().int().positive().max(10_000).nullable().optional(),
    reportedFibreMaterialId: optionalReferenceId,
    reportedSurfaceConstructionId: optionalReferenceId,
    customerReportedConditionLevelId: optionalReferenceId,
    customerConditionNotes: optionalText(2_000),
    colourAppearanceNotes: optionalText(1_000),
    approximateAcquisitionYear: z
      .number()
      .int()
      .min(1800)
      .max(new Date().getUTCFullYear())
      .nullable()
      .optional(),
    operationalNotes: optionalText(2_000),
    reportedIssueTypeIds: distinctReferenceIds,
    reportedRiskFlagIds: distinctReferenceIds,
  })
  .strict();

export const archiveCleaningAssetSchema = z
  .object({ assetId: uuid, expectedVersion })
  .strict();

export const linkCustomerIdentitySchema = z
  .object({
    customerId: uuid,
    userProfileId: uuid,
    relationshipType: z.enum(customerIdentityRelationshipTypes),
  })
  .strict();

export const revokeCustomerIdentityLinkSchema = z
  .object({ linkId: uuid })
  .strict();

export type CreateCustomerInput = z.output<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.output<typeof updateCustomerSchema>;
export type ArchiveCustomerInput = z.output<typeof archiveCustomerSchema>;
export type CreateContactInput = z.output<typeof createContactSchema>;
export type ArchiveContactInput = z.output<typeof archiveContactSchema>;
export type CreatePropertyInput = z.output<typeof createPropertySchema>;
export type UpdatePropertyInput = z.output<typeof updatePropertySchema>;
export type ArchivePropertyInput = z.output<typeof archivePropertySchema>;
export type CreatePropertyAreaInput = z.output<typeof createPropertyAreaSchema>;
export type ArchivePropertyAreaInput = z.output<typeof archivePropertyAreaSchema>;
export type CreateCleaningAssetInput = z.output<typeof createCleaningAssetSchema>;
export type ArchiveCleaningAssetInput = z.output<typeof archiveCleaningAssetSchema>;
export type LinkCustomerIdentityInput = z.output<typeof linkCustomerIdentitySchema>;
export type RevokeCustomerIdentityLinkInput = z.output<
  typeof revokeCustomerIdentityLinkSchema
>;
