"use client";

import { requestQuoteContent } from "@/content/request-quote";
import {
  requestQuoteStringValue,
  type RequestQuoteFormAction,
} from "./action-state";
import {
  RequestQuoteFieldError,
  RequestQuoteFormFeedback,
  RequestQuoteSubmitButton,
  requestQuoteFieldAccessibility,
  type RequestQuoteFormFieldDefinition,
  useRequestQuoteAction,
} from "./form-support";

export type RequestAssetOption = Readonly<{
  id: string;
  label: string;
}>;

export type RequestPropertyOption = Readonly<{
  id: string;
  label: string;
  assets: readonly RequestAssetOption[];
}>;

export type RequestCustomerOption = Readonly<{
  id: string;
  label: string;
  properties: readonly RequestPropertyOption[];
}>;

const fieldNames = [
  "customerId",
  "propertyId",
  "cleaningAssetId",
  "contactName",
  "contactEmail",
  "contactPhone",
  "customerDescription",
  "quantity",
  "preferredDate",
  "preferredWindowCode",
] as const;

export function RequestCreateForm({
  action,
  customers,
  locale,
  mode,
}: {
  action: RequestQuoteFormAction;
  customers: readonly RequestCustomerOption[];
  locale: "bg" | "en";
  mode: "customer" | "staff";
}) {
  const [state, formAction, pending] = useRequestQuoteAction(action);
  const content = requestQuoteContent[locale];
  const prefix = `${mode}-request`;
  const fieldLabel: Record<(typeof fieldNames)[number], string> = {
    customerId: content.forms.customer,
    propertyId: content.forms.property,
    cleaningAssetId: content.forms.asset,
    contactName: content.forms.contactName,
    contactEmail: content.forms.contactEmail,
    contactPhone: content.forms.contactPhone,
    customerDescription: content.forms.notes,
    quantity: locale === "bg" ? "Количество" : "Quantity",
    preferredDate: content.forms.preferredDate,
    preferredWindowCode: content.forms.preferredWindow,
  };
  const fields: RequestQuoteFormFieldDefinition[] = fieldNames.map((name) => ({
    name,
    id: `${prefix}-${name}`,
    label: fieldLabel[name],
  }));
  const field = (name: (typeof fieldNames)[number]) => ({
    id: `${prefix}-${name}`,
    name,
    label: fieldLabel[name],
  });
  const selectedCustomer = requestQuoteStringValue(state, "customerId");

  return (
    <form
      className="crm-form"
      action={formAction}
      aria-busy={pending}
      noValidate
    >
      <h2>
        {mode === "staff"
          ? content.forms.staffCreateTitle
          : content.forms.customerCreateTitle}
      </h2>
      <RequestQuoteFormFeedback
        fields={fields}
        state={state}
        title={content.common.invalid}
      />
      {state.status === "SUCCESS" && state.requestReference ? (
        <p className="crm-form__notice" aria-live="polite">
          {locale === "bg" ? "Референция:" : "Reference:"}{" "}
          <strong>{state.requestReference}</strong>
        </p>
      ) : null}
      <div className="crm-form__grid">
        <div className="crm-form__field">
          <label htmlFor={field("customerId").id}>{field("customerId").label}</label>
          <select
            id={field("customerId").id}
            name="customerId"
            defaultValue={selectedCustomer}
            required
            {...requestQuoteFieldAccessibility(
              state,
              "customerId",
              field("customerId").id,
            )}
          >
            <option value="">
              {locale === "bg" ? "Изберете клиент" : "Select a customer"}
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.label}
              </option>
            ))}
          </select>
          <RequestQuoteFieldError
            fieldId={field("customerId").id}
            name="customerId"
            state={state}
          />
        </div>

        <div className="crm-form__field">
          <label htmlFor={field("propertyId").id}>{field("propertyId").label}</label>
          <select
            id={field("propertyId").id}
            name="propertyId"
            defaultValue={requestQuoteStringValue(state, "propertyId")}
            required={mode === "customer"}
            {...requestQuoteFieldAccessibility(
              state,
              "propertyId",
              field("propertyId").id,
            )}
          >
            <option value="">
              {mode === "customer"
                ? locale === "bg"
                  ? "Изберете имот"
                  : "Select a property"
                : content.common.noValue}
            </option>
            {customers.map((customer) => (
              <optgroup key={customer.id} label={customer.label}>
                {customer.properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <RequestQuoteFieldError
            fieldId={field("propertyId").id}
            name="propertyId"
            state={state}
          />
        </div>

        <div className="crm-form__field crm-form__field--wide">
          <label htmlFor={field("cleaningAssetId").id}>
            {field("cleaningAssetId").label}
          </label>
          <select
            id={field("cleaningAssetId").id}
            name="cleaningAssetId"
            defaultValue={requestQuoteStringValue(state, "cleaningAssetId")}
            {...requestQuoteFieldAccessibility(
              state,
              "cleaningAssetId",
              field("cleaningAssetId").id,
            )}
          >
            <option value="">{content.common.noValue}</option>
            {customers.flatMap((customer) =>
              customer.properties.map((property) => (
                <optgroup
                  key={property.id}
                  label={`${customer.label} — ${property.label}`}
                >
                  {property.assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.label}
                    </option>
                  ))}
                </optgroup>
              )),
            )}
          </select>
          <RequestQuoteFieldError
            fieldId={field("cleaningAssetId").id}
            name="cleaningAssetId"
            state={state}
          />
        </div>

        {(["contactName", "contactEmail", "contactPhone"] as const).map(
          (name) => (
            <div className="crm-form__field" key={name}>
              <label htmlFor={field(name).id}>{field(name).label}</label>
              <input
                id={field(name).id}
                name={name}
                type={name === "contactEmail" ? "email" : name === "contactPhone" ? "tel" : "text"}
                defaultValue={requestQuoteStringValue(state, name)}
                maxLength={name === "contactEmail" ? 254 : name === "contactPhone" ? 40 : 160}
                required={name === "contactName"}
                autoComplete={
                  name === "contactEmail"
                    ? "email"
                    : name === "contactPhone"
                      ? "tel"
                      : "name"
                }
                {...requestQuoteFieldAccessibility(state, name, field(name).id)}
              />
              <RequestQuoteFieldError
                fieldId={field(name).id}
                name={name}
                state={state}
              />
            </div>
          ),
        )}

        <div className="crm-form__field crm-form__field--wide">
          <label htmlFor={field("customerDescription").id}>
            {field("customerDescription").label}
          </label>
          <textarea
            id={field("customerDescription").id}
            name="customerDescription"
            defaultValue={requestQuoteStringValue(state, "customerDescription")}
            maxLength={2_000}
            required
            {...requestQuoteFieldAccessibility(
              state,
              "customerDescription",
              field("customerDescription").id,
            )}
          />
          <RequestQuoteFieldError
            fieldId={field("customerDescription").id}
            name="customerDescription"
            state={state}
          />
        </div>

        <div className="crm-form__field">
          <label htmlFor={field("quantity").id}>{field("quantity").label}</label>
          <input
            id={field("quantity").id}
            name="quantity"
            type="number"
            min={1}
            max={100_000}
            step={1}
            defaultValue={requestQuoteStringValue(state, "quantity", "1")}
            required
            {...requestQuoteFieldAccessibility(
              state,
              "quantity",
              field("quantity").id,
            )}
          />
          <RequestQuoteFieldError
            fieldId={field("quantity").id}
            name="quantity"
            state={state}
          />
        </div>

        <div className="crm-form__field">
          <label htmlFor={field("preferredDate").id}>
            {field("preferredDate").label}
          </label>
          <input
            id={field("preferredDate").id}
            name="preferredDate"
            type="date"
            defaultValue={requestQuoteStringValue(state, "preferredDate")}
            {...requestQuoteFieldAccessibility(
              state,
              "preferredDate",
              field("preferredDate").id,
            )}
          />
          <RequestQuoteFieldError
            fieldId={field("preferredDate").id}
            name="preferredDate"
            state={state}
          />
        </div>

        <div className="crm-form__field crm-form__field--wide">
          <label htmlFor={field("preferredWindowCode").id}>
            {field("preferredWindowCode").label}
          </label>
          <input
            id={field("preferredWindowCode").id}
            name="preferredWindowCode"
            type="text"
            maxLength={64}
            defaultValue={requestQuoteStringValue(state, "preferredWindowCode")}
            {...requestQuoteFieldAccessibility(
              state,
              "preferredWindowCode",
              field("preferredWindowCode").id,
            )}
          />
          <RequestQuoteFieldError
            fieldId={field("preferredWindowCode").id}
            name="preferredWindowCode"
            state={state}
          />
        </div>
      </div>
      <div className="crm-form__actions">
        <RequestQuoteSubmitButton
          idleLabel={content.common.submit}
          pending={pending}
          pendingLabel={content.common.pending}
        />
      </div>
    </form>
  );
}
