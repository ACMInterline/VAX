"use client";

import type { AuthLocale } from "@/auth/validation";
import { crmContent } from "@/content/crm";
import {
  propertyTypes,
  type PropertyType,
} from "@/modules/customer-crm/types";
import { crmStringValue, type CrmFormAction } from "./action-state";
import type { CrmReferenceOption } from "./form-options";
import {
  CrmFieldError,
  CrmFormFeedback,
  CrmSubmitButton,
  crmFieldAccessibility,
  crmFieldId,
  useCrmAction,
  type CrmFormFieldDefinition,
} from "./form-support";

export type PropertyCreateInitialValues = Readonly<{
  propertyType?: PropertyType;
  label?: string;
  city?: string;
  district?: string | null;
  streetAddress?: string;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accessNotes?: string | null;
  parkingNotes?: string | null;
  serviceZoneId?: number | null;
}>;

export type PropertyEditInitialValues = Readonly<{
  propertyId: string;
  expectedVersion: number;
  propertyType: PropertyType;
  label: string;
  city: string;
  district: string | null;
  streetAddress: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  accessNotes: string | null;
  parkingNotes: string | null;
  serviceZoneId: number | null;
}>;

type PropertyFormProps = Readonly<{
  action: CrmFormAction;
  locale: AuthLocale;
  serviceZoneOptions: readonly CrmReferenceOption[];
}> &
  (
    | Readonly<{
        mode: "create";
        customerId: string;
        initialValues?: PropertyCreateInitialValues;
      }>
    | Readonly<{
        mode: "edit";
        initialValues: PropertyEditInitialValues;
      }>
  );

