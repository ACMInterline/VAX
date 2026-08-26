import { z } from "zod";
import { isCustomerVisibleQuoteTextAllowed } from "@/content/public-site/claims";
import {
  itemResolutionReasonCategories,
  jobCancellationReasonCategories,
  jobStatuses,
  treatmentPlanDecisions,
  treatmentResultClassifications,
} from "./types";

const uuid = z.uuid();
const positiveReferenceId = z.number().int().positive().max(2_147_483_647);
const positiveVersion = z.number().int().positive().max(2_147_483_647);
const nonBlank = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .nullable()
    .transform((value) => value?.trim() || null);

const customerVisibleText = (maximum: number) =>
  nonBlank(maximum).refine(isCustomerVisibleQuoteTextAllowed, {
    message: "Customer-visible text exceeds the approved claim boundary.",
  });

const optionalCustomerVisibleText = (maximum: number) =>
  optionalText(maximum).refine(
    (value) => value === null || isCustomerVisibleQuoteTextAllowed(value),
    { message: "Customer-visible text exceeds the approved claim boundary." },
  );

const distinctPositiveReferenceIds = z
  .array(positiveReferenceId)
  .max(100)
  .default([])
  .refine((values) => new Set(values).size === values.length, {
    message: "Reference identifiers must be unique.",
  })
  .transform((values) => [...values].sort((left, right) => left - right));

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
    );
  }, "Date must be a real calendar date in YYYY-MM-DD format.");

export const jobReferenceSchema = z.string().regex(/^JOB-[A-F0-9]{24}$/);
export const bookingReferenceSchema = z.string().regex(/^BKG-[A-F0-9]{24}$/);

export const createJobFromBookingSchema = z
  .object({
    bookingReference: bookingReferenceSchema,
    expectedBookingVersion: positiveVersion,
  })
  .strict();

export const assignJobTeamSchema = z
  .object({
    jobReference: jobReferenceSchema,
    operationsTeamId: positiveReferenceId,
    expectedJobVersion: positiveVersion,
  })
  .strict();

export const jobVersionCommandSchema = z
  .object({
    jobReference: jobReferenceSchema,
    expectedJobVersion: positiveVersion,
  })
  .strict();

export const jobItemVersionCommandSchema = z
  .object({
    jobReference: jobReferenceSchema,
    jobItemId: uuid,
    expectedJobVersion: positiveVersion,
    expectedJobItemVersion: positiveVersion,
  })
  .strict();

export const observedMeasurementSchema = z
  .object({
    measurementModeId: positiveReferenceId,
    quantity: z.number().int().positive().max(100_000),
    areaHundredthsM2: z
      .number()
      .int()
      .positive()
      .max(100_000_000)
      .nullable(),
    seatCount: z.number().int().positive().max(10_000).nullable(),
    sides: z.union([z.literal(1), z.literal(2)]).nullable(),
  })
  .strict();

const inspectionIssueSchema = z
  .object({
    issueTypeId: positiveReferenceId,
    technicianNote: optionalText(1_000),
  })
  .strict();

const inspectionRiskSchema = z
  .object({
    riskFlagId: positiveReferenceId,
    technicianNote: optionalText(1_000),
  })
  .strict();

function hasDistinctReferences<T>(
  values: readonly T[],
  select: (value: T) => number,
): boolean {
  return new Set(values.map(select)).size === values.length;
}

