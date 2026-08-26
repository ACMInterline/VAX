import { describe, expect, it, vi } from "vitest";
import type { SchedulingActor } from "./policy";
import {
  createSchedulingDispatchService,
} from "./service";
import type {
  BookingSchedulePreview,
  DispatchDay,
  DispatchRepository,
  ScheduleMutationResult,
} from "./types";

const bookingReference = `BKG-${"A".repeat(24)}`;
const profileId = "00000000-0000-4000-8000-000000000001";

function actor(
  permissions: SchedulingActor["permissions"],
  roles: SchedulingActor["roles"] = new Set(["DISPATCHER"]),
): SchedulingActor {
  return { profileId, status: "ACTIVE", roles, permissions };
}

const staffReadPermissions = new Set([
  "CUSTOMER_RECORDS_READ",
  "OPERATIONS_READ",
  "SCHEDULE_READ",
] as const);
const staffManagePermissions = new Set([
  "CUSTOMER_RECORDS_MANAGE",
  "OPERATIONS_MANAGE",
  "SCHEDULE_MANAGE",
] as const);

const dispatchDay: DispatchDay = {
  workDate: "2026-08-26",
  timeZone: "Europe/Sofia",
  previousDate: "2026-08-25",
  nextDate: "2026-08-27",
  provisionalConfiguration: true,
  warnings: [],
  unscheduledBookings: [],
  teams: [],
  metrics: {
    scheduledJobs: 0,
    serviceMinutes: 0,
    travelMinutes: 0,
    bufferMinutes: 0,
    idleMinutes: 0,
    utilizationPercent: 0,
    occupiedTeamHoursHundredths: 0,
    laborHoursHundredths: 0,
    revenuePerOccupiedTeamHourMinorUnits: null,
    currency: "EUR",
  },
};

const preview: BookingSchedulePreview = {
  bookingReference,
  expectedBookingVersion: 2,
  customerDisplayName: "Synthetic Customer",
  propertyLabel: "Synthetic Property",
  propertyAddress: "Synthetic Address",
  preferredTimingLabel: null,
  serviceDurationMinutes: 120,
  workDate: "2026-08-26",
  timeZone: "Europe/Sofia",
  currentAppointment: null,
  candidates: [],
  reviewWarnings: [],
  provisionalConfiguration: true,
};

const scheduled: ScheduleMutationResult = {
  status: "SCHEDULED",
  bookingReference,
  occupancyId: "10000000-0000-4000-8000-000000000001",
  occupancySnapshotVersion: 1,
  bookingVersion: 3,
  serviceStart: new Date("2026-08-26T06:00:00.000Z"),
  serviceEnd: new Date("2026-08-26T08:00:00.000Z"),
};

function repository(
  mutationResult: ScheduleMutationResult = scheduled,
): DispatchRepository & {
  getDispatchDay: ReturnType<typeof vi.fn>;
  previewBooking: ReturnType<typeof vi.fn>;
  confirmSchedule: ReturnType<typeof vi.fn>;
} {
  return {
    getDispatchDay: vi.fn(async () => dispatchDay),
    previewBooking: vi.fn(async () => preview),
    confirmSchedule: vi.fn(async () => mutationResult),
  };
}

const initialConfirmation = {
  bookingReference,
  expectedBookingVersion: 2,
  workDate: "2026-08-26",
  candidateKey: "TEAM_A:2026-08-26:360:none:none:fixture",
  expectedOccupancySnapshotVersion: null,
  reasonCategory: null,
  reasonText: null,
  acknowledged: true,
} as const;

