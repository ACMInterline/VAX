import Link from "next/link";
import { RequestCreateForm } from "@/components/request-quote/request-create-form";
import { requestQuoteContent } from "@/content/request-quote";
import { getDatabase } from "@/db/client";
import { createDatabaseCustomerCrmRepository } from "@/modules/customer-crm/repository";
import { createCustomerCrmService } from "@/modules/customer-crm/service";
import { createStaffRequestAction } from "../actions";
import { loadStaffRequestCustomerOptions } from "../_lib/options";
import { requireStaffRequestManagePageContext } from "../_lib/request-page";

export const dynamic = "force-dynamic";

export default async function CreateStaffRequestPage() {
  const { actor, locale } = await requireStaffRequestManagePageContext();
  const database = getDatabase();
  const crmService = createCustomerCrmService(
    createDatabaseCustomerCrmRepository(database),
  );
  const customers = await loadStaffRequestCustomerOptions(crmService, actor);
  const content = requestQuoteContent[locale];

  return (
    <section className="crm-page crm-page--form" aria-labelledby="staff-request-heading">
      <Link className="crm-back-link" href="/app/requests">
        {content.common.back}
      </Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.inbox.eyebrow}</p>
          <h1 id="staff-request-heading">{content.forms.staffCreateTitle}</h1>
        </div>
      </header>
      {customers.length === 0 ? (
        <div className="crm-empty-state">
          <p>
            {locale === "bg"
              ? "Първо създайте активен CRM клиент."
              : "Create an active CRM customer first."}
          </p>
          <Link className="crm-button" href="/app/customers/new">
            {locale === "bg" ? "Нов клиент" : "New customer"}
          </Link>
        </div>
      ) : (
        <RequestCreateForm
          action={createStaffRequestAction}
          customers={customers}
          locale={locale}
          mode="staff"
        />
      )}
    </section>
  );
}
