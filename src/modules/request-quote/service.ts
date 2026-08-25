import "server-only";

import { z } from "zod";
import {
  commercialConditionBandCodes,
  customerSegments,
  timingCategoryCodes,
  travelZoneCodes,
} from "@/modules/commercial-engine/types";
import {
  cleaningItemTypes as catalogueItemTypes,
  conditionLevels as catalogueConditionLevels,
  fibreMaterials as catalogueFibreMaterials,
  issueTypes as catalogueIssueTypes,
  riskFlags as catalogueRiskFlags,
  serviceAddons as catalogueAddons,
  services as catalogueServices,
  treatmentLevels as catalogueTreatmentLevels,
  type CleaningItemTypeCode,
  type FibreMaterialCode,
  type IssueTypeCode,
  type RiskFlagCode,
  type ServiceAddonCode,
  type ServiceCode,
  type TreatmentLevelCode,
} from "@/modules/service-catalogue/catalogue";
import {
  calculateStaffEstimate,
  estimateGovernanceReviewReasonCodes,
  type EstimateEngineInput,
} from "./estimate";
import {
  assertQuoteStatusTransition,
  assertRequestStatusTransition,
} from "./lifecycle";
import {
  requireCustomerRequestRead,
  requireCustomerRequestUpdate,
  requireStaffRequestManagement,
  requireStaffRequestRead,
  type RequestQuoteActor,
} from "./policy";
import { generateQuoteReference, generateRequestReference } from "./reference";
import type {
  CreatePublicCodeRequestInput,
  CreateCustomerFromRequestInput,
  CreateQuoteDraftInput,
  CreateRequestRecordInput,
  NormalizeRequestInput,
  QuoteCommercialInput,
  QuoteLifecycleInput,
  QuoteMutationResult,
  RequestCreateResult,
  RequestMutationResult,
  RequestQuoteRepository,
  SetRequestResolutionInput,
  TransitionRequestInput,
  UpdateQuoteDraftInput,
} from "./repository";
import type { JsonObject } from "./types";
import {
  createQuoteDraftInputSchema,
  createServiceRequestInputSchema,
  normalizeRequestItemInputSchema,
  quoteLineInputSchema,
} from "./validation";

const uuid = z.uuid();
const positiveVersion = z.number().int().positive();
const requestReferenceSchema = z.string().regex(/^REQ-[A-F0-9]{24}$/);
const quoteReferenceSchema = z.string().regex(/^Q-[A-F0-9]{24}$/);

function enumFromCodes<Code extends string>(
  definitions: readonly Readonly<{ code: Code }>[],
): z.ZodEnum<{ [Key in Code]: Key }> {
  return z.enum(
    definitions.map((definition) => definition.code) as [Code, ...Code[]],
  ) as z.ZodEnum<{ [Key in Code]: Key }>;
}

const serviceCodeSchema = enumFromCodes<ServiceCode>(catalogueServices);
const itemTypeCodeSchema =
  enumFromCodes<CleaningItemTypeCode>(catalogueItemTypes);
const issueCodeSchema = enumFromCodes<IssueTypeCode>(catalogueIssueTypes);
const addonCodeSchema = enumFromCodes<ServiceAddonCode>(catalogueAddons);
const riskFlagCodeSchema = enumFromCodes<RiskFlagCode>(catalogueRiskFlags);
const fibreMaterialCodeSchema = enumFromCodes<FibreMaterialCode>(
  catalogueFibreMaterials,
);
const treatmentLevelCodeSchema = enumFromCodes<TreatmentLevelCode>(
  catalogueTreatmentLevels,
);

const jsonObjectSchema = z
  .record(z.string().max(128), z.json())
  .refine(
    (value) =>
      new TextEncoder().encode(JSON.stringify(value)).byteLength <= 24_000,
    "Snapshot is too large.",
  );

