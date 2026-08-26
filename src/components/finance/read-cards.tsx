import Link from "next/link";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import type { FinanceCopy } from "@/content/finance";
import type {
  CustomerInvoiceDetail,
  InvoiceSummary,
} from "@/modules/finance-invoicing/types";

type Locale = "bg" | "en";

function record(value: unknown): Readonly<Record<string, unknown>> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function text(
  value: Readonly<Record<string, unknown>> | null,
  key: string,
): string | null {
  const candidate = value?.[key];
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : null;
}

function joinedAddress(
  value: Readonly<Record<string, unknown>> | null,
  prefix: "billing" | "registered",
): string | null {
  const parts = [
    text(value, `${prefix}AddressLine1`) ?? text(value, "addressLine1"),
    text(value, `${prefix}AddressLine2`) ?? text(value, "addressLine2"),
    [
      text(value, `${prefix}PostalCode`) ?? text(value, "postalCode"),
      text(value, `${prefix}City`) ?? text(value, "city"),
    ]
      .filter(Boolean)
      .join(" "),
    text(value, `${prefix}CountryCode`) ?? text(value, "countryCode"),
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : null;
}

function paymentInstructions(
  value: unknown,
  locale: Locale,
): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }
  const snapshot = record(value);
  return (
    text(snapshot, locale) ??
    text(snapshot, "customerVisiblePaymentInstructions") ??
    text(snapshot, "instructions") ??
    text(snapshot, "text")
  );
}

function formatters(locale: Locale) {
  const localeCode = locale === "bg" ? "bg-BG" : "en-IE";
  return {
    money: new Intl.NumberFormat(localeCode, {
      style: "currency",
      currency: "EUR",
    }),
    date: new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
      dateStyle: "medium",
      timeZone: "UTC",
    }),
  };
}

function dateOnly(
  value: string | null,
  formatter: Intl.DateTimeFormat,
  fallback: string,
) {
  if (!value) return fallback;
  return formatter.format(new Date(`${value}T00:00:00.000Z`));
}

export function InvoiceSummaryList({
  invoices,
  locale,
  content,
  basePath,
}: {
  invoices: readonly InvoiceSummary[];
  locale: Locale;
  content: FinanceCopy;
  basePath: "/app/invoices" | "/app/my-invoices";
}) {
  const { money, date } = formatters(locale);

  return (
    <ul className="crm-customer-list">
      {invoices.map((invoice) => (
        <li key={invoice.invoiceReference}>
          <article className="crm-summary-card">
            <header className="crm-summary-card__header">
              <div>
                <p className="crm-card__eyebrow">
                  {content.labels.invoiceTypes[invoice.type]}
                </p>
                <h2>{invoice.invoiceNumber ?? invoice.invoiceReference}</h2>
              </div>
              <ApplicationStatusBadge
                label={content.labels.invoiceStatuses[invoice.status]}
              />
            </header>
            <dl className="crm-card__details">
              <div>
                <dt>{content.invoice.customer}</dt>
                <dd>{invoice.customerDisplayName}</dd>
              </div>
              <div>
                <dt>{content.invoice.booking}</dt>
                <dd>{invoice.bookingReference}</dd>
              </div>
              <div>
                <dt>{content.invoice.issueDate}</dt>
                <dd>
                  {dateOnly(invoice.issueDate, date, content.common.noValue)}
                </dd>
              </div>
              <div>
                <dt>{content.invoice.dueDate}</dt>
                <dd>
                  {dateOnly(invoice.dueDate, date, content.common.noValue)}
                </dd>
              </div>
              <div>
                <dt>{content.invoice.totalGross}</dt>
                <dd>{money.format(invoice.grossAmountMinorUnits / 100)}</dd>
              </div>
              <div>
                <dt>{content.invoice.outstanding}</dt>
                <dd>{money.format(invoice.outstandingAmountMinorUnits / 100)}</dd>
              </div>
              <div>
                <dt>{content.invoice.created}</dt>
                <dd>
                  <time dateTime={new Date(invoice.createdAt).toISOString()}>
                    {date.format(new Date(invoice.createdAt))}
                  </time>
                </dd>
              </div>
            </dl>
            <Link
              className="crm-button"
              href={`${basePath}/${invoice.invoiceReference}`}
            >
              {content.common.open}
            </Link>
          </article>
        </li>
      ))}
    </ul>
  );
}

