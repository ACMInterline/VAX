"use server";

import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import { isAuthAttemptAllowed } from "@/auth/enforce-rate-limit";
import { getDatabase } from "@/db/client";
import {
  publicRequestFieldErrorsFromZod,
  retainPublicRequestValues,
  type PublicRequestActionState,
} from "@/modules/public-request/action-state";
import {
  createPublicRequestSchema,
  readPublicRequestForm,
  type PublicRequestInput,
} from "@/modules/public-request/request-schema";
import { publicSubmissionSnapshot } from "@/modules/public-request/submission-snapshot";
import { createDatabaseRequestQuoteRepository } from "@/modules/request-quote/repository";
import { createRequestQuoteService } from "@/modules/request-quote/service";

const preferredWindowCodes = {
  "early-morning": "EARLY_MORNING",
  morning: "MORNING",
  afternoon: "AFTERNOON",
  evening: "EVENING",
  flexible: "FLEXIBLE",
} as const;

function customerDescription(
  locale: PublicLocale,
  input: PublicRequestInput,
): string {
  const supplied = [input.estimatedQuantity, input.approximateArea, input.notes]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
  if (supplied) return supplied;
  return locale === "en"
    ? "Submitted through the public request form."
    : "Подадено чрез публичната форма за заявка.";
}

async function submitPublicRequest(
  locale: PublicLocale,
  _previousState: PublicRequestActionState,
  formData: FormData,
): Promise<PublicRequestActionState> {
  const copy = getPublicContent(locale).requestForm.notices;
  const values = retainPublicRequestValues(formData);
  const parsed = createPublicRequestSchema(locale).safeParse(
    readPublicRequestForm(formData),
  );
  if (!parsed.success) {
    return {
      status: "ERROR",
      message: copy.errorText,
      fieldErrors: publicRequestFieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    if (!(await isAuthAttemptAllowed("PUBLIC_REQUEST", "anonymous-request"))) {
      return { status: "ERROR", message: copy.errorText, values };
    }

    const service = createRequestQuoteService(
      createDatabaseRequestQuoteRepository(getDatabase()),
    );
    const result = await service.createPublicRequest({
      preferredLocale: locale,
      contactName: parsed.data.name,
      contactEmail: parsed.data.email,
      contactPhone: parsed.data.phone,
      customerNotes: parsed.data.notes ?? null,
      preferredDate: parsed.data.preferredDate ?? null,
      preferredWindowCode: preferredWindowCodes[parsed.data.preferredTime],
      originalSubmission: publicSubmissionSnapshot(parsed.data),
      itemTypeCodes: parsed.data.services,
      conditionLevelCode: parsed.data.condition,
      customerDescription: customerDescription(locale, parsed.data),
    });

    return {
      status: "SUCCESS",
      requestReference: result.requestReference,
    };
  } catch {
    // Anonymous responses never disclose database, taxonomy or provider detail.
  }

  return { status: "ERROR", message: copy.errorText, values };
}

export async function submitPublicRequestBgAction(
  previousState: PublicRequestActionState,
  formData: FormData,
): Promise<PublicRequestActionState> {
  return submitPublicRequest("bg", previousState, formData);
}

export async function submitPublicRequestEnAction(
  previousState: PublicRequestActionState,
  formData: FormData,
): Promise<PublicRequestActionState> {
  return submitPublicRequest("en", previousState, formData);
}
