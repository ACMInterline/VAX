"use server";

import { revalidatePath } from "next/cache";
import {
  requireAuthenticatedUser,
  type AuthenticatedPrincipal,
} from "@/auth/authorization-service";
import { isAuthAttemptAllowed } from "@/auth/enforce-rate-limit";
import { AuthenticationBoundaryError } from "@/auth/principal-policy";
import type { AuthLocale } from "@/auth/validation";
import type { BookingActionState } from "@/components/booking/action-state";
import { getDatabase } from "@/db/client";
import {
  BookingAuthorizationError,
  type BookingActor,
} from "@/modules/booking-engine/policy";
import { createDatabaseBookingRepository } from "@/modules/booking-engine/repository";
import {
  createBookingService,
  BookingServiceError,
  type BookingService,
} from "@/modules/booking-engine/service";
import {
  cancelBookingSchema,
  customerQuoteAcceptanceSchema,
  staffQuoteAcceptanceSchema,
} from "@/modules/booking-engine/validation";

type ActionSchema =
  | typeof customerQuoteAcceptanceSchema
  | typeof staffQuoteAcceptanceSchema
  | typeof cancelBookingSchema;

const messages = {
  bg: {
    invalid: "Проверете задължителните полета и опитайте отново.",
    unavailable: "Операцията не може да бъде завършена в момента.",
    denied: "Нямате достъп до тази операция.",
    limited: "Твърде много опити. Изчакайте и опитайте отново.",
    review:
      "Офертата изисква преглед от екипа. Не е създадена резервация.",
    created:
      "Офертата е приета. Създадена е резервация, която очаква потвърждение на графика.",
    existing: "Тази оферта вече е приета. Показана е съществуващата резервация.",
    cancelled: "Резервацията е отменена и активното заемане на графика е освободено.",
    alreadyCancelled: "Резервацията вече е отменена.",
    conflict: "Записът е променен. Презаредете страницата и опитайте отново.",
  },
  en: {
    invalid: "Check the required fields and try again.",
    unavailable: "The operation cannot be completed right now.",
    denied: "You do not have access to this operation.",
    limited: "Too many attempts. Wait and try again.",
    review:
      "The quote requires staff review. No booking was created.",
    created:
      "The quote was accepted. A booking was created and is awaiting schedule confirmation.",
    existing: "This quote was already accepted. The existing booking is shown.",
    cancelled:
      "The booking was cancelled and any active schedule occupancy was released.",
    alreadyCancelled: "The booking was already cancelled.",
    conflict: "The record changed. Reload the page and try again.",
  },
} as const;

function actorFromPrincipal(principal: AuthenticatedPrincipal): BookingActor {
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

function checked(formData: FormData, name: string): unknown {
  const value = scalar(formData, name);
  if (value === undefined) return false;
  return value === "true" ? true : value;
}

function nullableText(formData: FormData, name: string): unknown {
  const value = scalar(formData, name);
  return typeof value === "string" && value.trim() === "" ? null : value;
}

function rejectUnexpectedFields(
  formData: FormData,
  allowedFields: ReadonlySet<string>,
): Readonly<Record<string, true>> {
  for (const name of formData.keys()) {
    if (!allowedFields.has(name) && !name.startsWith("$ACTION_")) {
      return { unexpectedField: true };
    }
  }
  return {};
}

function validationFailure(
  schema: ActionSchema,
  input: unknown,
  locale: AuthLocale,
): BookingActionState | null {
  const parsed = schema.safeParse(input);
  if (parsed.success) return null;

  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const field =
      typeof issue.path[0] === "string" ? issue.path[0] : "_form";
    const text = messages[locale].invalid;
    (fieldErrors[field] ??= []).push(text);
  }
  return {
    status: "ERROR",
    message: messages[locale].invalid,
    fieldErrors,
  };
}

function service(): BookingService {
  return createBookingService(createDatabaseBookingRepository(getDatabase()));
}

function revalidateAcceptance(
  quoteReference: string,
  bookingReference: string,
): void {
  revalidatePath("/app/my-quotes");
  revalidatePath(`/app/my-quotes/${quoteReference}`);
  revalidatePath("/app/my-bookings");
  revalidatePath(`/app/my-bookings/${bookingReference}`);
  revalidatePath("/app/bookings");
  revalidatePath(`/app/bookings/${bookingReference}`);
  revalidatePath("/app/requests");
}

function failureState(error: unknown, locale: AuthLocale): BookingActionState {
  const content = messages[locale];
  if (
    error instanceof AuthenticationBoundaryError ||
    error instanceof BookingAuthorizationError
  ) {
    return { status: "ERROR", message: content.denied };
  }
  if (error instanceof BookingServiceError) {
    if (error.code === "INVALID_REQUEST") {
      return { status: "ERROR", message: content.invalid };
    }
    if (error.code === "CONFLICT" || error.code === "INVALID_TRANSITION") {
      return { status: "ERROR", message: content.conflict };
    }
  }
  return { status: "ERROR", message: content.unavailable };
}

