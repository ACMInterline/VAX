import { z } from "zod";
import {
  communicationChannels,
  communicationDocumentTypes,
  communicationEventTypes,
} from "./types";

const sourceReferenceSchema = z
  .string()
  .trim()
  .regex(/^(Q|BKG|JOB|INV|PAY)-[A-F0-9]{24}$/);

export const createCommunicationSchema = z
  .object({
    eventType: z.enum(communicationEventTypes).exclude(["MANUAL_STAFF_MESSAGE"]),
    sourceReference: sourceReferenceSchema,
    documentType: z.enum(communicationDocumentTypes),
    channel: z.enum(communicationChannels).exclude(["MANUAL"]),
    contactId: z.uuid().nullable(),
    idempotencyKey: z.uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    const validDocument =
      (value.eventType === "QUOTE_ISSUED" &&
        value.documentType === "QUOTE_SUMMARY") ||
      ([
        "BOOKING_CONFIRMED",
        "BOOKING_RESCHEDULED",
        "BOOKING_CANCELLED",
      ] as const).includes(
        value.eventType as
          | "BOOKING_CONFIRMED"
          | "BOOKING_RESCHEDULED"
          | "BOOKING_CANCELLED",
      ) && value.documentType === "BOOKING_CONFIRMATION" ||
      (value.eventType === "JOB_COMPLETED" &&
        (value.documentType === "JOB_COMPLETION_SUMMARY" ||
          value.documentType === "CLEANING_PASSPORT")) ||
      (value.eventType === "INVOICE_ISSUED" &&
        value.documentType === "INVOICE") ||
      ((value.eventType === "PAYMENT_CONFIRMED" ||
        value.eventType === "PAYMENT_REVERSED") &&
        value.documentType === "PAYMENT_ACKNOWLEDGEMENT");

    if (!validDocument) {
      context.addIssue({
        code: "custom",
        path: ["documentType"],
        message: "Document type does not match the business event.",
      });
    }

    const expectedPrefix =
      value.eventType === "QUOTE_ISSUED"
        ? "Q-"
        : value.eventType.startsWith("BOOKING_")
          ? "BKG-"
          : value.eventType === "JOB_COMPLETED"
            ? "JOB-"
            : value.eventType === "INVOICE_ISSUED"
              ? "INV-"
              : "PAY-";
    if (!value.sourceReference.startsWith(expectedPrefix)) {
      context.addIssue({
        code: "custom",
        path: ["sourceReference"],
        message: "Source reference does not match the business event.",
      });
    }

    if (
      (value.channel === "EMAIL_FUTURE" || value.channel === "SMS_FUTURE") &&
      value.contactId === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["contactId"],
        message: "A selected contact is required for a future channel.",
      });
    }
  });

export const communicationReferenceSchema = z
  .string()
  .regex(/^COM-[A-F0-9]{24}$/);

export const documentReferenceSchema = z
  .string()
  .regex(/^DOC-[A-F0-9]{24}$/);

export const communicationListSchema = z
  .object({
    status: z
      .enum(["DRAFT", "READY", "QUEUED_FUTURE", "DELIVERED_LOCAL", "FAILED", "CANCELLED"])
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const updateCommunicationPreferencesSchema = z
  .object({
    portalEnabled: z.boolean(),
    emailFutureEnabled: z.boolean(),
    smsFutureEnabled: z.boolean(),
    operationalAllowed: z.boolean(),
    billingAllowed: z.boolean(),
    marketingConsent: z.boolean(),
    preferredLocale: z.enum(["bg", "en"]),
    expectedVersion: z.number().int().min(0),
  })
  .strict();

const documentFactSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
    label: z.string().min(1).max(160),
    value: z.string().min(1).max(4_000),
  })
  .strict();

const documentLineItemSchema = z
  .object({
    description: z.string().min(1).max(4_000),
    quantity: z.number().int().positive(),
    amountMinorUnits: z.number().int().nonnegative().optional(),
    currency: z.literal("EUR").optional(),
  })
  .strict()
  .refine(
    (value) =>
      (value.amountMinorUnits === undefined) === (value.currency === undefined),
  );

const documentTotalsSchema = z
  .object({
    currency: z.literal("EUR"),
    netAmountMinorUnits: z.number().int().nonnegative().optional(),
    vatAmountMinorUnits: z.number().int().nonnegative().optional(),
    grossAmountMinorUnits: z.number().int().nonnegative(),
    paidAmountMinorUnits: z.number().int().nonnegative().optional(),
    outstandingAmountMinorUnits: z.number().int().nonnegative().optional(),
  })
  .strict();

export const documentContentSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    rendererVersion: z.literal(1),
    eventType: z.enum(communicationEventTypes),
    sourceReference: sourceReferenceSchema,
    locale: z.enum(["bg", "en"]),
    title: z.string().min(1).max(1_000),
    body: z.string().min(1).max(16_000),
    facts: z.array(documentFactSchema).max(64),
    lineItems: z.array(documentLineItemSchema).max(500),
    totals: documentTotalsSchema.nullable(),
    notices: z.array(z.string().min(1).max(4_000)).max(32),
  })
  .strict();
