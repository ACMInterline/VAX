import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  rolePermissionMatrix,
  type ApplicationRoleCode,
} from "@/modules/identity-access/policy";

vi.mock("./reference", () => ({
  generateBookingReference: vi.fn(),
}));

import { BookingAuthorizationError, type BookingActor } from "./policy";
import { generateBookingReference } from "./reference";
import type { BookingRepository } from "./repository";
import { BookingServiceError, createBookingService } from "./service";
import type {
  CustomerBookingDetail,
  CustomerBookingSummary,
  StaffBookingDetail,
  StaffBookingSummary,
} from "./types";

const customerProfileId = "10000000-0000-4000-8000-000000000001";
const staffProfileId = "10000000-0000-4000-8000-000000000002";
const quoteReference = "Q-000000000000000000000001";
const bookingReference = "BKG-000000000000000000000001";
const secondBookingReference = "BKG-000000000000000000000002";
const thirdBookingReference = "BKG-000000000000000000000003";
const createdAt = new Date("2026-08-25T10:00:00.000Z");

function actor(role: ApplicationRoleCode, profileId: string): BookingActor {
  return {
    profileId,
    status: "ACTIVE",
    roles: new Set([role]),
    permissions: new Set(rolePermissionMatrix[role]),
  };
}

const customerSummary = {
  bookingReference,
  quoteReference,
  status: "PENDING_SCHEDULING",
  schedulingStatus: "REVIEW_REQUIRED",
  propertyLabel: "Synthetic home",
  grossTotalMinorUnits: 12_000,
  currency: "EUR",
  preferredDate: "2026-09-10",
  appointmentWindowCode: "morning",
  scheduledStart: null,
  scheduledEnd: null,
  createdAt,
} satisfies CustomerBookingSummary;

const customerDetail = {
  ...customerSummary,
  customerDisplayName: "Synthetic customer",
  propertyAddress: "Synthetic 1",
  netAmountMinorUnits: 10_000,
  vatRateBasisPoints: 2_000,
  vatAmountMinorUnits: 2_000,
  estimatedDurationMinutes: 90,
  termsSnapshot: { schemaVersion: 1 },
  customerNotes: "Customer-safe note",
  items: [
    {
      descriptionBg: "Почистване на диван",
      descriptionEn: "Sofa cleaning",
      quantity: 1,
      measurementSnapshot: { seatCount: 2 },
      netAmountMinorUnits: 10_000,
      vatRateBasisPoints: 2_000,
      vatAmountMinorUnits: 2_000,
      grossTotalMinorUnits: 12_000,
      sortOrder: 0,
    },
  ],
} satisfies CustomerBookingDetail;

const staffSummary = {
  ...customerSummary,
  customerDisplayName: "Synthetic customer",
  assignedTeamName: null,
  manualReviewRequired: true,
  version: 1,
} satisfies StaffBookingSummary;

const staffDetail = {
  ...staffSummary,
  propertyAddress: "Synthetic 1",
  acceptanceActorType: "STAFF_ON_BEHALF",
  acceptanceSource: "PHONE",
  acceptanceNote: "Customer confirmed by phone.",
  acceptedAt: createdAt,
  netAmountMinorUnits: 10_000,
  vatRateBasisPoints: 2_000,
  vatAmountMinorUnits: 2_000,
  estimatedDurationMinutes: 90,
  commercialSnapshot: { schemaVersion: 1 },
  termsSnapshot: { schemaVersion: 1 },
  durationSnapshot: { schemaVersion: 1 },
  schedulingSnapshot: { schemaVersion: 1 },
  customerNotes: "Customer-safe note",
  internalNotes: null,
  items: customerDetail.items,
  auditTimeline: [
    {
      eventType: "BOOKING_CREATED",
      source: "STAFF",
      safeMetadata: { actorType: "STAFF_ON_BEHALF" },
      createdAt,
    },
  ],
} satisfies StaffBookingDetail;

function doubles() {
  return {
    previewCustomerAcceptance: vi.fn<
      BookingRepository["previewCustomerAcceptance"]
    >(async () => ({ state: "ELIGIBLE", bookingReference: null })),
    acceptQuote: vi.fn<BookingRepository["acceptQuote"]>(async () => ({
      status: "CREATED",
      bookingReference,
    })),
    listCustomerBookings: vi.fn<
      BookingRepository["listCustomerBookings"]
    >(async () => [customerSummary]),
    getCustomerBooking: vi.fn<BookingRepository["getCustomerBooking"]>(
      async () => customerDetail,
    ),
    listStaffBookings: vi.fn<BookingRepository["listStaffBookings"]>(
      async (_actorProfileId, input) => ({
        items: [staffSummary],
        total: 1,
        limit: input.limit,
        offset: input.offset,
      }),
    ),
    getStaffBooking: vi.fn<BookingRepository["getStaffBooking"]>(
      async () => staffDetail,
    ),
    cancelBooking: vi.fn<BookingRepository["cancelBooking"]>(async () => ({
      status: "CANCELLED",
      bookingReference,
    })),
  };
}

