import Link from "next/link";
import { PropertyAreaForm } from "@/components/crm/property-area-form";
import { crmContent } from "@/content/crm";
import { createAreaAction } from "../../../../../actions";
import {
  createCustomerCrmPageService,
  loadStaffPropertyOrNotFound,
  parsePropertyRouteParams,
  requireStaffCrmManagePageContext,
  type PropertyRouteParams,
} from "../../../../../_lib/crm-page";

export const dynamic = "force-dynamic";

export default async function CreatePropertyAreaPage({
  params,
}: {
  params: Promise<PropertyRouteParams>;
}) {
  const { actor, locale } = await requireStaffCrmManagePageContext();
  const route = await parsePropertyRouteParams(params);
  const service = createCustomerCrmPageService();
  const { property } = await loadStaffPropertyOrNotFound(service, actor, route);
  const content = crmContent[locale];

  return (
    <section className="crm-page crm-page--form" aria-labelledby="create-area-heading">
      <Link
        className="crm-back-link"
        href={`/app/customers/${route.customerId}/properties/${property.id}`}
      >
        {content.common.back}
      </Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{property.label}</p>
          <h1 id="create-area-heading">{content.forms.area.createTitle}</h1>
        </div>
      </header>
      <PropertyAreaForm
        action={createAreaAction}
        locale={locale}
        propertyId={property.id}
      />
    </section>
  );
}
