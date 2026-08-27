import { randomUUID } from "node:crypto";
import Link from "next/link";
import { CreatePortalCommunicationForm } from "@/components/communications/forms";
import { StaffCommunicationList } from "@/components/communications/read-cards";
import { communicationsContent } from "@/content/communications";
import { communicationIntentStatuses } from "@/modules/communications-documents/types";
import { createPortalCommunicationAction } from "./actions";
import {
  createCommunicationsPageService,
  parseCommunicationSearchParams,
  requireStaffCommunicationsPageContext,
  type CommunicationSearchParams,
} from "./_lib/communications-page";

export const dynamic = "force-dynamic";

function pageHref(page: number, status: string | undefined): string {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return suffix ? `/app/communications?${suffix}` : "/app/communications";
}

export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<CommunicationSearchParams>;
}) {
  const contextPromise = requireStaffCommunicationsPageContext();
  const parsedPromise = parseCommunicationSearchParams(searchParams);
  const [{ actor, locale }, parsed] = await Promise.all([
    contextPromise,
    parsedPromise,
  ]);
  const result = await createCommunicationsPageService().listStaffCommunications(
    actor,
    parsed.filters,
  );
  const content = communicationsContent[locale];
  const hasPrevious = parsed.page > 1;
  const hasNext = result.offset + result.items.length < result.total;

  return (
    <section className="crm-page" aria-labelledby="communications-heading">
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.staff.eyebrow}</p>
          <h1 id="communications-heading">{content.staff.title}</h1>
          <p>{content.staff.intro}</p>
        </div>
      </header>
      <CreatePortalCommunicationForm
        action={createPortalCommunicationAction}
        content={content}
        idempotencyKey={randomUUID()}
      />
      <form className="crm-filter-bar" method="get" action="/app/communications">
        <div className="crm-form__field">
          <label htmlFor="communication-status-filter">{content.common.status}</label>
          <select id="communication-status-filter" name="status" defaultValue={parsed.status ?? ""}>
            <option value="">—</option>
            {communicationIntentStatuses.map((status) => (
              <option key={status} value={status}>{content.statuses[status]}</option>
            ))}
          </select>
        </div>
        <button className="crm-form__submit" type="submit">{locale === "bg" ? "Филтрирай" : "Filter"}</button>
      </form>
      {result.items.length === 0 ? (
        <div className="crm-empty-state"><p>{content.staff.empty}</p></div>
      ) : (
        <StaffCommunicationList communications={result.items} content={content} locale={locale} />
      )}
      {hasPrevious || hasNext ? (
        <nav aria-label={locale === "bg" ? "Страници" : "Pages"}>
          <ul className="crm-record-actions">
            {hasPrevious ? <li><Link href={pageHref(parsed.page - 1, parsed.status)}>{locale === "bg" ? "Предишна" : "Previous"}</Link></li> : null}
            {hasNext ? <li><Link href={pageHref(parsed.page + 1, parsed.status)}>{locale === "bg" ? "Следваща" : "Next"}</Link></li> : null}
          </ul>
        </nav>
      ) : null}
    </section>
  );
}
