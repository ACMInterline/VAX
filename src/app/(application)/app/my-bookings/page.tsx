import Link from "next/link";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { bookingContent } from "@/content/booking";
import {
  createBookingPageService,
  requireCustomerBookingPageContext,
} from "../bookings/_lib/booking-page";

export const dynamic = "force-dynamic";

export default async function MyBookingsPage() {
  const { actor, locale } = await requireCustomerBookingPageContext();
  const bookings = await createBookingPageService().listMyBookings(actor);
  const content = bookingContent[locale];
  const money = new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-IE", {
    style: "currency",
    currency: "EUR",
  });
  const date = new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    dateStyle: "medium",
  });

  return (
    <section
      className="crm-page crm-page--self"
      aria-labelledby="my-bookings-heading"
    >
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.customer.eyebrow}</p>
          <h1 id="my-bookings-heading">{content.customer.listTitle}</h1>
          <p>{content.customer.listIntro}</p>
        </div>
      </header>
      {bookings.length === 0 ? (
        <div className="crm-empty-state">
          <h2>{content.customer.emptyTitle}</h2>
          <p>{content.customer.emptyText}</p>
        </div>
      ) : (
        <ul className="crm-customer-list">
          {bookings.map((booking) => (
            <li key={booking.bookingReference}>
              <article className="crm-summary-card">
                <header className="crm-summary-card__header">
                  <h2>{booking.bookingReference}</h2>
                  <ApplicationStatusBadge
                    label={content.labels.bookingStatuses[booking.status]}
                  />
                </header>
                <dl className="crm-card__details">
                  <div>
                    <dt>{content.customer.property}</dt>
                    <dd>{booking.propertyLabel}</dd>
                  </div>
                  <div>
                    <dt>{content.customer.total}</dt>
                    <dd>
                      {money.format(booking.grossTotalMinorUnits / 100)}
                    </dd>
                  </div>
                  <div>
                    <dt>{content.staff.schedulingStatus}</dt>
                    <dd>
                      {
                        content.labels.schedulingStatuses[
                          booking.schedulingStatus
                        ]
                      }
                    </dd>
                  </div>
                  <div>
                    <dt>{content.customer.created}</dt>
                    <dd>
                      <time dateTime={new Date(booking.createdAt).toISOString()}>
                        {date.format(new Date(booking.createdAt))}
                      </time>
                    </dd>
                  </div>
                </dl>
                <Link
                  className="crm-button"
                  href={`/app/my-bookings/${booking.bookingReference}`}
                >
                  {content.common.open}
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
