"use client";

import { useActionState } from "react";
import { ApplicationActionStatus } from "@/components/application/action-status";
import {
  ApplicationFieldError,
  fieldDescriptionIds,
} from "@/components/application/field-error";
import {
  ApplicationFormErrorSummary,
  type ApplicationFormError,
} from "@/components/application/form-error-summary";
import {
  initialRequestQuoteActionState,
  requestQuoteFieldMessages,
  type RequestQuoteActionState,
  type RequestQuoteFormAction,
} from "./action-state";

export type RequestQuoteFormFieldDefinition = Readonly<{
  name: string;
  id: string;
  label: string;
}>;

export function useRequestQuoteAction(action: RequestQuoteFormAction) {
  return useActionState(action, initialRequestQuoteActionState);
}

export function requestQuoteFieldAccessibility(
  state: RequestQuoteActionState,
  name: string,
  fieldId: string,
  hintId?: string,
) {
  const invalid = requestQuoteFieldMessages(state, name).length > 0;
  return {
    "aria-invalid": invalid || undefined,
    "aria-describedby": fieldDescriptionIds(
      hintId,
      invalid ? `${fieldId}-error` : undefined,
    ),
  } as const;
}

export function RequestQuoteFieldError({
  fieldId,
  name,
  state,
}: {
  fieldId: string;
  name: string;
  state: RequestQuoteActionState;
}) {
  return (
    <ApplicationFieldError
      id={`${fieldId}-error`}
      messages={requestQuoteFieldMessages(state, name)}
    />
  );
}
export function RequestQuoteFormFeedback({
  fields,
  state,
  title,
}: {
  fields: readonly RequestQuoteFormFieldDefinition[];
  state: RequestQuoteActionState;
  title: string;
}) {
  const errors: ApplicationFormError[] = fields.flatMap((field) =>
    requestQuoteFieldMessages(state, field.name).map((message) => ({
      fieldId: field.id,
      label: field.label,
      message,
    })),
  );

  return (
    <>
      <ApplicationFormErrorSummary
        errors={errors}
        response={state}
        title={title}
      />
      {errors.length === 0 ? <ApplicationActionStatus state={state} /> : null}
    </>
  );
}

export function RequestQuoteSubmitButton({
  idleLabel,
  pending,
  pendingLabel,
}: {
  idleLabel: string;
  pending: boolean;
  pendingLabel: string;
}) {
  return (
    <button className="crm-form__submit" type="submit" disabled={pending}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
