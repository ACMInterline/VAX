"use client";

import { useRef, useState } from "react";
import {
  publicRequestSchema,
  readPublicRequestForm,
  requestServiceOptions,
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
  return [hintId, errors[name]?.length ? `${name}-error` : undefined]
    .filter(Boolean)
    .join(" ") || undefined;
}

export function RequestForm() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isValidated, setIsValidated] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsValidated(false);

    const result = publicRequestSchema.safeParse(
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
          <strong>Check the highlighted details.</strong>
          <p>No information was sent or stored.</p>
        </div>
      ) : null}

      {isValidated ? (
        <div className="form-notice form-notice--success" role="status">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Your details pass the prototype validation.</strong>
            <p>
              No booking was created and nothing was sent or stored. Online
              request connectivity will be activated in a later phase.
            </p>
          </div>
        </div>
      ) : null}

      <fieldset className="form-section">
        <legend>
          <span>01</span>
          Your contact details
        </legend>
        <div className="form-grid form-grid--three">
          <div className="field-group">
            <label htmlFor="name">Name</label>
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
            <label htmlFor="email">Email</label>
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
            <label htmlFor="phone">Phone</label>
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
          The property
        </legend>
        <div className="form-grid form-grid--two">
          <div className="field-group">
            <label htmlFor="district">Sofia area or district</label>
            <input
              id="district"
              name="district"
              autoComplete="address-level2"
              placeholder="For example, Lozenets"
              aria-invalid={Boolean(errors.district?.length)}
              aria-describedby={describedBy(errors, "district")}
              required
            />
            <FieldError errors={errors} name="district" />
          </div>
          <div className="field-group">
            <label htmlFor="propertyType">Property type</label>
            <select
              id="propertyType"
              name="propertyType"
              defaultValue=""
              aria-invalid={Boolean(errors.propertyType?.length)}
              aria-describedby={describedBy(errors, "propertyType")}
              required
            >
              <option value="" disabled>
                Select a property
              </option>
              <option value="apartment">Apartment</option>
              <option value="house">House</option>
              <option value="rented-home">Rented home</option>
              <option value="office">Office</option>
              <option value="hotel-guest-house">Hotel or guest house</option>
              <option value="serviced-apartment">Serviced apartment</option>
              <option value="hospitality">Restaurant or café</option>
              <option value="public-space">Educational or public space</option>
              <option value="other">Other</option>
            </select>
            <FieldError errors={errors} name="propertyType" />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>
          <span>03</span>
          Surfaces that need care
        </legend>
        <p className="form-hint" id="services-hint">
          Choose every service that may be relevant. Final scope is confirmed
          after assessment.
        </p>
        <div
          className="service-selector"
          aria-describedby={describedBy(errors, "services", "services-hint")}
        >
          {requestServiceOptions.map((service) => (
            <label key={service.value}>
              <input type="checkbox" name="services" value={service.value} />
              <span aria-hidden="true" />
              {service.label}
            </label>
          ))}
        </div>
        <FieldError errors={errors} name="services" />
        <div className="form-grid form-grid--two form-grid--spaced">
          <div className="field-group">
            <label htmlFor="estimatedQuantity">Estimated quantity</label>
            <input
              id="estimatedQuantity"
              name="estimatedQuantity"
              placeholder="For example, 1 sofa and 6 chairs"
              aria-describedby="quantity-hint"
            />
            <p className="field-hint" id="quantity-hint">
              An estimate is enough for this prototype.
            </p>
          </div>
          <div className="field-group">
            <label htmlFor="approximateArea">Approximate area</label>
            <input
              id="approximateArea"
              name="approximateArea"
              placeholder="For example, around 30 m²"
              aria-describedby="area-hint"
            />
            <p className="field-hint" id="area-hint">
              Useful for carpets and larger commercial surfaces.
            </p>
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>
          <span>04</span>
          Condition and material
        </legend>
        <div className="form-grid form-grid--two">
          <div className="field-group">
            <label htmlFor="condition">General condition</label>
            <select
              id="condition"
              name="condition"
              defaultValue=""
              aria-invalid={Boolean(errors.condition?.length)}
              aria-describedby={describedBy(errors, "condition")}
              required
            >
              <option value="" disabled>
                Select the closest description
              </option>
              <option value="routine">Routine maintenance</option>
              <option value="visible-soil">Visible soil or traffic marks</option>
              <option value="heavy-soil">Heavy soil or multiple concerns</option>
              <option value="unsure">Not sure</option>
            </select>
            <FieldError errors={errors} name="condition" />
          </div>
          <div className="field-group">
            <label htmlFor="stainsPresent">Stains present</label>
            <select
              id="stainsPresent"
              name="stainsPresent"
              defaultValue=""
              aria-invalid={Boolean(errors.stainsPresent?.length)}
              aria-describedby={describedBy(errors, "stainsPresent")}
              required
            >
              <option value="" disabled>
                Select an answer
              </option>
              <option value="yes">Yes</option>
              <option value="no">No visible stains</option>
              <option value="unsure">Not sure</option>
            </select>
            <FieldError errors={errors} name="stainsPresent" />
          </div>
        </div>
        <label className="material-checkbox">
          <input type="checkbox" name="delicateMaterial" />
          <span aria-hidden="true" />
          <span>
            <strong>This may be delicate, valuable or unusual material.</strong>
            <small>
              This flags a need for extra assessment; it does not select a
              treatment level.
            </small>
          </span>
        </label>
      </fieldset>

      <fieldset className="form-section">
        <legend>
          <span>05</span>
          Timing and useful context
        </legend>
        <div className="form-grid form-grid--two">
          <div className="field-group">
            <label htmlFor="preferredDate">Preferred date</label>
            <input id="preferredDate" name="preferredDate" type="date" />
          </div>
          <div className="field-group">
            <label htmlFor="preferredTime">Preferred time period</label>
            <select id="preferredTime" name="preferredTime" defaultValue="flexible">
              <option value="early-morning">Early morning</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
              <option value="flexible">Flexible</option>
            </select>
          </div>
        </div>
        <div className="field-group form-grid--spaced">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            name="notes"
            rows={6}
            placeholder="Tell us about materials, stains, access, building rules or anything else that may affect assessment."
            aria-invalid={Boolean(errors.notes?.length)}
            aria-describedby={describedBy(errors, "notes", "notes-hint")}
          />
          <p className="field-hint" id="notes-hint">
            Do not include payment information or highly sensitive personal data.
          </p>
          <FieldError errors={errors} name="notes" />
        </div>

        <div className="upload-placeholder" aria-disabled="true">
          <div>
            <span aria-hidden="true">＋</span>
            <strong>Photos will be supported in a later phase.</strong>
            <p>No files can be selected, uploaded or stored yet.</p>
          </div>
          <button type="button" disabled>
            Add photos — coming later
          </button>
        </div>
      </fieldset>

      <div className="request-form__submit">
        <div>
          <strong>Prototype only</strong>
          <p>Validation happens in this browser. Nothing is transmitted.</p>
        </div>
        <button className="submit-button" type="submit">
          Validate request details
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    </form>
  );
}
