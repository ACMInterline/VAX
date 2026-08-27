"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  requireAuthenticatedUser,
  type AuthenticatedPrincipal,
} from "@/auth/authorization-service";
import { isAuthAttemptAllowed } from "@/auth/enforce-rate-limit";
import { AuthenticationBoundaryError } from "@/auth/principal-policy";
import type { AuthLocale } from "@/auth/validation";
import type { CommunicationsActionState } from "@/components/communications/action-state";
import { communicationsContent } from "@/content/communications";
import { getDatabase } from "@/db/client";
import {
  CommunicationsAuthorizationError,
  requireCustomerCommunicationUpdate,
  requireStaffCommunicationManage,
  requireStaffCommunicationsManage,
} from "@/modules/communications-documents/policy";
import { createDatabaseCommunicationsRepository } from "@/modules/communications-documents/repository";
import {
  createCommunicationsService,
  CommunicationsServiceError,
  type CommunicationsService,
} from "@/modules/communications-documents/service";
import {
  communicationEventTypes,
  type CommunicationsActor,
} from "@/modules/communications-documents/types";
import {
  createCommunicationSchema,
  updateCommunicationPreferencesSchema,
} from "@/modules/communications-documents/validation";

const actionableEventSchema = z.enum(communicationEventTypes).exclude([
  "MANUAL_STAFF_MESSAGE",
]);

function actorFromPrincipal(principal: AuthenticatedPrincipal): CommunicationsActor {
  return {
    profileId: principal.profile.id,
    status: principal.profile.status,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

function service(): CommunicationsService {
  return createCommunicationsService(
    createDatabaseCommunicationsRepository(getDatabase()),
  );
}

function scalar(formData: FormData, name: string): unknown {
  const values = formData.getAll(name);
  if (values.length === 0) return undefined;
  if (values.length !== 1 || typeof values[0] !== "string") return values;
  return values[0];
}

function checked(formData: FormData, name: string): unknown {
  const value = scalar(formData, name);
  if (value === undefined) return false;
  return value === "true" ? true : value;
}

function integer(formData: FormData, name: string): unknown {
  const value = scalar(formData, name);
  if (typeof value !== "string" || !/^\d+$/.test(value)) return Number.NaN;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

function rejectUnexpectedFields(
  formData: FormData,
  allowed: ReadonlySet<string>,
): Readonly<Record<string, true>> {
  for (const name of formData.keys()) {
    if (!allowed.has(name) && !name.startsWith("$ACTION_")) {
      return { unexpectedField: true };
    }
  }
  return {};
}

function parseInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  locale: AuthLocale,
): { data: T } | { failure: CommunicationsActionState } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { data: parsed.data };
  const message = communicationsContent[locale].errors.invalid;
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const field = typeof issue.path[0] === "string" ? issue.path[0] : "_form";
    (fieldErrors[field] ??= []).push(message);
  }
  return { failure: { status: "ERROR", message, fieldErrors } };
}

function failureState(
  error: unknown,
  locale: AuthLocale,
): CommunicationsActionState {
  const messages = communicationsContent[locale].errors;
  if (
    error instanceof AuthenticationBoundaryError ||
    error instanceof CommunicationsAuthorizationError
  ) {
    return { status: "ERROR", message: messages.denied };
  }
  if (error instanceof CommunicationsServiceError) {
    switch (error.code) {
      case "INVALID_REQUEST":
        return { status: "ERROR", message: messages.invalid };
      case "RECORD_NOT_FOUND_OR_FORBIDDEN":
        return { status: "ERROR", message: messages.denied };
      case "PREFERENCE_BLOCKED":
        return { status: "ERROR", message: messages.preference };
      case "REVIEW_REQUIRED":
        return { status: "ERROR", message: messages.review };
      case "CONFLICT":
        return { status: "ERROR", message: messages.conflict };
      case "TEMPORARILY_UNAVAILABLE":
        return { status: "ERROR", message: messages.unavailable };
    }
  }
  return { status: "ERROR", message: messages.unavailable };
}

async function staffMutationContext(formData: FormData): Promise<
  | Readonly<{
      actor: CommunicationsActor;
      locale: AuthLocale;
      eventType: z.infer<typeof actionableEventSchema>;
    }>
  | CommunicationsActionState
