import { CommunicationPreferencesForm } from "@/components/communications/forms";
import { CustomerCommunicationList } from "@/components/communications/read-cards";
import { communicationsContent } from "@/content/communications";
import { updateCommunicationPreferencesAction } from "../communications/actions";
import {
  createCommunicationsPageService,
  requireCustomerCommunicationsPageContext,
} from "../communications/_lib/communications-page";

export const dynamic = "force-dynamic";

export default async function MyCommunicationsPage() {
  const { actor, locale } = await requireCustomerCommunicationsPageContext();
  const service = createCommunicationsPageService();
  const [entries, preferences] = await Promise.all([
    service.listMyCommunications(actor),
    service.getMyPreferences(actor),
  ]);
  const content = communicationsContent[locale];

  return (
    <section className="crm-page crm-page--self" aria-labelledby="my-communications-heading">
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.customer.eyebrow}</p>
          <h1 id="my-communications-heading">{content.customer.title}</h1>
          <p>{content.customer.intro}</p>
        </div>
      </header>
      <CommunicationPreferencesForm
        action={updateCommunicationPreferencesAction}
        content={content}
        preferences={preferences}
      />
      {entries.length === 0 ? (
        <div className="crm-empty-state">
          <h2>{content.customer.emptyTitle}</h2>
          <p>{content.customer.emptyText}</p>
        </div>
      ) : (
        <CustomerCommunicationList entries={entries} content={content} locale={locale} />
      )}
    </section>
  );
}
