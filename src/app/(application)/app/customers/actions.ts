"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserPermission } from "@/auth/authorization-service";
import { isAuthAttemptAllowed } from "@/auth/enforce-rate-limit";
import { AuthenticationBoundaryError } from "@/auth/principal-policy";
import type { AuthLocale } from "@/auth/validation";
import type { CrmActionState } from "@/components/crm/action-state";
import { crmContent } from "@/content/crm";
import { getDatabase } from "@/db/client";
import {
  AuthorizationError,
  requirePermission,
} from "@/modules/identity-access/authorization";
import { CustomerCrmAuthorizationError } from "@/modules/customer-crm/policy";
import { createDatabaseCustomerCrmRepository } from "@/modules/customer-crm/repository";
import {
  createCustomerCrmService,
  CustomerCrmServiceError,
  type CustomerCrmService,
} from "@/modules/customer-crm/service";
import type { CustomerCrmActor } from "@/modules/customer-crm/types";
import {
  archiveCleaningAssetSchema,
  archiveContactSchema,
  archiveCustomerSchema,
  archivePropertyAreaSchema,
  archivePropertySchema,
  createCleaningAssetSchema,
  createContactSchema,
  createCustomerSchema,
  createPropertyAreaSchema,
  createPropertySchema,
  linkCustomerIdentitySchema,
  revokeCustomerIdentityLinkSchema,
  updateCustomerSchema,
  updatePropertySchema,
  type ArchiveCleaningAssetInput,
  type ArchiveContactInput,
  type ArchiveCustomerInput,
  type ArchivePropertyAreaInput,
  type ArchivePropertyInput,
  type CreateCleaningAssetInput,
  type CreateContactInput,
  type CreateCustomerInput,
  type CreatePropertyAreaInput,
  type CreatePropertyInput,
  type LinkCustomerIdentityInput,
  type RevokeCustomerIdentityLinkInput,
  type UpdateCustomerInput,
  type UpdatePropertyInput,
} from "@/modules/customer-crm/validation";

type SubmittedValues = NonNullable<CrmActionState["values"]>;
type MutationResult = { status: "CREATED" | "CHANGED" | "NO_CHANGE" };

type MutationConfiguration<T> = {
  fields: readonly string[];
  arrayFields?: ReadonlySet<string>;
  schema: z.ZodType<T>;
  parse: (formData: FormData) => unknown;
  mutate: (
    service: CustomerCrmService,
    actor: CustomerCrmActor,
    input: T,
  ) => Promise<MutationResult>;
  identityAdministration?: boolean;
  conflictMessage?: "stale" | "invalidRelationship";
};

const customerFields = [
  "customerType",
  "displayName",
  "legalName",
  "preferredLocale",
  "primaryEmail",
  "primaryPhone",
  "internalNotes",
] as const;

const createCustomerFields = [
  ...customerFields,
  "initialContact.contactName",
  "initialContact.email",
  "initialContact.phone",
  "initialContact.roleTitle",
  "initialContact.preferredContactMethod",
  "initialContact.locale",
] as const;

const propertyFields = [
  "propertyType",
  "label",
  "city",
  "district",
  "streetAddress",
  "postalCode",
  "latitude",
  "longitude",
  "accessNotes",
  "parkingNotes",
  "serviceZoneId",
] as const;

const assetFields = [
  "propertyId",
  "areaId",
  "cleaningItemTypeId",
  "label",
  "approximateLengthCm",
  "approximateWidthCm",
  "approximateAreaHundredthsM2",
  "approximateSeatCount",
  "reportedFibreMaterialId",
  "reportedSurfaceConstructionId",
  "customerReportedConditionLevelId",
  "customerConditionNotes",
  "colourAppearanceNotes",
  "approximateAcquisitionYear",
  "operationalNotes",
  "reportedIssueTypeIds",
  "reportedRiskFlagIds",
] as const;

const assetArrayFields = new Set([
  "reportedIssueTypeIds",
  "reportedRiskFlagIds",
]);

function submittedValues(
  formData: FormData,
  fields: readonly string[],
  arrayFields: ReadonlySet<string> = new Set(),
): SubmittedValues {
  const values: Record<string, string | readonly string[]> = {};
  for (const field of fields) {
    const entries = formData
      .getAll(field)
      .map((entry) => (typeof entry === "string" ? entry : ""));
    if (arrayFields.has(field)) {
      if (entries.length > 0) values[field] = entries;
    } else if (entries.length === 1) {
      values[field] = entries[0]!;
    } else if (entries.length > 1) {
      values[field] = entries;
    }
  }
  return values;
}

