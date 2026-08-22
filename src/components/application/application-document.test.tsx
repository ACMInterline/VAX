import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApplicationDocument } from "./application-document";

describe("protected application document language", () => {
  it.each([
    ["bg", "Към основното съдържание"],
    ["en", "Skip to content"],
  ] as const)("renders the %s profile locale at the document root", (locale, label) => {
    const html = renderToStaticMarkup(
      <ApplicationDocument locale={locale}>
        <main id="app-main">Protected content</main>
      </ApplicationDocument>,
    );

    expect(html).toContain(`<html lang="${locale}">`);
    expect(html).toContain(label);
  });
});
