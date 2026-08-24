"use client";

import type { ReactNode } from "react";
import type { AuthLocale } from "@/auth/validation";
import { ApplicationConfirmationAction } from "@/components/application/confirmation-action";
import { crmContent } from "@/content/crm";
import {
  initialCrmActionState,
  type CrmFormAction,
} from "./action-state";

export type CrmConfirmationTarget =
  | Readonly<{ kind: "customer"; customerId: string; expectedVersion: number }>
  | Readonly<{ kind: "property"; propertyId: string; expectedVersion: number }>
  | Readonly<{ kind: "area"; areaId: string; expectedVersion: number }>
  | Readonly<{ kind: "asset"; assetId: string; expectedVersion: number }>
  | Readonly<{ kind: "identity-link"; linkId: string }>;

type ConfirmationPresentation = Readonly<{
  title: string;
  description: string;
  confirmLabel: string;
  fields: Readonly<Record<string, string>>;
}>;

function hiddenFields(
  fields: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  return fields;
}

export function CrmConfirmationAction({
  action,
  children,
  disabled = false,
  locale,
  target,
}: {
  action: CrmFormAction;
  children: ReactNode;
  disabled?: boolean;
  locale: AuthLocale;
  target: CrmConfirmationTarget;
}) {
  const content = crmContent[locale];

  const presentation: ConfirmationPresentation = (() => {
    switch (target.kind) {
      case "customer":
        return {
          title: content.confirmations.archiveCustomerTitle,
          description: content.confirmations.archiveCustomerDescription,
          confirmLabel: content.common.archive,
          fields: hiddenFields({
            customerId: target.customerId,
            expectedVersion: String(target.expectedVersion),
          }),
        };
      case "property":
        return {
          title: content.confirmations.archivePropertyTitle,
          description: content.confirmations.archivePropertyDescription,
          confirmLabel: content.common.archive,
          fields: hiddenFields({
            propertyId: target.propertyId,
            expectedVersion: String(target.expectedVersion),
          }),
        };
      case "area":
        return {
          title: content.confirmations.deactivateAreaTitle,
          description: content.confirmations.deactivateAreaDescription,
          confirmLabel: content.common.confirm,
          fields: hiddenFields({
            areaId: target.areaId,
            expectedVersion: String(target.expectedVersion),
          }),
        };
      case "asset":
        return {
          title: content.confirmations.archiveAssetTitle,
          description: content.confirmations.archiveAssetDescription,
          confirmLabel: content.common.archive,
          fields: hiddenFields({
            assetId: target.assetId,
            expectedVersion: String(target.expectedVersion),
          }),
        };
      case "identity-link":
        return {
          title: content.forms.identityLink.revokeTitle,
          description: content.forms.identityLink.revokeDescription,
          confirmLabel: content.forms.identityLink.revoke,
          fields: hiddenFields({ linkId: target.linkId }),
        };
    }
  })();

  return (
    <ApplicationConfirmationAction
      action={action}
      cancelLabel={content.common.cancel}
      confirmLabel={presentation.confirmLabel}
      description={presentation.description}
      disabled={disabled}
      fields={presentation.fields}
      initialState={initialCrmActionState}
      pendingLabel={content.common.saving}
      title={presentation.title}
      variant="danger"
    >
      {children}
    </ApplicationConfirmationAction>
  );
}
