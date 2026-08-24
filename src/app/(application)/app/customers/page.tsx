import Link from "next/link";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { crmContent } from "@/content/crm";
import {
  customerRecordStatuses,
  customerTypes,
  type CustomerRecordStatus,
} from "@/modules/customer-crm/types";
import {
  createCustomerCrmPageService,
  parseCustomerSearchParams,
  requireStaffCrmReadPageContext,
  type CrmSearchParams,
} from "./_lib/crm-page";

export const dynamic = "force-dynamic";

function statusTone(status: CustomerRecordStatus) {
  if (status === "ACTIVE") return "positive" as const;
  if (status === "INACTIVE") return "warning" as const;
  return "muted" as const;
}
function pageHref(
  filters: {
    search?: string;
    status?: string;
    customerType?: string;
  },
  page: number,
): string {
  const query = new URLSearchParams();
  if (filters.search) query.set("search", filters.search);
  if (filters.status) query.set("status", filters.status);
  if (filters.customerType) query.set("customerType", filters.customerType);
  query.set("page", String(page));
  return `/app/customers?${query.toString()}`;
}

export default async function CustomerListPage({
  searchParams,
}: {
  searchParams: Promise<CrmSearchParams>;
}) {
  const { actor, locale } = await requireStaffCrmReadPageContext();
  const { filters, page } = await parseCustomerSearchParams(searchParams);
  const service = createCustomerCrmPageService();
  const customers = await service.listCustomers(actor, filters);
  const content = crmContent[locale];
  const canManage = actor.permissions.has("CUSTOMER_RECORDS_MANAGE");
  const lastPage = Math.max(1, Math.ceil(customers.total / customers.limit));
  const hasFilters = Boolean(
    filters.search || filters.status || filters.customerType,
  );

  return (
    <section className="crm-page" aria-labelledby="crm-customers-title">
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.list.eyebrow}</p>
          <h1 id="crm-customers-title">{content.list.title}</h1>
          <p>{content.list.intro}</p>
        </div>
        {canManage ? (
          <Link className="crm-button crm-button--primary" href="/app/customers/new">
            {content.list.createCustomer}
          </Link>
        ) : null}
      </header>

      <form className="crm-filters" method="get" role="search">
        <label className="crm-filters__search">
          <span>{content.list.search}</span>
          <input
            defaultValue={filters.search}
            maxLength={160}
            name="search"
            placeholder={content.list.searchPlaceholder}
            type="search"
          />
        </label>
        <label>
          <span>{content.list.status}</span>
          <select defaultValue={filters.status ?? ""} name="status">
            <option value="">{content.list.all}</option>
            {customerRecordStatuses.map((status) => (
              <option key={status} value={status}>
                {content.labels.lifecycleStatuses[status]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{content.list.customerType}</span>
          <select defaultValue={filters.customerType ?? ""} name="customerType">
            <option value="">{content.list.all}</option>
            {customerTypes.map((customerType) => (
              <option key={customerType} value={customerType}>
                {content.labels.customerTypes[customerType]}
              </option>
            ))}
          </select>
        </label>
        <div className="crm-filters__actions">
          <button className="crm-button crm-button--primary" type="submit">
            {content.list.apply}
          </button>
          <Link className="crm-button" href="/app/customers">
            {content.list.clear}
          </Link>
        </div>
      </form>

      <p className="crm-page__summary" aria-live="polite">
        {content.list.pageSummary(page, customers.total)}
      </p>

      {customers.items.length === 0 ? (
        <div className="crm-empty-state">
          <p>{hasFilters ? content.list.emptyFiltered : content.list.empty}</p>
        </div>
      ) : (
        <ul className="crm-customer-list">
          {customers.items.map((customer) => (
            <li key={customer.id}>
              <article className="crm-summary-card">
                <header className="crm-summary-card__header">
                  <div>
                    <p className="crm-card__eyebrow">
                      {content.labels.customerTypes[customer.customerType]}
                    </p>
                    <h2>{customer.displayName}</h2>
                  </div>
                  <ApplicationStatusBadge
                    label={content.labels.lifecycleStatuses[customer.status]}
                    tone={statusTone(customer.status)}
                  />
                </header>
                <dl className="crm-card__details">
                  <div>
                    <dt>{content.detail.primaryEmail}</dt>
                    <dd>{customer.primaryEmail ?? content.common.noValue}</dd>
                  </div>
                  <div>
                    <dt>{content.detail.primaryPhone}</dt>
                    <dd>{customer.primaryPhone ?? content.common.noValue}</dd>
                  </div>
                </dl>
                <Link
                  className="crm-button"
                  href={`/app/customers/${customer.id}`}
                >
                  {content.list.open}
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}

      {customers.total > customers.limit ? (
        <nav className="crm-pagination" aria-label={content.list.pageSummary(page, customers.total)}>
          {page > 1 ? (
            <Link href={pageHref(filters, page - 1)}>{content.list.previous}</Link>
          ) : (
            <span />
          )}
          {page < lastPage ? (
            <Link href={pageHref(filters, page + 1)}>{content.list.next}</Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