function withValues(
  state: Omit<CrmActionState, "values">,
  values: SubmittedValues,
): CrmActionState {
  return Object.keys(values).length > 0 ? { ...state, values } : state;
}

function scalar(formData: FormData, field: string): unknown {
  const values = formData.getAll(field);
  if (values.length === 0) return undefined;
  if (values.length !== 1 || typeof values[0] !== "string") return values;
  return values[0];
}

function nullableText(formData: FormData, field: string): unknown {
  const value = scalar(formData, field);
  return typeof value === "string" && value.trim() === "" ? null : value;
}

function parsedInteger(
  formData: FormData,
  field: string,
  nullable: boolean,
): unknown {
  const value = scalar(formData, field);
  if (value === undefined) return undefined;
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  if (normalized === "") return nullable ? null : Number.NaN;
  if (!/^-?\d+$/.test(normalized)) return Number.NaN;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

function parsedNumber(
  formData: FormData,
  field: string,
  nullable: boolean,
): unknown {
  const value = scalar(formData, field);
  if (value === undefined) return undefined;
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  if (normalized === "") return nullable ? null : Number.NaN;
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return Number.NaN;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parsedIntegerList(formData: FormData, field: string): unknown[] {
  return formData.getAll(field).map((entry) => {
    if (typeof entry !== "string" || !/^-?\d+$/.test(entry.trim())) {
      return Number.NaN;
    }
    const value = Number(entry.trim());
    return Number.isSafeInteger(value) ? value : Number.NaN;
  });
}

function parsedCheckbox(formData: FormData, field: string): unknown {
  const value = scalar(formData, field);
  if (value === undefined) return false;
  return value === "true" ? true : value;
}

function hasMeaningfulText(formData: FormData, fields: readonly string[]): boolean {
  return fields.some((field) =>
    formData
      .getAll(field)
      .some((value) => typeof value === "string" && value.trim().length > 0),
  );
}

function parseCreateCustomer(formData: FormData): unknown {
  const customerType = scalar(formData, "customerType");
  const hasInitialContact =
    customerType === "BUSINESS" ||
    hasMeaningfulText(formData, [
      "initialContact.contactName",
      "initialContact.email",
      "initialContact.phone",
      "initialContact.roleTitle",
    ]);
  return {
    customerType,
    displayName: scalar(formData, "displayName"),
    legalName: nullableText(formData, "legalName"),
    preferredLocale: scalar(formData, "preferredLocale"),
    primaryEmail: nullableText(formData, "primaryEmail"),
    primaryPhone: nullableText(formData, "primaryPhone"),
    internalNotes: nullableText(formData, "internalNotes"),
    initialContact: hasInitialContact
      ? {
          contactName: scalar(formData, "initialContact.contactName"),
          email: nullableText(formData, "initialContact.email"),
          phone: nullableText(formData, "initialContact.phone"),
          roleTitle: nullableText(formData, "initialContact.roleTitle"),
          preferredContactMethod: scalar(
            formData,
            "initialContact.preferredContactMethod",
          ),
          locale: scalar(formData, "initialContact.locale"),
        }
      : undefined,
  };
}

function parseUpdateCustomer(formData: FormData): unknown {
  return {
    customerId: scalar(formData, "customerId"),
    expectedVersion: parsedInteger(formData, "expectedVersion", false),
    customerType: scalar(formData, "customerType"),
    displayName: scalar(formData, "displayName"),
    legalName: nullableText(formData, "legalName"),
    preferredLocale: scalar(formData, "preferredLocale"),
    primaryEmail: nullableText(formData, "primaryEmail"),
    primaryPhone: nullableText(formData, "primaryPhone"),
    internalNotes: nullableText(formData, "internalNotes"),
  };
}

function parseCreateContact(formData: FormData): unknown {
  return {
    customerId: scalar(formData, "customerId"),
    contactName: scalar(formData, "contactName"),
    email: nullableText(formData, "email"),
    phone: nullableText(formData, "phone"),
    roleTitle: nullableText(formData, "roleTitle"),
    isPrimary: parsedCheckbox(formData, "isPrimary"),
    preferredContactMethod: scalar(formData, "preferredContactMethod"),
    locale: scalar(formData, "locale"),
  };
}

function parseCreateProperty(formData: FormData): unknown {
  return {
    customerId: scalar(formData, "customerId"),
    propertyType: scalar(formData, "propertyType"),
    label: scalar(formData, "label"),
    city: scalar(formData, "city"),
    district: nullableText(formData, "district"),
    streetAddress: scalar(formData, "streetAddress"),
    postalCode: nullableText(formData, "postalCode"),
    latitude: parsedNumber(formData, "latitude", true),
    longitude: parsedNumber(formData, "longitude", true),
    accessNotes: nullableText(formData, "accessNotes"),
    parkingNotes: nullableText(formData, "parkingNotes"),
    serviceZoneId: parsedInteger(formData, "serviceZoneId", true),
  };
}

function parseUpdateProperty(formData: FormData): unknown {
  return {
    propertyId: scalar(formData, "propertyId"),
    expectedVersion: parsedInteger(formData, "expectedVersion", false),
    propertyType: scalar(formData, "propertyType"),
    label: scalar(formData, "label"),
    city: scalar(formData, "city"),
    district: nullableText(formData, "district"),
    streetAddress: scalar(formData, "streetAddress"),
    postalCode: nullableText(formData, "postalCode"),
    latitude: parsedNumber(formData, "latitude", true),
    longitude: parsedNumber(formData, "longitude", true),
    accessNotes: nullableText(formData, "accessNotes"),
    parkingNotes: nullableText(formData, "parkingNotes"),
    serviceZoneId: parsedInteger(formData, "serviceZoneId", true),
  };
}

function parseCreateArea(formData: FormData): unknown {
  return {
    propertyId: scalar(formData, "propertyId"),
    areaType: scalar(formData, "areaType"),
    customLabel: nullableText(formData, "customLabel"),
    floorLevel: nullableText(formData, "floorLevel"),
    notes: nullableText(formData, "notes"),
  };
}

function parseCreateAsset(formData: FormData): unknown {
  return {
    propertyId: scalar(formData, "propertyId"),
    areaId: nullableText(formData, "areaId"),
    cleaningItemTypeId: parsedInteger(formData, "cleaningItemTypeId", false),
    label: scalar(formData, "label"),
    approximateLengthCm: parsedInteger(formData, "approximateLengthCm", true),
    approximateWidthCm: parsedInteger(formData, "approximateWidthCm", true),
    approximateAreaHundredthsM2: parsedInteger(
      formData,
      "approximateAreaHundredthsM2",
      true,
    ),
    approximateSeatCount: parsedInteger(formData, "approximateSeatCount", true),
    reportedFibreMaterialId: parsedInteger(
      formData,
      "reportedFibreMaterialId",
      true,
    ),
    reportedSurfaceConstructionId: parsedInteger(
      formData,
      "reportedSurfaceConstructionId",
      true,
    ),
    customerReportedConditionLevelId: parsedInteger(
      formData,
      "customerReportedConditionLevelId",
      true,
    ),
    customerConditionNotes: nullableText(formData, "customerConditionNotes"),
    colourAppearanceNotes: nullableText(formData, "colourAppearanceNotes"),
    approximateAcquisitionYear: parsedInteger(
      formData,
      "approximateAcquisitionYear",
      true,
    ),
    operationalNotes: nullableText(formData, "operationalNotes"),
    reportedIssueTypeIds: parsedIntegerList(formData, "reportedIssueTypeIds"),
    reportedRiskFlagIds: parsedIntegerList(formData, "reportedRiskFlagIds"),
  };
}

function fieldName(path: readonly PropertyKey[]): string {
  const field = path
    .filter((part) => typeof part !== "number")
    .map(String)
    .join(".");
  return field === "initialContact" ? "initialContact.contactName" : field || "form";
}

function invalidState(
  locale: AuthLocale,
  issues: readonly { path: PropertyKey[] }[],
  values: SubmittedValues,
): CrmActionState {
  const fieldErrors: Record<string, readonly string[]> = {};
  for (const issue of issues) {
    fieldErrors[fieldName(issue.path)] = [crmContent[locale].action.invalid];
  }
  return withValues(
    {
      status: "ERROR",
      message: crmContent[locale].action.invalid,
      fieldErrors,
    },
    values,
  );
}

function errorState(
  locale: AuthLocale,
  error: unknown,
  values: SubmittedValues,
  conflictMessage: "stale" | "invalidRelationship",
): CrmActionState {
  const copy = crmContent[locale].action;
  if (
    error instanceof AuthenticationBoundaryError ||
    error instanceof AuthorizationError
  ) {
    return withValues({ status: "ERROR", message: copy.forbidden }, values);
  }
  if (error instanceof CustomerCrmAuthorizationError) {
    return withValues(
      {
        status: "ERROR",
        message:
          error.code === "RECORD_NOT_FOUND_OR_FORBIDDEN"
            ? copy.notFound
            : copy.forbidden,
      },
      values,
    );
  }
  if (error instanceof CustomerCrmServiceError) {
    switch (error.code) {
      case "INVALID_REQUEST":
        return withValues({ status: "ERROR", message: copy.invalid }, values);
      case "INVALID_REFERENCE":
        return withValues(
          { status: "ERROR", message: copy.invalidRelationship },
          values,
        );
      case "CONFLICT":
        return withValues(
          { status: "ERROR", message: copy[conflictMessage] },
          values,
        );
      case "RECORD_NOT_FOUND_OR_FORBIDDEN":
        return withValues({ status: "ERROR", message: copy.notFound }, values);
      case "OPERATION_FAILED":
        return withValues({ status: "ERROR", message: copy.unavailable }, values);
    }
  }
  return withValues({ status: "ERROR", message: copy.unavailable }, values);
}

function actorFromPrincipal(
  principal: Awaited<ReturnType<typeof requireUserPermission>>,
): CustomerCrmActor {
  return {
    profileId: principal.profile.id,
    status: principal.profile.status,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

function revalidateCrmRoutes(): void {
  revalidatePath("/app/customers");
  revalidatePath("/app/customers/[customerId]", "page");
  revalidatePath("/app/customers/[customerId]/edit", "page");
  revalidatePath(
    "/app/customers/[customerId]/properties/[propertyId]",
    "page",
  );
  revalidatePath(
    "/app/customers/[customerId]/properties/[propertyId]/edit",
    "page",
  );
  revalidatePath("/app/my-properties");
}

async function runMutation<T>(
  formData: FormData,
  configuration: MutationConfiguration<T>,
): Promise<CrmActionState> {
  let values: SubmittedValues = {};
  let locale: AuthLocale = "bg";
  try {
    const principal = await requireUserPermission("CUSTOMER_RECORDS_MANAGE");
    locale = principal.profile.preferredLocale;
    values = submittedValues(
      formData,
      configuration.fields,
      configuration.arrayFields,
    );
    const authorization = {
      status: principal.profile.status,
      roles: principal.roles,
      permissions: principal.permissions,
    };
    if (configuration.identityAdministration) {
      requirePermission(authorization, "USER_ADMIN_MANAGE");
    }
    if (!(await isAuthAttemptAllowed("ADMIN_MUTATION", principal.profile.id))) {
      return withValues(
        { status: "ERROR", message: crmContent[locale].action.unavailable },
        values,
      );
    }

    const parsed = configuration.schema.safeParse(configuration.parse(formData));
    if (!parsed.success) {
      return invalidState(locale, parsed.error.issues, values);
    }

    const service = createCustomerCrmService(
      createDatabaseCustomerCrmRepository(getDatabase()),
    );
    const result = await configuration.mutate(
      service,
      actorFromPrincipal(principal),
      parsed.data,
    );
    if (result.status !== "NO_CHANGE") revalidateCrmRoutes();
    return {
      status: "SUCCESS",
      message:
        result.status === "NO_CHANGE"
          ? crmContent[locale].action.noChange
          : crmContent[locale].action.success,
    };
  } catch (error) {
    return errorState(
      locale,
      error,
      values,
      configuration.conflictMessage ?? "stale",
    );
  }
}

export async function createCustomerAction(
  _previous: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  return runMutation<CreateCustomerInput>(formData, {
    fields: createCustomerFields,
    schema: createCustomerSchema,
    parse: parseCreateCustomer,
    mutate: (service, actor, input) => service.createCustomer(actor, input),
  });
}

export async function updateCustomerAction(
  _previous: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  return runMutation<UpdateCustomerInput>(formData, {
    fields: ["customerId", "expectedVersion", ...customerFields],
    schema: updateCustomerSchema,
    parse: parseUpdateCustomer,
    mutate: (service, actor, input) => service.updateCustomer(actor, input),
  });
}

export async function archiveCustomerAction(
  _previous: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  return runMutation<ArchiveCustomerInput>(formData, {
    fields: ["customerId", "expectedVersion"],
    schema: archiveCustomerSchema,
    parse: (data) => ({
      customerId: scalar(data, "customerId"),
      expectedVersion: parsedInteger(data, "expectedVersion", false),
    }),
    mutate: (service, actor, input) => service.archiveCustomer(actor, input),
  });
}

export async function createContactAction(
  _previous: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  return runMutation<CreateContactInput>(formData, {
    fields: [
      "customerId",
      "contactName",
      "email",
      "phone",
      "roleTitle",
      "isPrimary",
      "preferredContactMethod",
      "locale",
    ],
    schema: createContactSchema,
    parse: parseCreateContact,
    mutate: (service, actor, input) => service.createContact(actor, input),
  });
}

export async function archiveContactAction(
  _previous: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  return runMutation<ArchiveContactInput>(formData, {
    fields: ["contactId", "expectedVersion"],
    schema: archiveContactSchema,
    parse: (data) => ({
      contactId: scalar(data, "contactId"),
      expectedVersion: parsedInteger(data, "expectedVersion", false),
    }),
    mutate: (service, actor, input) => service.archiveContact(actor, input),
  });
}

export async function linkCustomerIdentityAction(
  _previous: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  return runMutation<LinkCustomerIdentityInput>(formData, {
    fields: ["customerId", "userProfileId", "relationshipType"],
    schema: linkCustomerIdentitySchema,
    parse: (data) => ({
      customerId: scalar(data, "customerId"),
      userProfileId: scalar(data, "userProfileId"),
      relationshipType: scalar(data, "relationshipType"),
    }),
    mutate: (service, actor, input) =>
      service.linkCustomerIdentity(actor, input),
    identityAdministration: true,
    conflictMessage: "invalidRelationship",
  });
}

export async function revokeCustomerIdentityLinkAction(
  _previous: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  return runMutation<RevokeCustomerIdentityLinkInput>(formData, {
    fields: ["linkId"],
    schema: revokeCustomerIdentityLinkSchema,
    parse: (data) => ({ linkId: scalar(data, "linkId") }),
    mutate: (service, actor, input) =>
      service.revokeCustomerIdentityLink(actor, input),
    identityAdministration: true,
    conflictMessage: "invalidRelationship",
  });
}

export async function createPropertyAction(
  _previous: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  return runMutation<CreatePropertyInput>(formData, {
    fields: ["customerId", ...propertyFields],
    schema: createPropertySchema,
    parse: parseCreateProperty,
    mutate: (service, actor, input) => service.createProperty(actor, input),
  });
}

export async function updatePropertyAction(
  _previous: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  return runMutation<UpdatePropertyInput>(formData, {
    fields: ["propertyId", "expectedVersion", ...propertyFields],
    schema: updatePropertySchema,
    parse: parseUpdateProperty,
    mutate: (service, actor, input) => service.updateProperty(actor, input),
  });
}

export async function archivePropertyAction(
  _previous: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  return runMutation<ArchivePropertyInput>(formData, {
    fields: ["propertyId", "expectedVersion"],
    schema: archivePropertySchema,
    parse: (data) => ({
      propertyId: scalar(data, "propertyId"),
      expectedVersion: parsedInteger(data, "expectedVersion", false),
    }),
    mutate: (service, actor, input) => service.archiveProperty(actor, input),
  });
}

export async function createAreaAction(
  _previous: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  return runMutation<CreatePropertyAreaInput>(formData, {
    fields: ["propertyId", "areaType", "customLabel", "floorLevel", "notes"],
    schema: createPropertyAreaSchema,
    parse: parseCreateArea,
    mutate: (service, actor, input) => service.createPropertyArea(actor, input),
  });
}

export async function archiveAreaAction(
  _previous: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  return runMutation<ArchivePropertyAreaInput>(formData, {
    fields: ["areaId", "expectedVersion"],
    schema: archivePropertyAreaSchema,
    parse: (data) => ({
      areaId: scalar(data, "areaId"),
      expectedVersion: parsedInteger(data, "expectedVersion", false),
    }),
    mutate: (service, actor, input) => service.archivePropertyArea(actor, input),
  });
}

export async function createAssetAction(
  _previous: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  return runMutation<CreateCleaningAssetInput>(formData, {
    fields: assetFields,
    arrayFields: assetArrayFields,
    schema: createCleaningAssetSchema,
    parse: parseCreateAsset,
    mutate: (service, actor, input) => service.createCleaningAsset(actor, input),
  });
}

export async function archiveAssetAction(
  _previous: CrmActionState,
  formData: FormData,
): Promise<CrmActionState> {
  return runMutation<ArchiveCleaningAssetInput>(formData, {
    fields: ["assetId", "expectedVersion"],
    schema: archiveCleaningAssetSchema,
    parse: (data) => ({
      assetId: scalar(data, "assetId"),
      expectedVersion: parsedInteger(data, "expectedVersion", false),
    }),
    mutate: (service, actor, input) => service.archiveCleaningAsset(actor, input),
  });
}
