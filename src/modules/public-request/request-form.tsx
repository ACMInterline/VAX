"use client";

import { useRef, useState, type FormEvent } from "react";
import type { PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";
import {
  getCatalogueLabel,
  getCleaningItemType,
  getConditionLevel,
} from "@/modules/service-catalogue/catalogue";
import {
  conditionValues,
  createPublicRequestSchema,
  preferredTimeValues,
  propertyTypeValues,
  readPublicRequestForm,
  requestServiceValues,
  stainValues,
} from "./request-schema";

type FieldErrors = Record<string, string[] | undefined>;

function FieldError({ errors, name }: { errors: FieldErrors; name: string }) {
  const message = errors[name]?.[0];
  return message ? (
    <p className="field-error" id={`${name}-error`}>
      {message}
    </p>
  ) : null;
}

function describedBy(errors: FieldErrors, name: string, hintId?: string) {
  return (
    [hintId, errors[name]?.length ? `${name}-error` : undefined]
      .filter(Boolean)
      .join(" ") || undefined
  );
}

export function RequestForm({ locale }: { locale: PublicLocale }) {
  const copy = getPublicContent(locale).requestForm;
  const schema = createPublicRequestSchema(locale);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isValidated, setIsValidated] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsValidated(false);

    const result = schema.safeParse(
      readPublicRequestForm(new FormData(event.currentTarget)),
    );

    if (!result.success) {
      setErrors(result.error.flatten().fieldErrors);
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

    setErrors({});
    setIsValidated(true);
  }

  const hasErrors = Object.values(errors).some((messages) => messages?.length);

  return (
    <form className="request-form" onSubmit={handleSubmit} noValidate>
      {hasErrors ? (
        <div
          className="form-notice form-notice--error"
          role="alert"
          tabIndex={-1}
          ref={errorSummaryRef}
        >
          <strong>{copy.notices.errorTitle}</strong>
          <p>{copy.notices.errorText}</p>
        </div>
      ) : null}

      {isValidated ? (
        <div className="form-notice form-notice--success" role="status">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>{copy.notices.successTitle}</strong>
            <p>{copy.notices.successText}</p>
          </div>
        </div>
      ) : null}

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
              defaultValue=""
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
          className="service-selector"
          aria-describedby={describedBy(errors, "services", "services-hint")}
        >
          {requestServiceValues.map((value) => (
            <label key={value}>
              <input type="checkbox" name="services" value={value} />
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
              aria-describedby="quantity-hint"
            />
            <p className="field-hint" id="quantity-hint">
              {copy.fields.quantityHint}
            </p>
          </div>
          <div className="field-group">
            <label htmlFor="approximateArea">
              {copy.fields.approximateArea}
            </label>
            <input
              id="approximateArea"
              name="approximateArea"
              placeholder={copy.fields.areaPlaceholder}
              aria-describedby="area-hint"
            />
            <p className="field-hint" id="area-hint">
              {copy.fields.areaHint}
            </p>
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
              defaultValue=""
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
              defaultValue=""
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
          <input type="checkbox" name="delicateMaterial" />
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
            <input id="preferredDate" name="preferredDate" type="date" />
          </div>
          <div className="field-group">
            <label htmlFor="preferredTime">{copy.fields.preferredTime}</label>
            <select
              id="preferredTime"
              name="preferredTime"
              defaultValue="flexible"
            >
              {preferredTimeValues.map((value) => (
                <option key={value} value={value}>
                  {copy.fields.timeOptions[value]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field-group form-grid--spaced">
          <label htmlFor="notes">{copy.fields.notes}</label>
          <textarea
            id="notes"
            name="notes"
            rows={6}
            placeholder={copy.fields.notesPlaceholder}
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
        <button className="submit-button" type="submit">
          {copy.submit.button}
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    </form>
  );
}
