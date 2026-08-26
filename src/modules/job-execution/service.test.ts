import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  rolePermissionMatrix,
  type ApplicationRoleCode,
} from "@/modules/identity-access/policy";

vi.mock("server-only", () => ({}));
vi.mock("./reference", () => ({
  generateJobReference: vi.fn(),
}));

import { JobAuthorizationError, type JobActor } from "./policy";
import { generateJobReference } from "./reference";
import type { JobExecutionRepository } from "./repository";
import {
  createJobExecutionService,
  JobExecutionServiceError,
} from "./service";
import type {
  JobCreationResult,
  JobItemMutationResult,
  JobMutationResult,
} from "./types";

const staffProfileId = "10000000-0000-4000-8000-000000000001";
const technicianProfileId = "10000000-0000-4000-8000-000000000002";
const customerProfileId = "10000000-0000-4000-8000-000000000003";
const otherTechnicianProfileId = "10000000-0000-4000-8000-000000000004";
const jobItemId = "20000000-0000-4000-8000-000000000001";
const propertyId = "30000000-0000-4000-8000-000000000001";
const assetId = "40000000-0000-4000-8000-000000000001";
const jobReference = "JOB-000000000000000000000001";
const secondJobReference = "JOB-000000000000000000000002";
const bookingReference = "BKG-000000000000000000000001";

function actor(role: ApplicationRoleCode, profileId: string): JobActor {
  return {
    profileId,
    status: "ACTIVE",
    roles: new Set([role]),
    permissions: new Set(rolePermissionMatrix[role]),
  };
}

function doubles() {
  const jobDetail = { jobReference, version: 1 };
  const customerPassport = { assetLabel: "Synthetic sofa", entries: [] };
  const staffHistory = { assetLabel: "Synthetic sofa", entries: [] };

  return {
    createJob: vi.fn<
      (actorProfileId: string, input: unknown) => Promise<JobCreationResult>
    >(async () => ({
      status: "CREATED",
      jobReference,
      jobStatus: "READY",
    })),
    listJobs: vi.fn(
      async (
        _actorProfileId: string,
        input: { limit: number; offset: number },
      ) => ({
        items: [],
        total: 0,
        limit: input.limit,
        offset: input.offset,
      }),
    ),
    getJob: vi.fn<
      (actorProfileId: string, reference: string) => Promise<unknown | null>
    >(async () => jobDetail),
    assignTeam: vi.fn<
      (actorProfileId: string, input: unknown) => Promise<JobMutationResult>
    >(async () => ({
      status: "CHANGED" as const,
      jobReference,
      version: 2,
    })),
    transitionJob: vi.fn<
      (
        actorProfileId: string,
        input: unknown,
        targetStatus: unknown,
      ) => Promise<JobMutationResult>
    >(async () => ({
      status: "CHANGED" as const,
      jobReference,
      version: 2,
    })),
    recordInspection: vi.fn<
      (actorProfileId: string, input: unknown) => Promise<JobItemMutationResult>
    >(async () => ({
      status: "CHANGED" as const,
      jobReference,
      jobVersion: 2,
      jobItemVersion: 2,
    })),
    confirmTreatmentPlan: vi.fn<
      (actorProfileId: string, input: unknown) => Promise<JobItemMutationResult>
    >(async () => ({
      status: "CHANGED" as const,
      jobReference,
      jobVersion: 2,
      jobItemVersion: 2,
    })),
    startTreatment: vi.fn<
      (actorProfileId: string, input: unknown) => Promise<JobItemMutationResult>
    >(async () => ({
      status: "CHANGED" as const,
      jobReference,
      jobVersion: 2,
      jobItemVersion: 2,
    })),
    completeTreatment: vi.fn<
      (actorProfileId: string, input: unknown) => Promise<JobItemMutationResult>
    >(async () => ({
      status: "CHANGED" as const,
      jobReference,
      jobVersion: 2,
      jobItemVersion: 2,
    })),
    completeJob: vi.fn<
      (actorProfileId: string, input: unknown) => Promise<JobMutationResult>
    >(async () => ({
      status: "CHANGED" as const,
      jobReference,
      version: 2,
    })),
    cancelJob: vi.fn<
      (actorProfileId: string, input: unknown) => Promise<JobMutationResult>
    >(async () => ({
      status: "CHANGED" as const,
      jobReference,
      version: 2,
    })),
    getCustomerPassport: vi.fn<
      (actorProfileId: string, input: unknown) => Promise<unknown | null>
    >(async () => customerPassport),
    getStaffAssetHistory: vi.fn<
      (actorProfileId: string, input: unknown) => Promise<unknown | null>
    >(async () => staffHistory),
  };
}