function serviceWith(repositoryDoubles = doubles()) {
  return {
    repositoryDoubles,
    service: createBookingService(
      repositoryDoubles as unknown as BookingRepository,
    ),
  };
}

function expectServiceFailure(
  operation: Promise<unknown>,
  code: BookingServiceError["code"],
) {
  return expect(operation).rejects.toMatchObject({
    name: "BookingServiceError",
    code,
  });
}

beforeEach(() => {
  vi.mocked(generateBookingReference).mockReset();
  vi.mocked(generateBookingReference).mockReturnValue(bookingReference);
});

describe("booking service", () => {
  it("creates a customer acceptance from explicit acknowledgement and a server reference", async () => {
    const { service, repositoryDoubles } = serviceWith();

    await expect(
      service.acceptMyQuote(actor("CUSTOMER", customerProfileId), {
        quoteReference,
        expectedQuoteVersion: 2,
        acknowledged: true,
      }),
    ).resolves.toEqual({ status: "CREATED", bookingReference });
    expect(repositoryDoubles.acceptQuote).toHaveBeenCalledWith(
      customerProfileId,
      {
        quoteReference,
        expectedQuoteVersion: 2,
        bookingReference,
        actorType: "CUSTOMER",
        acceptanceSource: "CUSTOMER_PORTAL",
        acceptanceNote: null,
      },
    );
  });

  it("rejects missing customer acknowledgement before persistence", async () => {
    const { service, repositoryDoubles } = serviceWith();

    await expectServiceFailure(
      service.acceptMyQuote(actor("CUSTOMER", customerProfileId), {
        quoteReference,
        expectedQuoteVersion: 2,
        acknowledged: false,
      }),
      "INVALID_REQUEST",
    );
    expect(repositoryDoubles.acceptQuote).not.toHaveBeenCalled();
  });

  it("returns an existing staff-on-behalf acceptance and forwards trimmed evidence", async () => {
    const repositoryDoubles = doubles();
    repositoryDoubles.acceptQuote.mockResolvedValueOnce({
      status: "EXISTING",
      bookingReference,
    });
    const { service } = serviceWith(repositoryDoubles);

    await expect(
      service.acceptQuoteOnBehalf(actor("DISPATCHER", staffProfileId), {
        quoteReference,
        expectedQuoteVersion: 2,
        customerInstructionConfirmed: true,
        acceptanceSource: "PHONE",
        acceptanceNote: "  Customer confirmed by phone.  ",
      }),
    ).resolves.toEqual({ status: "EXISTING", bookingReference });
    expect(repositoryDoubles.acceptQuote).toHaveBeenCalledWith(
      staffProfileId,
      expect.objectContaining({
        actorType: "STAFF_ON_BEHALF",
        acceptanceSource: "PHONE",
        acceptanceNote: "Customer confirmed by phone.",
      }),
    );
  });

  it("rejects incomplete staff evidence before persistence", async () => {
    const { service, repositoryDoubles } = serviceWith();

    await expectServiceFailure(
      service.acceptQuoteOnBehalf(actor("DISPATCHER", staffProfileId), {
        quoteReference,
        expectedQuoteVersion: 2,
        customerInstructionConfirmed: true,
        acceptanceSource: "UNCONTROLLED_SOURCE",
        acceptanceNote: " ",
      }),
      "INVALID_REQUEST",
    );
    expect(repositoryDoubles.acceptQuote).not.toHaveBeenCalled();
  });

  it("hides repository review reasons from the public service result", async () => {
    const repositoryDoubles = doubles();
    repositoryDoubles.acceptQuote.mockResolvedValueOnce({
      status: "REVIEW_REQUIRED",
      reasonCodes: [
        "REQUEST_PROVENANCE_MISMATCH",
        "COMMERCIAL_FRESHNESS_MISMATCH",
      ],
    });
    const { service } = serviceWith(repositoryDoubles);

    const result = await service.acceptMyQuote(
      actor("CUSTOMER", customerProfileId),
      {
        quoteReference,
        expectedQuoteVersion: 2,
        acknowledged: true,
      },
    );

    expect(result).toEqual({ status: "REVIEW_REQUIRED" });
    expect(result).not.toHaveProperty("reasonCodes");
  });

  it("retries booking-reference conflicts with a fresh server-generated reference", async () => {
    vi.mocked(generateBookingReference)
      .mockReturnValueOnce(bookingReference)
      .mockReturnValueOnce(secondBookingReference)
      .mockReturnValueOnce(thirdBookingReference);
    const repositoryDoubles = doubles();
    repositoryDoubles.acceptQuote
      .mockResolvedValueOnce({ status: "REFERENCE_CONFLICT" })
      .mockResolvedValueOnce({ status: "REFERENCE_CONFLICT" })
      .mockResolvedValueOnce({
        status: "CREATED",
        bookingReference: thirdBookingReference,
      });
    const { service } = serviceWith(repositoryDoubles);

    await expect(
      service.acceptMyQuote(actor("CUSTOMER", customerProfileId), {
        quoteReference,
        expectedQuoteVersion: 2,
        acknowledged: true,
      }),
    ).resolves.toEqual({
      status: "CREATED",
      bookingReference: thirdBookingReference,
    });
    expect(repositoryDoubles.acceptQuote).toHaveBeenCalledTimes(3);
    expect(
      repositoryDoubles.acceptQuote.mock.calls.map(
        ([, input]) => input.bookingReference,
      ),
    ).toEqual([
      bookingReference,
      secondBookingReference,
      thirdBookingReference,
    ]);
  });

  it("fails with one conflict after all reference retries are exhausted", async () => {
    const repositoryDoubles = doubles();
    repositoryDoubles.acceptQuote.mockResolvedValue({
      status: "REFERENCE_CONFLICT",
    });
    const { service } = serviceWith(repositoryDoubles);

    await expectServiceFailure(
      service.acceptMyQuote(actor("CUSTOMER", customerProfileId), {
        quoteReference,
        expectedQuoteVersion: 2,
        acknowledged: true,
      }),
      "CONFLICT",
    );
    expect(repositoryDoubles.acceptQuote).toHaveBeenCalledTimes(3);
  });

  it("maps missing acceptance and read targets to the same safe not-found result", async () => {
    const repositoryDoubles = doubles();
    repositoryDoubles.acceptQuote.mockResolvedValueOnce({
      status: "NOT_FOUND_OR_FORBIDDEN",
    });
    repositoryDoubles.previewCustomerAcceptance.mockResolvedValueOnce(null);
    repositoryDoubles.getCustomerBooking.mockResolvedValueOnce(null);
    repositoryDoubles.getStaffBooking.mockResolvedValueOnce(null);
    const { service } = serviceWith(repositoryDoubles);

    await expectServiceFailure(
      service.acceptMyQuote(actor("CUSTOMER", customerProfileId), {
        quoteReference,
        expectedQuoteVersion: 2,
        acknowledged: true,
      }),
      "RECORD_NOT_FOUND_OR_FORBIDDEN",
    );
    await expectServiceFailure(
      service.previewMyQuoteAcceptance(actor("CUSTOMER", customerProfileId), {
        quoteReference,
      }),
      "RECORD_NOT_FOUND_OR_FORBIDDEN",
    );
    await expectServiceFailure(
      service.getMyBooking(actor("CUSTOMER", customerProfileId), {
        bookingReference,
      }),
      "RECORD_NOT_FOUND_OR_FORBIDDEN",
    );
    await expectServiceFailure(
      service.getBooking(actor("DISPATCHER", staffProfileId), {
        bookingReference,
      }),
      "RECORD_NOT_FOUND_OR_FORBIDDEN",
    );
  });

  it("returns only the customer DTOs through own-record access", async () => {
    const { service, repositoryDoubles } = serviceWith();
    const customer = actor("CUSTOMER", customerProfileId);

    await expect(service.listMyBookings(customer)).resolves.toEqual([
      customerSummary,
    ]);
    await expect(
      service.getMyBooking(customer, { bookingReference }),
    ).resolves.toEqual(customerDetail);
    await expect(
      service.previewMyQuoteAcceptance(customer, { quoteReference }),
    ).resolves.toEqual({ state: "ELIGIBLE", bookingReference: null });
    expect(repositoryDoubles.listCustomerBookings).toHaveBeenCalledWith(
      customerProfileId,
    );
    expect(repositoryDoubles.getCustomerBooking).toHaveBeenCalledWith(
      customerProfileId,
      bookingReference,
    );

    await expect(
      service.listBookings(customer, { limit: 25, offset: 0 }),
    ).rejects.toMatchObject({
      name: "BookingAuthorizationError",
      code: "PERMISSION_DENIED",
    } satisfies Partial<BookingAuthorizationError>);
  });

  it("returns staff DTOs only through the complete staff-read boundary", async () => {
    const { service, repositoryDoubles } = serviceWith();
    const staff = actor("DISPATCHER", staffProfileId);
    const scheduledFrom = new Date("2026-09-01T00:00:00.000Z");
    const scheduledTo = new Date("2026-10-01T00:00:00.000Z");

    await expect(
      service.listBookings(staff, {
        search: "  BKG-000  ",
        status: "PENDING_SCHEDULING",
        schedulingStatus: "REVIEW_REQUIRED",
        scheduledFrom,
        scheduledTo,
        limit: 25,
        offset: 0,
      }),
    ).resolves.toEqual({ items: [staffSummary], total: 1, limit: 25, offset: 0 });
    await expect(
      service.getBooking(staff, { bookingReference }),
    ).resolves.toEqual(staffDetail);
    expect(repositoryDoubles.listStaffBookings).toHaveBeenCalledWith(
      staffProfileId,
      expect.objectContaining({
        search: "BKG-000",
        scheduledFrom,
        scheduledTo,
        limit: 25,
        offset: 0,
      }),
    );

    await expect(service.listMyBookings(staff)).rejects.toMatchObject({
      name: "BookingAuthorizationError",
      code: "PERMISSION_DENIED",
    } satisfies Partial<BookingAuthorizationError>);
  });

  it("authorizes cancellation separately and preserves success or no-change results", async () => {
    const repositoryDoubles = doubles();
    repositoryDoubles.cancelBooking
      .mockResolvedValueOnce({ status: "CANCELLED", bookingReference })
      .mockResolvedValueOnce({ status: "NO_CHANGE", bookingReference });
    const { service } = serviceWith(repositoryDoubles);
    const dispatcher = actor("DISPATCHER", staffProfileId);
    const command = {
      bookingReference,
      expectedVersion: 1,
      reasonCategory: "OTHER",
      reasonText: "  Duplicate customer instruction.  ",
    } as const;

    await expect(service.cancelBooking(dispatcher, command)).resolves.toEqual({
      status: "CANCELLED",
      bookingReference,
    });
    await expect(service.cancelBooking(dispatcher, command)).resolves.toEqual({
      status: "NO_CHANGE",
      bookingReference,
    });
    expect(repositoryDoubles.cancelBooking).toHaveBeenNthCalledWith(
      1,
      staffProfileId,
      {
        ...command,
        reasonText: "Duplicate customer instruction.",
      },
    );

    await expect(
      service.cancelBooking(actor("TECHNICIAN", staffProfileId), command),
    ).rejects.toMatchObject({
      name: "BookingAuthorizationError",
      code: "PERMISSION_DENIED",
    } satisfies Partial<BookingAuthorizationError>);
    expect(repositoryDoubles.cancelBooking).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["NOT_FOUND_OR_FORBIDDEN", "RECORD_NOT_FOUND_OR_FORBIDDEN"],
    ["CONFLICT", "CONFLICT"],
    ["INVALID_TRANSITION", "INVALID_TRANSITION"],
  ] as const)(
    "maps cancellation repository %s to service %s",
    async (repositoryStatus, serviceCode) => {
      const repositoryDoubles = doubles();
      repositoryDoubles.cancelBooking.mockResolvedValueOnce({
        status: repositoryStatus,
      });
      const { service } = serviceWith(repositoryDoubles);

      await expectServiceFailure(
        service.cancelBooking(actor("DISPATCHER", staffProfileId), {
          bookingReference,
          expectedVersion: 1,
          reasonCategory: "OPERATIONAL",
          reasonText: null,
        }),
        serviceCode,
      );
    },
  );

  it("maps unexpected repository failures to temporary unavailability", async () => {
    const repositoryDoubles = doubles();
    repositoryDoubles.listCustomerBookings.mockRejectedValueOnce(
      new Error("sensitive provider detail"),
    );
    const { service } = serviceWith(repositoryDoubles);

    await expectServiceFailure(
      service.listMyBookings(actor("CUSTOMER", customerProfileId)),
      "TEMPORARILY_UNAVAILABLE",
    );
  });
});
