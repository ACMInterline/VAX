import Link from "next/link";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { requestQuoteContent } from "@/content/request-quote";
import {
  createRequestQuotePageService,
  loadCustomerRequestOrNotFound,
  parseCustomerRequestRouteParams,
  requireCustomerRequestReadPageContext,
  type CustomerRequestRouteParams,
} from "../../requests/_lib/request-page";

export const dynamic = "force-dynamic";

export default async function MyRequestDetailPage({
  params,
}: {
  params: Promise<CustomerRequestRouteParams>;
}) {
  const { actor, locale } = await requireCustomerRequestReadPageContext();
  const { requestReference } = await parseCustomerRequestRouteParams(params);
  const request = await loadCustomerRequestOrNotFound(
    createRequestQuotePageService(),
    actor,
    requestReference,
  );
  const content = requestQuoteContent[locale];
  const formatter = new Intl.DateTimeFormat(
    locale === "bg" ? "bg-BG" : "en-GB",
    { dateStyle: "long" },
  );

  return (
    <section className="crm-page crm-page--self" aria-labelledby="my-request-detail-heading">
      <Link className="crm-back-link" href="/app/my-requests">
        {content.common.back}
      </Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{request.requestReference}</p>
          <h1 id="my-request-detail-heading">{content.detail.title(request.requestReference)}</h1>
        </div>
        <ApplicationStatusBadge label={content.labels.requestStatuses[request.status]} />
      </header>
      <article className="crm-card">
        <dl className="crm-card__details">
          <div><dt>{content.self.received}</dt><dd>{formatter.format(request.submittedAt)}</dd></div>
          <div><dt>{content.detail.preferredTiming}</dt><dd>{request.preferredDate ?? content.common.noValue}{request.preferredWindowCode ? ` · ${request.preferredWindowCode}` : ""}</dd></div>
          <div><dt>{content.detail.customerNotes}</dt><dd>{request.customerNotes ?? content.common.noValue}</dd></div>
        </dl>
      </article>
      <section className="crm-management-card" aria-labelledby="my-request-items-heading">
        <h2 id="my-request-items-heading">{content.detail.original}</h2>
        {request.items.length === 0 ? <p>{content.detail.noItems}</p> : (
          <ol>
            {request.items.map((item, index) => (
              <li key={`${item.sortOrder}-${index}`}>
                <strong>{item.customerDescription}</strong>
                <span> · {locale === "bg" ? "Количество" : "Quantity"}: {item.quantity}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      {request.quoteReferences.length > 0 ? (
        <section className="crm-management-card" aria-labelledby="my-request-quotes-heading">
          <h2 id="my-request-quotes-heading">{content.detail.quotes}</h2>
          <ul className="crm-record-actions">
            {request.quoteReferences.map((reference) => (
              <li key={reference}>
                <span>{reference}</span>
                <Link className="crm-button" href={`/app/my-quotes/${reference}`}>{content.common.open}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
