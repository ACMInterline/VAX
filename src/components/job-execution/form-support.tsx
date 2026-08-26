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
import type { JobActionState, JobFormAction } from "./types";

export const initialJobActionState: JobActionState = { status: "IDLE" };

export type JobFormFieldDefinition = Readonly<{
  name: string;
  id: string;
  label: string;
}>;

export function useJobAction(action: JobFormAction) {
  return useActionState(action, initialJobActionState);
}

export function jobFieldMessages(
  state: JobActionState,
  name: string,
): readonly string[] {
  return state.fieldErrors?.[name] ?? [];
}

export function jobFieldAccessibility(
  state: JobActionState,
  name: string,
  fieldId: string,
  hintId?: string,
) {
  const invalid = jobFieldMessages(state, name).length > 0;
  return {
    "aria-invalid": invalid || undefined,
    "aria-describedby": fieldDescriptionIds(
      hintId,
      invalid ? `${fieldId}-error` : undefined,
    ),
  } as const;
}

export function JobFieldError({
  fieldId,
  name,
  state,
}: {
  fieldId: string;
  name: string;
  state: JobActionState;
}) {
  return (
    <ApplicationFieldError
      id={`${fieldId}-error`}
      messages={jobFieldMessages(state, name)}
    />
  );
}

export function JobFormFeedback({
  fields,
  state,
  title,
}: {
  fields: readonly JobFormFieldDefinition[];
  state: JobActionState;
  title: string;
}) {
  const errors: ApplicationFormError[] = fields.flatMap((field) =>
    jobFieldMessages(state, field.name).map((message) => ({
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

export function JobSubmitButton({
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

export function jobFormId(prefix: string, identifier: string): string {
  return `${prefix}-${identifier.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
}
