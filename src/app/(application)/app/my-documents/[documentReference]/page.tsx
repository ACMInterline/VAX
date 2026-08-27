import Link from "next/link";
import { ImmutableDocumentView } from "@/components/communications/read-cards";
import { communicationsContent } from "@/content/communications";
import {
  createCommunicationsPageService,
  loadCustomerDocumentOrNotFound,
  parseDocumentRouteParams,
  requireCustomerCommunicationsPageContext,
  type DocumentRouteParams,
} from "../../communications/_lib/communications-page";

export const dynamic = "force-dynamic";

export default async function MyDocumentPage({
  params,
}: {
  params: Promise<DocumentRouteParams>;
}) {
  const contextPromise = requireCustomerCommunicationsPageContext();
  const paramsPromise = parseDocumentRouteParams(params);
  const [{ actor, locale }, { documentReference }] = await Promise.all([
    contextPromise,
    paramsPromise,
  ]);
  const document = await loadCustomerDocumentOrNotFound(
    createCommunicationsPageService(),
    actor,
    documentReference,
  );
  const content = communicationsContent[locale];

  return (
    <section className="crm-page crm-page--self" aria-labelledby="document-page-heading">
      <Link className="crm-back-link" href="/app/my-communications">{content.common.back}</Link>
      <h1 id="document-page-heading" lang={document.locale}>
        {document.content.title}
      </h1>
      <p className="crm-form__notice">{content.customer.documentNotice}</p>
      <ImmutableDocumentView document={document} />
    </section>
  );
}
