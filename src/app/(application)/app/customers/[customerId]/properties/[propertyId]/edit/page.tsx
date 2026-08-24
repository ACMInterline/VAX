import Link from "next/link";
import { PropertyForm } from "@/components/crm/property-form";
import { crmContent } from "@/content/crm";
import { getDatabase } from "@/db/client";
import { getCustomerCrmCatalogueOptions } from "@/modules/customer-crm/catalogue-options";
import { updatePropertyAction } from "../../../../actions";
import {
  createCustomerCrmPageService,
  loadStaffPropertyOrNotFound,
  parsePropertyRouteParams,
  requireStaffCrmManagePageContext,
  type PropertyRouteParams,
} from "../../../../_lib/crm-page";

export const dynamic = "force-dynamic";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<PropertyRouteParams>;
}) {
  const { actor, locale } = await requireStaffCrmManagePageContext();
  const route = await parsePropertyRouteParams(params);
  const service = createCustomerCrmPageService();
  const [{ customer, property }, catalogue] = await Promise.all([
    loadStaffPropertyOrNotFound(service, actor, route),
    getCustomerCrmCatalogueOptions(getDatabase(), locale),
  ]);
  const content = crmContent[locale];

  return (
    <section className="crm-page crm-page--form" aria-labelledby="edit-property-heading">
      <Link
        className="crm-back-link"
        href={`/app/customers/${customer.id}/properties/${property.id}`}
      >
        {content.common.back}
      </Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{property.label}</p>
          <h1 id="edit-property-heading">{content.forms.property.editTitle}</h1>
        </div>
      </header>
      <PropertyForm
        action={updatePropertyAction}
        initialValues={{
          propertyId: property.id,
          expectedVersion: property.version,
          propertyType: property.propertyType,
          label: property.label,
          city: property.city,
          district: property.district,
          streetAddress: property.streetAddress,
          postalCode: property.postalCode,
          latitude: property.latitude,
          longitude: property.longitude,
          accessNotes: property.accessNotes,
          parkingNotes: property.parkingNotes,
          serviceZoneId: property.serviceZoneId,
        }}
        locale={locale}
        mode="edit"
        serviceZoneOptions={catalogue.serviceZones}
      />
    </section>
  );
}
