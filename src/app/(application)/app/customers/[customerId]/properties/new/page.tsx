import Link from "next/link";
import { PropertyForm } from "@/components/crm/property-form";
import { crmContent } from "@/content/crm";
import { getDatabase } from "@/db/client";
import { getCustomerCrmCatalogueOptions } from "@/modules/customer-crm/catalogue-options";
import { createPropertyAction } from "../../../actions";
import {
  createCustomerCrmPageService,
  loadStaffCustomerOrNotFound,
  parseCustomerRouteParams,
  requireStaffCrmManagePageContext,
  type CustomerRouteParams,
} from "../../../_lib/crm-page";

export const dynamic = "force-dynamic";

export default async function CreatePropertyPage({
  params,
}: {
  params: Promise<CustomerRouteParams>;
}) {
  const { actor, locale } = await requireStaffCrmManagePageContext();
  const { customerId } = await parseCustomerRouteParams(params);
  const service = createCustomerCrmPageService();
  const [customer, catalogue] = await Promise.all([
    loadStaffCustomerOrNotFound(service, actor, customerId),
    getCustomerCrmCatalogueOptions(getDatabase(), locale),
  ]);
  const content = crmContent[locale];

  return (
    <section className="crm-page crm-page--form" aria-labelledby="create-property-heading">
      <Link className="crm-back-link" href={`/app/customers/${customer.id}`}>
        {content.common.back}
      </Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{customer.displayName}</p>
          <h1 id="create-property-heading">{content.forms.property.createTitle}</h1>
        </div>
      </header>
      <PropertyForm
        action={createPropertyAction}
        customerId={customer.id}
        locale={locale}
        mode="create"
        serviceZoneOptions={catalogue.serviceZones}
      />
    </section>
  );
}
