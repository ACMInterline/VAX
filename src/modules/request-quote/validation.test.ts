import { describe, expect, it } from "vitest";
import {
  createQuoteDraftInputSchema,
  createRequestEstimateInputSchema,
  createServiceRequestInputSchema,
  normalizeRequestItemInputSchema,
  quoteReferenceSchema,
  requestReferenceSchema,
} from "./validation";

const requestId = "10000000-0000-4000-8000-000000000001";
const customerId = "10000000-0000-4000-8000-000000000002";
const profileId = "10000000-0000-4000-8000-000000000003";
const estimateId = "10000000-0000-4000-8000-000000000004";

function publicRequest() {
  return {
    source: "PUBLIC_WEB",
    preferredLocale: "bg",
    contactName: "Synthetic Customer",
    contactEmail: " SYNTHETIC@EXAMPLE.INVALID ",
    contactPhone: "+359 88 000 0000",
    customerNotes: "Please review the material.",
    preferredDate: "2026-09-01",
    preferredWindowCode: "morning",
    originalSubmission: {
      services: ["SOFA_3_SEAT"],
      estimatedQuantity: "one sofa",
    },
    items: [
      {
        customerDescription: "Large sofa",
        quantity: 1,
        sortOrder: 0,
        issueTypeIds: [1],
        addonIds: [],
      },
    ],
  } as const;
}

const priceSnapshot = {
  schemaVersion: 1,
  calculatedAt: "2026-08-24T10:00:00.000Z",
  priceBook: {
    id: "development-price-book",
    code: "SOFIA-DEV-V1",
    version: 1,
    status: "DRAFT",
    provisional: true,
    approvedForPublication: false,
  },
  configuration: { vatMode: "VAT_REGISTERED" },
  input: { items: [{ quantity: 1 }] },
  result: {
    lines: [
      {
        kind: "ITEM_BASE",
        label: "Sofa",
        amountMinorUnits: 8_000,
        ruleId: "base-1",
      },
    ],
    subtotalMinorUnits: 8_000,
    minimumVisitAdjustmentMinorUnits: 2_000,
    netAmountMinorUnits: 10_000,
    vatRateBasisPoints: 2_000,
    vatAmountMinorUnits: 2_000,
    grossTotalMinorUnits: 12_000,
    currency: "EUR",
    warnings: ["Development-only provisional price book."],
    manualAssessmentRequired: true,
    declineOrReferRequired: false,
    appliedRuleIds: ["base-1"],
  },
} as const;

const durationSnapshot = {
  schemaVersion: 1,
  calculatedAt: "2026-08-24T10:00:00.000Z",
  durationModel: {
    id: "development-duration-model",
    code: "SOFIA-DURATION-DEV-V1",
    version: 1,
    status: "DRAFT",
    provisional: true,
  },
  configuration: { market: "SOFIA" },
  input: { items: [{ quantity: 1 }] },
  result: {
    lines: [
      { kind: "ITEM_BASE", label: "Sofa", minutes: 90, ruleId: "duration-1" },
    ],
    setupMinutes: 10,
    inspectionMinutes: 10,
    baseCleaningMinutes: 90,
    modifierMinutes: 0,
    addonMinutes: 0,
    cleanupMinutes: 10,
    partialEstimatedMinutes: 120,
    totalEstimatedMinutes: 120,
    warnings: ["Development-only provisional duration model."],
    manualAssessmentRequired: true,
    declineOrReferRequired: false,
    appliedRuleIds: ["duration-1"],
  },
} as const;

const availabilitySnapshot = {
  schemaVersion: 1,
  calculatedAt: "2026-08-24T10:00:00.000Z",
  configuration: { serviceAreaCode: "SOFIA_STANDARD" },
  result: {
    serviceEligible: true,
    manualConfirmationRequired: true,
    schedulingConfigurationReady: false,
  },
} as const;

function estimate() {
  return {
    requestId,
    estimateVersion: 1,
    status: "REVIEW_REQUIRED",
    priceBookId: 1,
    priceBookCode: "SOFIA-DEV-V1",
    priceBookVersion: 1,
    durationModelId: 1,
    durationModelCode: "SOFIA-DURATION-DEV-V1",
    durationModelVersion: 1,
    inputSnapshot: { normalizedItemVersion: 1 },
    priceSnapshot,
    durationSnapshot,
    availabilitySnapshot,
    netAmountMinorUnits: 10_000,
    vatRateBasisPoints: 2_000,
    vatAmountMinorUnits: 2_000,
    grossTotalMinorUnits: 12_000,
    currency: "EUR",
    estimatedServiceMinutes: 120,
    estimatedTravelMinutes: null,
    manualAssessmentRequired: true,
    declineOrReferRequired: false,
    warnings: ["Development configuration requires staff review."],
    reviewReasonCodes: [],
  } as const;
}

