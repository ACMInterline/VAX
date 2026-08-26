import Link from "next/link";
import { InvoiceSummaryList } from "@/components/finance/read-cards";
import { financeContent } from "@/content/finance";
import { invoiceStoredStatuses } from "@/modules/finance-invoicing/types";
import {
  createFinancePageService,
  parseStaffInvoiceSearchParams,
  requireStaffFinancePageContext,
  type FinanceSearchParams,
} from "./_lib/finance-page";

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
  return suffix ? `/app/invoices?${suffix}` : "/app/invoices";
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<FinanceSearchParams>;
}) {
  const { actor, locale } = await requireStaffFinancePageContext();
  const parsed = await parseStaffInvoiceSearchParams(searchParams);
  const result = await createFinancePageService().listInvoices(
    actor,
    parsed.filters,
  );
  const content = financeContent[locale];
  const filterValues = {
    search: parsed.searchValue,
    status: parsed.statusValue,
  };
  const hasPrevious = parsed.page > 1;
  const hasNext = result.offset + result.items.length < result.total;

  return (
    <section className="crm-page" aria-labelledby="invoices-heading">
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.staff.eyebrow}</p>
          <h1 id="invoices-heading">{content.staff.listTitle}</h1>
          <p>{content.staff.listIntro}</p>
        </div>
        <Link className="crm-back-link" href="/app/finance">
          {content.common.back}
        </Link>
      </header>
      <form className="crm-filter-bar" method="get" action="/app/invoices">
        <div className="crm-form__field">
          <label htmlFor="invoice-search">{content.staff.search}</label>
          <input
            id="invoice-search"
            name="search"
            type="search"
            maxLength={160}
            defaultValue={filterValues.search}
          />
        </div>
        <div className="crm-form__field">
          <label htmlFor="invoice-status">{content.staff.status}</label>
          <select
            id="invoice-status"
            name="status"
            defaultValue={filterValues.status ?? ""}
          >
            <option value="">{content.common.all}</option>
            {[...invoiceStoredStatuses, "OVERDUE" as const].map((status) => (
              <option key={status} value={status}>
                {content.labels.invoiceStatuses[status]}
              </option>
            ))}
          </select>
        </div>
        <div className="crm-form__actions">
          <button className="crm-form__submit" type="submit">
            {content.common.apply}
          </button>
          <Link className="crm-button" href="/app/invoices">
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
        <InvoiceSummaryList
          invoices={result.items}
          locale={locale}
          content={content}
          basePath="/app/invoices"
        />
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
