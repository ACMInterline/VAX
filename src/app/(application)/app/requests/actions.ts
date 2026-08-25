"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserPermission } from "@/auth/authorization-service";
import { isAuthAttemptAllowed } from "@/auth/enforce-rate-limit";
import { AuthenticationBoundaryError } from "@/auth/principal-policy";
import type { RequestQuoteActionState } from "@/components/request-quote/action-state";
import { isCustomerVisibleQuoteTextAllowed } from "@/content/public-site/claims";
import { requestQuoteContent } from "@/content/request-quote";
import { getDatabase } from "@/db/client";
import { AuthorizationError } from "@/modules/identity-access/authorization";
import { RequestQuoteAuthorizationError } from "@/modules/request-quote/policy";
import { createDatabaseRequestQuoteRepository } from "@/modules/request-quote/repository";
import {
  createRequestQuoteService,
  RequestQuoteServiceError,
} from "@/modules/request-quote/service";
import {
  requestStatuses,
  type JsonObject,
  type QuoteLineInput,
  type RequestItemInput,
} from "@/modules/request-quote/types";
import { storedPriceSnapshotSchema } from "@/modules/request-quote/validation";

type Locale = "bg" | "en";
type SubmittedValues = NonNullable<RequestQuoteActionState["values"]>;

const uuid = z.uuid();
const positiveInteger = z.number().int().positive();
const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .nullable()
    .transform((value) => value?.trim() || null);
const email = z.string().trim().email().max(254).nullable();
const phone = z
  .string()
  .trim()
  .min(6)
  .max(40)
  .regex(/^[+()\d\s.-]+$/)
  .nullable();
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  });

const createRequestFormSchema = z
  .object({
    customerId: uuid,
    propertyId: uuid.nullable(),
    cleaningAssetId: uuid.nullable(),
    contactName: z.string().trim().min(1).max(160),
    contactEmail: email,
    contactPhone: phone,
    customerDescription: z.string().trim().min(1).max(2_000),
    quantity: positiveInteger.max(100_000),
    preferredDate: dateOnly.nullable(),
    preferredWindowCode: optionalText(64),
  })
  .strict()
  .refine((value) => value.contactEmail || value.contactPhone, {
    path: ["contactEmail"],
  });

const linkFormSchema = z
  .object({
    requestId: uuid,
    expectedVersion: positiveInteger,
    customerId: uuid,
    propertyId: uuid.nullable(),
  })
  .strict();

const createCustomerFromRequestFormSchema = z
  .object({
    requestId: uuid,
    expectedVersion: positiveInteger,
    customerType: z.enum(["INDIVIDUAL", "BUSINESS"]),
    displayName: z.string().trim().min(1).max(160),
    legalName: optionalText(255),
    internalNotes: optionalText(4_000),
    propertyType: z.enum([
      "RESIDENTIAL",
      "OFFICE",
      "HOTEL_GUEST_ACCOMMODATION",
      "SERVICED_APARTMENT",
      "RESTAURANT_CAFE",
      "COMMERCIAL_PUBLIC",
      "OTHER",
    ]),
    propertyLabel: optionalText(160),
    propertyCity: optionalText(160),
    propertyDistrict: optionalText(160),
    propertyStreetAddress: optionalText(2_000),
    propertyPostalCode: optionalText(20),
    serviceZoneId: z.number().int().positive().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const required = [
      value.propertyLabel,
      value.propertyCity,
      value.propertyStreetAddress,
    ];
    if (required.some(Boolean) && !required.every(Boolean)) {
      context.addIssue({ code: "custom", path: ["propertyLabel"], message: "Incomplete property." });
    }
  });

const transitionFormSchema = z
  .object({
    requestId: uuid,
    expectedVersion: positiveInteger,
    fromStatus: z.enum(requestStatuses),
    toStatus: z.enum(requestStatuses),
  })
  .strict();

const resolutionStatusSchema = z.enum([
  "UNRESOLVED",
  "MATCH_CANDIDATE",
  "NEW_CUSTOMER_REQUIRED",
]);
const requestResolutionFormSchema = z
  .object({
    requestId: uuid,
    expectedVersion: positiveInteger,
    fromStatus: resolutionStatusSchema,
    toStatus: resolutionStatusSchema,
  })
  .strict();

const estimateFormSchema = z
  .object({
    requestId: uuid,
    expectedVersion: positiveInteger,
  })
  .strict();

const quoteLifecycleFormSchema = z
  .object({ quoteId: uuid, expectedRecordVersion: positiveInteger })
  .strict();

