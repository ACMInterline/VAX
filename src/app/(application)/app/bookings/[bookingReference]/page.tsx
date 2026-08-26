import Link from "next/link";
import { BookingCancellationForm } from "@/components/booking/booking-forms";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { bookingContent } from "@/content/booking";
import { cancelBookingAction } from "../actions";
import {
  createBookingPageService,
  loadStaffBookingOrNotFound,
  parseBookingRouteParams,
  requireStaffBookingPageContext,
  type BookingRouteParams,
} from "../_lib/booking-page";

export const dynamic = "force-dynamic";

function snapshot(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<BookingRouteParams>;
}) {
  const { actor, locale } = await requireStaffBookingPageContext();
  const { bookingReference } = await parseBookingRouteParams(params);
  const booking = await loadStaffBookingOrNotFound(
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
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Sofia",
    },
  );
  const canCancel =
    booking.status !== "CANCELLED" &&
    actor.permissions.has("CUSTOMER_RECORDS_MANAGE") &&
    actor.permissions.has("OPERATIONS_MANAGE") &&
    actor.permissions.has("SCHEDULE_MANAGE");
  const acceptanceSource =
    booking.acceptanceSource === "CUSTOMER_PORTAL"
      ? locale === "bg"
        ? "Клиентски портал"
        : "Customer portal"
      : content.labels.staffAcceptanceSources[
          booking.acceptanceSource as keyof typeof content.labels.staffAcceptanceSources
        ] ?? booking.acceptanceSource;

  return (
    <article className="crm-page" aria-labelledby="booking-detail-heading">
      <Link className="crm-back-link" href="/app/bookings">
        {content.common.back}
      </Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.staff.eyebrow}</p>
          <h1 id="booking-detail-heading">
            {content.staff.detailTitle(booking.bookingReference)}
          </h1>
        </div>
        <ApplicationStatusBadge
          label={content.labels.bookingStatuses[booking.status]}
        />
      </header>
      {booking.manualReviewRequired ? (
        <p className="crm-form__notice">
          {content.customer.reviewRequired}
        </p>
      ) : null}
      <section className="crm-card" aria-labelledby="booking-customer-heading">
        <h2 id="booking-customer-heading">{content.staff.customer}</h2>
        <dl className="crm-card__details">
          <div>
            <dt>{content.staff.customer}</dt>
            <dd>{booking.customerDisplayName}</dd>
          </div>
          <div>
            <dt>{content.staff.property}</dt>
            <dd>{booking.propertyLabel}</dd>
          </div>
          <div>
            <dt>{content.staff.address}</dt>
            <dd>{booking.propertyAddress}</dd>
          </div>
          <div>
            <dt>{content.staff.assignedTeam}</dt>
            <dd>{booking.assignedTeamName ?? content.staff.noTeam}</dd>
          </div>
          <div>
            <dt>{content.staff.schedulingStatus}</dt>
            <dd>
              {content.labels.schedulingStatuses[booking.schedulingStatus]}
            </dd>
          </div>
        </dl>
      </section>
      <section className="crm-management-card" aria-labelledby="booking-acceptance-heading">
        <h2 id="booking-acceptance-heading">{content.staff.acceptance}</h2>
        <dl className="crm-card__details">
          <div>
            <dt>{content.staff.acceptedQuote}</dt>
            <dd>{booking.quoteReference}</dd>
          </div>
          <div>
            <dt>{content.staff.acceptedBy}</dt>
            <dd>
              {
                content.labels.acceptanceActorTypes[
                  booking.acceptanceActorType
                ]
              }
            </dd>
          </div>
          <div>
            <dt>{content.staff.acceptedAt}</dt>
            <dd>
              <time dateTime={new Date(booking.acceptedAt).toISOString()}>
                {dateTime.format(new Date(booking.acceptedAt))}
              </time>
            </dd>
          </div>
          <div>
            <dt>{content.staff.acceptanceSource}</dt>
            <dd>{acceptanceSource}</dd>
          </div>
          <div>
            <dt>{content.staff.acceptanceNote}</dt>
            <dd>{booking.acceptanceNote ?? content.common.noValue}</dd>
          </div>
        </dl>
      </section>
      <section className="crm-management-card" aria-labelledby="booking-price-heading">
        <h2 id="booking-price-heading">{content.staff.priceSnapshot}</h2>
        <dl className="crm-card__details">
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
        </dl>
        <details>
          <summary>{content.staff.priceSnapshot}</summary>
          <pre>{snapshot(booking.commercialSnapshot)}</pre>
        </details>
      </section>
      <section className="crm-management-card" aria-labelledby="booking-items-heading">
        <h2 id="booking-items-heading">{content.staff.items}</h2>
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
      <section className="crm-management-card" aria-labelledby="booking-scheduling-heading">
        <h2 id="booking-scheduling-heading">
          {content.staff.schedulingSnapshot}
        </h2>
        <p className="crm-form__notice">
          {content.acceptance.provenanceGuard}
        </p>
        <pre>{snapshot(booking.schedulingSnapshot)}</pre>
      </section>
      <section className="crm-management-card" aria-labelledby="booking-notes-heading">
        <h2 id="booking-notes-heading">{content.staff.customerNotes}</h2>
        <p>{booking.customerNotes ?? content.common.noValue}</p>
        <h3>{content.staff.internalNotes}</h3>
        <p>{booking.internalNotes ?? content.common.noValue}</p>
      </section>
      <section className="crm-management-card" aria-labelledby="booking-audit-heading">
        <h2 id="booking-audit-heading">{content.staff.auditTimeline}</h2>
        <ol>
          {booking.auditTimeline.map((event, index) => (
            <li key={`${new Date(event.createdAt).toISOString()}:${index}`}>
              <strong>{event.eventType}</strong>
              <span> · {event.source}</span>
              <time dateTime={new Date(event.createdAt).toISOString()}>
                {" "}
                · {dateTime.format(new Date(event.createdAt))}
              </time>
            </li>
          ))}
        </ol>
      </section>
      {canCancel ? (
        <BookingCancellationForm
          action={cancelBookingAction}
          bookingReference={booking.bookingReference}
          expectedVersion={booking.version}
          locale={locale}
        />
      ) : null}
    </article>
  );
}
