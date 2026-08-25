import Link from "next/link";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { requestQuoteContent } from "@/content/request-quote";
import {
  createRequestQuotePageService,
  requireCustomerRequestReadPageContext,
} from "../requests/_lib/request-page";

export const dynamic = "force-dynamic";

export default async function MyRequestsPage() {
  const { actor, locale } = await requireCustomerRequestReadPageContext();
  const requests = await createRequestQuotePageService().listMyRequests(actor);
  const content = requestQuoteContent[locale];
  const formatter = new Intl.DateTimeFormat(
    locale === "bg" ? "bg-BG" : "en-GB",
    { dateStyle: "medium" },
  );
  const canCreate = actor.permissions.has("OWN_CUSTOMER_DATA_UPDATE");

  return (
    <section className="crm-page crm-page--self" aria-labelledby="my-requests-heading">
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.inbox.eyebrow}</p>
          <h1 id="my-requests-heading">{content.self.requestsTitle}</h1>
          <p>{content.self.requestsIntro}</p>
        </div>
        {canCreate ? (
          <Link className="crm-button crm-button--primary" href="/app/my-requests/new">
            {content.self.createRequest}
          </Link>
        ) : null}
      </header>
      {requests.length === 0 ? (
        <div className="crm-empty-state"><p>{content.self.noRequests}</p></div>
      ) : (
        <ul className="crm-customer-list">
          {requests.map((request) => (
            <li key={request.requestReference}>
              <article className="crm-summary-card">
                <header className="crm-summary-card__header">
                  <h2>{request.requestReference}</h2>
                  <ApplicationStatusBadge
                    label={content.labels.requestStatuses[request.status]}
                    tone={request.status === "NEEDS_REVIEW" ? "warning" : "neutral"}
                  />
                </header>
                <dl className="crm-card__details">
                  <div><dt>{content.self.received}</dt><dd>{formatter.format(request.submittedAt)}</dd></div>
                  <div><dt>{content.detail.preferredTiming}</dt><dd>{request.preferredDate ?? content.common.noValue}</dd></div>
                </dl>
                <Link className="crm-button" href={`/app/my-requests/${request.requestReference}`}>
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
