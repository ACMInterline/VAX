"use server";

import { revalidatePath } from "next/cache";
import {
  requireAuthenticatedUser,
  type AuthenticatedPrincipal,
} from "@/auth/authorization-service";
import { isAuthAttemptAllowed } from "@/auth/enforce-rate-limit";
import { AuthenticationBoundaryError } from "@/auth/principal-policy";
import type { AuthLocale } from "@/auth/validation";
import type { SchedulingActionState } from "@/components/scheduling/types";
import { schedulingContent } from "@/content/scheduling";
import { getDatabase } from "@/db/client";
import {
  SchedulingAuthorizationError,
  requireStaffSchedulingManage,
  type SchedulingActor,
} from "@/modules/scheduling-dispatch/policy";
import { createDatabaseSchedulingDispatchRepository } from "@/modules/scheduling-dispatch/repository";
import {
  createSchedulingDispatchService,
  SchedulingDispatchServiceError,
  type SchedulingDispatchService,
} from "@/modules/scheduling-dispatch/service";
import { scheduleConfirmationInputSchema } from "@/modules/scheduling-dispatch/validation";

const allowedFields = new Set([
  "bookingReference",
  "expectedBookingVersion",
  "workDate",
  "candidateKey",
  "expectedOccupancySnapshotVersion",
  "reasonCategory",
  "reasonText",
  "acknowledged",
]);

function actorFromPrincipal(principal: AuthenticatedPrincipal): SchedulingActor {
  return {
    profileId: principal.profile.id,
    status: principal.profile.status,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

function scalar(formData: FormData, name: string): unknown {
  const values = formData.getAll(name);
  if (values.length === 0) return undefined;
  if (values.length !== 1 || typeof values[0] !== "string") return values;
  return values[0];
}

function integer(formData: FormData, name: string): unknown {
  const value = scalar(formData, name);
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    return Number.NaN;
  }
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

function nullableInteger(formData: FormData, name: string): unknown {
  const value = scalar(formData, name);
  if (value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    return Number.NaN;
  }
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

function checked(formData: FormData, name: string): unknown {
  const value = scalar(formData, name);
  if (value === undefined) return false;
  return value === "true" ? true : value;
}

function nullableText(formData: FormData, name: string): unknown {
  const value = scalar(formData, name);
  return value === undefined || (typeof value === "string" && value.trim() === "")
    ? null
    : value;
}

function rejectUnexpectedFields(
  formData: FormData,
): Readonly<Record<string, true>> {
  for (const name of formData.keys()) {
    if (!allowedFields.has(name) && !name.startsWith("$ACTION_")) {
      return { unexpectedField: true };
    }
  }
  return {};
}

function invalidState(
  input: unknown,
  locale: AuthLocale,
): SchedulingActionState | null {
  const parsed = scheduleConfirmationInputSchema.safeParse(input);
  if (parsed.success) return null;

  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const field =
      typeof issue.path[0] === "string" ? issue.path[0] : "_form";
    (fieldErrors[field] ??= []).push(schedulingContent[locale].booking.invalid);
  }
  return {
    status: "ERROR",
    message: schedulingContent[locale].booking.invalid,
    fieldErrors,
  };
}

function service(): SchedulingDispatchService {
  return createSchedulingDispatchService(
    createDatabaseSchedulingDispatchRepository(getDatabase()),
  );
}

function failureState(
  error: unknown,
  locale: AuthLocale,
): SchedulingActionState {
  const content = schedulingContent[locale].booking;
  if (
    error instanceof AuthenticationBoundaryError ||
    error instanceof SchedulingAuthorizationError
  ) {
    return { status: "ERROR", message: content.denied };
  }
  if (error instanceof SchedulingDispatchServiceError) {
    if (error.code === "INVALID_REQUEST") {
      return { status: "ERROR", message: content.invalid };
    }
    if (error.code === "STALE" || error.code === "CONFLICT") {
      return { status: "ERROR", message: content.conflict };
    }
    if (
      error.code === "INVALID_TRANSITION" ||
      error.code === "REQUIRES_REVIEW"
    ) {
      return { status: "ERROR", message: content.reviewRequired };
    }
    if (error.code === "RECORD_NOT_FOUND_OR_FORBIDDEN") {
      return { status: "ERROR", message: content.denied };
    }
  }
  return { status: "ERROR", message: content.safeError };
}

async function mutationContext(): Promise<
  | Readonly<{
      actor: SchedulingActor;
      locale: AuthLocale;
    }>
  | SchedulingActionState
> {
  let locale: AuthLocale = "bg";
  try {
    const principal = await requireAuthenticatedUser();
    const actor = actorFromPrincipal(principal);
    locale = principal.profile.preferredLocale;
    requireStaffSchedulingManage(actor);
    if (
      !(await isAuthAttemptAllowed(
        "BOOKING_MUTATION",
        principal.profile.id,
      ))
    ) {
      return {
        status: "ERROR",
        message: schedulingContent[locale].booking.limited,
      };
    }
    return { actor, locale };
  } catch (error) {
    return failureState(error, locale);
  }
}

function revalidateSchedule(bookingReference: string): void {
  revalidatePath("/app/schedule");
  revalidatePath(`/app/schedule/bookings/${bookingReference}`);
  revalidatePath("/app/bookings");
  revalidatePath(`/app/bookings/${bookingReference}`);
  revalidatePath("/app/my-bookings");
  revalidatePath(`/app/my-bookings/${bookingReference}`);
  revalidatePath("/app/jobs");
  revalidatePath("/app/jobs/today");
}

export async function confirmScheduleAction(
  _previousState: SchedulingActionState,
  formData: FormData,
): Promise<SchedulingActionState> {
  const context = await mutationContext();
  if ("status" in context) return context;

  const input = {
    bookingReference: scalar(formData, "bookingReference"),
    expectedBookingVersion: integer(formData, "expectedBookingVersion"),
    workDate: scalar(formData, "workDate"),
    candidateKey: scalar(formData, "candidateKey"),
    expectedOccupancySnapshotVersion: nullableInteger(
      formData,
      "expectedOccupancySnapshotVersion",
    ),
    reasonCategory: nullableText(formData, "reasonCategory"),
    reasonText: nullableText(formData, "reasonText"),
    acknowledged: checked(formData, "acknowledged"),
    ...rejectUnexpectedFields(formData),
  };
  const invalid = invalidState(input, context.locale);
  if (invalid) return invalid;
  const parsed = scheduleConfirmationInputSchema.parse(input);

  try {
    const result = await service().confirmSchedule(context.actor, parsed);
    revalidateSchedule(parsed.bookingReference);
    const message =
      result.status === "SCHEDULED"
        ? schedulingContent[context.locale].booking.scheduled
        : result.status === "RESCHEDULED"
          ? schedulingContent[context.locale].booking.rescheduled
          : schedulingContent[context.locale].booking.noChange;
    return {
      status: "SUCCESS",
      message,
      bookingReference: result.bookingReference,
      workDate: parsed.workDate,
    };
  } catch (error) {
    return failureState(error, context.locale);
  }
}