const controlledQuoteTerms = {
  schemaVersion: 1,
  templateCode: "VAX_QUOTE_TERMS_PHASE_3D_V1",
  statements: {
    bg: {
      inspection:
        "Офертата подлежи на потвърждение след оглед на място и установяване на действителното състояние и материал.",
      parkingTravel:
        "Паркиране, достъп и пътуване извън приетите допускания могат да изискват отделно потвърждение преди работа.",
      stainRemoval:
        "Обработката на петна се извършва с професионална грижа, но пълното им отстраняване не е гарантирано.",
      dryingReuse:
        "Времето за изсъхване и повторна употреба зависи от материала, средата и резултата от огледа.",
      addons:
        "Допълнителни услуги и добавки са включени само когато са изрично описани в редовете на офертата.",
    },
    en: {
      inspection:
        "The quote remains subject to on-site inspection and confirmation of the actual condition and material.",
      parkingTravel:
        "Parking, access and travel outside the stated assumptions may require separate confirmation before work.",
      stainRemoval:
        "Stain treatment is performed with professional care, but complete removal is not guaranteed.",
      dryingReuse:
        "Drying and reuse timing depends on the material, environment and inspection outcome.",
      addons:
        "Additional services and add-ons are included only when explicitly listed in the quote lines.",
    },
  },
} as const;

function safeOptionalCustomerVisibleText(value: unknown): string | null {
  const parsed = optionalText(4_000).safeParse(
    value === undefined ? null : value,
  );
  if (!parsed.success) {
    throw new RequestQuoteServiceError("INVALID_REQUEST");
  }
  return parsed.data ? safeCustomerVisibleText(parsed.data) : null;
}

function safeCustomerVisibleText(value: string): string {
  if (!isCustomerVisibleQuoteTextAllowed(value)) {
    throw new RequestQuoteServiceError("INVALID_REQUEST");
  }
  return value;
}

function scalar(formData: FormData, name: string): unknown {
  const values = formData.getAll(name);
  if (values.length === 0) return undefined;
  if (values.length !== 1 || typeof values[0] !== "string") return values;
  return values[0];
}

function nullableScalar(formData: FormData, name: string): unknown {
  const value = scalar(formData, name);
  return typeof value === "string" && value.trim() === "" ? null : value;
}

function integer(formData: FormData, name: string, nullable = false): unknown {
  const value = scalar(formData, name);
  if (value === undefined) return undefined;
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  if (normalized === "") return nullable ? null : Number.NaN;
  if (!/^-?\d+$/.test(normalized)) return Number.NaN;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

function integerList(formData: FormData, name: string): number[] {
  return formData.getAll(name).map((value) => {
    if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
      return Number.NaN;
    }
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
  });
}

function submittedValues(
  formData: FormData,
  names: readonly string[],
): SubmittedValues {
  const values: Record<string, string | readonly string[]> = {};
  for (const name of names) {
    const entries = formData
      .getAll(name)
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.slice(0, 8_000));
    if (entries.length === 1) values[name] = entries[0]!;
    if (entries.length > 1) values[name] = entries;
  }
  return values;
}

