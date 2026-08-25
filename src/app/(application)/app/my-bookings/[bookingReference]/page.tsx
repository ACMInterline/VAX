import Link from "next/link";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { bookingContent, type BookingCopy } from "@/content/booking";
import type { JsonObject } from "@/modules/request-quote/types";
import {
  createBookingPageService,
  loadCustomerBookingOrNotFound,
  parseBookingRouteParams,
  requireCustomerBookingPageContext,
  type BookingRouteParams,
} from "../../bookings/_lib/booking-page";

export const dynamic = "force-dynamic";

function record(value: unknown): Readonly<Record<string, unknown>> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function customerTerms(
  snapshot: JsonObject,
  locale: "bg" | "en",
): readonly string[] {
  const statements = record(record(snapshot)?.statements);
  const localized = record(statements?.[locale]);
  const controlled = [
    localized?.inspection,
    localized?.parkingTravel,
    localized?.stainRemoval,
    localized?.dryingReuse,
    localized?.addons,
  ].filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
  const additional = record(snapshot)?.additionalAssumptions;
  return typeof additional === "string" && additional.trim()
    ? [...controlled, additional]
    : controlled;
}

function stateMessage(
  status: "PENDING_SCHEDULING" | "CONFIRMED" | "CANCELLED",
  schedulingStatus: "UNSCHEDULED" | "REVIEW_REQUIRED" | "SCHEDULED",
  content: BookingCopy,
): string {
  if (status === "CANCELLED") return content.customer.cancelled;
  if (status === "CONFIRMED" && schedulingStatus === "SCHEDULED") {
    return content.customer.confirmed;
  }
  if (schedulingStatus === "REVIEW_REQUIRED") {
    return content.customer.reviewRequired;
  }
  return content.customer.pendingScheduling;
}

export default async function MyBookingDetailPage({
  params,
}: {
  params: Promise<BookingRouteParams>;
}) {
  const { actor, locale } = await requireCustomerBookingPageContext();
  const { bookingReference } = await parseBookingRouteParams(params);
  const booking = await loadCustomerBookingOrNotFound(
    createBookingPageService(),
    actor,
    bookingReference,
  );
  const content = bookingContent[locale];
  const money = new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-IE", {
    style: "currency",
    currency: "EUR",
  });
  const dateTime = new Intl.DateTimeFormat(
    locale === "bg" ? "bg-BG" : "en-GB",
    { dateStyle: "long", timeStyle: "short" },
  );
  const terms = customerTerms(booking.termsSnapshot, locale);
  const confirmedTiming =
    booking.scheduledStart && booking.scheduledEnd
      ? `${dateTime.format(new Date(booking.scheduledStart))} – ${dateTime.format(
          new Date(booking.scheduledEnd),
        )}`
      : content.common.noValue;
  const preferredTiming = [booking.preferredDate, booking.appointmentWindowCode]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className="crm-page crm-page--self"
      aria-labelledby="booking-heading"
    >
      <Link className="crm-back-link" href="/app/my-bookings">
        {content.common.back}
      </Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.customer.eyebrow}</p>
          <h1 id="booking-heading">
            {content.customer.detailTitle(booking.bookingReference)}
          </h1>
        </div>
        <ApplicationStatusBadge
          label={content.labels.bookingStatuses[booking.status]}
        />
      </header>
      <p className="crm-form__notice">
        {stateMessage(booking.status, booking.schedulingStatus, content)}
      </p>
      <section className="crm-card" aria-labelledby="booking-summary-heading">
        <h2 id="booking-summary-heading">{content.customer.total}</h2>
        <dl className="crm-card__details">
          <div>
            <dt>{content.customer.quote}</dt>
            <dd>
              <Link href={`/app/my-quotes/${booking.quoteReference}`}>
                {booking.quoteReference}
              </Link>
            </dd>
          </div>
          <div>
            <dt>{content.customer.property}</dt>
            <dd>{booking.propertyLabel}</dd>
          </div>
          <div>
            <dt>{content.customer.address}</dt>
            <dd>{booking.propertyAddress}</dd>
          </div>
          <div>
            <dt>{content.customer.total}</dt>
            <dd>{money.format(booking.grossTotalMinorUnits / 100)}</dd>
          </div>
          <div>
            <dt>{content.customer.vat}</dt>
            <dd>{money.format(booking.vatAmountMinorUnits / 100)}</dd>
          </div>
          <div>
            <dt>{content.customer.duration}</dt>
            <dd>
              {booking.estimatedDurationMinutes === null
                ? content.common.noValue
                : `${booking.estimatedDurationMinutes} min`}
            </dd>
          </div>
          <div>
            <dt>{content.customer.preferredTiming}</dt>
            <dd>{preferredTiming || content.common.noValue}</dd>
          </div>
          <div>
            <dt>{content.customer.confirmedTiming}</dt>
            <dd>{confirmedTiming}</dd>
          </div>
        </dl>
      </section>
      <section className="crm-management-card" aria-labelledby="booking-items-heading">
        <h2 id="booking-items-heading">{content.customer.services}</h2>
        <ol>
          {booking.items.map((item, index) => (
            <li key={`${item.sortOrder}:${index}`}>
              <strong>
                {locale === "bg" ? item.descriptionBg : item.descriptionEn}
              </strong>
              <span>
                {" "}
                · {item.quantity} ·{" "}
                {money.format(item.grossTotalMinorUnits / 100)}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section className="crm-management-card" aria-labelledby="booking-terms-heading">
        <h2 id="booking-terms-heading">{content.customer.terms}</h2>
        {terms.length > 0 ? (
          <ul>{terms.map((term) => <li key={term}>{term}</li>)}</ul>
        ) : (
          <p>{content.common.noValue}</p>
        )}
        {booking.customerNotes ? (
          <>
            <h3>{content.customer.customerNotes}</h3>
            <p>{booking.customerNotes}</p>
          </>
        ) : null}
      </section>
    </article>
  );
}
