import Link from "next/link";
import { CleaningAssetForm } from "@/components/crm/cleaning-asset-form";
import { crmContent } from "@/content/crm";
import { getDatabase } from "@/db/client";
import { getCustomerCrmCatalogueOptions } from "@/modules/customer-crm/catalogue-options";
import { createAssetAction } from "../../../../../actions";
import {
  createCustomerCrmPageService,
  loadStaffPropertyOrNotFound,
  parsePropertyRouteParams,
  requireStaffCrmManagePageContext,
  type PropertyRouteParams,
} from "../../../../../_lib/crm-page";

export const dynamic = "force-dynamic";

export default async function CreateCleaningAssetPage({
  params,
}: {
  params: Promise<PropertyRouteParams>;
}) {
  const { actor, locale } = await requireStaffCrmManagePageContext();
  const route = await parsePropertyRouteParams(params);
  const service = createCustomerCrmPageService();
  const [{ property }, catalogue] = await Promise.all([
    loadStaffPropertyOrNotFound(service, actor, route),
    getCustomerCrmCatalogueOptions(getDatabase(), locale),
  ]);
  const content = crmContent[locale];

  return (
    <section className="crm-page crm-page--form" aria-labelledby="create-asset-heading">
      <Link
        className="crm-back-link"
        href={`/app/customers/${route.customerId}/properties/${property.id}`}
      >
        {content.common.back}
      </Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{property.label}</p>
          <h1 id="create-asset-heading">{content.forms.asset.createTitle}</h1>
        </div>
      </header>
      <CleaningAssetForm
        action={createAssetAction}
        locale={locale}
        options={{
          areas: property.areas
            .filter((area) => area.active)
            .map((area) => ({
              id: area.id,
              label: area.customLabel || content.labels.areaTypes[area.areaType],
              active: area.active,
            })),
          itemTypes: catalogue.itemTypes,
          fibreMaterials: catalogue.fibreMaterials,
          surfaceConstructions: catalogue.surfaceConstructions,
          conditionLevels: catalogue.conditionLevels,
          issueTypes: catalogue.issueTypes,
          riskFlags: catalogue.riskFlags,
        }}
        propertyId={property.id}
      />
    </section>
  );
}
