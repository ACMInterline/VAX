import Link from "next/link";
import { notFound } from "next/navigation";
import { StaffAssetHistoryCard } from "@/components/job-execution";
import {
  createCustomerCrmPageService,
  loadStaffPropertyOrNotFound,
} from "@/app/(application)/app/customers/_lib/crm-page";
import {
  createJobPageService,
  loadStaffAssetHistoryOrNotFound,
  parseStaffPassportRouteParams,
  requireStaffPassportPageContext,
  type StaffPassportRouteParams,
} from "@/app/(application)/app/jobs/_lib/job-page";
import { presentStaffAssetHistory } from "@/app/(application)/app/jobs/_lib/job-presentation";

export const dynamic = "force-dynamic";

export default async function StaffAssetHistoryPage({
  params,
}: {
  params: Promise<StaffPassportRouteParams>;
}) {
  const { actor, locale } = await requireStaffPassportPageContext();
  const route = await parseStaffPassportRouteParams(params);
  const { customer, property } = await loadStaffPropertyOrNotFound(
    createCustomerCrmPageService(),
    actor,
    { customerId: route.customerId, propertyId: route.propertyId },
  );
  if (!property.cleaningAssets.some((asset) => asset.id === route.assetId)) {
    notFound();
  }

  const history = await loadStaffAssetHistoryOrNotFound(
    createJobPageService(),
    actor,
    { propertyId: route.propertyId, assetId: route.assetId },
  );
  const view = presentStaffAssetHistory(history, property.label);
  const back = locale === "bg" ? "Към имота" : "Back to property";
  const pageTitle =
    locale === "bg" ? "История на почистванията" : "Cleaning history";

  return (
    <section
      className="crm-page"
      aria-labelledby="staff-cleaning-history-heading"
    >
      <Link
        className="crm-back-link"
        href={`/app/customers/${customer.id}/properties/${property.id}`}
      >
        {back}
      </Link>
      <h1 id="staff-cleaning-history-heading">{pageTitle}</h1>
      <StaffAssetHistoryCard history={view} locale={locale} />
    </section>
  );
}
