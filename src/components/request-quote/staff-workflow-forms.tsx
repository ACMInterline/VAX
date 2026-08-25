"use client";

import { requestQuoteContent } from "@/content/request-quote";
import type {
  CustomerResolutionStatus,
  RequestStatus,
} from "@/modules/request-quote/types";
import {
  type RequestQuoteFormAction,
} from "./action-state";
import {
  RequestQuoteFormFeedback,
  RequestQuoteSubmitButton,
  useRequestQuoteAction,
} from "./form-support";
import type { RequestCustomerOption } from "./request-create-form";

export type RequestReferenceOption = Readonly<{
  id: number;
  label: string;
}>;

export type RequestNormalizationOptions = Readonly<{
  services: readonly RequestReferenceOption[];
  itemTypes: readonly RequestReferenceOption[];
  measurementModes: readonly RequestReferenceOption[];
  conditionLevels: readonly RequestReferenceOption[];
  fibreMaterials: readonly RequestReferenceOption[];
  surfaceConstructions: readonly RequestReferenceOption[];
  issueTypes: readonly RequestReferenceOption[];
  addons: readonly RequestReferenceOption[];
  assets: readonly Readonly<{ id: string; label: string }>[];
}>;

export type NormalizedRequestItemView = Readonly<{
  id: string;
  version: number;
  serviceId: number | null;
  cleaningItemTypeId: number | null;
  cleaningAssetId: string | null;
  measurementModeId: number | null;
  customerReportedConditionLevelId: number | null;
  normalizedConditionLevelId: number | null;
  reportedFibreMaterialId: number | null;
  reportedSurfaceConstructionId: number | null;
  normalizedFibreMaterialId: number | null;
  normalizedSurfaceConstructionId: number | null;
  customerDescription: string;
  normalizedDescription: string | null;
  quantity: number;
  areaHundredthsM2: number | null;
  seatCount: number | null;
  sides: number | null;
  sortOrder: number;
  issueTypeIds: readonly number[];
  addonIds: readonly number[];
}>;