function actorFromPrincipal(
  principal: Awaited<ReturnType<typeof requireUserPermission>>,
) {
  return {
    profileId: principal.profile.id,
    status: principal.profile.status,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

function service() {
  return createRequestQuoteService(
    createDatabaseRequestQuoteRepository(getDatabase()),
  );
}

function errorState(
  locale: Locale,
  error: unknown,
  values: SubmittedValues,
): RequestQuoteActionState {
  const content = requestQuoteContent[locale].common;
  let message = content.unavailable;
  if (
    error instanceof AuthenticationBoundaryError ||
    error instanceof AuthorizationError ||
    error instanceof RequestQuoteAuthorizationError
  ) {
    message = content.unavailable;
  } else if (error instanceof RequestQuoteServiceError) {
    switch (error.code) {
      case "INVALID_REQUEST":
      case "INVALID_REFERENCE":
      case "INVALID_TRANSITION":
        message = content.invalid;
        break;
      case "CONFLICT":
        message = content.conflict;
        break;
      case "RECORD_NOT_FOUND_OR_FORBIDDEN":
      case "OPERATION_FAILED":
        message = content.unavailable;
        break;
    }
  }
  return Object.keys(values).length > 0
    ? { status: "ERROR", message, values }
    : { status: "ERROR", message };
}

function invalidState(
  locale: Locale,
  values: SubmittedValues,
): RequestQuoteActionState {
  return {
    status: "ERROR",
    message: requestQuoteContent[locale].common.invalid,
    values,
  };
}

function revalidateRequestRoutes(): void {
  revalidatePath("/app/requests");
  revalidatePath("/app/requests/[requestId]", "page");
  revalidatePath("/app/my-requests");
  revalidatePath("/app/my-requests/[requestReference]", "page");
  revalidatePath("/app/my-quotes");
  revalidatePath("/app/my-quotes/[quoteReference]", "page");
}

function parseCreateRequestForm(formData: FormData) {
  return createRequestFormSchema.safeParse({
    customerId: scalar(formData, "customerId"),
    propertyId: nullableScalar(formData, "propertyId"),
    cleaningAssetId: nullableScalar(formData, "cleaningAssetId"),
    contactName: scalar(formData, "contactName"),
    contactEmail: nullableScalar(formData, "contactEmail"),
    contactPhone: nullableScalar(formData, "contactPhone"),
    customerDescription: scalar(formData, "customerDescription"),
    quantity: integer(formData, "quantity"),
    preferredDate: nullableScalar(formData, "preferredDate"),
    preferredWindowCode: nullableScalar(formData, "preferredWindowCode"),
  });
}

const createValueNames = [
  "customerId",
  "propertyId",
  "cleaningAssetId",
  "contactName",
  "contactEmail",
  "contactPhone",
  "customerDescription",
  "quantity",
  "preferredDate",
  "preferredWindowCode",
] as const;

async function createAuthenticatedRequest(
  kind: "customer" | "staff",
  formData: FormData,
): Promise<RequestQuoteActionState> {
  let locale: Locale = "bg";
  let values: SubmittedValues = {};
  try {
    const principal = await requireUserPermission(
      kind === "customer"
        ? "OWN_CUSTOMER_DATA_UPDATE"
        : "CUSTOMER_RECORDS_MANAGE",
    );
    locale = principal.profile.preferredLocale;
    values = submittedValues(formData, createValueNames);
    if (!(await isAuthAttemptAllowed("ADMIN_MUTATION", principal.profile.id))) {
      return errorState(locale, new Error("rate limited"), values);
    }
    const parsed = parseCreateRequestForm(formData);
    if (!parsed.success || (kind === "customer" && !parsed.data.propertyId)) {
      return invalidState(locale, values);
    }
    const requestInput = {
      source: kind === "customer" ? "CUSTOMER_PORTAL" : "STAFF_CREATED",
      customerResolutionStatus: "LINKED" as const,
      customerId: parsed.data.customerId,
      requestingProfileId: kind === "customer" ? principal.profile.id : null,
      propertyId: parsed.data.propertyId,
      preferredLocale: locale,
      contactName: parsed.data.contactName,
      contactEmail: parsed.data.contactEmail,
      contactPhone: parsed.data.contactPhone,
      customerNotes: parsed.data.customerDescription,
      preferredDate: parsed.data.preferredDate,
      preferredWindowCode: parsed.data.preferredWindowCode,
      originalSubmission: {
        schemaVersion: 1,
        channel: kind === "customer" ? "CUSTOMER_PORTAL" : "STAFF_CREATED",
        selectedPropertyId: parsed.data.propertyId,
        selectedCleaningAssetId: parsed.data.cleaningAssetId,
        customerDescription: parsed.data.customerDescription,
        quantity: parsed.data.quantity,
        preferredDate: parsed.data.preferredDate,
        preferredWindowCode: parsed.data.preferredWindowCode,
        selectedExistingAsset: parsed.data.cleaningAssetId !== null,
      } satisfies JsonObject,
      items: [
        {
          serviceId: null,
          cleaningItemTypeId: null,
          cleaningAssetId: parsed.data.cleaningAssetId,
          measurementModeId: null,
          customerReportedConditionLevelId: null,
          reportedFibreMaterialId: null,
          reportedSurfaceConstructionId: null,
          normalizedFibreMaterialId: null,
          normalizedSurfaceConstructionId: null,
          customerDescription: parsed.data.customerDescription,
          normalizedDescription: null,
          quantity: parsed.data.quantity,
          areaHundredthsM2: null,
          seatCount: null,
          sides: null,
          sortOrder: 0,
          issueTypeIds: [],
          addonIds: [],
        },
      ] satisfies readonly RequestItemInput[],
    };
    const result =
      kind === "customer"
        ? await service().createCustomerRequest(
            actorFromPrincipal(principal),
            requestInput,
          )
        : await service().createStaffRequest(
            actorFromPrincipal(principal),
            requestInput,
          );
    revalidateRequestRoutes();
    return {
      status: "SUCCESS",
      message: requestQuoteContent[locale].common.saved,
      requestReference: result.requestReference,
    };
  } catch (error) {
    return errorState(locale, error, values);
  }
}

export async function createCustomerRequestAction(
  _previous: RequestQuoteActionState,
  formData: FormData,
) {
  return createAuthenticatedRequest("customer", formData);
}

export async function createStaffRequestAction(
  _previous: RequestQuoteActionState,
  formData: FormData,
) {
  return createAuthenticatedRequest("staff", formData);
}

type StaffActionOperation = (
  principal: Awaited<ReturnType<typeof requireUserPermission>>,
) => Promise<unknown>;

async function runStaffAction(
  formData: FormData,
  valueNames: readonly string[],
  operation: StaffActionOperation,
): Promise<RequestQuoteActionState> {
  let locale: Locale = "bg";
  let values: SubmittedValues = {};
  try {
    const principal = await requireUserPermission("CUSTOMER_RECORDS_MANAGE");
    locale = principal.profile.preferredLocale;
    values = submittedValues(formData, valueNames);
    if (!(await isAuthAttemptAllowed("ADMIN_MUTATION", principal.profile.id))) {
      return errorState(locale, new Error("rate limited"), values);
    }
    await operation(principal);
    revalidateRequestRoutes();
    return {
      status: "SUCCESS",
      message: requestQuoteContent[locale].common.saved,
    };
  } catch (error) {
    return errorState(locale, error, values);
  }
}

export async function linkRequestAction(
  _previous: RequestQuoteActionState,
  formData: FormData,
) {
  return runStaffAction(
    formData,
    ["requestId", "expectedVersion", "customerId", "propertyId"],
    async (principal) => {
      const parsed = linkFormSchema.safeParse({
        requestId: scalar(formData, "requestId"),
        expectedVersion: integer(formData, "expectedVersion"),
        customerId: scalar(formData, "customerId"),
        propertyId: nullableScalar(formData, "propertyId"),
      });
      if (!parsed.success) throw new RequestQuoteServiceError("INVALID_REQUEST");
      await service().linkRequest(actorFromPrincipal(principal), parsed.data);
    },
  );
}

export async function createCustomerFromRequestAction(
  _previous: RequestQuoteActionState,
  formData: FormData,
) {
  const fields = [
    "requestId",
    "expectedVersion",
    "customerType",
    "displayName",
    "legalName",
    "internalNotes",
    "propertyType",
    "propertyLabel",
    "propertyCity",
    "propertyDistrict",
    "propertyStreetAddress",
    "propertyPostalCode",
    "serviceZoneId",
  ] as const;
  return runStaffAction(formData, fields, async (principal) => {
    const parsed = createCustomerFromRequestFormSchema.safeParse({
      requestId: scalar(formData, "requestId"),
      expectedVersion: integer(formData, "expectedVersion"),
      customerType: scalar(formData, "customerType"),
      displayName: scalar(formData, "displayName"),
      legalName: nullableScalar(formData, "legalName"),
      internalNotes: nullableScalar(formData, "internalNotes"),
      propertyType: scalar(formData, "propertyType"),
      propertyLabel: nullableScalar(formData, "propertyLabel"),
      propertyCity: nullableScalar(formData, "propertyCity"),
      propertyDistrict: nullableScalar(formData, "propertyDistrict"),
      propertyStreetAddress: nullableScalar(
        formData,
        "propertyStreetAddress",
      ),
      propertyPostalCode: nullableScalar(formData, "propertyPostalCode"),
      serviceZoneId: integer(formData, "serviceZoneId", true),
    });
    if (!parsed.success) throw new RequestQuoteServiceError("INVALID_REQUEST");
    const hasProperty = Boolean(parsed.data.propertyLabel);
    await service().createCustomerFromRequest(actorFromPrincipal(principal), {
      requestId: parsed.data.requestId,
      expectedVersion: parsed.data.expectedVersion,
      customerType: parsed.data.customerType,
      displayName: parsed.data.displayName,
      legalName: parsed.data.legalName,
      internalNotes: parsed.data.internalNotes,
      property: hasProperty
        ? {
            propertyType: parsed.data.propertyType,
            label: parsed.data.propertyLabel!,
            city: parsed.data.propertyCity!,
            district: parsed.data.propertyDistrict,
            streetAddress: parsed.data.propertyStreetAddress!,
            postalCode: parsed.data.propertyPostalCode,
            serviceZoneId: parsed.data.serviceZoneId,
          }
        : null,
    });
  });
}

export async function transitionRequestAction(
  _previous: RequestQuoteActionState,
  formData: FormData,
) {
  return runStaffAction(
    formData,
    ["requestId", "expectedVersion", "fromStatus", "toStatus"],
    async (principal) => {
      const parsed = transitionFormSchema.safeParse({
        requestId: scalar(formData, "requestId"),
        expectedVersion: integer(formData, "expectedVersion"),
        fromStatus: scalar(formData, "fromStatus"),
        toStatus: scalar(formData, "toStatus"),
      });
      if (!parsed.success) throw new RequestQuoteServiceError("INVALID_REQUEST");
      await service().transitionRequest(actorFromPrincipal(principal), parsed.data);
    },
  );
}

export async function setRequestResolutionAction(
  _previous: RequestQuoteActionState,
  formData: FormData,
) {
  return runStaffAction(
    formData,
    ["requestId", "expectedVersion", "fromStatus", "toStatus"],
    async (principal) => {
      const parsed = requestResolutionFormSchema.safeParse({
        requestId: scalar(formData, "requestId"),
        expectedVersion: integer(formData, "expectedVersion"),
        fromStatus: scalar(formData, "fromStatus"),
        toStatus: scalar(formData, "toStatus"),
      });
      if (!parsed.success) throw new RequestQuoteServiceError("INVALID_REQUEST");
      await service().setRequestResolution(
        actorFromPrincipal(principal),
        parsed.data,
      );
    },
  );
}

function itemIndexes(formData: FormData): number[] {
  const indexes = new Set<number>();
  for (const key of formData.keys()) {
    const match = /^items\.(\d+)\.itemId$/.exec(key);
    if (match) indexes.add(Number(match[1]));
  }
  const sorted = [...indexes].sort((left, right) => left - right);
  if (
    sorted.length === 0 ||
    sorted.length > 50 ||
    sorted.some((value, index) => value !== index)
  ) {
    throw new RequestQuoteServiceError("INVALID_REQUEST");
  }
  return sorted;
}

function parseNormalizedItems(formData: FormData) {
  return itemIndexes(formData).map((index) => {
    const prefix = `items.${index}`;
    return {
      itemId: scalar(formData, `${prefix}.itemId`),
      expectedVersion: integer(formData, `${prefix}.expectedVersion`),
      serviceId: integer(formData, `${prefix}.serviceId`, true),
      cleaningItemTypeId: integer(
        formData,
        `${prefix}.cleaningItemTypeId`,
        true,
      ),
      cleaningAssetId: nullableScalar(formData, `${prefix}.cleaningAssetId`),
      measurementModeId: integer(
        formData,
        `${prefix}.measurementModeId`,
        true,
      ),
      normalizedConditionLevelId: integer(
        formData,
        `${prefix}.normalizedConditionLevelId`,
        true,
      ),
      normalizedFibreMaterialId: integer(
        formData,
        `${prefix}.normalizedFibreMaterialId`,
        true,
      ),
      normalizedSurfaceConstructionId: integer(
        formData,
        `${prefix}.normalizedSurfaceConstructionId`,
        true,
      ),
      normalizedDescription: nullableScalar(
        formData,
        `${prefix}.normalizedDescription`,
      ),
      quantity: integer(formData, `${prefix}.quantity`),
      areaHundredthsM2: integer(
        formData,
        `${prefix}.areaHundredthsM2`,
        true,
      ),
      seatCount: integer(formData, `${prefix}.seatCount`, true),
      sides: integer(formData, `${prefix}.sides`, true),
      sortOrder: integer(formData, `${prefix}.sortOrder`),
      issueTypeIds: integerList(formData, `${prefix}.issueTypeIds`),
      addonIds: integerList(formData, `${prefix}.addonIds`),
    };
  });
}

export async function normalizeRequestAction(
  _previous: RequestQuoteActionState,
  formData: FormData,
) {
  return runStaffAction(formData, ["requestId", "expectedVersion", "staffNotes"], async (principal) => {
    await service().normalizeRequest(actorFromPrincipal(principal), {
      requestId: scalar(formData, "requestId"),
      expectedVersion: integer(formData, "expectedVersion"),
      staffNotes: nullableScalar(formData, "staffNotes"),
      items: parseNormalizedItems(formData),
    });
  });
}

export async function appendEstimateAction(
  _previous: RequestQuoteActionState,
  formData: FormData,
) {
  return runStaffAction(
    formData,
    [
      "requestId",
      "expectedVersion",
    ],
    async (principal) => {
      const parsed = estimateFormSchema.safeParse({
        requestId: scalar(formData, "requestId"),
        expectedVersion: integer(formData, "expectedVersion"),
      });
      if (!parsed.success) throw new RequestQuoteServiceError("INVALID_REQUEST");
      await service().appendEstimate(actorFromPrincipal(principal), {
        requestId: parsed.data.requestId,
        expectedRequestVersion: parsed.data.expectedVersion,
      });
    },
  );
}

function quoteLineIndexes(formData: FormData): number[] {
  const indexes = new Set<number>();
  for (const key of formData.keys()) {
    const match = /^quoteItems\.(\d+)\.requestItemId$/.exec(key);
    if (match) indexes.add(Number(match[1]));
  }
  const sorted = [...indexes].sort((left, right) => left - right);
  if (
    sorted.length === 0 ||
    sorted.length > 100 ||
    sorted.some((value, index) => value !== index)
  ) {
    throw new RequestQuoteServiceError("INVALID_REQUEST");
  }
  return sorted;
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RequestQuoteServiceError("INVALID_REQUEST");
  }
  return value;
}

function requiredInteger(value: unknown): number {
  if (!Number.isSafeInteger(value)) {
    throw new RequestQuoteServiceError("INVALID_REQUEST");
  }
  return value as number;
}

function requiredBoundedString(value: unknown, maximum: number): string {
  const parsed = requiredString(value).trim();
  if (parsed.length > maximum) {
    throw new RequestQuoteServiceError("INVALID_REQUEST");
  }
  return parsed;
}

type AuthoritativeEstimate = Readonly<{
  id: string;
  estimateVersion: number;
  sourceRequestVersion: number;
  provenance: JsonObject;
}>;

const estimateBaseLineKinds = new Set([
  "BASE_ITEM",
  "PER_AREA_M2",
  "PER_ITEM",
  "PER_SEAT",
]);

function selectAuthoritativeEstimate(
  estimates: readonly Record<string, unknown>[],
  expectedRequestVersion: number,
): AuthoritativeEstimate {
  let selected: Record<string, unknown> | null = null;
  let selectedVersion = 0;
  for (const estimate of estimates) {
    const sourceRequestVersion = requiredInteger(
      estimate.source_request_version,
    );
    const estimateVersion = requiredInteger(estimate.estimate_version);
    if (
      sourceRequestVersion === expectedRequestVersion &&
      estimateVersion > selectedVersion
    ) {
      selected = estimate;
      selectedVersion = estimateVersion;
    }
  }
  if (!selected) throw new RequestQuoteServiceError("INVALID_REFERENCE");

  const id = uuid.safeParse(selected.id);
  const snapshot = storedPriceSnapshotSchema.safeParse(selected.price_snapshot);
  const priceSnapshotSha256 = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .safeParse(selected.price_snapshot_sha256);
  if (
    !id.success ||
    !snapshot.success ||
    !priceSnapshotSha256.success ||
    selected.decline_or_refer_required !== false ||
    selected.price_book_code !== snapshot.data.priceBook.code ||
    selected.price_book_version !== snapshot.data.priceBook.version
  ) {
    throw new RequestQuoteServiceError("INVALID_REFERENCE");
  }

  let baseLinesMinorUnits = 0;
  let modifierLinesMinorUnits = 0;
  let addonLinesMinorUnits = 0;
  for (const line of snapshot.data.result.lines) {
    if (estimateBaseLineKinds.has(line.kind)) {
      baseLinesMinorUnits += line.amountMinorUnits;
    } else if (line.kind === "ADD_ON") {
      addonLinesMinorUnits += line.amountMinorUnits;
    } else {
      modifierLinesMinorUnits += line.amountMinorUnits;
    }
  }
  if (
    !Number.isSafeInteger(baseLinesMinorUnits) ||
    !Number.isSafeInteger(modifierLinesMinorUnits) ||
    !Number.isSafeInteger(addonLinesMinorUnits)
  ) {
    throw new RequestQuoteServiceError("INVALID_REFERENCE");
  }

  const sourceRequestVersion = requiredInteger(
    selected.source_request_version,
  );
  return {
    id: id.data,
    estimateVersion: selectedVersion,
    sourceRequestVersion,
    provenance: {
      schemaVersion: 1,
      estimateId: id.data,
      estimateVersion: selectedVersion,
      sourceRequestVersion,
      priceSnapshotSha256: priceSnapshotSha256.data,
      priceBook: {
        code: snapshot.data.priceBook.code,
        version: snapshot.data.priceBook.version,
      },
      calculatedAt: snapshot.data.calculatedAt,
      aggregateEvidence: {
        allocationScope: "REQUEST_AGGREGATE_NOT_LINE_ALLOCATED",
        baseLinesMinorUnits,
        modifierLinesMinorUnits,
        addonLinesMinorUnits,
        subtotalMinorUnits: snapshot.data.result.subtotalMinorUnits,
        minimumVisitAdjustmentMinorUnits:
          snapshot.data.result.minimumVisitAdjustmentMinorUnits,
        netAmountMinorUnits: snapshot.data.result.netAmountMinorUnits,
        vatRateBasisPoints: snapshot.data.result.vatRateBasisPoints,
        vatAmountMinorUnits: snapshot.data.result.vatAmountMinorUnits,
        grossTotalMinorUnits: snapshot.data.result.grossTotalMinorUnits,
        calculationLineCount: snapshot.data.result.lines.length,
      },
    },
  };
}

function buildQuoteLines(
  formData: FormData,
  requestItems: readonly Record<string, unknown>[],
  authoritativeEstimate: AuthoritativeEstimate,
  reviewedByProfileId: string,
): readonly QuoteLineInput[] {
  const byId = new Map(
    requestItems.map((item) => [requiredString(item.id), item] as const),
  );
  const selected = quoteLineIndexes(formData).map((index) => {
    const prefix = `quoteItems.${index}`;
    const requestItemId = requiredString(scalar(formData, `${prefix}.requestItemId`));
    const persisted = byId.get(requestItemId);
    if (!persisted) throw new RequestQuoteServiceError("INVALID_REFERENCE");
    const netAmountMinorUnits = requiredInteger(
      integer(formData, `${prefix}.netAmountMinorUnits`),
    );
    const vatRateBasisPoints = requiredInteger(
      integer(formData, "vatRateBasisPoints"),
    );
    if (
      netAmountMinorUnits < 0 ||
      netAmountMinorUnits > 2_147_483_647 ||
      vatRateBasisPoints < 0 ||
      vatRateBasisPoints > 10_000
    ) {
      throw new RequestQuoteServiceError("INVALID_REQUEST");
    }
    const vatAmountMinorUnits = Math.round(
      (netAmountMinorUnits * vatRateBasisPoints) / 10_000,
    );
    const manualOverrideReason = requiredBoundedString(
      scalar(formData, `${prefix}.manualOverrideReason`),
      1_000,
    );
    return {
      requestItemId,
      serviceId:
        typeof persisted.serviceId === "number" ? persisted.serviceId : null,
      cleaningItemTypeId:
        typeof persisted.cleaningItemTypeId === "number"
          ? persisted.cleaningItemTypeId
          : null,
      measurementModeId:
        typeof persisted.measurementModeId === "number"
          ? persisted.measurementModeId
          : null,
      descriptionBg: safeCustomerVisibleText(
        requiredBoundedString(
          scalar(formData, `${prefix}.descriptionBg`),
          2_000,
        ),
      ),
      descriptionEn: safeCustomerVisibleText(
        requiredBoundedString(
          scalar(formData, `${prefix}.descriptionEn`),
          2_000,
        ),
      ),
      quantity: requiredInteger(persisted.quantity),
      measurementSnapshot: {
        areaHundredthsM2:
          typeof persisted.areaHundredthsM2 === "number"
            ? persisted.areaHundredthsM2
            : null,
        seatCount:
          typeof persisted.seatCount === "number" ? persisted.seatCount : null,
        sides: typeof persisted.sides === "number" ? persisted.sides : null,
      },
      baseAmountMinorUnits: netAmountMinorUnits,
      modifierAmountMinorUnits: 0,
      addonAmountMinorUnits: 0,
      netAmountMinorUnits,
      vatRateBasisPoints,
      vatAmountMinorUnits,
      grossTotalMinorUnits: netAmountMinorUnits + vatAmountMinorUnits,
      calculationSnapshot: {
        schemaVersion: 1,
        pricingMode: "STAFF_REVIEWED_LUMP_SUM",
        componentAllocation: "NOT_DERIVED_PER_LINE",
        sourceEstimate: authoritativeEstimate.provenance,
        manualOverride: {
          reviewedByProfileId,
          reason: manualOverrideReason,
          reviewedNetAmountMinorUnits: netAmountMinorUnits,
        },
        storedColumnSemantics: {
          baseAmountMinorUnits: "STAFF_REVIEWED_LUMP_SUM",
          modifierAmountMinorUnits: "NOT_SEPARATELY_ALLOCATED",
          addonAmountMinorUnits: "NOT_SEPARATELY_ALLOCATED",
        },
      },
      sortOrder: index,
    } satisfies QuoteLineInput;
  });
  if (selected.length !== requestItems.length || new Set(selected.map((item) => item.requestItemId)).size !== selected.length) {
    throw new RequestQuoteServiceError("INVALID_REQUEST");
  }
  return selected;
}

async function buildQuoteCommercialCommand(
  principal: Awaited<ReturnType<typeof requireUserPermission>>,
  formData: FormData,
) {
  const requestId = uuid.parse(scalar(formData, "requestId"));
  const expectedRequestVersion = positiveInteger.parse(
    integer(formData, "expectedRequestVersion"),
  );
  const validUntilValue = dateOnly.parse(scalar(formData, "validUntil"));
  const validFrom = new Date();
  const validUntil = new Date(`${validUntilValue}T23:59:59.999Z`);
  if (validUntil <= validFrom) {
    throw new RequestQuoteServiceError("INVALID_REQUEST");
  }
  const requestService = service();
  const actor = actorFromPrincipal(principal);
  const request = await requestService.getRequest(actor, { requestId });
  if (request.version !== expectedRequestVersion) {
    throw new RequestQuoteServiceError("CONFLICT");
  }
  const authoritativeEstimate = selectAuthoritativeEstimate(
    request.estimates as readonly Record<string, unknown>[],
    expectedRequestVersion,
  );
  const lines = buildQuoteLines(
    formData,
    request.items as readonly Record<string, unknown>[],
    authoritativeEstimate,
    principal.profile.id,
  );
  const netAmountMinorUnits = lines.reduce(
    (total, line) => total + line.netAmountMinorUnits,
    0,
  );
  const vatAmountMinorUnits = lines.reduce(
    (total, line) => total + line.vatAmountMinorUnits,
    0,
  );
  const grossTotalMinorUnits = netAmountMinorUnits + vatAmountMinorUnits;
  if (grossTotalMinorUnits > 2_147_483_647) {
    throw new RequestQuoteServiceError("INVALID_REQUEST");
  }
  const additionalAssumptions = safeOptionalCustomerVisibleText(
    nullableScalar(formData, "additionalAssumptions"),
  );
  const customerNotes = safeOptionalCustomerVisibleText(
    nullableScalar(formData, "customerNotes"),
  );
  return {
    requestService,
    actor,
    requestId,
    expectedRequestVersion,
    commercial: {
      estimateId: authoritativeEstimate.id,
      currency: "EUR" as const,
      priceBasis: "NET" as const,
      netAmountMinorUnits,
      vatRateBasisPoints: requiredInteger(
        integer(formData, "vatRateBasisPoints"),
      ),
      vatAmountMinorUnits,
      grossTotalMinorUnits,
      estimatedDurationMinutes: integer(
        formData,
        "estimatedDurationMinutes",
        true,
      ),
      commercialSnapshot: {
        schemaVersion: 1,
        pricingMode: "STAFF_REVIEWED_LUMP_SUM",
        sourceEstimate: authoritativeEstimate.provenance,
      },
      termsSnapshot: {
        ...controlledQuoteTerms,
        validFrom: validFrom.toISOString(),
        validUntil: validUntil.toISOString(),
        additionalAssumptions,
      },
      validFrom,
      validUntil,
      staffNotes: nullableScalar(formData, "staffNotes"),
      customerNotes,
      items: lines,
    },
  };
}

export async function createQuoteDraftAction(
  _previous: RequestQuoteActionState,
  formData: FormData,
) {
  return runStaffAction(
    formData,
    [
      "requestId",
      "expectedRequestVersion",
      "validUntil",
      "vatRateBasisPoints",
      "estimatedDurationMinutes",
      "customerNotes",
      "additionalAssumptions",
      "staffNotes",
    ],
    async (principal) => {
      const command = await buildQuoteCommercialCommand(principal, formData);
      await command.requestService.createQuoteDraft(command.actor, {
        requestId: command.requestId,
        expectedRequestVersion: command.expectedRequestVersion,
        ...command.commercial,
      });
    },
  );
}

export async function updateQuoteDraftAction(
  _previous: RequestQuoteActionState,
  formData: FormData,
) {
  return runStaffAction(
    formData,
    [
      "requestId",
      "quoteId",
      "expectedRecordVersion",
      "expectedRequestVersion",
      "validUntil",
      "vatRateBasisPoints",
      "estimatedDurationMinutes",
      "customerNotes",
      "additionalAssumptions",
      "staffNotes",
    ],
    async (principal) => {
      const quoteId = uuid.parse(scalar(formData, "quoteId"));
      const expectedRecordVersion = positiveInteger.parse(
        integer(formData, "expectedRecordVersion"),
      );
      const command = await buildQuoteCommercialCommand(principal, formData);
      await command.requestService.updateQuoteDraft(command.actor, {
        quoteId,
        expectedRecordVersion,
        expectedRequestVersion: command.expectedRequestVersion,
        ...command.commercial,
      });
    },
  );
}

async function runQuoteLifecycleAction(
  formData: FormData,
  operation: "issue" | "withdraw" | "expire",
): Promise<RequestQuoteActionState> {
  return runStaffAction(
    formData,
    ["quoteId", "expectedRecordVersion"],
    async (principal) => {
      const parsed = quoteLifecycleFormSchema.safeParse({
        quoteId: scalar(formData, "quoteId"),
        expectedRecordVersion: integer(formData, "expectedRecordVersion"),
      });
      if (!parsed.success) throw new RequestQuoteServiceError("INVALID_REQUEST");
      const requestService = service();
      if (operation === "issue") {
        await requestService.issueQuote(actorFromPrincipal(principal), parsed.data);
      } else if (operation === "withdraw") {
        await requestService.withdrawQuote(
          actorFromPrincipal(principal),
          parsed.data,
        );
      } else {
        await requestService.expireQuote(
          actorFromPrincipal(principal),
          parsed.data,
        );
      }
    },
  );
}

export async function issueQuoteAction(
  _previous: RequestQuoteActionState,
  formData: FormData,
) {
  return runQuoteLifecycleAction(formData, "issue");
}

export async function withdrawQuoteAction(
  _previous: RequestQuoteActionState,
  formData: FormData,
) {
  return runQuoteLifecycleAction(formData, "withdraw");
}

export async function expireQuoteAction(
  _previous: RequestQuoteActionState,
  formData: FormData,
) {
  return runQuoteLifecycleAction(formData, "expire");
}
