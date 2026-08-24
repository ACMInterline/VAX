"use client";

import { useState } from "react";
import type { AuthLocale } from "@/auth/validation";
import { crmContent } from "@/content/crm";
import {
  customerTypes,
  preferredContactMethods,
  preferredLocales,
  type CustomerType,
  type PreferredContactMethod,
  type PreferredLocale,
} from "@/modules/customer-crm/types";
import { crmStringValue, type CrmFormAction } from "./action-state";
import { crmComponentContent } from "./component-content";
import {
  CrmFieldError,
  CrmFormFeedback,
  CrmSubmitButton,
  crmFieldAccessibility,
  crmFieldId,
  useCrmAction,
  type CrmFormFieldDefinition,
} from "./form-support";

export type CustomerInitialContactValues = Readonly<{
  contactName?: string;
  email?: string | null;
  phone?: string | null;
  roleTitle?: string | null;
  preferredContactMethod?: PreferredContactMethod;
  locale?: PreferredLocale;
}>;

export type CustomerCreateInitialValues = Readonly<{
  customerType?: CustomerType;
  displayName?: string;
  legalName?: string | null;
  preferredLocale?: PreferredLocale;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  internalNotes?: string | null;
  initialContact?: CustomerInitialContactValues;
}>;

export type CustomerEditInitialValues = Readonly<{
  customerId: string;
  expectedVersion: number;
  customerType: CustomerType;
  displayName: string;
  legalName: string | null;
  preferredLocale: PreferredLocale;
  primaryEmail: string | null;
  primaryPhone: string | null;
  internalNotes: string | null;
}>;

type CustomerFormProps = Readonly<{
  action: CrmFormAction;
  locale: AuthLocale;
}> &
  (
    | Readonly<{
        mode: "create";
        initialValues?: CustomerCreateInitialValues;
      }>
    | Readonly<{
        mode: "edit";
        initialValues: CustomerEditInitialValues;
      }>
  );

