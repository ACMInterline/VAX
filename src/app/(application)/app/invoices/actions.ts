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
import type { FinanceActionState } from "@/components/finance/action-state";
import { getDatabase } from "@/db/client";
import { getFinanceEnvironmentScope } from "@/modules/finance-invoicing/environment";
import {
  FinanceAuthorizationError,
  requireInvoiceIssue,
  requirePaymentRecord,
  requirePaymentReversal,
  requireStaffFinanceManage,
  type FinanceActor,
} from "@/modules/finance-invoicing/policy";
import { createDatabaseFinanceRepository } from "@/modules/finance-invoicing/repository";
import {
  createFinanceService,
  FinanceServiceError,
  type FinanceService,
} from "@/modules/finance-invoicing/service";
import type { FinanceRepositoryResult } from "@/modules/finance-invoicing/types";
import {
  allocatePaymentSchema,
  cancelDraftInvoiceSchema,
  confirmPaymentSchema,
  createInvoiceDraftSchema,
  issueInvoiceSchema,
  recordPaymentSchemaAt,
  reversePaymentSchema,
} from "@/modules/finance-invoicing/validation";

const messages = {
  bg: {
    invalid: "Проверете задължителните полета и опитайте отново.",
    unavailable: "Операцията не може да бъде завършена в момента.",
    denied: "Нямате достъп до тази операция.",
    limited: "Твърде много опити. Изчакайте и опитайте отново.",
    conflict: "Записът е променен. Презаредете страницата и опитайте отново.",
    review: "Необходим е финансов преглед. Не е направена автоматична промяна.",
    draftCreated: "Черновата на фактурата е създадена.",
    draftCreatedForReview:
      "Черновата на фактурата е създадена и изисква финансов преглед.",
    draftExisting: "За тази резервация вече има чернова на фактура.",
    issued: "Фактурата е издадена.",
    cancelled: "Черновата на фактурата е отменена.",
    paymentRecorded: "Плащането е записано и очаква потвърждение.",
    paymentExisting: "Това плащане вече е записано.",
    paymentConfirmed: "Плащането е потвърдено.",
    allocated: "Плащането е разпределено.",
    reversed: "Плащането е сторнирано.",
    noChange: "Тази стъпка вече е записана.",
  },
  en: {
    invalid: "Check the required fields and try again.",
    unavailable: "The operation cannot be completed right now.",
    denied: "You do not have access to this operation.",
    limited: "Too many attempts. Wait and try again.",
    conflict: "The record changed. Reload the page and try again.",
    review: "Finance review is required. No automatic change was made.",
    draftCreated: "The invoice draft was created.",
    draftCreatedForReview:
      "The invoice draft was created and requires finance review.",
    draftExisting: "An invoice draft already exists for this booking.",
    issued: "The invoice was issued.",
    cancelled: "The invoice draft was cancelled.",
    paymentRecorded: "The payment was recorded and awaits confirmation.",
    paymentExisting: "This payment was already recorded.",
    paymentConfirmed: "The payment was confirmed.",
    allocated: "The payment was allocated.",
    reversed: "The payment was reversed.",
    noChange: "This step was already recorded.",
  },
} as const;

function actorFromPrincipal(principal: AuthenticatedPrincipal): FinanceActor {
  return {
    profileId: principal.profile.id,
    status: principal.profile.status,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

function service(): FinanceService {
  return createFinanceService(
    createDatabaseFinanceRepository(getDatabase()),
    {
      environmentScope: getFinanceEnvironmentScope(),
    },
  );
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
  return value === undefined || (typeof value === "string" && value.trim() === "")
    ? null
    : value;
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

function parseInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  locale: AuthLocale,
): { data: T } | { failure: FinanceActionState } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { data: parsed.data };

  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const field = typeof issue.path[0] === "string" ? issue.path[0] : "_form";
    (fieldErrors[field] ??= []).push(messages[locale].invalid);
  }
  return {
    failure: {
      status: "ERROR",
      message: messages[locale].invalid,
      fieldErrors,
    },
  };
}

