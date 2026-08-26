import { ZodError, type z } from "zod";
import {
  requireStaffSchedulingManage,
  requireStaffSchedulingRead,
  type SchedulingActor,
} from "./policy";
import type {
  DispatchRepository,
  ScheduleMutationResult,
} from "./types";
import {
  bookingPreviewInputSchema,
  dispatchDayInputSchema,
  scheduleConfirmationInputSchema,
} from "./validation";

export type SchedulingDispatchServiceFailureCode =
  | "INVALID_REQUEST"
  | "RECORD_NOT_FOUND_OR_FORBIDDEN"
  | "STALE"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "REQUIRES_REVIEW"
  | "TEMPORARILY_UNAVAILABLE";

export class SchedulingDispatchServiceError extends Error {
  readonly code: SchedulingDispatchServiceFailureCode;

  constructor(code: SchedulingDispatchServiceFailureCode) {
    super(code);
    this.name = "SchedulingDispatchServiceError";
    this.code = code;
  }
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new SchedulingDispatchServiceError("INVALID_REQUEST");
    }
    throw error;
  }
}

async function repositoryOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new SchedulingDispatchServiceError("TEMPORARILY_UNAVAILABLE");
  }
}

function safeMutationResult(
  result: ScheduleMutationResult,
): Extract<
  ScheduleMutationResult,
  { status: "SCHEDULED" | "RESCHEDULED" | "NO_CHANGE" }
> {
  switch (result.status) {
    case "SCHEDULED":
    case "RESCHEDULED":
    case "NO_CHANGE":
      return result;
    case "NOT_FOUND_OR_FORBIDDEN":
      throw new SchedulingDispatchServiceError(
        "RECORD_NOT_FOUND_OR_FORBIDDEN",
      );
    case "STALE":
      throw new SchedulingDispatchServiceError("STALE");
    case "CONFLICT":
      throw new SchedulingDispatchServiceError("CONFLICT");
    case "INVALID_TRANSITION":
      throw new SchedulingDispatchServiceError("INVALID_TRANSITION");
    case "REVIEW_REQUIRED":
      throw new SchedulingDispatchServiceError("REQUIRES_REVIEW");
  }
}

export function createSchedulingDispatchService(
  repository: DispatchRepository,
) {
  return {
    async getDispatchDay(actor: SchedulingActor | null, input: unknown) {
      requireStaffSchedulingRead(actor);
      const parsed = parse(dispatchDayInputSchema, input);
      const includeRevenue =
        parsed.includeRevenue &&
        actor!.permissions.has("COMMERCIAL_RULES_READ");
      return repositoryOperation(() =>
        repository.getDispatchDay(actor!.profileId, {
          ...parsed,
          includeRevenue,
        }),
      );
    },

    async previewBooking(actor: SchedulingActor | null, input: unknown) {
      requireStaffSchedulingRead(actor);
      const parsed = parse(bookingPreviewInputSchema, input);
      const preview = await repositoryOperation(() =>
        repository.previewBooking(actor!.profileId, parsed),
      );
      if (!preview) {
        throw new SchedulingDispatchServiceError(
          "RECORD_NOT_FOUND_OR_FORBIDDEN",
        );
      }
      return preview;
    },

    async confirmSchedule(actor: SchedulingActor | null, input: unknown) {
      requireStaffSchedulingManage(actor);
      const parsed = parse(scheduleConfirmationInputSchema, input);
      const result = await repositoryOperation(() =>
        repository.confirmSchedule(actor!.profileId, {
          bookingReference: parsed.bookingReference,
          expectedBookingVersion: parsed.expectedBookingVersion,
          workDate: parsed.workDate,
          candidateKey: parsed.candidateKey,
          expectedOccupancySnapshotVersion:
            parsed.expectedOccupancySnapshotVersion,
          reasonCategory: parsed.reasonCategory,
          reasonText: parsed.reasonText,
        }),
      );
      return safeMutationResult(result);
    },
  };
}

export type SchedulingDispatchService = ReturnType<
  typeof createSchedulingDispatchService
>;
