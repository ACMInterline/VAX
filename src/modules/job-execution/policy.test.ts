import { describe, expect, it } from "vitest";
import {
  rolePermissionMatrix,
  type ApplicationRoleCode,
  type PermissionCode,
} from "@/modules/identity-access/policy";
import type {
  FrozenMeasurementSnapshot,
  InspectionSafetyInput,
  StaffCleaningPassportEntry,
} from "./types";
import {
  JobAuthorizationError,
  assessCompletionReadiness,
  assessInspectionSafety,
  assessJobCreation,
  assessTreatmentPlanSafety,
  assessTreatmentExecutionConformance,
  decideJobCancellation,
  decideTeamAssignment,
  decideJobTransition,
  deriveDurationAnalytics,
  executionResultResolution,
  isTeamMembershipActiveAt,
  requireCustomerCleaningPassportRead,
  requireJobAssignment,
  requireJobExecutionUpdate,
  requireJobRead,
  requireStaffAssetHistoryRead,
  toCustomerCleaningPassportEntry,
  type JobActor,
  type JobCreationEvidence,
} from "./policy";

const profileId = "10000000-0000-4000-8000-000000000001";
const assignedTeamId = 1;
const otherTeamId = 2;
const now = new Date("2026-08-25T12:00:00.000Z");

function actor(
  role: ApplicationRoleCode | null,
  options: Partial<Pick<JobActor, "status" | "permissions" | "roles">> = {},
): JobActor {
  return {
    profileId,
    status: options.status ?? "ACTIVE",
    roles: options.roles ?? new Set(role ? [role] : []),
    permissions:
      options.permissions ?? new Set(role ? rolePermissionMatrix[role] : []),
  };
}

function membership(
  overrides: Partial<{
    operationsTeamId: number;
    active: boolean;
    validFrom: Date;
    validUntil: Date | null;
  }> = {},
) {
  return {
    operationsTeamId: overrides.operationsTeamId ?? assignedTeamId,
    active: overrides.active ?? true,
    validFrom: overrides.validFrom ?? new Date("2026-01-01T00:00:00.000Z"),
    validUntil: overrides.validUntil ?? null,
  };
}

function expectDenied(
  callback: () => unknown,
  code: JobAuthorizationError["code"],
): void {
  expect(callback).toThrowError(
    expect.objectContaining({ name: "JobAuthorizationError", code }),
  );
}

