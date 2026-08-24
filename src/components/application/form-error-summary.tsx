"use client";

import { useEffect, useRef } from "react";

export type ApplicationFormError = Readonly<{
  fieldId: string;
  label: string;
  message: string;
}>;

export function ApplicationFormErrorSummary({
  className,
  errors,
  response,
  title,
}: {
  className?: string;
  errors: readonly ApplicationFormError[];
  response: object;
  title: string;
}) {
  const summaryRef = useRef<HTMLDivElement>(null);

  // The response object distinguishes repeated submissions whose validation
  // result is textually identical.
  useEffect(() => {
    if (errors.length > 0) {
      summaryRef.current?.focus();
    }
  }, [errors.length, response]);

  if (errors.length === 0) return null;

  const classes = ["application-form-error-summary", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={summaryRef}
      className={classes}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      tabIndex={-1}
    >
      <strong>{title}</strong>
      <ul>
        {errors.map(({ fieldId, label, message }, index) => (
          <li key={`${fieldId}:${index}`}>
            <a href={`#${fieldId}`}>
              {label}: {message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
