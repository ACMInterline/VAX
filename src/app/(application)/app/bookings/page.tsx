import Link from "next/link";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { bookingContent } from "@/content/booking";
import {
  createBookingPageService,
  parseStaffBookingSearchParams,
  requireStaffBookingPageContext,
  type BookingSearchParams,
} from "./_lib/booking-page";

export const dynamic = "force-dynamic";

function pageHref(
  page: number,
  values: Readonly<Record<string, string | undefined>>,
): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(values)) {
    if (value) query.set(name, value);
  }
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return suffix ? `/app/bookings?${suffix}` : "/app/bookings";
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<BookingSearchParams>;
}) {
  const { actor, locale } = await requireStaffBookingPageContext();
  const parsed = await parseStaffBookingSearchParams(searchParams);
  const result = await createBookingPageService().listBookings(
    actor,
    parsed.filters,
  );
  const content = bookingContent[locale];
  const money = new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-IE", {
    style: "currency",
    currency: "EUR",
  });
  const date = new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    dateStyle: "medium",
    timeZone: "Europe/Sofia",
  });
  const raw = await searchParams;
  const filterValues = {
    search: typeof raw.search === "string" ? raw.search : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
    schedulingStatus:
      typeof raw.schedulingStatus === "string"
        ? raw.schedulingStatus
        : undefined,
    scheduledFrom: parsed.scheduledFromValue,
    scheduledTo: parsed.scheduledToValue,
  };
  const hasPrevious = parsed.page > 1;
  const hasNext = result.offset + result.items.length < result.total;

  return (
    <section className="crm-page" aria-labelledby="bookings-heading">
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.staff.eyebrow}</p>
          <h1 id="bookings-heading">{content.staff.listTitle}</h1>
          <p>{content.staff.listIntro}</p>
        </div>
      </header>
      <form className="crm-filter-bar" method="get" action="/app/bookings">
        <div className="crm-form__field">
          <label htmlFor="booking-search">{content.staff.search}</label>
          <input
            id="booking-search"
            name="search"
            type="search"
            maxLength={160}
            defaultValue={filterValues.search}
          />
        </div>
        <div className="crm-form__field">
          <label htmlFor="booking-status">{content.staff.status}</label>
          <select
            id="booking-status"
            name="status"
            defaultValue={filterValues.status ?? ""}
          >
            <option value="">{content.common.all}</option>
            {Object.entries(content.labels.bookingStatuses).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </div>
        <div className="crm-form__field">
          <label htmlFor="booking-scheduling-status">
            {content.staff.schedulingStatus}
          </label>
          <select
            id="booking-scheduling-status"
            name="schedulingStatus"
            defaultValue={filterValues.schedulingStatus ?? ""}
          >
            <option value="">{content.common.all}</option>
            {Object.entries(content.labels.schedulingStatuses).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </div>
        <div className="crm-form__field">
          <label htmlFor="booking-scheduled-from">
            {content.staff.date}
          </label>
          <input
            id="booking-scheduled-from"
            name="scheduledFrom"
            type="date"
            defaultValue={parsed.scheduledFromValue}
          />
        </div>
        <div className="crm-form__field">
          <label htmlFor="booking-scheduled-to">
            {locale === "bg" ? "До дата" : "Through date"}
          </label>
          <input
            id="booking-scheduled-to"
            name="scheduledTo"
            type="date"
            defaultValue={parsed.scheduledToValue}
          />
        </div>
        <div className="crm-form__actions">
          <button className="crm-form__submit" type="submit">
            {content.common.apply}
          </button>
          <Link className="crm-button" href="/app/bookings">
            {content.common.clear}
          </Link>
        </div>
      </form>
      <p>{content.staff.pageSummary(parsed.page, result.total)}</p>
      {result.items.length === 0 ? (
        <div className="crm-empty-state">
          <p>{content.staff.empty}</p>
        </div>
      ) : (
        <ul className="crm-customer-list">
          {result.items.map((booking) => (
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
                    <dt>{content.staff.customer}</dt>
                    <dd>{booking.customerDisplayName}</dd>
                  </div>
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
                    <dt>{content.staff.assignedTeam}</dt>
                    <dd>{booking.assignedTeamName ?? content.staff.noTeam}</dd>
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
                {booking.manualReviewRequired ? (
                  <p className="crm-form__notice">
                    {content.customer.reviewRequired}
                  </p>
                ) : null}
                <Link
                  className="crm-button"
                  href={`/app/bookings/${booking.bookingReference}`}
                >
                  {content.common.open}
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}
      {hasPrevious || hasNext ? (
        <nav aria-label={locale === "bg" ? "Страници" : "Pages"}>
          <ul className="crm-record-actions">
            {hasPrevious ? (
              <li>
                <Link href={pageHref(parsed.page - 1, filterValues)}>
                  {locale === "bg" ? "Предишна" : "Previous"}
                </Link>
              </li>
            ) : null}
            {hasNext ? (
              <li>
                <Link href={pageHref(parsed.page + 1, filterValues)}>
                  {locale === "bg" ? "Следваща" : "Next"}
                </Link>
              </li>
            ) : null}
          </ul>
        </nav>
      ) : null}
    </section>
  );
}
