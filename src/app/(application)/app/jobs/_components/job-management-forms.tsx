"use client";

import type { AuthLocale } from "@/auth/validation";
import type { JobFormAction, JobOption } from "@/components/job-execution";
import {
  JobFieldError,
  JobFormFeedback,
  JobSubmitButton,
  jobFieldAccessibility,
  jobFormId,
  useJobAction,
} from "@/components/job-execution/form-support";
import { jobCancellationReasonCategories } from "@/modules/job-execution/types";

const content = {
  bg: {
    check: "Проверете формуляра.",
    pending: "Записва се…",
    choose: "Изберете",
    createTitle: "Създаване от потвърдена резервация",
    createIntro:
      "Въведете точната референция и текущата версия на резервацията. Изходните данни се проверяват отново на сървъра.",
    bookingReference: "Референция на резервацията",
    bookingVersion: "Версия на резервацията",
    createSubmit: "Създай работна задача",
    assignmentTitle: "Точно назначаване на екип",
    assignmentIntro:
      "Избраният активен екип се проверява отново спрямо графика и необходимите способности.",
    team: "Оперативен екип",
    assignSubmit: "Назначи екипа",
    cancelTitle: "Отмяна на работната задача",
    cancelIntro:
      "Отмяната се записва с категория и използва текущата версия на задачата.",
    cancelReason: "Категория на причината",
    cancelDetails: "Допълнителни данни",
    cancelSubmit: "Отмени задачата",
    cancellationReasons: {
      CUSTOMER_REQUEST: "По искане на клиента",
      OPERATIONAL: "Оперативна причина",
      SAFETY: "Безопасност",
      DUPLICATE: "Дублирана задача",
      OTHER: "Друга причина",
    },
  },
  en: {
    check: "Check the form.",
    pending: "Saving…",
    choose: "Choose",
    createTitle: "Create from a confirmed booking",
    createIntro:
      "Enter the exact booking reference and current version. The server revalidates the source record.",
    bookingReference: "Booking reference",
    bookingVersion: "Booking version",
    createSubmit: "Create field job",
    assignmentTitle: "Exact team assignment",
    assignmentIntro:
      "The selected active team is revalidated against the schedule and required capabilities.",
    team: "Operations team",
    assignSubmit: "Assign team",
    cancelTitle: "Cancel field job",
    cancelIntro:
      "Cancellation is recorded with a reason category and the current job version.",
    cancelReason: "Reason category",
    cancelDetails: "Additional details",
    cancelSubmit: "Cancel job",
    cancellationReasons: {
      CUSTOMER_REQUEST: "Customer request",
      OPERATIONAL: "Operational reason",
      SAFETY: "Safety",
      DUPLICATE: "Duplicate job",
      OTHER: "Other reason",
    },
  },
} as const;

export function CreateJobFromBookingForm({
  action,
  locale,
}: {
  action: JobFormAction;
  locale: AuthLocale;
}) {
  const [state, formAction, pending] = useJobAction(action);
  const text = content[locale];
  const formId = "create-job-from-booking";
  const bookingReferenceId = `${formId}-reference`;
  const bookingVersionId = `${formId}-version`;
  const fields = [
    {
      name: "bookingReference",
      id: bookingReferenceId,
      label: text.bookingReference,
    },
    {
      name: "expectedBookingVersion",
      id: bookingVersionId,
      label: text.bookingVersion,
    },
    { name: "_form", id: formId, label: text.createTitle },
  ] as const;

  return (
    <form
      id={formId}
      className="crm-form"
      action={formAction}
      aria-busy={pending}
      noValidate
    >
      <h2>{text.createTitle}</h2>
      <p className="crm-form__notice">{text.createIntro}</p>
      <JobFormFeedback fields={fields} state={state} title={text.check} />
      <div className="crm-form__grid">
        <div className="crm-form__field">
          <label htmlFor={bookingReferenceId}>{text.bookingReference}</label>
          <input
            id={bookingReferenceId}
            name="bookingReference"
            type="text"
            required
            maxLength={28}
            pattern="BKG-[A-F0-9]{24}"
            autoComplete="off"
            spellCheck={false}
            {...jobFieldAccessibility(
              state,
              "bookingReference",
              bookingReferenceId,
            )}
          />
          <JobFieldError
            fieldId={bookingReferenceId}
            name="bookingReference"
            state={state}
          />
        </div>
        <div className="crm-form__field">
          <label htmlFor={bookingVersionId}>{text.bookingVersion}</label>
          <input
            id={bookingVersionId}
            name="expectedBookingVersion"
            type="number"
            min={1}
            max={2_147_483_647}
            step={1}
            required
            inputMode="numeric"
            {...jobFieldAccessibility(
              state,
              "expectedBookingVersion",
              bookingVersionId,
            )}
          />
          <JobFieldError
            fieldId={bookingVersionId}
            name="expectedBookingVersion"
            state={state}
          />
        </div>
      </div>
      <div className="crm-form__actions">
        <JobSubmitButton
          idleLabel={text.createSubmit}
          pending={pending}
          pendingLabel={text.pending}
        />
      </div>
    </form>
  );
}

