import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationBoundaryError } from "@/auth/principal-policy";
import { requestQuoteContent } from "@/content/request-quote";

const doubles = vi.hoisted(() => {
  const service = {
    createCustomerRequest: vi.fn(),
    createStaffRequest: vi.fn(),
    createCustomerFromRequest: vi.fn(),
    linkRequest: vi.fn(),
    setRequestResolution: vi.fn(),
    normalizeRequest: vi.fn(),
    transitionRequest: vi.fn(),
    appendEstimate: vi.fn(),
    getRequest: vi.fn(),
    createQuoteDraft: vi.fn(),
    updateQuoteDraft: vi.fn(),
    issueQuote: vi.fn(),
    withdrawQuote: vi.fn(),
    expireQuote: vi.fn(),
  };
  return {
    service,
    requireUserPermission: vi.fn(),
    isAuthAttemptAllowed: vi.fn(),
    revalidatePath: vi.fn(),
    repositoryFactory: vi.fn(() => ({})),
    serviceFactory: vi.fn(() => service),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: doubles.revalidatePath }));
vi.mock("@/auth/authorization-service", () => ({
  requireUserPermission: doubles.requireUserPermission,
}));
vi.mock("@/auth/enforce-rate-limit", () => ({
  isAuthAttemptAllowed: doubles.isAuthAttemptAllowed,
}));
vi.mock("@/db/client", () => ({ getDatabase: vi.fn(() => ({})) }));
vi.mock("@/modules/request-quote/repository", () => ({
  createDatabaseRequestQuoteRepository: doubles.repositoryFactory,
}));
vi.mock("@/modules/request-quote/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/request-quote/service")>()),
  createRequestQuoteService: doubles.serviceFactory,
}));

import {
  appendEstimateAction,
  createCustomerFromRequestAction,
  createCustomerRequestAction,
  createQuoteDraftAction,
  createStaffRequestAction,
  normalizeRequestAction,
  setRequestResolutionAction,
  updateQuoteDraftAction,
} from "./actions";

const profileId = "10000000-0000-4000-8000-000000000001";
const customerId = "20000000-0000-4000-8000-000000000001";
const propertyId = "30000000-0000-4000-8000-000000000001";
const cleaningAssetId = "35000000-0000-4000-8000-000000000001";
const requestId = "40000000-0000-4000-8000-000000000001";
const requestItemId = "50000000-0000-4000-8000-000000000001";
const estimateId = "60000000-0000-4000-8000-000000000001";
const quoteId = "70000000-0000-4000-8000-000000000001";
const databasePriceSnapshotSha256 = "ab".repeat(32);

const storedPriceSnapshot = {
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
  configuration: { priceBasis: "NET" },
  input: { items: [{ quantity: 1 }] },
  result: {
    lines: [
      {
        kind: "BASE_ITEM",
        label: "Sofa",
        amountMinorUnits: 8_000,
        ruleId: "base-1",
      },
      {
        kind: "CONDITION_MODIFIER",
        label: "Condition",
        amountMinorUnits: 1_000,
        ruleId: "condition-1",
      },
      {
        kind: "ADD_ON",
        label: "Add-on",
        amountMinorUnits: 1_000,
        ruleId: "addon-1",
      },
    ],
    subtotalMinorUnits: 10_000,
    minimumVisitAdjustmentMinorUnits: null,
    netAmountMinorUnits: 10_000,
    vatRateBasisPoints: 2_000,
    vatAmountMinorUnits: 2_000,
    grossTotalMinorUnits: 12_000,
    currency: "EUR",
    warnings: ["Development configuration requires review."],
    manualAssessmentRequired: true,
    declineOrReferRequired: false,
    appliedRuleIds: ["base-1", "condition-1", "addon-1"],
  },
} as const;

