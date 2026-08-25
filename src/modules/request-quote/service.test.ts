import { describe, expect, it, vi } from "vitest";
import { rolePermissionMatrix } from "@/modules/identity-access/policy";

vi.mock("server-only", () => ({}));

import type { RequestQuoteActor } from "./policy";
import type { RequestQuoteRepository } from "./repository";
import { createRequestQuoteService, RequestQuoteServiceError } from "./service";

const staffProfileId = "10000000-0000-4000-8000-000000000001";
const customerProfileId = "10000000-0000-4000-8000-000000000002";
const requestId = "20000000-0000-4000-8000-000000000001";
const customerId = "30000000-0000-4000-8000-000000000001";
const itemId = "60000000-0000-4000-8000-000000000001";
const estimateId = "70000000-0000-4000-8000-000000000001";
const quoteId = "80000000-0000-4000-8000-000000000001";

function actor(
  role: "OWNER" | "CUSTOMER",
  profileId: string,
): RequestQuoteActor {
  return {
    profileId,
    status: "ACTIVE",
    roles: new Set([role]),
    permissions: new Set(rolePermissionMatrix[role]),
  };
}

function doubles() {
  return {
    createPublicCodeRequest: vi.fn(async () => ({
      status: "CREATED" as const,
      requestReference: "REQ-000000000000000000000001",
      version: 1,
    })),
    createCustomerRequest: vi.fn(async () => ({ status: "CONFLICT" as const })),
    createStaffRequest: vi.fn(async () => ({ status: "CONFLICT" as const })),
    listStaffRequests: vi.fn(async (_actorProfileId, input) => ({
      items: [],
      total: 0,
      limit: input.limit,
      offset: input.offset,
    })),
    getStaffRequest: vi.fn(async () => null),
    listCustomerRequests: vi.fn(async () => []),
    getCustomerRequest: vi.fn(async () => null),
    listCustomerQuotes: vi.fn(async () => []),
    getCustomerQuote: vi.fn(async () => null),
    linkRequest: vi.fn(async () => ({
      status: "NOT_FOUND_OR_FORBIDDEN" as const,
    })),
    setRequestResolution: vi.fn(async () => ({
      status: "CHANGED" as const,
      id: requestId,
      version: 2,
      updatedAt: new Date(),
    })),
    createCustomerFromRequest: vi.fn(async () => ({
      status: "NOT_FOUND_OR_FORBIDDEN" as const,
    })),
    normalizeRequest: vi.fn(async () => ({
      status: "NOT_FOUND_OR_FORBIDDEN" as const,
    })),
    transitionRequest: vi.fn(async () => ({
      status: "CHANGED" as const,
      id: requestId,
      version: 2,
      updatedAt: new Date(),
    })),
    deriveEstimateEngineInput: vi.fn(async () => ({
      status: "READY" as const,
      engineInput: {
        customerSegment: "RESIDENTIAL" as const,
        items: [
          {
            serviceCode: "UPHOLSTERY_CARE" as const,
            itemTypeCode: "SOFA_2_SEAT" as const,
            quantity: 1,
            issueCodes: [],
            addonCodes: [],
            riskFlagCodes: [],
          },
        ],
        conditionBandCode: "NORMAL" as const,
        travelZoneCode: "SOFIA_CORE" as const,
        timingCategoryCode: "STANDARD" as const,
        governanceReviewReasonCodes: [],
      },
    })),
    appendEstimate: vi.fn<RequestQuoteRepository["appendEstimate"]>(async () => ({
      status: "CREATED" as const,
      id: estimateId,
      estimateVersion: 1,
      requestVersion: 5,
    })),
    createQuoteDraft: vi.fn(async () => ({ status: "CONFLICT" as const })),
    updateQuoteDraft: vi.fn(async () => ({ status: "CONFLICT" as const })),
    issueQuote: vi.fn(async () => ({ status: "CONFLICT" as const })),
    withdrawQuote: vi.fn(async () => ({ status: "CONFLICT" as const })),
    expireQuote: vi.fn(async () => ({ status: "CONFLICT" as const })),
  };
}

function serviceWith(repositoryDoubles = doubles()) {
  return {
    repositoryDoubles,
    service: createRequestQuoteService(
      repositoryDoubles as unknown as RequestQuoteRepository,
    ),
  };
}

const requestItem = {
  serviceId: 10,
  cleaningItemTypeId: 20,
  cleaningAssetId: null,
  measurementModeId: 30,
  customerReportedConditionLevelId: 40,
  normalizedConditionLevelId: null,
  reportedFibreMaterialId: null,
  reportedSurfaceConstructionId: null,
  customerDescription: "Sofa",
  normalizedDescription: null,
  quantity: 1,
  areaHundredthsM2: null,
  seatCount: 2,
  sides: null,
  sortOrder: 0,
  issueTypeIds: [],
  addonIds: [],
};

