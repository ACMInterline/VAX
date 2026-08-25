import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationBoundaryError } from "@/auth/principal-policy";

const doubles = vi.hoisted(() => {
  const service = {
    acceptMyQuote: vi.fn(),
    acceptQuoteOnBehalf: vi.fn(),
    cancelBooking: vi.fn(),
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
vi.mock("@/modules/booking-engine/repository", () => ({
  createDatabaseBookingRepository: doubles.repositoryFactory,
}));
vi.mock("@/modules/booking-engine/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/booking-engine/service")>()),
  createBookingService: doubles.serviceFactory,
}));

import {
  acceptMyQuoteAction,
  acceptQuoteOnBehalfAction,
  cancelBookingAction,
} from "./actions";

const profileId = "10000000-0000-4000-8000-000000000001";
const quoteReference = "Q-0123456789ABCDEF01234567";
const bookingReference = "BKG-0123456789ABCDEF01234567";
const idle = { status: "IDLE" as const };
const principal = {
  profile: {
    id: profileId,
    displayName: "Synthetic actor",
    preferredLocale: "en" as const,
    phone: null,
    status: "ACTIVE" as const,
  },
  identity: { id: "provider-subject" },
  session: { user: { id: "provider-subject" } },
  roles: new Set(["DISPATCHER"]),
  permissions: new Set([
    "OWN_CUSTOMER_DATA_READ",
    "OWN_CUSTOMER_DATA_UPDATE",
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

function customerForm(extra: readonly (readonly [string, string])[] = []) {
  return form([
    ["quoteReference", quoteReference],
    ["expectedQuoteVersion", "3"],
    ["acknowledged", "true"],
    ...extra,
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  doubles.requireAuthenticatedUser.mockResolvedValue(principal);
  doubles.isAuthAttemptAllowed.mockResolvedValue(true);
  doubles.serviceFactory.mockReturnValue(doubles.service);
  doubles.service.acceptMyQuote.mockResolvedValue({
    status: "CREATED",
    bookingReference,
  });
  doubles.service.acceptQuoteOnBehalf.mockResolvedValue({
    status: "CREATED",
    bookingReference,
  });
  doubles.service.cancelBooking.mockResolvedValue({
    status: "CANCELLED",
    bookingReference,
  });
});

describe("booking Server Action boundaries", () => {
  it("authenticates before reading hostile form data", async () => {
    doubles.requireAuthenticatedUser.mockRejectedValueOnce(
      new AuthenticationBoundaryError("AUTHENTICATION_REQUIRED"),
    );
    const data = new FormData();
    const getAll = vi.spyOn(data, "getAll");

    const result = await acceptMyQuoteAction(idle, data);

    expect(result).toMatchObject({ status: "ERROR" });
    expect(getAll).not.toHaveBeenCalled();
    expect(doubles.service.acceptMyQuote).not.toHaveBeenCalled();
  });

  it("accepts only the exact quote/version plus explicit customer acknowledgement", async () => {
    const result = await acceptMyQuoteAction(idle, customerForm());

    expect(doubles.service.acceptMyQuote).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      {
        quoteReference,
        expectedQuoteVersion: 3,
        acknowledged: true,
      },
    );
    expect(result).toMatchObject({
      status: "SUCCESS",
      bookingReference,
    });
    expect(doubles.revalidatePath).toHaveBeenCalledWith(
      `/app/my-bookings/${bookingReference}`,
    );
  });

  it("rejects a missing acknowledgement, duplicate scalar, and hostile authority field", async () => {
    const missing = form([
      ["quoteReference", quoteReference],
      ["expectedQuoteVersion", "3"],
    ]);
    const duplicate = customerForm([["quoteReference", quoteReference]]);
    const hostile = customerForm([["customerId", "forged-customer"]]);

    await expect(acceptMyQuoteAction(idle, missing)).resolves.toMatchObject({
      status: "ERROR",
      fieldErrors: expect.objectContaining({ acknowledged: expect.any(Array) }),
    });
    await expect(acceptMyQuoteAction(idle, duplicate)).resolves.toMatchObject({
      status: "ERROR",
    });
    await expect(acceptMyQuoteAction(idle, hostile)).resolves.toMatchObject({
      status: "ERROR",
    });
    expect(doubles.service.acceptMyQuote).not.toHaveBeenCalled();
  });

  it("returns a safe staff-review state without internal reason codes", async () => {
    doubles.service.acceptMyQuote.mockResolvedValueOnce({
      status: "REVIEW_REQUIRED",
    });

    const result = await acceptMyQuoteAction(idle, customerForm());

    expect(result).toEqual({
      status: "ERROR",
      message: expect.stringContaining("staff review"),
    });
    expect(JSON.stringify(result)).not.toContain("PROVENANCE");
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });

  it("requires recorded customer instruction, controlled source, and note for staff acceptance", async () => {
    const data = form([
      ["quoteReference", quoteReference],
      ["expectedQuoteVersion", "3"],
      ["customerInstructionConfirmed", "true"],
      ["acceptanceSource", "PHONE"],
      ["acceptanceNote", "Customer explicitly accepted by telephone."],
    ]);

    await acceptQuoteOnBehalfAction(idle, data);

    expect(doubles.service.acceptQuoteOnBehalf).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      {
        quoteReference,
        expectedQuoteVersion: 3,
        customerInstructionConfirmed: true,
        acceptanceSource: "PHONE",
        acceptanceNote: "Customer explicitly accepted by telephone.",
      },
    );
  });

  it("fails closed when the protected mutation limiter denies the request", async () => {
    doubles.isAuthAttemptAllowed.mockResolvedValueOnce(false);

    const result = await acceptMyQuoteAction(idle, customerForm());

    expect(result).toMatchObject({ status: "ERROR" });
    expect(doubles.isAuthAttemptAllowed).toHaveBeenCalledWith(
      "BOOKING_MUTATION",
      profileId,
    );
    expect(doubles.service.acceptMyQuote).not.toHaveBeenCalled();
  });

  it("submits cancellation evidence without accepting client scheduling state", async () => {
    const result = await cancelBookingAction(
      idle,
      form([
        ["bookingReference", bookingReference],
        ["expectedVersion", "2"],
        ["reasonCategory", "CUSTOMER_REQUEST"],
        ["reasonText", "Customer requested cancellation."],
        ["cancellationAcknowledged", "true"],
      ]),
    );

    expect(doubles.service.cancelBooking).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      {
        bookingReference,
        expectedVersion: 2,
        reasonCategory: "CUSTOMER_REQUEST",
        reasonText: "Customer requested cancellation.",
      },
    );
    expect(result).toMatchObject({ status: "SUCCESS", bookingReference });
  });
});