const principal = {
  profile: {
    id: profileId,
    displayName: "Dispatcher",
    preferredLocale: "en" as const,
    phone: null,
    status: "ACTIVE" as const,
  },
  roles: new Set(["DISPATCHER"]),
  permissions: new Set([
    "CUSTOMER_RECORDS_READ",
    "CUSTOMER_RECORDS_MANAGE",
    "OPERATIONS_READ",
    "OPERATIONS_MANAGE",
    "OWN_CUSTOMER_DATA_READ",
    "OWN_CUSTOMER_DATA_UPDATE",
  ]),
};

const idle = { status: "IDLE" as const };

function form(entries: readonly (readonly [string, string])[]): FormData {
  const result = new FormData();
  for (const [name, value] of entries) result.append(name, value);
  return result;
}

function quoteForm(extra: readonly (readonly [string, string])[] = []) {
  return form([
    ["requestId", requestId],
    ["estimateId", quoteId],
    ["sourceRequestVersion", "999"],
    ["expectedRequestVersion", "1"],
    ["validUntil", "2099-12-31"],
    ["vatRateBasisPoints", "2000"],
    ["estimatedDurationMinutes", "180"],
    ["customerNotes", "Customer note"],
    ["additionalAssumptions", "Lift access is required."],
    ["staffNotes", "Internal review complete"],
    ["terms", "MALICIOUS REPLACEMENT"],
    ["quoteItems.0.requestItemId", requestItemId],
    ["quoteItems.0.descriptionBg", "Пране на диван"],
    ["quoteItems.0.descriptionEn", "Sofa cleaning"],
    ["quoteItems.0.netAmountMinorUnits", "10000"],
    ["quoteItems.0.manualOverrideReason", "Reviewed after site inspection"],
    ["quoteItems.0.baseAmountMinorUnits", "1"],
    ["quoteItems.0.modifierAmountMinorUnits", "2"],
    ["quoteItems.0.addonAmountMinorUnits", "999997"],
    ["quoteItems.0.calculationSnapshot", '{"forged":true}'],
    ...extra,
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  doubles.requireUserPermission.mockResolvedValue(principal);
  doubles.isAuthAttemptAllowed.mockResolvedValue(true);
  doubles.serviceFactory.mockReturnValue(doubles.service);
  doubles.service.createCustomerRequest.mockResolvedValue({
    status: "CREATED",
    requestReference: "REQ-0123456789ABCDEF01234567",
    version: 1,
  });
  doubles.service.createStaffRequest.mockResolvedValue({
    status: "CREATED",
    requestReference: "REQ-0123456789ABCDEF01234567",
    version: 1,
  });
  doubles.service.appendEstimate.mockResolvedValue({ status: "CREATED" });
  doubles.service.createCustomerFromRequest.mockResolvedValue({
    status: "CHANGED",
  });
  doubles.service.setRequestResolution.mockResolvedValue({ status: "CHANGED" });
  doubles.service.normalizeRequest.mockResolvedValue({ status: "CHANGED" });
  doubles.service.getRequest.mockResolvedValue({
    id: requestId,
    version: 1,
    items: [
      {
        id: requestItemId,
        serviceId: 10,
        cleaningItemTypeId: 20,
        measurementModeId: 30,
        normalizedDescription: "Sofa",
        customerDescription: "Sofa",
        quantity: 1,
        areaHundredthsM2: null,
        seatCount: 3,
        sides: 1,
      },
    ],
    estimates: [
      {
        id: quoteId,
        source_request_version: 1,
        estimate_version: 1,
        decline_or_refer_required: false,
        price_book_code: "SOFIA-DEV-V1",
        price_book_version: 1,
        price_snapshot: storedPriceSnapshot,
        price_snapshot_sha256: databasePriceSnapshotSha256,
      },
      {
        id: estimateId,
        source_request_version: 1,
        estimate_version: 2,
        decline_or_refer_required: false,
        price_book_code: "SOFIA-DEV-V1",
        price_book_version: 1,
        price_snapshot: storedPriceSnapshot,
        price_snapshot_sha256: databasePriceSnapshotSha256,
      },
    ],
  });
  doubles.service.createQuoteDraft.mockResolvedValue({ status: "CREATED" });
  doubles.service.updateQuoteDraft.mockResolvedValue({ status: "CHANGED" });
});

describe("request and quote Server Action boundaries", () => {
  it("authenticates before reading hostile form input", async () => {
    doubles.requireUserPermission.mockRejectedValueOnce(
      new AuthenticationBoundaryError("AUTHENTICATION_REQUIRED"),
    );
    const data = new FormData();
    const getAll = vi.spyOn(data, "getAll");

    await expect(createStaffRequestAction(idle, data)).resolves.toEqual({
      status: "ERROR",
      message: requestQuoteContent.bg.common.unavailable,
    });
    expect(doubles.requireUserPermission).toHaveBeenCalledWith(
      "CUSTOMER_RECORDS_MANAGE",
    );
    expect(getAll).not.toHaveBeenCalled();
    expect(doubles.service.createStaffRequest).not.toHaveBeenCalled();
  });

  it("constructs customer provenance from the fresh principal", async () => {
    const result = await createCustomerRequestAction(
      idle,
      form([
        ["customerId", customerId],
        ["propertyId", propertyId],
        ["cleaningAssetId", cleaningAssetId],
        ["contactName", "Customer"],
        ["contactEmail", "customer@example.invalid"],
        ["contactPhone", ""],
        ["customerDescription", "Three-seat sofa"],
        ["quantity", "1"],
        ["preferredDate", "2099-12-20"],
        ["preferredWindowCode", "MORNING"],
      ]),
    );

    expect(doubles.requireUserPermission).toHaveBeenCalledWith(
      "OWN_CUSTOMER_DATA_UPDATE",
    );
    expect(doubles.service.createCustomerRequest).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      expect.objectContaining({
        source: "CUSTOMER_PORTAL",
        customerResolutionStatus: "LINKED",
        customerId,
        requestingProfileId: profileId,
        propertyId,
        originalSubmission: expect.objectContaining({
          selectedPropertyId: propertyId,
          selectedCleaningAssetId: cleaningAssetId,
        }),
        items: [expect.objectContaining({ cleaningAssetId })],
      }),
    );
    expect(result).toMatchObject({
      status: "SUCCESS",
      requestReference: "REQ-0123456789ABCDEF01234567",
    });
  });

  it("does not accept browser-supplied estimate engine lines", async () => {
    const data = form([
      ["requestId", requestId],
      ["expectedVersion", "4"],
      ["engineInput", '{"grossTotalMinorUnits":1}'],
      ["customerSegment", "B2B"],
    ]);

    await appendEstimateAction(idle, data);

    expect(doubles.service.appendEstimate).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      { requestId, expectedRequestVersion: 4 },
    );
  });

  it("passes the optional service zone through the atomic customer-and-property command", async () => {
    await createCustomerFromRequestAction(
      idle,
      form([
        ["requestId", requestId],
        ["expectedVersion", "2"],
        ["customerType", "INDIVIDUAL"],
        ["displayName", "New customer"],
        ["legalName", ""],
        ["internalNotes", ""],
        ["propertyType", "RESIDENTIAL"],
        ["propertyLabel", "Home"],
        ["propertyCity", "Sofia"],
        ["propertyDistrict", "Lozenets"],
        ["propertyStreetAddress", "Example street"],
        ["propertyPostalCode", "1000"],
        ["serviceZoneId", "12"],
      ]),
    );

    expect(doubles.service.createCustomerFromRequest).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      expect.objectContaining({
        requestId,
        expectedVersion: 2,
        property: expect.objectContaining({ serviceZoneId: 12 }),
      }),
    );
  });

  it("exposes only the controlled unlinked resolution states", async () => {
    await setRequestResolutionAction(
      idle,
      form([
        ["requestId", requestId],
        ["expectedVersion", "3"],
        ["fromStatus", "UNRESOLVED"],
        ["toStatus", "MATCH_CANDIDATE"],
      ]),
    );

    expect(doubles.service.setRequestResolution).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      {
        requestId,
        expectedVersion: 3,
        fromStatus: "UNRESOLVED",
        toStatus: "MATCH_CANDIDATE",
      },
    );
  });

  it("keeps customer-reported condition provenance out of staff normalization writes", async () => {
    await normalizeRequestAction(
      idle,
      form([
        ["requestId", requestId],
        ["expectedVersion", "5"],
        ["staffNotes", "Reviewed"],
        ["items.0.itemId", requestItemId],
        ["items.0.expectedVersion", "2"],
        ["items.0.customerReportedConditionLevelId", "999"],
        ["items.0.normalizedConditionLevelId", "4"],
        ["items.0.serviceId", "10"],
        ["items.0.cleaningItemTypeId", "20"],
        ["items.0.cleaningAssetId", ""],
        ["items.0.measurementModeId", "30"],
        ["items.0.normalizedFibreMaterialId", "50"],
        ["items.0.normalizedSurfaceConstructionId", "60"],
        ["items.0.normalizedDescription", "Reviewed sofa"],
        ["items.0.quantity", "1"],
        ["items.0.areaHundredthsM2", ""],
        ["items.0.seatCount", "3"],
        ["items.0.sides", "1"],
        ["items.0.sortOrder", "0"],
      ]),
    );

    const command = doubles.service.normalizeRequest.mock.calls[0]![1];
    expect(command.items[0]).toMatchObject({
      itemId: requestItemId,
      normalizedConditionLevelId: 4,
      normalizedFibreMaterialId: 50,
      normalizedSurfaceConstructionId: 60,
    });
    expect(command.items[0]).not.toHaveProperty(
      "customerReportedConditionLevelId",
    );
    expect(command.items[0]).not.toHaveProperty("reportedFibreMaterialId");
    expect(command.items[0]).not.toHaveProperty(
      "reportedSurfaceConstructionId",
    );
  });

  it("persists controlled terms and treats entered text only as an additional assumption", async () => {
    await createQuoteDraftAction(idle, quoteForm());

    const command = doubles.service.createQuoteDraft.mock.calls[0]![1];
    expect(command.termsSnapshot).toMatchObject({
      schemaVersion: 1,
      templateCode: "VAX_QUOTE_TERMS_PHASE_3D_V1",
      additionalAssumptions: "Lift access is required.",
      statements: {
        en: {
          inspection: expect.any(String),
          parkingTravel: expect.any(String),
          stainRemoval: expect.any(String),
          dryingReuse: expect.any(String),
          addons: expect.any(String),
        },
      },
    });
    expect(JSON.stringify(command.termsSnapshot)).not.toContain(
      "MALICIOUS REPLACEMENT",
    );
    expect(JSON.stringify(command.termsSnapshot)).not.toMatch(
      /medical|manufacturer|disinfect|sterili[sz]/i,
    );
    expect(command.items).toEqual([
      expect.objectContaining({
        requestItemId,
        descriptionEn: "Sofa cleaning",
        baseAmountMinorUnits: 10000,
        modifierAmountMinorUnits: 0,
        addonAmountMinorUnits: 0,
        netAmountMinorUnits: 10000,
        vatAmountMinorUnits: 2000,
        grossTotalMinorUnits: 12000,
      }),
    ]);
    expect(command.estimateId).toBe(estimateId);
    expect(command.items[0].calculationSnapshot).toMatchObject({
      pricingMode: "STAFF_REVIEWED_LUMP_SUM",
      componentAllocation: "NOT_DERIVED_PER_LINE",
      sourceEstimate: {
        estimateId,
        estimateVersion: 2,
        sourceRequestVersion: 1,
        priceSnapshotSha256: databasePriceSnapshotSha256,
        aggregateEvidence: {
          allocationScope: "REQUEST_AGGREGATE_NOT_LINE_ALLOCATED",
          baseLinesMinorUnits: 8_000,
          modifierLinesMinorUnits: 1_000,
          addonLinesMinorUnits: 1_000,
        },
      },
      manualOverride: {
        reviewedByProfileId: profileId,
        reason: "Reviewed after site inspection",
        reviewedNetAmountMinorUnits: 10_000,
      },
    });
    expect(JSON.stringify(command.items[0].calculationSnapshot)).not.toContain(
      "forged",
    );
    expect(command.commercialSnapshot).toMatchObject({
      pricingMode: "STAFF_REVIEWED_LUMP_SUM",
      sourceEstimate: { estimateId, sourceRequestVersion: 1 },
    });
  }, 10_000);

  it("fails closed when the persisted estimate has no database-canonical price digest", async () => {
    const request = await doubles.service.getRequest();
    doubles.service.getRequest.mockClear();
    doubles.service.getRequest.mockResolvedValueOnce({
      ...request,
      estimates: request.estimates.map((estimate: Record<string, unknown>) => {
        const { price_snapshot_sha256: digest, ...withoutDigest } = estimate;
        void digest;
        return withoutDigest;
      }),
    });

    await expect(createQuoteDraftAction(idle, quoteForm())).resolves.toMatchObject({
      status: "ERROR",
      message: requestQuoteContent.en.common.invalid,
    });
    expect(doubles.service.createQuoteDraft).not.toHaveBeenCalled();
  });

  it("requires an explicit reason for every manually reviewed line amount", async () => {
    const data = quoteForm();
    data.set("quoteItems.0.manualOverrideReason", "");

    const result = await createQuoteDraftAction(idle, data);

    expect(result).toMatchObject({
      status: "ERROR",
      message: requestQuoteContent.en.common.invalid,
    });
    expect(doubles.service.createQuoteDraft).not.toHaveBeenCalled();
  });

  it("rejects prohibited efficacy or approval claims in additional assumptions", async () => {
    const data = quoteForm();
    data.set("additionalAssumptions", "Manufacturer-approved medical disinfection guaranteed.");

    const result = await createQuoteDraftAction(idle, data);

    expect(result).toMatchObject({
      status: "ERROR",
      message: requestQuoteContent.en.common.invalid,
    });
    expect(doubles.service.createQuoteDraft).not.toHaveBeenCalled();
  });

  it("rejects prohibited customer-visible claims in a new quote note", async () => {
    const data = quoteForm();
    data.set(
      "customerNotes",
      "Manufacturer-approved sterilization is guaranteed.",
    );

    const result = await createQuoteDraftAction(idle, data);

    expect(result).toMatchObject({
      status: "ERROR",
      message: requestQuoteContent.en.common.invalid,
    });
    expect(doubles.service.createQuoteDraft).not.toHaveBeenCalled();
  });

  it("updates only a draft through the optimistic record-version command", async () => {
    await updateQuoteDraftAction(
      idle,
      quoteForm([
        ["quoteId", quoteId],
        ["expectedRecordVersion", "3"],
      ]),
    );

    expect(doubles.service.updateQuoteDraft).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      expect.objectContaining({
        quoteId,
        expectedRecordVersion: 3,
        expectedRequestVersion: 1,
        estimateId,
      }),
    );
    const updateCommand = doubles.service.updateQuoteDraft.mock.calls[0]![1];
    expect(updateCommand.items[0]).toMatchObject({
      baseAmountMinorUnits: 10_000,
      modifierAmountMinorUnits: 0,
      addonAmountMinorUnits: 0,
      calculationSnapshot: {
        pricingMode: "STAFF_REVIEWED_LUMP_SUM",
        sourceEstimate: {
          estimateId,
          estimateVersion: 2,
          sourceRequestVersion: 1,
        },
      },
    });
    expect(JSON.stringify(updateCommand.items[0])).not.toContain("forged");
    expect(doubles.service.issueQuote).not.toHaveBeenCalled();
  });

  it("rejects prohibited customer-visible line claims when updating a draft", async () => {
    const data = quoteForm([
      ["quoteId", quoteId],
      ["expectedRecordVersion", "3"],
    ]);
    data.set("quoteItems.0.descriptionEn", "Med-ical disin.fection service");

    const result = await updateQuoteDraftAction(idle, data);

    expect(result).toMatchObject({
      status: "ERROR",
      message: requestQuoteContent.en.common.invalid,
    });
    expect(doubles.service.updateQuoteDraft).not.toHaveBeenCalled();
  });

  it.each([
    ["quoteItems.0.descriptionEn", "The treatment is anti bacterial."],
    ["quoteItems.0.descriptionBg", "Предлагаме анти-бактериална обработка."],
    ["customerNotes", "This method is clinically.proven."],
    ["additionalAssumptions", "The equipment is made\u200Bin\u200Bthe\u200BUK."],
    ["quoteItems.0.descriptionEn", "The treatment is anti\u034Fbacterial."],
    ["quoteItems.0.descriptionBg", "Процесът е 100\u066A устойчив."],
    ["customerNotes", "This method is clin\u202Fically pro\u202Fven."],
    ["additionalAssumptions", "The result is guar\u202Fanteed."],
    ["quoteItems.0.descriptionEn", "The treatment is anti\u0301bacterial."],
    ["customerNotes", "The treatment is anti™bacterial."],
    ["quoteItems.0.descriptionEn", "The service is med\u0456cal."],
    ["quoteItems.0.descriptionBg", "Резултатът е гaрантиран."],
    ["customerNotes", "Manufacturer appr\u03CCved treatment."],
    ["additionalAssumptions", "The result guarantees removal."],
    ["customerNotes", "Access\u202E remains subject to confirmation."],
  ] as const)(
    "applies the canonical claim boundary to %s",
    async (field, unsupportedClaim) => {
      const data = quoteForm();
      data.set(field, unsupportedClaim);

      const result = await createQuoteDraftAction(idle, data);

      expect(result).toMatchObject({
        status: "ERROR",
        message: requestQuoteContent.en.common.invalid,
      });
      expect(doubles.service.createQuoteDraft).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["quoteItems.0.descriptionEn", 2_000],
    ["quoteItems.0.descriptionBg", 2_000],
    ["customerNotes", 4_000],
    ["additionalAssumptions", 4_000],
  ] as const)(
    "rejects %s before customer-visible claim comparison when oversized",
    async (field, maximum) => {
      const data = quoteForm();
      data.set(field, "x".repeat(maximum + 1));

      const result = await createQuoteDraftAction(idle, data);

      expect(result).toMatchObject({
        status: "ERROR",
        message: requestQuoteContent.en.common.invalid,
      });
      expect(doubles.service.createQuoteDraft).not.toHaveBeenCalled();
    },
  );

  it("uses normalized comparison only and preserves accepted quote text exactly", async () => {
    const data = quoteForm();
    const descriptionBg = "Пране на диван — вход ①.";
    const descriptionEn = "Sofa cleaning — entrance ①.";
    const customerNotes = "Call on arrival (entrance ①).";
    const additionalAssumptions = "Lift / parking: subject to confirmation.";
    data.set("quoteItems.0.descriptionBg", descriptionBg);
    data.set("quoteItems.0.descriptionEn", descriptionEn);
    data.set("customerNotes", customerNotes);
    data.set("additionalAssumptions", additionalAssumptions);

    await createQuoteDraftAction(idle, data);

    const command = doubles.service.createQuoteDraft.mock.calls[0]![1];
    expect(command.items[0]).toMatchObject({ descriptionBg, descriptionEn });
    expect(command.customerNotes).toBe(customerNotes);
    expect(command.termsSnapshot).toMatchObject({ additionalAssumptions });
  });
});
