import { z, ZodError } from "zod";
import {
  requireCustomerBookingRead,
  requireCustomerQuoteAcceptance,
  requireStaffBookingRead,
  requireStaffBookingScheduling,
  requireStaffQuoteAcceptance,
  type BookingActor,
} from "./policy";
import { generateBookingReference } from "./reference";
import type { BookingRepository } from "./repository";
import type {
  AcceptanceRepositoryInput,
  AcceptanceRepositoryResult,
} from "./types";
import {
  bookingReferenceSchema,
  cancelBookingSchema,
  customerQuoteAcceptanceSchema,
  quoteReferenceSchema,
  staffBookingListSchema,
  staffQuoteAcceptanceSchema,
} from "./validation";

export type BookingServiceFailureCode =
  | "INVALID_REQUEST"
  | "RECORD_NOT_FOUND_OR_FORBIDDEN"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "TEMPORARILY_UNAVAILABLE";

export class BookingServiceError extends Error {
  readonly code: BookingServiceFailureCode;

  constructor(code: BookingServiceFailureCode) {
    super(code);
    this.name = "BookingServiceError";
    this.code = code;
  }
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new BookingServiceError("INVALID_REQUEST");
    }
    throw error;
  }
}

async function repositoryOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new BookingServiceError("TEMPORARILY_UNAVAILABLE");
  }
}

export type QuoteAcceptanceServiceResult =
  | Readonly<{
      status: "CREATED" | "EXISTING";
      bookingReference: string;
    }>
  | Readonly<{ status: "REVIEW_REQUIRED" }>;

function safeAcceptanceResult(
  result: AcceptanceRepositoryResult,
): QuoteAcceptanceServiceResult | "RETRY_REFERENCE" {
  if (result.status === "NOT_FOUND_OR_FORBIDDEN") {
    throw new BookingServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
  }
  if (result.status === "REFERENCE_CONFLICT") return "RETRY_REFERENCE";
  if (result.status === "REVIEW_REQUIRED") {
    return { status: "REVIEW_REQUIRED" };
  }
  if (result.status === "CREATED" || result.status === "EXISTING") {
    return {
      status: result.status,
      bookingReference: result.bookingReference,
    };
  }
  throw new BookingServiceError("TEMPORARILY_UNAVAILABLE");
}

async function acceptWithReferenceRetry(
  repository: BookingRepository,
  actorProfileId: string,
  command: Omit<AcceptanceRepositoryInput, "bookingReference">,
): Promise<QuoteAcceptanceServiceResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await repositoryOperation(() =>
      repository.acceptQuote(actorProfileId, {
        ...command,
        bookingReference: generateBookingReference(),
      }),
    );
    const safe = safeAcceptanceResult(result);
    if (safe !== "RETRY_REFERENCE") return safe;
  }
  throw new BookingServiceError("CONFLICT");
}

export function createBookingService(repository: BookingRepository) {
  return {
    async previewMyQuoteAcceptance(
      actor: BookingActor | null,
      input: unknown,
    ) {
      requireCustomerBookingRead(actor);
      const { quoteReference } = parse(
        z.object({ quoteReference: quoteReferenceSchema }).strict(),
        input,
      );
      const preview = await repositoryOperation(() =>
        repository.previewCustomerAcceptance(actor!.profileId, quoteReference),
      );
      if (!preview) {
        throw new BookingServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
      }
      return preview;
    },

    async acceptMyQuote(actor: BookingActor | null, input: unknown) {
      requireCustomerQuoteAcceptance(actor);
      const parsed = parse(customerQuoteAcceptanceSchema, input);
      return acceptWithReferenceRetry(repository, actor!.profileId, {
        quoteReference: parsed.quoteReference,
        expectedQuoteVersion: parsed.expectedQuoteVersion,
        actorType: "CUSTOMER",
        acceptanceSource: "CUSTOMER_PORTAL",
        acceptanceNote: null,
      });
    },

    async acceptQuoteOnBehalf(actor: BookingActor | null, input: unknown) {
      requireStaffQuoteAcceptance(actor);
      const parsed = parse(staffQuoteAcceptanceSchema, input);
      return acceptWithReferenceRetry(repository, actor!.profileId, {
        quoteReference: parsed.quoteReference,
        expectedQuoteVersion: parsed.expectedQuoteVersion,
        actorType: "STAFF_ON_BEHALF",
        acceptanceSource: parsed.acceptanceSource,
        acceptanceNote: parsed.acceptanceNote,
      });
    },

    async listMyBookings(actor: BookingActor | null) {
      requireCustomerBookingRead(actor);
      return repositoryOperation(() =>
        repository.listCustomerBookings(actor!.profileId),
      );
    },

    async getMyBooking(actor: BookingActor | null, input: unknown) {
      requireCustomerBookingRead(actor);
      const { bookingReference } = parse(
        z.object({ bookingReference: bookingReferenceSchema }).strict(),
        input,
      );
      const booking = await repositoryOperation(() =>
        repository.getCustomerBooking(actor!.profileId, bookingReference),
      );
      if (!booking) {
        throw new BookingServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
      }
      return booking;
    },

    async listBookings(actor: BookingActor | null, input: unknown) {
      requireStaffBookingRead(actor);
      const parsed = parse(staffBookingListSchema, input);
      return repositoryOperation(() =>
        repository.listStaffBookings(actor!.profileId, parsed),
      );
    },

    async getBooking(actor: BookingActor | null, input: unknown) {
      requireStaffBookingRead(actor);
      const { bookingReference } = parse(
        z.object({ bookingReference: bookingReferenceSchema }).strict(),
        input,
      );
      const booking = await repositoryOperation(() =>
        repository.getStaffBooking(actor!.profileId, bookingReference),
      );
      if (!booking) {
        throw new BookingServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
      }
      return booking;
    },

    async cancelBooking(actor: BookingActor | null, input: unknown) {
      requireStaffBookingScheduling(actor);
      const parsed = parse(cancelBookingSchema, input);
      const result = await repositoryOperation(() =>
        repository.cancelBooking(actor!.profileId, parsed),
      );
      if (result.status === "NOT_FOUND_OR_FORBIDDEN") {
        throw new BookingServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
      }
      if (result.status === "CONFLICT") {
        throw new BookingServiceError("CONFLICT");
      }
      if (result.status === "INVALID_TRANSITION") {
        throw new BookingServiceError("INVALID_TRANSITION");
      }
      return result;
    },
  };
}

export type BookingService = ReturnType<typeof createBookingService>;
