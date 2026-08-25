import { z } from "zod";
import {
  customerResolutionStatuses,
  estimateStatuses,
  type JsonObject,
  type JsonValue,
  requestSources,
} from "./types";

const uuid = z.uuid();
const positiveReferenceId = z.number().int().positive();
const positiveVersion = z.number().int().positive();
const minorUnits = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const vatRateBasisPoints = z.number().int().min(0).max(10_000);
const nonBlank = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .nullable()
    .optional()
    .transform((value) => value?.trim() || null);
const optionalReferenceId = positiveReferenceId.nullable().default(null);
const optionalUuid = uuid.nullable().default(null);

export const requestReferenceSchema = z.string().regex(/^REQ-[A-F0-9]{24}$/);
export const quoteReferenceSchema = z.string().regex(/^Q-[A-F0-9]{24}$/);

const email = z
  .string()
  .trim()
  .max(254)
  .email()
  .transform((value) => value.toLowerCase());
const phone = z
  .string()
  .trim()
  .min(6)
  .max(40)
  .regex(/^[+()\d\s.-]+$/);

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string().max(128), jsonValueSchema),
  ]),
);

function boundedJsonObject(maximumBytes: number) {
  return z
    .record(z.string().max(128), jsonValueSchema)
    .refine(
      (value) =>
        new TextEncoder().encode(JSON.stringify(value)).byteLength <=
        maximumBytes,
      { message: `Snapshot must not exceed ${maximumBytes} UTF-8 bytes.` },
    ) as z.ZodType<JsonObject>;
}

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
    );
  }, "Date must be a real calendar date in YYYY-MM-DD format.");

const distinctPositiveReferenceIds = z
  .array(positiveReferenceId)
  .max(100)
  .default([])
  .refine((values) => new Set(values).size === values.length, {
    message: "Reference identifiers must be unique.",
  });

export const requestItemInputSchema = z
  .object({
    serviceId: optionalReferenceId,
    cleaningItemTypeId: optionalReferenceId,
    cleaningAssetId: optionalUuid,
    measurementModeId: optionalReferenceId,
    customerReportedConditionLevelId: optionalReferenceId,
    normalizedConditionLevelId: optionalReferenceId,
    reportedFibreMaterialId: optionalReferenceId,
    normalizedFibreMaterialId: optionalReferenceId,
    reportedSurfaceConstructionId: optionalReferenceId,
    normalizedSurfaceConstructionId: optionalReferenceId,
    customerDescription: nonBlank(2_000),
    normalizedDescription: optionalText(2_000),
    quantity: z.number().int().positive().max(100_000).default(1),
    areaHundredthsM2: z
      .number()
      .int()
      .positive()
      .max(100_000_000)
      .nullable()
      .default(null),
    seatCount: z.number().int().positive().max(10_000).nullable().default(null),
    sides: z
      .union([z.literal(1), z.literal(2)])
      .nullable()
      .default(null),
    sortOrder: z.number().int().min(0).max(10_000),
    issueTypeIds: distinctPositiveReferenceIds,
    addonIds: distinctPositiveReferenceIds,
  })
  .strict();

/** Staff normalization cannot rewrite customer-reported source fields. */
export const normalizeRequestItemInputSchema = requestItemInputSchema
  .pick({
    serviceId: true,
    cleaningItemTypeId: true,
    cleaningAssetId: true,
    measurementModeId: true,
    normalizedConditionLevelId: true,
    normalizedFibreMaterialId: true,
    normalizedSurfaceConstructionId: true,
    normalizedDescription: true,
    quantity: true,
    areaHundredthsM2: true,
    seatCount: true,
    sides: true,
    sortOrder: true,
    issueTypeIds: true,
    addonIds: true,
  })
  .strict();