function failureState(error: unknown, locale: AuthLocale): FinanceActionState {
  const content = messages[locale];
  if (
    error instanceof AuthenticationBoundaryError ||
    error instanceof FinanceAuthorizationError
  ) {
    return { status: "ERROR", message: content.denied };
  }
  if (error instanceof FinanceServiceError) {
    switch (error.code) {
      case "INVALID_REQUEST":
        return { status: "ERROR", message: content.invalid };
      case "CONFLICT":
      case "INVALID_TRANSITION":
        return { status: "ERROR", message: content.conflict };
      case "RECORD_NOT_FOUND_OR_FORBIDDEN":
        return { status: "ERROR", message: content.denied };
      case "TEMPORARILY_UNAVAILABLE":
        return { status: "ERROR", message: content.unavailable };
    }
  }
  return { status: "ERROR", message: content.unavailable };
}

type MutationAuthority =
  | "MANAGE"
  | "ISSUE"
  | "PAYMENT_RECORD"
  | "PAYMENT_REVERSE";

function requireMutationAuthority(
  actor: FinanceActor,
  authority: MutationAuthority,
): void {
  switch (authority) {
    case "MANAGE":
      requireStaffFinanceManage(actor);
      return;
    case "ISSUE":
      requireInvoiceIssue(actor);
      return;
    case "PAYMENT_RECORD":
      requirePaymentRecord(actor);
      return;
    case "PAYMENT_REVERSE":
      requirePaymentReversal(actor);
  }
}

async function authenticatedMutationContext(
  authority: MutationAuthority,
): Promise<
  | Readonly<{ actor: FinanceActor; locale: AuthLocale }>
  | FinanceActionState
> {
  let locale: AuthLocale = "bg";
  try {
    const principal = await requireAuthenticatedUser();
    locale = principal.profile.preferredLocale;
    const actor = actorFromPrincipal(principal);
    requireMutationAuthority(actor, authority);
    if (!(await isAuthAttemptAllowed("FINANCE_MUTATION", principal.profile.id))) {
      return { status: "ERROR", message: messages[locale].limited };
    }
    return { actor, locale };
  } catch (error) {
    return failureState(error, locale);
  }
}

function revalidateFinance(
  invoiceReference?: string,
  paymentReference?: string,
): void {
  revalidatePath("/app/finance");
  revalidatePath("/app/invoices");
  revalidatePath("/app/payments");
  revalidatePath("/app/my-invoices");
  if (invoiceReference) {
    revalidatePath(`/app/invoices/${invoiceReference}`);
    revalidatePath(`/app/my-invoices/${invoiceReference}`);
  }
  if (paymentReference) {
    revalidatePath(`/app/payments/${paymentReference}`);
  }
}

function reviewRequired(
  result: FinanceRepositoryResult,
  locale: AuthLocale,
): FinanceActionState | null {
  if (result.status !== "FINANCE_REVIEW_REQUIRED") return null;
  revalidateFinance(result.invoiceReference);
  return { status: "ERROR", message: messages[locale].review };
}

export async function createInvoiceDraftAction(
  _previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const context = await authenticatedMutationContext("MANAGE");
  if ("status" in context) return context;

  const parsed = parseInput(
    createInvoiceDraftSchema,
    {
      bookingReference: scalar(formData, "bookingReference"),
      customerVisibleNote: nullableText(formData, "customerVisibleNote"),
      internalNote: nullableText(formData, "internalNote"),
      manualAdjustmentRequested: checked(
        formData,
        "manualAdjustmentRequested",
      ),
      ...rejectUnexpectedFields(
        formData,
        new Set([
          "bookingReference",
          "customerVisibleNote",
          "internalNote",
          "manualAdjustmentRequested",
        ]),
      ),
    },
    context.locale,
  );
  if ("failure" in parsed) return parsed.failure;

  try {
    const result = await service().createInvoiceDraft(context.actor, parsed.data);
    if (
      result.status === "FINANCE_REVIEW_REQUIRED" &&
      result.invoiceReference
    ) {
      revalidateFinance(result.invoiceReference);
      return {
        status: "SUCCESS",
        message: messages[context.locale].draftCreatedForReview,
        invoiceReference: result.invoiceReference,
      };
    }
    const review = reviewRequired(result, context.locale);
    if (review) return review;
    if (
      (result.status !== "CREATED" && result.status !== "EXISTING") ||
      !result.invoiceReference
    ) {
      return { status: "ERROR", message: messages[context.locale].unavailable };
    }
    revalidateFinance(result.invoiceReference);
    return {
      status: "SUCCESS",
      message:
        result.status === "CREATED"
          ? messages[context.locale].draftCreated
          : messages[context.locale].draftExisting,
      invoiceReference: result.invoiceReference,
    };
  } catch (error) {
    return failureState(error, context.locale);
  }
}

