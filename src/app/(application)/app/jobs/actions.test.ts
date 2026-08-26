import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationBoundaryError } from "@/auth/principal-policy";
import { JobExecutionServiceError } from "@/modules/job-execution/service";

const doubles = vi.hoisted(() => {
  const service = {
    createJobFromBooking: vi.fn(),
    assignTeam: vi.fn(),
    markEnRoute: vi.fn(),
    markArrived: vi.fn(),
    startWork: vi.fn(),
    recordInspection: vi.fn(),
    confirmTreatmentPlan: vi.fn(),
    startTreatment: vi.fn(),
    completeTreatment: vi.fn(),
    completeJob: vi.fn(),
    cancelJob: vi.fn(),
  };
  return {
    service,
    requireAuthenticatedUser: vi.fn(),
    isAuthAttemptAllowed: vi.fn(),
    revalidatePath: vi.fn(),
    repositoryFactory: vi.fn(() => ({})),
    serviceFactory: vi.fn(() => service),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: doubles.revalidatePath }));
vi.mock("@/auth/authorization-service", () => ({
  requireAuthenticatedUser: doubles.requireAuthenticatedUser,
}));
vi.mock("@/auth/enforce-rate-limit", () => ({
  isAuthAttemptAllowed: doubles.isAuthAttemptAllowed,
}));
vi.mock("@/db/client", () => ({ getDatabase: vi.fn(() => ({})) }));
vi.mock("@/modules/job-execution/repository", () => ({
  createDatabaseJobExecutionRepository: doubles.repositoryFactory,
}));
vi.mock("@/modules/job-execution/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/job-execution/service")>()),
  createJobExecutionService: doubles.serviceFactory,
}));

import {
  assignJobTeamAction,
  cancelJobAction,
  completeJobAction,
  completeJobItemTreatmentAction,
  confirmJobItemTreatmentPlanAction,
  createJobFromBookingAction,
  progressJobAction,
  recordJobItemInspectionAction,
  startJobItemTreatmentAction,
} from "./actions";

const profileId = "10000000-0000-4000-8000-000000000001";
const jobItemId = "20000000-0000-4000-8000-000000000001";
const sourceInspectionId = "30000000-0000-4000-8000-000000000001";
const treatmentPlanId = "40000000-0000-4000-8000-000000000001";
const treatmentExecutionId = "50000000-0000-4000-8000-000000000001";
const bookingReference = "BKG-0123456789ABCDEF01234567";
const jobReference = "JOB-0123456789ABCDEF01234567";
const initialState = { status: "IDLE" as const };

const updatePermissions = new Set([
  "OPERATIONS_READ",
  "SCHEDULE_READ",
  "FIELD_JOBS_READ",
  "FIELD_JOBS_UPDATE",
  "OPERATIONS_MANAGE",
  "SCHEDULE_MANAGE",
]);

const principal = {
  profile: {
    id: profileId,
    displayName: "Operations manager",
    preferredLocale: "en" as const,
    phone: null,
    status: "ACTIVE" as const,
  },
  roles: new Set(["OWNER"]),
  permissions: updatePermissions,
};

function form(entries: readonly (readonly [string, string])[]): FormData {
  const formData = new FormData();
  for (const [name, value] of entries) formData.append(name, value);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  doubles.requireAuthenticatedUser.mockResolvedValue(principal);
  doubles.isAuthAttemptAllowed.mockResolvedValue(true);
  doubles.serviceFactory.mockReturnValue(doubles.service);
  doubles.service.createJobFromBooking.mockResolvedValue({
    status: "CREATED",
    jobReference,
    jobStatus: "READY",
  });
  for (const method of [
    doubles.service.assignTeam,
    doubles.service.markEnRoute,
    doubles.service.markArrived,
    doubles.service.startWork,
    doubles.service.recordInspection,
    doubles.service.confirmTreatmentPlan,
    doubles.service.startTreatment,
    doubles.service.completeTreatment,
    doubles.service.completeJob,
    doubles.service.cancelJob,
  ]) {
    method.mockResolvedValue({
      status: "CHANGED",
      jobReference,
      version: 2,
    });
  }
});

