import Link from "next/link";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { CrmConfirmationAction } from "@/components/crm/confirmation-action";
import { crmContent } from "@/content/crm";
import {
  archiveAreaAction,
  archiveAssetAction,
  archivePropertyAction,
} from "../../../actions";
import {
  createCustomerCrmPageService,
  loadStaffPropertyOrNotFound,
  parsePropertyRouteParams,
  requireStaffCrmReadPageContext,
  type PropertyRouteParams,
} from "../../../_lib/crm-page";

export const dynamic = "force-dynamic";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<PropertyRouteParams>;
}) {
  const { actor, locale } = await requireStaffCrmReadPageContext();
  const route = await parsePropertyRouteParams(params);
  const service = createCustomerCrmPageService();
  const { customer, property } = await loadStaffPropertyOrNotFound(
    service,
    actor,
    route,
  );
  const content = crmContent[locale];
  const canManage = actor.permissions.has("CUSTOMER_RECORDS_MANAGE");
  const historyLabel =
    locale === "bg" ? "История на почистванията" : "Cleaning history";
  const address = [
    property.streetAddress,
    property.district,
    property.city,
    property.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <section className="crm-page" aria-labelledby="property-detail-heading">
      <Link className="crm-back-link" href={`/app/customers/${customer.id}`}>
        {content.common.back}
      </Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{customer.displayName}</p>
          <h1 id="property-detail-heading">{property.label}</h1>
          <p>{address}</p>
        </div>
        <ApplicationStatusBadge
          label={content.labels.lifecycleStatuses[property.status]}
          tone={property.status === "ACTIVE" ? "positive" : property.status === "INACTIVE" ? "warning" : "muted"}
        />
      </header>

      {canManage ? (
        <nav className="crm-subnavigation" aria-label={property.label}>
          <Link href={`/app/customers/${customer.id}/properties/${property.id}/edit`}>
            {content.forms.property.editTitle}
          </Link>
          <Link href={`/app/customers/${customer.id}/properties/${property.id}/areas/new`}>
            {content.forms.area.createTitle}
          </Link>
          <Link href={`/app/customers/${customer.id}/properties/${property.id}/assets/new`}>
            {content.forms.asset.createTitle}
          </Link>
        </nav>
      ) : null}

      <article className="crm-management-card">
        <header className="crm-management-card__header">
          <h2>{content.detail.overview}</h2>
          {canManage ? (
            <CrmConfirmationAction
              action={archivePropertyAction}
              disabled={property.status === "ARCHIVED"}
              locale={locale}
              target={{
                kind: "property",
                propertyId: property.id,
                expectedVersion: property.version,
              }}
            >
              {content.common.archive}
            </CrmConfirmationAction>
          ) : null}
        </header>
        <dl className="crm-card__details crm-card__details--operational">
          <div>
            <dt>{content.forms.property.type}</dt>
            <dd>{content.labels.propertyTypes[property.propertyType]}</dd>
          </div>
          <div>
            <dt>{content.forms.property.serviceZone}</dt>
            <dd>{property.serviceZoneId ?? content.common.noValue}</dd>
          </div>
          <div>
            <dt>{content.forms.property.accessNotes}</dt>
            <dd>{property.accessNotes ?? content.common.noValue}</dd>
          </div>
          <div>
            <dt>{content.forms.property.parkingNotes}</dt>
            <dd>{property.parkingNotes ?? content.common.noValue}</dd>
          </div>
        </dl>
      </article>

      <section className="crm-management-card" aria-labelledby="property-areas-heading">
        <h2 id="property-areas-heading">{content.selfService.areas}</h2>
        {property.areas.length === 0 ? (
          <p>{content.selfService.noAreas}</p>
        ) : (
          <ul className="crm-record-actions crm-record-actions--cards">
            {property.areas.map((area) => (
              <li key={area.id}>
                <div>
                  <strong>{area.customLabel || content.labels.areaTypes[area.areaType]}</strong>
                  <small>{area.floorLevel ?? content.common.noValue}</small>
                </div>
                {canManage && area.active ? (
                  <CrmConfirmationAction
                    action={archiveAreaAction}
                    locale={locale}
                    target={{ kind: "area", areaId: area.id, expectedVersion: area.version }}
                  >
                    {content.common.archive}
                  </CrmConfirmationAction>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="crm-management-card" aria-labelledby="property-assets-heading">
        <h2 id="property-assets-heading">{content.selfService.assets}</h2>
        {property.cleaningAssets.length === 0 ? (
          <p>{content.selfService.noAssets}</p>
        ) : (
          <ul className="crm-record-actions crm-record-actions--cards">
            {property.cleaningAssets.map((asset) => (
              <li key={asset.id}>
                <div>
                  <strong>{asset.label}</strong>
                  <small>{content.labels.lifecycleStatuses[asset.status]}</small>
                </div>
                <Link
                  className="crm-button"
                  href={`/app/customers/${customer.id}/properties/${property.id}/assets/${asset.id}`}
                >
                  {historyLabel}
                </Link>
                {canManage && asset.status !== "ARCHIVED" ? (
                  <CrmConfirmationAction
                    action={archiveAssetAction}
                    locale={locale}
                    target={{ kind: "asset", assetId: asset.id, expectedVersion: asset.version }}
                  >
                    {content.common.archive}
                  </CrmConfirmationAction>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