export function AssignJobTeamForm({
  action,
  expectedJobVersion,
  jobReference,
  locale,
  teams,
}: {
  action: JobFormAction;
  expectedJobVersion: number;
  jobReference: string;
  locale: AuthLocale;
  teams: readonly JobOption[];
}) {
  const [state, formAction, pending] = useJobAction(action);
  const text = content[locale];
  const formId = jobFormId("assign-job-team", jobReference);
  const teamId = `${formId}-team`;

  return (
    <form
      id={formId}
      className="crm-form"
      action={formAction}
      aria-busy={pending}
      noValidate
    >
      <h2>{text.assignmentTitle}</h2>
      <p className="crm-form__notice">{text.assignmentIntro}</p>
      <input type="hidden" name="jobReference" value={jobReference} />
      <input
        type="hidden"
        name="expectedJobVersion"
        value={expectedJobVersion}
      />
      <JobFormFeedback
        fields={[{ name: "operationsTeamId", id: teamId, label: text.team }]}
        state={state}
        title={text.check}
      />
      <div className="crm-form__field">
        <label htmlFor={teamId}>{text.team}</label>
        <select
          id={teamId}
          name="operationsTeamId"
          required
          defaultValue=""
          {...jobFieldAccessibility(state, "operationsTeamId", teamId)}
        >
          <option value="" disabled>
            {text.choose}
          </option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.label}
            </option>
          ))}
        </select>
        <JobFieldError
          fieldId={teamId}
          name="operationsTeamId"
          state={state}
        />
      </div>
      <div className="crm-form__actions">
        <JobSubmitButton
          idleLabel={text.assignSubmit}
          pending={pending}
          pendingLabel={text.pending}
        />
      </div>
    </form>
  );
}

export function CancelJobForm({
  action,
  expectedJobVersion,
  jobReference,
  locale,
}: {
  action: JobFormAction;
  expectedJobVersion: number;
  jobReference: string;
  locale: AuthLocale;
}) {
  const [state, formAction, pending] = useJobAction(action);
  const text = content[locale];
  const formId = jobFormId("cancel-job", jobReference);
  const reasonId = `${formId}-reason`;
  const detailsId = `${formId}-details`;
  const fields = [
    { name: "reasonCategory", id: reasonId, label: text.cancelReason },
    { name: "reasonText", id: detailsId, label: text.cancelDetails },
    { name: "_form", id: formId, label: text.cancelTitle },
  ] as const;

  return (
    <form
      id={formId}
      className="crm-form"
      action={formAction}
      aria-busy={pending}
      noValidate
    >
      <h2>{text.cancelTitle}</h2>
      <p className="crm-form__notice">{text.cancelIntro}</p>
      <input type="hidden" name="jobReference" value={jobReference} />
      <input
        type="hidden"
        name="expectedJobVersion"
        value={expectedJobVersion}
      />
      <JobFormFeedback fields={fields} state={state} title={text.check} />
      <div className="crm-form__grid">
        <div className="crm-form__field">
          <label htmlFor={reasonId}>{text.cancelReason}</label>
          <select
            id={reasonId}
            name="reasonCategory"
            required
            defaultValue=""
            {...jobFieldAccessibility(state, "reasonCategory", reasonId)}
          >
            <option value="" disabled>
              {text.choose}
            </option>
            {jobCancellationReasonCategories.map((reason) => (
              <option key={reason} value={reason}>
                {text.cancellationReasons[reason]}
              </option>
            ))}
          </select>
          <JobFieldError
            fieldId={reasonId}
            name="reasonCategory"
            state={state}
          />
        </div>
        <div className="crm-form__field crm-form__field--wide">
          <label htmlFor={detailsId}>{text.cancelDetails}</label>
          <textarea
            id={detailsId}
            name="reasonText"
            maxLength={1_000}
            {...jobFieldAccessibility(state, "reasonText", detailsId)}
          />
          <JobFieldError
            fieldId={detailsId}
            name="reasonText"
            state={state}
          />
        </div>
      </div>
      <div className="crm-form__actions">
        <JobSubmitButton
          idleLabel={text.cancelSubmit}
          pending={pending}
          pendingLabel={text.pending}
        />
      </div>
    </form>
  );
}