export const createServiceRequestInputSchema = z
  .object({
    source: z.enum(requestSources),
    customerResolutionStatus: z
      .enum(customerResolutionStatuses)
      .default("UNRESOLVED"),
    customerId: optionalUuid,
    requestingProfileId: optionalUuid,
    propertyId: optionalUuid,
    preferredLocale: z.enum(["bg", "en"]),
    contactName: nonBlank(160),
    contactEmail: email.nullable().default(null),
    contactPhone: phone.nullable().default(null),
    customerNotes: optionalText(4_000),
    preferredDate: dateOnlySchema.nullable().default(null),
    preferredWindowCode: optionalText(64),
    originalSubmission: boundedJsonObject(24_000),
    items: z.array(requestItemInputSchema).min(1).max(50),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.contactEmail && !value.contactPhone) {
      context.addIssue({
        code: "custom",
        message: "A contact email or phone is required.",
        path: ["contactEmail"],
      });
    }

    if (value.source === "PUBLIC_WEB") {
      if (value.customerId || value.requestingProfileId || value.propertyId) {
        context.addIssue({
          code: "custom",
          message:
            "A public request cannot arrive pre-linked to CRM or Auth records.",
          path: ["source"],
        });
      }
      if (value.customerResolutionStatus === "LINKED") {
        context.addIssue({
          code: "custom",
          message:
            "A public request cannot be linked during anonymous submission.",
          path: ["customerResolutionStatus"],
        });
      }
    }

    if (value.source === "CUSTOMER_PORTAL") {
      if (!value.customerId || !value.requestingProfileId) {
        context.addIssue({
          code: "custom",
          message:
            "A portal request requires resolved customer and profile context.",
          path: ["source"],
        });
      }
      if (value.customerResolutionStatus !== "LINKED") {
        context.addIssue({
          code: "custom",
          message: "A portal request must use a verified active customer link.",
          path: ["customerResolutionStatus"],
        });
      }
    }

    if (value.source === "STAFF_CREATED") {
      if (!value.customerId || value.requestingProfileId) {
        context.addIssue({
          code: "custom",
          message:
            "A staff-created request requires a customer but no requesting profile.",
          path: ["source"],
        });
      }
      if (value.customerResolutionStatus !== "LINKED") {
        context.addIssue({
          code: "custom",
          message:
            "A staff-created request must be linked to the selected customer.",
          path: ["customerResolutionStatus"],
        });
      }
    }

    if (value.propertyId && !value.customerId) {
      context.addIssue({
        code: "custom",
        message: "A property can be selected only with customer context.",
        path: ["propertyId"],
      });
    }
  });

const storedPriceLineSchema = z
  .object({
    kind: nonBlank(64),
    label: nonBlank(255),
    amountMinorUnits: z
      .number()
      .int()
      .min(Number.MIN_SAFE_INTEGER)
      .max(Number.MAX_SAFE_INTEGER),
    ruleId: nonBlank(160),
  })
  .strict();

export const storedPriceSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    calculatedAt: z.iso.datetime({ offset: true }),
    priceBook: z
      .object({
        id: nonBlank(160),
        code: nonBlank(96),
        version: positiveVersion,
        status: nonBlank(32),
        provisional: z.boolean(),
        approvedForPublication: z.boolean(),
      })
      .strict(),
    configuration: boundedJsonObject(256_000),
    input: boundedJsonObject(128_000),
    result: z
      .object({
        lines: z.array(storedPriceLineSchema).max(1_000),
        subtotalMinorUnits: minorUnits,
        minimumVisitAdjustmentMinorUnits: minorUnits.nullable(),
        netAmountMinorUnits: minorUnits.nullable(),
        vatRateBasisPoints,
        vatAmountMinorUnits: minorUnits.nullable(),
        grossTotalMinorUnits: minorUnits.nullable(),
        currency: z.literal("EUR"),
        warnings: z.array(nonBlank(1_000)).max(100),
        manualAssessmentRequired: z.boolean(),
        declineOrReferRequired: z.boolean(),
        appliedRuleIds: z.array(nonBlank(160)).max(1_000),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    const { netAmountMinorUnits, vatAmountMinorUnits, grossTotalMinorUnits } =
      value.result;
    const allNull =
      netAmountMinorUnits === null &&
      vatAmountMinorUnits === null &&
      grossTotalMinorUnits === null;
    const allPresent =
      netAmountMinorUnits !== null &&
      vatAmountMinorUnits !== null &&
      grossTotalMinorUnits !== null;

    if (!allNull && !allPresent) {
      context.addIssue({
        code: "custom",
        message: "Price totals must be all present or all withheld for review.",
        path: ["result", "grossTotalMinorUnits"],
      });
    }
    if (
      allPresent &&
      grossTotalMinorUnits !== netAmountMinorUnits + vatAmountMinorUnits
    ) {
      context.addIssue({
        code: "custom",
        message: "Gross total must equal net plus VAT.",
        path: ["result", "grossTotalMinorUnits"],
      });
    }
    if (
      value.result.declineOrReferRequired &&
      !value.result.manualAssessmentRequired
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Decline-or-refer calculations must require manual assessment.",
        path: ["result", "declineOrReferRequired"],
      });
    }
  });

const storedDurationLineSchema = z
  .object({
    kind: nonBlank(64),
    label: nonBlank(255),
    minutes: z.number().int().min(0).max(1_000_000),
    ruleId: nonBlank(160),
  })
  .strict();