describe("Job access policy", () => {
  it.each(["OWNER", "ADMIN", "DISPATCHER"] as const)(
    "grants %s broad read scope from the complete permission conjunction",
    (role) => {
      expect(
        requireJobRead(actor(role), {
          assignedTeamId: null,
          memberships: [],
          at: now,
        }),
      ).toBe("STAFF");
      expect(() => requireJobAssignment(actor(role))).not.toThrow();
    },
  );

  it("grants a technician only fresh exact assigned-team scope", () => {
    const technician = actor("TECHNICIAN");

    expect(
      requireJobRead(technician, {
        assignedTeamId,
        memberships: [membership()],
        at: now,
      }),
    ).toBe("ASSIGNED_TEAM");
    expect(
      requireJobExecutionUpdate(technician, {
        assignedTeamId,
        memberships: [membership()],
        at: now,
      }),
    ).toBe("ASSIGNED_TEAM");

    for (const memberships of [
      [membership({ operationsTeamId: otherTeamId })],
      [membership({ active: false })],
      [membership({ validUntil: now })],
      [membership({ validFrom: new Date("2026-08-25T12:00:01.000Z") })],
    ]) {
      expectDenied(
        () =>
          requireJobExecutionUpdate(technician, {
            assignedTeamId,
            memberships,
            at: now,
          }),
        "RECORD_NOT_FOUND_OR_FORBIDDEN",
      );
    }
  });

  it("grants Owner/Admin broad execution while keeping Dispatcher assignment-only", () => {
    for (const role of ["OWNER", "ADMIN"] as const) {
      expect(
        requireJobExecutionUpdate(actor(role), {
          assignedTeamId: null,
          memberships: [],
          at: now,
        }),
      ).toBe("STAFF");
    }
    expectDenied(
      () =>
        requireJobExecutionUpdate(actor("DISPATCHER"), {
          assignedTeamId,
          memberships: [membership()],
          at: now,
        }),
      "PERMISSION_DENIED",
    );
  });

  it("uses a half-open membership validity interval", () => {
    const active = membership({
      validFrom: now,
      validUntil: new Date("2026-08-25T13:00:00.000Z"),
    });
    expect(isTeamMembershipActiveAt(active, now)).toBe(true);
    expect(
      isTeamMembershipActiveAt(active, new Date("2026-08-25T13:00:00.000Z")),
    ).toBe(false);
  });

  it("does not authorize assignment, execution or broad history from a role label alone", () => {
    const noPermissions = actor("OWNER", { permissions: new Set() });
    expectDenied(
      () => requireJobAssignment(noPermissions),
      "PERMISSION_DENIED",
    );
    expectDenied(
      () =>
        requireJobExecutionUpdate(noPermissions, {
          assignedTeamId,
          memberships: [membership()],
          at: now,
        }),
      "PERMISSION_DENIED",
    );
    expectDenied(
      () => requireStaffAssetHistoryRead(noPermissions),
      "PERMISSION_DENIED",
    );
  });

  it("keeps customers out of operational Jobs and enforces exact asset ownership", () => {
    const customer = actor("CUSTOMER");
    expectDenied(
      () =>
        requireJobRead(customer, {
          assignedTeamId,
          memberships: [membership()],
          at: now,
        }),
      "PERMISSION_DENIED",
    );
    expect(() =>
      requireCustomerCleaningPassportRead(customer, true),
    ).not.toThrow();
    expectDenied(
      () => requireCustomerCleaningPassportRead(customer, false),
      "RECORD_NOT_FOUND_OR_FORBIDDEN",
    );
  });

  it("distinguishes missing and inactive accounts before record scope", () => {
    expectDenied(
      () =>
        requireJobRead(null, {
          assignedTeamId,
          memberships: [],
          at: now,
        }),
      "AUTHENTICATION_REQUIRED",
    );
    expectDenied(
      () =>
        requireJobRead(actor("TECHNICIAN", { status: "SUSPENDED" }), {
          assignedTeamId,
          memberships: [membership()],
          at: now,
        }),
      "ACCOUNT_UNAVAILABLE",
    );
  });

  it("requires every member of the staff assignment permission conjunction", () => {
    const required: PermissionCode[] = [
      "FIELD_JOBS_READ",
      "OPERATIONS_MANAGE",
      "SCHEDULE_MANAGE",
    ];
    for (const omitted of required) {
      expectDenied(
        () =>
          requireJobAssignment(
            actor("OWNER", {
              permissions: new Set(
                required.filter((permission) => permission !== omitted),
              ),
            }),
          ),
        "PERMISSION_DENIED",
      );
    }
  });
});

const readyCreationEvidence: JobCreationEvidence = {
  existingJobReference: null,
  bookingExists: true,
  bookingStatus: "CONFIRMED",
  schedulingStatus: "SCHEDULED",
  customerPropertyConsistent: true,
  issuedQuoteSnapshotValid: true,
  bookingQuoteProvenanceConsistent: true,
  bookingItemsComplete: true,
  bookingItemsMatchIssuedSnapshot: true,
  assetReferencesConsistent: true,
  confirmedOccupancyConsistent: true,
  assignedTeamEligible: true,
  requiredCapabilitiesSatisfied: true,
  requiredEquipmentSatisfied: true,
};