export function PropertyForm(props: PropertyFormProps) {
  const { action, locale, mode, serviceZoneOptions } = props;
  const [state, formAction, pending] = useCrmAction(action);
  const content = crmContent[locale];
  const initialValues = props.initialValues;
  const prefix =
    mode === "edit"
      ? `crm-property-${props.initialValues.propertyId}`
      : `crm-property-create-${props.customerId}`;
  const fieldId = (name: string) => crmFieldId(prefix, name);
  const value = (
    name: string,
    fallback?: string | number | null,
  ): string => crmStringValue(state, name, fallback == null ? "" : String(fallback));
  const fields: CrmFormFieldDefinition[] = [
    { name: "propertyType", id: fieldId("propertyType"), label: content.forms.property.type },
    { name: "label", id: fieldId("label"), label: content.forms.property.label },
    { name: "city", id: fieldId("city"), label: content.forms.property.city },
    { name: "district", id: fieldId("district"), label: content.forms.property.district },
    {
      name: "streetAddress",
      id: fieldId("streetAddress"),
      label: content.forms.property.streetAddress,
    },
    { name: "postalCode", id: fieldId("postalCode"), label: content.forms.property.postalCode },
    { name: "latitude", id: fieldId("latitude"), label: content.forms.property.latitude },
    { name: "longitude", id: fieldId("longitude"), label: content.forms.property.longitude },
    { name: "accessNotes", id: fieldId("accessNotes"), label: content.forms.property.accessNotes },
    {
      name: "parkingNotes",
      id: fieldId("parkingNotes"),
      label: content.forms.property.parkingNotes,
    },
    {
      name: "serviceZoneId",
      id: fieldId("serviceZoneId"),
      label: content.forms.property.serviceZone,
    },
  ];
  const title =
    mode === "edit"
      ? content.forms.property.editTitle
      : content.forms.property.createTitle;

  return (
    <form
      action={formAction}
      className={`crm-form crm-form--property crm-form--${mode}`}
      aria-busy={pending}
      aria-labelledby={`${prefix}-title`}
      noValidate
    >
      {mode === "create" ? (
        <input type="hidden" name="customerId" value={props.customerId} />
      ) : (
        <>
          <input
            type="hidden"
            name="propertyId"
            value={props.initialValues.propertyId}
          />
          <input
            type="hidden"
            name="expectedVersion"
            value={props.initialValues.expectedVersion}
          />
        </>
      )}
      <h2 id={`${prefix}-title`}>{title}</h2>
      <CrmFormFeedback
        fields={fields}
        state={state}
        title={content.common.validationSummaryTitle}
      />

      <fieldset className="crm-form__section">
        <legend>{content.forms.property.locationLegend}</legend>
        <p className="crm-form__hint" id={`${prefix}-address-hint`}>
          {content.forms.property.addressPrivacyHint}
        </p>
        <div className="crm-form__grid">
          <div className="crm-form__field">
            <label htmlFor={fieldId("propertyType")}>
              {content.forms.property.type}
            </label>
            <select
              id={fieldId("propertyType")}
              name="propertyType"
              defaultValue={value(
                "propertyType",
                initialValues?.propertyType ?? "RESIDENTIAL",
              )}
              required
              {...crmFieldAccessibility(
                state,
                "propertyType",
                fieldId("propertyType"),
              )}
            >
              {propertyTypes.map((propertyType) => (
                <option key={propertyType} value={propertyType}>
                  {content.labels.propertyTypes[propertyType]}
                </option>
              ))}
            </select>
            <CrmFieldError
              fieldId={fieldId("propertyType")}
              name="propertyType"
              state={state}
            />
          </div>

          <div className="crm-form__field">
            <label htmlFor={fieldId("label")}>{content.forms.property.label}</label>
            <input
              id={fieldId("label")}
              name="label"
              type="text"
              defaultValue={value("label", initialValues?.label)}
              required
              maxLength={160}
              {...crmFieldAccessibility(state, "label", fieldId("label"))}
            />
            <CrmFieldError fieldId={fieldId("label")} name="label" state={state} />
          </div>

          <div className="crm-form__field">
            <label htmlFor={fieldId("city")}>{content.forms.property.city}</label>
            <input
              id={fieldId("city")}
              name="city"
              type="text"
              autoComplete="address-level2"
              defaultValue={value("city", initialValues?.city)}
              required
              maxLength={120}
              {...crmFieldAccessibility(state, "city", fieldId("city"))}
            />
            <CrmFieldError fieldId={fieldId("city")} name="city" state={state} />
          </div>

          <div className="crm-form__field">
            <label htmlFor={fieldId("district")}>
              {content.forms.property.district}
            </label>
            <input
              id={fieldId("district")}
              name="district"
              type="text"
              autoComplete="address-level3"
              defaultValue={value("district", initialValues?.district)}
              maxLength={160}
              {...crmFieldAccessibility(state, "district", fieldId("district"))}
            />
            <CrmFieldError
              fieldId={fieldId("district")}
              name="district"
              state={state}
            />
          </div>

          <div className="crm-form__field crm-form__field--wide">
            <label htmlFor={fieldId("streetAddress")}>
              {content.forms.property.streetAddress}
            </label>
            <input
              id={fieldId("streetAddress")}
              name="streetAddress"
              type="text"
              autoComplete="street-address"
              defaultValue={value("streetAddress", initialValues?.streetAddress)}
              required
              maxLength={300}
              {...crmFieldAccessibility(
                state,
                "streetAddress",
                fieldId("streetAddress"),
                `${prefix}-address-hint`,
              )}
            />
            <CrmFieldError
              fieldId={fieldId("streetAddress")}
              name="streetAddress"
              state={state}
            />
          </div>

          <div className="crm-form__field">
            <label htmlFor={fieldId("postalCode")}>
              {content.forms.property.postalCode}
            </label>
            <input
              id={fieldId("postalCode")}
              name="postalCode"
              type="text"
              inputMode="text"
              autoComplete="postal-code"
              defaultValue={value("postalCode", initialValues?.postalCode)}
              maxLength={24}
              {...crmFieldAccessibility(state, "postalCode", fieldId("postalCode"))}
            />
            <CrmFieldError
              fieldId={fieldId("postalCode")}
              name="postalCode"
              state={state}
            />
          </div>

          <div className="crm-form__field">
            <label htmlFor={fieldId("latitude")}>
              {content.forms.property.latitude}
            </label>
            <input
              id={fieldId("latitude")}
              name="latitude"
              type="number"
              inputMode="decimal"
              min={-90}
              max={90}
              step="any"
              defaultValue={value("latitude", initialValues?.latitude)}
              {...crmFieldAccessibility(state, "latitude", fieldId("latitude"))}
            />
            <CrmFieldError
              fieldId={fieldId("latitude")}
              name="latitude"
              state={state}
            />
          </div>

          <div className="crm-form__field">
            <label htmlFor={fieldId("longitude")}>
              {content.forms.property.longitude}
            </label>
            <input
              id={fieldId("longitude")}
              name="longitude"
              type="number"
              inputMode="decimal"
              min={-180}
              max={180}
              step="any"
              defaultValue={value("longitude", initialValues?.longitude)}
              {...crmFieldAccessibility(state, "longitude", fieldId("longitude"))}
            />
            <CrmFieldError
              fieldId={fieldId("longitude")}
              name="longitude"
              state={state}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="crm-form__section">
        <legend>{content.forms.property.operationsLegend}</legend>
        <div className="crm-form__grid">
          <div className="crm-form__field">
            <label htmlFor={fieldId("serviceZoneId")}>
              {content.forms.property.serviceZone}
            </label>
            <select
              id={fieldId("serviceZoneId")}
              name="serviceZoneId"
              defaultValue={value("serviceZoneId", initialValues?.serviceZoneId)}
              {...crmFieldAccessibility(
                state,
                "serviceZoneId",
                fieldId("serviceZoneId"),
              )}
            >
              <option value="">{content.common.noValue}</option>
              {serviceZoneOptions.map((option) => (
                <option
                  key={option.id}
                  value={option.id}
                  disabled={option.active === false}
                >
                  {option.label}
                </option>
              ))}
            </select>
            <CrmFieldError
              fieldId={fieldId("serviceZoneId")}
              name="serviceZoneId"
              state={state}
            />
          </div>

          <div className="crm-form__field crm-form__field--wide">
            <label htmlFor={fieldId("accessNotes")}>
              {content.forms.property.accessNotes}
            </label>
            <textarea
              id={fieldId("accessNotes")}
              name="accessNotes"
              defaultValue={value("accessNotes", initialValues?.accessNotes)}
              maxLength={2_000}
              rows={4}
              {...crmFieldAccessibility(state, "accessNotes", fieldId("accessNotes"))}
            />
            <CrmFieldError
              fieldId={fieldId("accessNotes")}
              name="accessNotes"
              state={state}
            />
          </div>

          <div className="crm-form__field crm-form__field--wide">
            <label htmlFor={fieldId("parkingNotes")}>
              {content.forms.property.parkingNotes}
            </label>
            <textarea
              id={fieldId("parkingNotes")}
              name="parkingNotes"
              defaultValue={value("parkingNotes", initialValues?.parkingNotes)}
              maxLength={2_000}
              rows={4}
              {...crmFieldAccessibility(
                state,
                "parkingNotes",
                fieldId("parkingNotes"),
              )}
            />
            <CrmFieldError
              fieldId={fieldId("parkingNotes")}
              name="parkingNotes"
              state={state}
            />
          </div>
        </div>
      </fieldset>

      <div className="crm-form__actions">
        <CrmSubmitButton
          idleLabel={mode === "edit" ? content.common.save : content.common.add}
          pending={pending}
          pendingLabel={content.common.saving}
        />
      </div>
    </form>
  );
}
