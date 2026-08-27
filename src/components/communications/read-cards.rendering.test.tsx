import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CustomerDocumentDetail } from "@/modules/communications-documents/types";
import { ImmutableDocumentView } from "./read-cards";

const document: CustomerDocumentDetail = {
  documentReference: "DOC-0123456789ABCDEF01234567",
  documentType: "INVOICE",
  locale: "en",
  status: "FINAL",
  checksumSha256: "a".repeat(64),
  finalizedAt: new Date("2026-08-27T09:00:00.000Z"),
  content: {
    schemaVersion: 1,
    rendererVersion: 1,
    eventType: "INVOICE_ISSUED",
    sourceReference: "INV-0123456789ABCDEF01234567",
    locale: "en",
    title: "Invoice <script>alert(1)</script>",
    body: "Customer-safe body & history",
    facts: [{ key: "reference", label: "Reference", value: "INV-SAFE" }],
    lineItems: [
      {
        description: "Service <img src=x onerror=alert(1)>",
        quantity: 1,
        amountMinorUnits: 12_000,
        currency: "EUR",
      },
    ],
    totals: { currency: "EUR", grossAmountMinorUnits: 12_000 },
    notices: ["Stored immutable notice"],
  },
};

describe("Phase 3I immutable document presentation", () => {
  it("renders stored English content as escaped semantic print HTML", () => {
    const html = renderToStaticMarkup(<ImmutableDocumentView document={document} />);
    expect(html).toContain('data-print-document="communication"');
    expect(html).toContain('lang="en"');
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("<caption>Document line items</caption>");
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
  });

  it("derives every document label and formatter from the immutable locale", () => {
    const html = renderToStaticMarkup(<ImmutableDocumentView document={document} />);
    expect(html).toContain('lang="en"');
    expect(html).toContain("Invoice &lt;script&gt;");
    expect(html).toContain("Document line items");
    expect(html).toContain("Details");
    expect(html).not.toContain("Позиции");
    expect(html).not.toContain("Данни");
  });

  it("never renders stored content through an unsafe HTML escape hatch", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/communications/read-cards.tsx"),
      "utf8",
    );
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });
});
