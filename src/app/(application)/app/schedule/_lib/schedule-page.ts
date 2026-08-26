import "server-only";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import type { AuthLocale } from "@/auth/validation";
import type {
  BookingSchedulePreviewView,
  DispatchDayView,
} from "@/components/scheduling/types";
import {
  schedulingAppointmentWindow,
  schedulingWarning,
} from "@/content/scheduling";
import { getDatabase } from "@/db/client";
import {
  SchedulingAuthorizationError,
  requireStaffSchedulingRead,
  type SchedulingActor,
} from "@/modules/scheduling-dispatch/policy";
import { createDatabaseSchedulingDispatchRepository } from "@/modules/scheduling-dispatch/repository";
import {
  createSchedulingDispatchService,
  SchedulingDispatchServiceError,
  type SchedulingDispatchService,
} from "@/modules/scheduling-dispatch/service";
import { sofiaTodayDate } from "@/modules/scheduling-dispatch/time";
import type {
  BookingSchedulePreview,
  DispatchDay,
} from "@/modules/scheduling-dispatch/types";
import {
  schedulingBookingReferenceSchema,
  schedulingDateSchema,
} from "@/modules/scheduling-dispatch/validation";
import { requireApplicationPrincipal } from "../../application-principal";

export type ScheduleSearchParams = Record<
  string,
  string | string[] | undefined
>;
export type ScheduleBookingRouteParams = { bookingReference: string };

export type SchedulePageContext = Readonly<{
  actor: SchedulingActor;
  locale: AuthLocale;
}>;

const scheduleSearchParamsSchema = z
  .object({ date: schedulingDateSchema.optional() })
  .strict();
const scheduleBookingRouteParamsSchema = z
  .object({ bookingReference: schedulingBookingReferenceSchema })
  .strict();

function presentWarnings(
  warnings: readonly string[],
  locale: AuthLocale,
): readonly string[] {
  return [
    ...new Set(warnings.map((warning) => schedulingWarning(locale, warning))),
  ];
}

