import type {
  CommunicationDocumentType,
  CommunicationEventType,
  CommunicationLocale,
  DocumentFact,
  DocumentLineItem,
  DocumentTotals,
  ResolvedCommunicationSource,
} from "./types";
import { templateKeyFor } from "./templates";

export type RawCommunicationSourceRow = Readonly<{
  sourceType: "QUOTE" | "BOOKING" | "JOB" | "INVOICE" | "PAYMENT";
  sourceId: string;
  sourceReference: string;
  sourceVersion: number;
  customerId: string;
  bookingOccupancyId: string | null;
  businessAuditEventId: string | null;
  bookingAuditEventId: string | null;
  jobAuditEventId: string | null;
  financeAuditEventId: string | null;
  occurredAt: Date;
  localeHint: string;
  payload: unknown;
}>;

export class SourceProjectionError extends Error {
  constructor() {
    super("SOURCE_PROJECTION_INVALID");
    this.name = "SourceProjectionError";
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SourceProjectionError();
  }
  return value as Record<string, unknown>;
}

function array(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new SourceProjectionError();
  return value;
}

function string(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SourceProjectionError();
  }
  return value;
}

function optionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return string(value);
}

function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new SourceProjectionError();
  }
  return value;
}

function optionalInteger(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  return integer(value);
}

function locale(value: unknown): CommunicationLocale {
  if (value !== "bg" && value !== "en") throw new SourceProjectionError();
  return value;
}

function instant(value: unknown): Date {
  const parsed = value instanceof Date ? value : new Date(string(value));
  if (Number.isNaN(parsed.getTime())) throw new SourceProjectionError();
  return parsed;
}

function dateLabel(value: unknown, selectedLocale: CommunicationLocale): string {
  return new Intl.DateTimeFormat(selectedLocale === "bg" ? "bg-BG" : "en-GB", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant(value));
}