export const recordJobItemInspectionSchema = z
  .object({
    jobReference: jobReferenceSchema,
    jobItemId: uuid,
    expectedJobVersion: positiveVersion,
    expectedJobItemVersion: positiveVersion,
    observedCleaningItemTypeId: positiveReferenceId,
    observedMeasurement: observedMeasurementSchema,
    observedConditionLevelId: positiveReferenceId,
    confirmedFibreMaterialId: positiveReferenceId,
    confirmedSurfaceConstructionId: positiveReferenceId,
    existingDamageObserved: z.boolean(),
    existingDamageNotes: optionalText(2_000),
    colourfastnessConcern: z.boolean(),
    moistureSensitivity: z.boolean(),
    unsafeContaminationObserved: z.boolean(),
    unsafeStructuralConditionObserved: z.boolean(),
    technicianNotes: optionalText(4_000),
    issues: z.array(inspectionIssueSchema).max(50).default([]),
    risks: z.array(inspectionRiskSchema).max(50).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.existingDamageObserved && !value.existingDamageNotes) {
      context.addIssue({
        code: "custom",
        message: "Existing damage requires a recorded observation.",
        path: ["existingDamageNotes"],
      });
    }
    if (!value.existingDamageObserved && value.existingDamageNotes) {
      context.addIssue({
        code: "custom",
        message: "Damage notes require an existing-damage observation.",
        path: ["existingDamageNotes"],
      });
    }
    if (!hasDistinctReferences(value.issues, (issue) => issue.issueTypeId)) {
      context.addIssue({
        code: "custom",
        message: "Issue references must be unique.",
        path: ["issues"],
      });
    }
    if (!hasDistinctReferences(value.risks, (risk) => risk.riskFlagId)) {
      context.addIssue({
        code: "custom",
        message: "Risk references must be unique.",
        path: ["risks"],
      });
    }
  });

export const confirmJobItemTreatmentPlanSchema = z
  .object({
    jobReference: jobReferenceSchema,
    jobItemId: uuid,
    expectedJobVersion: positiveVersion,
    expectedJobItemVersion: positiveVersion,
    sourceInspectionId: uuid,
    decision: z.enum(treatmentPlanDecisions),
    treatmentLevelId: positiveReferenceId.nullable(),
    mechanicalActionLevelId: positiveReferenceId.nullable(),
    treatmentApproachId: positiveReferenceId.nullable(),
    addonIds: distinctPositiveReferenceIds,
    cleaningProductId: positiveReferenceId.nullable(),
    technicianRationale: nonBlank(2_000),
  })
  .strict()
  .superRefine((value, context) => {
    const performs =
      value.decision === "PERFORM" ||
      value.decision === "PERFORM_WITH_LIMITATIONS";
    const technicalReferences = [
      value.treatmentLevelId,
      value.mechanicalActionLevelId,
      value.treatmentApproachId,
    ];

    if (performs && technicalReferences.some((reference) => reference === null)) {
      context.addIssue({
        code: "custom",
        message: "A performed plan requires complete treatment references.",
        path: ["treatmentLevelId"],
      });
    }
    if (
      !performs &&
      (technicalReferences.some((reference) => reference !== null) ||
        value.addonIds.length > 0 ||
        value.cleaningProductId !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "A non-performed plan cannot carry treatment execution data.",
        path: ["decision"],
      });
    }
  });

export const resolveJobItemWithoutTreatmentSchema = z
  .object({
    jobReference: jobReferenceSchema,
    jobItemId: uuid,
    expectedJobVersion: positiveVersion,
    expectedJobItemVersion: positiveVersion,
    treatmentPlanId: uuid,
    resolution: z.enum(["DECLINED", "REFERRED"]),
    reasonCategory: z.enum(itemResolutionReasonCategories),
    reasonNotes: nonBlank(2_000),
  })
  .strict();

export const startJobItemTreatmentSchema = z
  .object({
    jobReference: jobReferenceSchema,
    jobItemId: uuid,
    expectedJobVersion: positiveVersion,
    expectedJobItemVersion: positiveVersion,
    treatmentPlanId: uuid,
  })
  .strict();

export const completeJobItemTreatmentSchema = z
  .object({
    jobReference: jobReferenceSchema,
    jobItemId: uuid,
    expectedJobVersion: positiveVersion,
    expectedJobItemVersion: positiveVersion,
    treatmentExecutionId: uuid,
    expectedTreatmentExecutionVersion: positiveVersion,
    performedTreatmentLevelId: positiveReferenceId,
    performedMechanicalActionLevelId: positiveReferenceId,
    performedTreatmentApproachId: positiveReferenceId,
    performedAddonIds: distinctPositiveReferenceIds,
    cleaningProductId: positiveReferenceId.nullable(),
    technicianNotes: optionalText(4_000),
    resultClassification: z.enum(treatmentResultClassifications),
  })
  .strict();

