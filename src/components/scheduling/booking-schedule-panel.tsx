import Link from "next/link";
import type { AuthLocale } from "@/auth/validation";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { schedulingContent } from "@/content/scheduling";
import { ScheduleConfirmationForm } from "./schedule-confirmation-form";
import type {
  BookingSchedulePreviewView,
  SchedulingFormAction,
} from "./types";

export function BookingSchedulePanel({
  action,
  locale,
  preview,
}: {
  action: SchedulingFormAction;
  locale: AuthLocale;
  preview: BookingSchedulePreviewView;
}) {
  const content = schedulingContent[locale];
  return (
    <article className="crm-page schedule-page" aria-labelledby="booking-schedule-heading">
      <Link className="crm-back-link" href={`/app/schedule?date=${preview.workDate}`}>
        {content.common.back}
      </Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.booking.eyebrow}</p>
          <h1 id="booking-schedule-heading">{content.booking.title(preview.bookingReference)}</h1>
          <p>{content.booking.intro}</p>
        </div>
      </header>

      {preview.provisionalConfiguration ? (
        <aside className="schedule-disclosure" aria-labelledby="booking-schedule-draft-title">
          <h2 id="booking-schedule-draft-title">{content.dispatch.provisionalTitle}</h2>
          <p>{content.dispatch.provisionalText}</p>
        </aside>
      ) : null}
      {preview.reviewWarnings.length > 0 ? (
        <aside className="schedule-warning" aria-label={content.booking.reviewRequired}>
          <ul>{preview.reviewWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </aside>
      ) : null}

      <section className="crm-card" aria-labelledby="booking-schedule-summary-title">
        <h2 id="booking-schedule-summary-title">
          {locale === "bg" ? "Оперативно обобщение" : "Operational summary"}
        </h2>
        <dl className="crm-card__details">
          <div><dt>{locale === "bg" ? "Клиент" : "Customer"}</dt><dd>{preview.customerDisplayName}</dd></div>
          <div><dt>{locale === "bg" ? "Имот" : "Property"}</dt><dd>{preview.propertyLabel}</dd></div>
          <div><dt>{locale === "bg" ? "Адрес" : "Address"}</dt><dd>{preview.propertyAddress}</dd></div>
          <div><dt>{content.dispatch.preferredTiming}</dt><dd>{preview.preferredTimingLabel ?? content.common.noValue}</dd></div>
          <div><dt>{content.dispatch.duration}</dt><dd>{content.common.minutes(preview.serviceDurationMinutes)}</dd></div>
        </dl>
      </section>

      <section className="crm-management-card" aria-labelledby="current-appointment-title">
        <h2 id="current-appointment-title">{content.booking.currentAppointment}</h2>
        {preview.currentAppointment ? (
          <div>
            <p>
              <time dateTime={preview.currentAppointment.serviceStart.toISOString()}>
                {content.common.dateTime(preview.currentAppointment.serviceStart)}
              </time>
              {" – "}
              <time dateTime={preview.currentAppointment.serviceEnd.toISOString()}>
                {content.common.dateTime(preview.currentAppointment.serviceEnd)}
              </time>
            </p>
            <p>{preview.currentAppointment.teamName}</p>
            <p>{preview.currentAppointment.equipmentLabel ?? content.common.noValue}</p>
          </div>
        ) : (
          <p>{content.booking.noAppointment}</p>
        )}
      </section>

      <ScheduleConfirmationForm action={action} locale={locale} preview={preview} />
      <p>
        <ApplicationStatusBadge
          label="Europe/Sofia"
          tone="muted"
        />
      </p>
    </article>
  );
}
