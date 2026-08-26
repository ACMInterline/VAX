import { z } from "zod";
import {
  paymentMethods,
  type InvoiceStoredStatus,
} from "./types";

export const invoiceReferenceSchema = z
  .string()
  .regex(/^INV-[A-F0-9]{24}$/);
export const paymentReferenceSchema = z
  .string()
  .regex(/^PAY-[A-F0-9]{24}$/);

const positiveVersion = z.number().int().positive().max(2_147_483_647);
const positiveMinorUnits = z.number().int().positive().max(2_147_483_647);
const uuid = z.string().uuid();
const boundedOptionalText = z.string().trim().min(1).max(1_000).nullable();

export const createInvoiceDraftSchema = z
  .object({
    bookingReference: z.string().regex(/^BKG-[A-F0-9]{24}$/),
    customerVisibleNote: boundedOptionalText,
    internalNote: boundedOptionalText,
    manualAdjustmentRequested: z.literal(false),
  })
  .strict();

export const issueInvoiceSchema = z
  .object({
    invoiceReference: invoiceReferenceSchema,
    expectedVersion: positiveVersion,
    issueConfirmed: z.literal(true),
  })
  .strict();

export const cancelDraftInvoiceSchema = z
  .object({
    invoiceReference: invoiceReferenceSchema,
    expectedVersion: positiveVersion,
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export function recordPaymentSchemaAt(now: Date) {
  const latestReceivedAt = now.getTime();
  return z
    .object({
      invoiceReference: invoiceReferenceSchema,
      amountMinorUnits: positiveMinorUnits,
      method: z.enum(paymentMethods),
      receivedAt: z.coerce
        .date()
        .refine((receivedAt) => receivedAt.getTime() <= latestReceivedAt),
      externalReference: z.string().trim().min(1).max(160).nullable(),
      internalNote: boundedOptionalText,
      idempotencyKey: uuid,
    })
    .strict();
}

export const confirmPaymentSchema = z
  .object({
    paymentReference: paymentReferenceSchema,
    expectedVersion: positiveVersion,
    evidenceConfirmed: z.literal(true),
  })
  .strict();

export const allocatePaymentSchema = z
  .object({
    paymentReference: paymentReferenceSchema,
    invoiceReference: invoiceReferenceSchema,
    amountMinorUnits: positiveMinorUnits,
    idempotencyKey: uuid,
  })
  .strict();

export const reversePaymentSchema = z
  .object({
    paymentReference: paymentReferenceSchema,
    expectedVersion: positiveVersion,
    reasonCategory: z.enum([
      "DUPLICATE",
      "BANK_RETURN",
      "ENTRY_ERROR",
      "OTHER",
    ]),
    reasonNote: z.string().trim().min(1).max(500),
    idempotencyKey: uuid,
  })
  .strict();

export const invoiceListSchema = z
  .object({
    search: z.string().trim().max(160).optional(),
    status: z
      .enum([
        "DRAFT",
        "READY_TO_ISSUE",
        "ISSUED",
        "PARTIALLY_PAID",
        "PAID",
        "OVERDUE",
        "CANCELLED",
      ] satisfies readonly (InvoiceStoredStatus | "OVERDUE")[])
      .optional(),
    limit: z.number().int().min(1).max(100),
    offset: z.number().int().min(0).max(100_000),
  })
  .strict();
