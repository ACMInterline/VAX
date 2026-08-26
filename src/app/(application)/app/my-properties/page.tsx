import { Fragment } from "react";
import Link from "next/link";
import { CustomerSelfServiceCard } from "@/components/crm/customer-self-service-card";
import { crmContent } from "@/content/crm";
import type { CustomerSelfDetail } from "@/modules/customer-crm/types";
import {
  createCustomerCrmPageService,
  loadLinkedCustomerFromSummary,
  requireSelfCrmPageContext,
} from "../customers/_lib/crm-page";

export const dynamic = "force-dynamic";

function isLinkedDetail(
  detail: CustomerSelfDetail | null,
): detail is CustomerSelfDetail {
  return detail !== null;
}

export default async function MyPropertiesPage() {
  const { actor, locale } = await requireSelfCrmPageContext();
  const service = createCustomerCrmPageService();
  const summaries = await service.listMyCustomers(actor);
  const linkedDetails = (
    await Promise.all(
      summaries.map((summary) =>
        loadLinkedCustomerFromSummary(service, actor, summary.id),
      ),
    )
  ).filter(isLinkedDetail);
  const content = crmContent[locale];
  const passportLabel =
    locale === "bg" ? "Паспорт на почистването" : "Cleaning passport";

  return (
    <section className="crm-page crm-page--self" aria-labelledby="my-properties-heading">
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.selfService.eyebrow}</p>
          <h1 id="my-properties-heading">{content.selfService.title}</h1>
          <p>{content.selfService.intro}</p>
        </div>
      </header>

      {linkedDetails.length === 0 ? (
        <div className="crm-empty-state crm-empty-state--prominent">
          <h2>{content.selfService.notLinkedTitle}</h2>
          <p>{content.selfService.notLinkedText}</p>
        </div>
      ) : (
        <div className="crm-self-service-list">
          {linkedDetails.map((customer) => {
            const passportAssets = customer.properties.flatMap((property) =>
              property.status === "ARCHIVED"
                ? []
                : property.cleaningAssets
                    .filter((asset) => asset.status !== "ARCHIVED")
                    .map((asset) => ({ asset, property })),
            );
            return (
              <Fragment key={customer.id}>
                <CustomerSelfServiceCard customer={customer} locale={locale} />
                {passportAssets.length > 0 ? (
                  <nav
                    className="crm-subnavigation"
                    aria-label={`${passportLabel}: ${customer.displayName}`}
                  >
                    {passportAssets.map(({ asset, property }) => (
                      <Link
                        key={asset.id}
                        href={`/app/my-properties/${property.id}/assets/${asset.id}`}
                      >
                        {passportLabel}: {property.label} · {asset.label}
                      </Link>
                    ))}
                  </nav>
                ) : null}
              </Fragment>
            );
          })}
        </div>
      )}
    </section>
  );
}