const maintenanceRecommendationSchema = z
  .object({
    recommendedReviewDate: dateOnlySchema.nullable(),
    suggestedIntervalMonths: z.number().int().min(1).max(120).nullable(),
    reason: customerVisibleText(1_000),
    sourceType: z.literal("TECHNICIAN_ASSESSMENT"),
  })
  .strict()
  .refine(
    (value) =>
      value.recommendedReviewDate !== null ||
      value.suggestedIntervalMonths !== null,
    {
      message: "A maintenance recommendation needs a date or interval.",
      path: ["recommendedReviewDate"],
    },
  );

export const completeJobSchema = z
  .object({
    jobReference: jobReferenceSchema,
    expectedJobVersion: positiveVersion,
    internalCompletionNotes: nonBlank(4_000),
    customerVisibleCompletionNotes: optionalCustomerVisibleText(2_000),
    customerVisibleCareNotes: optionalCustomerVisibleText(2_000),
    maintenanceRecommendations: z
      .array(
        z
          .object({
            jobItemId: uuid,
            recommendation: maintenanceRecommendationSchema,
          })
          .strict(),
      )
      .max(50)
      .default([])
      .refine(
        (values) =>
          new Set(values.map((value) => value.jobItemId)).size === values.length,
        { message: "Each Job item may have at most one recommendation." },
      )
      .transform((values) =>
        [...values].sort((left, right) =>
          left.jobItemId.localeCompare(right.jobItemId),
        ),
      ),
  })
  .strict();

export const cancelJobSchema = z
  .object({
    jobReference: jobReferenceSchema,
    expectedJobVersion: positiveVersion,
    reasonCategory: z.enum(jobCancellationReasonCategories),
    reasonText: optionalText(1_000),
  })
  .strict()
  .refine(
    (value) => value.reasonCategory !== "OTHER" || value.reasonText !== null,
    { message: "A reason is required for OTHER.", path: ["reasonText"] },
  );

export const jobListSchema = z
  .object({
    search: z.string().trim().max(160).optional(),
    status: z.enum(jobStatuses).optional(),
    teamId: positiveReferenceId.optional(),
    scheduledFrom: z.date().optional(),
    scheduledTo: z.date().optional(),
    manualReviewRequired: z.boolean().optional(),
    limit: z.number().int().min(1).max(100),
    offset: z.number().int().min(0).max(100_000),
  })
  .strict()
  .refine(
    (value) =>
      !value.scheduledFrom ||
      !value.scheduledTo ||
      value.scheduledFrom < value.scheduledTo,
    { message: "Invalid scheduling date range.", path: ["scheduledTo"] },
  );

export const cleaningPassportRouteSchema = z
  .object({ propertyId: uuid, assetId: uuid })
  .strict();

export type CreateJobFromBookingInput = z.infer<
  typeof createJobFromBookingSchema
>;
export type AssignJobTeamInput = z.infer<typeof assignJobTeamSchema>;
export type JobVersionCommandInput = z.infer<typeof jobVersionCommandSchema>;
export type JobItemVersionCommandInput = z.infer<
  typeof jobItemVersionCommandSchema
>;
export type RecordJobItemInspectionInput = z.infer<
  typeof recordJobItemInspectionSchema
>;
export type ConfirmJobItemTreatmentPlanInput = z.infer<
  typeof confirmJobItemTreatmentPlanSchema
>;
export type ResolveJobItemWithoutTreatmentInput = z.infer<
  typeof resolveJobItemWithoutTreatmentSchema
>;
export type StartJobItemTreatmentInput = z.infer<
  typeof startJobItemTreatmentSchema
>;
export type CompleteJobItemTreatmentInput = z.infer<
  typeof completeJobItemTreatmentSchema
>;
export type CompleteJobInput = z.infer<typeof completeJobSchema>;
export type CancelJobInput = z.infer<typeof cancelJobSchema>;
export type JobListQuery = z.infer<typeof jobListSchema>;
