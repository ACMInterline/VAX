import Link from "next/link";
import { RequestCreateForm } from "@/components/request-quote/request-create-form";
import { requestQuoteContent } from "@/content/request-quote";
import { getDatabase } from "@/db/client";
import { createDatabaseCustomerCrmRepository } from "@/modules/customer-crm/repository";
import { createCustomerCrmService } from "@/modules/customer-crm/service";
import { createCustomerRequestAction } from "../../requests/actions";
import { loadCustomerRequestCustomerOptions } from "../../requests/_lib/options";
import { requireCustomerRequestUpdatePageContext } from "../../requests/_lib/request-page";

export const dynamic = "force-dynamic";

export default async function CreateCustomerRequestPage() {
  const { actor, locale } = await requireCustomerRequestUpdatePageContext();
  const database = getDatabase();
  const crmService = createCustomerCrmService(
    createDatabaseCustomerCrmRepository(database),
  );
  const customers = await loadCustomerRequestCustomerOptions(crmService, actor);
  const content = requestQuoteContent[locale];
  const selectable = customers.filter((customer) => customer.properties.length > 0);

  return (
    <section className="crm-page crm-page--form" aria-labelledby="customer-request-heading">
      <Link className="crm-back-link" href="/app/my-requests">
        {content.common.back}
      </Link>
      <header className="crm-page__header">
        <div>
          <p className="eyebrow">{content.inbox.eyebrow}</p>
          <h1 id="customer-request-heading">{content.forms.customerCreateTitle}</h1>
        </div>
      </header>
      {selectable.length === 0 ? (
        <div className="crm-empty-state">
          <p>
            {locale === "bg"
              ? "Нямате активен свързан клиент с активен имот. Свържете се с екипа."
              : "You do not have an active linked customer with an active property. Contact the team."}
          </p>
        </div>
      ) : (
        <RequestCreateForm
          action={createCustomerRequestAction}
          customers={selectable}
          locale={locale}
          mode="customer"
        />
      )}
    </section>
  );
}
