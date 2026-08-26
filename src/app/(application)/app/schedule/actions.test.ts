import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationBoundaryError } from "@/auth/principal-policy";

const doubles = vi.hoisted(() => {
  const service = { confirmSchedule: vi.fn() };
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
vi.mock("@/modules/scheduling-dispatch/repository", () => ({
  createDatabaseSchedulingDispatchRepository: doubles.repositoryFactory,
}));
vi.mock("@/modules/scheduling-dispatch/service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/scheduling-dispatch/service")
  >()),
  createSchedulingDispatchService: doubles.serviceFactory,
}));

import {
  SchedulingDispatchServiceError,
} from "@/modules/scheduling-dispatch/service";
import { confirmScheduleAction } from "./actions";

const profileId = "10000000-0000-4000-8000-000000000001";
const bookingReference = "BKG-0123456789ABCDEF01234567";
const idle = { status: "IDLE" as const };
const principal = {
  profile: {
    id: profileId,
    displayName: "Synthetic dispatcher",
    preferredLocale: "en" as const,
    phone: null,
    status: "ACTIVE" as const,
  },
  identity: { id: "provider-subject" },
  session: { user: { id: "provider-subject" } },
  roles: new Set(["DISPATCHER"]),
  permissions: new Set([
    "CUSTOMER_RECORDS_READ",
    "CUSTOMER_RECORDS_MANAGE",
    "OPERATIONS_READ",
    "OPERATIONS_MANAGE",
    "SCHEDULE_READ",
    "SCHEDULE_MANAGE",
  ]),
};

function form(entries: readonly (readonly [string, string])[]): FormData {
  const result = new FormData();
  for (const [name, value] of entries) result.append(name, value);
  return result;
}

