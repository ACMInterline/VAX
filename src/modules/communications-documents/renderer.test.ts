import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  communicationFingerprint,
  documentChecksum,
  renderDocument,
  TemplateRenderError,
} from "./renderer";
import { canonicalCommunicationTemplates } from "./templates";
import type {
  CommunicationTemplateRecord,
  ResolvedCommunicationSource,
} from "./types";

const quoteTemplate = {
  ...canonicalCommunicationTemplates.find(
    (template) => template.templateKey === "quote_issued" && template.locale === "en",
  )!,
  status: "ACTIVE" as const,
};

const quoteSource: ResolvedCommunicationSource = {
  sourceType: "QUOTE",
  sourceId: "10000000-0000-4000-8000-000000000001",
  sourceReference: "Q-000000000000000000000001",
  sourceVersion: 1,
  customerId: "20000000-0000-4000-8000-000000000001",
  bookingOccupancyId: null,
  businessAuditEventId: "30000000-0000-4000-8000-000000000001",
  bookingAuditEventId: null,
  jobAuditEventId: null,
  financeAuditEventId: null,
  eventType: "QUOTE_ISSUED",
  purpose: "OPERATIONAL",
  localeHint: "en",
  occurredAt: new Date("2026-08-27T10:00:00.000Z"),
  templateKey: "quote_issued",
  documentType: "QUOTE_SUMMARY",
  variables: {
    customer_name: "Example Customer",
    quote_reference: "Q-000000000000000000000001",
    valid_until: "30/09/2026",
    gross_total: "€120.00",
  },
  facts: [
    {
      key: "reference",
      label: "Reference",
      value: "Q-000000000000000000000001",
    },
  ],
  lineItems: [
    {
      description: "Sofa cleaning",
      quantity: 1,
      amountMinorUnits: 12_000,
      currency: "EUR",
    },
  ],
  totals: { currency: "EUR", grossAmountMinorUnits: 12_000 },
  notices: [],
  sourcePayload: {
    schemaVersion: 1,
    sourceSnapshotChecksumSha256: "a".repeat(64),
    sourceAuditEventType: "QUOTE_ISSUED",
  },
  projectionPayload: {},
};

function alteredTemplate(
  change: Partial<CommunicationTemplateRecord>,
): CommunicationTemplateRecord {
  return { ...quoteTemplate, ...change };
}