function dateTimeLabel(
  value: unknown,
  selectedLocale: CommunicationLocale,
): string {
  return new Intl.DateTimeFormat(selectedLocale === "bg" ? "bg-BG" : "en-GB", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(instant(value));
}

function money(value: number, selectedLocale: CommunicationLocale): string {
  return new Intl.NumberFormat(selectedLocale === "bg" ? "bg-BG" : "en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(value / 100);
}

const labels = {
  bg: {
    reference: "Референция",
    issuedAt: "Издадена на",
    validUntil: "Валидна до",
    property: "Обект",
    schedule: "Час на услугата",
    completedAt: "Завършена на",
    invoiceNumber: "Номер на фактура",
    dueDate: "Срок за плащане",
    paymentMethod: "Метод на плащане",
    receivedAt: "Получено на",
    confirmedAt: "Потвърдено на",
    reversedAt: "Сторнирано на",
    cancelledAt: "Отменена на",
    jobItem: "Изпълнена услуга",
    passportItem: "Запис в паспорта",
    paymentNotice:
      "Записът удостоверява състояние в ATTELIER, а не външна доставка или автоматично движение на средства.",
  },
  en: {
    reference: "Reference",
    issuedAt: "Issued on",
    validUntil: "Valid until",
    property: "Property",
    schedule: "Service time",
    completedAt: "Completed on",
    invoiceNumber: "Invoice number",
    dueDate: "Due date",
    paymentMethod: "Payment method",
    receivedAt: "Received on",
    confirmedAt: "Confirmed on",
    reversedAt: "Reversed on",
    cancelledAt: "Cancelled on",
    jobItem: "Completed service",
    passportItem: "Passport entry",
    paymentNotice:
      "This records an ATTELIER state, not external delivery or an automatic movement of funds.",
  },
} as const;

function lineItems(
  value: unknown,
  selectedLocale: CommunicationLocale,
): readonly DocumentLineItem[] {
  return array(value).map((entry) => {
    const item = object(entry);
    const description = string(
      selectedLocale === "bg" ? item.descriptionBg : item.descriptionEn,
    );
    const amount = optionalInteger(item.amountMinorUnits);
    return {
      description,
      quantity: integer(item.quantity),
      ...(amount === undefined
        ? {}
        : { amountMinorUnits: amount, currency: "EUR" as const }),
    };
  });
}

function totals(value: unknown): DocumentTotals | null {
  if (value === null || value === undefined) return null;
  const record = object(value);
  return {
    currency: "EUR",
    netAmountMinorUnits: optionalInteger(record.netAmountMinorUnits),
    vatAmountMinorUnits: optionalInteger(record.vatAmountMinorUnits),
    grossAmountMinorUnits: integer(record.grossAmountMinorUnits),
    paidAmountMinorUnits: optionalInteger(record.paidAmountMinorUnits),
    outstandingAmountMinorUnits: optionalInteger(
      record.outstandingAmountMinorUnits,
    ),
  };
}

function safeSourcePayload(payload: Record<string, unknown>) {
  return {
    schemaVersion: 1,
    sourceSnapshotChecksumSha256: string(payload.sourceSnapshotChecksumSha256),
    sourceAuditEventType: string(payload.sourceAuditEventType),
  } as const;
}

export function projectCommunicationSource(
  eventType: Exclude<CommunicationEventType, "MANUAL_STAFF_MESSAGE">,
  documentType: CommunicationDocumentType,
  row: RawCommunicationSourceRow,
): ResolvedCommunicationSource {
  const payload = object(row.payload);
  const selectedLocale = locale(row.localeHint);
  const text = labels[selectedLocale];
  const common = {
    ...row,
    eventType,
    localeHint: selectedLocale,
    occurredAt: instant(row.occurredAt),
    templateKey: templateKeyFor(eventType, documentType),
    documentType,
    sourcePayload: safeSourcePayload(payload),
    projectionPayload: payload,
  } as const;

  if (eventType === "QUOTE_ISSUED" && row.sourceType === "QUOTE") {
    const customerName = string(payload.customerName);
    const validUntil = dateLabel(payload.validUntil, selectedLocale);
    const gross = integer(payload.grossAmountMinorUnits);
    const facts: DocumentFact[] = [
      { key: "reference", label: text.reference, value: row.sourceReference },
      {
        key: "issued_at",
        label: text.issuedAt,
        value: dateTimeLabel(payload.issuedAt, selectedLocale),
      },
      { key: "valid_until", label: text.validUntil, value: validUntil },
    ];
    const propertyLabel = optionalString(payload.propertyLabel);
    if (propertyLabel) {
      facts.push({ key: "property", label: text.property, value: propertyLabel });
    }
    return {
      ...common,
      purpose: "OPERATIONAL",
      variables: {
        customer_name: customerName,
        quote_reference: row.sourceReference,
        valid_until: validUntil,
        gross_total: money(gross, selectedLocale),
      },
      facts,
      lineItems: lineItems(payload.lineItems, selectedLocale),
      totals: totals(payload.totals),
      notices: [],
    };
  }

  if (eventType.startsWith("BOOKING_") && row.sourceType === "BOOKING") {
    const customerName = string(payload.customerName);
    const facts: DocumentFact[] = [
      { key: "reference", label: text.reference, value: row.sourceReference },
    ];
    const variables: Record<string, string> = {
      customer_name: customerName,
      booking_reference: row.sourceReference,
    };
    if (eventType === "BOOKING_CANCELLED") {
      const eventDate = dateTimeLabel(row.occurredAt, selectedLocale);
      variables.event_date = eventDate;
      facts.push({
        key: "cancelled_at",
        label: text.cancelledAt,
        value: eventDate,
      });
    } else {
      const schedule = `${dateTimeLabel(payload.serviceStart, selectedLocale)} – ${dateTimeLabel(payload.serviceEnd, selectedLocale)}`;
      variables.schedule = schedule;
      facts.push({ key: "schedule", label: text.schedule, value: schedule });
    }
    const propertyLabel = optionalString(payload.propertyLabel);
    if (propertyLabel) {
      facts.push({ key: "property", label: text.property, value: propertyLabel });
    }
    return {
      ...common,
      purpose: "OPERATIONAL",
      variables,
      facts,
      lineItems: lineItems(payload.lineItems, selectedLocale),
      totals: totals(payload.totals),
      notices: [],
    };
  }

  if (eventType === "JOB_COMPLETED" && row.sourceType === "JOB") {
    const customerName = string(payload.customerName);
    const completedAt = dateTimeLabel(payload.completedAt, selectedLocale);
    const passport = documentType === "CLEANING_PASSPORT";
    const entries = passport ? payload.passportEntries : payload.lineItems;
    return {
      ...common,
      purpose: "OPERATIONAL",
      variables: {
        customer_name: customerName,
        job_reference: row.sourceReference,
        completed_at: completedAt,
      },
      facts: [
        { key: "reference", label: text.reference, value: row.sourceReference },
        { key: "completed_at", label: text.completedAt, value: completedAt },
      ],
      lineItems: array(entries).map((entry) => {
        const item = object(entry);
        return {
          description: string(
            selectedLocale === "bg" ? item.descriptionBg : item.descriptionEn,
          ),
          quantity: optionalInteger(item.quantity) ?? 1,
        };
      }),
      totals: null,
      notices: array(payload.notices).map(string),
    };
  }

  if (eventType === "INVOICE_ISSUED" && row.sourceType === "INVOICE") {
    const customerName = string(payload.customerName);
    const invoiceNumber = string(payload.invoiceNumber);
    const dueDate = dateLabel(payload.dueDate, selectedLocale);
    const gross = integer(payload.grossAmountMinorUnits);
    return {
      ...common,
      purpose: "BILLING",
      variables: {
        customer_name: customerName,
        invoice_number: invoiceNumber,
        due_date: dueDate,
        gross_total: money(gross, selectedLocale),
      },
      facts: [
        { key: "reference", label: text.reference, value: row.sourceReference },
        {
          key: "invoice_number",
          label: text.invoiceNumber,
          value: invoiceNumber,
        },
        { key: "due_date", label: text.dueDate, value: dueDate },
      ],
      lineItems: lineItems(payload.lineItems, selectedLocale),
      totals: totals(payload.totals),
      notices: array(payload.notices).map(string),
    };
  }

  if (
    (eventType === "PAYMENT_CONFIRMED" || eventType === "PAYMENT_REVERSED") &&
    row.sourceType === "PAYMENT"
  ) {
    const amount = integer(payload.amountMinorUnits);
    const eventInstant = dateTimeLabel(
      eventType === "PAYMENT_CONFIRMED"
        ? payload.confirmedAt
        : payload.reversedAt,
      selectedLocale,
    );
    return {
      ...common,
      purpose: "BILLING",
      variables:
        eventType === "PAYMENT_CONFIRMED"
          ? {
              payment_reference: row.sourceReference,
              amount: money(amount, selectedLocale),
              confirmed_at: eventInstant,
            }
          : {
              payment_reference: row.sourceReference,
              amount: money(amount, selectedLocale),
              reversed_at: eventInstant,
            },
      facts: [
        { key: "reference", label: text.reference, value: row.sourceReference },
        {
          key: "method",
          label: text.paymentMethod,
          value: string(payload.method),
        },
        {
          key: "received_at",
          label: text.receivedAt,
          value: dateTimeLabel(payload.receivedAt, selectedLocale),
        },
        {
          key: eventType === "PAYMENT_CONFIRMED" ? "confirmed_at" : "reversed_at",
          label:
            eventType === "PAYMENT_CONFIRMED"
              ? text.confirmedAt
              : text.reversedAt,
          value: eventInstant,
        },
      ],
      lineItems: [],
      totals: { currency: "EUR", grossAmountMinorUnits: amount },
      notices: [text.paymentNotice],
    };
  }

  throw new SourceProjectionError();
}

export function localizeCommunicationSource(
  source: ResolvedCommunicationSource,
  selectedLocale: CommunicationLocale,
): ResolvedCommunicationSource {
  return projectCommunicationSource(source.eventType, source.documentType, {
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    sourceReference: source.sourceReference,
    sourceVersion: source.sourceVersion,
    customerId: source.customerId,
    bookingOccupancyId: source.bookingOccupancyId,
    businessAuditEventId: source.businessAuditEventId,
    bookingAuditEventId: source.bookingAuditEventId,
    jobAuditEventId: source.jobAuditEventId,
    financeAuditEventId: source.financeAuditEventId,
    occurredAt: source.occurredAt,
    localeHint: selectedLocale,
    payload: source.projectionPayload,
  });
}