function quoteDraft() {
  return {
    requestId,
    customerId,
    propertyId: null,
    estimateId,
    quoteVersion: 1,
    currency: "EUR",
    priceBasis: "NET",
    netAmountMinorUnits: 10_000,
    vatRateBasisPoints: 2_000,
    vatAmountMinorUnits: 2_000,
    grossTotalMinorUnits: 12_000,
    estimatedDurationMinutes: 120,
    commercialSnapshot: { estimateVersion: 1, priceSnapshot },
    termsSnapshot: { validityDays: 7, templateCode: "PROVISIONAL-V1" },
    validFrom: new Date("2026-08-24T10:00:00.000Z"),
    validUntil: new Date("2026-08-31T10:00:00.000Z"),
    staffNotes: "Synthetic staff note.",
    customerNotes: "Assessment caveats apply.",
    items: [
      {
        requestItemId: null,
        serviceId: 1,
        cleaningItemTypeId: 1,
        measurementModeId: 1,
        descriptionBg: "Пране на диван",
        descriptionEn: "Sofa cleaning",
        quantity: 1,
        measurementSnapshot: { billingUnit: "ITEM" },
        baseAmountMinorUnits: 8_000,
        modifierAmountMinorUnits: 0,
        addonAmountMinorUnits: 2_000,
        netAmountMinorUnits: 10_000,
        vatRateBasisPoints: 2_000,
        vatAmountMinorUnits: 2_000,
        grossTotalMinorUnits: 12_000,
        calculationSnapshot: { ruleIds: ["base-1", "minimum-1"] },
        sortOrder: 0,
      },
    ],
  } as const;
}

