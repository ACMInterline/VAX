import { randomUUID } from "node:crypto";
import Link from "next/link";
import { InvoiceDocument } from "@/components/finance/read-cards";
import {
  InvoiceLifecycleForms,
  RecordPaymentForm,
} from "@/components/finance/mutation-forms";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { PrintQuoteButton } from "@/components/request-quote/print-quote-button";
import { financeContent } from "@/content/finance";
import {
  createFinancePageService,
  loadStaffInvoiceOrNotFound,
  parseInvoiceRouteParams,
  requireStaffFinancePageContext,
  type InvoiceRouteParams,
} from "../_lib/finance-page";
import {
  cancelDraftInvoiceAction,
  issueInvoiceAction,
  recordPaymentAction,
} from "../actions";

export const dynamic = "force-dynamic";

function snapshot(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<InvoiceRouteParams>;
}) {
  const { actor, locale } = await requireStaffFinancePageContext();
  const { invoiceReference } = await parseInvoiceRouteParams(params);
  const invoice = await loadStaffInvoiceOrNotFound(
    createFinancePageService(),
    actor,
    invoiceReference,
  );
  const content = financeContent[locale];
  const dateTime = new Intl.DateTimeFormat(
    locale === "bg" ? "bg-BG" : "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Sofia",
    },
  );

  return (
    <article className="crm-page" aria-labelledby="invoice-detail-heading">
      <Link className="crm-back-link" href="/app/invoices">
        {content.common.back}
      </Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.staff.eyebrow}</p>
          <h1 id="invoice-detail-heading">
            {content.staff.detailTitle(
              invoice.invoiceNumber ?? invoice.invoiceReference,
            )}
          </h1>
        </div>
        <div className="crm-page__actions">
          <ApplicationStatusBadge
            label={content.labels.invoiceStatuses[invoice.status]}
          />
          <PrintQuoteButton label={content.common.print} />
        </div>
      </header>
      <InvoiceDocument invoice={invoice} locale={locale} content={content} />
      <InvoiceLifecycleForms
        cancelAction={cancelDraftInvoiceAction}
        issueAllowed={
          invoice.status === "READY_TO_ISSUE" ||
          (invoice.status === "DRAFT" &&
            invoice.reviewReasonCodes.length === 1 &&
            invoice.reviewReasonCodes[0] === "JOB_COMPLETION_REQUIRED")
        }
        invoiceReference={invoice.invoiceReference}
        issueAction={issueInvoiceAction}
        locale={locale}
        status={invoice.status}
        version={invoice.version}
      />
      {[
        "ISSUED",
        "PARTIALLY_PAID",
        "PAID",
        "OVERDUE",
      ].includes(invoice.status) ? (
        <RecordPaymentForm
          action={recordPaymentAction}
          idempotencyKey={randomUUID()}
          invoiceReference={invoice.invoiceReference}
          locale={locale}
          receivedAt={new Date().toISOString()}
        />
      ) : null}
      <section
        className="crm-management-card"
        data-print-hidden="true"
        aria-labelledby="finance-review-heading"
      >
        <h2 id="finance-review-heading">{content.staff.reviewReasons}</h2>
        {invoice.reviewReasonCodes.length > 0 ? (
          <ul>
            {invoice.reviewReasonCodes.map((reason) => (
              <li key={reason}>{content.labels.reviewReasons[reason]}</li>
            ))}
          </ul>
        ) : (
          <p>{content.common.noValue}</p>
        )}
        <dl className="crm-card__details">
          <div>
            <dt>{content.staff.eligibility}</dt>
            <dd>{content.labels.eligibilityModes[invoice.eligibilityMode]}</dd>
          </div>
          <div>
            <dt>{content.staff.relatedJob}</dt>
            <dd>{invoice.jobReference ?? content.common.noValue}</dd>
          </div>
        </dl>
      </section>
      <section
        className="crm-management-card"
        data-print-hidden="true"
        aria-labelledby="finance-provenance-heading"
      >
        <h2 id="finance-provenance-heading">{content.staff.provenance}</h2>
        <pre>{snapshot(invoice.provenanceSnapshot)}</pre>
        <details>
          <summary>{content.staff.provenance}</summary>
          <pre>{snapshot(invoice.commercialSnapshot)}</pre>
        </details>
      </section>
      <section
        className="crm-management-card"
        data-print-hidden="true"
        aria-labelledby="finance-internal-heading"
      >
        <h2 id="finance-internal-heading">{content.staff.internalNote}</h2>
        <p>{invoice.internalNote ?? content.common.noValue}</p>
      </section>
      <section
        className="crm-management-card"
        data-print-hidden="true"
        aria-labelledby="finance-audit-heading"
      >
        <h2 id="finance-audit-heading">{content.staff.auditTimeline}</h2>
        {invoice.auditTimeline.length > 0 ? (
          <ol>
            {invoice.auditTimeline.map((event, index) => (
              <li key={`${new Date(event.createdAt).toISOString()}:${index}`}>
                <strong>{event.eventType}</strong>
                <span> · {event.source}</span>
                <time dateTime={new Date(event.createdAt).toISOString()}>
                  {` · ${dateTime.format(new Date(event.createdAt))}`}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p>{content.common.noValue}</p>
        )}
      </section>
    </article>
  );
}
