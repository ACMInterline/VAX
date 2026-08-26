import { InvoiceSummaryList } from "@/components/finance/read-cards";
import { financeContent } from "@/content/finance";
import {
  createFinancePageService,
  requireCustomerFinancePageContext,
} from "../invoices/_lib/finance-page";

export const dynamic = "force-dynamic";

export default async function MyInvoicesPage() {
  const { actor, locale } = await requireCustomerFinancePageContext();
  const invoices = await createFinancePageService().listMyInvoices(actor);
  const content = financeContent[locale];

  return (
    <section
      className="crm-page crm-page--self"
      aria-labelledby="my-invoices-heading"
    >
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.customer.eyebrow}</p>
          <h1 id="my-invoices-heading">{content.customer.listTitle}</h1>
          <p>{content.customer.listIntro}</p>
        </div>
      </header>
      <p className="crm-form__notice">{content.customer.issuedOnlyNotice}</p>
      {invoices.length === 0 ? (
        <div className="crm-empty-state">
          <h2>{content.customer.emptyTitle}</h2>
          <p>{content.customer.emptyText}</p>
        </div>
      ) : (
        <InvoiceSummaryList
          invoices={invoices}
          locale={locale}
          content={content}
          basePath="/app/my-invoices"
        />
      )}
    </section>
  );
}
