import type { AuthLocale } from "@/auth/validation";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { crmContent } from "@/content/crm";
import type {
  CustomerCleaningAsset,
  CustomerProperty,
  CustomerPropertyArea,
  CustomerSelfDetail,
} from "@/modules/customer-crm/types";
import { crmComponentContent } from "./component-content";

function lifecycleTone(status: "ACTIVE" | "INACTIVE" | "ARCHIVED") {
  if (status === "ACTIVE") return "positive" as const;
  if (status === "INACTIVE") return "warning" as const;
  return "muted" as const;
}

function present(value: string | null, noValue: string): string {
  return value || noValue;
}

function safeAddress(property: CustomerProperty): string {
  return [
    property.streetAddress,
    property.district,
    property.city,
    property.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function CustomerAreaCard({
  area,
  locale,
}: {
  area: CustomerPropertyArea;
  locale: AuthLocale;
}) {
  const content = crmContent[locale];
  return (
    <article className="crm-card crm-card--self-area">
      <header className="crm-card__header">
        <h4>{area.customLabel || content.labels.areaTypes[area.areaType]}</h4>
        <ApplicationStatusBadge
          label={
            area.active
              ? content.labels.activeStates.ACTIVE
              : content.labels.activeStates.INACTIVE
          }
          tone={area.active ? "positive" : "muted"}
        />
      </header>
      {area.floorLevel ? (
        <p>
          {content.forms.area.floorLevel}: {area.floorLevel}
        </p>
      ) : null}
    </article>
  );
}

function CustomerAssetCard({
  asset,
  locale,
}: {
  asset: CustomerCleaningAsset;
  locale: AuthLocale;
}) {
  const content = crmContent[locale];
  const measurements = [
    asset.approximateLengthCm == null
      ? null
      : `${asset.approximateLengthCm} cm`,
    asset.approximateWidthCm == null ? null : `${asset.approximateWidthCm} cm`,
    asset.approximateAreaHundredthsM2 == null
      ? null
      : `${(asset.approximateAreaHundredthsM2 / 100).toLocaleString(
          locale === "bg" ? "bg-BG" : "en-GB",
        )} m²`,
  ].filter(Boolean);

  return (
    <article className="crm-card crm-card--self-asset">
      <header className="crm-card__header">
        <h4>{asset.label}</h4>
        <ApplicationStatusBadge
          label={content.labels.lifecycleStatuses[asset.status]}
          tone={lifecycleTone(asset.status)}
        />
      </header>
      <dl className="crm-card__details">
        {measurements.length > 0 ? (
          <div>
            <dt>{content.forms.asset.profileLegend}</dt>
            <dd>{measurements.join(" × ")}</dd>
          </div>
        ) : null}
        {asset.approximateSeatCount == null ? null : (
          <div>
            <dt>{crmComponentContent[locale].approximateSeatCount}</dt>
            <dd>{asset.approximateSeatCount}</dd>
          </div>
        )}
        <div>
          <dt>{content.forms.asset.customerCondition}</dt>
          <dd>{present(asset.customerConditionNotes, content.common.noValue)}</dd>
        </div>
        <div>
          <dt>{content.forms.asset.colourNotes}</dt>
          <dd>{present(asset.colourAppearanceNotes, content.common.noValue)}</dd>
        </div>
        {asset.approximateAcquisitionYear == null ? null : (
          <div>
            <dt>{content.forms.asset.acquisitionOrAge}</dt>
            <dd>{asset.approximateAcquisitionYear}</dd>
          </div>
        )}
      </dl>
    </article>
  );
}

function CustomerPropertyCard({
  locale,
  property,
}: {
  locale: AuthLocale;
  property: CustomerProperty;
}) {
  const content = crmContent[locale];
  return (
    <article className="crm-card crm-card--self-property">
      <header className="crm-card__header">
        <div>
          <p className="crm-card__eyebrow">
            {content.labels.propertyTypes[property.propertyType]}
          </p>
          <h3>{property.label}</h3>
        </div>
        <ApplicationStatusBadge
          label={content.labels.lifecycleStatuses[property.status]}
          tone={lifecycleTone(property.status)}
        />
      </header>
      <p className="crm-card__address">
        <strong>{content.selfService.address}:</strong> {safeAddress(property)}
      </p>

      <section className="crm-card__section" aria-labelledby={`${property.id}-self-areas`}>
        <h4 id={`${property.id}-self-areas`}>{content.selfService.areas}</h4>
        {property.areas.length === 0 ? (
          <p>{content.selfService.noAreas}</p>
        ) : (
          <div className="crm-card-grid crm-card-grid--self-areas">
            {property.areas.map((area) => (
              <CustomerAreaCard key={area.id} area={area} locale={locale} />
            ))}
          </div>
        )}
      </section>

      <section className="crm-card__section" aria-labelledby={`${property.id}-self-assets`}>
        <h4 id={`${property.id}-self-assets`}>{content.selfService.assets}</h4>
        {property.cleaningAssets.length === 0 ? (
          <p>{content.selfService.noAssets}</p>
        ) : (
          <div className="crm-card-grid crm-card-grid--self-assets">
            {property.cleaningAssets.map((asset) => (
              <CustomerAssetCard key={asset.id} asset={asset} locale={locale} />
            ))}
          </div>
        )}
      </section>
    </article>
  );
}

export function CustomerSelfServiceCard({
  customer,
  locale,
}: {
  customer: CustomerSelfDetail;
  locale: AuthLocale;
}) {
  const content = crmContent[locale];
  return (
    <article className="crm-card crm-customer-self-service-card">
      <header className="crm-card__header">
        <div>
          <p className="crm-card__eyebrow">{content.selfService.eyebrow}</p>
          <h2>{customer.displayName}</h2>
        </div>
        <ApplicationStatusBadge
          label={content.labels.lifecycleStatuses[customer.status]}
          tone={lifecycleTone(customer.status)}
        />
      </header>
      <p className="crm-card__notice">{content.selfService.readOnlyNotice}</p>
      <dl className="crm-card__details crm-card__details--self-customer">
        <div>
          <dt>{content.detail.customerType}</dt>
          <dd>{content.labels.customerTypes[customer.customerType]}</dd>
        </div>
        <div>
          <dt>{content.detail.primaryEmail}</dt>
          <dd>{present(customer.primaryEmail, content.common.noValue)}</dd>
        </div>
        <div>
          <dt>{content.detail.primaryPhone}</dt>
          <dd>{present(customer.primaryPhone, content.common.noValue)}</dd>
        </div>
      </dl>

      <section className="crm-card__section" aria-labelledby={`${customer.id}-self-properties`}>
        <h3 id={`${customer.id}-self-properties`}>{content.selfService.title}</h3>
        {customer.properties.length === 0 ? (
          <div className="crm-card__empty-state">
            <h4>{content.selfService.noPropertiesTitle}</h4>
            <p>{content.selfService.noPropertiesText}</p>
          </div>
        ) : (
          <div className="crm-card-grid crm-card-grid--self-properties">
            {customer.properties.map((property) => (
              <CustomerPropertyCard
                key={property.id}
                locale={locale}
                property={property}
              />
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