describe("scheduling dispatch service boundary", () => {
  it("requires the complete staff read boundary and denies customer and technician actors", async () => {
    for (const denied of [
      actor(new Set(["OWN_CUSTOMER_DATA_READ"]), new Set(["CUSTOMER"])),
      actor(
        new Set(["OPERATIONS_READ", "SCHEDULE_READ", "FIELD_JOBS_READ"]),
        new Set(["TECHNICIAN"]),
      ),
    ]) {
      const fake = repository();
      const service = createSchedulingDispatchService(fake);
      await expect(
        service.getDispatchDay(denied, {
          workDate: "2026-08-26",
          includeRevenue: false,
        }),
      ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
      await expect(
        service.previewBooking(denied, {
          bookingReference,
          workDate: "2026-08-26",
        }),
      ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
      expect(fake.getDispatchDay).not.toHaveBeenCalled();
      expect(fake.previewBooking).not.toHaveBeenCalled();
    }
  });

  it("requires the complete manage boundary before validating or mutating", async () => {
    const fake = repository();
    const service = createSchedulingDispatchService(fake);
    await expect(
      service.confirmSchedule(actor(staffReadPermissions), {
        untrusted: true,
      }),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(fake.confirmSchedule).not.toHaveBeenCalled();
  });

  it("strictly rejects unknown authority fields and missing review acknowledgement", async () => {
    const fake = repository();
    const service = createSchedulingDispatchService(fake);
    const managingActor = actor(staffManagePermissions);

    await expect(
      service.confirmSchedule(managingActor, {
        ...initialConfirmation,
        serviceEnd: "2026-08-26T20:00:00.000Z",
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "INVALID_REQUEST",
      }),
    );
    await expect(
      service.confirmSchedule(managingActor, {
        ...initialConfirmation,
        acknowledged: false,
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(fake.confirmSchedule).not.toHaveBeenCalled();
  });

  it("downgrades revenue access unless commercial read permission is present", async () => {
    const withoutCommercial = repository();
    const service = createSchedulingDispatchService(withoutCommercial);
    await service.getDispatchDay(actor(staffReadPermissions), {
      workDate: "2026-08-26",
      includeRevenue: true,
    });
    expect(withoutCommercial.getDispatchDay).toHaveBeenCalledWith(profileId, {
      workDate: "2026-08-26",
      includeRevenue: false,
    });

    const withCommercial = repository();
    await createSchedulingDispatchService(withCommercial).getDispatchDay(
      actor(new Set([...staffReadPermissions, "COMMERCIAL_RULES_READ"])),
      { workDate: "2026-08-26", includeRevenue: true },
    );
    expect(withCommercial.getDispatchDay).toHaveBeenCalledWith(profileId, {
      workDate: "2026-08-26",
      includeRevenue: true,
    });
  });

  it("forwards only the normalized, server-owned confirmation command", async () => {
    const fake = repository();
    const result = await createSchedulingDispatchService(fake).confirmSchedule(
      actor(staffManagePermissions),
      initialConfirmation,
    );
    expect(result).toEqual(scheduled);
    expect(fake.confirmSchedule).toHaveBeenCalledWith(profileId, {
      bookingReference,
      expectedBookingVersion: 2,
      workDate: "2026-08-26",
      candidateKey: initialConfirmation.candidateKey,
      expectedOccupancySnapshotVersion: null,
      reasonCategory: null,
      reasonText: null,
    });
  });

  it.each([
    ["NOT_FOUND_OR_FORBIDDEN", "RECORD_NOT_FOUND_OR_FORBIDDEN"],
    ["STALE", "STALE"],
    ["CONFLICT", "CONFLICT"],
    ["INVALID_TRANSITION", "INVALID_TRANSITION"],
    ["REVIEW_REQUIRED", "REQUIRES_REVIEW"],
  ] as const)(
    "maps repository %s without leaking internal details",
    async (status, code) => {
      const result: ScheduleMutationResult =
        status === "REVIEW_REQUIRED"
          ? { status, reasonCodes: ["INTERNAL_PROVENANCE_DETAIL"] }
          : { status };
      const fake = repository(result);
      await expect(
        createSchedulingDispatchService(fake).confirmSchedule(
          actor(staffManagePermissions),
          initialConfirmation,
        ),
      ).rejects.toEqual(
        expect.objectContaining({
          name: "SchedulingDispatchServiceError",
          code,
          message: code,
        }),
      );
    },
  );

  it("maps unexpected repository failures to a generic unavailable error", async () => {
    const fake = repository();
    fake.previewBooking.mockRejectedValueOnce(
      new Error("sensitive provider failure detail"),
    );
    await expect(
      createSchedulingDispatchService(fake).previewBooking(
        actor(staffReadPermissions),
        { bookingReference, workDate: "2026-08-26" },
      ),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "TEMPORARILY_UNAVAILABLE",
        message: "TEMPORARILY_UNAVAILABLE",
      }),
    );
  });

  it("maps an absent preview to the shared not-found-or-forbidden result", async () => {
    const fake = repository();
    fake.previewBooking.mockResolvedValueOnce(null);
    await expect(
      createSchedulingDispatchService(fake).previewBooking(
        actor(staffReadPermissions),
        { bookingReference, workDate: "2026-08-26" },
      ),
    ).rejects.toMatchObject({ code: "RECORD_NOT_FOUND_OR_FORBIDDEN" });
  });
});
