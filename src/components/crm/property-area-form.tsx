"use client";

import type { AuthLocale } from "@/auth/validation";
import { crmContent } from "@/content/crm";
import {
  propertyAreaTypes,
  type PropertyAreaType,
} from "@/modules/customer-crm/types";
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

export type PropertyAreaFormInitialValues = Readonly<{
  areaType?: PropertyAreaType;
  customLabel?: string | null;
  floorLevel?: string | null;
  notes?: string | null;
}>;

export function PropertyAreaForm({
  action,
  initialValues,
  locale,
  propertyId,
}: {
  action: CrmFormAction;
  initialValues?: PropertyAreaFormInitialValues;
  locale: AuthLocale;
  propertyId: string;
}) {
  const [state, formAction, pending] = useCrmAction(action);
  const content = crmContent[locale];
  const prefix = `crm-area-create-${propertyId}`;
  const fieldId = (name: string) => crmFieldId(prefix, name);
  const value = (name: string, fallback?: string | null) =>
    crmStringValue(state, name, fallback ?? "");
  const fields: CrmFormFieldDefinition[] = [
    { name: "areaType", id: fieldId("areaType"), label: content.forms.area.type },
    {
      name: "customLabel",
      id: fieldId("customLabel"),
      label: content.forms.area.customLabel,
    },
    { name: "floorLevel", id: fieldId("floorLevel"), label: content.forms.area.floorLevel },
    { name: "notes", id: fieldId("notes"), label: content.forms.area.notes },
  ];
  const customLabelHintId = `${prefix}-custom-label-hint`;

  return (
    <form
      action={formAction}
      className="crm-form crm-form--property-area crm-form--create"
      aria-busy={pending}
      aria-labelledby={`${prefix}-title`}
      noValidate
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <h2 id={`${prefix}-title`}>{content.forms.area.createTitle}</h2>
      <CrmFormFeedback
        fields={fields}
        state={state}
        title={content.common.validationSummaryTitle}
      />
      <div className="crm-form__grid">
        <div className="crm-form__field">
          <label htmlFor={fieldId("areaType")}>{content.forms.area.type}</label>
          <select
            id={fieldId("areaType")}
            name="areaType"
            defaultValue={value("areaType", initialValues?.areaType ?? "LIVING_ROOM")}
            required
            {...crmFieldAccessibility(state, "areaType", fieldId("areaType"))}
          >
            {propertyAreaTypes.map((areaType) => (
              <option key={areaType} value={areaType}>
                {content.labels.areaTypes[areaType]}
              </option>
            ))}
          </select>
          <CrmFieldError fieldId={fieldId("areaType")} name="areaType" state={state} />
        </div>

        <div className="crm-form__field">
          <label htmlFor={fieldId("customLabel")}>
            {content.forms.area.customLabel}
          </label>
          <input
            id={fieldId("customLabel")}
            name="customLabel"
            type="text"
            defaultValue={value("customLabel", initialValues?.customLabel)}
            maxLength={160}
            {...crmFieldAccessibility(
              state,
              "customLabel",
              fieldId("customLabel"),
              customLabelHintId,
            )}
          />
          <p className="crm-form__hint" id={customLabelHintId}>
            {content.forms.area.customLabelHint}
          </p>
          <CrmFieldError
            fieldId={fieldId("customLabel")}
            name="customLabel"
            state={state}
          />
        </div>

        <div className="crm-form__field">
          <label htmlFor={fieldId("floorLevel")}>
            {content.forms.area.floorLevel}
          </label>
          <input
            id={fieldId("floorLevel")}
            name="floorLevel"
            type="text"
            defaultValue={value("floorLevel", initialValues?.floorLevel)}
            maxLength={80}
            {...crmFieldAccessibility(state, "floorLevel", fieldId("floorLevel"))}
          />
          <CrmFieldError
            fieldId={fieldId("floorLevel")}
            name="floorLevel"
            state={state}
          />
        </div>

        <div className="crm-form__field crm-form__field--wide">
          <label htmlFor={fieldId("notes")}>{content.forms.area.notes}</label>
          <textarea
            id={fieldId("notes")}
            name="notes"
            defaultValue={value("notes", initialValues?.notes)}
            maxLength={2_000}
            rows={4}
            {...crmFieldAccessibility(state, "notes", fieldId("notes"))}
          />
          <CrmFieldError fieldId={fieldId("notes")} name="notes" state={state} />
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
