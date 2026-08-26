import type {
  SchedulingReadinessCode,
  SchedulingReasonCategory,
} from "@/content/scheduling";
import type { BookingStatus } from "@/modules/booking-engine/types";
import type { JobStatus } from "@/modules/job-execution/types";

export type DispatchMetricsView = Readonly<{
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

export type UnscheduledBookingView = Readonly<{
  bookingReference: string;
  customerDisplayName: string;
  propertyLabel: string;
  preferredDate: string | null;
  appointmentWindowLabel: string | null;
  serviceDurationMinutes: number;
  readiness: SchedulingReadinessCode;
  warnings: readonly string[];
}>;

export type DispatchAppointmentView = Readonly<{
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

export type DispatchTeamView = Readonly<{
  id: number;
  code: string;
  name: string;
  workingWindowLabel: string;
  appointments: readonly DispatchAppointmentView[];
  metrics: DispatchMetricsView;
}>;

export type DispatchDayView = Readonly<{
  workDate: string;
  timeZone: "Europe/Sofia";
  previousDate: string;
  nextDate: string;
  provisionalConfiguration: boolean;
  warnings: readonly string[];
  unscheduledBookings: readonly UnscheduledBookingView[];
  teams: readonly DispatchTeamView[];
  metrics: DispatchMetricsView;
}>;

export type ScheduleCandidateView = Readonly<{
  key: string;
  rank: number;
  teamName: string;
  equipmentLabel: string | null;
  serviceStart: Date;
  serviceEnd: Date;
  serviceDurationMinutes: number;
  travelMinutes: number;
  bufferMinutes: number;
  readiness: SchedulingReadinessCode;
  selectable: boolean;
  fallbackTravelUsed: boolean;
  warnings: readonly string[];
}>;

export type BookingSchedulePreviewView = Readonly<{
  bookingReference: string;
  expectedBookingVersion: number;
  customerDisplayName: string;
  propertyLabel: string;
  propertyAddress: string;
  preferredTimingLabel: string | null;
  serviceDurationMinutes: number;
  workDate: string;
  timeZone: "Europe/Sofia";
  currentAppointment: Readonly<{
    snapshotVersion: number;
    serviceStart: Date;
    serviceEnd: Date;
    teamName: string;
    equipmentLabel: string | null;
  }> | null;
  candidates: readonly ScheduleCandidateView[];
  reviewWarnings: readonly string[];
  provisionalConfiguration: boolean;
}>;

export type SchedulingActionState = Readonly<{
  status: "IDLE" | "ERROR" | "SUCCESS";
  message?: string;
  fieldErrors?: Readonly<Record<string, readonly string[] | undefined>>;
  bookingReference?: string;
  workDate?: string;
}>;

export type SchedulingFormAction = (
  previousState: SchedulingActionState,
  formData: FormData,
) => Promise<SchedulingActionState>;

export const initialSchedulingActionState: SchedulingActionState = {
  status: "IDLE",
};

export function schedulingFieldMessages(
  state: SchedulingActionState,
  name: string,
): readonly string[] {
  return state.fieldErrors?.[name] ?? [];
}

export type ScheduleConfirmationInput = Readonly<{
  bookingReference: string;
  expectedBookingVersion: number;
  candidateKey: string;
  expectedOccupancySnapshotVersion: number | null;
  reasonCategory: SchedulingReasonCategory | null;
  reasonText: string | null;
}>;
