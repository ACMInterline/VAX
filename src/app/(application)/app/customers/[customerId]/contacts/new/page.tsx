import Link from "next/link";
import { ContactForm } from "@/components/crm/contact-form";
import { crmContent } from "@/content/crm";
import { createContactAction } from "../../../actions";
import {
  createCustomerCrmPageService,
  loadStaffCustomerOrNotFound,
  parseCustomerRouteParams,
  requireStaffCrmManagePageContext,
  type CustomerRouteParams,
} from "../../../_lib/crm-page";

export const dynamic = "force-dynamic";

export default async function CreateContactPage({
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
    <section className="crm-page crm-page--form" aria-labelledby="create-contact-heading">
      <Link className="crm-back-link" href={`/app/customers/${customer.id}`}>
        {content.common.back}
      </Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{customer.displayName}</p>
          <h1 id="create-contact-heading">{content.forms.contact.createTitle}</h1>
        </div>
      </header>
      <ContactForm
        action={createContactAction}
        customerId={customer.id}
        locale={locale}
      />
    </section>
  );
}
