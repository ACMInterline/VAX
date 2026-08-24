"use client";

import type { AuthLocale } from "@/auth/validation";
import { crmContent } from "@/content/crm";
import {
  preferredContactMethods,
  preferredLocales,
  type PreferredContactMethod,
  type PreferredLocale,
} from "@/modules/customer-crm/types";
import {
  crmStringValue,
  crmStringValues,
  type CrmFormAction,
} from "./action-state";
import {
  CrmFieldError,
  CrmFormFeedback,
  CrmSubmitButton,
  crmFieldAccessibility,
  crmFieldId,
  useCrmAction,
  type CrmFormFieldDefinition,
} from "./form-support";

export type ContactFormInitialValues = Readonly<{
  contactName?: string;
  email?: string | null;
  phone?: string | null;
  roleTitle?: string | null;
  isPrimary?: boolean;
  preferredContactMethod?: PreferredContactMethod;
  locale?: PreferredLocale;
}>;

export function ContactForm({
  action,
  customerId,
  initialValues,
  locale,
}: {
  action: CrmFormAction;
  customerId: string;
  initialValues?: ContactFormInitialValues;
  locale: AuthLocale;
}) {
  const [state, formAction, pending] = useCrmAction(action);
  const content = crmContent[locale];
  const prefix = `crm-contact-${customerId}`;
  const fieldId = (name: string) => crmFieldId(prefix, name);
  const value = (name: string, fallback?: string | null) =>
    crmStringValue(state, name, fallback ?? "");
  const fields: CrmFormFieldDefinition[] = [
    { name: "contactName", id: fieldId("contactName"), label: content.forms.contact.name },
    { name: "email", id: fieldId("email"), label: content.forms.contact.email },
    { name: "phone", id: fieldId("phone"), label: content.forms.contact.phone },
    { name: "roleTitle", id: fieldId("roleTitle"), label: content.forms.contact.roleTitle },
    {
      name: "preferredContactMethod",
      id: fieldId("preferredContactMethod"),
      label: content.forms.contact.preferredContactMethod,
    },
    { name: "locale", id: fieldId("locale"), label: content.forms.contact.locale },
    { name: "isPrimary", id: fieldId("isPrimary"), label: content.forms.contact.isPrimary },
  ];

  return (
    <form
      action={formAction}
      className="crm-form crm-form--contact crm-form--create"
      aria-busy={pending}
      aria-labelledby={`${prefix}-title`}
      noValidate
    >
      <input type="hidden" name="customerId" value={customerId} />
      <h2 id={`${prefix}-title`}>{content.forms.contact.createTitle}</h2>
      <CrmFormFeedback
        fields={fields}
        state={state}
        title={content.common.validationSummaryTitle}
      />
      <div className="crm-form__grid">
        <div className="crm-form__field">
          <label htmlFor={fieldId("contactName")}>{content.forms.contact.name}</label>
          <input
            id={fieldId("contactName")}
            name="contactName"
            type="text"
            autoComplete="name"
            defaultValue={value("contactName", initialValues?.contactName)}
            required
            maxLength={160}
            {...crmFieldAccessibility(state, "contactName", fieldId("contactName"))}
          />
          <CrmFieldError fieldId={fieldId("contactName")} name="contactName" state={state} />
        </div>

        <div className="crm-form__field">
          <label htmlFor={fieldId("roleTitle")}>{content.forms.contact.roleTitle}</label>
          <input
            id={fieldId("roleTitle")}
            name="roleTitle"
            type="text"
            autoComplete="organization-title"
            defaultValue={value("roleTitle", initialValues?.roleTitle)}
            maxLength={160}
            {...crmFieldAccessibility(state, "roleTitle", fieldId("roleTitle"))}
          />
          <CrmFieldError fieldId={fieldId("roleTitle")} name="roleTitle" state={state} />
        </div>

        <div className="crm-form__field">
          <label htmlFor={fieldId("email")}>{content.forms.contact.email}</label>
          <input
            id={fieldId("email")}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={value("email", initialValues?.email)}
            maxLength={254}
            {...crmFieldAccessibility(state, "email", fieldId("email"))}
          />
          <CrmFieldError fieldId={fieldId("email")} name="email" state={state} />
        </div>

        <div className="crm-form__field">
          <label htmlFor={fieldId("phone")}>{content.forms.contact.phone}</label>
          <input
            id={fieldId("phone")}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={value("phone", initialValues?.phone)}
            minLength={6}
            maxLength={40}
            {...crmFieldAccessibility(state, "phone", fieldId("phone"))}
          />
          <CrmFieldError fieldId={fieldId("phone")} name="phone" state={state} />
        </div>

        <div className="crm-form__field">
          <label htmlFor={fieldId("preferredContactMethod")}>
            {content.forms.contact.preferredContactMethod}
          </label>
          <select
            id={fieldId("preferredContactMethod")}
            name="preferredContactMethod"
            defaultValue={value(
              "preferredContactMethod",
              initialValues?.preferredContactMethod ?? "NO_PREFERENCE",
            )}
            required
            {...crmFieldAccessibility(
              state,
              "preferredContactMethod",
              fieldId("preferredContactMethod"),
            )}
          >
            {preferredContactMethods.map((value) => (
              <option key={value} value={value}>
                {content.labels.contactMethods[value]}
              </option>
            ))}
          </select>
          <CrmFieldError
            fieldId={fieldId("preferredContactMethod")}
            name="preferredContactMethod"
            state={state}
          />
        </div>

        <div className="crm-form__field">
          <label htmlFor={fieldId("locale")}>{content.forms.contact.locale}</label>
          <select
            id={fieldId("locale")}
            name="locale"
            defaultValue={value("locale", initialValues?.locale ?? locale)}
            required
            {...crmFieldAccessibility(state, "locale", fieldId("locale"))}
          >
            {preferredLocales.map((value) => (
              <option key={value} value={value}>
                {content.labels.locales[value]}
              </option>
            ))}
          </select>
          <CrmFieldError fieldId={fieldId("locale")} name="locale" state={state} />
        </div>

        <div className="crm-form__field crm-form__field--checkbox">
          <label htmlFor={fieldId("isPrimary")}>
            <input
              id={fieldId("isPrimary")}
              name="isPrimary"
              type="checkbox"
              value="true"
              defaultChecked={crmStringValues(
                state,
                "isPrimary",
                initialValues?.isPrimary ? ["true"] : [],
              ).includes("true")}
              {...crmFieldAccessibility(state, "isPrimary", fieldId("isPrimary"))}
            />
            <span>{content.forms.contact.isPrimary}</span>
          </label>
          <CrmFieldError fieldId={fieldId("isPrimary")} name="isPrimary" state={state} />
        </div>
      </div>

      <div className="crm-form__actions">
        <CrmSubmitButton
          idleLabel={content.common.add}
          pending={pending}
          pendingLabel={content.common.saving}
        />
      </div>
    </form>
  );
}