describe("communication template rendering", () => {
  it("keeps one unique plain-text Bulgarian and English template for every canonical event variant", () => {
    expect(canonicalCommunicationTemplates).toHaveLength(18);
    expect(
      new Set(
        canonicalCommunicationTemplates.map(
          (template) => `${template.templateKey}:${template.locale}`,
        ),
      ).size,
    ).toBe(18);

    for (const template of canonicalCommunicationTemplates) {
      const text = `${template.titleTemplate}\n${template.bodyTemplate}`;
      const placeholders = Array.from(
        text.matchAll(/{{([a-z][a-z0-9_]*)}}/g),
        (match) => match[1],
      );
      expect(new Set(placeholders)).toEqual(
        new Set(template.variablesContract),
      );
      expect(text).not.toMatch(/[<>]/);
    }
  });

  it("renders only the declared variables into a typed immutable snapshot", () => {
    const content = renderDocument(quoteTemplate, quoteSource);

    expect(content).toEqual({
      schemaVersion: 1,
      rendererVersion: 1,
      eventType: "QUOTE_ISSUED",
      sourceReference: "Q-000000000000000000000001",
      locale: "en",
      title: "Quote Q-000000000000000000000001",
      body: "Hello Example Customer. This quote is valid until 30/09/2026 and totals €120.00.",
      facts: quoteSource.facts,
      lineItems: quoteSource.lineItems,
      totals: quoteSource.totals,
      notices: [],
    });
    expect(content.title).not.toContain("{{");
    expect(content.body).not.toContain("{{");
  });

  it("accepts one occurrence of each declared placeholder across title and body", () => {
    const content = renderDocument(
      alteredTemplate({
        titleTemplate: "Quote {{quote_reference}} for {{customer_name}}",
        bodyTemplate: "Valid until {{valid_until}}. Total {{gross_total}}.",
      }),
      quoteSource,
    );

    expect(content.title).toBe(
      "Quote Q-000000000000000000000001 for Example Customer",
    );
    expect(content.body).toBe("Valid until 30/09/2026. Total €120.00.");
  });

  it("fails closed when a placeholder is duplicated across title and body", () => {
    expect(() =>
      renderDocument(
        alteredTemplate({
          bodyTemplate: `${quoteTemplate.bodyTemplate} Reference {{quote_reference}}.`,
        }),
        quoteSource,
      ),
    ).toThrow(TemplateRenderError);
  });

  it.each([
    [
      "undeclared placeholder",
      alteredTemplate({ bodyTemplate: "Hello {{provider_secret}}." }),
      quoteSource.variables,
    ],
    [
      "malformed placeholder",
      alteredTemplate({ bodyTemplate: "Hello {customer_name}." }),
      quoteSource.variables,
    ],
    [
      "missing variable",
      quoteTemplate,
      {
        customer_name: "Example Customer",
        quote_reference: "Q-000000000000000000000001",
        valid_until: "30/09/2026",
      },
    ],
    [
      "extra variable",
      quoteTemplate,
      { ...quoteSource.variables, provider_secret: "must not render" },
    ],
    [
      "empty variable",
      quoteTemplate,
      { ...quoteSource.variables, customer_name: "" },
    ],
    [
      "oversized variable",
      quoteTemplate,
      { ...quoteSource.variables, customer_name: "x".repeat(4_001) },
    ],
  ] as const)("fails closed for a %s", (_label, template, variables) => {
    expect(() =>
      renderDocument(template, { ...quoteSource, variables }),
    ).toThrow(TemplateRenderError);
  });

  it("rejects inactive, mismatched-locale, and mismatched-document templates", () => {
    expect(() =>
      renderDocument({ ...quoteTemplate, status: "SUPERSEDED" } as never, quoteSource),
    ).toThrow(TemplateRenderError);
    expect(() =>
      renderDocument(alteredTemplate({ locale: "bg" }), quoteSource),
    ).toThrow(TemplateRenderError);
    expect(() =>
      renderDocument(
        alteredTemplate({ documentType: "BOOKING_CONFIRMATION" }),
        quoteSource,
      ),
    ).toThrow(TemplateRenderError);
  });
});

describe("document integrity hashes", () => {
  it("canonicalizes object keys recursively while preserving array order", () => {
    expect(canonicalJson({ z: 1, a: { y: 2, b: 3 } })).toBe(
      '{"a":{"b":3,"y":2},"z":1}',
    );
    expect(
      communicationFingerprint({ source: { b: 2, a: 1 }, versions: [1, 2] }),
    ).toBe(
      communicationFingerprint({ versions: [1, 2], source: { a: 1, b: 2 } }),
    );
    expect(
      communicationFingerprint({ source: { a: 1, b: 2 }, versions: [2, 1] }),
    ).not.toBe(
      communicationFingerprint({ versions: [1, 2], source: { a: 1, b: 2 } }),
    );
  });

  it("binds the checksum to template identity, locale, renderer, and content", () => {
    const content = renderDocument(quoteTemplate, quoteSource);
    const checksum = documentChecksum(quoteTemplate, content);

    expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(documentChecksum(quoteTemplate, content)).toBe(checksum);
    expect(
      documentChecksum({ ...quoteTemplate, version: 2 }, content),
    ).not.toBe(checksum);
    expect(
      documentChecksum(quoteTemplate, {
        ...content,
        body: `${content.body} Changed`,
      }),
    ).not.toBe(checksum);
  });
});