describe("Phase 3F Job Server Action trust boundary", () => {
  it("authenticates every mutation before reading any FormData", async () => {
    const actions = [
      createJobFromBookingAction,
      assignJobTeamAction,
      progressJobAction,
      recordJobItemInspectionAction,
      confirmJobItemTreatmentPlanAction,
      startJobItemTreatmentAction,
      completeJobItemTreatmentAction,
      completeJobAction,
      cancelJobAction,
    ];

    for (const action of actions) {
      doubles.requireAuthenticatedUser.mockRejectedValueOnce(
        new AuthenticationBoundaryError("AUTHENTICATION_REQUIRED"),
      );
      const submitted = new FormData();
      const getAll = vi.spyOn(submitted, "getAll");

      await expect(action(initialState, submitted)).resolves.toEqual({
        status: "ERROR",
        message: "Нямате достъп до тази операция.",
      });
      expect(getAll).not.toHaveBeenCalled();
    }

    expect(
      Object.values(doubles.service).every(
        (method) => method.mock.calls.length === 0,
      ),
    ).toBe(true);
  });

  it("authorizes the operation and rate-limits before parsing client input", async () => {
    doubles.requireAuthenticatedUser.mockResolvedValueOnce({
      ...principal,
      permissions: new Set(["FIELD_JOBS_READ"]),
    });
    const unauthorized = new FormData();
    const unauthorizedRead = vi.spyOn(unauthorized, "getAll");

    await expect(
      createJobFromBookingAction(initialState, unauthorized),
    ).resolves.toEqual({
      status: "ERROR",
      message: "You do not have access to this operation.",
    });
    expect(unauthorizedRead).not.toHaveBeenCalled();
    expect(doubles.isAuthAttemptAllowed).not.toHaveBeenCalled();

    doubles.isAuthAttemptAllowed.mockResolvedValueOnce(false);
    const limited = new FormData();
    const limitedRead = vi.spyOn(limited, "getAll");
    await expect(
      createJobFromBookingAction(initialState, limited),
    ).resolves.toEqual({
      status: "ERROR",
      message: "Too many attempts. Wait and try again.",
    });
    expect(doubles.isAuthAttemptAllowed).toHaveBeenCalledWith(
      "JOB_MUTATION",
      profileId,
    );
    expect(limitedRead).not.toHaveBeenCalled();
  });

  it("creates a job from only the exact booking reference and version", async () => {
    const result = await createJobFromBookingAction(
      initialState,
      form([
        ["bookingReference", bookingReference],
        ["expectedBookingVersion", "7"],
      ]),
    );

    expect(doubles.service.createJobFromBooking).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      { bookingReference, expectedBookingVersion: 7 },
    );
    expect(result).toEqual({
      status: "SUCCESS",
      message: "The field job was created.",
    });
    expect(doubles.revalidatePath.mock.calls).toEqual([
      ["/app/jobs"],
      [`/app/jobs/${jobReference}`],
    ]);

    const rejected = await createJobFromBookingAction(
      initialState,
      form([
        ["bookingReference", bookingReference],
        ["expectedBookingVersion", "7"],
        ["actorProfileId", profileId],
      ]),
    );
    expect(rejected.status).toBe("ERROR");
    expect(doubles.service.createJobFromBooking).toHaveBeenCalledTimes(1);
  });

  it("requests an exact team assignment without accepting actor or timestamp authority", async () => {
    await assignJobTeamAction(
      initialState,
      form([
        ["jobReference", jobReference],
        ["operationsTeamId", "12"],
        ["expectedJobVersion", "3"],
      ]),
    );

    expect(doubles.service.assignTeam).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      {
        jobReference,
        operationsTeamId: 12,
        expectedJobVersion: 3,
      },
    );

    const rejected = await assignJobTeamAction(
      initialState,
      form([
        ["jobReference", jobReference],
        ["operationsTeamId", "12"],
        ["expectedJobVersion", "3"],
        ["assignedAt", "2026-08-25T12:00:00.000Z"],
      ]),
    );
    expect(rejected.status).toBe("ERROR");
    expect(doubles.service.assignTeam).toHaveBeenCalledTimes(1);
  });

  it("maps flat inspection fields to the strict observed-evidence shape", async () => {
    const result = await recordJobItemInspectionAction(
      initialState,
      form([
        ["jobReference", jobReference],
        ["jobItemId", jobItemId],
        ["expectedJobVersion", "4"],
        ["expectedJobItemVersion", "2"],
        ["observedCleaningItemTypeId", "10"],
        ["measurementModeId", "11"],
        ["quantity", "1"],
        ["observedConditionLevelId", "12"],
        ["confirmedFibreMaterialId", "13"],
        ["confirmedSurfaceConstructionId", "14"],
        ["issueTypeIds", "15"],
        ["riskFlagIds", "16"],
        ["technicianNotes", "Observed on site"],
      ]),
    );

    expect(result).toEqual({
      status: "SUCCESS",
      message: "The change was recorded.",
    });

    expect(doubles.service.recordInspection).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      expect.objectContaining({
        jobReference,
        jobItemId,
        observedMeasurement: {
          measurementModeId: 11,
          quantity: 1,
          areaHundredthsM2: null,
          seatCount: null,
          sides: null,
        },
        issues: [{ issueTypeId: 15, technicianNote: null }],
        risks: [{ riskFlagId: 16, technicianNote: null }],
        unsafeContaminationObserved: false,
        unsafeStructuralConditionObserved: false,
      }),
    );
  });

  it("keeps material-scope classification server-owned", async () => {
    const result = await confirmJobItemTreatmentPlanAction(
      initialState,
      form([
        ["jobReference", jobReference],
        ["jobItemId", jobItemId],
        ["expectedJobVersion", "4"],
        ["expectedJobItemVersion", "2"],
        ["sourceInspectionId", sourceInspectionId],
        ["decision", "PERFORM"],
        ["treatmentLevelId", "20"],
        ["mechanicalActionLevelId", "21"],
        ["treatmentApproachId", "22"],
        ["cleaningProductId", "23"],
        ["technicianRationale", "Safe after inspection"],
        ["safetyAcknowledged", "true"],
        ["materialScopeChange", "false"],
      ]),
    );

    expect(result.status).toBe("ERROR");
    expect(doubles.service.confirmTreatmentPlan).not.toHaveBeenCalled();
  });

  it("accepts only the fixed treatment-start operation and no browser time", async () => {
    const valid = [
      ["jobReference", jobReference],
      ["jobItemId", jobItemId],
      ["expectedJobVersion", "4"],
      ["expectedJobItemVersion", "3"],
      ["treatmentPlanId", treatmentPlanId],
    ] as const;

    await startJobItemTreatmentAction(
      initialState,
      form([...valid, ["operation", "START_TREATMENT"]]),
    );
    expect(doubles.service.startTreatment).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      {
        jobReference,
        jobItemId,
        expectedJobVersion: 4,
        expectedJobItemVersion: 3,
        treatmentPlanId,
      },
    );

    const wrongOperation = await startJobItemTreatmentAction(
      initialState,
      form([...valid, ["operation", "MARK_ARRIVED"]]),
    );
    expect(wrongOperation.status).toBe("ERROR");
    expect(doubles.service.startTreatment).toHaveBeenCalledTimes(1);

    const timestamp = await startJobItemTreatmentAction(
      initialState,
      form([
        ...valid,
        ["operation", "START_TREATMENT"],
        ["startedAt", "2026-08-25T12:00:00.000Z"],
      ]),
    );
    expect(timestamp.status).toBe("ERROR");
    expect(doubles.service.startTreatment).toHaveBeenCalledTimes(1);
  });

  it("returns localized safe failures without exposing internal reason codes", async () => {
    doubles.service.completeJob.mockRejectedValueOnce(
      new JobExecutionServiceError("REQUIRES_REVIEW"),
    );

    const result = await completeJobAction(
      initialState,
      form([
        ["jobReference", jobReference],
        ["expectedJobVersion", "8"],
        ["internalCompletionNotes", "Operational completion record"],
        ["customerVisibleCompletionNotes", "Cleaning completed"],
        ["customerVisibleCareNotes", "Allow to dry"],
        ["completionAcknowledged", "true"],
      ]),
    );

    expect(result).toEqual({
      status: "ERROR",
      message: "Staff review is required. No automatic change was made.",
    });
    expect(JSON.stringify(result)).not.toContain("REQUIRES_REVIEW");
    expect(JSON.stringify(result)).not.toContain(treatmentExecutionId);
  });
});
