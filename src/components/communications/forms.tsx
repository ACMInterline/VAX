"use client";

import { useActionState } from "react";
import { ApplicationActionStatus } from "@/components/application/action-status";
import { ApplicationFieldError } from "@/components/application/field-error";
import type { CommunicationsCopy } from "@/content/communications";
import type { CommunicationPreferences } from "@/modules/communications-documents/types";
import {
  initialCommunicationsActionState,
  type CommunicationsFormAction,
} from "./action-state";

export function CreatePortalCommunicationForm({
  action,
  content,
  idempotencyKey,
}: {
  action: CommunicationsFormAction;
  content: CommunicationsCopy;
  idempotencyKey: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialCommunicationsActionState,
  );
  const error = (name: string) => state.fieldErrors?.[name];

  return (
    <form className="crm-form" action={formAction} aria-busy={pending} noValidate>
      <h2>{content.staff.createTitle}</h2>
      <p className="crm-form__notice">{content.staff.portalOnly}</p>
      <ApplicationActionStatus state={state} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div className="crm-form__grid">
        <div className="crm-form__field">
          <label htmlFor="communication-event-type">{content.staff.event}</label>
          <select
            id="communication-event-type"
            name="eventType"
            required
            aria-invalid={error("eventType")?.length ? true : undefined}
            aria-describedby={error("eventType")?.length ? "communication-event-type-error" : undefined}
          >
            <option value="">—</option>
            {Object.entries(content.events)
              .filter(([event]) => event !== "MANUAL_STAFF_MESSAGE")
              .map(([event, label]) => (
                <option key={event} value={event}>{label}</option>
              ))}
          </select>
          <ApplicationFieldError
            id="communication-event-type-error"
            messages={error("eventType") ?? []}
          />
        </div>
        <div className="crm-form__field">
          <label htmlFor="communication-document-type">{content.staff.documentType}</label>
          <select
            id="communication-document-type"
            name="documentType"
            required
            aria-invalid={error("documentType")?.length ? true : undefined}
            aria-describedby={error("documentType")?.length ? "communication-document-type-error" : undefined}
          >
            <option value="">—</option>
            {Object.entries(content.documents).map(([documentType, label]) => (
              <option key={documentType} value={documentType}>{label}</option>
            ))}
          </select>
          <ApplicationFieldError
            id="communication-document-type-error"
            messages={error("documentType") ?? []}
          />
        </div>
        <div className="crm-form__field crm-form__field--wide">
          <label htmlFor="communication-source-reference">{content.staff.sourceReference}</label>
          <input
            id="communication-source-reference"
            name="sourceReference"
            type="text"
            maxLength={32}
            required
            autoCapitalize="characters"
            aria-invalid={error("sourceReference")?.length ? true : undefined}
            aria-describedby={error("sourceReference")?.length ? "communication-source-reference-error" : undefined}
          />
          <ApplicationFieldError
            id="communication-source-reference-error"
            messages={error("sourceReference") ?? []}
          />
        </div>
      </div>
      <button className="crm-form__submit" type="submit" disabled={pending}>
        {content.common.create}
      </button>
    </form>
  );
}

export function CommunicationPreferencesForm({
  action,
  content,
  preferences,
}: {
  action: CommunicationsFormAction;
  content: CommunicationsCopy;
  preferences: CommunicationPreferences;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialCommunicationsActionState,
  );
  const fields = [
    ["portalEnabled", content.customer.portalEnabled, preferences.portalEnabled],
    ["emailFutureEnabled", content.customer.emailFutureEnabled, preferences.emailFutureEnabled],
    ["smsFutureEnabled", content.customer.smsFutureEnabled, preferences.smsFutureEnabled],
    ["operationalAllowed", content.customer.operationalAllowed, preferences.operationalAllowed],
    ["billingAllowed", content.customer.billingAllowed, preferences.billingAllowed],
    ["marketingConsent", content.customer.marketingConsent, preferences.marketingConsent],
  ] as const;

  return (
    <form className="crm-form" action={formAction} aria-busy={pending} noValidate>
      <h2>{content.customer.preferencesTitle}</h2>
      <ApplicationActionStatus state={state} />
      <input type="hidden" name="expectedVersion" value={preferences.version} />
      <div className="crm-form__grid">
        {fields.map(([name, label, checked]) => (
          <label className="crm-form__checkbox" key={name}>
            <input type="checkbox" name={name} value="true" defaultChecked={checked} />
            <span>{label}</span>
          </label>
        ))}
        <div className="crm-form__field">
          <label htmlFor="communication-preferred-locale">{content.customer.preferredLocale}</label>
          <select
            id="communication-preferred-locale"
            name="preferredLocale"
            defaultValue={preferences.preferredLocale}
          >
            <option value="bg">Български</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
      <button className="crm-form__submit" type="submit" disabled={pending}>
        {content.common.save}
      </button>
    </form>
  );
}
