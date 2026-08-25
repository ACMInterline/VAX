import Link from "next/link";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { requestQuoteContent } from "@/content/request-quote";
import {
  createRequestQuotePageService,
  requireCustomerRequestReadPageContext,
} from "../requests/_lib/request-page";

export const dynamic = "force-dynamic";

export default async function MyQuotesPage() {
  const { actor, locale } = await requireCustomerRequestReadPageContext();
  const quotes = await createRequestQuotePageService().listMyQuotes(actor);
  const content = requestQuoteContent[locale];
  const money = new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-IE", {
    style: "currency",
    currency: "EUR",
  });
  const formatter = new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    dateStyle: "medium",
  });

  return (
    <section className="crm-page crm-page--self" aria-labelledby="my-quotes-heading">
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.inbox.eyebrow}</p>
          <h1 id="my-quotes-heading">{content.self.quotesTitle}</h1>
        </div>
      </header>
      {quotes.length === 0 ? (
        <div className="crm-empty-state"><p>{content.self.noQuotes}</p></div>
      ) : (
        <ul className="crm-customer-list">
          {quotes.map((quote) => (
            <li key={quote.quoteReference}>
              <article className="crm-summary-card">
                <header className="crm-summary-card__header">
                  <h2>{quote.quoteReference}</h2>
                  <ApplicationStatusBadge label={content.labels.quoteStatuses[quote.status]} />
                </header>
                <dl className="crm-card__details">
                  <div><dt>{content.self.total}</dt><dd>{money.format(quote.grossTotalMinorUnits / 100)}</dd></div>
                  <div><dt>{content.self.issued}</dt><dd>{formatter.format(quote.issuedAt)}</dd></div>
                  <div><dt>{content.self.validUntil}</dt><dd>{formatter.format(quote.validUntil)}</dd></div>
                </dl>
                <Link className="crm-button" href={`/app/my-quotes/${quote.quoteReference}`}>
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