describe("Booking to Job readiness", () => {
  it("marks only an exact confirmed and scheduled evidence chain READY", () => {
    expect(assessJobCreation(readyCreationEvidence)).toEqual({
      state: "READY",
      reviewReasonCodes: [],
    });
  });

  it("is idempotent when the Booking already has its one Job", () => {
    expect(
      assessJobCreation({
        ...readyCreationEvidence,
        existingJobReference: "JOB-000000000000000000000001",
      }),
    ).toEqual({
      state: "EXISTING",
      jobReference: "JOB-000000000000000000000001",
    });
  });

  it("allows unscheduled Booking preparation without representing it as executable", () => {
    expect(
      assessJobCreation({
        ...readyCreationEvidence,
        bookingStatus: "PENDING_SCHEDULING",
        schedulingStatus: "REVIEW_REQUIRED",
        confirmedOccupancyConsistent: false,
        assignedTeamEligible: false,
      }),
    ).toEqual({
      state: "PREPARED",
      reviewReasonCodes: [
        "BOOKING_NOT_CONFIRMED",
        "SCHEDULE_REVIEW_REQUIRED",
        "CONFIRMED_OCCUPANCY_INCONSISTENT",
        "TEAM_INELIGIBLE",
      ],
    });
  });

  it("rejects provenance inconsistencies instead of preparing repaired data", () => {
    expect(
      assessJobCreation({
        ...readyCreationEvidence,
        issuedQuoteSnapshotValid: false,
        bookingQuoteProvenanceConsistent: false,
        bookingItemsMatchIssuedSnapshot: false,
        assetReferencesConsistent: false,
      }),
    ).toEqual({
      state: "REJECTED",
      reasonCodes: [
        "ISSUED_QUOTE_SNAPSHOT_INVALID",
        "BOOKING_QUOTE_PROVENANCE_INCONSISTENT",
        "BOOKING_ITEMS_DO_NOT_MATCH_ISSUED_SNAPSHOT",
        "ASSET_REFERENCE_INCONSISTENT",
      ],
    });
  });

  it("rejects a cancelled Booking", () => {
    expect(
      assessJobCreation({
        ...readyCreationEvidence,
        bookingStatus: "CANCELLED",
      }),
    ).toEqual({ state: "REJECTED", reasonCodes: ["BOOKING_CANCELLED"] });
  });
});

describe("Job lifecycle", () => {
  it("permits the controlled path and identifies server-owned timestamps", () => {
    expect(decideJobTransition("PREPARED", "READY")).toEqual({
      state: "TRANSITION",
      serverTimestampField: null,
    });
    expect(decideJobTransition("READY", "EN_ROUTE")).toEqual({
      state: "TRANSITION",
      serverTimestampField: "enRouteAt",
    });
    expect(decideJobTransition("EN_ROUTE", "ARRIVED")).toEqual({
      state: "TRANSITION",
      serverTimestampField: "arrivedAt",
    });
    expect(decideJobTransition("ARRIVED", "IN_PROGRESS")).toEqual({
      state: "TRANSITION",
      serverTimestampField: "startedAt",
    });
    expect(decideJobTransition("IN_PROGRESS", "COMPLETED")).toEqual({
      state: "TRANSITION",
      serverTimestampField: "completedAt",
    });
  });

  it("treats retries as no-change without assigning another timestamp", () => {
    expect(decideJobTransition("ARRIVED", "ARRIVED")).toEqual({
      state: "NO_CHANGE",
      serverTimestampField: null,
    });
  });

  it("denies jumps, cancellation after work starts, and completed mutation", () => {
    expect(decideJobTransition("READY", "IN_PROGRESS").state).toBe("DENIED");
    expect(decideJobTransition("IN_PROGRESS", "CANCELLED").state).toBe(
      "DENIED",
    );
    expect(decideJobTransition("COMPLETED", "REQUIRES_REVIEW").state).toBe(
      "DENIED",
    );
    expect(decideJobTransition("CANCELLED", "READY").state).toBe("DENIED");
  });

  it("allows assignment only before travel and cancellation only before work", () => {
    expect(
      decideTeamAssignment({
        status: "READY",
        currentTeamId: null,
        targetTeamId: 1,
      }),
    ).toBe("ASSIGN");
    expect(
      decideTeamAssignment({
        status: "EN_ROUTE",
        currentTeamId: 1,
        targetTeamId: 2,
      }),
    ).toBe("DENIED");
    expect(decideJobCancellation("REQUIRES_REVIEW", null)).toEqual({
      state: "TRANSITION",
      serverTimestampField: "cancelledAt",
    });
    expect(decideJobCancellation("REQUIRES_REVIEW", now).state).toBe(
      "DENIED",
    );
  });
});