const staffListSchema = z
  .object({
    search: z.string().trim().max(160).optional(),
    status: z
      .enum([
        "SUBMITTED",
        "IN_REVIEW",
        "NEEDS_REVIEW",
        "READY_TO_QUOTE",
        "QUOTED",
        "CLOSED",
        "DECLINED",
      ])
      .optional(),
    source: z
      .enum(["PUBLIC_WEB", "CUSTOMER_PORTAL", "STAFF_CREATED"])
      .optional(),
    resolutionStatus: z
      .enum([
        "UNRESOLVED",
        "MATCH_CANDIDATE",
        "LINKED",
        "NEW_CUSTOMER_REQUIRED",
      ])
      .optional(),
    manualReviewRequired: z.boolean().optional(),
    submittedFrom: z.coerce.date().optional(),
    submittedTo: z.coerce.date().optional(),
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).max(100_000).default(0),
  })
  .strict();

const publicCodeRequestSchema = z
  .object({
    preferredLocale: z.enum(["bg", "en"]),
    contactName: z.string().trim().min(1).max(160),
    contactEmail: z.string().trim().email().max(254).nullable(),
    contactPhone: z
      .string()
      .trim()
      .min(6)
      .max(40)
      .regex(/^[+()\d\s.-]+$/)
      .nullable(),
    customerNotes: z.string().trim().max(4_000).nullable(),
    preferredDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    preferredWindowCode: z.string().trim().min(1).max(64).nullable(),
    originalSubmission: jsonObjectSchema,
    itemTypeCodes: z
      .array(itemTypeCodeSchema)
      .min(1)
      .max(catalogueItemTypes.length)
      .refine((codes) => new Set(codes).size === codes.length),
    conditionLevelCode: enumFromCodes(catalogueConditionLevels),
    customerDescription: z.string().trim().min(1).max(1_800),
  })
  .strict()
  .refine((value) => value.contactEmail || value.contactPhone, {
    path: ["contactEmail"],
    message: "A contact channel is required.",
  });

const linkRequestSchema = z
  .object({
    requestId: uuid,
    expectedVersion: positiveVersion,
    customerId: uuid,
    propertyId: uuid.nullable(),
  })
  .strict();

const unresolvedResolutionSchema = z.enum([
  "UNRESOLVED",
  "MATCH_CANDIDATE",
  "NEW_CUSTOMER_REQUIRED",
]);

const setRequestResolutionSchema = z
  .object({
    requestId: uuid,
    expectedVersion: positiveVersion,
    fromStatus: unresolvedResolutionSchema,
    toStatus: unresolvedResolutionSchema,
  })
  .strict();

const createCustomerFromRequestSchema = z
  .object({
    requestId: uuid,
    expectedVersion: positiveVersion,
    customerType: z.enum(["INDIVIDUAL", "BUSINESS"]),
    displayName: z.string().trim().min(1).max(160),
    legalName: z.string().trim().min(1).max(255).nullable(),
    internalNotes: z.string().trim().min(1).max(4_000).nullable(),
    property: z
      .object({
        propertyType: z.enum([
          "RESIDENTIAL",
          "OFFICE",
          "HOTEL_GUEST_ACCOMMODATION",
          "SERVICED_APARTMENT",
          "RESTAURANT_CAFE",
          "COMMERCIAL_PUBLIC",
          "OTHER",
        ]),
        label: z.string().trim().min(1).max(160),
        city: z.string().trim().min(1).max(160),
        district: z.string().trim().min(1).max(160).nullable(),
        streetAddress: z.string().trim().min(1).max(2_000),
        postalCode: z.string().trim().min(1).max(20).nullable(),
        serviceZoneId: z.number().int().positive().nullable().default(null),
      })
      .strict()
      .nullable(),
  })
  .strict();

const transitionRequestSchema = z
  .object({
    requestId: uuid,
    expectedVersion: positiveVersion,
    fromStatus: z.enum([
      "SUBMITTED",
      "IN_REVIEW",
      "NEEDS_REVIEW",
      "READY_TO_QUOTE",
      "QUOTED",
      "CLOSED",
      "DECLINED",
    ]),
    toStatus: z.enum([
      "SUBMITTED",
      "IN_REVIEW",
      "NEEDS_REVIEW",
      "READY_TO_QUOTE",
      "QUOTED",
      "CLOSED",
      "DECLINED",
    ]),
  })
  .strict();

