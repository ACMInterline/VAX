import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthStatusMessage } from "./auth-status-message";

describe("authentication status navigation", () => {
  it.each([
    ["bg", "/verify-email", "Към потвърждение на имейл"],
    ["en", "/en/verify-email", "Go to email verification"],
  ] as const)(
    "renders a visible, localized verification route for a %s error",
    (locale, href, label) => {
      const html = renderToStaticMarkup(
        <AuthStatusMessage
          locale={locale}
          state={{
            status: "ERROR",
            message: "Generic verification-required message.",
            nextStep: "VERIFY_EMAIL",
          }}
        />,
      );

      expect(html).toContain('role="alert"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('tabindex="-1"');
      expect(html).toContain(`href="${href}"`);
      expect(html).toContain(label);
      expect(html).not.toMatch(/provider|token|otp/i);
    },
  );

  it("does not show verification navigation for unrelated errors", () => {
    const html = renderToStaticMarkup(
      <AuthStatusMessage
        locale="en"
        state={{ status: "ERROR", message: "Generic unavailable message." }}
      />,
    );

    expect(html).not.toContain("/verify-email");
  });

  it("keeps the generic signup completion state linked to verification", () => {
    const html = renderToStaticMarkup(
      <AuthStatusMessage
        locale="en"
        state={{
          status: "SUCCESS",
          message: "Generic registration response.",
          nextStep: "VERIFY_EMAIL",
        }}
      />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('href="/en/verify-email"');
  });
});
