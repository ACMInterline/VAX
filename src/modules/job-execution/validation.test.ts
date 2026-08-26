import { describe, expect, it } from "vitest";
import {
  assignJobTeamSchema,
  cancelJobSchema,
  cleaningPassportRouteSchema,
  completeJobItemTreatmentSchema,
  completeJobSchema,
  confirmJobItemTreatmentPlanSchema,
  createJobFromBookingSchema,
  jobListSchema,
  jobReferenceSchema,
  jobVersionCommandSchema,
  recordJobItemInspectionSchema,
  resolveJobItemWithoutTreatmentSchema,
  startJobItemTreatmentSchema,
} from "./validation";

const jobReference = "JOB-000000000000000000000001";
const bookingReference = "BKG-000000000000000000000001";
const jobItemId = "10000000-0000-4000-8000-000000000001";
const inspectionId = "20000000-0000-4000-8000-000000000001";
const treatmentPlanId = "30000000-0000-4000-8000-000000000001";
const executionId = "40000000-0000-4000-8000-000000000001";

const versionEvidence = {
  jobReference,
  jobItemId,
  expectedJobVersion: 2,
  expectedJobItemVersion: 3,
} as const;

const validInspection = {
  ...versionEvidence,
  observedCleaningItemTypeId: 1,
  observedMeasurement: {
    measurementModeId: 1,
    quantity: 1,
    areaHundredthsM2: 1_200,
    seatCount: null,
    sides: null,
  },
  observedConditionLevelId: 2,
  confirmedFibreMaterialId: 3,
  confirmedSurfaceConstructionId: 4,
  existingDamageObserved: false,
  existingDamageNotes: null,
  colourfastnessConcern: false,
  moistureSensitivity: false,
  unsafeContaminationObserved: false,
  unsafeStructuralConditionObserved: false,
  technicianNotes: null,
  issues: [{ issueTypeId: 5, technicianNote: "  Observed on the left side.  " }],
  risks: [{ riskFlagId: 6, technicianNote: null }],
} as const;

describe("Job command validation", () => {
  it("accepts only safe Booking and Job references with optimistic versions", () => {
    expect(
      createJobFromBookingSchema.parse({
        bookingReference,
        expectedBookingVersion: 4,
      }),
    ).toEqual({ bookingReference, expectedBookingVersion: 4 });
    expect(jobReferenceSchema.parse(jobReference)).toBe(jobReference);

    for (const unsafe of [
      "JOB-1",
      "job-000000000000000000000001",
      "JOB-00000000000000000000000g",
      "BKG-000000000000000000000001",
    ]) {
      expect(jobReferenceSchema.safeParse(unsafe).success).toBe(false);
    }
    expect(
      createJobFromBookingSchema.safeParse({
        bookingReference,
        expectedBookingVersion: 0,
      }).success,
    ).toBe(false);
  });

  it("rejects mass assignment and every client-supplied authority or timestamp", () => {
    expect(
      createJobFromBookingSchema.safeParse({
        bookingReference,
        expectedBookingVersion: 1,
        jobReference,
        customerId: jobItemId,
      }).success,
    ).toBe(false);
    expect(
      assignJobTeamSchema.safeParse({
        jobReference,
        operationsTeamId: 1,
        expectedJobVersion: 1,
        assignedByProfileId: jobItemId,
      }).success,
    ).toBe(false);
    expect(
      jobVersionCommandSchema.safeParse({
        jobReference,
        expectedJobVersion: 1,
        arrivedAt: "2026-08-25T12:00:00.000Z",
        targetStatus: "COMPLETED",
      }).success,
    ).toBe(false);
  });

  it("requires an integer operations-team reference", () => {
    expect(
      assignJobTeamSchema.parse({
        jobReference,
        operationsTeamId: 7,
        expectedJobVersion: 2,
      }),
    ).toEqual({
      jobReference,
      operationsTeamId: 7,
      expectedJobVersion: 2,
    });
    expect(
      assignJobTeamSchema.safeParse({
        jobReference,
        operationsTeamId: "20000000-0000-4000-8000-000000000001",
        expectedJobVersion: 2,
      }).success,
    ).toBe(false);
  });
});

