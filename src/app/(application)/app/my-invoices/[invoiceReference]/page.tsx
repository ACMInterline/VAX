import Link from "next/link";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { InvoiceDocument } from "@/components/finance/read-cards";
import { PrintQuoteButton } from "@/components/request-quote/print-quote-button";
import { financeContent } from "@/content/finance";
import {
  createFinancePageService,
  loadCustomerInvoiceOrNotFound,
  parseInvoiceRouteParams,
  requireCustomerFinancePageContext,
  type InvoiceRouteParams,
} from "../../invoices/_lib/finance-page";

export const dynamic = "force-dynamic";

export default async function MyInvoiceDetailPage({
  params,
}: {
  params: Promise<InvoiceRouteParams>;
}) {
  const { actor, locale } = await requireCustomerFinancePageContext();
  const { invoiceReference } = await parseInvoiceRouteParams(params);
  const invoice = await loadCustomerInvoiceOrNotFound(
    createFinancePageService(),
    actor,
    invoiceReference,
  );
  const content = financeContent[locale];

  return (
    <article
      className="crm-page crm-page--self"
      aria-labelledby="my-invoice-heading"
    >
      <Link className="crm-back-link" href="/app/my-invoices">
        {content.common.back}
      </Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.customer.eyebrow}</p>
          <h1 id="my-invoice-heading">
            {content.customer.detailTitle(
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
      <p className="crm-form__notice">{content.customer.issuedOnlyNotice}</p>
      <InvoiceDocument invoice={invoice} locale={locale} content={content} />
    </article>
  );
}
