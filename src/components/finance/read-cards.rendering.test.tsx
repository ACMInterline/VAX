import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { financeContent } from "@/content/finance";
import type { CustomerInvoiceDetail } from "@/modules/finance-invoicing/types";
import { InvoiceDocument } from "./read-cards";

const invoice: CustomerInvoiceDetail = {
  invoiceReference: "INV-0123456789ABCDEF01234567",
  invoiceNumber: "DEV-INV-000001",
  type: "STANDARD",
  status: "ISSUED",
  customerDisplayName: "Synthetic Customer",
  bookingReference: "BKG-0123456789ABCDEF01234567",
  quoteReference: "Q-0123456789ABCDEF01234567",
  issueDate: "2026-08-26",
  dueDate: "2026-09-02",
  currency: "EUR",
  grossAmountMinorUnits: 12_000,
  paidAmountMinorUnits: 2_000,
  outstandingAmountMinorUnits: 10_000,
  createdAt: new Date("2026-08-26T08:00:00.000Z"),
  version: 2,
  customerSnapshot: {
    billingName: "Synthetic Customer Ltd",
    addressLine1: "1 Test Street",
    city: "Sofia",
    companyRegistrationNumber: "TEST-CUSTOMER-REG",
    vatNumber: "TEST-CUSTOMER-VAT",
    internalSecret: "must-not-render-customer-secret",
  },
  sellerSnapshot: {
    legalName: "VAX Synthetic Seller",
    registrationNumber: "TEST-SELLER-REG",
    addressLine1: "2 Test Street",
    city: "Sofia",
    paymentInstructions: "Use the invoice number as the payment reference.",
    internalSecret: "must-not-render-seller-secret",
  },
  termsSnapshot: { internalTerms: "must-not-render-terms" },
  customerVisibleNote: "Thank you.",
  items: [
    {
      descriptionBg: "Тестова услуга",
      descriptionEn: "Synthetic service",
      quantity: 1,
      measurementSnapshot: { internalMeasure: "must-not-render-measurement" },
      netAmountMinorUnits: 10_000,
      vatRateBasisPoints: 2_000,
      vatAmountMinorUnits: 2_000,
      grossAmountMinorUnits: 12_000,
      sortOrder: 1,
    },
  ],
  paymentInstructions: null,
};

describe("invoice read presentation", () => {
  it("renders a semantic English invoice without leaking unapproved snapshot fields", () => {
    const html = renderToStaticMarkup(
      <InvoiceDocument
        invoice={invoice}
        locale="en"
        content={financeContent.en}
      />,
    );

    expect(html).toContain('data-print-document="invoice"');
    expect(html).toContain("Synthetic service");
    expect(html).toContain("Synthetic Customer Ltd");
    expect(html).toContain("VAX Synthetic Seller");
    expect(html).toContain("Use the invoice number as the payment reference.");
    expect(html).toContain("<table>");
    expect(html).toContain("<caption>Line items</caption>");
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    expect(html).not.toMatch(/must-not-render/);
  });

  it("selects Bulgarian line descriptions and labels", () => {
    const html = renderToStaticMarkup(
      <InvoiceDocument
        invoice={invoice}
        locale="bg"
        content={financeContent.bg}
      />,
    );

    expect(html).toContain("Тестова услуга");
    expect(html).toContain("Получател");
    expect(html).not.toContain("Synthetic service");
  });
});
