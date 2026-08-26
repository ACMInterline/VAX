import type { BookingStatus } from "@/modules/booking-engine/types";
import type { JobStatus } from "@/modules/job-execution/types";

export const SOFIA_TIME_ZONE = "Europe/Sofia" as const;
export type SofiaTimeZone = typeof SOFIA_TIME_ZONE;

export const schedulingReasonCategories = [
  "CUSTOMER_REQUEST",
  "OPERATIONAL",
  "TEAM_UNAVAILABLE",
  "EQUIPMENT_UNAVAILABLE",
  "TRAVEL_CONFLICT",
  "OTHER",
] as const;
export type SchedulingReasonCategory =
  (typeof schedulingReasonCategories)[number];

export const schedulingReadinessCodes = [
  "READY",
  "MISSING_TEAM",
  "MISSING_EQUIPMENT",
  "SCHEDULE_CONFLICT",
  "TRAVEL_REVIEW",
  "CAPABILITY_REVIEW",
  "CUSTOMER_REVIEW",
] as const;
export type SchedulingReadinessCode =
  (typeof schedulingReadinessCodes)[number];

export type DispatchMetrics = Readonly<{
  scheduledJobs: number;
  serviceMinutes: number;
  travelMinutes: number;
  bufferMinutes: number;
  idleMinutes: number;
  utilizationPercent: number;
  occupiedTeamHoursHundredths: number;
  laborHoursHundredths: number;
  revenuePerOccupiedTeamHourMinorUnits: number | null;
  currency: "EUR";
}>;

export type UnscheduledBooking = Readonly<{
  bookingReference: string;
  customerDisplayName: string;
  propertyLabel: string;
  preferredDate: string | null;
  appointmentWindowLabel: string | null;
  serviceDurationMinutes: number;
  readiness: SchedulingReadinessCode;
  warnings: readonly string[];
}>;

export type DispatchAppointment = Readonly<{
  bookingReference: string;
  bookingStatus: BookingStatus;
  jobReference: string | null;
  jobStatus: JobStatus | null;
  customerDisplayName: string;
  propertyLabel: string;
  propertyAddress: string;
  propertyArea: string | null;
  serviceStart: Date;
  serviceEnd: Date;
  serviceDurationMinutes: number;
  travelMinutes: number;
  bufferMinutes: number;
  equipmentLabel: string | null;
  readiness: SchedulingReadinessCode;
  fallbackTravelUsed: boolean;
  warnings: readonly string[];
}>;

export type DispatchTeam = Readonly<{
  id: number;
  code: string;
  name: string;
  workingWindowLabel: string;
  appointments: readonly DispatchAppointment[];
  metrics: DispatchMetrics;
}>;

export type DispatchDay = Readonly<{
  workDate: string;
  timeZone: SofiaTimeZone;
  previousDate: string;
  nextDate: string;
  provisionalConfiguration: boolean;
  warnings: readonly string[];
  unscheduledBookings: readonly UnscheduledBooking[];
  teams: readonly DispatchTeam[];
  metrics: DispatchMetrics;
}>;

export type DispatchDayInput = Readonly<{
  workDate: string;
  includeRevenue: boolean;
}>;

export type ScheduleCandidateBase = Readonly<{
  key: string;
  teamId: number;
  teamCode: string;
  teamName: string;
  equipmentResourceId: number | null;
  equipmentLabel: string | null;
  workDate: string;
  serviceStart: Date;
  serviceEnd: Date;
  operationalStart: Date;
  operationalEnd: Date;
  serviceDurationMinutes: number;
  travelBeforeMinutes: number;
  travelAfterMinutes: number;
  travelMinutes: number;
  bufferMinutes: number;
  parkingBufferMinutes: number;
  readiness: SchedulingReadinessCode;
  selectable: boolean;
  fallbackTravelUsed: boolean;
  manualReviewRequired: boolean;
  warnings: readonly string[];
  preferredWindowMatch: boolean;
  additionalTravelMinutes: number;
  nearbyWorkContinuity: boolean;
  occupiedWorkloadMinutes: number;
  previousOccupancyId?: string | null;
  nextOccupancyId?: string | null;
}>;

export type ScheduleCandidate = ScheduleCandidateBase &
  Readonly<{
    rank: number;
  }>;

export type CurrentBookingAppointment = Readonly<{
  occupancyId: string;
  snapshotVersion: number;
  serviceStart: Date;
  serviceEnd: Date;
  teamName: string;
  equipmentLabel: string | null;
}>;

export type BookingSchedulePreview = Readonly<{
  bookingReference: string;
  expectedBookingVersion: number;
  customerDisplayName: string;
  propertyLabel: string;
  propertyAddress: string;
  preferredTimingLabel: string | null;
  serviceDurationMinutes: number;
  workDate: string;
  timeZone: SofiaTimeZone;
  currentAppointment: CurrentBookingAppointment | null;
  candidates: readonly ScheduleCandidate[];
  reviewWarnings: readonly string[];
  provisionalConfiguration: boolean;
}>;

export type BookingPreviewInput = Readonly<{
  bookingReference: string;
  workDate: string;
}>;

export type ScheduleConfirmationCommand = Readonly<{
  bookingReference: string;
  expectedBookingVersion: number;
  workDate: string;
  candidateKey: string;
  expectedOccupancySnapshotVersion: number | null;
  reasonCategory: SchedulingReasonCategory | null;
  reasonText: string | null;
}>;

export type ScheduleMutationResult =
  | Readonly<{
      status: "SCHEDULED" | "RESCHEDULED" | "NO_CHANGE";
      bookingReference: string;
      occupancyId: string;
      occupancySnapshotVersion: number;
      bookingVersion: number;
      serviceStart: Date;
      serviceEnd: Date;
    }>
  | Readonly<{
      status: "REVIEW_REQUIRED";
      reasonCodes: readonly string[];
    }>
  | Readonly<{
      status:
        | "NOT_FOUND_OR_FORBIDDEN"
        | "STALE"
        | "CONFLICT"
        | "INVALID_TRANSITION";
    }>;

export interface DispatchRepository {
  getDispatchDay(
    profileId: string,
    input: DispatchDayInput,
  ): Promise<DispatchDay>;
  previewBooking(
    profileId: string,
    input: BookingPreviewInput,
  ): Promise<BookingSchedulePreview | null>;
  confirmSchedule(
    profileId: string,
    command: ScheduleConfirmationCommand,
  ): Promise<ScheduleMutationResult>;
}

/** Compatibility aliases for concise internal call sites. */
export type ScheduleCommand = ScheduleConfirmationCommand;
export type ScheduleResult = ScheduleMutationResult;