describe("inspection validation", () => {
  it("keeps observation input separate, bounded and trimmed", () => {
    expect(recordJobItemInspectionSchema.parse(validInspection)).toMatchObject({
      observedCleaningItemTypeId: 1,
      observedConditionLevelId: 2,
      issues: [
        { issueTypeId: 5, technicianNote: "Observed on the left side." },
      ],
    });
  });

  it("requires explicit notes for existing damage", () => {
    expect(
      recordJobItemInspectionSchema.safeParse({
        ...validInspection,
        existingDamageObserved: true,
        existingDamageNotes: null,
      }).success,
    ).toBe(false);
    expect(
      recordJobItemInspectionSchema.safeParse({
        ...validInspection,
        existingDamageObserved: true,
        existingDamageNotes: "  Loose seam near the rear edge.  ",
      }).success,
    ).toBe(true);
    expect(
      recordJobItemInspectionSchema.safeParse({
        ...validInspection,
        existingDamageObserved: false,
        existingDamageNotes: "Loose seam near the rear edge.",
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate taxonomy links and hidden cross-record authority", () => {
    expect(
      recordJobItemInspectionSchema.safeParse({
        ...validInspection,
        issues: [
          { issueTypeId: 5, technicianNote: null },
          { issueTypeId: 5, technicianNote: "duplicate" },
        ],
      }).success,
    ).toBe(false);
    expect(
      recordJobItemInspectionSchema.safeParse({
        ...validInspection,
        inspectedAt: "2026-08-25T12:00:00.000Z",
        inspectedByProfileId: jobItemId,
      }).success,
    ).toBe(false);
  });

  it("bounds measurements and controlled reference identifiers", () => {
    expect(
      recordJobItemInspectionSchema.safeParse({
        ...validInspection,
        observedMeasurement: {
          ...validInspection.observedMeasurement,
          areaHundredthsM2: 100_000_001,
        },
      }).success,
    ).toBe(false);
    expect(
      recordJobItemInspectionSchema.safeParse({
        ...validInspection,
        observedConditionLevelId: -1,
      }).success,
    ).toBe(false);
  });
});

describe("treatment planning and execution validation", () => {
  const performingPlan = {
    ...versionEvidence,
    sourceInspectionId: inspectionId,
    decision: "PERFORM",
    treatmentLevelId: 1,
    mechanicalActionLevelId: 2,
    treatmentApproachId: 3,
    addonIds: [4],
    cleaningProductId: null,
    technicianRationale: "  Inspection supports the quoted scope.  ",
  } as const;

  it("requires complete technical references only for performed work", () => {
    expect(confirmJobItemTreatmentPlanSchema.parse(performingPlan)).toMatchObject(
      {
        decision: "PERFORM",
        technicianRationale: "Inspection supports the quoted scope.",
      },
    );
    expect(
      confirmJobItemTreatmentPlanSchema.safeParse({
        ...performingPlan,
        treatmentLevelId: null,
      }).success,
    ).toBe(false);
    expect(
      confirmJobItemTreatmentPlanSchema.safeParse({
        ...performingPlan,
        decision: "REFER",
      }).success,
    ).toBe(false);
    expect(
      confirmJobItemTreatmentPlanSchema.safeParse({
        ...performingPlan,
        decision: "REFER",
        treatmentLevelId: null,
        mechanicalActionLevelId: null,
        treatmentApproachId: null,
        addonIds: [],
      }).success,
    ).toBe(true);
  });

  it("keeps material-scope classification server-owned", () => {
    expect(
      confirmJobItemTreatmentPlanSchema.safeParse({
        ...performingPlan,
        materialScopeChange: true,
      }).success,
    ).toBe(false);
    expect(
      confirmJobItemTreatmentPlanSchema.safeParse({
        ...performingPlan,
        decision: "REQUIRES_REVIEW",
        treatmentLevelId: null,
        mechanicalActionLevelId: null,
        treatmentApproachId: null,
        addonIds: [],
        cleaningProductId: null,
      }).success,
    ).toBe(true);
  });

  it("validates explicit decline/referral without accepting an arbitrary status", () => {
    expect(
      resolveJobItemWithoutTreatmentSchema.parse({
        ...versionEvidence,
        treatmentPlanId,
        resolution: "REFERRED",
        reasonCategory: "SPECIALIST_HANDLING_REQUIRED",
        reasonNotes: "  Refer for specialist material assessment.  ",
      }),
    ).toMatchObject({
      resolution: "REFERRED",
      reasonNotes: "Refer for specialist material assessment.",
    });
    expect(
      resolveJobItemWithoutTreatmentSchema.safeParse({
        ...versionEvidence,
        treatmentPlanId,
        resolution: "COMPLETED",
        reasonCategory: "OTHER_RECORDED",
        reasonNotes: "not valid",
      }).success,
    ).toBe(false);
  });

  it("starts from an exact plan and never accepts a browser start time", () => {
    expect(
      startJobItemTreatmentSchema.safeParse({
        ...versionEvidence,
        treatmentPlanId,
      }).success,
    ).toBe(true);
    expect(
      startJobItemTreatmentSchema.safeParse({
        ...versionEvidence,
        treatmentPlanId,
        startedAt: "2026-08-25T12:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("records actual execution without accepting actor, time or financial input", () => {
    const execution = {
      ...versionEvidence,
      treatmentExecutionId: executionId,
      expectedTreatmentExecutionVersion: 1,
      performedTreatmentLevelId: 1,
      performedMechanicalActionLevelId: 2,
      performedTreatmentApproachId: 3,
      performedAddonIds: [4],
      cleaningProductId: null,
      technicianNotes: null,
      resultClassification: "PARTIAL_IMPROVEMENT",
    } as const;
    expect(completeJobItemTreatmentSchema.safeParse(execution).success).toBe(
      true,
    );
    for (const injected of [
      { completedAt: "2026-08-25T13:00:00.000Z" },
      { performedByProfileId: jobItemId },
      { priceMinorUnits: 10_000 },
      { quoteAdjustment: true },
    ]) {
      expect(
        completeJobItemTreatmentSchema.safeParse({ ...execution, ...injected })
          .success,
      ).toBe(false);
    }
  });

  it("canonicalizes add-on sets so equivalent retries remain idempotent", () => {
    const parsed = completeJobItemTreatmentSchema.parse({
      ...versionEvidence,
      treatmentExecutionId: executionId,
      expectedTreatmentExecutionVersion: 1,
      performedTreatmentLevelId: 1,
      performedMechanicalActionLevelId: 2,
      performedTreatmentApproachId: 3,
      performedAddonIds: [9, 4, 7],
      cleaningProductId: null,
      technicianNotes: null,
      resultClassification: "COMPLETED_AS_PLANNED",
    });

    expect(parsed.performedAddonIds).toEqual([4, 7, 9]);
  });
});

describe("completion and Cleaning Passport input validation", () => {
  const validCompletion = {
    jobReference,
    expectedJobVersion: 8,
    internalCompletionNotes: "All resolved items checked before completion.",
    customerVisibleCompletionNotes: "Treatment was completed as recorded.",
    customerVisibleCareNotes: "Allow the surface to dry before normal use.",
    maintenanceRecommendations: [
      {
        jobItemId,
        recommendation: {
          recommendedReviewDate: "2027-02-25",
          suggestedIntervalMonths: null,
          reason: "Review based on this item's observed use and condition.",
          sourceType: "TECHNICIAN_ASSESSMENT",
        },
      },
    ],
  } as const;

  it("accepts bounded qualified customer-facing completion text", () => {
    expect(completeJobSchema.safeParse(validCompletion).success).toBe(true);
  });

  it("rejects prohibited efficacy claims while leaving internal notes internal", () => {
    expect(
      completeJobSchema.safeParse({
        ...validCompletion,
        customerVisibleCareNotes: "Guaranteed stain removal and sterilisation.",
      }).success,
    ).toBe(false);
    expect(
      completeJobSchema.safeParse({
        ...validCompletion,
        internalCompletionNotes:
          "Internal safety wording may be recorded without publication.",
      }).success,
    ).toBe(true);
  });

  it("keeps maintenance advice explicit, nullable and non-universal", () => {
    expect(
      completeJobSchema.safeParse({
        ...validCompletion,
        maintenanceRecommendations: [],
      }).success,
    ).toBe(true);
    expect(
      completeJobSchema.safeParse({
        ...validCompletion,
        maintenanceRecommendations: [
          {
            jobItemId,
            recommendation: {
              recommendedReviewDate: null,
              suggestedIntervalMonths: null,
              reason: "No evidence-based interval supplied.",
              sourceType: "TECHNICIAN_ASSESSMENT",
            },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("canonicalizes maintenance recommendation order for completion retries", () => {
    const secondItemId = "21000000-0000-4000-8000-000000000002";
    const parsed = completeJobSchema.parse({
      ...validCompletion,
      maintenanceRecommendations: [
        {
          jobItemId: secondItemId,
          recommendation: {
            recommendedReviewDate: null,
            suggestedIntervalMonths: 6,
            reason: "Review based on this item's observed use.",
            sourceType: "TECHNICIAN_ASSESSMENT",
          },
        },
        validCompletion.maintenanceRecommendations[0],
      ],
    });

    expect(parsed.maintenanceRecommendations.map((value) => value.jobItemId))
      .toEqual([jobItemId, secondItemId]);
  });

  it("rejects duplicate recommendations and client-owned duration/time fields", () => {
    expect(
      completeJobSchema.safeParse({
        ...validCompletion,
        maintenanceRecommendations: [
          validCompletion.maintenanceRecommendations[0],
          validCompletion.maintenanceRecommendations[0],
        ],
      }).success,
    ).toBe(false);
    expect(
      completeJobSchema.safeParse({
        ...validCompletion,
        actualProductiveMinutes: 30,
        completedAt: "2026-08-25T13:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});

describe("cancellation, list and route validation", () => {
  it("requires a reason only for OTHER cancellation and accepts no timestamp", () => {
    expect(
      cancelJobSchema.safeParse({
        jobReference,
        expectedJobVersion: 1,
        reasonCategory: "OPERATIONAL",
        reasonText: null,
      }).success,
    ).toBe(true);
    expect(
      cancelJobSchema.safeParse({
        jobReference,
        expectedJobVersion: 1,
        reasonCategory: "OTHER",
        reasonText: null,
      }).success,
    ).toBe(false);
    expect(
      cancelJobSchema.safeParse({
        jobReference,
        expectedJobVersion: 1,
        reasonCategory: "OTHER",
        reasonText: "Recorded exceptional reason.",
        cancelledAt: "2026-08-25T12:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("bounds and orders Job-list filters", () => {
    expect(
      jobListSchema.parse({
        search: "  JOB-000  ",
        teamId: 1,
        scheduledFrom: new Date("2026-09-01T00:00:00.000Z"),
        scheduledTo: new Date("2026-10-01T00:00:00.000Z"),
        limit: 25,
        offset: 0,
      }),
    ).toMatchObject({ search: "JOB-000", teamId: 1, limit: 25, offset: 0 });
    expect(
      jobListSchema.safeParse({
        scheduledFrom: new Date("2026-10-01T00:00:00.000Z"),
        scheduledTo: new Date("2026-09-01T00:00:00.000Z"),
        limit: 25,
        offset: 0,
      }).success,
    ).toBe(false);
    expect(jobListSchema.safeParse({ limit: 101, offset: 0 }).success).toBe(
      false,
    );
  });

  it("requires both exact scoped route identifiers", () => {
    expect(
      cleaningPassportRouteSchema.safeParse({
        propertyId: jobItemId,
        assetId: inspectionId,
      }).success,
    ).toBe(true);
    expect(
      cleaningPassportRouteSchema.safeParse({
        propertyId: jobItemId,
        assetId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });
});
