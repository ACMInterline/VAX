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
  crmFieldIsInvalid,
  crmFieldMessages,
  initialCrmActionState,
  type CrmActionState,
  type CrmFormAction,
} from "./action-state";

export type CrmFormFieldDefinition = Readonly<{
  name: string;
  id: string;
  label: string;
}>;

export function useCrmAction(action: CrmFormAction) {
  return useActionState(action, initialCrmActionState);
}

export function crmFieldAccessibility(
  state: CrmActionState,
  name: string,
  fieldId: string,
  hintId?: string,
) {
  const invalid = crmFieldIsInvalid(state, name);
  return {
    "aria-invalid": invalid || undefined,
    "aria-describedby": fieldDescriptionIds(
      hintId,
      invalid ? `${fieldId}-error` : undefined,
    ),
  } as const;
}

export function CrmFieldError({
  fieldId,
  name,
  state,
}: {
  fieldId: string;
  name: string;
  state: CrmActionState;
}) {
  return (
    <ApplicationFieldError
      id={`${fieldId}-error`}
      messages={crmFieldMessages(state, name)}
    />
  );
}

export function CrmFormFeedback({
  fields,
  state,
  title,
}: {
  fields: readonly CrmFormFieldDefinition[];
  state: CrmActionState;
  title: string;
}) {
  const errors: ApplicationFormError[] = fields.flatMap((field) =>
    crmFieldMessages(state, field.name).map((message) => ({
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

export function CrmSubmitButton({
  disabled = false,
  idleLabel,
  pending,
  pendingLabel,
}: {
  disabled?: boolean;
  idleLabel: string;
  pending: boolean;
  pendingLabel: string;
}) {
  return (
    <button
      className="crm-form__submit"
      type="submit"
      disabled={disabled || pending}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

export function crmFieldId(prefix: string, name: string): string {
  return `${prefix}-${name.replaceAll(".", "-")}`;
}