const normalizeRequestSchema = z
  .object({
    requestId: uuid,
    expectedVersion: positiveVersion,
    staffNotes: z.string().trim().max(4_000).nullable(),
    items: z
      .array(
        normalizeRequestItemInputSchema
          .extend({ itemId: uuid, expectedVersion: positiveVersion })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();

const engineLineSchema = z
  .object({
    serviceCode: serviceCodeSchema,
    itemTypeCode: itemTypeCodeSchema,
    quantity: z.number().int().positive().max(100_000),
    areaHundredthsM2: z.number().int().positive().max(100_000_000).optional(),
    seatCount: z.number().int().positive().max(10_000).optional(),
    sides: z.union([z.literal(1), z.literal(2)]).optional(),
    issueCodes: z.array(issueCodeSchema).max(100),
    addonCodes: z.array(addonCodeSchema).max(100),
    riskFlagCodes: z.array(riskFlagCodeSchema).max(100),
    fibreMaterialCode: fibreMaterialCodeSchema.optional(),
    treatmentLevelCode: treatmentLevelCodeSchema.optional(),
  })
  .strict();

const engineInputSchema = z
  .object({
    customerSegment: z.enum(customerSegments),
    items: z.array(engineLineSchema).min(1).max(50),
    conditionBandCode: z.enum(commercialConditionBandCodes),
    travelZoneCode: z.enum(travelZoneCodes),
    timingCategoryCode: z.enum(timingCategoryCodes),
    governanceReviewReasonCodes: z
      .array(z.enum(estimateGovernanceReviewReasonCodes))
      .max(10),
  })
  .strict();

const appendEstimateSchema = z
  .object({
    requestId: uuid,
    expectedRequestVersion: positiveVersion,
  })
  .strict();

const appendEstimateFromRequestSchema = appendEstimateSchema
  .extend({
    // UI hints are accepted for progressive enhancement only. The server
    // derives all authoritative values from persisted normalized records.
    customerSegment: z.enum(customerSegments).optional(),
    conditionBandCode: z.enum(commercialConditionBandCodes).optional(),
    travelZoneCode: z.enum(travelZoneCodes).optional(),
    timingCategoryCode: z.enum(timingCategoryCodes).optional(),
  })
  .strict();

// Zod v4 intentionally rejects omit/extend on an object with refinements.
// Select the shared field schemas explicitly, then reapply the aggregate quote
// invariants to each command boundary.
const quoteDraftShape = createQuoteDraftInputSchema.shape;
const quoteCommercialCommandBaseSchema = z
  .object({
    estimateId: quoteDraftShape.estimateId,
    currency: quoteDraftShape.currency,
    priceBasis: quoteDraftShape.priceBasis,
    netAmountMinorUnits: quoteDraftShape.netAmountMinorUnits,
    vatRateBasisPoints: quoteDraftShape.vatRateBasisPoints,
    vatAmountMinorUnits: quoteDraftShape.vatAmountMinorUnits,
    grossTotalMinorUnits: quoteDraftShape.grossTotalMinorUnits,
    estimatedDurationMinutes: quoteDraftShape.estimatedDurationMinutes,
    commercialSnapshot: quoteDraftShape.commercialSnapshot,
    termsSnapshot: quoteDraftShape.termsSnapshot,
    validFrom: quoteDraftShape.validFrom,
    validUntil: quoteDraftShape.validUntil,
    staffNotes: quoteDraftShape.staffNotes,
    customerNotes: quoteDraftShape.customerNotes,
    items: quoteDraftShape.items,
  })
  .strict();

function validateQuoteCommercialCommand(
  value: z.infer<typeof quoteCommercialCommandBaseSchema>,
  context: z.RefinementCtx,
) {
  if (
    value.grossTotalMinorUnits !==
    value.netAmountMinorUnits + value.vatAmountMinorUnits
  ) {
    context.addIssue({
      code: "custom",
      message: "Quote gross must equal net plus VAT.",
      path: ["grossTotalMinorUnits"],
    });
  }
  if (value.validUntil <= value.validFrom) {
    context.addIssue({
      code: "custom",
      message: "Quote validity must end after it starts.",
      path: ["validUntil"],
    });
  }
  if (
    new Set(value.items.map((item) => item.sortOrder)).size !==
    value.items.length
  ) {
    context.addIssue({
      code: "custom",
      message: "Quote item sort orders must be unique.",
      path: ["items"],
    });
  }
}

const createQuoteCommandSchema = quoteCommercialCommandBaseSchema
  .extend({
    requestId: quoteDraftShape.requestId,
    expectedRequestVersion: positiveVersion,
  })
  .strict()
  .superRefine(validateQuoteCommercialCommand);

const updateQuoteCommandSchema = quoteCommercialCommandBaseSchema
  .extend({
    quoteId: uuid,
    expectedRecordVersion: positiveVersion,
    expectedRequestVersion: positiveVersion,
  })
  .strict()
  .superRefine(validateQuoteCommercialCommand);

const quoteLifecycleSchema = z
  .object({ quoteId: uuid, expectedRecordVersion: positiveVersion })
  .strict();

export type RequestQuoteServiceFailureCode =
  | "INVALID_REQUEST"
  | "RECORD_NOT_FOUND_OR_FORBIDDEN"
  | "INVALID_REFERENCE"
  | "INVALID_TRANSITION"
  | "CONFLICT"
  | "OPERATION_FAILED";

export class RequestQuoteServiceError extends Error {
  readonly code: RequestQuoteServiceFailureCode;

  constructor(code: RequestQuoteServiceFailureCode) {
    super(code);
    this.name = "RequestQuoteServiceError";
    this.code = code;
  }
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new RequestQuoteServiceError("INVALID_REQUEST");
  return parsed.data;
}

async function repositoryOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new RequestQuoteServiceError("OPERATION_FAILED");
  }
}

function jsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function requireRequestCreated(result: RequestCreateResult) {
  switch (result.status) {
    case "CREATED":
      return result;
    case "CONFLICT":
      throw new RequestQuoteServiceError("CONFLICT");
    case "INVALID_REFERENCE":
      throw new RequestQuoteServiceError("INVALID_REFERENCE");
    case "NOT_FOUND_OR_FORBIDDEN":
      throw new RequestQuoteServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
  }
}

function requireRequestMutation(result: RequestMutationResult) {
  switch (result.status) {
    case "CHANGED":
    case "NO_CHANGE":
      return result;
    case "CONFLICT":
      throw new RequestQuoteServiceError("CONFLICT");
    case "INVALID_REFERENCE":
      throw new RequestQuoteServiceError("INVALID_REFERENCE");
    case "INVALID_TRANSITION":
      throw new RequestQuoteServiceError("INVALID_TRANSITION");
    case "NOT_FOUND_OR_FORBIDDEN":
      throw new RequestQuoteServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
  }
}

function requireQuoteMutation(result: QuoteMutationResult) {
  switch (result.status) {
    case "CREATED":
    case "CHANGED":
    case "NO_CHANGE":
      return result;
    case "CONFLICT":
      throw new RequestQuoteServiceError("CONFLICT");
    case "INVALID_REFERENCE":
      throw new RequestQuoteServiceError("INVALID_REFERENCE");
    case "INVALID_TRANSITION":
      throw new RequestQuoteServiceError("INVALID_TRANSITION");
    case "NOT_FOUND_OR_FORBIDDEN":
      throw new RequestQuoteServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
  }
}

function requestRecordInput(
  parsed: z.output<typeof createServiceRequestInputSchema>,
  requestReference: string,
): CreateRequestRecordInput {
  return {
    requestReference,
    source: parsed.source,
    customerId: parsed.customerId,
    requestingProfileId: parsed.requestingProfileId,
    propertyId: parsed.propertyId,
    preferredLocale: parsed.preferredLocale,
    contactName: parsed.contactName,
    contactEmail: parsed.contactEmail,
    contactPhone: parsed.contactPhone,
    customerNotes: parsed.customerNotes,
    preferredDate: parsed.preferredDate,
    preferredWindowCode: parsed.preferredWindowCode,
    originalSubmission: parsed.originalSubmission,
    items: parsed.items.map((item) => ({
      ...item,
      normalizedConditionLevelId: null,
      normalizedDescription: null,
    })),
  };
}

function repositoryCreateInput(record: CreateRequestRecordInput) {
  const { source, requestingProfileId, ...repositoryInput } = record;
  void source;
  void requestingProfileId;
  return repositoryInput;
}

async function createWithUniqueReference(
  operation: (requestReference: string) => Promise<RequestCreateResult>,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await repositoryOperation(() =>
      operation(generateRequestReference()),
    );
    if (result.status !== "CONFLICT") return requireRequestCreated(result);
  }
  throw new RequestQuoteServiceError("CONFLICT");
}

