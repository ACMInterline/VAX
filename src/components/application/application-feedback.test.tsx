import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApplicationActionStatus } from "./action-status";
import {
  ApplicationFieldError,
  fieldDescriptionIds,
} from "./field-error";
import { ApplicationFormErrorSummary } from "./form-error-summary";
import { ApplicationStatusBadge } from "./status-badge";

describe("application feedback primitives", () => {
  it("renders an error response as a focusable polite alert", () => {
    const html = renderToStaticMarkup(
      <ApplicationActionStatus
        state={{ status: "ERROR", message: "The record could not be saved." }}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-atomic="true"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain("The record could not be saved.");
  });

  it("links a validation summary to its invalid field", () => {
    const html = renderToStaticMarkup(
      <ApplicationFormErrorSummary
        response={{}}
        title="Check the highlighted field"
        errors={[
          {
            fieldId: "display-name",
            label: "Display name",
            message: "Enter a display name.",
          },
        ]}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('href="#display-name"');
    expect(html).toContain("Display name: Enter a display name.");
  });

  it("renders every field message and composes unique descriptions", () => {
    const html = renderToStaticMarkup(
      <ApplicationFieldError
        id="email-error"
        messages={["Enter an email.", "Use a valid email address."]}
      />,
    );

    expect(html).toContain('id="email-error"');
    expect(html).toContain("Enter an email.");
    expect(html).toContain("Use a valid email address.");
    expect(fieldDescriptionIds("email-hint", "email-error", "email-hint")).toBe(
      "email-hint email-error",
    );
    expect(fieldDescriptionIds(undefined, false, null)).toBeUndefined();
  });

  it("keeps status meaning visible instead of relying on tone alone", () => {
    const html = renderToStaticMarkup(
      <ApplicationStatusBadge label="Archived" tone="muted" />,
    );

    expect(html).toContain("Archived");
    expect(html).toContain("application-status-badge--muted");
  });
});