export function CustomerForm(props: CustomerFormProps) {
  const { action, locale, mode } = props;
  const content = crmContent[locale];
  const componentContent = crmComponentContent[locale];
  const initialValues = props.initialValues;
  const [state, formAction, pending] = useCrmAction(action);
  const initialType = initialValues?.customerType ?? "INDIVIDUAL";
  const [customerTypeOverride, setCustomerTypeOverride] =
    useState<CustomerType | null>(null);
  const editValues = mode === "edit" ? props.initialValues : undefined;
  const createValues = mode === "create" ? props.initialValues : undefined;
  const prefix =
    mode === "edit"
      ? `crm-customer-${props.initialValues.customerId}`
      : "crm-customer-create";
  const title =
    mode === "edit"
      ? content.forms.customer.editTitle
      : content.forms.customer.createTitle;
  const submitLabel = mode === "edit" ? content.common.save : content.common.create;
  const contactValues = createValues?.initialContact;

  const submittedType = crmStringValue(state, "customerType");
  const selectedCustomerType =
    customerTypeOverride ??
    (customerTypes.some((value) => value === submittedType)
      ? (submittedType as CustomerType)
      : initialType);

  const fields: CrmFormFieldDefinition[] = [
    {
      name: "customerType",
      id: crmFieldId(prefix, "customerType"),
      label: content.forms.customer.customerType,
    },
    {
      name: "displayName",
      id: crmFieldId(prefix, "displayName"),
      label: content.forms.customer.displayName,
    },
    {
      name: "legalName",
      id: crmFieldId(prefix, "legalName"),
      label: content.forms.customer.legalName,
    },
    {
      name: "preferredLocale",
      id: crmFieldId(prefix, "preferredLocale"),
      label: content.forms.customer.preferredLocale,
    },
    {
      name: "primaryEmail",
      id: crmFieldId(prefix, "primaryEmail"),
      label: content.forms.customer.primaryEmail,
    },
    {
      name: "primaryPhone",
      id: crmFieldId(prefix, "primaryPhone"),
      label: content.forms.customer.primaryPhone,
    },
    {
      name: "internalNotes",
      id: crmFieldId(prefix, "internalNotes"),
      label: content.forms.customer.internalNotes,
    },
  ];

  if (mode === "create" && selectedCustomerType === "BUSINESS") {
    fields.push(
      {
        name: "initialContact",
        id: crmFieldId(prefix, "initialContact"),
        label: content.forms.customer.initialContactLegend,
      },
      {
        name: "initialContact.contactName",
        id: crmFieldId(prefix, "initialContact.contactName"),
        label: content.forms.customer.contactName,
      },
      {
        name: "initialContact.email",
        id: crmFieldId(prefix, "initialContact.email"),
        label: content.forms.contact.email,
      },
      {
        name: "initialContact.phone",
        id: crmFieldId(prefix, "initialContact.phone"),
        label: content.forms.contact.phone,
      },
      {
        name: "initialContact.roleTitle",
        id: crmFieldId(prefix, "initialContact.roleTitle"),
        label: content.forms.customer.contactRole,
      },
      {
        name: "initialContact.preferredContactMethod",
        id: crmFieldId(prefix, "initialContact.preferredContactMethod"),
        label: content.forms.contact.preferredContactMethod,
      },
      {
        name: "initialContact.locale",
        id: crmFieldId(prefix, "initialContact.locale"),
        label: content.forms.contact.locale,
      },
    );
  }

  const fieldId = (name: string) => crmFieldId(prefix, name);
  const value = (name: string, fallback?: string | null) =>
    crmStringValue(state, name, fallback ?? "");
  const initialContactHintId = `${prefix}-initial-contact-hint`;
  const internalNotesHintId = `${prefix}-internal-notes-hint`;

  return (
    <form
      action={formAction}
      className={`crm-form crm-form--customer crm-form--${mode}`}
      aria-busy={pending}
      aria-labelledby={`${prefix}-title`}
      noValidate
    >
      {editValues ? (
        <>
          <input type="hidden" name="customerId" value={editValues.customerId} />
          <input
            type="hidden"
            name="expectedVersion"
            value={editValues.expectedVersion}
          />
        </>
      ) : null}
      <h2 id={`${prefix}-title`}>{title}</h2>
      <CrmFormFeedback
        fields={fields}
        state={state}
        title={content.common.validationSummaryTitle}
      />

      <fieldset className="crm-form__section">
        <legend>{content.forms.customer.identityLegend}</legend>
        <div className="crm-form__grid">
          <div className="crm-form__field">
            <label htmlFor={fieldId("customerType")}>
              {content.forms.customer.customerType}
            </label>
            <select
              id={fieldId("customerType")}
              name="customerType"
              value={selectedCustomerType}
              onChange={(event) =>
                setCustomerTypeOverride(event.currentTarget.value as CustomerType)
              }
              required
              {...crmFieldAccessibility(
                state,
                "customerType",
                fieldId("customerType"),
              )}
            >
              {customerTypes.map((value) => (
                <option key={value} value={value}>
                  {content.labels.customerTypes[value]}
                </option>
              ))}
            </select>
            <CrmFieldError
              fieldId={fieldId("customerType")}
              name="customerType"
              state={state}
            />
          </div>

          <div className="crm-form__field">
            <label htmlFor={fieldId("displayName")}>
              {content.forms.customer.displayName}
            </label>
            <input
              id={fieldId("displayName")}
              name="displayName"
              type="text"
              autoComplete="organization name"
              defaultValue={value("displayName", initialValues?.displayName)}
              required
              maxLength={160}
              {...crmFieldAccessibility(
                state,
                "displayName",
                fieldId("displayName"),
              )}
            />
            <CrmFieldError
              fieldId={fieldId("displayName")}
              name="displayName"
              state={state}
            />
          </div>

          <div className="crm-form__field crm-form__field--wide">
            <label htmlFor={fieldId("legalName")}>
              {content.forms.customer.legalName}
            </label>
            <input
              id={fieldId("legalName")}
              name="legalName"
              type="text"
              autoComplete="organization"
              defaultValue={value("legalName", initialValues?.legalName)}
              maxLength={200}
              {...crmFieldAccessibility(
                state,
                "legalName",
                fieldId("legalName"),
                `${prefix}-legal-name-hint`,
              )}
            />
            <p className="crm-form__hint" id={`${prefix}-legal-name-hint`}>
              {content.forms.customer.legalNameHint}
            </p>
            <CrmFieldError
              fieldId={fieldId("legalName")}
              name="legalName"
              state={state}
            />
          </div>

          <div className="crm-form__field">
            <label htmlFor={fieldId("preferredLocale")}>
              {content.forms.customer.preferredLocale}
            </label>
            <select
              id={fieldId("preferredLocale")}
              name="preferredLocale"
              defaultValue={value(
                "preferredLocale",
                initialValues?.preferredLocale ?? locale,
              )}
              required
              {...crmFieldAccessibility(
                state,
                "preferredLocale",
                fieldId("preferredLocale"),
              )}
            >
              {preferredLocales.map((value) => (
                <option key={value} value={value}>
                  {content.labels.locales[value]}
                </option>
              ))}
            </select>
            <CrmFieldError
              fieldId={fieldId("preferredLocale")}
              name="preferredLocale"
              state={state}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="crm-form__section">
        <legend>{content.forms.customer.contactLegend}</legend>
        <div className="crm-form__grid">
          <div className="crm-form__field">
            <label htmlFor={fieldId("primaryEmail")}>
              {content.forms.customer.primaryEmail}
            </label>
            <input
              id={fieldId("primaryEmail")}
              name="primaryEmail"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              defaultValue={value("primaryEmail", initialValues?.primaryEmail)}
              maxLength={254}
              {...crmFieldAccessibility(
                state,
                "primaryEmail",
                fieldId("primaryEmail"),
              )}
            />
            <CrmFieldError
              fieldId={fieldId("primaryEmail")}
              name="primaryEmail"
              state={state}
            />
          </div>

          <div className="crm-form__field">
            <label htmlFor={fieldId("primaryPhone")}>
              {content.forms.customer.primaryPhone}
            </label>
            <input
              id={fieldId("primaryPhone")}
              name="primaryPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              defaultValue={value("primaryPhone", initialValues?.primaryPhone)}
              minLength={6}
              maxLength={40}
              {...crmFieldAccessibility(
                state,
                "primaryPhone",
                fieldId("primaryPhone"),
              )}
            />
            <CrmFieldError
              fieldId={fieldId("primaryPhone")}
              name="primaryPhone"
              state={state}
            />
          </div>
        </div>
      </fieldset>

      {mode === "create" && selectedCustomerType === "BUSINESS" ? (
        <fieldset
          className="crm-form__section crm-form__section--initial-contact"
          id={fieldId("initialContact")}
        >
          <legend>{content.forms.customer.initialContactLegend}</legend>
          <p className="crm-form__hint" id={initialContactHintId}>
            {componentContent.requiredForBusiness}
          </p>
          <CrmFieldError
            fieldId={fieldId("initialContact")}
            name="initialContact"
            state={state}
          />
          <div className="crm-form__grid">
            <div className="crm-form__field">
              <label htmlFor={fieldId("initialContact.contactName")}>
                {content.forms.customer.contactName}
              </label>
              <input
                id={fieldId("initialContact.contactName")}
                name="initialContact.contactName"
                type="text"
                autoComplete="name"
                defaultValue={value(
                  "initialContact.contactName",
                  contactValues?.contactName,
                )}
                required
                maxLength={160}
                {...crmFieldAccessibility(
                  state,
                  "initialContact.contactName",
                  fieldId("initialContact.contactName"),
                )}
              />
              <CrmFieldError
                fieldId={fieldId("initialContact.contactName")}
                name="initialContact.contactName"
                state={state}
              />
            </div>

            <div className="crm-form__field">
              <label htmlFor={fieldId("initialContact.roleTitle")}>
                {content.forms.customer.contactRole}
              </label>
              <input
                id={fieldId("initialContact.roleTitle")}
                name="initialContact.roleTitle"
                type="text"
                autoComplete="organization-title"
                defaultValue={value(
                  "initialContact.roleTitle",
                  contactValues?.roleTitle,
                )}
                maxLength={160}
                {...crmFieldAccessibility(
                  state,
                  "initialContact.roleTitle",
                  fieldId("initialContact.roleTitle"),
                )}
              />
              <CrmFieldError
                fieldId={fieldId("initialContact.roleTitle")}
                name="initialContact.roleTitle"
                state={state}
              />
            </div>

            <div className="crm-form__field">
              <label htmlFor={fieldId("initialContact.email")}>
                {content.forms.contact.email}
              </label>
              <input
                id={fieldId("initialContact.email")}
                name="initialContact.email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                defaultValue={value("initialContact.email", contactValues?.email)}
                maxLength={254}
                {...crmFieldAccessibility(
                  state,
                  "initialContact.email",
                  fieldId("initialContact.email"),
                )}
              />
              <CrmFieldError
                fieldId={fieldId("initialContact.email")}
                name="initialContact.email"
                state={state}
              />
            </div>

            <div className="crm-form__field">
              <label htmlFor={fieldId("initialContact.phone")}>
                {content.forms.contact.phone}
              </label>
              <input
                id={fieldId("initialContact.phone")}
                name="initialContact.phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                defaultValue={value("initialContact.phone", contactValues?.phone)}
                minLength={6}
                maxLength={40}
                {...crmFieldAccessibility(
                  state,
                  "initialContact.phone",
                  fieldId("initialContact.phone"),
                )}
              />
              <CrmFieldError
                fieldId={fieldId("initialContact.phone")}
                name="initialContact.phone"
                state={state}
              />
            </div>

            <div className="crm-form__field">
              <label htmlFor={fieldId("initialContact.preferredContactMethod")}>
                {content.forms.contact.preferredContactMethod}
              </label>
              <select
                id={fieldId("initialContact.preferredContactMethod")}
                name="initialContact.preferredContactMethod"
                defaultValue={value(
                  "initialContact.preferredContactMethod",
                  contactValues?.preferredContactMethod ?? "NO_PREFERENCE",
                )}
                required
                {...crmFieldAccessibility(
                  state,
                  "initialContact.preferredContactMethod",
                  fieldId("initialContact.preferredContactMethod"),
                )}
              >
                {preferredContactMethods.map((value) => (
                  <option key={value} value={value}>
                    {content.labels.contactMethods[value]}
                  </option>
                ))}
              </select>
              <CrmFieldError
                fieldId={fieldId("initialContact.preferredContactMethod")}
                name="initialContact.preferredContactMethod"
                state={state}
              />
            </div>

            <div className="crm-form__field">
              <label htmlFor={fieldId("initialContact.locale")}>
                {content.forms.contact.locale}
              </label>
              <select
                id={fieldId("initialContact.locale")}
                name="initialContact.locale"
                defaultValue={value(
                  "initialContact.locale",
                  contactValues?.locale ?? locale,
                )}
                required
                {...crmFieldAccessibility(
                  state,
                  "initialContact.locale",
                  fieldId("initialContact.locale"),
                )}
              >
                {preferredLocales.map((value) => (
                  <option key={value} value={value}>
                    {content.labels.locales[value]}
                  </option>
                ))}
              </select>
              <CrmFieldError
                fieldId={fieldId("initialContact.locale")}
                name="initialContact.locale"
                state={state}
              />
            </div>
          </div>
        </fieldset>
      ) : null}

      <fieldset className="crm-form__section">
        <legend>{content.forms.customer.internalLegend}</legend>
        <div className="crm-form__grid">
          <div className="crm-form__field crm-form__field--wide">
            <label htmlFor={fieldId("internalNotes")}>
              {content.forms.customer.internalNotes}
            </label>
            <textarea
              id={fieldId("internalNotes")}
              name="internalNotes"
              defaultValue={value("internalNotes", initialValues?.internalNotes)}
              maxLength={4_000}
              rows={5}
              {...crmFieldAccessibility(
                state,
                "internalNotes",
                fieldId("internalNotes"),
                internalNotesHintId,
              )}
            />
            <p className="crm-form__hint" id={internalNotesHintId}>
              {content.forms.customer.internalNotesHint}
            </p>
            <CrmFieldError
              fieldId={fieldId("internalNotes")}
              name="internalNotes"
              state={state}
            />
          </div>
        </div>
      </fieldset>

      <div className="crm-form__actions">
        <CrmSubmitButton
          idleLabel={submitLabel}
          pending={pending}
          pendingLabel={content.common.saving}
        />
      </div>
    </form>
  );
}
