import { randomUUID } from "node:crypto";
import Link from "next/link";
import {
  CreateInvoiceDraftForm,
  PaymentOperationsList,
} from "@/components/finance/mutation-forms";
import { financeContent } from "@/content/finance";
import {
  allocatePaymentAction,
  confirmPaymentAction,
  createInvoiceDraftAction,
  reversePaymentAction,
} from "../invoices/actions";
import {
  createFinancePageService,
  requireStaffFinancePageContext,
} from "../invoices/_lib/finance-page";

export const dynamic = "force-dynamic";

export default async function FinanceDashboardPage() {
  const { actor, locale } = await requireStaffFinancePageContext();
  const service = createFinancePageService();
  const [dashboard, payments] = await Promise.all([
    service.dashboard(actor),
    service.listPayments(actor),
  ]);
  const content = financeContent[locale];
  const money = new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-IE", {
    style: "currency",
    currency: dashboard.currency,
  });
  const counts = [
    [content.staff.draftInvoices, dashboard.draftInvoices],
    [content.staff.issuedUnpaidInvoices, dashboard.issuedUnpaidInvoices],
    [content.staff.partiallyPaidInvoices, dashboard.partiallyPaidInvoices],
    [content.staff.overdueInvoices, dashboard.overdueInvoices],
    [content.staff.paidInvoices, dashboard.paidInvoices],
    [content.staff.unappliedPayments, dashboard.unappliedPayments],
  ] as const;
  const amounts = [
    [content.staff.invoicedGross, dashboard.invoicedGrossMinorUnits],
    [content.staff.paid, dashboard.paidMinorUnits],
    [content.staff.outstanding, dashboard.outstandingMinorUnits],
    [content.staff.overdue, dashboard.overdueMinorUnits],
  ] as const;

  return (
    <section className="crm-page" aria-labelledby="finance-heading">
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.staff.eyebrow}</p>
          <h1 id="finance-heading">{content.staff.dashboardTitle}</h1>
          <p>{content.staff.dashboardIntro}</p>
        </div>
        <Link className="crm-button" href="/app/invoices">
          {content.staff.invoicesLink}
        </Link>
      </header>
      <section className="crm-card" aria-labelledby="finance-counts-heading">
        <h2 id="finance-counts-heading">{content.staff.invoicesLink}</h2>
        <dl className="crm-card__details">
          {counts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="crm-card" aria-labelledby="finance-amounts-heading">
        <h2 id="finance-amounts-heading">{content.invoice.totalGross}</h2>
        <dl className="crm-card__details">
          {amounts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{money.format(value / 100)}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="crm-management-card" data-print-hidden="true">
        <CreateInvoiceDraftForm
          action={createInvoiceDraftAction}
          locale={locale}
        />
      </section>
      <PaymentOperationsList
        actions={{
          allocate: allocatePaymentAction,
          confirm: confirmPaymentAction,
          reverse: reversePaymentAction,
        }}
        idempotencyKeys={Object.fromEntries(
          payments.map((payment) => [
            payment.paymentReference,
            { allocate: randomUUID(), reverse: randomUUID() },
          ]),
        )}
        locale={locale}
        payments={payments}
      />
    </section>
  );
}
