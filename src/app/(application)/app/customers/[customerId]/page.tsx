import Link from "next/link";
import { CrmConfirmationAction } from "@/components/crm/confirmation-action";
import { StaffCustomerCard } from "@/components/crm/staff-customer-card";
import { crmContent } from "@/content/crm";
import {
  archiveContactAction,
  archiveCustomerAction,
  revokeCustomerIdentityLinkAction,
} from "../actions";
import { ContactArchiveAction } from "../_components/contact-archive-action";
import {
  createCustomerCrmPageService,
  loadStaffCustomerOrNotFound,
  parseCustomerRouteParams,
  requireStaffCrmReadPageContext,
  type CustomerRouteParams,
} from "../_lib/crm-page";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<CustomerRouteParams>;
}) {
  const { actor, locale } = await requireStaffCrmReadPageContext();
  const { customerId } = await parseCustomerRouteParams(params);
  const service = createCustomerCrmPageService();
  const customer = await loadStaffCustomerOrNotFound(service, actor, customerId);
  const content = crmContent[locale];
  const canManage = actor.permissions.has("CUSTOMER_RECORDS_MANAGE");
  const canManageIdentity =
    canManage && actor.permissions.has("USER_ADMIN_MANAGE");

  return (
    <section className="crm-page" aria-labelledby="customer-detail-heading">
      <Link className="crm-back-link" href="/app/customers">
        {content.detail.backToCustomers}
      </Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.list.eyebrow}</p>
          <h1 id="customer-detail-heading">{customer.displayName}</h1>
        </div>
        {canManage ? (
          <div className="crm-page__actions">
            <Link className="crm-button" href={`/app/customers/${customer.id}/edit`}>
              {content.common.edit}
            </Link>
            <CrmConfirmationAction
              action={archiveCustomerAction}
              disabled={customer.status === "ARCHIVED"}
              locale={locale}
              target={{
                kind: "customer",
                customerId: customer.id,
                expectedVersion: customer.version,
              }}
            >
              {content.common.archive}
            </CrmConfirmationAction>
          </div>
        ) : null}
      </header>

      {canManage ? (
        <nav className="crm-subnavigation" aria-label={customer.displayName}>
          <Link href={`/app/customers/${customer.id}/contacts/new`}>
            {content.forms.contact.createTitle}
          </Link>
          <Link href={`/app/customers/${customer.id}/properties/new`}>
            {content.forms.property.createTitle}
          </Link>
          {canManageIdentity ? (
            <Link href={`/app/customers/${customer.id}/access/new`}>
              {content.forms.identityLink.title}
            </Link>
          ) : null}
        </nav>
      ) : null}

      <StaffCustomerCard customer={customer} locale={locale} />

      <section className="crm-management-card" aria-labelledby="property-links-heading">
        <h2 id="property-links-heading">{content.detail.properties}</h2>
        {customer.properties.length === 0 ? (
          <p>{content.detail.noProperties}</p>
        ) : (
          <ul className="crm-record-actions">
            {customer.properties.map((property) => (
              <li key={property.id}>
                <span>{property.label}</span>
                <Link
                  className="crm-button"
                  href={`/app/customers/${customer.id}/properties/${property.id}`}
                >
                  {content.list.open}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage && customer.contacts.some((contact) => contact.active) ? (
        <section className="crm-management-card" aria-labelledby="contact-actions-heading">
          <h2 id="contact-actions-heading">{content.detail.contacts}</h2>
          <ul className="crm-record-actions">
            {customer.contacts
              .filter((contact) => contact.active)
              .map((contact) => (
                <li key={contact.id}>
                  <span>{contact.contactName}</span>
                  <ContactArchiveAction
                    action={archiveContactAction}
                    contactId={contact.id}
                    expectedVersion={contact.version}
                    locale={locale}
                  />
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {canManageIdentity && customer.identityLinks.some((link) => link.active) ? (
        <section className="crm-management-card" aria-labelledby="access-actions-heading">
          <h2 id="access-actions-heading">{content.detail.identityAccess}</h2>
          <ul className="crm-record-actions">
            {customer.identityLinks
              .filter((link) => link.active)
              .map((link) => (
                <li key={link.id}>
                  <span>{content.labels.identityRelationships[link.relationshipType]}</span>
                  <CrmConfirmationAction
                    action={revokeCustomerIdentityLinkAction}
                    locale={locale}
                    target={{ kind: "identity-link", linkId: link.id }}
                  >
                    {content.forms.identityLink.revoke}
                  </CrmConfirmationAction>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