export function InvoiceDocument({
  invoice,
  locale,
  content,
}: {
  invoice: CustomerInvoiceDetail;
  locale: Locale;
  content: FinanceCopy;
}) {
  const customer = record(invoice.customerSnapshot);
  const seller = record(invoice.sellerSnapshot);
  const { money, date } = formatters(locale);
  let totalNet = 0;
  let totalVat = 0;
  for (const item of invoice.items) {
    totalNet += item.netAmountMinorUnits;
    totalVat += item.vatAmountMinorUnits;
  }
  const instructions =
    paymentInstructions(invoice.paymentInstructions, locale) ??
    text(seller, "paymentInstructions");
  const customerName =
    text(customer, "billingName") ?? invoice.customerDisplayName;
  const sellerName = text(seller, "legalName") ?? content.common.noValue;
  const customerAddress = joinedAddress(customer, "billing");
  const sellerAddress = joinedAddress(seller, "registered");

  return (
    <div className="crm-card-grid" data-print-document="invoice">
      <section className="crm-card" aria-labelledby="invoice-parties-heading">
        <h2 id="invoice-parties-heading">{content.invoice.invoice}</h2>
        <dl className="crm-card__details">
          <div>
            <dt>{content.invoice.invoiceNumber}</dt>
            <dd>{invoice.invoiceNumber ?? content.common.noValue}</dd>
          </div>
          <div>
            <dt>{content.invoice.reference}</dt>
            <dd>{invoice.invoiceReference}</dd>
          </div>
          <div>
            <dt>{content.invoice.issueDate}</dt>
            <dd>
              {dateOnly(invoice.issueDate, date, content.common.noValue)}
            </dd>
          </div>
          <div>
            <dt>{content.invoice.dueDate}</dt>
            <dd>
              {dateOnly(invoice.dueDate, date, content.common.noValue)}
            </dd>
          </div>
          <div>
            <dt>{content.invoice.booking}</dt>
            <dd>{invoice.bookingReference}</dd>
          </div>
          <div>
            <dt>{content.invoice.quote}</dt>
            <dd>{invoice.quoteReference}</dd>
          </div>
        </dl>
      </section>

      <section className="crm-card" aria-labelledby="invoice-seller-heading">
        <h2 id="invoice-seller-heading">{content.invoice.seller}</h2>
        <p>
          <strong>{sellerName}</strong>
        </p>
        <dl className="crm-card__details">
          <div>
            <dt>{content.invoice.registrationNumber}</dt>
            <dd>
              {text(seller, "registrationNumber") ?? content.common.noValue}
            </dd>
          </div>
          <div>
            <dt>{content.invoice.vatNumber}</dt>
            <dd>{text(seller, "vatNumber") ?? content.common.noValue}</dd>
          </div>
          <div>
            <dt>{content.invoice.address}</dt>
            <dd>{sellerAddress ?? content.common.noValue}</dd>
          </div>
          <div>
            <dt>{content.invoice.email}</dt>
            <dd>{text(seller, "contactEmail") ?? content.common.noValue}</dd>
          </div>
          <div>
            <dt>{content.invoice.phone}</dt>
            <dd>{text(seller, "contactPhone") ?? content.common.noValue}</dd>
          </div>
        </dl>
      </section>

      <section className="crm-card" aria-labelledby="invoice-customer-heading">
        <h2 id="invoice-customer-heading">{content.invoice.customer}</h2>
        <p>
          <strong>{customerName}</strong>
        </p>
        <dl className="crm-card__details">
          <div>
            <dt>{content.invoice.registrationNumber}</dt>
            <dd>
              {text(customer, "companyRegistrationNumber") ??
                content.common.noValue}
            </dd>
          </div>
          <div>
            <dt>{content.invoice.vatNumber}</dt>
            <dd>{text(customer, "vatNumber") ?? content.common.noValue}</dd>
          </div>
          <div>
            <dt>{content.invoice.address}</dt>
            <dd>{customerAddress ?? content.common.noValue}</dd>
          </div>
          <div>
            <dt>{content.invoice.email}</dt>
            <dd>{text(customer, "billingEmail") ?? content.common.noValue}</dd>
          </div>
        </dl>
      </section>

      <section className="crm-card" aria-labelledby="invoice-items-heading">
        <h2 id="invoice-items-heading">{content.invoice.items}</h2>
        <div>
          <table>
            <caption>{content.invoice.items}</caption>
            <thead>
              <tr>
                <th scope="col">{content.invoice.description}</th>
                <th scope="col">{content.invoice.quantity}</th>
                <th scope="col">{content.invoice.net}</th>
                <th scope="col">{content.invoice.vatRate}</th>
                <th scope="col">{content.invoice.vat}</th>
                <th scope="col">{content.invoice.gross}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={`${item.sortOrder}:${index}`}>
                  <th scope="row">
                    {locale === "bg" ? item.descriptionBg : item.descriptionEn}
                  </th>
                  <td>{item.quantity}</td>
                  <td>{money.format(item.netAmountMinorUnits / 100)}</td>
                  <td>{item.vatRateBasisPoints / 100}%</td>
                  <td>{money.format(item.vatAmountMinorUnits / 100)}</td>
                  <td>{money.format(item.grossAmountMinorUnits / 100)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={2}>
                  {content.invoice.totalNet}
                </th>
                <td colSpan={4}>{money.format(totalNet / 100)}</td>
              </tr>
              <tr>
                <th scope="row" colSpan={2}>
                  {content.invoice.totalVat}
                </th>
                <td colSpan={4}>{money.format(totalVat / 100)}</td>
              </tr>
              <tr>
                <th scope="row" colSpan={2}>
                  {content.invoice.totalGross}
                </th>
                <td colSpan={4}>
                  {money.format(invoice.grossAmountMinorUnits / 100)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="crm-card" aria-labelledby="invoice-payment-heading">
        <h2 id="invoice-payment-heading">{content.invoice.paymentStatus}</h2>
        <dl className="crm-card__details">
          <div>
            <dt>{content.invoice.status}</dt>
            <dd>{content.labels.invoiceStatuses[invoice.status]}</dd>
          </div>
          <div>
            <dt>{content.invoice.paid}</dt>
            <dd>{money.format(invoice.paidAmountMinorUnits / 100)}</dd>
          </div>
          <div>
            <dt>{content.invoice.outstanding}</dt>
            <dd>{money.format(invoice.outstandingAmountMinorUnits / 100)}</dd>
          </div>
        </dl>
        {instructions ? (
          <>
            <h3>{content.invoice.paymentInstructions}</h3>
            <p>{instructions}</p>
          </>
        ) : null}
        {invoice.customerVisibleNote ? (
          <>
            <h3>{content.invoice.customerNote}</h3>
            <p>{invoice.customerVisibleNote}</p>
          </>
        ) : null}
      </section>
    </div>
  );
}
