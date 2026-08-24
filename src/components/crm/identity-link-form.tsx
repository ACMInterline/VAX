"use client";

import type { AuthLocale } from "@/auth/validation";
import { crmContent } from "@/content/crm";
import { customerIdentityRelationshipTypes } from "@/modules/customer-crm/types";
import { crmStringValue, type CrmFormAction } from "./action-state";
import {
  CrmFieldError,
  CrmFormFeedback,
  CrmSubmitButton,
  crmFieldAccessibility,
  crmFieldId,
  useCrmAction,
  type CrmFormFieldDefinition,
} from "./form-support";

export function IdentityLinkForm({
  action,
  customerId,
  locale,
}: {
  action: CrmFormAction;
  customerId: string;
  locale: AuthLocale;
}) {
  const [state, formAction, pending] = useCrmAction(action);
  const content = crmContent[locale];
  const prefix = `crm-identity-link-${customerId}`;
  const fieldId = (name: string) => crmFieldId(prefix, name);
  const value = (name: string, fallback = "") =>
    crmStringValue(state, name, fallback);
  const fields: CrmFormFieldDefinition[] = [
    {
      name: "userProfileId",
      id: fieldId("userProfileId"),
      label: content.forms.identityLink.profileId,
    },
    {
      name: "relationshipType",
      id: fieldId("relationshipType"),
      label: content.forms.identityLink.relationship,
    },
  ];
  const profileHintId = `${prefix}-profile-hint`;

  return (
    <form
      action={formAction}
      className="crm-form crm-form--identity-link crm-form--create"
      aria-busy={pending}
      aria-labelledby={`${prefix}-title`}
      noValidate
    >
      <input type="hidden" name="customerId" value={customerId} />
      <h2 id={`${prefix}-title`}>{content.forms.identityLink.title}</h2>
      <p className="crm-form__intro">{content.forms.identityLink.intro}</p>
      <CrmFormFeedback
        fields={fields}
        state={state}
        title={content.common.validationSummaryTitle}
      />
      <div className="crm-form__grid">
        <div className="crm-form__field crm-form__field--wide">
          <label htmlFor={fieldId("userProfileId")}>
            {content.forms.identityLink.profileId}
          </label>
          <input
            id={fieldId("userProfileId")}
            name="userProfileId"
            type="text"
            inputMode="text"
            autoComplete="off"
            required
            maxLength={36}
            spellCheck={false}
            autoCapitalize="none"
            defaultValue={value("userProfileId")}
            {...crmFieldAccessibility(
              state,
              "userProfileId",
              fieldId("userProfileId"),
              profileHintId,
            )}
          />
          <p className="crm-form__hint" id={profileHintId}>
            {content.forms.identityLink.profileIdHint}
          </p>
          <CrmFieldError
            fieldId={fieldId("userProfileId")}
            name="userProfileId"
            state={state}
          />
        </div>

        <div className="crm-form__field">
          <label htmlFor={fieldId("relationshipType")}>
            {content.forms.identityLink.relationship}
          </label>
          <select
            id={fieldId("relationshipType")}
            name="relationshipType"
            defaultValue={value("relationshipType", "AUTHORIZED_CONTACT")}
            required
            {...crmFieldAccessibility(
              state,
              "relationshipType",
              fieldId("relationshipType"),
            )}
          >
            {customerIdentityRelationshipTypes.map((value) => (
              <option key={value} value={value}>
                {content.labels.identityRelationships[value]}
              </option>
            ))}
          </select>
          <CrmFieldError
            fieldId={fieldId("relationshipType")}
            name="relationshipType"
            state={state}
          />
        </div>
      </div>
      <div className="crm-form__actions">
        <CrmSubmitButton
          idleLabel={content.forms.identityLink.link}
          pending={pending}
          pendingLabel={content.common.saving}
        />
      </div>
    </form>
  );
}
