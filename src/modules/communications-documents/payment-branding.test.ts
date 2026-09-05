import { describe, expect, it, vi } from "vitest";
import {
  canonicalJson,
  documentChecksum,
  renderDocument,
} from "./renderer";
import {
  createCommunicationsService,
  type CommunicationsRepository,
} from "./service";
import {
  localizeCommunicationSource,
  projectCommunicationSource,
  SourceProjectionError,
  type RawCommunicationSourceRow,
} from "./source-projection";
import { canonicalCommunicationTemplates, templateKeyFor } from "./templates";
import type {
  CommunicationLocale,
  CommunicationTemplateRecord,
  CustomerDocumentDetail,
  DocumentContentSnapshot,
} from "./types";

type PaymentEvent = "PAYMENT_CONFIRMED" | "PAYMENT_REVERSED";
const documentType = "PAYMENT_ACKNOWLEDGEMENT";
const paymentReference = "PAY-000000000000000000000001";
const cases = [
  ["PAYMENT_CONFIRMED", "bg"],
  ["PAYMENT_CONFIRMED", "en"],
  ["PAYMENT_REVERSED", "bg"],
  ["PAYMENT_REVERSED", "en"],
] as const;

// These explicit prior-release bytes are historical evidence, not generated
// from whichever template/projection happens to be current during the test.
const historicalPaymentCopy = {
  PAYMENT_CONFIRMED: {
    templateKey: "payment_confirmed",
    variablesContract: ["payment_reference", "amount", "confirmed_at"],
    bg: {
      titleTemplate: "Потвърдено плащане {{payment_reference}}",
      bodyTemplate:
        "Плащането на стойност {{amount}} е потвърдено във VAX на {{confirmed_at}}. Това не е доказателство за доставка от външен платежен доставчик.",
      body:
        "Плащането на стойност 45,00 EUR е потвърдено във VAX на 05.09.2026. Това не е доказателство за доставка от външен платежен доставчик.",
    },
    en: {
      titleTemplate: "Payment confirmed {{payment_reference}}",
      bodyTemplate:
        "The payment of {{amount}} was confirmed in VAX on {{confirmed_at}}. This is not evidence of delivery by an external payment provider.",
      body:
        "The payment of EUR 45.00 was confirmed in VAX on 05/09/2026. This is not evidence of delivery by an external payment provider.",
    },
  },
  PAYMENT_REVERSED: {
    templateKey: "payment_reversed",
    variablesContract: ["payment_reference", "amount", "reversed_at"],
    bg: {
      titleTemplate: "Сторнирано плащане {{payment_reference}}",
      bodyTemplate:
        "Записът за плащане на стойност {{amount}} е сторниран във VAX на {{reversed_at}}. Това не представлява автоматично връщане на средства.",
      body:
        "Записът за плащане на стойност 45,00 EUR е сторниран във VAX на 05.09.2026. Това не представлява автоматично връщане на средства.",
    },
    en: {
      titleTemplate: "Payment reversed {{payment_reference}}",
      bodyTemplate:
        "The VAX payment record for {{amount}} was reversed on {{reversed_at}}. This does not represent an automatic refund.",
      body:
        "The VAX payment record for EUR 45.00 was reversed on 05/09/2026. This does not represent an automatic refund.",
    },
  },
} as const;

const historicalNotices = {
  bg: "Записът удостоверява състояние във VAX, а не външна доставка или автоматично движение на средства.",
  en: "This records a VAX state, not external delivery or an automatic movement of funds.",
} as const;

function expectedCurrentKey(eventType: PaymentEvent): string {
  return eventType === "PAYMENT_CONFIRMED"
    ? "attelier_payment_confirmed"
    : "attelier_payment_reversed";
}

