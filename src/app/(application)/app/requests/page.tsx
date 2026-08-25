import Link from "next/link";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { requestQuoteContent } from "@/content/request-quote";
import {
  customerResolutionStatuses,
  requestSources,
  requestStatuses,
  type RequestStatus,
} from "@/modules/request-quote/types";
import {
  createRequestQuotePageService,
  parseStaffRequestSearchParams,
  requireStaffRequestReadPageContext,
  type RequestSearchParams,
} from "./_lib/request-page";

export const dynamic = "force-dynamic";

function statusTone(status: RequestStatus) {
  if (status === "CLOSED") return "positive" as const;
  if (status === "DECLINED") return "muted" as const;
  if (status === "NEEDS_REVIEW") return "warning" as const;
  return "neutral" as const;
}

function filterDate(value: Date | undefined, inclusiveEnd = false): string {
  if (!value) return "";
  const instant = inclusiveEnd
    ? new Date(value.valueOf() - 24 * 60 * 60 * 1_000)
    : value;
  return instant.toISOString().slice(0, 10);
}

function pageHref(
  filters: Awaited<ReturnType<typeof parseStaffRequestSearchParams>>["filters"],
  page: number,
): string {
  const query = new URLSearchParams();
  if (filters.search) query.set("search", filters.search);
  if (filters.status) query.set("status", filters.status);
  if (filters.source) query.set("source", filters.source);
  if (filters.resolutionStatus) {
    query.set("resolutionStatus", filters.resolutionStatus);
  }
  if (filters.manualReviewRequired !== undefined) {
    query.set(
      "manualReview",
      filters.manualReviewRequired ? "required" : "not-required",
    );
  }
  if (filters.submittedFrom) {
    query.set("submittedFrom", filterDate(filters.submittedFrom));
  }
  if (filters.submittedTo) {
    query.set("submittedTo", filterDate(filters.submittedTo, true));
  }
  query.set("page", String(page));
  return `/app/requests?${query.toString()}`;
}