function initialForm(extra: readonly (readonly [string, string])[] = []) {
  return form([
    ["bookingReference", bookingReference],
    ["expectedBookingVersion", "4"],
    ["workDate", "2026-10-25"],
    ["candidateKey", "candidate-key-0001"],
    ["acknowledged", "true"],
    ...extra,
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  doubles.requireAuthenticatedUser.mockResolvedValue(principal);
  doubles.isAuthAttemptAllowed.mockResolvedValue(true);
  doubles.serviceFactory.mockReturnValue(doubles.service);
  doubles.service.confirmSchedule.mockResolvedValue({
    status: "SCHEDULED",
    bookingReference,
    occupancyId: "20000000-0000-4000-8000-000000000001",
    occupancySnapshotVersion: 1,
    bookingVersion: 5,
    serviceStart: new Date("2026-10-25T06:30:00.000Z"),
    serviceEnd: new Date("2026-10-25T08:00:00.000Z"),
  });
});

describe("Phase 3G scheduling Server Action boundary", () => {
  it("authenticates before reading hostile form data", async () => {
    doubles.requireAuthenticatedUser.mockRejectedValueOnce(
      new AuthenticationBoundaryError("AUTHENTICATION_REQUIRED"),
    );
    const data = new FormData();
    const getAll = vi.spyOn(data, "getAll");

    const result = await confirmScheduleAction(idle, data);

    expect(result).toMatchObject({ status: "ERROR" });
    expect(getAll).not.toHaveBeenCalled();
    expect(doubles.isAuthAttemptAllowed).not.toHaveBeenCalled();
    expect(doubles.service.confirmSchedule).not.toHaveBeenCalled();
  });

  it("authorizes every manage permission before rate limiting or parsing", async () => {
    doubles.requireAuthenticatedUser.mockResolvedValueOnce({
      ...principal,
      permissions: new Set(["OPERATIONS_MANAGE", "SCHEDULE_MANAGE"]),
    });
    const data = initialForm();
    const getAll = vi.spyOn(data, "getAll");

    const result = await confirmScheduleAction(idle, data);

    expect(result).toMatchObject({ status: "ERROR" });
    expect(getAll).not.toHaveBeenCalled();
    expect(doubles.isAuthAttemptAllowed).not.toHaveBeenCalled();
    expect(doubles.service.confirmSchedule).not.toHaveBeenCalled();
  });

  it("rate limits before reading FormData", async () => {
    doubles.isAuthAttemptAllowed.mockResolvedValueOnce(false);
    const data = initialForm();
    const getAll = vi.spyOn(data, "getAll");

    const result = await confirmScheduleAction(idle, data);

    expect(result).toMatchObject({ status: "ERROR" });
    expect(doubles.isAuthAttemptAllowed).toHaveBeenCalledWith(
      "BOOKING_MUTATION",
      profileId,
    );
    expect(getAll).not.toHaveBeenCalled();
    expect(doubles.service.confirmSchedule).not.toHaveBeenCalled();
  });

  it("submits only an opaque candidate and concurrency evidence for initial scheduling", async () => {
    const result = await confirmScheduleAction(idle, initialForm());

    expect(doubles.service.confirmSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      {
        bookingReference,
        expectedBookingVersion: 4,
        workDate: "2026-10-25",
        candidateKey: "candidate-key-0001",
        expectedOccupancySnapshotVersion: null,
        reasonCategory: null,
        reasonText: null,
        acknowledged: true,
      },
    );
    expect(result).toEqual({
      status: "SUCCESS",
      message: expect.stringContaining("exact time"),
      bookingReference,
      workDate: "2026-10-25",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /occupancy|serviceStart|serviceEnd|teamId|equipmentId|travel/i,
    );
  });

  it("records a controlled reason only for rescheduling", async () => {
    doubles.service.confirmSchedule.mockResolvedValueOnce({
      status: "RESCHEDULED",
      bookingReference,
    });
    const result = await confirmScheduleAction(
      idle,
      form([
        ["bookingReference", bookingReference],
        ["expectedBookingVersion", "4"],
        ["workDate", "2026-10-25"],
        ["candidateKey", "candidate-key-0002"],
        ["expectedOccupancySnapshotVersion", "2"],
        ["reasonCategory", "CUSTOMER_REQUEST"],
        ["reasonText", "Customer requested a later visit."],
        ["acknowledged", "true"],
      ]),
    );

    expect(doubles.service.confirmSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      expect.objectContaining({
        expectedOccupancySnapshotVersion: 2,
        reasonCategory: "CUSTOMER_REQUEST",
        reasonText: "Customer requested a later visit.",
      }),
    );
    expect(result).toMatchObject({ status: "SUCCESS" });
  });

  it("rejects duplicate, unexpected authority, and client-computed scheduling fields", async () => {
    const attempts = [
      initialForm([["candidateKey", "candidate-key-0002"]]),
      initialForm([["teamId", "99"]]),
      initialForm([["serviceEnd", "2026-10-25T08:00:00.000Z"]]),
      initialForm([["schedulingSnapshot", "forged"]]),
    ];

    for (const data of attempts) {
      await expect(confirmScheduleAction(idle, data)).resolves.toMatchObject({
        status: "ERROR",
      });
    }
    expect(doubles.service.confirmSchedule).not.toHaveBeenCalled();
  });

  it("maps stale and review failures to safe localized UI states", async () => {
    doubles.service.confirmSchedule.mockRejectedValueOnce(
      new SchedulingDispatchServiceError("STALE"),
    );
    const stale = await confirmScheduleAction(idle, initialForm());
    doubles.service.confirmSchedule.mockRejectedValueOnce(
      new SchedulingDispatchServiceError("REQUIRES_REVIEW"),
    );
    const review = await confirmScheduleAction(idle, initialForm());

    expect(stale).toMatchObject({ status: "ERROR" });
    expect(review).toMatchObject({ status: "ERROR" });
    expect(JSON.stringify([stale, review])).not.toMatch(
      /STALE|REQUIRES_REVIEW|provider|database|constraint/i,
    );
  });
});