function paymentRow(
  eventType: PaymentEvent,
  localeHint: string,
): RawCommunicationSourceRow {
  return {
    sourceType: "PAYMENT",
    sourceId: "10000000-0000-4000-8000-000000000001",
    sourceReference: paymentReference,
    sourceVersion: eventType === "PAYMENT_CONFIRMED" ? 2 : 3,
    customerId: "20000000-0000-4000-8000-000000000001",
    bookingOccupancyId: null,
    businessAuditEventId: null,
    bookingAuditEventId: null,
    jobAuditEventId: null,
    financeAuditEventId: "30000000-0000-4000-8000-000000000001",
    occurredAt: new Date("2026-09-05T09:00:00.000Z"),
    localeHint,
    payload: {
      sourceSnapshotChecksumSha256: "a".repeat(64),
      sourceAuditEventType: eventType,
      amountMinorUnits: 4_500,
      method: "BANK_TRANSFER",
      receivedAt: "2026-09-05T07:00:00.000Z",
      confirmedAt: "2026-09-05T08:00:00.000Z",
      reversedAt: "2026-09-05T09:00:00.000Z",
    },
  };
}

function currentTemplate(
  eventType: PaymentEvent,
  locale: CommunicationLocale,
): CommunicationTemplateRecord {
  const template = canonicalCommunicationTemplates.find(
    (candidate) =>
      candidate.templateKey === expectedCurrentKey(eventType) &&
      candidate.locale === locale &&
      candidate.version === 1,
  );
  expect(
    template,
    "A distinct prospective ATTELIER template identity is required",
  ).toBeDefined();
  return { ...template!, status: "ACTIVE" };
}

describe("prospective ATTELIER payment communication identity", () => {
  it.each(cases)("renders a new %s %s ATTELIER payment template", (eventType, locale) => {
    const source = projectCommunicationSource(
      eventType,
      documentType,
      paymentRow(eventType, locale),
    );
    expect(templateKeyFor(eventType, documentType)).toBe(
      expectedCurrentKey(eventType),
    );
    expect(source.templateKey).toBe(expectedCurrentKey(eventType));
    const template = currentTemplate(eventType, locale);
    const content = renderDocument(template, source);

    expect(template.version).toBe(1);
    expect(template.templateKey).not.toBe(
      historicalPaymentCopy[eventType].templateKey,
    );
    expect(content.locale).toBe(locale);
    expect(content.body).toContain("ATTELIER");
    expect(content.body).not.toContain("VAX");
    expect(content.totals).toEqual({
      currency: "EUR",
      grossAmountMinorUnits: 4_500,
    });
    expect(content.body).toContain(
      eventType === "PAYMENT_CONFIRMED"
        ? locale === "bg"
          ? "Това не е доказателство за доставка от външен платежен доставчик."
          : "This is not evidence of delivery by an external payment provider."
        : locale === "bg"
          ? "Това не представлява автоматично връщане на средства."
          : "This does not represent an automatic refund.",
    );
  });

  it.each(cases)("projects an ATTELIER notice for %s %s", (eventType, locale) => {
    const source = projectCommunicationSource(
      eventType,
      documentType,
      paymentRow(eventType, locale),
    );

    expect(source.notices).toHaveLength(1);
    expect(source.notices[0]).toContain("ATTELIER");
    expect(source.notices[0]).not.toContain("VAX");
    expect(source.notices[0]).toContain(
      locale === "bg"
        ? "а не външна доставка или автоматично движение на средства."
        : "not external delivery or an automatic movement of funds.",
    );
    expect(source.sourcePayload).toEqual({
      schemaVersion: 1,
      sourceSnapshotChecksumSha256: "a".repeat(64),
      sourceAuditEventType: eventType,
    });
  });

  it.each(["PAYMENT_CONFIRMED", "PAYMENT_REVERSED"] as const)("localizes %s without changing source provenance", (eventType) => {
    const source = projectCommunicationSource(
      eventType,
      documentType,
      paymentRow(eventType, "bg"),
    );
    const localized = localizeCommunicationSource(source, "en");

    expect(source.localeHint).toBe("bg");
    expect(localized.localeHint).toBe("en");
    for (const candidate of [source, localized]) {
      expect(candidate.templateKey).toBe(expectedCurrentKey(eventType));
      expect(candidate.notices[0]).toContain("ATTELIER");
      expect(candidate.sourceId).toBe(source.sourceId);
      expect(candidate.sourceVersion).toBe(source.sourceVersion);
      expect(candidate.sourcePayload).toEqual(source.sourcePayload);
    }
    expect(() =>
      projectCommunicationSource(
        eventType,
        documentType,
        paymentRow(eventType, "unsupported"),
      ),
    ).toThrow(SourceProjectionError);
  });
});

