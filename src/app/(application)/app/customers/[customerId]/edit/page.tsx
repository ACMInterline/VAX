import Link from "next/link";
import { CustomerForm } from "@/components/crm/customer-form";
import { crmContent } from "@/content/crm";
import { updateCustomerAction } from "../../actions";
import {
  createCustomerCrmPageService,
  loadStaffCustomerOrNotFound,
  parseCustomerRouteParams,
  requireStaffCrmManagePageContext,
  type CustomerRouteParams,
} from "../../_lib/crm-page";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<CustomerRouteParams>;
}) {
  const { actor, locale } = await requireStaffCrmManagePageContext();
  const { customerId } = await parseCustomerRouteParams(params);
  const service = createCustomerCrmPageService();
  const customer = await loadStaffCustomerOrNotFound(service, actor, customerId);
  const content = crmContent[locale];

  return (
    <section className="crm-page crm-page--form" aria-labelledby="edit-customer-heading">
      <Link className="crm-back-link" href={`/app/customers/${customer.id}`}>
        {content.common.back}
      </Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{customer.displayName}</p>
          <h1 id="edit-customer-heading">{content.forms.customer.editTitle}</h1>
        </div>
      </header>
      <CustomerForm
        action={updateCustomerAction}
        initialValues={{
          customerId: customer.id,
          expectedVersion: customer.version,
          customerType: customer.customerType,
          displayName: customer.displayName,
          legalName: customer.legalName,
          preferredLocale: customer.preferredLocale,
          primaryEmail: customer.primaryEmail,
          primaryPhone: customer.primaryPhone,
          internalNotes: customer.internalNotes,
        }}
        locale={locale}
        mode="edit"
      />
    </section>
  );
}
