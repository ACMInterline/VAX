import Link from "next/link";
import type { AuthLocale } from "@/auth/validation";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { jobExecutionContent } from "@/components/job-execution/content";
import { bookingContent } from "@/content/booking";
import { schedulingContent } from "@/content/scheduling";
import type {
  DispatchAppointmentView,
  DispatchDayView,
  DispatchMetricsView,
  UnscheduledBookingView,
} from "./types";

function money(value: number, locale: AuthLocale): string {
  return new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(value / 100);
}

function decimalHours(value: number, locale: AuthLocale): string {
  return new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

function ReadinessBadge({
  readiness,
  locale,
}: {
  readiness: DispatchAppointmentView["readiness"];
  locale: AuthLocale;
}) {
  return (
    <ApplicationStatusBadge
      label={schedulingContent[locale].readiness[readiness]}
      tone={readiness === "READY" ? "positive" : "warning"}
    />
  );
}

function Metrics({
  includeRevenue,
  locale,
  metrics,
}: {
  includeRevenue: boolean;
  locale: AuthLocale;
  metrics: DispatchMetricsView;
}) {
  const content = schedulingContent[locale].dispatch;
  return (
    <dl className="schedule-metrics">
      <div><dt>{content.scheduledJobs}</dt><dd>{metrics.scheduledJobs}</dd></div>
      <div><dt>{content.serviceMinutes}</dt><dd>{metrics.serviceMinutes}</dd></div>
      <div><dt>{content.travelMinutes}</dt><dd>{metrics.travelMinutes}</dd></div>
      <div><dt>{content.bufferMinutes}</dt><dd>{metrics.bufferMinutes}</dd></div>
      <div><dt>{content.idleMinutes}</dt><dd>{metrics.idleMinutes}</dd></div>
      <div><dt>{content.utilization}</dt><dd>{metrics.utilizationPercent}%</dd></div>
      <div>
        <dt>{content.occupiedTeamHours}</dt>
        <dd>{decimalHours(metrics.occupiedTeamHoursHundredths, locale)}</dd>
      </div>
      <div>
        <dt>{content.laborHours}</dt>
        <dd>{decimalHours(metrics.laborHoursHundredths, locale)}</dd>
      </div>
      {includeRevenue && metrics.revenuePerOccupiedTeamHourMinorUnits !== null ? (
        <div>
          <dt>{content.revenuePerOccupiedTeamHour}</dt>
          <dd>{money(metrics.revenuePerOccupiedTeamHourMinorUnits, locale)}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function UnscheduledBooking({
  booking,
  locale,
  workDate,
}: {
  booking: UnscheduledBookingView;
  locale: AuthLocale;
  workDate: string;
}) {
  const content = schedulingContent[locale];
  const preferred = [
    booking.preferredDate ? content.common.date(booking.preferredDate) : null,
    booking.appointmentWindowLabel,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <article className="schedule-card schedule-card--unscheduled">
      <header className="schedule-card__header">
        <div>
          <p className="crm-card__eyebrow">{booking.bookingReference}</p>
          <h3>{booking.propertyLabel}</h3>
        </div>
        <ReadinessBadge readiness={booking.readiness} locale={locale} />
      </header>
      <dl className="schedule-card__details">
        <div><dt>{content.dispatch.preferredTiming}</dt><dd>{preferred || content.common.noValue}</dd></div>
        <div><dt>{content.dispatch.duration}</dt><dd>{content.common.minutes(booking.serviceDurationMinutes)}</dd></div>
        <div><dt>{locale === "bg" ? "Клиент" : "Customer"}</dt><dd>{booking.customerDisplayName}</dd></div>
      </dl>
      {booking.warnings.length > 0 ? (
        <aside className="schedule-warning" aria-label={content.dispatch.readiness}>
          <ul>{booking.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </aside>
      ) : null}
      <Link
        className="crm-button"
        href={`/app/schedule/bookings/${booking.bookingReference}?date=${workDate}`}
      >
        {content.common.open}
      </Link>
    </article>
  );
}

function Appointment({
  appointment,
  locale,
  workDate,
}: {
  appointment: DispatchAppointmentView;
  locale: AuthLocale;
  workDate: string;
}) {
  const content = schedulingContent[locale];
  return (
    <article className="schedule-card schedule-card--appointment">
      <header className="schedule-card__header">
        <div>
          <p className="crm-card__eyebrow">{appointment.bookingReference}</p>
          <h4>{appointment.propertyLabel}</h4>
        </div>
        <ReadinessBadge readiness={appointment.readiness} locale={locale} />
      </header>
      <p className="schedule-card__time">
        <time dateTime={appointment.serviceStart.toISOString()}>
          {content.common.dateTime(appointment.serviceStart)}
        </time>
        {" – "}
        <time dateTime={appointment.serviceEnd.toISOString()}>
          {content.common.dateTime(appointment.serviceEnd)}
        </time>
      </p>
      <dl className="schedule-card__details">
        <div><dt>{content.dispatch.bookingReference}</dt><dd>{appointment.bookingReference}</dd></div>
        <div><dt>{content.dispatch.bookingStatus}</dt><dd>{bookingContent[locale].labels.bookingStatuses[appointment.bookingStatus]}</dd></div>
        <div><dt>{content.dispatch.jobReference}</dt><dd>{appointment.jobReference ?? content.dispatch.jobNotPrepared}</dd></div>
        <div><dt>{content.dispatch.jobStatus}</dt><dd>{appointment.jobStatus ? jobExecutionContent[locale].statuses[appointment.jobStatus].label : content.dispatch.jobNotPrepared}</dd></div>
        <div><dt>{locale === "bg" ? "Клиент" : "Customer"}</dt><dd>{appointment.customerDisplayName}</dd></div>
        <div><dt>{content.dispatch.area}</dt><dd>{appointment.propertyArea ?? content.common.noValue}</dd></div>
        <div><dt>{locale === "bg" ? "Адрес" : "Address"}</dt><dd>{appointment.propertyAddress}</dd></div>
        <div><dt>{content.dispatch.duration}</dt><dd>{content.common.minutes(appointment.serviceDurationMinutes)}</dd></div>
        <div><dt>{content.dispatch.travel}</dt><dd>{content.common.minutes(appointment.travelMinutes)}</dd></div>
        <div><dt>{content.dispatch.buffer}</dt><dd>{content.common.minutes(appointment.bufferMinutes)}</dd></div>
        <div><dt>{content.dispatch.equipment}</dt><dd>{appointment.equipmentLabel ?? content.common.noValue}</dd></div>
      </dl>
      {appointment.fallbackTravelUsed ? (
        <p className="schedule-warning">{content.dispatch.fallbackTravel}</p>
      ) : null}
      {appointment.warnings.length > 0 ? (
        <aside className="schedule-warning" aria-label={content.dispatch.readiness}>
          <ul>{appointment.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </aside>
      ) : null}
      <p>
        <Link
          className="crm-button"
          href={`/app/schedule/bookings/${appointment.bookingReference}?date=${workDate}`}
        >
          {content.common.open}
        </Link>
      </p>
    </article>
  );
}

export function DispatchBoard({
  day,
  includeRevenue,
  locale,
}: {
  day: DispatchDayView;
  includeRevenue: boolean;
  locale: AuthLocale;
}) {
  const content = schedulingContent[locale];
  return (
    <section className="crm-page schedule-page" aria-labelledby="schedule-heading">
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.dispatch.eyebrow}</p>
          <h1 id="schedule-heading">{content.dispatch.title}</h1>
          <p>{content.dispatch.intro}</p>
          <p>
            <time dateTime={day.workDate}>
              {content.common.date(day.workDate)}
            </time>
            {" · Europe/Sofia"}
          </p>
        </div>
      </header>

      <nav className="schedule-date-navigation" aria-label={content.dispatch.chooseDate}>
        <Link href={`/app/schedule?date=${day.previousDate}`}>
          {content.dispatch.previousDay}
        </Link>
        <form method="get" action="/app/schedule">
          <label htmlFor="schedule-work-date">{content.dispatch.chooseDate}</label>
          <input id="schedule-work-date" name="date" type="date" defaultValue={day.workDate} required />
          <button type="submit">{content.dispatch.openDate}</button>
        </form>
        <Link href="/app/schedule">{content.dispatch.today}</Link>
        <Link href={`/app/schedule?date=${day.nextDate}`}>
          {content.dispatch.nextDay}
        </Link>
      </nav>

      {day.provisionalConfiguration ? (
        <aside className="schedule-disclosure" aria-labelledby="schedule-draft-title">
          <h2 id="schedule-draft-title">{content.dispatch.provisionalTitle}</h2>
          <p>{content.dispatch.provisionalText}</p>
        </aside>
      ) : null}
      {day.warnings.length > 0 ? (
        <aside className="schedule-warning" aria-label={content.dispatch.readiness}>
          <ul>{day.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </aside>
      ) : null}

      <section aria-labelledby="schedule-metrics-title">
        <h2 id="schedule-metrics-title">{content.dispatch.metricsTitle}</h2>
        <Metrics includeRevenue={includeRevenue} locale={locale} metrics={day.metrics} />
      </section>

      <section aria-labelledby="unscheduled-heading">
        <h2 id="unscheduled-heading">{content.dispatch.unscheduledTitle}</h2>
        {day.unscheduledBookings.length === 0 ? (
          <div className="crm-empty-state"><p>{content.dispatch.unscheduledEmpty}</p></div>
        ) : (
          <ul className="schedule-unscheduled-list">
            {day.unscheduledBookings.map((booking) => (
              <li key={booking.bookingReference}>
                <UnscheduledBooking
                  booking={booking}
                  locale={locale}
                  workDate={day.workDate}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="team-schedule-heading">
        <h2 id="team-schedule-heading">{content.dispatch.teamsTitle}</h2>
        <div className="schedule-team-grid">
          {day.teams.map((team) => (
            <section key={team.id} className="schedule-team-column" aria-labelledby={`schedule-team-${team.id}`}>
              <header>
                <h3 id={`schedule-team-${team.id}`}>{team.name}</h3>
                <p>{team.workingWindowLabel}</p>
              </header>
              {team.appointments.length === 0 ? (
                <p className="schedule-team-column__empty">{content.dispatch.teamEmpty}</p>
              ) : (
                <ol>
                  {team.appointments.map((appointment) => (
                    <li key={appointment.bookingReference}>
                      <Appointment
                        appointment={appointment}
                        locale={locale}
                        workDate={day.workDate}
                      />
                    </li>
                  ))}
                </ol>
              )}
              <Metrics includeRevenue={includeRevenue} locale={locale} metrics={team.metrics} />
            </section>
          ))}
        </div>
      </section>
    </section>
  );
}