const quoteCommercial = {
  estimateId,
  currency: "EUR" as const,
  priceBasis: "NET" as const,
  netAmountMinorUnits: 10_000,
  vatRateBasisPoints: 2_000,
  vatAmountMinorUnits: 2_000,
  grossTotalMinorUnits: 12_000,
  estimatedDurationMinutes: 60,
  commercialSnapshot: {},
  termsSnapshot: {},
  validFrom: new Date("2026-08-24T12:00:00.000Z"),
  validUntil: new Date("2026-09-24T12:00:00.000Z"),
  staffNotes: null,
  customerNotes: null,
  items: [
    {
      requestItemId: itemId,
      serviceId: 10,
      cleaningItemTypeId: 20,
      measurementModeId: 30,
      descriptionBg: "Почистване на диван",
      descriptionEn: "Sofa cleaning",
      quantity: 1,
      measurementSnapshot: {},
      baseAmountMinorUnits: 10_000,
      modifierAmountMinorUnits: 0,
      addonAmountMinorUnits: 0,
      netAmountMinorUnits: 10_000,
      vatRateBasisPoints: 2_000,
      vatAmountMinorUnits: 2_000,
      grossTotalMinorUnits: 12_000,
      calculationSnapshot: {},
      sortOrder: 0,
    },
  ],
};

function expectServiceFailure(
  operation: Promise<unknown>,
  code: RequestQuoteServiceError["code"],
) {
  return expect(operation).rejects.toMatchObject({
    name: "RequestQuoteServiceError",
    code,
  });
}