export default async function StaffRequestInboxPage({
  searchParams,
}: {
  searchParams: Promise<RequestSearchParams>;
}) {
  const { actor, locale } = await requireStaffRequestReadPageContext();
  const { filters, page, submittedFromValue, submittedToValue } =
    await parseStaffRequestSearchParams(searchParams);
  const requests = await createRequestQuotePageService().listRequests(
    actor,
    filters,
  );
  const content = requestQuoteContent[locale];
  const requestReferenceSearchLabel =
    locale === "bg" ? "Референция на заявка" : "Request reference";
  const canManage =
    actor.permissions.has("CUSTOMER_RECORDS_MANAGE") &&
    actor.permissions.has("OPERATIONS_MANAGE");
  const lastPage = Math.max(1, Math.ceil(requests.total / requests.limit));
  const formatter = new Intl.DateTimeFormat(
    locale === "bg" ? "bg-BG" : "en-GB",
    { dateStyle: "medium", timeStyle: "short" },
  );

  return (
    <section className="crm-page" aria-labelledby="request-inbox-heading">
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.inbox.eyebrow}</p>
          <h1 id="request-inbox-heading">{content.inbox.title}</h1>
          <p>{content.inbox.intro}</p>
        </div>
        {canManage ? (
          <Link className="crm-button crm-button--primary" href="/app/requests/new">
            {content.inbox.create}
          </Link>
        ) : null}
      </header>

      <form className="crm-filters" method="get" role="search">
        <label className="crm-filters__search">
          <span>{requestReferenceSearchLabel}</span>
          <input
            defaultValue={filters.search}
            maxLength={160}
            name="search"
            placeholder={requestReferenceSearchLabel}
            type="search"
          />
        </label>
        <label>
          <span>{content.inbox.status}</span>
          <select defaultValue={filters.status ?? ""} name="status">
            <option value="">{content.inbox.all}</option>
            {requestStatuses.map((status) => (
              <option key={status} value={status}>
                {content.labels.requestStatuses[status]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{content.inbox.source}</span>
          <select defaultValue={filters.source ?? ""} name="source">
            <option value="">{content.inbox.all}</option>
            {requestSources.map((source) => (
              <option key={source} value={source}>
                {content.labels.requestSources[source]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{content.inbox.resolution}</span>
          <select
            defaultValue={filters.resolutionStatus ?? ""}
            name="resolutionStatus"
          >
            <option value="">{content.inbox.all}</option>
            {customerResolutionStatuses.map((status) => (
              <option key={status} value={status}>
                {content.labels.resolutionStatuses[status]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{content.inbox.manualReview}</span>
          <select
            defaultValue={
              filters.manualReviewRequired === undefined
                ? ""
                : filters.manualReviewRequired
                  ? "required"
                  : "not-required"
            }
            name="manualReview"
          >
            <option value="">{content.inbox.all}</option>
            <option value="required">
              {locale === "bg" ? "Изисква се" : "Required"}
            </option>
            <option value="not-required">
              {locale === "bg" ? "Не се изисква" : "Not required"}
            </option>
          </select>
        </label>
        <label>
          <span>{locale === "bg" ? "Подадена от" : "Submitted from"}</span>
          <input
            defaultValue={submittedFromValue}
            name="submittedFrom"
            type="date"
          />
        </label>
        <label>
          <span>{locale === "bg" ? "Подадена до" : "Submitted to"}</span>
          <input
            defaultValue={submittedToValue}
            name="submittedTo"
            type="date"
          />
        </label>
        <div className="crm-filters__actions">
          <button className="crm-button crm-button--primary" type="submit">
            {content.inbox.apply}
          </button>
          <Link className="crm-button" href="/app/requests">
            {content.inbox.clear}
          </Link>
        </div>
      </form>

      <p className="crm-page__summary" aria-live="polite">
        {locale === "bg"
          ? `Страница ${page} · ${requests.total} заявки`
          : `Page ${page} · ${requests.total} requests`}
      </p>

      {requests.items.length === 0 ? (
        <div className="crm-empty-state"><p>{content.inbox.empty}</p></div>
      ) : (
        <ul className="crm-customer-list">
          {requests.items.map((request) => (
            <li key={request.id}>
              <article className="crm-summary-card">
                <header className="crm-summary-card__header">
                  <div>
                    <p className="crm-card__eyebrow">
                      {content.labels.requestSources[request.source]}
                    </p>
                    <h2>{request.requestReference}</h2>
                  </div>
                  <ApplicationStatusBadge
                    label={content.labels.requestStatuses[request.status]}
                    tone={statusTone(request.status)}
                  />
                </header>
                <dl className="crm-card__details">
                  <div><dt>{content.detail.contact}</dt><dd>{request.contactName}</dd></div>
                  <div><dt>{content.inbox.resolution}</dt><dd>{content.labels.resolutionStatuses[request.customerResolutionStatus]}</dd></div>
                  <div><dt>{content.self.received}</dt><dd>{formatter.format(request.submittedAt)}</dd></div>
                  <div><dt>{content.inbox.manualReview}</dt><dd>{request.manualReviewRequired ? (locale === "bg" ? "Да" : "Yes") : (locale === "bg" ? "Не" : "No")}</dd></div>
                </dl>
                <Link className="crm-button" href={`/app/requests/${request.id}`}>
                  {content.common.open}
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}

      {requests.total > requests.limit ? (
        <nav className="crm-pagination" aria-label={content.inbox.title}>
          {page > 1 ? (
            <Link href={pageHref(filters, page - 1)}>
              {locale === "bg" ? "Предишна" : "Previous"}
            </Link>
          ) : <span />}
          {page < lastPage ? (
            <Link href={pageHref(filters, page + 1)}>
              {locale === "bg" ? "Следваща" : "Next"}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
