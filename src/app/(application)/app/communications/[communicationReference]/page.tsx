import Link from "next/link";
import { ApplicationStatusBadge } from "@/components/application/status-badge";
import { communicationsContent } from "@/content/communications";
import {
  createCommunicationsPageService,
  loadStaffCommunicationOrNotFound,
  parseCommunicationRouteParams,
  requireStaffCommunicationsPageContext,
  type CommunicationRouteParams,
} from "../_lib/communications-page";

export const dynamic = "force-dynamic";

export default async function CommunicationDetailPage({
  params,
}: {
  params: Promise<CommunicationRouteParams>;
}) {
  const contextPromise = requireStaffCommunicationsPageContext();
  const paramsPromise = parseCommunicationRouteParams(params);
  const [{ actor, locale }, { communicationReference }] = await Promise.all([
    contextPromise,
    paramsPromise,
  ]);
  const item = await loadStaffCommunicationOrNotFound(
    createCommunicationsPageService(),
    actor,
    communicationReference,
  );
  const content = communicationsContent[locale];

  return (
    <article className="crm-page" aria-labelledby="communication-detail-heading">
      <Link className="crm-back-link" href="/app/communications">{content.common.back}</Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.events[item.eventType]}</p>
          <h1 id="communication-detail-heading">{item.title ?? content.staff.detailTitle}</h1>
        </div>
        <ApplicationStatusBadge label={content.statuses[item.status]} />
      </header>
      <section className="crm-card" aria-label={content.staff.detailTitle}>
        <dl className="crm-card__details">
          <div><dt>{content.common.reference}</dt><dd>{item.communicationReference}</dd></div>
          <div><dt>{content.common.source}</dt><dd>{item.sourceReference}</dd></div>
          <div><dt>{content.common.channel}</dt><dd>{content.channels[item.channel]}</dd></div>
          <div><dt>{content.common.locale}</dt><dd>{item.locale.toUpperCase()}</dd></div>
          <div><dt>{content.staff.template}</dt><dd>{item.templateKey} v{item.templateVersion}</dd></div>
          <div><dt>{content.staff.contactSelected}</dt><dd>{item.contactSelected ? (locale === "bg" ? "Да" : "Yes") : (locale === "bg" ? "Не" : "No")}</dd></div>
          <div><dt>{content.staff.checksum}</dt><dd>{item.checksumSha256 ?? content.common.noValue}</dd></div>
        </dl>
      </section>
    </article>
  );
}
