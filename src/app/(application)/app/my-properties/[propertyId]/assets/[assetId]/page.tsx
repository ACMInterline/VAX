import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerCleaningPassportCard } from "@/components/job-execution";
import type { CustomerSelfDetail } from "@/modules/customer-crm/types";
import {
  createCustomerCrmPageService,
  loadLinkedCustomerFromSummary,
} from "@/app/(application)/app/customers/_lib/crm-page";
import {
  createJobPageService,
  loadCustomerPassportOrNotFound,
  parsePassportRouteParams,
  requireCustomerPassportPageContext,
  type PassportRouteParams,
} from "@/app/(application)/app/jobs/_lib/job-page";
import { presentCustomerPassport } from "@/app/(application)/app/jobs/_lib/job-presentation";

export const dynamic = "force-dynamic";

function isLinkedDetail(
  detail: CustomerSelfDetail | null,
): detail is CustomerSelfDetail {
  return detail !== null;
}

export default async function CustomerCleaningPassportPage({
  params,
}: {
  params: Promise<PassportRouteParams>;
}) {
  const { actor, locale } = await requireCustomerPassportPageContext();
  const route = await parsePassportRouteParams(params);
  const crmService = createCustomerCrmPageService();
  const summaries = await crmService.listMyCustomers(actor);
  const linkedCustomers = (
    await Promise.all(
      summaries.map((summary) =>
        loadLinkedCustomerFromSummary(crmService, actor, summary.id),
      ),
    )
  ).filter(isLinkedDetail);
  const property = linkedCustomers
    .flatMap((customer) => customer.properties)
    .find(
      (candidate) =>
        candidate.id === route.propertyId &&
        candidate.cleaningAssets.some((asset) => asset.id === route.assetId),
    );
  if (!property) notFound();

  const passport = await loadCustomerPassportOrNotFound(
    createJobPageService(),
    actor,
    route,
  );
  const view = presentCustomerPassport(passport, property.label);
  const back = locale === "bg" ? "Към моите имоти" : "Back to my properties";
  const pageTitle =
    locale === "bg" ? "Паспорт на почистванията" : "Cleaning passport";

  return (
    <section
      className="crm-page crm-page--self"
      aria-labelledby="customer-cleaning-passport-heading"
    >
      <Link className="crm-back-link" href="/app/my-properties">
        {back}
      </Link>
      <h1 id="customer-cleaning-passport-heading">{pageTitle}</h1>
      <CustomerCleaningPassportCard passport={view} locale={locale} />
    </section>
  );
}