const measurement: FrozenMeasurementSnapshot = {
  measurementModeId: 1,
  quantity: 1,
  areaHundredthsM2: 1_200,
  seatCount: null,
  sides: null,
};

const safeInspection: InspectionSafetyInput = {
  plannedCleaningItemTypeId: 1,
  observedCleaningItemTypeId: 1,
  plannedMeasurement: measurement,
  observedMeasurement: { ...measurement },
  issueHandlingClassifications: ["STANDARD"],
  riskCodes: [],
  serviceCapabilityStatus: "STANDARD",
  treatmentCapabilityStatus: "STANDARD",
  requiredAddonIds: [10],
  quotedAddonIds: [10],
  unsafeContaminationObserved: false,
  unsafeStructuralConditionObserved: false,
};

describe("inspection and treatment safety", () => {
  it("allows an exact, supported inspection without changing planned evidence", () => {
    expect(assessInspectionSafety(safeInspection)).toEqual({
      state: "PROCEED",
      reasonCodes: [],
    });
    expect(safeInspection.plannedMeasurement).toEqual(measurement);
  });

  it("fails changed scope and unquoted work closed to review", () => {
    expect(
      assessInspectionSafety({
        ...safeInspection,
        observedCleaningItemTypeId: 2,
        observedMeasurement: { ...measurement, areaHundredthsM2: 1_201 },
        requiredAddonIds: [10, 11],
      }),
    ).toEqual({
      state: "REQUIRES_REVIEW",
      reasonCodes: [
        "CLEANING_ITEM_TYPE_CHANGED",
        "MEASUREMENT_CHANGED",
        "UNQUOTED_ADDON_REQUIRED",
      ],
    });
  });

  it("routes unsafe contamination and decline-class issues to decline or referral", () => {
    expect(
      assessInspectionSafety({
        ...safeInspection,
        issueHandlingClassifications: ["DECLINE_OR_REFER"],
        unsafeContaminationObserved: true,
      }),
    ).toEqual({
      state: "DECLINE_OR_REFER",
      reasonCodes: ["UNSAFE_CONTAMINATION", "DECLINE_OR_REFER_ISSUE"],
    });
  });

  it("requires review for elevated risks and non-standard capabilities", () => {
    expect(
      assessInspectionSafety({
        ...safeInspection,
        riskCodes: ["DYE_BLEED_RISK"],
        treatmentCapabilityStatus: "SPECIALIST_ONLY",
      }),
    ).toEqual({
      state: "REQUIRES_REVIEW",
      reasonCodes: [
        "ELEVATED_MATERIAL_RISK",
        "TREATMENT_CAPABILITY_REQUIRES_REVIEW",
      ],
    });
  });

  it("allows on-site assessment to resolve ASSESSMENT_REQUIRED capability", () => {
    expect(
      assessInspectionSafety({
        ...safeInspection,
        riskCodes: ["EXISTING_DAMAGE", "HEAVY_WEAR"],
        serviceCapabilityStatus: "ASSESSMENT_REQUIRED",
        treatmentCapabilityStatus: "ASSESSMENT_REQUIRED",
      }),
    ).toEqual({ state: "PROCEED", reasonCodes: [] });
    expect(
      assessInspectionSafety({
        ...safeInspection,
        serviceCapabilityStatus: "UNAVAILABLE",
      }),
    ).toEqual({
      state: "REQUIRES_REVIEW",
      reasonCodes: ["SERVICE_CAPABILITY_REQUIRES_REVIEW"],
    });
  });

  it("never permits performance through a review or material-scope change", () => {
    expect(
      assessTreatmentPlanSafety({
        inspectionDecision: "REQUIRES_REVIEW",
        treatmentDecision: "PERFORM",
        materialScopeChange: false,
      }),
    ).toEqual({
      state: "INVALID_DECISION",
      reasonCodes: ["INSPECTION_REQUIRES_REVIEW"],
    });
    expect(
      assessTreatmentPlanSafety({
        inspectionDecision: "PROCEED",
        treatmentDecision: "PERFORM_WITH_LIMITATIONS",
        materialScopeChange: true,
      }),
    ).toEqual({
      state: "INVALID_DECISION",
      reasonCodes: ["MATERIAL_SCOPE_CHANGE"],
    });
    expect(
      assessTreatmentPlanSafety({
        inspectionDecision: "DECLINE_OR_REFER",
        treatmentDecision: "REFER",
        materialScopeChange: false,
      }).state,
    ).toBe("ALLOWED");
  });

  it("keeps safety-stopped execution unresolved", () => {
    expect(executionResultResolution("STOPPED_FOR_SAFETY")).toBe(
      "REQUIRES_REVIEW",
    );
    expect(executionResultResolution("PARTIAL_IMPROVEMENT")).toBe("RESOLVED");
  });

  it("blocks execution that deviates from the confirmed treatment plan", () => {
    const exact = {
      treatmentPlanDecision: "PERFORM",
      plannedTreatmentLevelId: 1,
      plannedMechanicalActionLevelId: 2,
      plannedTreatmentApproachId: 3,
      plannedAddonIds: [4],
      plannedCleaningProductId: null,
      performedTreatmentLevelId: 1,
      performedMechanicalActionLevelId: 2,
      performedTreatmentApproachId: 3,
      performedAddonIds: [4],
      performedCleaningProductId: null,
      resultClassification: "COMPLETED_AS_PLANNED",
    } as const;
    expect(assessTreatmentExecutionConformance(exact)).toEqual({
      state: "CONFORMS",
      reasonCodes: [],
    });
    expect(
      assessTreatmentExecutionConformance({
        ...exact,
        performedAddonIds: [5],
        resultClassification: "STOPPED_FOR_SAFETY",
      }),
    ).toEqual({
      state: "REQUIRES_REVIEW",
      reasonCodes: ["ADDONS_CHANGED", "STOPPED_FOR_SAFETY"],
    });
  });
});