export async function issueInvoiceAction(
  _previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const context = await authenticatedMutationContext("ISSUE");
  if ("status" in context) return context;

  const parsed = parseInput(
    issueInvoiceSchema,
    {
      invoiceReference: scalar(formData, "invoiceReference"),
      expectedVersion: integer(formData, "expectedVersion"),
      issueConfirmed: checked(formData, "issueConfirmed"),
      ...rejectUnexpectedFields(
        formData,
        new Set(["invoiceReference", "expectedVersion", "issueConfirmed"]),
      ),
    },
    context.locale,
  );
  if ("failure" in parsed) return parsed.failure;

  try {
    const result = await service().issueInvoice(context.actor, parsed.data);
    const review = reviewRequired(result, context.locale);
    if (review) return review;
    if (
      result.status !== "ISSUED" &&
      result.status !== "EXISTING" &&
      result.status !== "NO_CHANGE"
    ) {
      return { status: "ERROR", message: messages[context.locale].unavailable };
    }
    revalidateFinance(parsed.data.invoiceReference);
    return {
      status: "SUCCESS",
      message:
        result.status === "ISSUED"
          ? messages[context.locale].issued
          : messages[context.locale].noChange,
      invoiceReference: parsed.data.invoiceReference,
    };
  } catch (error) {
    return failureState(error, context.locale);
  }
}

export async function cancelDraftInvoiceAction(
  _previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const context = await authenticatedMutationContext("MANAGE");
  if ("status" in context) return context;

  const parsed = parseInput(
    cancelDraftInvoiceSchema,
    {
      invoiceReference: scalar(formData, "invoiceReference"),
      expectedVersion: integer(formData, "expectedVersion"),
      reason: scalar(formData, "reason"),
      ...rejectUnexpectedFields(
        formData,
        new Set(["invoiceReference", "expectedVersion", "reason"]),
      ),
    },
    context.locale,
  );
  if ("failure" in parsed) return parsed.failure;

  try {
    const result = await service().cancelDraftInvoice(context.actor, parsed.data);
    const review = reviewRequired(result, context.locale);
    if (review) return review;
    if (result.status !== "UPDATED" && result.status !== "NO_CHANGE") {
      return { status: "ERROR", message: messages[context.locale].unavailable };
    }
    revalidateFinance(parsed.data.invoiceReference);
    return {
      status: "SUCCESS",
      message:
        result.status === "UPDATED"
          ? messages[context.locale].cancelled
          : messages[context.locale].noChange,
      invoiceReference: parsed.data.invoiceReference,
    };
  } catch (error) {
    return failureState(error, context.locale);
  }
}

export async function recordPaymentAction(
  _previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const context = await authenticatedMutationContext("PAYMENT_RECORD");
  if ("status" in context) return context;

  const parsed = parseInput(
    recordPaymentSchemaAt(new Date()),
    {
      invoiceReference: scalar(formData, "invoiceReference"),
      amountMinorUnits: integer(formData, "amountMinorUnits"),
      method: scalar(formData, "method"),
      receivedAt: scalar(formData, "receivedAt"),
      externalReference: nullableText(formData, "externalReference"),
      internalNote: nullableText(formData, "internalNote"),
      idempotencyKey: scalar(formData, "idempotencyKey"),
      ...rejectUnexpectedFields(
        formData,
        new Set([
          "invoiceReference",
          "amountMinorUnits",
          "method",
          "receivedAt",
          "externalReference",
          "internalNote",
          "idempotencyKey",
        ]),
      ),
    },
    context.locale,
  );
  if ("failure" in parsed) return parsed.failure;

  try {
    const result = await service().recordPayment(context.actor, parsed.data);
    const review = reviewRequired(result, context.locale);
    if (review) return review;
    if (
      (result.status !== "CREATED" && result.status !== "EXISTING") ||
      !result.paymentReference
    ) {
      return { status: "ERROR", message: messages[context.locale].unavailable };
    }
    revalidateFinance(parsed.data.invoiceReference, result.paymentReference);
    return {
      status: "SUCCESS",
      message:
        result.status === "CREATED"
          ? messages[context.locale].paymentRecorded
          : messages[context.locale].paymentExisting,
      invoiceReference: parsed.data.invoiceReference,
      paymentReference: result.paymentReference,
    };
  } catch (error) {
    return failureState(error, context.locale);
  }
}

