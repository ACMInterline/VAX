import { ApplicationConfirmationAction } from "@/components/application/confirmation-action";
import {
  initialCrmActionState,
  type CrmFormAction,
} from "@/components/crm/action-state";
import { crmContent } from "@/content/crm";
import type { AuthLocale } from "@/auth/validation";

const copy = {
  bg: {
    title: "Архивиране на контакт",
    description:
      "Контактът ще стане неактивен, но историята на клиентския запис ще бъде запазена.",
  },
  en: {
    title: "Archive contact",
    description:
      "The contact will become inactive while the customer record history remains available.",
  },
} as const;

export function ContactArchiveAction({
  action,
  contactId,
  expectedVersion,
  locale,
}: {
  action: CrmFormAction;
  contactId: string;
  expectedVersion: number;
  locale: AuthLocale;
}) {
  const content = crmContent[locale];
  return (
    <ApplicationConfirmationAction
      action={action}
      cancelLabel={content.common.cancel}
      confirmLabel={content.common.archive}
      description={copy[locale].description}
      fields={{ contactId, expectedVersion: String(expectedVersion) }}
      initialState={initialCrmActionState}
      pendingLabel={content.common.saving}
      title={copy[locale].title}
      variant="danger"
    >
      {content.common.archive}
    </ApplicationConfirmationAction>
  );
}
