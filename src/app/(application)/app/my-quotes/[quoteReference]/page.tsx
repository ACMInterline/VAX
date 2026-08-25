import Link from "next/link";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { CustomerQuoteAcceptanceForm } from "@/components/booking/booking-forms";
import { PrintQuoteButton } from "@/components/request-quote/print-quote-button";
import { bookingContent } from "@/content/booking";
import { requestQuoteContent } from "@/content/request-quote";
import type { JsonObject } from "@/modules/request-quote/types";
import { acceptMyQuoteAction } from "../../bookings/actions";
import { createBookingPageService } from "../../bookings/_lib/booking-page";
import {
  createRequestQuotePageService,
  loadCustomerQuoteOrNotFound,
  parseCustomerQuoteRouteParams,
  requireCustomerRequestReadPageContext,
  type CustomerQuoteRouteParams,
} from "../../requests/_lib/request-page";

export const dynamic = "force-dynamic";

function object(value: unknown): Readonly<Record<string, unknown>> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function customerTerms(snapshot: JsonObject, locale: "bg" | "en"): readonly string[] {
  const statements = object(object(snapshot)?.statements);
  const localized = object(statements?.[locale]);
  const controlled = [
    localized?.inspection,
    localized?.parkingTravel,
    localized?.stainRemoval,
    localized?.dryingReuse,
    localized?.addons,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  const additional = object(snapshot)?.additionalAssumptions;
  return typeof additional === "string" && additional.trim()
    ? [...controlled, additional]
    : controlled;
}

export default async function MyQuoteDetailPage({
  params,
}: {
  params: Promise<CustomerQuoteRouteParams>;
}) {
  const { actor, locale } = await requireCustomerRequestReadPageContext();
  const { quoteReference } = await parseCustomerQuoteRouteParams(params);
  const [quote, acceptance] = await Promise.all([
    loadCustomerQuoteOrNotFound(
      createRequestQuotePageService(),
      actor,
      quoteReference,
    ),
    createBookingPageService().previewMyQuoteAcceptance(actor, {
      quoteReference,
    }),
  ]);
  const content = requestQuoteContent[locale];
  const bookingCopy = bookingContent[locale];
  const money = new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-IE", {
    style: "currency",
    currency: "EUR",
  });
  const formatter = new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    dateStyle: "long",
  });
  const terms = customerTerms(quote.termsSnapshot, locale);

  return (
    <article className="crm-page crm-page--self" aria-labelledby="quote-heading">
      <Link className="crm-back-link" href="/app/my-quotes">{content.common.back}</Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.self.historyNotice}</p>
          <h1 id="quote-heading">{content.self.quoteTitle(quote.quoteReference)}</h1>
          <p>{content.self.printable}</p>
        </div>
        <div className="crm-page__actions">
          <ApplicationStatusBadge label={content.labels.quoteStatuses[quote.status]} />
          <PrintQuoteButton label={locale === "bg" ? "Печат" : "Print"} />
        </div>
      </header>
      <section className="crm-card" aria-labelledby="quote-summary-heading">
        <h2 id="quote-summary-heading">{content.self.total}</h2>
        <dl className="crm-card__details">
          <div><dt>{content.self.total}</dt><dd>{money.format(quote.grossTotalMinorUnits / 100)}</dd></div>
          <div><dt>{content.self.issued}</dt><dd>{formatter.format(quote.issuedAt)}</dd></div>
          <div><dt>{content.self.validUntil}</dt><dd>{formatter.format(quote.validUntil)}</dd></div>
          <div><dt>{content.self.duration}</dt><dd>{quote.estimatedDurationMinutes === null ? content.common.noValue : `${quote.estimatedDurationMinutes} min`}</dd></div>
        </dl>
      </section>
      <section className="crm-management-card" aria-labelledby="quote-lines-heading">
        <h2 id="quote-lines-heading">{content.detail.normalized}</h2>
        <ol>
          {quote.items.map((item, index) => (
            <li key={`${item.sortOrder}-${index}`}>
              <strong>{locale === "bg" ? item.descriptionBg : item.descriptionEn}</strong>
              <span> · {item.quantity} · {money.format(item.grossTotalMinorUnits / 100)}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="crm-management-card" aria-labelledby="quote-terms-heading">
        <h2 id="quote-terms-heading">{content.self.terms}</h2>
        {terms.length === 0 ? <p>{content.common.noValue}</p> : (
          <ul>{terms.map((term) => <li key={term}>{term}</li>)}</ul>
        )}
        {quote.customerNotes ? <p>{quote.customerNotes}</p> : null}
      </section>
      {acceptance.state === "ELIGIBLE" ? (
        <CustomerQuoteAcceptanceForm
          action={acceptMyQuoteAction}
          expectedQuoteVersion={quote.quoteVersion}
          locale={locale}
          quoteReference={quote.quoteReference}
        />
      ) : acceptance.state === "EXISTING" && acceptance.bookingReference ? (
        <section className="crm-management-card" aria-labelledby="accepted-booking-heading">
          <h2 id="accepted-booking-heading">
            {bookingCopy.acceptance.existing}
          </h2>
          <Link
            className="crm-button"
            href={`/app/my-bookings/${acceptance.bookingReference}`}
          >
            {acceptance.bookingReference}
          </Link>
        </section>
      ) : (
        <p className="crm-form__notice">
          {bookingCopy.acceptance.reviewRequired}
        </p>
      )}
    </article>
  );
}