function actorFromPrincipal(
  principal: Awaited<ReturnType<typeof requireApplicationPrincipal>>,
): SchedulingActor {
  return {
    profileId: principal.profile.id,
    status: principal.profile.status,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

export async function requireSchedulePageContext(): Promise<SchedulePageContext> {
  const principal = await requireApplicationPrincipal();
  const actor = actorFromPrincipal(principal);
  try {
    requireStaffSchedulingRead(actor);
  } catch (error) {
    if (error instanceof SchedulingAuthorizationError) {
      redirect("/app?access=denied");
    }
    throw error;
  }
  return { actor, locale: principal.profile.preferredLocale };
}

export function createSchedulePageService(): SchedulingDispatchService {
  return createSchedulingDispatchService(
    createDatabaseSchedulingDispatchRepository(getDatabase()),
  );
}

export async function parseScheduleSearchParams(
  searchParams: Promise<ScheduleSearchParams>,
): Promise<string> {
  const parsed = scheduleSearchParamsSchema.safeParse(await searchParams);
  if (!parsed.success) notFound();
  return parsed.data.date ?? sofiaTodayDate();
}

export async function parseScheduleBookingRouteParams(
  params: Promise<ScheduleBookingRouteParams>,
): Promise<ScheduleBookingRouteParams> {
  const parsed = scheduleBookingRouteParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  return parsed.data;
}

export async function loadBookingPreviewOrNotFound(
  service: SchedulingDispatchService,
  actor: SchedulingActor,
  input: Readonly<{ bookingReference: string; workDate: string }>,
) {
  try {
    return await service.previewBooking(actor, input);
  } catch (error) {
    if (
      error instanceof SchedulingDispatchServiceError &&
      error.code === "RECORD_NOT_FOUND_OR_FORBIDDEN"
    ) {
      notFound();
    }
    throw error;
  }
}

export function presentDispatchDay(
  day: DispatchDay,
  locale: AuthLocale,
): DispatchDayView {
  return {
    workDate: day.workDate,
    timeZone: day.timeZone,
    previousDate: day.previousDate,
    nextDate: day.nextDate,
    provisionalConfiguration: day.provisionalConfiguration,
    warnings: presentWarnings(day.warnings, locale),
    unscheduledBookings: day.unscheduledBookings.map((booking) => ({
      bookingReference: booking.bookingReference,
      customerDisplayName: booking.customerDisplayName,
      propertyLabel: booking.propertyLabel,
      preferredDate: booking.preferredDate,
      appointmentWindowLabel: schedulingAppointmentWindow(
        locale,
        booking.appointmentWindowLabel,
      ),
      serviceDurationMinutes: booking.serviceDurationMinutes,
      readiness: booking.readiness,
      warnings: presentWarnings(booking.warnings, locale),
    })),
    teams: day.teams.map((team) => ({
      id: team.id,
      code: team.code,
      name: team.name,
      workingWindowLabel: team.workingWindowLabel,
      appointments: team.appointments.map((appointment) => ({
        bookingReference: appointment.bookingReference,
        bookingStatus: appointment.bookingStatus,
        jobReference: appointment.jobReference,
        jobStatus: appointment.jobStatus,
        customerDisplayName: appointment.customerDisplayName,
        propertyLabel: appointment.propertyLabel,
        propertyAddress: appointment.propertyAddress,
        propertyArea: appointment.propertyArea,
        serviceStart: appointment.serviceStart,
        serviceEnd: appointment.serviceEnd,
        serviceDurationMinutes: appointment.serviceDurationMinutes,
        travelMinutes: appointment.travelMinutes,
        bufferMinutes: appointment.bufferMinutes,
        equipmentLabel: appointment.equipmentLabel,
        readiness: appointment.readiness,
        fallbackTravelUsed: appointment.fallbackTravelUsed,
        warnings: presentWarnings(appointment.warnings, locale),
      })),
      metrics: { ...team.metrics },
    })),
    metrics: { ...day.metrics },
  };
}

/**
 * Explicitly minimizes the preview before it crosses into the client form.
 * Team/equipment IDs, operational intervals, ranking evidence and provider
 * details remain server-side and are represented only by the opaque candidate
 * key that the service freshly revalidates.
 */
export function presentBookingSchedulePreview(
  preview: BookingSchedulePreview,
  locale: AuthLocale,
): BookingSchedulePreviewView {
  return {
    bookingReference: preview.bookingReference,
    expectedBookingVersion: preview.expectedBookingVersion,
    customerDisplayName: preview.customerDisplayName,
    propertyLabel: preview.propertyLabel,
    propertyAddress: preview.propertyAddress,
    preferredTimingLabel: schedulingAppointmentWindow(
      locale,
      preview.preferredTimingLabel,
    ),
    serviceDurationMinutes: preview.serviceDurationMinutes,
    workDate: preview.workDate,
    timeZone: preview.timeZone,
    currentAppointment: preview.currentAppointment
      ? {
          snapshotVersion: preview.currentAppointment.snapshotVersion,
          serviceStart: preview.currentAppointment.serviceStart,
          serviceEnd: preview.currentAppointment.serviceEnd,
          teamName: preview.currentAppointment.teamName,
          equipmentLabel: preview.currentAppointment.equipmentLabel,
        }
      : null,
    candidates: preview.candidates.map((candidate) => ({
      key: candidate.key,
      rank: candidate.rank,
      teamName: candidate.teamName,
      equipmentLabel: candidate.equipmentLabel,
      serviceStart: candidate.serviceStart,
      serviceEnd: candidate.serviceEnd,
      serviceDurationMinutes: candidate.serviceDurationMinutes,
      travelMinutes: candidate.travelMinutes,
      bufferMinutes: candidate.bufferMinutes,
      readiness: candidate.readiness,
      selectable: candidate.selectable,
      fallbackTravelUsed: candidate.fallbackTravelUsed,
      warnings: presentWarnings(candidate.warnings, locale),
    })),
    reviewWarnings: presentWarnings(preview.reviewWarnings, locale),
    provisionalConfiguration: preview.provisionalConfiguration,
  };
}