function serviceWith(repositoryDoubles = doubles()) {
  return {
    repositoryDoubles,
    service: createJobExecutionService(
      repositoryDoubles as unknown as JobExecutionRepository,
    ),
  };
}

function expectServiceFailure(
  operation: Promise<unknown>,
  code: JobExecutionServiceError["code"],
) {
  return expect(operation).rejects.toMatchObject({
    name: "JobExecutionServiceError",
    code,
  });
}

beforeEach(() => {
  vi.mocked(generateJobReference).mockReset();
  vi.mocked(generateJobReference).mockReturnValue(jobReference);
});

describe("Job execution service", () => {
  it("creates an eligible Job with a server-generated reference", async () => {
    const { service, repositoryDoubles } = serviceWith();

    await expect(
      service.createJobFromBooking(actor("DISPATCHER", staffProfileId), {
        bookingReference,
        expectedBookingVersion: 2,
      }),
    ).resolves.toEqual({
      status: "CREATED",
      jobReference,
      jobStatus: "READY",
    });
    expect(repositoryDoubles.createJob).toHaveBeenCalledWith(staffProfileId, {
      bookingReference,
      expectedBookingVersion: 2,
      jobReference,
    });
  });

  it("maps cancelled/ineligible and duplicate Booking creation without exposing reasons", async () => {
    const repositoryDoubles = doubles();
    repositoryDoubles.createJob
      .mockResolvedValueOnce({
        status: "INELIGIBLE",
        reasonCodes: ["BOOKING_CANCELLED"],
      })
      .mockResolvedValueOnce({
        status: "EXISTING",
        jobReference,
        jobStatus: "PREPARED",
      });
    const { service } = serviceWith(repositoryDoubles);
    const dispatcher = actor("DISPATCHER", staffProfileId);
    const input = { bookingReference, expectedBookingVersion: 2 };

    const ineligible = await service.createJobFromBooking(dispatcher, input);
    expect(ineligible).toEqual({ status: "INELIGIBLE" });
    expect(ineligible).not.toHaveProperty("reasonCodes");
    await expect(
      service.createJobFromBooking(dispatcher, input),
    ).resolves.toEqual({
      status: "EXISTING",
      jobReference,
      jobStatus: "PREPARED",
    });
  });

  it("retries reference collisions and returns one safe conflict when exhausted", async () => {
    vi.mocked(generateJobReference)
      .mockReturnValueOnce(jobReference)
      .mockReturnValueOnce(secondJobReference)
      .mockReturnValue(jobReference);
    const repositoryDoubles = doubles();
    repositoryDoubles.createJob
      .mockResolvedValueOnce({ status: "REFERENCE_CONFLICT" })
      .mockResolvedValueOnce({
        status: "CREATED",
        jobReference: secondJobReference,
        jobStatus: "READY",
      });
    const { service } = serviceWith(repositoryDoubles);
    const input = { bookingReference, expectedBookingVersion: 2 };

    await expect(
      service.createJobFromBooking(actor("DISPATCHER", staffProfileId), input),
    ).resolves.toMatchObject({
      status: "CREATED",
      jobReference: secondJobReference,
    });
    expect(repositoryDoubles.createJob).toHaveBeenCalledTimes(2);

    repositoryDoubles.createJob.mockReset();
    repositoryDoubles.createJob.mockResolvedValue({
      status: "REFERENCE_CONFLICT",
    });
    await expectServiceFailure(
      service.createJobFromBooking(actor("DISPATCHER", staffProfileId), input),
      "CONFLICT",
    );
    expect(repositoryDoubles.createJob).toHaveBeenCalledTimes(3);
  });

  it("lets coarse-authorized technicians reach fresh repository scope and denies customers early", async () => {
    const repositoryDoubles = doubles();
    const assignedJob = { jobReference, version: 1 };
    repositoryDoubles.getJob
      .mockResolvedValueOnce(assignedJob)
      .mockResolvedValueOnce(null);
    const { service } = serviceWith(repositoryDoubles);
    const technician = actor("TECHNICIAN", technicianProfileId);

    await expect(
      service.getJob(technician, { jobReference }),
    ).resolves.toBe(assignedJob);
    await expectServiceFailure(
      service.getJob(
        actor("TECHNICIAN", otherTechnicianProfileId),
        { jobReference },
      ),
      "RECORD_NOT_FOUND_OR_FORBIDDEN",
    );
    expect(repositoryDoubles.getJob.mock.calls).toEqual([
      [technicianProfileId, jobReference],
      [otherTechnicianProfileId, jobReference],
    ]);

    await expect(
      service.getJob(actor("CUSTOMER", customerProfileId), { jobReference }),
    ).rejects.toMatchObject({
      name: "JobAuthorizationError",
      code: "PERMISSION_DENIED",
    } satisfies Partial<JobAuthorizationError>);
    expect(repositoryDoubles.getJob).toHaveBeenCalledTimes(2);
  });

  it("allows a Dispatcher to assign an eligible team", async () => {
    const { service, repositoryDoubles } = serviceWith();

    await expect(
      service.assignTeam(actor("DISPATCHER", staffProfileId), {
        jobReference,
        operationsTeamId: 7,
        expectedJobVersion: 1,
      }),
    ).resolves.toEqual({ status: "CHANGED", jobReference, version: 2 });
    expect(repositoryDoubles.assignTeam).toHaveBeenCalledWith(staffProfileId, {
      jobReference,
      operationsTeamId: 7,
      expectedJobVersion: 1,
    });
  });

  it("uses fixed state transitions and preserves idempotent double-start/double-completion results", async () => {
    const repositoryDoubles = doubles();
    repositoryDoubles.transitionJob
      .mockResolvedValueOnce({ status: "CHANGED", jobReference, version: 2 })
      .mockResolvedValueOnce({ status: "CHANGED", jobReference, version: 3 })
      .mockResolvedValueOnce({ status: "CHANGED", jobReference, version: 4 })
      .mockResolvedValueOnce({ status: "NO_CHANGE", jobReference, version: 4 });
    repositoryDoubles.completeJob
      .mockResolvedValueOnce({ status: "CHANGED", jobReference, version: 5 })
      .mockResolvedValueOnce({ status: "NO_CHANGE", jobReference, version: 5 });
    const { service } = serviceWith(repositoryDoubles);
    const technician = actor("TECHNICIAN", technicianProfileId);
    const completion = {
      jobReference,
      expectedJobVersion: 4,
      internalCompletionNotes: "Completed and checked.",
      customerVisibleCompletionNotes: null,
      customerVisibleCareNotes: null,
      maintenanceRecommendations: [],
    };

    await expect(
      service.markEnRoute(technician, {
        jobReference,
        expectedJobVersion: 1,
      }),
    ).resolves.toMatchObject({ status: "CHANGED", version: 2 });
    await expect(
      service.markArrived(technician, {
        jobReference,
        expectedJobVersion: 2,
      }),
    ).resolves.toMatchObject({ status: "CHANGED", version: 3 });
    await expect(
      service.startWork(technician, {
        jobReference,
        expectedJobVersion: 3,
      }),
    ).resolves.toEqual({
      status: "CHANGED",
      jobReference,
      version: 4,
    });
    await expect(
      service.startWork(technician, {
        jobReference,
        expectedJobVersion: 4,
      }),
    ).resolves.toEqual({
      status: "NO_CHANGE",
      jobReference,
      version: 4,
    });
    expect(repositoryDoubles.transitionJob.mock.calls).toEqual([
      [
        technicianProfileId,
        { jobReference, expectedJobVersion: 1 },
        "EN_ROUTE",
      ],
      [
        technicianProfileId,
        { jobReference, expectedJobVersion: 2 },
        "ARRIVED",
      ],
      [
        technicianProfileId,
        { jobReference, expectedJobVersion: 3 },
        "IN_PROGRESS",
      ],
      [
        technicianProfileId,
        { jobReference, expectedJobVersion: 4 },
        "IN_PROGRESS",
      ],
    ]);

    await expect(
      service.completeJob(technician, completion),
    ).resolves.toMatchObject({
      status: "CHANGED",
      version: 5,
    });
    await expect(
      service.completeJob(technician, completion),
    ).resolves.toMatchObject({
      status: "NO_CHANGE",
      version: 5,
    });
  });

  it("preserves idempotent treatment start and completion responses", async () => {
    const repositoryDoubles = doubles();
    repositoryDoubles.startTreatment
      .mockResolvedValueOnce({
        status: "CHANGED",
        jobReference,
        jobVersion: 5,
        jobItemVersion: 3,
      })
      .mockResolvedValueOnce({
        status: "NO_CHANGE",
        jobReference,
        jobVersion: 5,
        jobItemVersion: 3,
      });
    repositoryDoubles.completeTreatment
      .mockResolvedValueOnce({
        status: "CHANGED",
        jobReference,
        jobVersion: 6,
        jobItemVersion: 4,
      })
      .mockResolvedValueOnce({
        status: "NO_CHANGE",
        jobReference,
        jobVersion: 6,
        jobItemVersion: 4,
      });
    const { service } = serviceWith(repositoryDoubles);
    const technician = actor("TECHNICIAN", technicianProfileId);
    const treatmentPlanId = "50000000-0000-4000-8000-000000000001";
    const treatmentExecutionId = "60000000-0000-4000-8000-000000000001";
    const start = {
      jobReference,
      jobItemId,
      expectedJobVersion: 4,
      expectedJobItemVersion: 2,
      treatmentPlanId,
    };
    const completion = {
      jobReference,
      jobItemId,
      expectedJobVersion: 5,
      expectedJobItemVersion: 3,
      treatmentExecutionId,
      expectedTreatmentExecutionVersion: 1,
      performedTreatmentLevelId: 1,
      performedMechanicalActionLevelId: 2,
      performedTreatmentApproachId: 3,
      performedAddonIds: [],
      cleaningProductId: null,
      technicianNotes: null,
      resultClassification: "COMPLETED_AS_PLANNED" as const,
    };

    await expect(
      service.startTreatment(technician, start),
    ).resolves.toMatchObject({
      status: "CHANGED",
      jobItemVersion: 3,
    });
    await expect(
      service.startTreatment(technician, start),
    ).resolves.toMatchObject({
      status: "NO_CHANGE",
      jobItemVersion: 3,
    });
    await expect(
      service.completeTreatment(technician, completion),
    ).resolves.toMatchObject({ status: "CHANGED", jobItemVersion: 4 });
    await expect(
      service.completeTreatment(technician, completion),
    ).resolves.toMatchObject({ status: "NO_CHANGE", jobItemVersion: 4 });
  });

  it("maps stale, invalid-transition and review failures to safe service errors", async () => {
    const repositoryDoubles = doubles();
    repositoryDoubles.assignTeam.mockResolvedValueOnce({ status: "CONFLICT" });
    repositoryDoubles.transitionJob.mockResolvedValueOnce({
      status: "INVALID_TRANSITION",
    });
    repositoryDoubles.completeJob.mockResolvedValueOnce({
      status: "REQUIRES_REVIEW",
      reasonCodes: ["INTERNAL_PROVENANCE_REASON"],
    });
    const { service } = serviceWith(repositoryDoubles);

    await expectServiceFailure(
      service.assignTeam(actor("DISPATCHER", staffProfileId), {
        jobReference,
        operationsTeamId: 7,
        expectedJobVersion: 1,
      }),
      "CONFLICT",
    );
    await expectServiceFailure(
      service.markArrived(actor("TECHNICIAN", technicianProfileId), {
        jobReference,
        expectedJobVersion: 1,
      }),
      "INVALID_TRANSITION",
    );
    const completionFailure = service.completeJob(
      actor("TECHNICIAN", technicianProfileId),
      {
        jobReference,
        expectedJobVersion: 2,
        internalCompletionNotes: "Completed and checked.",
        customerVisibleCompletionNotes: null,
        customerVisibleCareNotes: null,
        maintenanceRecommendations: [],
      },
    );
    await expectServiceFailure(completionFailure, "REQUIRES_REVIEW");
    await expect(completionFailure).rejects.not.toMatchObject({
      reasonCodes: expect.anything(),
    });
  });

  it("uses separate customer and staff cleaning-history authorization paths", async () => {
    const repositoryDoubles = doubles();
    const passport = { assetLabel: "Synthetic sofa", entries: [] };
    const history = { assetLabel: "Synthetic sofa", entries: [] };
    repositoryDoubles.getCustomerPassport
      .mockResolvedValueOnce(passport)
      .mockResolvedValueOnce(null);
    repositoryDoubles.getStaffAssetHistory.mockResolvedValueOnce(history);
    const { service } = serviceWith(repositoryDoubles);
    const route = { propertyId, assetId };

    await expect(
      service.getCustomerPassport(actor("CUSTOMER", customerProfileId), route),
    ).resolves.toBe(passport);
    await expectServiceFailure(
      service.getCustomerPassport(actor("CUSTOMER", customerProfileId), route),
      "RECORD_NOT_FOUND_OR_FORBIDDEN",
    );
    await expect(
      service.getStaffAssetHistory(actor("DISPATCHER", staffProfileId), route),
    ).resolves.toBe(history);
    expect(repositoryDoubles.getCustomerPassport).toHaveBeenCalledWith(
      customerProfileId,
      route,
    );
    expect(repositoryDoubles.getStaffAssetHistory).toHaveBeenCalledWith(
      staffProfileId,
      route,
    );
  });

  it("maps repository exceptions to temporary unavailability", async () => {
    const repositoryDoubles = doubles();
    repositoryDoubles.listJobs.mockRejectedValueOnce(
      new Error("database details must stay internal"),
    );
    const { service } = serviceWith(repositoryDoubles);

    await expectServiceFailure(
      service.listJobs(actor("DISPATCHER", staffProfileId), {
        limit: 25,
        offset: 0,
      }),
      "TEMPORARILY_UNAVAILABLE",
    );
  });

  it("rejects unknown and malformed command fields before repository access", async () => {
    const { service, repositoryDoubles } = serviceWith();
    const dispatcher = actor("DISPATCHER", staffProfileId);

    await expectServiceFailure(
      service.createJobFromBooking(dispatcher, {
        bookingReference,
        expectedBookingVersion: 2,
        customerId: customerProfileId,
      }),
      "INVALID_REQUEST",
    );
    await expectServiceFailure(
      service.assignTeam(dispatcher, {
        jobReference,
        operationsTeamId: -1,
        expectedJobVersion: 1,
      }),
      "INVALID_REQUEST",
    );
    await expectServiceFailure(
      service.getStaffAssetHistory(dispatcher, {
        propertyId,
        assetId,
        includeCommercialHistory: true,
      }),
      "INVALID_REQUEST",
    );

    expect(repositoryDoubles.createJob).not.toHaveBeenCalled();
    expect(repositoryDoubles.assignTeam).not.toHaveBeenCalled();
    expect(repositoryDoubles.getStaffAssetHistory).not.toHaveBeenCalled();
  });

  it("forwards only a valid inspection command to repository scope", async () => {
    const { service, repositoryDoubles } = serviceWith();
    const inspection = {
      jobReference,
      jobItemId,
      expectedJobVersion: 1,
      expectedJobItemVersion: 1,
      observedCleaningItemTypeId: 1,
      observedMeasurement: {
        measurementModeId: 1,
        quantity: 1,
        areaHundredthsM2: null,
        seatCount: 2,
        sides: null,
      },
      observedConditionLevelId: 1,
      confirmedFibreMaterialId: 1,
      confirmedSurfaceConstructionId: 1,
      existingDamageObserved: false,
      existingDamageNotes: null,
      colourfastnessConcern: false,
      moistureSensitivity: false,
      unsafeContaminationObserved: false,
      unsafeStructuralConditionObserved: false,
      technicianNotes: null,
      issues: [],
      risks: [],
    };

    await expect(
      service.recordInspection(
        actor("TECHNICIAN", technicianProfileId),
        inspection,
      ),
    ).resolves.toMatchObject({ status: "CHANGED" });
    expect(repositoryDoubles.recordInspection).toHaveBeenCalledWith(
      technicianProfileId,
      inspection,
    );
  });
});