function OptionSelect({
  defaultValue,
  id,
  label,
  name,
  options,
}: {
  defaultValue: number | null;
  id: string;
  label: string;
  name: string;
  options: readonly RequestReferenceOption[];
}) {
  return (
    <div className="crm-form__field">
      <label htmlFor={id}>{label}</label>
      <select id={id} name={name} defaultValue={defaultValue ?? ""}>
        <option value="">—</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function RequestLinkForm({
  action,
  customers,
  expectedVersion,
  lockedCustomerId,
  locale,
  requestId,
  selectedPropertyId,
}: {
  action: RequestQuoteFormAction;
  customers: readonly RequestCustomerOption[];
  expectedVersion: number;
  lockedCustomerId?: string;
  locale: "bg" | "en";
  requestId: string;
  selectedPropertyId?: string | null;
}) {
  const [state, formAction, pending] = useRequestQuoteAction(action);
  const content = requestQuoteContent[locale];
  const lockedCustomer = customers.find(
    (customer) => customer.id === lockedCustomerId,
  );

  return (
    <form className="crm-form" action={formAction} aria-busy={pending} noValidate>
      <h2>{content.detail.crmResolution}</h2>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="expectedVersion" value={expectedVersion} />
      <RequestQuoteFormFeedback fields={[]} state={state} title={content.common.invalid} />
      <div className="crm-form__grid">
        <div className="crm-form__field">
          {lockedCustomer ? (
            <>
              <input type="hidden" name="customerId" value={lockedCustomer.id} />
              <span>{content.forms.customer}</span>
              <p>{lockedCustomer.label}</p>
            </>
          ) : (
            <>
              <label htmlFor="request-link-customer">{content.forms.customer}</label>
              <select id="request-link-customer" name="customerId" required>
                <option value="">—</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.label}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        <div className="crm-form__field">
          <label htmlFor="request-link-property">{content.forms.property}</label>
          <select
            id="request-link-property"
            name="propertyId"
            defaultValue={selectedPropertyId ?? ""}
          >
            <option value="">{content.common.noValue}</option>
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

export function CreateCustomerFromRequestForm({
  action,
  contactName,
  expectedVersion,
  locale,
  requestId,
  serviceZones,
}: {
  action: RequestQuoteFormAction;
  contactName: string;
  expectedVersion: number;
  locale: "bg" | "en";
  requestId: string;
  serviceZones: readonly RequestReferenceOption[];
}) {
  const [state, formAction, pending] = useRequestQuoteAction(action);
  const content = requestQuoteContent[locale];

  return (
    <form className="crm-form" action={formAction} aria-busy={pending} noValidate>
      <h2>
        {locale === "bg"
          ? "Създай клиент от заявката"
          : "Create a customer from this request"}
      </h2>
      <p className="crm-form__notice">
        {locale === "bg"
          ? "Оригиналната заявка остава непроменена. Клиентът и връзката се записват като една проверена операция."
          : "The original submission remains unchanged. The customer and link are recorded as one verified operation."}
      </p>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="expectedVersion" value={expectedVersion} />
      <RequestQuoteFormFeedback fields={[]} state={state} title={content.common.invalid} />
      <div className="crm-form__grid">
        <div className="crm-form__field">
          <label htmlFor="request-customer-type">
            {locale === "bg" ? "Тип клиент" : "Customer type"}
          </label>
          <select id="request-customer-type" name="customerType" defaultValue="INDIVIDUAL">
            <option value="INDIVIDUAL">{locale === "bg" ? "Физическо лице" : "Individual"}</option>
            <option value="BUSINESS">{locale === "bg" ? "Организация" : "Business"}</option>
          </select>
        </div>
        <div className="crm-form__field">
          <label htmlFor="request-customer-name">
            {locale === "bg" ? "Име за показване" : "Display name"}
          </label>
          <input
            id="request-customer-name"
            name="displayName"
            type="text"
            defaultValue={contactName}
            maxLength={160}
            required
          />
        </div>
        <div className="crm-form__field">
          <label htmlFor="request-customer-legal-name">
            {locale === "bg" ? "Юридическо име" : "Legal name"}
          </label>
          <input id="request-customer-legal-name" name="legalName" type="text" maxLength={255} />
        </div>
        <div className="crm-form__field crm-form__field--wide">
          <label htmlFor="request-customer-notes">{content.forms.internalNotes}</label>
          <textarea id="request-customer-notes" name="internalNotes" maxLength={4_000} />
        </div>
      </div>
      <fieldset className="crm-form__section">
        <legend>{locale === "bg" ? "Нов имот (по избор)" : "New property (optional)"}</legend>
        <div className="crm-form__grid">
          <div className="crm-form__field">
            <label htmlFor="request-property-type">{locale === "bg" ? "Тип" : "Type"}</label>
            <select id="request-property-type" name="propertyType" defaultValue="RESIDENTIAL">
              {[
                "RESIDENTIAL",
                "OFFICE",
                "HOTEL_GUEST_ACCOMMODATION",
                "SERVICED_APARTMENT",
                "RESTAURANT_CAFE",
                "COMMERCIAL_PUBLIC",
                "OTHER",
              ].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          {([
            ["propertyLabel", locale === "bg" ? "Етикет" : "Label", 160],
            ["propertyCity", locale === "bg" ? "Град" : "City", 160],
            ["propertyDistrict", locale === "bg" ? "Квартал" : "District", 160],
            ["propertyStreetAddress", locale === "bg" ? "Адрес" : "Street address", 2_000],
            ["propertyPostalCode", locale === "bg" ? "Пощенски код" : "Postal code", 20],
          ] as const).map(([name, label, maximum]) => (
            <div className={`crm-form__field${name === "propertyStreetAddress" ? " crm-form__field--wide" : ""}`} key={name}>
              <label htmlFor={`request-${name}`}>{label}</label>
              <input id={`request-${name}`} name={name} type="text" maxLength={maximum} />
            </div>
          ))}
          <div className="crm-form__field">
            <label htmlFor="request-service-zone">
              {locale === "bg" ? "Зона на обслужване" : "Service zone"}
            </label>
            <select id="request-service-zone" name="serviceZoneId">
              <option value="">—</option>
              {serviceZones.map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.label}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="crm-form__hint">
          {locale === "bg"
            ? "Оставете етикет, град и адрес празни, ако имотът ще бъде добавен по-късно."
            : "Leave label, city and address blank to add the property later."}
        </p>
      </fieldset>
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

export function RequestTransitionForm({
  action,
  expectedVersion,
  fromStatus,
  locale,
  requestId,
  targets,
}: {
  action: RequestQuoteFormAction;
  expectedVersion: number;
  fromStatus: RequestStatus;
  locale: "bg" | "en";
  requestId: string;
  targets: readonly RequestStatus[];
}) {
  const [state, formAction, pending] = useRequestQuoteAction(action);
  const content = requestQuoteContent[locale];

  if (targets.length === 0) return null;

  return (
    <form className="crm-form" action={formAction} aria-busy={pending} noValidate>
      <h2>{content.forms.requestStatus}</h2>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="expectedVersion" value={expectedVersion} />
      <input type="hidden" name="fromStatus" value={fromStatus} />
      <RequestQuoteFormFeedback fields={[]} state={state} title={content.common.invalid} />
      <div className="crm-form__field">
        <label htmlFor="request-next-status">{content.forms.requestStatus}</label>
        <select id="request-next-status" name="toStatus" required>
          {targets.map((status) => (
            <option key={status} value={status}>
              {content.labels.requestStatuses[status]}
            </option>
          ))}
        </select>
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

export function RequestResolutionForm({
  action,
  expectedVersion,
  fromStatus,
  locale,
  requestId,
}: {
  action: RequestQuoteFormAction;
  expectedVersion: number;
  fromStatus: Exclude<CustomerResolutionStatus, "LINKED">;
  locale: "bg" | "en";
  requestId: string;
}) {
  const [state, formAction, pending] = useRequestQuoteAction(action);
  const content = requestQuoteContent[locale];
  const statuses = [
    "UNRESOLVED",
    "MATCH_CANDIDATE",
    "NEW_CUSTOMER_REQUIRED",
  ] as const;

  return (
    <form className="crm-form" action={formAction} aria-busy={pending} noValidate>
      <h2>{content.forms.resolutionStatus}</h2>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="expectedVersion" value={expectedVersion} />
      <input type="hidden" name="fromStatus" value={fromStatus} />
      <RequestQuoteFormFeedback fields={[]} state={state} title={content.common.invalid} />
      <div className="crm-form__field">
        <label htmlFor="request-resolution-status">{content.forms.resolutionStatus}</label>
        <select id="request-resolution-status" name="toStatus" defaultValue={fromStatus}>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {content.labels.resolutionStatuses[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="crm-form__actions">
        <RequestQuoteSubmitButton idleLabel={content.common.submit} pending={pending} pendingLabel={content.common.pending} />
      </div>
    </form>
  );
}

export function RequestNormalizationForm({
  action,
  expectedVersion,
  items,
  locale,
  options,
  requestId,
  staffNotes,
}: {
  action: RequestQuoteFormAction;
  expectedVersion: number;
  items: readonly NormalizedRequestItemView[];
  locale: "bg" | "en";
  options: RequestNormalizationOptions;
  requestId: string;
  staffNotes: string | null;
}) {
  const [state, formAction, pending] = useRequestQuoteAction(action);
  const content = requestQuoteContent[locale];

  return (
    <form className="crm-form" action={formAction} aria-busy={pending} noValidate>
      <h2>{content.detail.normalized}</h2>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="expectedVersion" value={expectedVersion} />
      <RequestQuoteFormFeedback fields={[]} state={state} title={content.common.invalid} />
      {items.map((item, index) => {
        const prefix = `items.${index}`;
        return (
          <fieldset className="crm-form__section" key={item.id}>
            <legend>
              {locale === "bg" ? "Артикул" : "Item"} {index + 1}
            </legend>
            <input type="hidden" name={`${prefix}.itemId`} value={item.id} />
            <input type="hidden" name={`${prefix}.expectedVersion`} value={item.version} />
            <input type="hidden" name={`${prefix}.sortOrder`} value={item.sortOrder} />
            <p className="crm-form__notice">
              <strong>{locale === "bg" ? "Подадено:" : "Submitted:"}</strong>{" "}
              {item.customerDescription}
            </p>
            <div className="crm-form__grid">
              <OptionSelect
                id={`${prefix}-service`}
                name={`${prefix}.serviceId`}
                label={locale === "bg" ? "Услуга" : "Service"}
                options={options.services}
                defaultValue={item.serviceId}
              />
              <OptionSelect
                id={`${prefix}-item-type`}
                name={`${prefix}.cleaningItemTypeId`}
                label={locale === "bg" ? "Тип артикул" : "Item type"}
                options={options.itemTypes}
                defaultValue={item.cleaningItemTypeId}
              />
              <div className="crm-form__field">
                <label htmlFor={`${prefix}-asset`}>{content.forms.asset}</label>
                <select
                  id={`${prefix}-asset`}
                  name={`${prefix}.cleaningAssetId`}
                  defaultValue={item.cleaningAssetId ?? ""}
                >
                  <option value="">—</option>
                  {options.assets.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </div>
              <OptionSelect
                id={`${prefix}-measurement`}
                name={`${prefix}.measurementModeId`}
                label={locale === "bg" ? "Мярка" : "Measurement"}
                options={options.measurementModes}
                defaultValue={item.measurementModeId}
              />
              <OptionSelect
                id={`${prefix}-condition`}
                name={`${prefix}.normalizedConditionLevelId`}
                label={locale === "bg" ? "Нормализирано състояние" : "Normalized condition"}
                options={options.conditionLevels}
                defaultValue={item.normalizedConditionLevelId}
              />
              <p className="crm-form__notice">
                {locale === "bg" ? "Подадено състояние" : "Customer-reported condition"}:{" "}
                {item.customerReportedConditionLevelId ?? "—"}
              </p>
              <p className="crm-form__notice">
                {locale === "bg" ? "Подаден материал" : "Customer-reported material"}:{" "}
                {item.reportedFibreMaterialId ?? "—"}
              </p>
              <OptionSelect
                id={`${prefix}-material`}
                name={`${prefix}.normalizedFibreMaterialId`}
                label={locale === "bg" ? "Нормализиран материал" : "Normalized material"}
                options={options.fibreMaterials}
                defaultValue={item.normalizedFibreMaterialId}
              />
              <p className="crm-form__notice">
                {locale === "bg" ? "Подадена конструкция" : "Customer-reported construction"}:{" "}
                {item.reportedSurfaceConstructionId ?? "—"}
              </p>
              <OptionSelect
                id={`${prefix}-construction`}
                name={`${prefix}.normalizedSurfaceConstructionId`}
                label={locale === "bg" ? "Нормализирана конструкция" : "Normalized construction"}
                options={options.surfaceConstructions}
                defaultValue={item.normalizedSurfaceConstructionId}
              />
              <div className="crm-form__field crm-form__field--wide">
                <label htmlFor={`${prefix}-description`}>
                  {locale === "bg" ? "Структурирано описание" : "Normalized description"}
                </label>
                <textarea
                  id={`${prefix}-description`}
                  name={`${prefix}.normalizedDescription`}
                  defaultValue={item.normalizedDescription ?? ""}
                  maxLength={2_000}
                />
              </div>
              {([
                ["quantity", locale === "bg" ? "Количество" : "Quantity", item.quantity],
                ["areaHundredthsM2", locale === "bg" ? "Площ (стотни m²)" : "Area (hundredths m²)", item.areaHundredthsM2],
                ["seatCount", locale === "bg" ? "Места" : "Seats", item.seatCount],
              ] as const).map(([name, label, value]) => (
                <div className="crm-form__field" key={name}>
                  <label htmlFor={`${prefix}-${name}`}>{label}</label>
                  <input
                    id={`${prefix}-${name}`}
                    name={`${prefix}.${name}`}
                    type="number"
                    min={1}
                    step={1}
                    defaultValue={value ?? ""}
                    required={name === "quantity"}
                  />
                </div>
              ))}
              <div className="crm-form__field">
                <label htmlFor={`${prefix}-sides`}>
                  {locale === "bg" ? "Страни" : "Sides"}
                </label>
                <select id={`${prefix}-sides`} name={`${prefix}.sides`} defaultValue={item.sides ?? ""}>
                  <option value="">—</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                </select>
              </div>
              <div className="crm-form__field">
                <label htmlFor={`${prefix}-issues`}>
                  {locale === "bg" ? "Проблеми" : "Issues"}
                </label>
                <select
                  id={`${prefix}-issues`}
                  name={`${prefix}.issueTypeIds`}
                  defaultValue={item.issueTypeIds.map(String)}
                  multiple
                  size={Math.min(6, Math.max(2, options.issueTypes.length))}
                >
                  {options.issueTypes.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="crm-form__field">
                <label htmlFor={`${prefix}-addons`}>
                  {locale === "bg" ? "Добавки" : "Add-ons"}
                </label>
                <select
                  id={`${prefix}-addons`}
                  name={`${prefix}.addonIds`}
                  defaultValue={item.addonIds.map(String)}
                  multiple
                  size={Math.min(6, Math.max(2, options.addons.length))}
                >
                  {options.addons.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>
        );
      })}
      <div className="crm-form__field">
        <label htmlFor="request-staff-notes">{content.forms.internalNotes}</label>
        <textarea
          id="request-staff-notes"
          name="staffNotes"
          defaultValue={staffNotes ?? ""}
          maxLength={4_000}
        />
      </div>
      <div className="crm-form__actions">
        <RequestQuoteSubmitButton
          idleLabel={content.forms.normalize}
          pending={pending}
          pendingLabel={content.common.pending}
        />
      </div>
    </form>
  );
}

export function EstimateCreationForm({
  action,
  expectedVersion,
  locale,
  requestId,
}: {
  action: RequestQuoteFormAction;
  expectedVersion: number;
  locale: "bg" | "en";
  requestId: string;
}) {
  const [state, formAction, pending] = useRequestQuoteAction(action);
  const content = requestQuoteContent[locale];
  return (
    <form className="crm-form" action={formAction} aria-busy={pending} noValidate>
      <h2>{content.forms.createEstimate}</h2>
      <p className="crm-form__notice">{content.detail.advisoryOnly}</p>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="expectedVersion" value={expectedVersion} />
      <RequestQuoteFormFeedback fields={[]} state={state} title={content.common.invalid} />
      <p className="crm-form__notice">
        {locale === "bg"
          ? "Изчислението използва само запазената структурирана интерпретация и текущите канонични правила."
          : "The estimate is derived only from the saved normalized interpretation and current canonical rules."}
      </p>
      <div className="crm-form__actions">
        <RequestQuoteSubmitButton
          idleLabel={content.forms.createEstimate}
          pending={pending}
          pendingLabel={content.common.pending}
        />
      </div>
    </form>
  );
}

export function QuoteDraftForm({
  action,
  expectedRequestVersion,
  expectedRecordVersion,
  initial,
  items,
  locale,
  mode = "create",
  quoteId,
  requestId,
}: {
  action: RequestQuoteFormAction;
  expectedRequestVersion: number;
  expectedRecordVersion?: number;
  initial?: Readonly<{
    validUntil?: string;
    vatRateBasisPoints?: number;
    estimatedDurationMinutes?: number | null;
    customerNotes?: string | null;
    additionalAssumptions?: string | null;
    staffNotes?: string | null;
  }>;
  items: readonly Readonly<{
    id: string;
    description: string;
    quantity: number;
    descriptionBg?: string;
    descriptionEn?: string;
    netAmountMinorUnits?: number;
    manualOverrideReason?: string;
  }>[];
  locale: "bg" | "en";
  mode?: "create" | "update";
  quoteId?: string;
  requestId: string;
}) {
  const [state, formAction, pending] = useRequestQuoteAction(action);
  const content = requestQuoteContent[locale];

  return (
    <form className="crm-form" action={formAction} aria-busy={pending} noValidate>
      <h2>{content.forms.draftQuote}</h2>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="expectedRequestVersion" value={expectedRequestVersion} />
      {mode === "update" && quoteId && expectedRecordVersion ? (
        <>
          <input type="hidden" name="quoteId" value={quoteId} />
          <input
            type="hidden"
            name="expectedRecordVersion"
            value={expectedRecordVersion}
          />
        </>
      ) : null}
      <RequestQuoteFormFeedback fields={[]} state={state} title={content.common.invalid} />
      <div className="crm-form__grid">
        <div className="crm-form__field">
          <label htmlFor="quote-valid-until">
            {locale === "bg" ? "Валидна до" : "Valid until"}
          </label>
          <input
            id="quote-valid-until"
            name="validUntil"
            type="date"
            defaultValue={initial?.validUntil}
            required
          />
        </div>
        <div className="crm-form__field">
          <label htmlFor="quote-vat-rate">
            {locale === "bg" ? "ДДС (базисни точки)" : "VAT (basis points)"}
          </label>
          <input
            id="quote-vat-rate"
            name="vatRateBasisPoints"
            type="number"
            min={0}
            max={10_000}
            step={1}
            defaultValue={initial?.vatRateBasisPoints ?? 2_000}
            required
          />
        </div>
        <div className="crm-form__field">
          <label htmlFor="quote-duration">
            {locale === "bg" ? "Прегледана продължителност (минути)" : "Reviewed duration (minutes)"}
          </label>
          <input
            id="quote-duration"
            name="estimatedDurationMinutes"
            type="number"
            min={0}
            max={1_000_000}
            step={1}
            defaultValue={initial?.estimatedDurationMinutes ?? ""}
          />
        </div>
        {items.map((item, index) => {
          const prefix = `quoteItems.${index}`;
          return (
            <fieldset className="crm-form__section" key={item.id}>
              <legend>
                {locale === "bg" ? "Ред" : "Line"} {index + 1}
              </legend>
              <input type="hidden" name={`${prefix}.requestItemId`} value={item.id} />
              <div className="crm-form__grid">
                <div className="crm-form__field crm-form__field--wide">
                  <label htmlFor={`${prefix}-description-bg`}>
                    {locale === "bg" ? "Описание на български" : "Bulgarian description"}
                  </label>
                  <input
                    id={`${prefix}-description-bg`}
                    name={`${prefix}.descriptionBg`}
                    type="text"
                    defaultValue={item.descriptionBg ?? item.description}
                    maxLength={2_000}
                    required
                  />
                </div>
                <div className="crm-form__field crm-form__field--wide">
                  <label htmlFor={`${prefix}-description-en`}>
                    {locale === "bg" ? "Описание на английски" : "English description"}
                  </label>
                  <input
                    id={`${prefix}-description-en`}
                    name={`${prefix}.descriptionEn`}
                    type="text"
                    defaultValue={item.descriptionEn ?? item.description}
                    maxLength={2_000}
                    required
                  />
                </div>
                <div className="crm-form__field">
                  <label htmlFor={`${prefix}-net`}>
                    {locale === "bg"
                      ? "Прегледана нетна сума — ръчно (евроцентове)"
                      : "Staff-reviewed net amount — manual (euro cents)"}
                  </label>
                  <input
                    id={`${prefix}-net`}
                    name={`${prefix}.netAmountMinorUnits`}
                    type="number"
                    min={0}
                    max={2_147_483_647}
                    step={1}
                    defaultValue={item.netAmountMinorUnits}
                    required
                  />
                </div>
                <div className="crm-form__field crm-form__field--wide">
                  <label htmlFor={`${prefix}-manual-reason`}>
                    {locale === "bg"
                      ? "Причина за ръчно определената сума"
                      : "Reason for the manually reviewed amount"}
                  </label>
                  <textarea
                    id={`${prefix}-manual-reason`}
                    name={`${prefix}.manualOverrideReason`}
                    defaultValue={item.manualOverrideReason ?? ""}
                    maxLength={1_000}
                    required
                  />
                  <p className="crm-form__hint">
                    {locale === "bg"
                      ? "Компонентите на оценката и произходът им се зареждат от сървъра. Този ред се записва изрично като ръчно прегледана обща сума."
                      : "Estimate components and provenance are loaded by the server. This line is stored explicitly as a staff-reviewed lump sum."}
                  </p>
                </div>
                <p className="crm-form__notice">
                  {locale === "bg" ? "Количество" : "Quantity"}: {item.quantity}
                </p>
              </div>
            </fieldset>
          );
        })}
        <div className="crm-form__field crm-form__field--wide">
          <label htmlFor="quote-customer-notes">
            {locale === "bg" ? "Бележка към клиента" : "Customer-facing note"}
          </label>
          <textarea
            id="quote-customer-notes"
            name="customerNotes"
            maxLength={4_000}
            defaultValue={initial?.customerNotes ?? ""}
          />
        </div>
        <div className="crm-form__field crm-form__field--wide">
          <label htmlFor="quote-additional-assumptions">
            {locale === "bg" ? "Допълнителни допускания (по избор)" : "Additional assumptions (optional)"}
          </label>
          <textarea
            id="quote-additional-assumptions"
            name="additionalAssumptions"
            maxLength={4_000}
            defaultValue={initial?.additionalAssumptions ?? ""}
          />
          <p className="crm-form__hint">
            {locale === "bg"
              ? "Стандартните условия за оглед, паркиране/пътуване, петна, сушене и добавки се прилагат автоматично."
              : "The controlled inspection, parking/travel, stain, drying and add-on terms are applied automatically."}
          </p>
        </div>
        <div className="crm-form__field crm-form__field--wide">
          <label htmlFor="quote-staff-notes">{content.forms.internalNotes}</label>
          <textarea
            id="quote-staff-notes"
            name="staffNotes"
            maxLength={4_000}
            defaultValue={initial?.staffNotes ?? ""}
          />
        </div>
      </div>
      <div className="crm-form__actions">
        <RequestQuoteSubmitButton
          idleLabel={mode === "create" ? content.forms.draftQuote : content.common.submit}
          pending={pending}
          pendingLabel={content.common.pending}
        />
      </div>
    </form>
  );
}
