import { z } from "zod";
import { schedulingReasonCategories } from "./types";

const maximumVersion = 2_147_483_647;
const forbiddenNoteControlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

export const schedulingDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [yearText, monthText, dayText] = value.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Date must be a real calendar date in YYYY-MM-DD format.");

export const schedulingBookingReferenceSchema = z
  .string()
  .regex(/^BKG-[A-F0-9]{24}$/);

export const scheduleCandidateKeySchema = z
  .string()
  .trim()
  .min(16)
  .max(256)
  .regex(/^[A-Za-z0-9._~:-]+$/);

export const schedulingExpectedVersionSchema = z
  .number()
  .int()
  .positive()
  .max(maximumVersion);

export const schedulingReviewAcknowledgementSchema = z.literal(true);

const normalizedReasonNoteSchema = z
  .string()
  .transform((value) => value.replace(/\r\n?/g, "\n").trim())
  .pipe(
    z
      .string()
      .max(500)
      .refine((value) => !forbiddenNoteControlCharacters.test(value), {
        message: "Reason note contains an unsupported control character.",
      }),
  )
  .transform((value) => value || null);

export const schedulingReasonNoteSchema = z.union([
  normalizedReasonNoteSchema,
  z.null(),
]);

export const dispatchDayInputSchema = z
  .object({
    workDate: schedulingDateSchema,
    includeRevenue: z.boolean(),
  })
  .strict();

export const bookingPreviewInputSchema = z
  .object({
    bookingReference: schedulingBookingReferenceSchema,
    workDate: schedulingDateSchema,
  })
  .strict();

/**
 * Transport schema for the exact confirmation form. The acknowledgement and
 * work date are validated here but are not trusted scheduling authority; the
 * service recomputes and selects the server-generated candidate by key.
 */
export const scheduleConfirmationInputSchema = z
  .object({
    bookingReference: schedulingBookingReferenceSchema,
    expectedBookingVersion: schedulingExpectedVersionSchema,
    workDate: schedulingDateSchema,
    candidateKey: scheduleCandidateKeySchema,
    expectedOccupancySnapshotVersion:
      schedulingExpectedVersionSchema.nullable(),
    reasonCategory: z.enum(schedulingReasonCategories).nullable(),
    reasonText: schedulingReasonNoteSchema,
    acknowledged: schedulingReviewAcknowledgementSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const isReschedule = value.expectedOccupancySnapshotVersion !== null;

    if (!isReschedule && value.reasonCategory !== null) {
      context.addIssue({
        code: "custom",
        path: ["reasonCategory"],
        message: "An initial schedule cannot carry a reschedule reason.",
      });
    }
    if (!isReschedule && value.reasonText !== null) {
      context.addIssue({
        code: "custom",
        path: ["reasonText"],
        message: "An initial schedule cannot carry a reschedule note.",
      });
    }
    if (isReschedule && value.reasonCategory === null) {
      context.addIssue({
        code: "custom",
        path: ["reasonCategory"],
        message: "A reschedule reason is required.",
      });
    }
    if (value.reasonCategory === "OTHER" && value.reasonText === null) {
      context.addIssue({
        code: "custom",
        path: ["reasonText"],
        message: "A note is required for OTHER.",
      });
    }
  });

export type DispatchDayInputValue = z.infer<typeof dispatchDayInputSchema>;
export type BookingPreviewInputValue = z.infer<
  typeof bookingPreviewInputSchema
>;
export type ScheduleConfirmationInputValue = z.infer<
  typeof scheduleConfirmationInputSchema
>;
