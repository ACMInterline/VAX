import Link from "next/link";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { PrintQuoteButton } from "@/components/request-quote/print-quote-button";
import {
  communicationsContent,
  type CommunicationsCopy,
} from "@/content/communications";
import type {
  CustomerDocumentDetail,
  CustomerHistorySummary,
  StaffCommunicationSummary,
} from "@/modules/communications-documents/types";

function dateTime(value: Date, locale: "bg" | "en") {
  return new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Sofia",
  }).format(new Date(value));
}

function money(value: number, locale: "bg" | "en") {
  return new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(value / 100);
}

export function StaffCommunicationList({
  communications,
  content,
  locale,
}: {
  communications: readonly StaffCommunicationSummary[];
  content: CommunicationsCopy;
  locale: "bg" | "en";
}) {
  return (
    <ul className="crm-customer-list">
      {communications.map((item) => (
        <li key={item.communicationReference}>
          <article className="crm-summary-card">
            <header className="crm-summary-card__header">
              <div>
                <p className="crm-card__eyebrow">{content.events[item.eventType]}</p>
                <h2>{item.title ?? item.communicationReference}</h2>
              </div>
              <ApplicationStatusBadge label={content.statuses[item.status]} />
            </header>
            <dl className="crm-card__details">
              <div><dt>{content.common.source}</dt><dd>{item.sourceReference}</dd></div>
              <div><dt>{content.common.channel}</dt><dd>{content.channels[item.channel]}</dd></div>
              <div><dt>{content.common.locale}</dt><dd>{item.locale.toUpperCase()}</dd></div>
              <div><dt>{content.common.created}</dt><dd><time dateTime={new Date(item.createdAt).toISOString()}>{dateTime(item.createdAt, locale)}</time></dd></div>
            </dl>
            <Link className="crm-button" href={`/app/communications/${item.communicationReference}`}>
              {content.common.open}
            </Link>
          </article>
        </li>
      ))}
    </ul>
  );
}

export function CustomerCommunicationList({
  entries,
  content,
  locale,
}: {
  entries: readonly CustomerHistorySummary[];
  content: CommunicationsCopy;
  locale: "bg" | "en";
}) {
  return (
    <ul className="crm-customer-list">
      {entries.map((entry) => (
        <li key={entry.historyReference}>
          <article className="crm-summary-card">
            <header className="crm-summary-card__header">
              <div>
                <p className="crm-card__eyebrow">{content.documents[entry.documentType]}</p>
                <h2>{entry.title}</h2>
              </div>
              <ApplicationStatusBadge
                label={
                  entry.superseded
                    ? locale === "bg"
                      ? "Заменен документ"
                      : "Superseded document"
                    : content.statuses.DELIVERED_LOCAL
                }
              />
            </header>
            <p><time dateTime={new Date(entry.visibleAt).toISOString()}>{dateTime(entry.visibleAt, locale)}</time></p>
            <Link className="crm-button" href={`/app/my-documents/${entry.documentReference}`}>
              {content.common.open}
            </Link>
          </article>
        </li>
      ))}
    </ul>
  );
}

export function ImmutableDocumentView({
  document,
}: {
  document: CustomerDocumentDetail;
}) {
  const snapshot = document.content;
  const locale = document.locale;
  const content = communicationsContent[locale];
  return (
    <article
      className="crm-card-grid"
      data-print-document="communication"
      data-document-reference={document.documentReference}
      lang={document.locale}
      aria-labelledby="immutable-document-title"
    >
      <header className="crm-card crm-card--wide">
        <p className="crm-card__eyebrow">{content.documents[document.documentType]}</p>
        <h2 id="immutable-document-title">{snapshot.title}</h2>
        <p>{snapshot.body}</p>
        <dl className="crm-card__details">
          <div><dt>{content.common.reference}</dt><dd>{document.documentReference}</dd></div>
          <div><dt>{content.common.locale}</dt><dd>{document.locale.toUpperCase()}</dd></div>
          <div><dt>{content.common.created}</dt><dd><time dateTime={new Date(document.finalizedAt).toISOString()}>{dateTime(document.finalizedAt, locale)}</time></dd></div>
        </dl>
        <div data-print-hidden="true">
          <PrintQuoteButton label={content.common.print} />
        </div>
      </header>
      {snapshot.facts.length ? (
        <section className="crm-card" aria-labelledby="document-facts-heading">
          <h2 id="document-facts-heading">{locale === "bg" ? "Данни" : "Details"}</h2>
          <dl className="crm-card__details">
            {snapshot.facts.map((fact) => <div key={fact.key}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
          </dl>
        </section>
      ) : null}
      {snapshot.lineItems.length ? (
        <section className="crm-card crm-card--wide" aria-labelledby="document-items-heading">
          <h2 id="document-items-heading">{locale === "bg" ? "Позиции" : "Items"}</h2>
          <div className="crm-table-wrap">
            <table className="crm-table">
              <caption>{locale === "bg" ? "Позиции в документа" : "Document line items"}</caption>
              <thead><tr><th scope="col">{locale === "bg" ? "Описание" : "Description"}</th><th scope="col">{locale === "bg" ? "Количество" : "Quantity"}</th><th scope="col">{locale === "bg" ? "Сума" : "Amount"}</th></tr></thead>
              <tbody>{snapshot.lineItems.map((item, index) => <tr key={`${item.description}-${item.quantity}-${item.amountMinorUnits ?? "none"}-${index}`}><th scope="row">{item.description}</th><td>{item.quantity}</td><td>{item.amountMinorUnits === undefined ? "—" : money(item.amountMinorUnits, locale)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      ) : null}
      {snapshot.totals ? (
        <section className="crm-card" aria-labelledby="document-totals-heading">
          <h2 id="document-totals-heading">{locale === "bg" ? "Общо" : "Totals"}</h2>
          <p><strong>{money(snapshot.totals.grossAmountMinorUnits, locale)}</strong></p>
        </section>
      ) : null}
      {snapshot.notices.length ? (
        <aside className="crm-card" aria-label={locale === "bg" ? "Бележки" : "Notices"}>
          {snapshot.notices.map((notice) => <p key={notice}>{notice}</p>)}
        </aside>
      ) : null}
    </article>
  );
}
