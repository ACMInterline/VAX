import { describe, expect, it } from "vitest";
import {
  allocatePaymentSchema,
  createInvoiceDraftSchema,
  issueInvoiceSchema,
  recordPaymentSchemaAt,
} from "./validation";

describe("finance input validation", () => {
  it("allows only safe draft selectors and notes", () => {
    expect(
      createInvoiceDraftSchema.safeParse({
        bookingReference: "BKG-0123456789ABCDEF01234567",
        customerVisibleNote: null,
        internalNote: null,
        manualAdjustmentRequested: false,
      }).success,
    ).toBe(true);
    expect(
      createInvoiceDraftSchema.safeParse({
        bookingReference: "BKG-0123456789ABCDEF01234567",
        customerVisibleNote: null,
        internalNote: null,
        manualAdjustmentRequested: false,
        grossAmountMinorUnits: 1,
      }).success,
    ).toBe(false);
  });

  it("rejects client-controlled issue and payment state", () => {
    expect(
      issueInvoiceSchema.safeParse({
        invoiceReference: "INV-0123456789ABCDEF01234567",
        expectedVersion: 1,
        issueConfirmed: true,
        invoiceNumber: "DEV-INV-1",
      }).success,
    ).toBe(false);
    expect(
      recordPaymentSchemaAt(new Date()).safeParse({
        invoiceReference: "INV-0123456789ABCDEF01234567",
        amountMinorUnits: 5_000,
        method: "BANK_TRANSFER",
        receivedAt: "2026-08-26T10:00:00.000Z",
        externalReference: null,
        internalNote: null,
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
        status: "CONFIRMED",
      }).success,
    ).toBe(false);
  });

  it("rejects future payment receipt timestamps before persistence", () => {
    const now = new Date("2026-08-26T12:00:00.000Z");
    const schema = recordPaymentSchemaAt(now);
    const payment = {
      invoiceReference: "INV-0123456789ABCDEF01234567",
      amountMinorUnits: 5_000,
      method: "BANK_TRANSFER",
      externalReference: null,
      internalNote: null,
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
    } as const;

    expect(
      schema.safeParse({
        ...payment,
        receivedAt: "2026-08-26T11:59:59.999Z",
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        ...payment,
        receivedAt: "2026-08-26T12:00:00.000Z",
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        ...payment,
        receivedAt: "2026-08-26T15:00:00.000+03:00",
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        ...payment,
        receivedAt: "2026-08-26T12:00:00.001Z",
      }).success,
    ).toBe(false);
  });

  it("requires positive integer allocation amounts", () => {
    const base = {
      paymentReference: "PAY-0123456789ABCDEF01234567",
      invoiceReference: "INV-0123456789ABCDEF01234567",
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
    };
    expect(allocatePaymentSchema.safeParse({ ...base, amountMinorUnits: 1 }).success).toBe(
      true,
    );
    expect(allocatePaymentSchema.safeParse({ ...base, amountMinorUnits: 1.5 }).success).toBe(
      false,
    );
    expect(allocatePaymentSchema.safeParse({ ...base, amountMinorUnits: 0 }).success).toBe(
      false,
    );
  });
});