describe("request/quote service trust boundaries", () => {
  it("creates an anonymous unresolved request without Auth, CRM or price fields", async () => {
    const { service, repositoryDoubles } = serviceWith();
    const result = await service.createPublicRequest({
      preferredLocale: "en",
      contactName: "Public customer",
      contactEmail: "public@example.invalid",
      contactPhone: null,
      customerNotes: null,
      preferredDate: null,
      preferredWindowCode: null,
      originalSubmission: { requested: ["SOFA_2_SEAT"] },
      itemTypeCodes: ["SOFA_2_SEAT"],
      conditionLevelCode: "NORMAL",
      customerDescription: "Original public description",
    });

    expect(result).toEqual({
      status: "CREATED",
      requestReference: "REQ-000000000000000000000001",
      version: 1,
    });
    expect(repositoryDoubles.createPublicCodeRequest).toHaveBeenCalledWith(
      expect.not.objectContaining({
        customerId: expect.anything(),
        requestingProfileId: expect.anything(),
        price: expect.anything(),
      }),
    );
  });

  it("requires an authenticated customer request to name an authorized property", async () => {
    const { service, repositoryDoubles } = serviceWith();
    await expectServiceFailure(
      service.createCustomerRequest(actor("CUSTOMER", customerProfileId), {
        source: "CUSTOMER_PORTAL",
        customerResolutionStatus: "LINKED",
        customerId,
        requestingProfileId: customerProfileId,
        propertyId: null,
        preferredLocale: "en",
        contactName: "Customer",
        contactEmail: "customer@example.invalid",
        contactPhone: null,
        customerNotes: null,
        preferredDate: null,
        preferredWindowCode: null,
        originalSubmission: {},
        items: [requestItem],
      }),
      "INVALID_REQUEST",
    );
    expect(repositoryDoubles.createCustomerRequest).not.toHaveBeenCalled();
  });

  it("forwards only bounded reference-safe inbox filters", async () => {
    const { service, repositoryDoubles } = serviceWith();
    await service.listRequests(actor("OWNER", staffProfileId), {
      search: "REQ-ABC",
      source: "PUBLIC_WEB",
      manualReviewRequired: true,
      submittedFrom: "2026-08-01T00:00:00.000Z",
      submittedTo: "2026-09-01T00:00:00.000Z",
      limit: 10,
      offset: 0,
    });
    expect(repositoryDoubles.listStaffRequests).toHaveBeenCalledWith(
      staffProfileId,
      expect.objectContaining({
        search: "REQ-ABC",
        source: "PUBLIC_WEB",
        manualReviewRequired: true,
        submittedFrom: new Date("2026-08-01T00:00:00.000Z"),
        submittedTo: new Date("2026-09-01T00:00:00.000Z"),
      }),
    );
  });

  it("rejects customer-reported fields at the staff normalization boundary", async () => {
    const { service, repositoryDoubles } = serviceWith();
    await expectServiceFailure(
      service.normalizeRequest(actor("OWNER", staffProfileId), {
        requestId,
        expectedVersion: 2,
        staffNotes: "Reviewed",
        items: [
          {
            itemId,
            expectedVersion: 1,
            serviceId: 10,
            cleaningItemTypeId: 20,
            cleaningAssetId: null,
            measurementModeId: 30,
            normalizedConditionLevelId: 41,
            normalizedFibreMaterialId: 51,
            normalizedSurfaceConstructionId: 61,
            normalizedDescription: "Staff interpretation",
            quantity: 1,
            areaHundredthsM2: null,
            seatCount: 2,
            sides: null,
            sortOrder: 0,
            issueTypeIds: [],
            addonIds: [],
            customerReportedConditionLevelId: 40,
            reportedFibreMaterialId: 50,
            reportedSurfaceConstructionId: 60,
          },
        ],
      }),
      "INVALID_REQUEST",
    );
    expect(repositoryDoubles.normalizeRequest).not.toHaveBeenCalled();
  });

  it("derives estimate input from persistence and ignores all browser hints", async () => {
    const { service, repositoryDoubles } = serviceWith();
    await service.appendEstimateFromRequest(actor("OWNER", staffProfileId), {
      requestId,
      expectedRequestVersion: 4,
      customerSegment: "B2B",
      conditionBandCode: "INTENSIVE",
      travelZoneCode: "OUTSIDE_SOFIA",
      timingCategoryCode: "URGENT",
    });

    expect(repositoryDoubles.deriveEstimateEngineInput).toHaveBeenCalledWith(
      staffProfileId,
      requestId,
      4,
    );
    expect(repositoryDoubles.appendEstimate).toHaveBeenCalledWith(
      staffProfileId,
      expect.objectContaining({
        requestId,
        expectedRequestVersion: 4,
        engineInput: expect.objectContaining({
          customerSegment: "RESIDENTIAL",
          conditionBandCode: "NORMAL",
          travelZoneCode: "SOFIA_CORE",
          timingCategoryCode: "STANDARD",
        }),
        calculation: expect.objectContaining({ manualReviewRequired: true }),
      }),
    );
  });

  it("rejects caller-supplied engine lines at the strict estimate boundary", async () => {
    const { service, repositoryDoubles } = serviceWith();
    await expectServiceFailure(
      service.appendEstimate(actor("OWNER", staffProfileId), {
        requestId,
        expectedRequestVersion: 4,
        engineInput: { items: [{ serviceCode: "TAMPERED" }] },
      }),
      "INVALID_REQUEST",
    );
    expect(repositoryDoubles.deriveEstimateEngineInput).not.toHaveBeenCalled();
  });

  it("reserves READY_TO_QUOTE to QUOTED for atomic quote issuance", async () => {
    const { service, repositoryDoubles } = serviceWith();
    await expectServiceFailure(
      service.transitionRequest(actor("OWNER", staffProfileId), {
        requestId,
        expectedVersion: 4,
        fromStatus: "READY_TO_QUOTE",
        toStatus: "QUOTED",
      }),
      "INVALID_TRANSITION",
    );
    expect(repositoryDoubles.transitionRequest).not.toHaveBeenCalled();
  });

  it("threads both request and quote optimistic versions through draft updates", async () => {
    const repositoryDoubles = doubles();
    const { service } = serviceWith(repositoryDoubles);
    await expectServiceFailure(
      service.updateQuoteDraft(actor("OWNER", staffProfileId), {
        quoteId,
        expectedRecordVersion: 3,
        expectedRequestVersion: 7,
        ...quoteCommercial,
      }),
      "CONFLICT",
    );
    expect(repositoryDoubles.updateQuoteDraft).toHaveBeenCalledWith(
      staffProfileId,
      expect.objectContaining({
        quoteId,
        expectedRecordVersion: 3,
        expectedRequestVersion: 7,
      }),
    );
  });

  it("maps stale repository writes to one generic conflict", async () => {
    const { service } = serviceWith();
    await expectServiceFailure(
      service.updateQuoteDraft(actor("OWNER", staffProfileId), {
        quoteId,
        expectedRecordVersion: 3,
        expectedRequestVersion: 7,
        ...quoteCommercial,
      }),
      "CONFLICT",
    );
  });

  it("maps estimate and issue semantic-freshness conflicts to one generic conflict", async () => {
    const repositoryDoubles = doubles();
    repositoryDoubles.appendEstimate.mockResolvedValueOnce({
      status: "CONFLICT",
    });
    const { service } = serviceWith(repositoryDoubles);

    await expectServiceFailure(
      service.appendEstimate(actor("OWNER", staffProfileId), {
        requestId,
        expectedRequestVersion: 4,
      }),
      "CONFLICT",
    );
    await expectServiceFailure(
      service.issueQuote(actor("OWNER", staffProfileId), {
        quoteId,
        expectedRecordVersion: 1,
      }),
      "CONFLICT",
    );
  });

  it("does not allow LINKED through the unresolved-resolution command", async () => {
    const { service, repositoryDoubles } = serviceWith();
    await expectServiceFailure(
      service.setRequestResolution(actor("OWNER", staffProfileId), {
        requestId,
        expectedVersion: 1,
        fromStatus: "UNRESOLVED",
        toStatus: "LINKED",
      }),
      "INVALID_REQUEST",
    );
    expect(repositoryDoubles.setRequestResolution).not.toHaveBeenCalled();
  });
});
