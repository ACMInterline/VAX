import "server-only";

import {
  developmentAppointmentWindows,
  developmentSchedulingPolicy,
  developmentServiceAreas,
  developmentTravelTimeProfile,
  developmentWorkingHourPolicy,
} from "@/modules/availability-engine/development-config";
import {
  attelierAppointmentWindows,
  attelierServiceAreas,
  attelierWorkingHourPolicy,
} from "@/modules/availability-engine/attelier-config";
import type {
  AppointmentWindowDefinition,
  SchedulingPolicyDefinition,
  ServiceAreaDefinition,
  TravelTimeProfileDefinition,
  WorkingHourPolicyDefinition,
} from "@/modules/availability-engine/types";
import {
  attelierDurationModel,
  attelierPriceBooks,
} from "@/modules/commercial-engine/attelier-config";
import {
  developmentDurationModel,
  developmentPriceBooks,
} from "@/modules/commercial-engine/development-config";
import { calculateDuration } from "@/modules/commercial-engine/duration";
import { calculatePrice } from "@/modules/commercial-engine/pricing";
import type {
  CommercialConditionBandCode,
  CommercialLineInput,
  CustomerSegment,
  DurationCalculationInput,
  DurationModelDefinition,
  PriceCalculationInput,
  PriceBookDefinition,
  TimingCategoryCode,
  TravelZoneCode,
} from "@/modules/commercial-engine/types";
import { getVaxEnvironment } from "@/operations/environment";
import type {
  JsonObject,
  StoredAvailabilitySnapshot,
  StoredDurationSnapshot,
  StoredPriceSnapshot,
} from "./types";

export const estimateGovernanceReviewReasonCodes = [
  "CATALOGUE_ASSESSMENT_REQUIRED",
  "CATALOGUE_SPECIALIST_ONLY",
  "MISSING_MATERIAL",
  "MISSING_MEASUREMENT",
] as const;

export type EstimateGovernanceReviewReasonCode =
  (typeof estimateGovernanceReviewReasonCodes)[number];

export const estimateReviewReasonCodes = [
  ...estimateGovernanceReviewReasonCodes,
  "PRICE_BOOK_NOT_ACTIVE",
  "PRICE_BOOK_PROVISIONAL",
  "PRICE_BOOK_NOT_PUBLICATION_APPROVED",
  "VAT_STATUS_UNRESOLVED",
  "PRICE_MANUAL_ASSESSMENT",
  "PRICE_DECLINE_OR_REFER",
  "DURATION_MODEL_NOT_ACTIVE",
  "DURATION_MODEL_PROVISIONAL",
  "DURATION_MANUAL_ASSESSMENT",
  "DURATION_DECLINE_OR_REFER",
  "SCHEDULING_POLICY_NOT_ACTIVE",
  "UNKNOWN_SERVICE_AREA",
  "SERVICE_AREA_MANUAL_CONFIRMATION",
  "SERVICE_AREA_NOT_ELIGIBLE",
] as const;

export type EstimateReviewReasonCode =
  (typeof estimateReviewReasonCodes)[number];

export type EstimateReviewDisposition =
  | "READY_FOR_STAFF_REVIEW"
  | "MANUAL_REVIEW_REQUIRED"
  | "DECLINE_OR_REFER";

export type EstimateEngineInput = Readonly<{
  customerSegment: CustomerSegment;
  items: readonly CommercialLineInput[];
  conditionBandCode: CommercialConditionBandCode;
  travelZoneCode: TravelZoneCode;
  timingCategoryCode: TimingCategoryCode;
  governanceReviewReasonCodes: readonly EstimateGovernanceReviewReasonCode[];
}>;

export type EstimateConfiguration = Readonly<{
  priceBooks: readonly PriceBookDefinition[];
  durationModel: DurationModelDefinition;
  serviceAreas: readonly ServiceAreaDefinition[];
  schedulingPolicy: SchedulingPolicyDefinition;
  travelTimeProfile: TravelTimeProfileDefinition;
  workingHourPolicy: WorkingHourPolicyDefinition;
  appointmentWindows: readonly AppointmentWindowDefinition[];
}>;

export const developmentEstimateConfiguration: EstimateConfiguration = {
  priceBooks: developmentPriceBooks,
  durationModel: developmentDurationModel,
  serviceAreas: developmentServiceAreas,
  schedulingPolicy: developmentSchedulingPolicy,
  travelTimeProfile: developmentTravelTimeProfile,
  workingHourPolicy: developmentWorkingHourPolicy,
  appointmentWindows: developmentAppointmentWindows,
};