async function appendPersistedEstimate(
  repository: RequestQuoteRepository,
  actorProfileId: string,
  parsed: z.output<typeof appendEstimateSchema>,
) {
  const derived = await repositoryOperation(() =>
    repository.deriveEstimateEngineInput(
      actorProfileId,
      parsed.requestId,
      parsed.expectedRequestVersion,
    ),
  );
  if (derived.status === "CONFLICT") {
    throw new RequestQuoteServiceError("CONFLICT");
  }
  if (derived.status === "INVALID_REFERENCE") {
    throw new RequestQuoteServiceError("INVALID_REFERENCE");
  }
  if (derived.status === "NOT_FOUND_OR_FORBIDDEN") {
    throw new RequestQuoteServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
  }
  const engineInput = parseInput(engineInputSchema, derived.engineInput);
  let calculation;
  try {
    calculation = calculateStaffEstimate(
      engineInput as EstimateEngineInput,
      new Date().toISOString(),
    );
  } catch {
    throw new RequestQuoteServiceError("INVALID_REQUEST");
  }
  const result = await repositoryOperation(() =>
    repository.appendEstimate(actorProfileId, {
      requestId: parsed.requestId,
      expectedRequestVersion: parsed.expectedRequestVersion,
      engineInput: jsonObject(engineInput),
      calculation,
    }),
  );
  switch (result.status) {
    case "CREATED":
      return result;
    case "CONFLICT":
      throw new RequestQuoteServiceError("CONFLICT");
    case "INVALID_REFERENCE":
      throw new RequestQuoteServiceError("INVALID_REFERENCE");
    case "NOT_FOUND_OR_FORBIDDEN":
      throw new RequestQuoteServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
  }
}

