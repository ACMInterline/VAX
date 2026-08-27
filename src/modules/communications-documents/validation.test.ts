import { describe, expect, it } from "vitest";
import {
  communicationListSchema,
  createCommunicationSchema,
  documentContentSnapshotSchema,
  updateCommunicationPreferencesSchema,
} from "./validation";

const idempotencyKey = "10000000-0000-4000-8000-000000000001";
const contactId = "20000000-0000-4000-8000-000000000001";

describe("communication command validation", () => {
  it.each([
    ["QUOTE_ISSUED", "Q-000000000000000000000001", "QUOTE_SUMMARY"],
    [
      "BOOKING_CONFIRMED",
      "BKG-000000000000000000000001",
      "BOOKING_CONFIRMATION",
    ],
    [
      "BOOKING_RESCHEDULED",
      "BKG-000000000000000000000001",
      "BOOKING_CONFIRMATION",
    ],
    [
      "BOOKING_CANCELLED",
      "BKG-000000000000000000000001",
      "BOOKING_CONFIRMATION",
    ],
    ["JOB_COMPLETED", "JOB-000000000000000000000001", "JOB_COMPLETION_SUMMARY"],
    ["JOB_COMPLETED", "JOB-000000000000000000000001", "CLEANING_PASSPORT"],
    ["INVOICE_ISSUED", "INV-000000000000000000000001", "INVOICE"],
    [
      "PAYMENT_CONFIRMED",
      "PAY-000000000000000000000001",
      "PAYMENT_ACKNOWLEDGEMENT",
    ],
    [
      "PAYMENT_REVERSED",
      "PAY-000000000000000000000001",
      "PAYMENT_ACKNOWLEDGEMENT",
    ],
  ] as const)(
    "accepts the %s event only with its canonical source and document",
    (eventType, sourceReference, documentType) => {
      expect(
        createCommunicationSchema.safeParse({
          eventType,
          sourceReference,
          documentType,
          channel: "PORTAL",
          contactId: null,
          idempotencyKey,
        }).success,
      ).toBe(true);
    },
  );

  it.each([
    ["QUOTE_ISSUED", "Q-000000000000000000000001", "INVOICE"],
    ["BOOKING_CONFIRMED", "BKG-000000000000000000000001", "QUOTE_SUMMARY"],
    ["JOB_COMPLETED", "JOB-000000000000000000000001", "INVOICE"],
    ["INVOICE_ISSUED", "INV-000000000000000000000001", "QUOTE_SUMMARY"],
    ["PAYMENT_REVERSED", "PAY-000000000000000000000001", "INVOICE"],
  ] as const)(
    "rejects the invalid %s to %s pairing",
    (eventType, sourceReference, documentType) => {
      expect(
        createCommunicationSchema.safeParse({
          eventType,
          sourceReference,
          documentType,
          channel: "PORTAL",
          contactId: null,
          idempotencyKey,
        }).success,
      ).toBe(false);
    },
  );

  it("requires the source prefix to match the selected business event", () => {
    expect(
      createCommunicationSchema.safeParse({
        eventType: "QUOTE_ISSUED",
        sourceReference: "INV-000000000000000000000001",
        documentType: "QUOTE_SUMMARY",
        channel: "PORTAL",
        contactId: null,
        idempotencyKey,
      }).success,
    ).toBe(false);
  });

  it("requires an explicit contact only for future external channels", () => {
    for (const channel of ["EMAIL_FUTURE", "SMS_FUTURE"] as const) {
      const input = {
        eventType: "QUOTE_ISSUED",
        sourceReference: "Q-000000000000000000000001",
        documentType: "QUOTE_SUMMARY",
        channel,
        idempotencyKey,
      } as const;
      expect(
        createCommunicationSchema.safeParse({ ...input, contactId: null }).success,
      ).toBe(false);
      expect(
        createCommunicationSchema.safeParse({ ...input, contactId }).success,
      ).toBe(true);
    }
    expect(
      createCommunicationSchema.safeParse({
        eventType: "QUOTE_ISSUED",
        sourceReference: "Q-000000000000000000000001",
        documentType: "QUOTE_SUMMARY",
        channel: "PORTAL",
        contactId: null,
        idempotencyKey,
      }).success,
    ).toBe(true);
  });

  it("rejects manual authority, unsafe references, invalid UUIDs, and extra fields", () => {
    const valid = {
      eventType: "QUOTE_ISSUED",
      sourceReference: "Q-000000000000000000000001",
      documentType: "QUOTE_SUMMARY",
      channel: "PORTAL",
      contactId: null,
      idempotencyKey,
    } as const;

    expect(
      createCommunicationSchema.safeParse({
        ...valid,
        eventType: "MANUAL_STAFF_MESSAGE",
      }).success,
    ).toBe(false);
    expect(
      createCommunicationSchema.safeParse({
        ...valid,
        sourceReference: "Q-../../secret",
      }).success,
    ).toBe(false);
    expect(
      createCommunicationSchema.safeParse({ ...valid, idempotencyKey: "1" })
        .success,
    ).toBe(false);
    expect(
      createCommunicationSchema.safeParse({ ...valid, customerId: contactId })
        .success,
    ).toBe(false);
  });
});

describe("communication read and document snapshot validation", () => {
  it("bounds staff pagination and rejects unknown filters", () => {
    expect(communicationListSchema.parse({})).toEqual({ limit: 50, offset: 0 });
    expect(communicationListSchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(communicationListSchema.safeParse({ offset: -1 }).success).toBe(false);
    expect(communicationListSchema.safeParse({ customerId: contactId }).success).toBe(
      false,
    );
  });

  it("accepts a bounded strict document snapshot and rejects hidden fields", () => {
    const snapshot = {
      schemaVersion: 1,
      rendererVersion: 1,
      eventType: "QUOTE_ISSUED",
      sourceReference: "Q-000000000000000000000001",
      locale: "en",
      title: "Quote",
      body: "Customer-safe content",
      facts: [{ key: "reference", label: "Reference", value: "Q-1" }],
      lineItems: [
        {
          description: "Service",
          quantity: 1,
          amountMinorUnits: 10_000,
          currency: "EUR",
        },
      ],
      totals: { currency: "EUR", grossAmountMinorUnits: 10_000 },
      notices: [],
    } as const;

    expect(documentContentSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(
      documentContentSnapshotSchema.safeParse({
        ...snapshot,
        providerToken: "must-never-persist",
      }).success,
    ).toBe(false);
    expect(
      documentContentSnapshotSchema.safeParse({
        ...snapshot,
        lineItems: [
          { description: "Service", quantity: 1, amountMinorUnits: 10_000 },
        ],
      }).success,
    ).toBe(false);
  });

  it("keeps preference updates strict and versioned", () => {
    const update = {
      portalEnabled: true,
      emailFutureEnabled: false,
      smsFutureEnabled: false,
      operationalAllowed: true,
      billingAllowed: true,
      marketingConsent: false,
      preferredLocale: "bg",
      expectedVersion: 2,
    } as const;

    expect(updateCommunicationPreferencesSchema.parse(update)).toEqual(update);
    expect(
      updateCommunicationPreferencesSchema.safeParse({
        ...update,
        expectedVersion: -1,
      }).success,
    ).toBe(false);
    expect(
      updateCommunicationPreferencesSchema.safeParse({
        ...update,
        customerId: contactId,
      }).success,
    ).toBe(false);
  });
});
