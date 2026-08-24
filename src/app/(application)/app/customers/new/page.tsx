import Link from "next/link";
import { CustomerForm } from "@/components/crm/customer-form";
import { crmContent } from "@/content/crm";
import { createCustomerAction } from "../actions";
import { requireStaffCrmManagePageContext } from "../_lib/crm-page";

export const dynamic = "force-dynamic";

export default async function CreateCustomerPage() {
  const { locale } = await requireStaffCrmManagePageContext();
  const content = crmContent[locale];

  return (
    <section className="crm-page crm-page--form" aria-labelledby="create-customer-heading">
      <Link className="crm-back-link" href="/app/customers">
        {content.detail.backToCustomers}
      </Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.list.eyebrow}</p>
          <h1 id="create-customer-heading">{content.forms.customer.createTitle}</h1>
        </div>
      </header>
      <CustomerForm action={createCustomerAction} locale={locale} mode="create" />
    </section>
  );
}