export function createRequestQuoteService(repository: RequestQuoteRepository) {
  return {
    async createPublicRequest(input: unknown) {
      const parsed = parseInput(publicCodeRequestSchema, input);
      return createWithUniqueReference((requestReference) =>
        repository.createPublicCodeRequest({
          ...parsed,
          originalSubmission: parsed.originalSubmission as JsonObject,
          requestReference,
        } as CreatePublicCodeRequestInput),
      );
    },

    async createCustomerRequest(
      actor: RequestQuoteActor | null,
      input: unknown,
    ) {
      requireCustomerRequestUpdate(actor);
      const parsed = parseInput(createServiceRequestInputSchema, input);
      if (
        parsed.source !== "CUSTOMER_PORTAL" ||
        parsed.customerResolutionStatus !== "LINKED" ||
        parsed.requestingProfileId !== actor!.profileId ||
        parsed.propertyId === null
      ) {
        throw new RequestQuoteServiceError("INVALID_REQUEST");
      }
      return createWithUniqueReference((requestReference) => {
        const record = requestRecordInput(parsed, requestReference);
        return repository.createCustomerRequest(
          actor!.profileId,
          repositoryCreateInput(record),
        );
      });
    },

    async createStaffRequest(actor: RequestQuoteActor | null, input: unknown) {
      requireStaffRequestManagement(actor);
      const parsed = parseInput(createServiceRequestInputSchema, input);
      if (
        parsed.source !== "STAFF_CREATED" ||
        parsed.customerResolutionStatus !== "LINKED" ||
        parsed.requestingProfileId !== null
      ) {
        throw new RequestQuoteServiceError("INVALID_REQUEST");
      }
      return createWithUniqueReference((requestReference) => {
        const record = requestRecordInput(parsed, requestReference);
        return repository.createStaffRequest(
          actor!.profileId,
          repositoryCreateInput(record),
        );
      });
    },

    async listRequests(actor: RequestQuoteActor | null, input: unknown = {}) {
      requireStaffRequestRead(actor);
      const parsed = parseInput(staffListSchema, input);
      return repositoryOperation(() =>
        repository.listStaffRequests(actor!.profileId, parsed),
      );
    },

    async getRequest(actor: RequestQuoteActor | null, input: unknown) {
      requireStaffRequestRead(actor);
      const requestId = parseInput(
        z.object({ requestId: uuid }).strict(),
        input,
      ).requestId;
      const request = await repositoryOperation(() =>
        repository.getStaffRequest(actor!.profileId, requestId),
      );
      if (!request) {
        throw new RequestQuoteServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
      }
      return request;
    },

    async listMyRequests(actor: RequestQuoteActor | null) {
      requireCustomerRequestRead(actor);
      return repositoryOperation(() =>
        repository.listCustomerRequests(actor!.profileId),
      );
    },

    async getMyRequest(actor: RequestQuoteActor | null, input: unknown) {
      requireCustomerRequestRead(actor);
      const { requestReference } = parseInput(
        z.object({ requestReference: requestReferenceSchema }).strict(),
        input,
      );
      const request = await repositoryOperation(() =>
        repository.getCustomerRequest(actor!.profileId, requestReference),
      );
      if (!request) {
        throw new RequestQuoteServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
      }
      return request;
    },

    async listMyQuotes(actor: RequestQuoteActor | null) {
      requireCustomerRequestRead(actor);
      return repositoryOperation(() =>
        repository.listCustomerQuotes(actor!.profileId),
      );
    },

    async getMyQuote(actor: RequestQuoteActor | null, input: unknown) {
      requireCustomerRequestRead(actor);
      const { quoteReference } = parseInput(
        z.object({ quoteReference: quoteReferenceSchema }).strict(),
        input,
      );
      const quote = await repositoryOperation(() =>
        repository.getCustomerQuote(actor!.profileId, quoteReference),
      );
      if (!quote) {
        throw new RequestQuoteServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
      }
      return quote;
    },

    async linkRequest(actor: RequestQuoteActor | null, input: unknown) {
      requireStaffRequestManagement(actor);
      const parsed = parseInput(linkRequestSchema, input);
      return requireRequestMutation(
        await repositoryOperation(() =>
          repository.linkRequest(actor!.profileId, parsed),
        ),
      );
    },

    async setRequestResolution(
      actor: RequestQuoteActor | null,
      input: unknown,
    ) {
      requireStaffRequestManagement(actor);
      const parsed = parseInput(setRequestResolutionSchema, input);
      return requireRequestMutation(
        await repositoryOperation(() =>
          repository.setRequestResolution(
            actor!.profileId,
            parsed as SetRequestResolutionInput,
          ),
        ),
      );
    },

    async createCustomerFromRequest(
      actor: RequestQuoteActor | null,
      input: unknown,
    ) {
      requireStaffRequestManagement(actor);
      const parsed = parseInput(createCustomerFromRequestSchema, input);
      return requireRequestMutation(
        await repositoryOperation(() =>
          repository.createCustomerFromRequest(
            actor!.profileId,
            parsed as CreateCustomerFromRequestInput,
          ),
        ),
      );
    },

    async normalizeRequest(actor: RequestQuoteActor | null, input: unknown) {
      requireStaffRequestManagement(actor);
      const parsed = parseInput(normalizeRequestSchema, input);
      return requireRequestMutation(
        await repositoryOperation(() =>
          repository.normalizeRequest(
            actor!.profileId,
            parsed as NormalizeRequestInput,
          ),
        ),
      );
    },

    async transitionRequest(actor: RequestQuoteActor | null, input: unknown) {
      requireStaffRequestManagement(actor);
      const parsed = parseInput(transitionRequestSchema, input);
      try {
        assertRequestStatusTransition(parsed.fromStatus, parsed.toStatus);
      } catch {
        throw new RequestQuoteServiceError("INVALID_TRANSITION");
      }
      return requireRequestMutation(
        await repositoryOperation(() =>
          repository.transitionRequest(
            actor!.profileId,
            parsed as TransitionRequestInput,
          ),
        ),
      );
    },

    async appendEstimate(actor: RequestQuoteActor | null, input: unknown) {
      requireStaffRequestManagement(actor);
      const parsed = parseInput(appendEstimateSchema, input);
      return appendPersistedEstimate(repository, actor!.profileId, parsed);
    },

    async appendEstimateFromRequest(
      actor: RequestQuoteActor | null,
      input: unknown,
    ) {
      requireStaffRequestManagement(actor);
      const parsed = parseInput(appendEstimateFromRequestSchema, input);
      return appendPersistedEstimate(repository, actor!.profileId, {
        requestId: parsed.requestId,
        expectedRequestVersion: parsed.expectedRequestVersion,
      });
    },

    async createQuoteDraft(actor: RequestQuoteActor | null, input: unknown) {
      requireStaffRequestManagement(actor);
      const parsed = parseInput(createQuoteCommandSchema, input);
      const commercial: QuoteCommercialInput = {
        ...parsed,
        commercialSnapshot: parsed.commercialSnapshot,
        termsSnapshot: parsed.termsSnapshot,
        items: parsed.items,
      };
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const result = await repositoryOperation(() =>
          repository.createQuoteDraft(actor!.profileId, {
            ...commercial,
            requestId: parsed.requestId,
            expectedRequestVersion: parsed.expectedRequestVersion,
            quoteReference: generateQuoteReference(),
          } as CreateQuoteDraftInput),
        );
        if (result.status !== "CONFLICT") return requireQuoteMutation(result);
      }
      throw new RequestQuoteServiceError("CONFLICT");
    },

    async updateQuoteDraft(actor: RequestQuoteActor | null, input: unknown) {
      requireStaffRequestManagement(actor);
      const parsed = parseInput(updateQuoteCommandSchema, input);
      return requireQuoteMutation(
        await repositoryOperation(() =>
          repository.updateQuoteDraft(
            actor!.profileId,
            parsed as UpdateQuoteDraftInput,
          ),
        ),
      );
    },

    async issueQuote(actor: RequestQuoteActor | null, input: unknown) {
      requireStaffRequestManagement(actor);
      assertQuoteStatusTransition("DRAFT", "ISSUED");
      const parsed = parseInput(quoteLifecycleSchema, input);
      return requireQuoteMutation(
        await repositoryOperation(() =>
          repository.issueQuote(
            actor!.profileId,
            parsed as QuoteLifecycleInput,
          ),
        ),
      );
    },

    async withdrawQuote(actor: RequestQuoteActor | null, input: unknown) {
      requireStaffRequestManagement(actor);
      assertQuoteStatusTransition("ISSUED", "WITHDRAWN");
      const parsed = parseInput(quoteLifecycleSchema, input);
      return requireQuoteMutation(
        await repositoryOperation(() =>
          repository.withdrawQuote(
            actor!.profileId,
            parsed as QuoteLifecycleInput,
          ),
        ),
      );
    },

    async expireQuote(actor: RequestQuoteActor | null, input: unknown) {
      requireStaffRequestManagement(actor);
      assertQuoteStatusTransition("ISSUED", "EXPIRED");
      const parsed = parseInput(quoteLifecycleSchema, input);
      return requireQuoteMutation(
        await repositoryOperation(() =>
          repository.expireQuote(
            actor!.profileId,
            parsed as QuoteLifecycleInput,
          ),
        ),
      );
    },
  };
}

export type RequestQuoteService = ReturnType<typeof createRequestQuoteService>;

// Keep the shared quote-line schema reachable for route action schemas without
// duplicating commercial validation rules.
export { quoteLineInputSchema };