describe("historical VAX payment communication preservation", () => {
  it.each(cases)("retains original %s %s template bytes", (eventType, locale) => {
    const historical = historicalPaymentCopy[eventType];
    const template = canonicalCommunicationTemplates.find(
      (candidate) =>
        candidate.templateKey === historical.templateKey &&
        candidate.locale === locale &&
        candidate.version === 1,
    );

    expect(template).toEqual({
      templateKey: historical.templateKey,
      version: 1,
      locale,
      documentType,
      titleTemplate: historical[locale].titleTemplate,
      bodyTemplate: historical[locale].bodyTemplate,
      variablesContract: historical.variablesContract,
    });
  });

  it.each(cases)("returns stored %s %s snapshot bytes", async (eventType, locale) => {
    const historical = historicalPaymentCopy[eventType];
    const historicalTemplate: CommunicationTemplateRecord = {
      templateKey: historical.templateKey,
      version: 1,
      locale,
      documentType,
      titleTemplate: historical[locale].titleTemplate,
      bodyTemplate: historical[locale].bodyTemplate,
      variablesContract: historical.variablesContract,
      status: "ACTIVE",
    };
    const content: DocumentContentSnapshot = {
      schemaVersion: 1,
      rendererVersion: 1,
      eventType,
      sourceReference: paymentReference,
      locale,
      title: historical[locale].titleTemplate.replace(
        "{{payment_reference}}",
        paymentReference,
      ),
      body: historical[locale].body,
      facts: [],
      lineItems: [],
      totals: { currency: "EUR", grossAmountMinorUnits: 4_500 },
      notices: [historicalNotices[locale]],
    };
    const persisted: CustomerDocumentDetail = {
      documentReference: "DOC-000000000000000000000001",
      documentType,
      locale,
      status: "FINAL",
      checksumSha256: documentChecksum(historicalTemplate, content),
      finalizedAt: new Date("2026-09-05T09:00:00.000Z"),
      content,
    };
    const historicalBytes = canonicalJson(persisted);
    const getCustomerDocument = vi.fn().mockResolvedValue(persisted);
    const resolveSource = vi.fn();
    const resolveDeliveryContext = vi.fn();
    const persist = vi.fn();
    // Only the storage boundary is replaced; the actual customer read service
    // must return frozen content, not run the current materialization pipeline.
    const repository = {
      getCustomerDocument,
      resolveSource,
      resolveDeliveryContext,
      persist,
    } as unknown as CommunicationsRepository;
    const result = await createCommunicationsService(repository).getMyDocument(
      {
        profileId: "40000000-0000-4000-8000-000000000001",
        status: "ACTIVE",
        roles: new Set(["CUSTOMER"]),
        permissions: new Set(["OWN_CUSTOMER_DATA_READ"]),
      },
      { documentReference: persisted.documentReference },
    );

    expect(result).toBe(persisted);
    expect(canonicalJson(result)).toBe(historicalBytes);
    expect(result.content.body).toContain("VAX");
    expect(result.content.notices).toEqual([historicalNotices[locale]]);
    expect(result.checksumSha256).toBe(
      documentChecksum(historicalTemplate, content),
    );
    expect(resolveSource).not.toHaveBeenCalled();
    expect(resolveDeliveryContext).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });
});