describe("completion policy", () => {
  it("requires every performed item to have inspection, plan and execution", () => {
    expect(
      assessCompletionReadiness({
        jobStatus: "IN_PROGRESS",
        items: [
          {
            status: "COMPLETED",
            inspectionRecorded: true,
            treatmentPlanRecorded: true,
            treatmentExecutionCompleted: true,
          },
          {
            status: "REFERRED",
            inspectionRecorded: true,
            treatmentPlanRecorded: true,
            treatmentExecutionCompleted: false,
          },
        ],
      }),
    ).toEqual({ state: "READY", reasonCodes: [] });
  });

  it("blocks empty, incomplete and review-required completion", () => {
    expect(
      assessCompletionReadiness({ jobStatus: "READY", items: [] }),
    ).toEqual({
      state: "BLOCKED",
      reasonCodes: ["JOB_NOT_IN_PROGRESS", "NO_JOB_ITEMS"],
    });
    expect(
      assessCompletionReadiness({
        jobStatus: "IN_PROGRESS",
        items: [
          {
            status: "REQUIRES_REVIEW",
            inspectionRecorded: false,
            treatmentPlanRecorded: false,
            treatmentExecutionCompleted: false,
          },
        ],
      }),
    ).toEqual({
      state: "BLOCKED",
      reasonCodes: [
        "REVIEW_REQUIRED",
        "INSPECTION_MISSING",
        "TREATMENT_PLAN_MISSING",
        "ITEM_UNRESOLVED",
      ],
    });
  });
});

