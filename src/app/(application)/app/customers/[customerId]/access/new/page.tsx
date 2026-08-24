import Link from "next/link";
import { IdentityLinkForm } from "@/components/crm/identity-link-form";
import { crmContent } from "@/content/crm";
import { linkCustomerIdentityAction } from "../../../actions";
import {
  createCustomerCrmPageService,
  loadStaffCustomerOrNotFound,
  parseCustomerRouteParams,
  requireStaffCrmIdentityPageContext,
  type CustomerRouteParams,
} from "../../../_lib/crm-page";

export const dynamic = "force-dynamic";

export default async function LinkCustomerAccessPage({
  params,
}: {
  params: Promise<CustomerRouteParams>;
}) {
  const { actor, locale } = await requireStaffCrmIdentityPageContext();
  const { customerId } = await parseCustomerRouteParams(params);
  const service = createCustomerCrmPageService();
  const customer = await loadStaffCustomerOrNotFound(service, actor, customerId);
  const content = crmContent[locale];

  return (
    <section className="crm-page crm-page--form" aria-labelledby="link-access-heading">
      <Link className="crm-back-link" href={`/app/customers/${customer.id}`}>
        {content.common.back}
      </Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{customer.displayName}</p>
          <h1 id="link-access-heading">{content.forms.identityLink.title}</h1>
        </div>
      </header>
      <IdentityLinkForm
        action={linkCustomerIdentityAction}
        customerId={customer.id}
        locale={locale}
      />
    </section>
  );
}