describe("request and quote validation", () => {
  it("accepts only the collision-resistant customer-safe reference formats", () => {
    expect(
      requestReferenceSchema.safeParse("REQ-000102030405060708090A0B").success,
    ).toBe(true);
    expect(
      quoteReferenceSchema.safeParse("Q-000102030405060708090A0B").success,
    ).toBe(true);
    expect(requestReferenceSchema.safeParse("REQ-123").success).toBe(false);
    expect(quoteReferenceSchema.safeParse("1").success).toBe(false);
  });

  it("accepts an anonymous request while refusing CRM/Auth mass assignment", () => {
    const parsed = createServiceRequestInputSchema.parse(publicRequest());
    expect(parsed.contactEmail).toBe("synthetic@example.invalid");
    expect(parsed.customerId).toBeNull();
    expect(parsed.requestingProfileId).toBeNull();

    expect(
      createServiceRequestInputSchema.safeParse({
        ...publicRequest(),
        customerId,
        customerResolutionStatus: "LINKED",
      }).success,
    ).toBe(false);
    expect(
      createServiceRequestInputSchema.safeParse({
        ...publicRequest(),
        authProviderUserId: "must-not-cross-the-provider-boundary",
      }).success,
    ).toBe(false);
  });

  it("requires verified linked context for portal and staff-created requests", () => {
    expect(
      createServiceRequestInputSchema.safeParse({
        ...publicRequest(),
        source: "CUSTOMER_PORTAL",
        customerResolutionStatus: "LINKED",
        customerId,
        requestingProfileId: profileId,
      }).success,
    ).toBe(true);
    expect(
      createServiceRequestInputSchema.safeParse({
        ...publicRequest(),
        source: "CUSTOMER_PORTAL",
        customerResolutionStatus: "LINKED",
        customerId,
      }).success,
    ).toBe(false);
    expect(
      createServiceRequestInputSchema.safeParse({
        ...publicRequest(),
        source: "STAFF_CREATED",
        customerResolutionStatus: "LINKED",
        customerId,
      }).success,
    ).toBe(true);
  });

  it("rejects duplicate taxonomy relations and impossible dates", () => {
    expect(
      createServiceRequestInputSchema.safeParse({
        ...publicRequest(),
        preferredDate: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      createServiceRequestInputSchema.safeParse({
        ...publicRequest(),
        items: [
          {
            ...publicRequest().items[0],
            issueTypeIds: [1, 1],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("keeps reported and normalized material references as separate inputs", () => {
    const parsed = createServiceRequestInputSchema.parse({
      ...publicRequest(),
      items: [
        {
          ...publicRequest().items[0],
          reportedFibreMaterialId: 10,
          normalizedFibreMaterialId: 11,
          reportedSurfaceConstructionId: 20,
          normalizedSurfaceConstructionId: 21,
        },
      ],
    });

    expect(parsed.items[0]).toMatchObject({
      reportedFibreMaterialId: 10,
      normalizedFibreMaterialId: 11,
      reportedSurfaceConstructionId: 20,
      normalizedSurfaceConstructionId: 21,
    });
  });

  it("accepts only staff-owned material fields during normalization", () => {
    const normalization = {
      serviceId: 1,
      cleaningItemTypeId: 2,
      cleaningAssetId: null,
      measurementModeId: 3,
      normalizedConditionLevelId: 4,
      normalizedFibreMaterialId: 11,
      normalizedSurfaceConstructionId: 21,
      normalizedDescription: "Staff interpretation",
      quantity: 1,
      areaHundredthsM2: null,
      seatCount: 2,
      sides: null,
      sortOrder: 0,
      issueTypeIds: [],
      addonIds: [],
    };

    expect(normalizeRequestItemInputSchema.parse(normalization)).toMatchObject({
      normalizedFibreMaterialId: 11,
      normalizedSurfaceConstructionId: 21,
    });
    expect(
      normalizeRequestItemInputSchema.safeParse({
        ...normalization,
        reportedFibreMaterialId: 10,
      }).success,
    ).toBe(false);
    expect(
      normalizeRequestItemInputSchema.safeParse({
        ...normalization,
        reportedSurfaceConstructionId: 20,
      }).success,
    ).toBe(false);
    expect(
      normalizeRequestItemInputSchema.safeParse({
        ...normalization,
        customerReportedConditionLevelId: 5,
      }).success,
    ).toBe(false);
  });

  it("preserves complete immutable price/duration evidence", () => {
    expect(createRequestEstimateInputSchema.safeParse(estimate()).success).toBe(
      true,
    );
    expect(
      createRequestEstimateInputSchema.safeParse({
        ...estimate(),
        grossTotalMinorUnits: 12_001,
      }).success,
    ).toBe(false);
    expect(
      createRequestEstimateInputSchema.safeParse({
        ...estimate(),
        priceSnapshot: {
          ...priceSnapshot,
          result: {
            ...priceSnapshot.result,
            minimumVisitAdjustmentMinorUnits: undefined,
          },
        },
      }).success,
    ).toBe(false);
  });

  it("allows governance and availability signals to force review fail-closed", () => {
    const engineReadyPrice = {
      ...priceSnapshot,
      result: {
        ...priceSnapshot.result,
        manualAssessmentRequired: false,
      },
    };
    const engineReadyDuration = {
      ...durationSnapshot,
      result: {
        ...durationSnapshot.result,
        manualAssessmentRequired: false,
      },
    };
    expect(
      createRequestEstimateInputSchema.safeParse({
        ...estimate(),
        priceSnapshot: engineReadyPrice,
        durationSnapshot: engineReadyDuration,
        reviewReasonCodes: ["PRICE_BOOK_PROVISIONAL"],
      }).success,
    ).toBe(true);

    expect(
      createRequestEstimateInputSchema.safeParse({
        ...estimate(),
        priceSnapshot: engineReadyPrice,
        durationSnapshot: engineReadyDuration,
        availabilitySnapshot: {
          ...availabilitySnapshot,
          result: {
            ...availabilitySnapshot.result,
            serviceEligible: false,
          },
        },
        status: "DECLINE_OR_REFER",
        manualAssessmentRequired: true,
        declineOrReferRequired: true,
        reviewReasonCodes: ["SERVICE_AREA_NOT_ELIGIBLE"],
      }).success,
    ).toBe(true);
  });

  it("validates quote totals/version input without accepting booking semantics", () => {
    expect(createQuoteDraftInputSchema.safeParse(quoteDraft()).success).toBe(
      true,
    );
    expect(
      createQuoteDraftInputSchema.safeParse({
        ...quoteDraft(),
        validUntil: new Date("2026-08-23T10:00:00.000Z"),
      }).success,
    ).toBe(false);
    expect(
      createQuoteDraftInputSchema.safeParse({
        ...quoteDraft(),
        acceptedAt: new Date(),
      }).success,
    ).toBe(false);
  });
});