export async function confirmPaymentAction(
  _previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const context = await authenticatedMutationContext("PAYMENT_RECORD");
  if ("status" in context) return context;

  const parsed = parseInput(
    confirmPaymentSchema,
    {
      paymentReference: scalar(formData, "paymentReference"),
      expectedVersion: integer(formData, "expectedVersion"),
      evidenceConfirmed: checked(formData, "evidenceConfirmed"),
      ...rejectUnexpectedFields(
        formData,
        new Set(["paymentReference", "expectedVersion", "evidenceConfirmed"]),
      ),
    },
    context.locale,
  );
  if ("failure" in parsed) return parsed.failure;

  try {
    const result = await service().confirmPayment(context.actor, parsed.data);
    const review = reviewRequired(result, context.locale);
    if (review) return review;
    if (result.status !== "UPDATED" && result.status !== "NO_CHANGE") {
      return { status: "ERROR", message: messages[context.locale].unavailable };
    }
    revalidateFinance(result.invoiceReference, parsed.data.paymentReference);
    return {
      status: "SUCCESS",
      message:
        result.status === "UPDATED"
          ? messages[context.locale].paymentConfirmed
          : messages[context.locale].noChange,
      paymentReference: parsed.data.paymentReference,
    };
  } catch (error) {
    return failureState(error, context.locale);
  }
}

export async function allocatePaymentAction(
  _previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const context = await authenticatedMutationContext("PAYMENT_RECORD");
  if ("status" in context) return context;

  const parsed = parseInput(
    allocatePaymentSchema,
    {
      paymentReference: scalar(formData, "paymentReference"),
      invoiceReference: scalar(formData, "invoiceReference"),
      amountMinorUnits: integer(formData, "amountMinorUnits"),
      idempotencyKey: scalar(formData, "idempotencyKey"),
      ...rejectUnexpectedFields(
        formData,
        new Set([
          "paymentReference",
          "invoiceReference",
          "amountMinorUnits",
          "idempotencyKey",
        ]),
      ),
    },
    context.locale,
  );
  if ("failure" in parsed) return parsed.failure;

  try {
    const result = await service().allocatePayment(context.actor, parsed.data);
    const review = reviewRequired(result, context.locale);
    if (review) return review;
    if (result.status !== "UPDATED" && result.status !== "NO_CHANGE") {
      return { status: "ERROR", message: messages[context.locale].unavailable };
    }
    revalidateFinance(
      parsed.data.invoiceReference,
      parsed.data.paymentReference,
    );
    return {
      status: "SUCCESS",
      message:
        result.status === "UPDATED"
          ? messages[context.locale].allocated
          : messages[context.locale].noChange,
      invoiceReference: parsed.data.invoiceReference,
      paymentReference: parsed.data.paymentReference,
    };
  } catch (error) {
    return failureState(error, context.locale);
  }
}

export async function reversePaymentAction(
  _previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const context = await authenticatedMutationContext("PAYMENT_REVERSE");
  if ("status" in context) return context;

  const parsed = parseInput(
    reversePaymentSchema,
    {
      paymentReference: scalar(formData, "paymentReference"),
      expectedVersion: integer(formData, "expectedVersion"),
      reasonCategory: scalar(formData, "reasonCategory"),
      reasonNote: scalar(formData, "reasonNote"),
      idempotencyKey: scalar(formData, "idempotencyKey"),
      ...rejectUnexpectedFields(
        formData,
        new Set([
          "paymentReference",
          "expectedVersion",
          "reasonCategory",
          "reasonNote",
          "idempotencyKey",
        ]),
      ),
    },
    context.locale,
  );
  if ("failure" in parsed) return parsed.failure;

  try {
    const result = await service().reversePayment(context.actor, parsed.data);
    const review = reviewRequired(result, context.locale);
    if (review) return review;
    if (result.status !== "UPDATED" && result.status !== "NO_CHANGE") {
      return { status: "ERROR", message: messages[context.locale].unavailable };
    }
    revalidateFinance(result.invoiceReference, parsed.data.paymentReference);
    return {
      status: "SUCCESS",
      message:
        result.status === "UPDATED"
          ? messages[context.locale].reversed
          : messages[context.locale].noChange,
      paymentReference: parsed.data.paymentReference,
    };
  } catch (error) {
    return failureState(error, context.locale);
  }
}
