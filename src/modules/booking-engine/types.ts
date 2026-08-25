import type { JsonObject } from "@/modules/request-quote/types";

export const bookingStatuses = [
  "PENDING_SCHEDULING",
  "CONFIRMED",
  "CANCELLED",
] as const;
export type BookingStatus = (typeof bookingStatuses)[number];

export const schedulingStatuses = [
  "UNSCHEDULED",
  "REVIEW_REQUIRED",
  "SCHEDULED",
] as const;
export type SchedulingStatus = (typeof schedulingStatuses)[number];

export const acceptanceActorTypes = ["CUSTOMER", "STAFF_ON_BEHALF"] as const;
export type AcceptanceActorType = (typeof acceptanceActorTypes)[number];

export const staffAcceptanceSources = [
  "PHONE",
  "EMAIL",
  "IN_PERSON",
  "OTHER_RECORDED",
] as const;
export type StaffAcceptanceSource = (typeof staffAcceptanceSources)[number];

export const cancellationReasonCategories = [
  "CUSTOMER_REQUEST",
  "OPERATIONAL",
  "DUPLICATE",
  "OTHER",
] as const;
export type CancellationReasonCategory =
  (typeof cancellationReasonCategories)[number];

export type BookingItemSnapshot = Readonly<{
  descriptionBg: string;
  descriptionEn: string;
  quantity: number;
  measurementSnapshot: JsonObject;
  netAmountMinorUnits: number;
  vatRateBasisPoints: number;
  vatAmountMinorUnits: number;
  grossTotalMinorUnits: number;
  sortOrder: number;
}>;

export type CustomerBookingSummary = Readonly<{
  bookingReference: string;
  quoteReference: string;
  status: BookingStatus;
  schedulingStatus: SchedulingStatus;
  propertyLabel: string;
  grossTotalMinorUnits: number;
  currency: "EUR";
  preferredDate: string | null;
  appointmentWindowCode: string | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  createdAt: Date;
}>;

export type CustomerBookingDetail = CustomerBookingSummary &
  Readonly<{
    customerDisplayName: string;
    propertyAddress: string;
    netAmountMinorUnits: number;
    vatRateBasisPoints: number;
    vatAmountMinorUnits: number;
    estimatedDurationMinutes: number | null;
    termsSnapshot: JsonObject;
    customerNotes: string | null;
    items: readonly BookingItemSnapshot[];
  }>;

export type StaffBookingSummary = CustomerBookingSummary &
  Readonly<{
    customerDisplayName: string;
    assignedTeamName: string | null;
    manualReviewRequired: boolean;
    version: number;
  }>;

export type BookingAuditItem = Readonly<{
  eventType: string;
  source: string;
  safeMetadata: JsonObject;
  createdAt: Date;
}>;

export type StaffBookingDetail = StaffBookingSummary &
  Readonly<{
    propertyAddress: string;
    acceptanceActorType: AcceptanceActorType;
    acceptanceSource: string;
    acceptanceNote: string | null;
    acceptedAt: Date;
    netAmountMinorUnits: number;
    vatRateBasisPoints: number;
    vatAmountMinorUnits: number;
    estimatedDurationMinutes: number | null;
    commercialSnapshot: JsonObject;
    termsSnapshot: JsonObject;
    durationSnapshot: JsonObject;
    schedulingSnapshot: JsonObject;
    customerNotes: string | null;
    internalNotes: string | null;
    items: readonly BookingItemSnapshot[];
    auditTimeline: readonly BookingAuditItem[];
  }>;

export type StaffBookingListInput = Readonly<{
  search?: string;
  status?: BookingStatus;
  schedulingStatus?: SchedulingStatus;
  scheduledFrom?: Date;
  scheduledTo?: Date;
  limit: number;
  offset: number;
}>;

export type StaffBookingPage = Readonly<{
  items: readonly StaffBookingSummary[];
  total: number;
  limit: number;
  offset: number;
}>;

export type QuoteAcceptancePreview = Readonly<{
  state: "ELIGIBLE" | "EXISTING" | "REVIEW_REQUIRED";
  bookingReference: string | null;
}>;

export type AcceptanceRepositoryInput = Readonly<{
  quoteReference: string;
  expectedQuoteVersion: number;
  bookingReference: string;
  actorType: AcceptanceActorType;
  acceptanceSource: "CUSTOMER_PORTAL" | StaffAcceptanceSource;
  acceptanceNote: string | null;
}>;

export type AcceptanceRepositoryResult =
  | Readonly<{
      status: "CREATED" | "EXISTING";
      bookingReference: string;
    }>
  | Readonly<{
      status: "REVIEW_REQUIRED";
      reasonCodes: readonly string[];
    }>
  | Readonly<{ status: "NOT_FOUND_OR_FORBIDDEN" | "REFERENCE_CONFLICT" }>;

export type CancellationRepositoryResult =
  | Readonly<{ status: "CANCELLED" | "NO_CHANGE"; bookingReference: string }>
  | Readonly<{
      status:
        | "NOT_FOUND_OR_FORBIDDEN"
        | "CONFLICT"
        | "INVALID_TRANSITION";
    }>;

export type BookingOccupancyBlock = Readonly<{
  id: string;
  teamCode: "TEAM_A" | "TEAM_B";
  workDate: string;
  serviceStartMinute: number;
  serviceEndMinute: number;
  operationalStartMinute: number;
  operationalEndMinute: number;
  status: "PENDING" | "CONFIRMED";
  locationSnapshot: JsonObject;
  serviceDurationMinutes: number;
  travelSnapshot: JsonObject;
  schedulingPolicyCode: string;
  schedulingPolicyVersion: number;
  workingHourPolicyCode: string;
  workingHourPolicyVersion: number;
  travelTimeProfileCode: string;
  travelTimeProfileVersion: number;
  snapshotVersion: number;
  configurationReferencesMatch: boolean;
}>;