export const storedDurationSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    calculatedAt: z.iso.datetime({ offset: true }),
    durationModel: z
      .object({
        id: nonBlank(160),
        code: nonBlank(96),
        version: positiveVersion,
        status: nonBlank(32),
        provisional: z.boolean(),
      })
      .strict(),
    configuration: boundedJsonObject(256_000),
    input: boundedJsonObject(128_000),
    result: z
      .object({
        lines: z.array(storedDurationLineSchema).max(1_000),
        setupMinutes: z.number().int().min(0).max(1_000_000),
        inspectionMinutes: z.number().int().min(0).max(1_000_000),
        baseCleaningMinutes: z.number().int().min(0).max(1_000_000),
        modifierMinutes: z.number().int().min(0).max(1_000_000),
        addonMinutes: z.number().int().min(0).max(1_000_000),
        cleanupMinutes: z.number().int().min(0).max(1_000_000),
        partialEstimatedMinutes: z.number().int().min(0).max(1_000_000),
        totalEstimatedMinutes: z
          .number()
          .int()
          .min(0)
          .max(1_000_000)
          .nullable(),
        warnings: z.array(nonBlank(1_000)).max(100),
        manualAssessmentRequired: z.boolean(),
        declineOrReferRequired: z.boolean(),
        appliedRuleIds: z.array(nonBlank(160)).max(1_000),
      })
      .strict(),
  })
  .strict()
  .refine(
    (value) =>
      !value.result.declineOrReferRequired ||
      value.result.manualAssessmentRequired,
    {
      message: "Decline-or-refer calculations must require manual assessment.",
      path: ["result", "declineOrReferRequired"],
    },
  );

export const storedAvailabilitySnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    calculatedAt: z.iso.datetime({ offset: true }),
    configuration: boundedJsonObject(256_000),
    result: z
      .object({
        serviceEligible: z.boolean().nullable(),
        manualConfirmationRequired: z.boolean(),
        schedulingConfigurationReady: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const createRequestEstimateInputSchema = z
  .object({
    requestId: uuid,
    estimateVersion: positiveVersion,
    status: z.enum(estimateStatuses),
    priceBookId: positiveReferenceId,
    priceBookCode: nonBlank(96),
    priceBookVersion: positiveVersion,
    durationModelId: positiveReferenceId,
    durationModelCode: nonBlank(96),
    durationModelVersion: positiveVersion,
    inputSnapshot: boundedJsonObject(128_000),
    priceSnapshot: storedPriceSnapshotSchema,
    durationSnapshot: storedDurationSnapshotSchema,
    availabilitySnapshot: storedAvailabilitySnapshotSchema,
    netAmountMinorUnits: minorUnits.nullable(),
    vatRateBasisPoints,
    vatAmountMinorUnits: minorUnits.nullable(),
    grossTotalMinorUnits: minorUnits.nullable(),
    currency: z.literal("EUR"),
    estimatedServiceMinutes: z.number().int().min(0).max(1_000_000).nullable(),
    estimatedTravelMinutes: z.number().int().min(0).max(1_000_000).nullable(),
    manualAssessmentRequired: z.boolean(),
    declineOrReferRequired: z.boolean(),
    warnings: z.array(nonBlank(1_000)).max(200),
    reviewReasonCodes: z.array(nonBlank(96)).min(0).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    const engineManualAssessment =
      value.priceSnapshot.result.manualAssessmentRequired ||
      value.durationSnapshot.result.manualAssessmentRequired;
    const expectedManualAssessment =
      engineManualAssessment || value.reviewReasonCodes.length > 0;
    const expectedDeclineOrRefer =
      value.priceSnapshot.result.declineOrReferRequired ||
      value.durationSnapshot.result.declineOrReferRequired ||
      value.availabilitySnapshot.result.serviceEligible === false;
    if (
      value.manualAssessmentRequired !== expectedManualAssessment ||
      value.declineOrReferRequired !== expectedDeclineOrRefer
    ) {
      context.addIssue({
        code: "custom",
        message: "Estimate review flags must preserve both engine outcomes.",
        path: ["manualAssessmentRequired"],
      });
    }
    const expectedStatus = value.declineOrReferRequired
      ? "DECLINE_OR_REFER"
      : value.manualAssessmentRequired
        ? "REVIEW_REQUIRED"
        : "CALCULATED";
    if (value.status !== expectedStatus) {
      context.addIssue({
        code: "custom",
        message: "Estimate status must match its manual-review outcome.",
        path: ["status"],
      });
    }
    if (
      value.priceBookCode !== value.priceSnapshot.priceBook.code ||
      value.priceBookVersion !== value.priceSnapshot.priceBook.version
    ) {
      context.addIssue({
        code: "custom",
        message: "Price-book scalar provenance must match the stored snapshot.",
        path: ["priceBookCode"],
      });
    }
    if (
      value.durationModelCode !== value.durationSnapshot.durationModel.code ||
      value.durationModelVersion !==
        value.durationSnapshot.durationModel.version
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Duration-model scalar provenance must match the stored snapshot.",
        path: ["durationModelCode"],
      });
    }
    const scalarTotals = [
      value.netAmountMinorUnits,
      value.vatAmountMinorUnits,
      value.grossTotalMinorUnits,
    ];
    const snapshotTotals = [
      value.priceSnapshot.result.netAmountMinorUnits,
      value.priceSnapshot.result.vatAmountMinorUnits,
      value.priceSnapshot.result.grossTotalMinorUnits,
    ];
    if (
      scalarTotals.some((amount, index) => amount !== snapshotTotals[index])
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Searchable estimate totals must match the immutable price snapshot.",
        path: ["grossTotalMinorUnits"],
      });
    }
    if (
      value.estimatedServiceMinutes !==
      value.durationSnapshot.result.totalEstimatedMinutes
    ) {
      context.addIssue({
        code: "custom",
        message: "Service minutes must match the immutable duration snapshot.",
        path: ["estimatedServiceMinutes"],
      });
    }
  });

