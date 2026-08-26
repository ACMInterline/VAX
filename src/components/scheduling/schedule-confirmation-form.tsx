"use client";

import { useActionState, useId, useRef } from "react";
import { ApplicationActionStatus } from "@/components/application/action-status";
import {
  ApplicationFieldError,
  fieldDescriptionIds,
} from "@/components/application/field-error";
import {
  ApplicationFormErrorSummary,
  type ApplicationFormError,
} from "@/components/application/form-error-summary";
import type { AuthLocale } from "@/auth/validation";
import {
  schedulingContent,
  schedulingReasonCategories,
} from "@/content/scheduling";
import {
  initialSchedulingActionState,
  schedulingFieldMessages,
  type BookingSchedulePreviewView,
  type SchedulingActionState,
  type SchedulingFormAction,
} from "./types";

function fieldAccessibility(
  state: SchedulingActionState,
  name: string,
  fieldId: string,
  hintId?: string,
) {
  const invalid = schedulingFieldMessages(state, name).length > 0;
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
  state: SchedulingActionState;
}) {
  return (
    <ApplicationFieldError
      id={`${fieldId}-error`}
      messages={schedulingFieldMessages(state, name)}
    />
  );
}

export function ScheduleConfirmationForm({
  action,
  locale,
  preview,
}: {
  action: SchedulingFormAction;
  locale: AuthLocale;
  preview: BookingSchedulePreviewView;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialSchedulingActionState,
  );
  const content = schedulingContent[locale];
  const isReschedule = preview.currentAppointment !== null;
  const candidateId = "schedule-candidate";
  const reasonId = "schedule-reason-category";
  const noteId = "schedule-reason-text";
  const acknowledgementId = "schedule-acknowledgement";
  const confirmationId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const noSelectableCandidate = preview.candidates.every(
    (candidate) => !candidate.selectable,
  );
  const fields = [
    { name: "candidateKey", id: candidateId, label: content.booking.selectCandidate },
    ...(isReschedule
      ? [{ name: "reasonCategory", id: reasonId, label: content.booking.reasonCategory }]
      : []),
    ...(isReschedule
      ? [{ name: "reasonText", id: noteId, label: content.booking.reasonText }]
      : []),
    { name: "acknowledged", id: acknowledgementId, label: content.booking.acknowledgement },
    { name: "_form", id: "schedule-confirmation-form", label: content.booking.candidatesTitle },
  ] as const;
  const errors: ApplicationFormError[] = fields.flatMap((field) =>
    schedulingFieldMessages(state, field.name).map((message) => ({
      fieldId: field.id,
      label: field.label,
      message,
    })),
  );

  function openConfirmation() {
    dialogRef.current?.showModal();
    queueMicrotask(() => cancelRef.current?.focus());
  }

  function confirmSubmission() {
    dialogRef.current?.close();
    formRef.current?.requestSubmit();
  }

  return (
    <form
      ref={formRef}
      id="schedule-confirmation-form"
      className="crm-form schedule-confirmation-form"
      action={formAction}
      aria-busy={pending}
      noValidate
    >
      <input type="hidden" name="bookingReference" value={preview.bookingReference} />
      <input type="hidden" name="expectedBookingVersion" value={preview.expectedBookingVersion} />
      <input type="hidden" name="workDate" value={preview.workDate} />
      {preview.currentAppointment ? (
        <input
          type="hidden"
          name="expectedOccupancySnapshotVersion"
          value={preview.currentAppointment.snapshotVersion}
        />
      ) : null}

      <ApplicationFormErrorSummary
        errors={errors}
        response={state}
        title={content.booking.invalid}
      />
      {errors.length === 0 ? <ApplicationActionStatus state={state} /> : null}

      <fieldset className="schedule-candidate-fieldset">
        <legend>{content.booking.candidatesTitle}</legend>
        <p>{content.booking.exactEndNotice}</p>
        {preview.candidates.length === 0 ? (
          <p className="schedule-warning">{content.booking.candidatesEmpty}</p>
        ) : (
          <div className="schedule-candidate-list">
            {preview.candidates.map((candidate, index) => {
              const inputId =
                index === 0
                  ? candidateId
                  : `${candidateId}-${candidate.rank}`;
              return (
                <label key={candidate.key} className="schedule-candidate-card" htmlFor={inputId}>
                  <input
                    id={inputId}
                    name="candidateKey"
                    type="radio"
                    value={candidate.key}
                    disabled={!candidate.selectable || pending}
                    required
                    {...fieldAccessibility(state, "candidateKey", candidateId)}
                  />
                  <span className="schedule-candidate-card__body">
                    <strong>{content.booking.candidateRank(candidate.rank)}</strong>
                    <span>
                      <time dateTime={candidate.serviceStart.toISOString()}>
                        {content.common.dateTime(candidate.serviceStart)}
                      </time>
                      {" – "}
                      <time dateTime={candidate.serviceEnd.toISOString()}>
                        {content.common.dateTime(candidate.serviceEnd)}
                      </time>
                    </span>
                    <span>{candidate.teamName}</span>
                    <span>
                      {content.dispatch.equipment}: {candidate.equipmentLabel ?? content.common.noValue}
                    </span>
                    <span>
                      {content.dispatch.travel}: {content.common.minutes(candidate.travelMinutes)} · {content.dispatch.buffer}: {content.common.minutes(candidate.bufferMinutes)}
                    </span>
                    <span>{content.readiness[candidate.readiness]}</span>
                    {candidate.fallbackTravelUsed ? (
                      <span className="schedule-warning">{content.dispatch.fallbackTravel}</span>
                    ) : null}
                    {candidate.warnings.map((warning) => (
                      <span key={warning} className="schedule-warning">{warning}</span>
                    ))}
                  </span>
                </label>
              );
            })}
          </div>
        )}
        <FieldError fieldId={candidateId} name="candidateKey" state={state} />
      </fieldset>

      {isReschedule ? (
        <div className="crm-form__field">
          <label htmlFor={reasonId}>{content.booking.reasonCategory}</label>
          <select
            id={reasonId}
            name="reasonCategory"
            defaultValue=""
            required
            {...fieldAccessibility(state, "reasonCategory", reasonId)}
          >
            <option value="">—</option>
            {schedulingReasonCategories.map((reason) => (
              <option key={reason} value={reason}>{content.reasons[reason]}</option>
            ))}
          </select>
          <FieldError fieldId={reasonId} name="reasonCategory" state={state} />
        </div>
      ) : null}

      {isReschedule ? (
        <div className="crm-form__field crm-form__field--wide">
          <label htmlFor={noteId}>{content.booking.reasonText}</label>
          <textarea
            id={noteId}
            name="reasonText"
            maxLength={500}
            {...fieldAccessibility(
              state,
              "reasonText",
              noteId,
              `${noteId}-hint`,
            )}
          />
          <p id={`${noteId}-hint`} className="crm-form__hint">
            {content.booking.reasonHint}
          </p>
          <FieldError fieldId={noteId} name="reasonText" state={state} />
        </div>
      ) : null}

      <div className="crm-form__field crm-form__field--wide">
        <label htmlFor={acknowledgementId} className="crm-form__choice">
          <input
            id={acknowledgementId}
            name="acknowledged"
            type="checkbox"
            value="true"
            required
            disabled={pending}
            {...fieldAccessibility(state, "acknowledged", acknowledgementId)}
          />
          <span>{content.booking.acknowledgement}</span>
        </label>
        <FieldError fieldId={acknowledgementId} name="acknowledged" state={state} />
      </div>

      <div className="crm-form__actions">
        <button
          ref={triggerRef}
          className="crm-form__submit"
          type="button"
          disabled={pending || noSelectableCandidate}
          onClick={openConfirmation}
        >
          {pending
            ? content.booking.pending
            : isReschedule
              ? content.booking.rescheduleSubmit
              : content.booking.scheduleSubmit}
        </button>
      </div>
      <dialog
        ref={dialogRef}
        className="application-confirmation-action__dialog"
        aria-labelledby={`${confirmationId}-title`}
        aria-describedby={`${confirmationId}-description`}
        onClose={() => triggerRef.current?.focus()}
      >
        <div className="schedule-confirmation-dialog__body">
          <h2 id={`${confirmationId}-title`}>
            {content.booking.confirmationTitle}
          </h2>
          <p id={`${confirmationId}-description`}>
            {content.booking.confirmationDescription}
          </p>
          <div className="application-confirmation-action__buttons">
            <button
              ref={cancelRef}
              type="button"
              onClick={() => dialogRef.current?.close()}
            >
              {content.booking.confirmationCancel}
            </button>
            <button type="button" onClick={confirmSubmission}>
              {isReschedule
                ? content.booking.rescheduleSubmit
                : content.booking.scheduleSubmit}
            </button>
          </div>
        </div>
      </dialog>
    </form>
  );
}
