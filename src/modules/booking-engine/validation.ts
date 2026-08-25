import { z } from "zod";
import {
  bookingStatuses,
  cancellationReasonCategories,
  schedulingStatuses,
  staffAcceptanceSources,
} from "./types";

export const bookingReferenceSchema = z.string().regex(/^BKG-[A-F0-9]{24}$/);
export const quoteReferenceSchema = z.string().regex(/^Q-[A-F0-9]{24}$/);

const positiveVersion = z.number().int().positive().max(2_147_483_647);

export const customerQuoteAcceptanceSchema = z
  .object({
    quoteReference: quoteReferenceSchema,
    expectedQuoteVersion: positiveVersion,
    acknowledged: z.literal(true),
  })
  .strict();

export const staffQuoteAcceptanceSchema = z
  .object({
    quoteReference: quoteReferenceSchema,
    expectedQuoteVersion: positiveVersion,
    customerInstructionConfirmed: z.literal(true),
    acceptanceSource: z.enum(staffAcceptanceSources),
    acceptanceNote: z.string().trim().min(1).max(1_000),
  })
  .strict();

export const cancelBookingSchema = z
  .object({
    bookingReference: bookingReferenceSchema,
    expectedVersion: positiveVersion,
    reasonCategory: z.enum(cancellationReasonCategories),
    reasonText: z.string().trim().max(1_000).nullable(),
  })
  .strict()
  .refine(
    (value) =>
      value.reasonCategory !== "OTHER" || Boolean(value.reasonText?.trim()),
    { path: ["reasonText"], message: "A reason is required for OTHER." },
  );

export const staffBookingListSchema = z
  .object({
    search: z.string().trim().max(160).optional(),
    status: z.enum(bookingStatuses).optional(),
    schedulingStatus: z.enum(schedulingStatuses).optional(),
    scheduledFrom: z.date().optional(),
    scheduledTo: z.date().optional(),
    limit: z.number().int().min(1).max(100),
    offset: z.number().int().min(0).max(100_000),
  })
  .strict()
  .refine(
    (value) =>
      !value.scheduledFrom ||
      !value.scheduledTo ||
      value.scheduledFrom < value.scheduledTo,
    { path: ["scheduledTo"], message: "Invalid scheduling date range." },
  );
