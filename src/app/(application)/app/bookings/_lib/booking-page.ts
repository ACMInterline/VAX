import "server-only";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import type { AuthLocale } from "@/auth/validation";
import { getDatabase } from "@/db/client";
import {
  BookingAuthorizationError,
  requireCustomerBookingRead,
  requireStaffBookingRead,
  type BookingActor,
} from "@/modules/booking-engine/policy";
import { createDatabaseBookingRepository } from "@/modules/booking-engine/repository";
import {
  createBookingService,
  BookingServiceError,
  type BookingService,
} from "@/modules/booking-engine/service";
import {
  bookingStatuses,
  schedulingStatuses,
} from "@/modules/booking-engine/types";
import { bookingReferenceSchema } from "@/modules/booking-engine/validation";
import { requireApplicationPrincipal } from "../../application-principal";

export type BookingRouteParams = { bookingReference: string };
export type BookingSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type BookingPageContext = Readonly<{
  actor: BookingActor;
  locale: AuthLocale;
}>;

const bookingRouteParamsSchema = z
  .object({ bookingReference: bookingReferenceSchema })
  .strict();
const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.valueOf()) &&
      date.toISOString().slice(0, 10) === value
    );
  });
const staffBookingSearchParamsSchema = z
  .object({
    search: z.string().trim().max(160).optional(),
    status: z.enum(bookingStatuses).optional(),
    schedulingStatus: z.enum(schedulingStatuses).optional(),
    scheduledFrom: dateOnlySchema.optional(),
    scheduledTo: dateOnlySchema.optional(),
    page: z
      .string()
      .regex(/^\d{1,5}$/)
      .transform(Number)
      .refine(
        (value) => Number.isSafeInteger(value) && value > 0 && value <= 4_167,
      )
      .optional(),
  })
  .strict();

function actorFromPrincipal(
  principal: Awaited<ReturnType<typeof requireApplicationPrincipal>>,
): BookingActor {
  return {
    profileId: principal.profile.id,
    status: principal.profile.status,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

async function requireBookingPageContext(
  authorize: (actor: BookingActor) => void,
): Promise<BookingPageContext> {
  const principal = await requireApplicationPrincipal();
  const actor = actorFromPrincipal(principal);
  try {
    authorize(actor);
  } catch (error) {
    if (error instanceof BookingAuthorizationError) {
      redirect("/app?access=denied");
    }
    throw error;
  }
  return { actor, locale: principal.profile.preferredLocale };
}

export function requireCustomerBookingPageContext() {
  return requireBookingPageContext(requireCustomerBookingRead);
}

export function requireStaffBookingPageContext() {
  return requireBookingPageContext(requireStaffBookingRead);
}

export function createBookingPageService(): BookingService {
  return createBookingService(
    createDatabaseBookingRepository(getDatabase()),
  );
}

export async function parseBookingRouteParams(
  params: Promise<BookingRouteParams>,
): Promise<BookingRouteParams> {
  const parsed = bookingRouteParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  return parsed.data;
}

export async function parseStaffBookingSearchParams(
  searchParams: Promise<BookingSearchParams>,
) {
  const parsed = staffBookingSearchParamsSchema.safeParse(await searchParams);
  if (!parsed.success) notFound();
  const page = parsed.data.page ?? 1;
  const limit = 24;
  const scheduledFrom = parsed.data.scheduledFrom
    ? new Date(`${parsed.data.scheduledFrom}T00:00:00.000Z`)
    : undefined;
  const scheduledTo = parsed.data.scheduledTo
    ? new Date(
        new Date(`${parsed.data.scheduledTo}T00:00:00.000Z`).valueOf() +
          24 * 60 * 60 * 1_000,
      )
    : undefined;
  if (
    scheduledFrom &&
    scheduledTo &&
    scheduledFrom.valueOf() >= scheduledTo.valueOf()
  ) {
    notFound();
  }
  return {
    filters: {
      search: parsed.data.search || undefined,
      status: parsed.data.status,
      schedulingStatus: parsed.data.schedulingStatus,
      scheduledFrom,
      scheduledTo,
      limit,
      offset: (page - 1) * limit,
    },
    page,
    scheduledFromValue: parsed.data.scheduledFrom,
    scheduledToValue: parsed.data.scheduledTo,
  };
}

export async function loadCustomerBookingOrNotFound(
  service: BookingService,
  actor: BookingActor,
  bookingReference: string,
) {
  try {
    return await service.getMyBooking(actor, { bookingReference });
  } catch (error) {
    if (
      error instanceof BookingServiceError &&
      error.code === "RECORD_NOT_FOUND_OR_FORBIDDEN"
    ) {
      notFound();
    }
    throw error;
  }
}

export async function loadStaffBookingOrNotFound(
  service: BookingService,
  actor: BookingActor,
  bookingReference: string,
) {
  try {
    return await service.getBooking(actor, { bookingReference });
  } catch (error) {
    if (
      error instanceof BookingServiceError &&
      error.code === "RECORD_NOT_FOUND_OR_FORBIDDEN"
    ) {
      notFound();
    }
    throw error;
  }
}