export const attelierStagingEstimateConfiguration: EstimateConfiguration = {
  priceBooks: attelierPriceBooks,
  durationModel: attelierDurationModel,
  serviceAreas: attelierServiceAreas,
  // Scheduling remains fail-closed until real staff, equipment and route
  // capacity are verified. Approved hours/windows do not invent capacity.
  schedulingPolicy: developmentSchedulingPolicy,
  travelTimeProfile: developmentTravelTimeProfile,
  workingHourPolicy: attelierWorkingHourPolicy,
  appointmentWindows: attelierAppointmentWindows,
};

export function resolveEstimateConfiguration(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): EstimateConfiguration {
  switch (getVaxEnvironment(environment)) {
    case "development":
      return developmentEstimateConfiguration;
    case "staging":
      return attelierStagingEstimateConfiguration;
    case "production":
      throw new Error("Production commercial authority is unavailable.");
  }
}

/**
 * Complete, internal estimate result. Price and duration are staff-only and
 * must never be returned from the anonymous submission boundary.
 */
export type StaffEstimateCalculation = Readonly<{
  audience: "STAFF_ONLY";
  disposition: EstimateReviewDisposition;
  manualReviewRequired: boolean;
  declineOrReferRequired: boolean;
  reviewReasonCodes: readonly EstimateReviewReasonCode[];
  priceSnapshot: StoredPriceSnapshot;
  durationSnapshot: StoredDurationSnapshot;
  availabilitySnapshot: StoredAvailabilitySnapshot;
  subtotalMinorUnits: number;
  netAmountMinorUnits: number | null;
  vatRateBasisPoints: number | null;
  vatAmountMinorUnits: number | null;
  grossTotalMinorUnits: number | null;
  currency: "EUR";
  partialEstimatedMinutes: number;
  totalEstimatedMinutes: number | null;
}>;