async function authenticatedMutationContext(): Promise<{
  actor: BookingActor;
  locale: AuthLocale;
} | BookingActionState> {
  try {
    const principal = await requireAuthenticatedUser();
    const locale = principal.profile.preferredLocale;
    if (
      !(await isAuthAttemptAllowed(
        "BOOKING_MUTATION",
        principal.profile.id,
      ))
    ) {
      return { status: "ERROR", message: messages[locale].limited };
    }
    return { actor: actorFromPrincipal(principal), locale };
  } catch (error) {
    const locale: AuthLocale = "bg";
    return failureState(error, locale);
  }
}

export async function acceptMyQuoteAction(
  _previousState: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const context = await authenticatedMutationContext();
  if ("status" in context) return context;

  const input = {
    quoteReference: scalar(formData, "quoteReference"),
    expectedQuoteVersion: integer(formData, "expectedQuoteVersion"),
    acknowledged: checked(formData, "acknowledged"),
    ...rejectUnexpectedFields(
      formData,
      new Set(["quoteReference", "expectedQuoteVersion", "acknowledged"]),
    ),
  };
  const invalid = validationFailure(
    customerQuoteAcceptanceSchema,
    input,
    context.locale,
  );
  if (invalid) return invalid;

  try {
    const result = await service().acceptMyQuote(context.actor, input);
    if (result.status === "REVIEW_REQUIRED") {
      return { status: "ERROR", message: messages[context.locale].review };
    }
    revalidateAcceptance(input.quoteReference as string, result.bookingReference);
    return {
      status: "SUCCESS",
      message:
        result.status === "CREATED"
          ? messages[context.locale].created
          : messages[context.locale].existing,
      bookingReference: result.bookingReference,
    };
  } catch (error) {
    return failureState(error, context.locale);
  }
}

export async function acceptQuoteOnBehalfAction(
  _previousState: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const context = await authenticatedMutationContext();
  if ("status" in context) return context;

  const input = {
    quoteReference: scalar(formData, "quoteReference"),
    expectedQuoteVersion: integer(formData, "expectedQuoteVersion"),
    customerInstructionConfirmed: checked(
      formData,
      "customerInstructionConfirmed",
    ),
    acceptanceSource: scalar(formData, "acceptanceSource"),
    acceptanceNote: scalar(formData, "acceptanceNote"),
    ...rejectUnexpectedFields(
      formData,
      new Set([
        "quoteReference",
        "expectedQuoteVersion",
        "customerInstructionConfirmed",
        "acceptanceSource",
        "acceptanceNote",
      ]),
    ),
  };
  const invalid = validationFailure(
    staffQuoteAcceptanceSchema,
    input,
    context.locale,
  );
  if (invalid) return invalid;

  try {
    const result = await service().acceptQuoteOnBehalf(context.actor, input);
    if (result.status === "REVIEW_REQUIRED") {
      return { status: "ERROR", message: messages[context.locale].review };
    }
    revalidateAcceptance(input.quoteReference as string, result.bookingReference);
    return {
      status: "SUCCESS",
      message:
        result.status === "CREATED"
          ? messages[context.locale].created
          : messages[context.locale].existing,
      bookingReference: result.bookingReference,
    };
  } catch (error) {
    return failureState(error, context.locale);
  }
}

export async function cancelBookingAction(
  _previousState: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const context = await authenticatedMutationContext();
  if ("status" in context) return context;

  const input = {
    bookingReference: scalar(formData, "bookingReference"),
    expectedVersion: integer(formData, "expectedVersion"),
    reasonCategory: scalar(formData, "reasonCategory"),
    reasonText: nullableText(formData, "reasonText"),
    ...rejectUnexpectedFields(
      formData,
      new Set([
        "bookingReference",
        "expectedVersion",
        "reasonCategory",
        "reasonText",
        "cancellationAcknowledged",
      ]),
    ),
  };
  if (checked(formData, "cancellationAcknowledged") !== true) {
    return {
      status: "ERROR",
      message: messages[context.locale].invalid,
      fieldErrors: {
        cancellationAcknowledged: [messages[context.locale].invalid],
      },
    };
  }
  const invalid = validationFailure(cancelBookingSchema, input, context.locale);
  if (invalid) return invalid;

  try {
    const result = await service().cancelBooking(context.actor, input);
    if (result.status !== "CANCELLED" && result.status !== "NO_CHANGE") {
      return {
        status: "ERROR",
        message: messages[context.locale].conflict,
      };
    }
    revalidatePath("/app/my-bookings");
    revalidatePath("/app/bookings");
    revalidatePath(
      `/app/bookings/${input.bookingReference as string}`,
    );
    return {
      status: "SUCCESS",
      message:
        result.status === "CANCELLED"
          ? messages[context.locale].cancelled
          : messages[context.locale].alreadyCancelled,
      bookingReference: result.bookingReference,
    };
  } catch (error) {
    return failureState(error, context.locale);
  }
}
