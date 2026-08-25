"use client";

import Link from "next/link";
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
import { bookingContent } from "@/content/booking";
import type { AuthLocale } from "@/auth/validation";
import {
  bookingFieldMessages,
  initialBookingActionState,
  type BookingActionState,
  type BookingFormAction,
} from "./action-state";

type FieldDefinition = Readonly<{
  name: string;
  id: string;
  label: string;
}>;

function fieldAccessibility(
  state: BookingActionState,
  name: string,
  fieldId: string,
  hintId?: string,
) {
  const invalid = bookingFieldMessages(state, name).length > 0;
  return {
    "aria-invalid": invalid || undefined,
    "aria-describedby": fieldDescriptionIds(
      hintId,
      invalid ? `${fieldId}-error` : undefined,
    ),
  } as const;
}

function FieldError({
  fieldId,
  name,
  state,
}: {
  fieldId: string;
  name: string;
  state: BookingActionState;
}) {
  return (
    <ApplicationFieldError
      id={`${fieldId}-error`}
      messages={bookingFieldMessages(state, name)}
    />
  );
}

function BookingFormFeedback({
  bookingHrefBase,
  fields,
  state,
  title,
}: {
  bookingHrefBase: "/app/my-bookings" | "/app/bookings";
  fields: readonly FieldDefinition[];
  state: BookingActionState;
  title: string;
}) {
  const errors: ApplicationFormError[] = fields.flatMap((field) =>
    bookingFieldMessages(state, field.name).map((message) => ({
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
      {state.status === "SUCCESS" && state.bookingReference ? (
        <p>
          <Link
            className="crm-button"
            href={`${bookingHrefBase}/${state.bookingReference}`}
          >
            {state.bookingReference}
          </Link>
        </p>
      ) : null}
    </>
  );
}

export function CustomerQuoteAcceptanceForm({
  action,
  expectedQuoteVersion,
  locale,
  quoteReference,
}: {
  action: BookingFormAction;
  expectedQuoteVersion: number;
  locale: AuthLocale;
  quoteReference: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialBookingActionState,
  );
  const content = bookingContent[locale];
  const acknowledgementId = "quote-acceptance-acknowledgement";
  const fields = [
    {
      name: "acknowledged",
      id: acknowledgementId,
      label: content.acceptance.acknowledgement,
    },
    {
      name: "_form",
      id: "quote-acceptance-form",
      label: content.acceptance.customerTitle,
    },
  ] as const;

  return (
    <form
      id="quote-acceptance-form"
      className="crm-form"
      action={formAction}
      aria-busy={pending}
      noValidate
    >
      <h2>{content.acceptance.customerTitle}</h2>
      <p>{content.acceptance.customerIntro}</p>
      <p className="crm-form__notice">
        {content.acceptance.scheduleDisclaimer}
      </p>
      <p className="crm-form__notice">
        {content.acceptance.noPaymentDisclaimer}
      </p>
      <input type="hidden" name="quoteReference" value={quoteReference} />
      <input
        type="hidden"
        name="expectedQuoteVersion"
        value={expectedQuoteVersion}
      />
      <BookingFormFeedback
        bookingHrefBase="/app/my-bookings"
        fields={fields}
        state={state}
        title={content.common.invalid}
      />
      <div className="crm-form__field crm-form__field--wide">
        <label htmlFor={acknowledgementId}>
          <input
            id={acknowledgementId}
            name="acknowledged"
            type="checkbox"
            value="true"
            required
            {...fieldAccessibility(
              state,
              "acknowledged",
              acknowledgementId,
            )}
          />
          <span>{content.acceptance.acknowledgement}</span>
        </label>
        <FieldError
          fieldId={acknowledgementId}
          name="acknowledged"
          state={state}
        />
      </div>
      <div className="crm-form__actions">
        <button
          className="crm-form__submit"
          type="submit"
          disabled={pending}
        >
          {pending
            ? content.acceptance.pending
            : content.acceptance.submit}
        </button>
      </div>
    </form>
  );
}

export function StaffQuoteAcceptanceForm({
  action,
  expectedQuoteVersion,
  locale,
  quoteReference,
}: {
  action: BookingFormAction;
  expectedQuoteVersion: number;
  locale: AuthLocale;
  quoteReference: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialBookingActionState,
  );
  const content = bookingContent[locale];
  const suffix = quoteReference.toLowerCase();
  const sourceId = `staff-acceptance-source-${suffix}`;
  const noteId = `staff-acceptance-note-${suffix}`;
  const acknowledgementId = `staff-acceptance-acknowledgement-${suffix}`;
  const formId = `staff-acceptance-form-${suffix}`;
  const fields = [
    {
      name: "acceptanceSource",
      id: sourceId,
      label: content.acceptance.staffSource,
    },
    {
      name: "acceptanceNote",
      id: noteId,
      label: content.acceptance.staffNote,
    },
    {
      name: "customerInstructionConfirmed",
      id: acknowledgementId,
      label: content.acceptance.staffAcknowledgement,
    },
    {
      name: "_form",
      id: formId,
      label: content.acceptance.staffTitle,
    },
  ] as const;

  return (
    <form
      id={formId}
      className="crm-form"
      action={formAction}
      aria-busy={pending}
      noValidate
    >
      <h3>{content.acceptance.staffTitle}</h3>
      <p>{content.acceptance.staffIntro}</p>
      <p className="crm-form__notice">
        {content.acceptance.provenanceGuard}
      </p>
      <input type="hidden" name="quoteReference" value={quoteReference} />
      <input
        type="hidden"
        name="expectedQuoteVersion"
        value={expectedQuoteVersion}
      />
      <BookingFormFeedback
        bookingHrefBase="/app/bookings"
        fields={fields}
        state={state}
        title={content.common.invalid}
      />
      <div className="crm-form__field">
        <label htmlFor={sourceId}>{content.acceptance.staffSource}</label>
        <select
          id={sourceId}
          name="acceptanceSource"
          defaultValue=""
          required
          {...fieldAccessibility(state, "acceptanceSource", sourceId)}
        >
          <option value="">—</option>
          {Object.entries(content.labels.staffAcceptanceSources).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </select>
        <FieldError
          fieldId={sourceId}
          name="acceptanceSource"
          state={state}
        />
      </div>
      <div className="crm-form__field crm-form__field--wide">
        <label htmlFor={noteId}>{content.acceptance.staffNote}</label>
        <textarea
          id={noteId}
          name="acceptanceNote"
          maxLength={1_000}
          required
          {...fieldAccessibility(
            state,
            "acceptanceNote",
            noteId,
            `${noteId}-hint`,
          )}
        />
        <p id={`${noteId}-hint`} className="crm-form__hint">
          {content.acceptance.staffNoteHint}
        </p>
        <FieldError
          fieldId={noteId}
          name="acceptanceNote"
          state={state}
        />
      </div>
      <div className="crm-form__field crm-form__field--wide">
        <label htmlFor={acknowledgementId}>
          <input
            id={acknowledgementId}
            name="customerInstructionConfirmed"
            type="checkbox"
            value="true"
            required
            {...fieldAccessibility(
              state,
              "customerInstructionConfirmed",
              acknowledgementId,
            )}
          />
          <span>{content.acceptance.staffAcknowledgement}</span>
        </label>
        <FieldError
          fieldId={acknowledgementId}
          name="customerInstructionConfirmed"
          state={state}
        />
      </div>
      <div className="crm-form__actions">
        <button
          className="crm-form__submit"
          type="submit"
          disabled={pending}
        >
          {pending
            ? content.acceptance.staffPending
            : content.acceptance.staffSubmit}
        </button>
      </div>
    </form>
  );
}

export function BookingCancellationForm({
  action,
  bookingReference,
  expectedVersion,
  locale,
}: {
  action: BookingFormAction;
  bookingReference: string;
  expectedVersion: number;
  locale: AuthLocale;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialBookingActionState,
  );
  const content = bookingContent[locale];
  const reasonCategoryId = "booking-cancellation-reason-category";
  const reasonTextId = "booking-cancellation-reason-text";
  const acknowledgementId = "booking-cancellation-acknowledgement";
  const fields = [
    {
      name: "reasonCategory",
      id: reasonCategoryId,
      label: content.cancellation.reasonCategory,
    },
    {
      name: "reasonText",
      id: reasonTextId,
      label: content.cancellation.reasonText,
    },
    {
      name: "cancellationAcknowledged",
      id: acknowledgementId,
      label: content.cancellation.acknowledgement,
    },
    {
      name: "_form",
      id: "booking-cancellation-form",
      label: content.cancellation.title,
    },
  ] as const;

  return (
    <form
      id="booking-cancellation-form"
      className="crm-form"
      action={formAction}
      aria-busy={pending}
      noValidate
    >
      <h2>{content.cancellation.title}</h2>
      <p>{content.cancellation.description}</p>
      <p className="crm-form__notice">
        {content.cancellation.financeDisclaimer}
      </p>
      <input type="hidden" name="bookingReference" value={bookingReference} />
      <input type="hidden" name="expectedVersion" value={expectedVersion} />
      <BookingFormFeedback
        bookingHrefBase="/app/bookings"
        fields={fields}
        state={state}
        title={content.common.invalid}
      />
      <div className="crm-form__field">
        <label htmlFor={reasonCategoryId}>
          {content.cancellation.reasonCategory}
        </label>
        <select
          id={reasonCategoryId}
          name="reasonCategory"
          defaultValue=""
          required
          {...fieldAccessibility(state, "reasonCategory", reasonCategoryId)}
        >
          <option value="">—</option>
          {Object.entries(content.labels.cancellationReasons).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </select>
        <FieldError
          fieldId={reasonCategoryId}
          name="reasonCategory"
          state={state}
        />
      </div>
      <div className="crm-form__field crm-form__field--wide">
        <label htmlFor={reasonTextId}>
          {content.cancellation.reasonText}
        </label>
        <textarea
          id={reasonTextId}
          name="reasonText"
          maxLength={1_000}
          {...fieldAccessibility(
            state,
            "reasonText",
            reasonTextId,
            `${reasonTextId}-hint`,
          )}
        />
        <p id={`${reasonTextId}-hint`} className="crm-form__hint">
          {content.cancellation.reasonHint}
        </p>
        <FieldError
          fieldId={reasonTextId}
          name="reasonText"
          state={state}
        />
      </div>
      <div className="crm-form__field crm-form__field--wide">
        <label htmlFor={acknowledgementId}>
          <input
            id={acknowledgementId}
            name="cancellationAcknowledged"
            type="checkbox"
            value="true"
            required
            {...fieldAccessibility(
              state,
              "cancellationAcknowledged",
              acknowledgementId,
            )}
          />
          <span>{content.cancellation.acknowledgement}</span>
        </label>
        <FieldError
          fieldId={acknowledgementId}
          name="cancellationAcknowledged"
          state={state}
        />
      </div>
      <div className="crm-form__actions">
        <button
          className="crm-form__submit"
          type="submit"
          disabled={pending}
        >
          {pending ? content.cancellation.pending : content.cancellation.submit}
        </button>
      </div>
    </form>
  );
}