> {
  let locale: AuthLocale = "bg";
  try {
    const principal = await requireAuthenticatedUser();
    locale = principal.profile.preferredLocale;
    const actor = actorFromPrincipal(principal);
    requireStaffCommunicationsManage(actor);
    const event = actionableEventSchema.safeParse(scalar(formData, "eventType"));
    if (!event.success) {
      return {
        status: "ERROR",
        message: communicationsContent[locale].errors.invalid,
        fieldErrors: {
          eventType: [communicationsContent[locale].errors.invalid],
        },
      };
    }
    requireStaffCommunicationManage(actor, event.data);
    if (
      !(await isAuthAttemptAllowed(
        "COMMUNICATION_MUTATION",
        principal.profile.id,
      ))
    ) {
      return {
        status: "ERROR",
        message: communicationsContent[locale].errors.limited,
      };
    }
    return { actor, locale, eventType: event.data };
  } catch (error) {
    return failureState(error, locale);
  }
}

async function customerMutationContext(): Promise<
  | Readonly<{ actor: CommunicationsActor; locale: AuthLocale }>
  | CommunicationsActionState
> {
  let locale: AuthLocale = "bg";
  try {
    const principal = await requireAuthenticatedUser();
    locale = principal.profile.preferredLocale;
    const actor = actorFromPrincipal(principal);
    requireCustomerCommunicationUpdate(actor);
    if (
      !(await isAuthAttemptAllowed(
        "COMMUNICATION_MUTATION",
        principal.profile.id,
      ))
    ) {
      return {
        status: "ERROR",
        message: communicationsContent[locale].errors.limited,
      };
    }
    return { actor, locale };
  } catch (error) {
    return failureState(error, locale);
  }
}

export async function createPortalCommunicationAction(
  _previousState: CommunicationsActionState,
  formData: FormData,
): Promise<CommunicationsActionState> {
  const context = await staffMutationContext(formData);
  if ("status" in context) return context;
  const input = {
    eventType: scalar(formData, "eventType"),
    sourceReference: scalar(formData, "sourceReference"),
    documentType: scalar(formData, "documentType"),
    idempotencyKey: scalar(formData, "idempotencyKey"),
    channel: "PORTAL" as const,
    contactId: null,
    ...rejectUnexpectedFields(
      formData,
      new Set([
        "eventType",
        "sourceReference",
        "documentType",
        "idempotencyKey",
      ]),
    ),
  };
  const parsed = parseInput(createCommunicationSchema, input, context.locale);
  if ("failure" in parsed) return parsed.failure;
  try {
    const result = await service().createCommunication(context.actor, parsed.data);
    revalidatePath("/app/communications");
    revalidatePath("/app/my-communications");
    revalidatePath(`/app/my-documents/${result.documentReference}`);
    return {
      status: "SUCCESS",
      message:
        result.status === "CREATED"
          ? communicationsContent[context.locale].staff.created
          : communicationsContent[context.locale].staff.existing,
      communicationReference: result.communicationReference,
      documentReference: result.documentReference,
    };
  } catch (error) {
    return failureState(error, context.locale);
  }
}

export async function updateCommunicationPreferencesAction(
  _previousState: CommunicationsActionState,
  formData: FormData,
): Promise<CommunicationsActionState> {
  const context = await customerMutationContext();
  if ("status" in context) return context;
  const input = {
    portalEnabled: checked(formData, "portalEnabled"),
    emailFutureEnabled: checked(formData, "emailFutureEnabled"),
    smsFutureEnabled: checked(formData, "smsFutureEnabled"),
    operationalAllowed: checked(formData, "operationalAllowed"),
    billingAllowed: checked(formData, "billingAllowed"),
    marketingConsent: checked(formData, "marketingConsent"),
    preferredLocale: scalar(formData, "preferredLocale"),
    expectedVersion: integer(formData, "expectedVersion"),
    ...rejectUnexpectedFields(
      formData,
      new Set([
        "portalEnabled",
        "emailFutureEnabled",
        "smsFutureEnabled",
        "operationalAllowed",
        "billingAllowed",
        "marketingConsent",
        "preferredLocale",
        "expectedVersion",
      ]),
    ),
  };
  const parsed = parseInput(
    updateCommunicationPreferencesSchema,
    input,
    context.locale,
  );
  if ("failure" in parsed) return parsed.failure;
  try {
    await service().updateMyPreferences(context.actor, parsed.data);
    revalidatePath("/app/my-communications");
    return {
      status: "SUCCESS",
      message: communicationsContent[context.locale].customer.saved,
    };
  } catch (error) {
    return failureState(error, context.locale);
  }
}