function assertCalculationInstant(calculatedAt: string): void {
  if (Number.isNaN(Date.parse(calculatedAt))) {
    throw new Error("Estimate timestamp must be a valid ISO-compatible instant.");
  }
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function toJsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

export function calculateStaffEstimate(
  input: EstimateEngineInput,
  calculatedAt: string,
  configuration: EstimateConfiguration = developmentEstimateConfiguration,
): StaffEstimateCalculation {
  assertCalculationInstant(calculatedAt);

  const priceBook = configuration.priceBooks.find(
    (candidate) => candidate.customerSegment === input.customerSegment,
  );
  if (!priceBook) {
    throw new Error("No development price book exists for this segment.");
  }

  const priceInput: PriceCalculationInput = {
    items: input.items,
    conditionBandCode: input.conditionBandCode,
    travelZoneCode: input.travelZoneCode,
    timingCategoryCode: input.timingCategoryCode,
  };
  const durationInput: DurationCalculationInput = {
    items: input.items,
    conditionBandCode: input.conditionBandCode,
  };
  const priceResult = calculatePrice(priceBook, priceInput);
  const durationResult = calculateDuration(
    configuration.durationModel,
    durationInput,
  );
  const serviceArea =
    configuration.serviceAreas.find(
      (candidate) => candidate.code === input.travelZoneCode,
    ) ?? null;

  const reasonCodes: EstimateReviewReasonCode[] = [
    ...input.governanceReviewReasonCodes,
  ];
  if (!priceBook.active) reasonCodes.push("PRICE_BOOK_NOT_ACTIVE");
  if (priceBook.provisional) reasonCodes.push("PRICE_BOOK_PROVISIONAL");
  if (!priceBook.approvedForPublication) {
    reasonCodes.push("PRICE_BOOK_NOT_PUBLICATION_APPROVED");
  }
  if (priceBook.vatConfiguration.mode === "VAT_UNRESOLVED") {
    reasonCodes.push("VAT_STATUS_UNRESOLVED");
  }
  if (priceResult.manualAssessmentRequired) {
    reasonCodes.push("PRICE_MANUAL_ASSESSMENT");
  }
  if (priceResult.declineOrReferRequired) {
    reasonCodes.push("PRICE_DECLINE_OR_REFER");
  }
  if (!configuration.durationModel.active) {
    reasonCodes.push("DURATION_MODEL_NOT_ACTIVE");
  }
  if (configuration.durationModel.provisional) {
    reasonCodes.push("DURATION_MODEL_PROVISIONAL");
  }
  if (durationResult.manualAssessmentRequired) {
    reasonCodes.push("DURATION_MANUAL_ASSESSMENT");
  }
  if (durationResult.declineOrReferRequired) {
    reasonCodes.push("DURATION_DECLINE_OR_REFER");
  }
  if (!configuration.schedulingPolicy.active) {
    reasonCodes.push("SCHEDULING_POLICY_NOT_ACTIVE");
  }
  if (!serviceArea) {
    reasonCodes.push("UNKNOWN_SERVICE_AREA");
  } else {
    if (serviceArea.manualConfirmationRequired) {
      reasonCodes.push("SERVICE_AREA_MANUAL_CONFIRMATION");
    }
    if (!serviceArea.serviceEligible) {
      reasonCodes.push("SERVICE_AREA_NOT_ELIGIBLE");
    }
  }

  const reviewReasonCodes = unique(reasonCodes);
  const declineOrReferRequired =
    priceResult.declineOrReferRequired ||
    durationResult.declineOrReferRequired ||
    serviceArea?.serviceEligible === false;
  const manualReviewRequired = reviewReasonCodes.length > 0;

  return {
    audience: "STAFF_ONLY",
    disposition: declineOrReferRequired
      ? "DECLINE_OR_REFER"
      : manualReviewRequired
        ? "MANUAL_REVIEW_REQUIRED"
        : "READY_FOR_STAFF_REVIEW",
    manualReviewRequired,
    declineOrReferRequired,
    reviewReasonCodes,
    priceSnapshot: {
      schemaVersion: 1,
      calculatedAt,
      priceBook: {
        id: priceBook.id,
        code: priceBook.code,
        version: priceBook.version,
        status: priceBook.status,
        provisional: priceBook.provisional,
        approvedForPublication: priceBook.approvedForPublication,
      },
      configuration: toJsonObject(priceBook),
      input: toJsonObject(priceInput),
      result: {
        lines: priceResult.lines,
        subtotalMinorUnits: priceResult.subtotalMinorUnits,
        minimumVisitAdjustmentMinorUnits:
          priceResult.minimumVisitAdjustmentMinorUnits,
        netAmountMinorUnits: priceResult.netAmountMinorUnits,
        vatRateBasisPoints: priceResult.vatRateBasisPoints,
        vatAmountMinorUnits: priceResult.vatAmountMinorUnits,
        grossTotalMinorUnits: priceResult.grossTotalMinorUnits,
        currency: priceResult.currency,
        warnings: priceResult.warnings,
        manualAssessmentRequired: priceResult.manualAssessmentRequired,
        declineOrReferRequired: priceResult.declineOrReferRequired,
        appliedRuleIds: priceResult.appliedRuleIds,
      },
    },
    durationSnapshot: {
      schemaVersion: 1,
      calculatedAt,
      durationModel: {
        id: configuration.durationModel.id,
        code: configuration.durationModel.code,
        version: configuration.durationModel.version,
        status: configuration.durationModel.status,
        provisional: configuration.durationModel.provisional,
      },
      configuration: toJsonObject(configuration.durationModel),
      input: toJsonObject(durationInput),
      result: {
        lines: durationResult.lines,
        setupMinutes: durationResult.setupMinutes,
        inspectionMinutes: durationResult.inspectionMinutes,
        baseCleaningMinutes: durationResult.baseCleaningMinutes,
        modifierMinutes: durationResult.modifierMinutes,
        addonMinutes: durationResult.addonMinutes,
        cleanupMinutes: durationResult.cleanupMinutes,
        partialEstimatedMinutes: durationResult.partialEstimatedMinutes,
        totalEstimatedMinutes: durationResult.totalEstimatedMinutes,
        warnings: durationResult.warnings,
        manualAssessmentRequired: durationResult.manualAssessmentRequired,
        declineOrReferRequired: durationResult.declineOrReferRequired,
        appliedRuleIds: durationResult.appliedRuleIds,
      },
    },
    availabilitySnapshot: {
      schemaVersion: 1,
      calculatedAt,
      configuration: toJsonObject({
        serviceArea,
        schedulingPolicy: configuration.schedulingPolicy,
        travelTimeProfile: configuration.travelTimeProfile,
        workingHourPolicy: configuration.workingHourPolicy,
        appointmentWindows: configuration.appointmentWindows,
      }),
      result: {
        serviceEligible: serviceArea?.serviceEligible ?? null,
        manualConfirmationRequired:
          !serviceArea || serviceArea.manualConfirmationRequired,
        schedulingConfigurationReady: configuration.schedulingPolicy.active,
      },
    },
    subtotalMinorUnits: priceResult.subtotalMinorUnits,
    netAmountMinorUnits: priceResult.netAmountMinorUnits,
    vatRateBasisPoints: priceResult.vatRateBasisPoints,
    vatAmountMinorUnits: priceResult.vatAmountMinorUnits,
    grossTotalMinorUnits: priceResult.grossTotalMinorUnits,
    currency: priceResult.currency,
    partialEstimatedMinutes: durationResult.partialEstimatedMinutes,
    totalEstimatedMinutes: durationResult.totalEstimatedMinutes,
  };
}