describe("Cleaning Passport projection", () => {
  it("whitelists customer-safe fields and excludes internal observations", () => {
    const staffEntry: StaffCleaningPassportEntry = {
      id: "30000000-0000-4000-8000-000000000001",
      jobItemId: "40000000-0000-4000-8000-000000000001",
      jobReference: "JOB-000000000000000000000001",
      completedAt: now,
      serviceDescription: "Upholstery care",
      observedConditionSummary: "Normal",
      treatmentSummary: "Gentle care",
      resultClassification: "COMPLETED_AS_PLANNED",
      careRecommendation: "Allow the surface to dry before normal use.",
      maintenanceRecommendation: null,
      inspectionIssueSummary: ["Internal issue"],
      inspectionRiskSummary: ["Internal risk"],
      internalTechnicianNotes: "Staff only",
      immutableSnapshot: { actorProfileId: profileId },
    };

    const customerEntry = toCustomerCleaningPassportEntry(staffEntry);
    expect(customerEntry).toEqual({
      jobReference: staffEntry.jobReference,
      completedAt: now,
      serviceDescription: "Upholstery care",
      observedConditionSummary: "Normal",
      treatmentSummary: "Gentle care",
      resultClassification: "COMPLETED_AS_PLANNED",
      careRecommendation: "Allow the surface to dry before normal use.",
      maintenanceRecommendation: null,
    });
    expect(customerEntry).not.toHaveProperty("internalTechnicianNotes");
    expect(customerEntry).not.toHaveProperty("immutableSnapshot");
    expect(customerEntry).not.toHaveProperty("inspectionRiskSummary");
  });
});

describe("planned versus actual analytics", () => {
  it("derives duration and team-hour facts from stored operational inputs", () => {
    expect(
      deriveDurationAnalytics({
        plannedDurationMinutes: 90,
        actualProductiveMinutes: 100,
        actualOccupiedMinutes: 120,
        plannedTechnicianCount: 2,
        actualTechnicianCount: 2,
        immutableQuotedRevenueMinorUnits: 24_000,
      }),
    ).toEqual({
      plannedDurationMinutes: 90,
      actualProductiveMinutes: 100,
      productiveVarianceMinutes: 10,
      actualOccupiedMinutes: 120,
      plannedTeamMinutes: 180,
      actualTeamMinutes: 240,
      plannedTeamHours: 3,
      actualTeamHours: 4,
      immutableQuotedRevenuePerActualTeamHourMinorUnits: 6_000,
    });
  });

  it("does not invent a revenue ratio without an external aggregate or team time", () => {
    expect(
      deriveDurationAnalytics({
        plannedDurationMinutes: null,
        actualProductiveMinutes: 0,
        actualOccupiedMinutes: 0,
        plannedTechnicianCount: 1,
        actualTechnicianCount: 1,
      }),
    ).toMatchObject({
      plannedTeamMinutes: null,
      actualTeamMinutes: 0,
      immutableQuotedRevenuePerActualTeamHourMinorUnits: null,
    });
    expect(
      deriveDurationAnalytics({
        plannedDurationMinutes: 0,
        actualProductiveMinutes: 0,
        actualOccupiedMinutes: 0,
        plannedTechnicianCount: 1,
        actualTechnicianCount: 1,
        immutableQuotedRevenueMinorUnits: 100,
      }).immutableQuotedRevenuePerActualTeamHourMinorUnits,
    ).toBeNull();
  });

  it.each([
    { actualProductiveMinutes: -1 },
    { actualProductiveMinutes: 121 },
    { actualOccupiedMinutes: Number.NaN },
    { plannedTechnicianCount: 0 },
    { actualTechnicianCount: 1.5 },
    { immutableQuotedRevenueMinorUnits: -1 },
  ])("rejects invalid analytics facts: %o", (override) => {
    expect(() =>
      deriveDurationAnalytics({
        plannedDurationMinutes: 90,
        actualProductiveMinutes: 100,
        actualOccupiedMinutes: 120,
        plannedTechnicianCount: 2,
        actualTechnicianCount: 2,
        ...override,
      }),
    ).toThrow(RangeError);
  });
});