export const quoteLineInputSchema = z
  .object({
    requestItemId: optionalUuid,
    serviceId: optionalReferenceId,
    cleaningItemTypeId: optionalReferenceId,
    measurementModeId: optionalReferenceId,
    descriptionBg: nonBlank(2_000),
    descriptionEn: nonBlank(2_000),
    quantity: z.number().int().positive().max(100_000),
    measurementSnapshot: boundedJsonObject(32_000),
    baseAmountMinorUnits: minorUnits,
    modifierAmountMinorUnits: z
      .number()
      .int()
      .min(Number.MIN_SAFE_INTEGER)
      .max(Number.MAX_SAFE_INTEGER),
    addonAmountMinorUnits: minorUnits,
    netAmountMinorUnits: minorUnits,
    vatRateBasisPoints,
    vatAmountMinorUnits: minorUnits,
    grossTotalMinorUnits: minorUnits,
    calculationSnapshot: boundedJsonObject(64_000),
    sortOrder: z.number().int().min(0).max(10_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.baseAmountMinorUnits +
        value.modifierAmountMinorUnits +
        value.addonAmountMinorUnits !==
      value.netAmountMinorUnits
    ) {
      context.addIssue({
        code: "custom",
        message: "Quote line net must equal base plus modifiers and add-ons.",
        path: ["netAmountMinorUnits"],
      });
    }
    if (
      value.grossTotalMinorUnits !==
      value.netAmountMinorUnits + value.vatAmountMinorUnits
    ) {
      context.addIssue({
        code: "custom",
        message: "Quote line gross must equal net plus VAT.",
        path: ["grossTotalMinorUnits"],
      });
    }
  });

export const createQuoteDraftInputSchema = z
  .object({
    requestId: uuid,
    customerId: uuid,
    propertyId: optionalUuid,
    estimateId: uuid,
    quoteVersion: positiveVersion,
    currency: z.literal("EUR"),
    priceBasis: z.enum(["NET", "GROSS"]),
    netAmountMinorUnits: minorUnits,
    vatRateBasisPoints,
    vatAmountMinorUnits: minorUnits,
    grossTotalMinorUnits: minorUnits,
    estimatedDurationMinutes: z.number().int().min(0).max(1_000_000).nullable(),
    commercialSnapshot: boundedJsonObject(384_000),
    termsSnapshot: boundedJsonObject(128_000),
    validFrom: z.date(),
    validUntil: z.date(),
    staffNotes: optionalText(4_000),
    customerNotes: optionalText(4_000),
    items: z.array(quoteLineInputSchema).min(1).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.grossTotalMinorUnits !==
      value.netAmountMinorUnits + value.vatAmountMinorUnits
    ) {
      context.addIssue({
        code: "custom",
        message: "Quote gross must equal net plus VAT.",
        path: ["grossTotalMinorUnits"],
      });
    }
    if (value.validUntil <= value.validFrom) {
      context.addIssue({
        code: "custom",
        message: "Quote validity must end after it starts.",
        path: ["validUntil"],
      });
    }
    if (
      new Set(value.items.map((item) => item.sortOrder)).size !==
      value.items.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Quote item sort orders must be unique.",
        path: ["items"],
      });
    }
  });

export type CreateServiceRequestInput = z.infer<
  typeof createServiceRequestInputSchema
>;
export type CreateRequestEstimateInput = z.infer<
  typeof createRequestEstimateInputSchema
>;
export type CreateQuoteDraftInput = z.infer<typeof createQuoteDraftInputSchema>;
