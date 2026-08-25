"use client";

import { useActionState, useEffect, useRef } from "react";
import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import {
  getCatalogueLabel,
  getCleaningItemType,
  getConditionLevel,
} from "@/modules/service-catalogue/catalogue";
import {
  conditionValues,
  preferredTimeValues,
  propertyTypeValues,
  requestServiceValues,
  stainValues,
} from "./request-schema";
import {
  initialPublicRequestActionState,
  publicRequestStringValue,
  publicRequestStringValues,
  type PublicRequestFieldErrors,
  type PublicRequestFieldName,
  type PublicRequestFormAction,
} from "./action-state";

function FieldError({
  errors,
  name,
}: {
  errors: PublicRequestFieldErrors;
  name: PublicRequestFieldName;
}) {
  const message = errors[name]?.[0];
  return message ? (
    <p className="field-error" id={`${name}-error`}>
      {message}
    </p>
  ) : null;
}

function describedBy(
  errors: PublicRequestFieldErrors,
  name: PublicRequestFieldName,
  hintId?: string,
) {
  return (
    [hintId, errors[name]?.length ? `${name}-error` : undefined]
      .filter(Boolean)
      .join(" ") || undefined
  );
}

export function RequestForm({
  action,
  locale,
}: {
  action: PublicRequestFormAction;
  locale: PublicLocale;
}) {
  const copy = getPublicContent(locale).requestForm;
  const [state, formAction, pending] = useActionState(
    action,
    initialPublicRequestActionState,
  );
  const responseRef = useRef<HTMLDivElement>(null);
  const errors =
    state.status === "ERROR" ? (state.fieldErrors ?? {}) : {};
  const selectedServices = new Set(
    publicRequestStringValues(state, "services"),
  );
  const value = (name: PublicRequestFieldName, fallback = "") =>
    publicRequestStringValue(state, name, fallback);

  // Action-state identity distinguishes consecutive server responses even
  // when their status and localized message are the same.
  useEffect(() => {
    if (state.status !== "IDLE") {
      responseRef.current?.focus();
    }
  }, [state]);

  const summaryFields = [
    ["name", copy.fields.name],
    ["email", copy.fields.email],
    ["phone", copy.fields.phone],
    ["district", copy.fields.district],
    ["propertyType", copy.fields.propertyType],
    ["services", copy.sections.services],
    ["estimatedQuantity", copy.fields.estimatedQuantity],
    ["approximateArea", copy.fields.approximateArea],
    ["condition", copy.fields.condition],
    ["stainsPresent", copy.fields.stains],
    ["preferredDate", copy.fields.preferredDate],
    ["preferredTime", copy.fields.preferredTime],
    ["notes", copy.fields.notes],
  ] as const satisfies readonly (readonly [PublicRequestFieldName, string])[];

  return (
    <form
      action={formAction}
      aria-busy={pending}
      className="request-form"
      noValidate
    >
      {state.status === "ERROR" ? (
        <div
          className="form-notice form-notice--error"
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          tabIndex={-1}
          ref={responseRef}
        >
          <div>
            <strong>{copy.notices.errorTitle}</strong>
            <p>{state.message ?? copy.notices.errorText}</p>
            {summaryFields.some(([name]) => errors[name]?.length) ? (
              <ul>
                {summaryFields.flatMap(([name, label]) =>
                  (errors[name] ?? []).map((message, index) => (
                    <li key={`${name}:${index}`}>
                      <a href={`#${name}`}>
                        {label}: {message}
                      </a>
                    </li>
                  )),
                )}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {state.status === "SUCCESS" ? (
        <div
          className="form-notice form-notice--success"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          tabIndex={-1}
          ref={responseRef}
        >
          <span aria-hidden="true">✓</span>
          <div>
            <strong>{copy.notices.successTitle}</strong>
            <p>{copy.notices.successText}</p>
            <code>{state.requestReference}</code>
          </div>
        </div>
      ) : null}

      <div className="sr-only" inert>
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          autoComplete="off"
          tabIndex={-1}
        />
      </div>

      <fieldset className="form-section">
        <legend>
          <span>01</span>
          {copy.sections.contact}
        </legend>
        <div className="form-grid form-grid--three">
          <div className="field-group">
            <label htmlFor="name">{copy.fields.name}</label>
            <input
              id="name"
              name="name"
              autoComplete="name"
              defaultValue={value("name")}
              maxLength={100}
              aria-invalid={Boolean(errors.name?.length)}
              aria-describedby={describedBy(errors, "name")}
              required
            />
            <FieldError errors={errors} name="name" />
          </div>
          <div className="field-group">
            <label htmlFor="email">{copy.fields.email}</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              defaultValue={value("email")}
              maxLength={254}
              aria-invalid={Boolean(errors.email?.length)}
              aria-describedby={describedBy(errors, "email")}
              required
            />
            <FieldError errors={errors} name="email" />
          </div>
          <div className="field-group">
            <label htmlFor="phone">{copy.fields.phone}</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              defaultValue={value("phone")}
              maxLength={32}
              aria-invalid={Boolean(errors.phone?.length)}
              aria-describedby={describedBy(errors, "phone")}
              required
            />
            <FieldError errors={errors} name="phone" />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>
          <span>02</span>
          {copy.sections.property}
        </legend>
        <div className="form-grid form-grid--two">
          <div className="field-group">
            <label htmlFor="district">{copy.fields.district}</label>
            <input
              id="district"
              name="district"
              autoComplete="address-level2"
              placeholder={copy.fields.districtPlaceholder}
              defaultValue={value("district")}
              maxLength={100}
              aria-invalid={Boolean(errors.district?.length)}
              aria-describedby={describedBy(errors, "district")}
              required
            />
            <FieldError errors={errors} name="district" />
          </div>
          <div className="field-group">
            <label htmlFor="propertyType">{copy.fields.propertyType}</label>
            <select
              id="propertyType"
              name="propertyType"
              defaultValue={value("propertyType")}
              aria-invalid={Boolean(errors.propertyType?.length)}
              aria-describedby={describedBy(errors, "propertyType")}
              required
            >
              <option value="" disabled>
                {copy.fields.propertyPlaceholder}
              </option>
              {propertyTypeValues.map((value) => (
                <option key={value} value={value}>
                  {copy.fields.propertyOptions[value]}
                </option>
              ))}
            </select>
            <FieldError errors={errors} name="propertyType" />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>
          <span>03</span>
          {copy.sections.services}
        </legend>
        <p className="form-hint" id="services-hint">
          {copy.fields.servicesHint}
        </p>
        <div
          id="services"
          className="service-selector"
          aria-describedby={describedBy(errors, "services", "services-hint")}
        >
          {requestServiceValues.map((value) => (
            <label key={value}>
              <input
                type="checkbox"
                name="services"
                value={value}
                defaultChecked={selectedServices.has(value)}
              />
              <span aria-hidden="true" />
              {getCatalogueLabel(getCleaningItemType(value), locale)}
            </label>
          ))}
        </div>
        <FieldError errors={errors} name="services" />
        <div className="form-grid form-grid--two form-grid--spaced">
          <div className="field-group">
            <label htmlFor="estimatedQuantity">
              {copy.fields.estimatedQuantity}
            </label>
            <input
              id="estimatedQuantity"
              name="estimatedQuantity"
              placeholder={copy.fields.quantityPlaceholder}
              defaultValue={value("estimatedQuantity")}
              maxLength={120}
              aria-invalid={Boolean(errors.estimatedQuantity?.length)}
              aria-describedby={describedBy(
                errors,
                "estimatedQuantity",
                "quantity-hint",
              )}
            />
            <p className="field-hint" id="quantity-hint">
              {copy.fields.quantityHint}
            </p>
            <FieldError errors={errors} name="estimatedQuantity" />
          </div>
          <div className="field-group">
            <label htmlFor="approximateArea">
              {copy.fields.approximateArea}
            </label>
            <input
              id="approximateArea"
              name="approximateArea"
              placeholder={copy.fields.areaPlaceholder}
              defaultValue={value("approximateArea")}
              maxLength={120}
              aria-invalid={Boolean(errors.approximateArea?.length)}
              aria-describedby={describedBy(
                errors,
                "approximateArea",
                "area-hint",
              )}
            />
            <p className="field-hint" id="area-hint">
              {copy.fields.areaHint}
            </p>
            <FieldError errors={errors} name="approximateArea" />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>
          <span>04</span>
          {copy.sections.condition}
        </legend>
        <div className="form-grid form-grid--two">
          <div className="field-group">
            <label htmlFor="condition">{copy.fields.condition}</label>
            <select
              id="condition"
              name="condition"
              defaultValue={value("condition")}
              aria-invalid={Boolean(errors.condition?.length)}
              aria-describedby={describedBy(errors, "condition")}
              required
            >
              <option value="" disabled>
                {copy.fields.conditionPlaceholder}
              </option>
              {conditionValues.map((value) => (
                <option key={value} value={value}>
                  {getCatalogueLabel(getConditionLevel(value), locale)}
                </option>
              ))}
            </select>
            <FieldError errors={errors} name="condition" />
          </div>
          <div className="field-group">
            <label htmlFor="stainsPresent">{copy.fields.stains}</label>
            <select
              id="stainsPresent"
              name="stainsPresent"
              defaultValue={value("stainsPresent")}
              aria-invalid={Boolean(errors.stainsPresent?.length)}
              aria-describedby={describedBy(errors, "stainsPresent")}
              required
            >
              <option value="" disabled>
                {copy.fields.stainsPlaceholder}
              </option>
              {stainValues.map((value) => (
                <option key={value} value={value}>
                  {copy.fields.stainOptions[value]}
                </option>
              ))}
            </select>
            <FieldError errors={errors} name="stainsPresent" />
          </div>
        </div>
        <label className="material-checkbox">
          <input
            type="checkbox"
            name="delicateMaterial"
            defaultChecked={value("delicateMaterial") === "on"}
          />
          <span aria-hidden="true" />
          <span>
            <strong>{copy.fields.delicateTitle}</strong>
            <small>{copy.fields.delicateHint}</small>
          </span>
        </label>
      </fieldset>

      <fieldset className="form-section">
        <legend>
          <span>05</span>
          {copy.sections.timing}
        </legend>
        <div className="form-grid form-grid--two">
          <div className="field-group">
            <label htmlFor="preferredDate">{copy.fields.preferredDate}</label>
            <input
              id="preferredDate"
              name="preferredDate"
              type="date"
              defaultValue={value("preferredDate")}
              aria-invalid={Boolean(errors.preferredDate?.length)}
              aria-describedby={describedBy(errors, "preferredDate")}
            />
            <FieldError errors={errors} name="preferredDate" />
          </div>
          <div className="field-group">
            <label htmlFor="preferredTime">{copy.fields.preferredTime}</label>
            <select
              id="preferredTime"
              name="preferredTime"
              defaultValue={value("preferredTime", "flexible")}
              aria-invalid={Boolean(errors.preferredTime?.length)}
              aria-describedby={describedBy(errors, "preferredTime")}
            >
              {preferredTimeValues.map((value) => (
                <option key={value} value={value}>
                  {copy.fields.timeOptions[value]}
                </option>
              ))}
            </select>
            <FieldError errors={errors} name="preferredTime" />
          </div>
        </div>
        <div className="field-group form-grid--spaced">
          <label htmlFor="notes">{copy.fields.notes}</label>
          <textarea
            id="notes"
            name="notes"
            rows={6}
            placeholder={copy.fields.notesPlaceholder}
            defaultValue={value("notes")}
            maxLength={1500}
            aria-invalid={Boolean(errors.notes?.length)}
            aria-describedby={describedBy(errors, "notes", "notes-hint")}
          />
          <p className="field-hint" id="notes-hint">
            {copy.fields.notesHint}
          </p>
          <FieldError errors={errors} name="notes" />
        </div>

        <div className="upload-placeholder" aria-disabled="true">
          <div>
            <span aria-hidden="true">＋</span>
            <strong>{copy.upload.title}</strong>
            <p>{copy.upload.text}</p>
          </div>
          <button type="button" disabled>
            {copy.upload.button}
          </button>
        </div>
      </fieldset>

      <div className="request-form__submit">
        <div>
          <strong>{copy.submit.label}</strong>
          <p>{copy.submit.text}</p>
        </div>
        <button className="submit-button" type="submit" disabled={pending}>
          {pending ? `${copy.submit.button}…` : copy.submit.button}
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    </form>
  );
}
