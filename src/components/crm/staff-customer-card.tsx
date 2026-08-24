import type { AuthLocale } from "@/auth/validation";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { crmContent } from "@/content/crm";
import type {
  CustomerContact,
  CustomerIdentityLink,
  PropertyArea,
  StaffCleaningAsset,
  StaffCustomerDetail,
  StaffProperty,
} from "@/modules/customer-crm/types";

function formatDate(value: Date, locale: AuthLocale): string {
  return new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
    dateStyle: "medium",
  }).format(value);
}

function lifecycleTone(status: "ACTIVE" | "INACTIVE" | "ARCHIVED") {
  if (status === "ACTIVE") return "positive" as const;
  if (status === "INACTIVE") return "warning" as const;
  return "muted" as const;
}

function present(value: string | null, noValue: string): string {
  return value || noValue;
}

function address(property: StaffProperty): string {
  return [
    property.streetAddress,
    property.district,
    property.city,
    property.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function StaffContactCard({
  contact,
  locale,
}: {
  contact: CustomerContact;
  locale: AuthLocale;
}) {
  const content = crmContent[locale];
  return (
    <article className="crm-card crm-card--contact">
      <header className="crm-card__header">
        <h4>{contact.contactName}</h4>
        <ApplicationStatusBadge
          label={
            contact.active
              ? content.labels.activeStates.ACTIVE
              : content.labels.activeStates.INACTIVE
          }
          tone={contact.active ? "positive" : "muted"}
        />
      </header>
      <dl className="crm-card__details">
        <div>
          <dt>{content.forms.contact.roleTitle}</dt>
          <dd>{present(contact.roleTitle, content.common.noValue)}</dd>
        </div>
        <div>
          <dt>{content.forms.contact.email}</dt>
          <dd>{present(contact.email, content.common.noValue)}</dd>
        </div>
        <div>
          <dt>{content.forms.contact.phone}</dt>
          <dd>{present(contact.phone, content.common.noValue)}</dd>
        </div>
        <div>
          <dt>{content.forms.contact.preferredContactMethod}</dt>
          <dd>{content.labels.contactMethods[contact.preferredContactMethod]}</dd>
        </div>
        <div>
          <dt>{content.forms.contact.locale}</dt>
          <dd>{content.labels.locales[contact.locale]}</dd>
        </div>
        <div>
          <dt>{content.forms.contact.isPrimary}</dt>
          <dd>
            {contact.isPrimary
              ? content.labels.activeStates.ACTIVE
              : content.labels.activeStates.INACTIVE}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function StaffIdentityLinkCard({
  link,
  locale,
}: {
  link: CustomerIdentityLink;
  locale: AuthLocale;
}) {
  const content = crmContent[locale];
  return (
    <article className="crm-card crm-card--identity-link">
      <header className="crm-card__header">
        <h4>{content.labels.identityRelationships[link.relationshipType]}</h4>
        <ApplicationStatusBadge
          label={
            link.active
              ? content.forms.identityLink.active
              : content.forms.identityLink.revoked
          }
          tone={link.active ? "positive" : "muted"}
        />
      </header>
      <code className="crm-card__identifier">{link.userProfileId}</code>
    </article>
  );
}

function StaffAreaCard({ area, locale }: { area: PropertyArea; locale: AuthLocale }) {
  const content = crmContent[locale];
  const label = area.customLabel || content.labels.areaTypes[area.areaType];
  return (
    <article className="crm-card crm-card--area">
      <header className="crm-card__header">
        <h5>{label}</h5>
        <ApplicationStatusBadge
          label={
            area.active
              ? content.labels.activeStates.ACTIVE
              : content.labels.activeStates.INACTIVE
          }
          tone={area.active ? "positive" : "muted"}
        />
      </header>
      <dl className="crm-card__details">
        <div>
          <dt>{content.forms.area.floorLevel}</dt>
          <dd>{present(area.floorLevel, content.common.noValue)}</dd>
        </div>
        <div>
          <dt>{content.forms.area.notes}</dt>
          <dd>{present(area.notes, content.common.noValue)}</dd>
        </div>
      </dl>
    </article>
  );
}

function StaffAssetCard({
  asset,
  locale,
}: {
  asset: StaffCleaningAsset;
  locale: AuthLocale;
}) {
  const content = crmContent[locale];
  return (
    <article className="crm-card crm-card--asset">
      <header className="crm-card__header">
        <h5>{asset.label}</h5>
        <ApplicationStatusBadge
          label={content.labels.lifecycleStatuses[asset.status]}
          tone={lifecycleTone(asset.status)}
        />
      </header>
      <dl className="crm-card__details">
        <div>
          <dt>{content.forms.asset.customerCondition}</dt>
          <dd>{present(asset.customerConditionNotes, content.common.noValue)}</dd>
        </div>
        <div>
          <dt>{content.forms.asset.colourNotes}</dt>
          <dd>{present(asset.colourAppearanceNotes, content.common.noValue)}</dd>
        </div>
        <div>
          <dt>{content.forms.asset.acquisitionOrAge}</dt>
          <dd>{asset.approximateAcquisitionYear ?? content.common.noValue}</dd>
        </div>
        <div>
          <dt>{content.forms.asset.operationalNotes}</dt>
          <dd>{present(asset.operationalNotes, content.common.noValue)}</dd>
        </div>
      </dl>
    </article>
  );
}

function StaffPropertyCard({
  locale,
  property,
}: {
  locale: AuthLocale;
  property: StaffProperty;
}) {
  const content = crmContent[locale];
  return (
    <article className="crm-card crm-card--property">
      <header className="crm-card__header">
        <div>
          <p className="crm-card__eyebrow">
            {content.labels.propertyTypes[property.propertyType]}
          </p>
          <h4>{property.label}</h4>
        </div>
        <ApplicationStatusBadge
          label={content.labels.lifecycleStatuses[property.status]}
          tone={lifecycleTone(property.status)}
        />
      </header>
      <p className="crm-card__address">{address(property)}</p>
      <dl className="crm-card__details crm-card__details--operational">
        <div>
          <dt>{content.forms.property.accessNotes}</dt>
          <dd>{present(property.accessNotes, content.common.noValue)}</dd>
        </div>
        <div>
          <dt>{content.forms.property.parkingNotes}</dt>
          <dd>{present(property.parkingNotes, content.common.noValue)}</dd>
        </div>
        <div>
          <dt>{content.forms.property.latitude}</dt>
          <dd>{property.latitude ?? content.common.noValue}</dd>
        </div>
        <div>
          <dt>{content.forms.property.longitude}</dt>
          <dd>{property.longitude ?? content.common.noValue}</dd>
        </div>
      </dl>

      <section className="crm-card__section" aria-labelledby={`${property.id}-areas`}>
        <h5 id={`${property.id}-areas`}>{content.selfService.areas}</h5>
        {property.areas.length === 0 ? (
          <p>{content.selfService.noAreas}</p>
        ) : (
          <div className="crm-card-grid crm-card-grid--areas">
            {property.areas.map((area) => (
              <StaffAreaCard key={area.id} area={area} locale={locale} />
            ))}
          </div>
        )}
      </section>

      <section className="crm-card__section" aria-labelledby={`${property.id}-assets`}>
        <h5 id={`${property.id}-assets`}>{content.selfService.assets}</h5>
        {property.cleaningAssets.length === 0 ? (
          <p>{content.selfService.noAssets}</p>
        ) : (
          <div className="crm-card-grid crm-card-grid--assets">
            {property.cleaningAssets.map((asset) => (
              <StaffAssetCard key={asset.id} asset={asset} locale={locale} />
            ))}
          </div>
        )}
      </section>
    </article>
  );
}

export function StaffCustomerCard({
  customer,
  locale,
}: {
  customer: StaffCustomerDetail;
  locale: AuthLocale;
}) {
  const content = crmContent[locale];
  return (
    <article className="crm-card crm-staff-customer-card">
      <header className="crm-card__header">
        <div>
          <p className="crm-card__eyebrow">{content.detail.overview}</p>
          <h2>{customer.displayName}</h2>
        </div>
        <ApplicationStatusBadge
          label={content.labels.lifecycleStatuses[customer.status]}
          tone={lifecycleTone(customer.status)}
        />
      </header>

      <dl className="crm-card__details crm-card__details--customer">
        <div>
          <dt>{content.detail.customerType}</dt>
          <dd>{content.labels.customerTypes[customer.customerType]}</dd>
        </div>
        <div>
          <dt>{content.detail.legalName}</dt>
          <dd>{present(customer.legalName, content.common.noValue)}</dd>
        </div>
        <div>
          <dt>{content.detail.preferredLocale}</dt>
          <dd>{content.labels.locales[customer.preferredLocale]}</dd>
        </div>
        <div>
          <dt>{content.detail.primaryEmail}</dt>
          <dd>{present(customer.primaryEmail, content.common.noValue)}</dd>
        </div>
        <div>
          <dt>{content.detail.primaryPhone}</dt>
          <dd>{present(customer.primaryPhone, content.common.noValue)}</dd>
        </div>
        <div>
          <dt>{content.detail.created}</dt>
          <dd>{formatDate(customer.createdAt, locale)}</dd>
        </div>
        <div>
          <dt>{content.detail.updated}</dt>
          <dd>{formatDate(customer.updatedAt, locale)}</dd>
        </div>
      </dl>

      <section className="crm-card__section crm-card__section--internal">
        <h3>{content.detail.internalNotes}</h3>
        <p className="crm-card__warning">{content.detail.internalNotesWarning}</p>
        <p>{present(customer.internalNotes, content.common.noValue)}</p>
      </section>

      <section className="crm-card__section" aria-labelledby={`${customer.id}-contacts`}>
        <h3 id={`${customer.id}-contacts`}>{content.detail.contacts}</h3>
        {customer.contacts.length === 0 ? (
          <p>{content.detail.noContacts}</p>
        ) : (
          <div className="crm-card-grid crm-card-grid--contacts">
            {customer.contacts.map((contact) => (
              <StaffContactCard key={contact.id} contact={contact} locale={locale} />
            ))}
          </div>
        )}
      </section>

      <section className="crm-card__section" aria-labelledby={`${customer.id}-identity-links`}>
        <h3 id={`${customer.id}-identity-links`}>{content.detail.identityAccess}</h3>
        {customer.identityLinks.length === 0 ? (
          <p>{content.detail.noIdentityLinks}</p>
        ) : (
          <div className="crm-card-grid crm-card-grid--identity-links">
            {customer.identityLinks.map((link) => (
              <StaffIdentityLinkCard key={link.id} link={link} locale={locale} />
            ))}
          </div>
        )}
      </section>

      <section className="crm-card__section" aria-labelledby={`${customer.id}-properties`}>
        <h3 id={`${customer.id}-properties`}>{content.detail.properties}</h3>
        {customer.properties.length === 0 ? (
          <p>{content.detail.noProperties}</p>
        ) : (
          <div className="crm-card-grid crm-card-grid--properties">
            {customer.properties.map((property) => (
              <StaffPropertyCard key={property.id} locale={locale} property={property} />
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
