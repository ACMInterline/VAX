import "server-only";

import { z } from "zod";
import {
  requireCustomerIdentityLinkManagement,
  requireCustomerSelfRead,
  requireStaffCustomerManagement,
  requireStaffCustomerRead,
} from "./policy";
import type {
  CustomerCleaningAsset,
  CustomerContact,
  CustomerCrmActor,
  CustomerCrmCreateResult,
  CustomerCrmMutationResult,
  CustomerIdentityLinkWriteResult,
  CustomerPage,
  CustomerProperty,
  CustomerPropertyArea,
  CustomerSelfDetail,
  CustomerSummary,
  StaffCleaningAsset,
  StaffCustomerDetail,
  StaffProperty,
} from "./types";
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
  customerIdSchema,
  customerListInputSchema,
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
} from "./validation";

export interface CustomerCrmRepository {
  listStaffCustomers(
    actorProfileId: string,
    input: z.output<typeof customerListInputSchema>,
  ): Promise<CustomerPage>;
  listLinkedCustomers(actorProfileId: string): Promise<readonly CustomerSummary[]>;
  getStaffCustomer(
    actorProfileId: string,
    customerId: string,
  ): Promise<StaffCustomerDetail | null>;
  getLinkedCustomer(
    actorProfileId: string,
    customerId: string,
  ): Promise<CustomerSelfDetail | null>;
  createCustomer(
    actorProfileId: string,
    input: CreateCustomerInput,
  ): Promise<CustomerCrmCreateResult>;
  updateCustomer(
    actorProfileId: string,
    input: UpdateCustomerInput,
  ): Promise<CustomerCrmMutationResult>;
  archiveCustomer(
    actorProfileId: string,
    input: ArchiveCustomerInput,
  ): Promise<CustomerCrmMutationResult>;
  createContact(
    actorProfileId: string,
    input: CreateContactInput,
  ): Promise<CustomerCrmCreateResult>;
  archiveContact(
    actorProfileId: string,
    input: ArchiveContactInput,
  ): Promise<CustomerCrmMutationResult>;
  createProperty(
    actorProfileId: string,
    input: CreatePropertyInput,
  ): Promise<CustomerCrmCreateResult>;
  updateProperty(
    actorProfileId: string,
    input: UpdatePropertyInput,
  ): Promise<CustomerCrmMutationResult>;
  archiveProperty(
    actorProfileId: string,
    input: ArchivePropertyInput,
  ): Promise<CustomerCrmMutationResult>;
  createPropertyArea(
    actorProfileId: string,
    input: CreatePropertyAreaInput,
  ): Promise<CustomerCrmCreateResult>;
  archivePropertyArea(
    actorProfileId: string,
    input: ArchivePropertyAreaInput,
  ): Promise<CustomerCrmMutationResult>;
  createCleaningAsset(
    actorProfileId: string,
    input: CreateCleaningAssetInput,
  ): Promise<CustomerCrmCreateResult>;
  archiveCleaningAsset(
    actorProfileId: string,
    input: ArchiveCleaningAssetInput,
  ): Promise<CustomerCrmMutationResult>;
  linkCustomerIdentity(
    actorProfileId: string,
    input: LinkCustomerIdentityInput,
  ): Promise<CustomerIdentityLinkWriteResult>;
  revokeCustomerIdentityLink(
    actorProfileId: string,
    input: RevokeCustomerIdentityLinkInput,
  ): Promise<CustomerIdentityLinkWriteResult>;
}

export type CustomerCrmServiceFailureCode =
  | "INVALID_REQUEST"
  | "RECORD_NOT_FOUND_OR_FORBIDDEN"
  | "INVALID_REFERENCE"
  | "CONFLICT"
  | "OPERATION_FAILED";

export class CustomerCrmServiceError extends Error {
  readonly code: CustomerCrmServiceFailureCode;

  constructor(code: CustomerCrmServiceFailureCode) {
    super(code);
    this.name = "CustomerCrmServiceError";
    this.code = code;
  }
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new CustomerCrmServiceError("INVALID_REQUEST");
  }
  return result.data;
}

async function repositoryOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new CustomerCrmServiceError("OPERATION_FAILED");
  }
}

function requireCreated(
  result: CustomerCrmCreateResult,
): Extract<CustomerCrmCreateResult, { status: "CREATED" }> {
  switch (result.status) {
    case "CREATED":
      return result;
    case "CONFLICT":
      throw new CustomerCrmServiceError("CONFLICT");
    case "INVALID_REFERENCE":
      throw new CustomerCrmServiceError("INVALID_REFERENCE");
    case "NOT_FOUND_OR_FORBIDDEN":
      throw new CustomerCrmServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
  }
}

function requireMutated(
  result: CustomerCrmMutationResult,
): Extract<CustomerCrmMutationResult, { status: "CHANGED" | "NO_CHANGE" }> {
  switch (result.status) {
    case "CHANGED":
    case "NO_CHANGE":
      return result;
    case "CONFLICT":
      throw new CustomerCrmServiceError("CONFLICT");
    case "INVALID_REFERENCE":
      throw new CustomerCrmServiceError("INVALID_REFERENCE");
    case "NOT_FOUND_OR_FORBIDDEN":
      throw new CustomerCrmServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
  }
}

function requireLinkWritten(
  result: CustomerIdentityLinkWriteResult,
): Extract<
  CustomerIdentityLinkWriteResult,
  { status: "CREATED" | "CHANGED" | "NO_CHANGE" }
> {
  switch (result.status) {
    case "CREATED":
    case "CHANGED":
    case "NO_CHANGE":
      return result;
    case "CONFLICT":
      throw new CustomerCrmServiceError("CONFLICT");
    case "NOT_FOUND_OR_FORBIDDEN":
      throw new CustomerCrmServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
  }
}

function safeCustomerSummary(customer: CustomerSummary): CustomerSummary {
  return {
    id: customer.id,
    customerType: customer.customerType,
    displayName: customer.displayName,
    legalName: customer.legalName,
    preferredLocale: customer.preferredLocale,
    primaryEmail: customer.primaryEmail,
    primaryPhone: customer.primaryPhone,
    status: customer.status,
    version: customer.version,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

function safeContact(contact: CustomerContact): CustomerContact {
  return {
    id: contact.id,
    customerId: contact.customerId,
    contactName: contact.contactName,
    email: contact.email,
    phone: contact.phone,
    roleTitle: contact.roleTitle,
    isPrimary: contact.isPrimary,
    preferredContactMethod: contact.preferredContactMethod,
    locale: contact.locale,
    active: contact.active,
    version: contact.version,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  };
}

function safeArea(area: StaffProperty["areas"][number]): CustomerPropertyArea {
  return {
    id: area.id,
    propertyId: area.propertyId,
    areaType: area.areaType,
    customLabel: area.customLabel,
    floorLevel: area.floorLevel,
    active: area.active,
    version: area.version,
    createdAt: area.createdAt,
    updatedAt: area.updatedAt,
  };
}

function safeAsset(
  asset: CustomerCleaningAsset | StaffCleaningAsset,
): CustomerCleaningAsset {
  return {
    id: asset.id,
    propertyId: asset.propertyId,
    areaId: asset.areaId,
    cleaningItemTypeId: asset.cleaningItemTypeId,
    label: asset.label,
    approximateLengthCm: asset.approximateLengthCm,
    approximateWidthCm: asset.approximateWidthCm,
    approximateAreaHundredthsM2: asset.approximateAreaHundredthsM2,
    approximateSeatCount: asset.approximateSeatCount,
    reportedFibreMaterialId: asset.reportedFibreMaterialId,
    reportedSurfaceConstructionId: asset.reportedSurfaceConstructionId,
    customerReportedConditionLevelId: asset.customerReportedConditionLevelId,
    customerConditionNotes: asset.customerConditionNotes,
    colourAppearanceNotes: asset.colourAppearanceNotes,
    approximateAcquisitionYear: asset.approximateAcquisitionYear,
    status: asset.status,
    reportedIssueTypeIds: [...asset.reportedIssueTypeIds],
    reportedRiskFlagIds: [...asset.reportedRiskFlagIds],
    version: asset.version,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

function safeProperty(property: CustomerProperty | StaffProperty): CustomerProperty {
  return {
    id: property.id,
    customerId: property.customerId,
    propertyType: property.propertyType,
    label: property.label,
    city: property.city,
    district: property.district,
    streetAddress: property.streetAddress,
    postalCode: property.postalCode,
    serviceZoneId: property.serviceZoneId,
    status: property.status,
    version: property.version,
    createdAt: property.createdAt,
    updatedAt: property.updatedAt,
    areas: property.areas.map((area) => safeArea(area as StaffProperty["areas"][number])),
    cleaningAssets: property.cleaningAssets.map(safeAsset),
  };
}

export function toCustomerSelfDetail(
  customer: CustomerSelfDetail | StaffCustomerDetail,
): CustomerSelfDetail {
  return {
    ...safeCustomerSummary(customer),
    contacts: customer.contacts.map(safeContact),
    properties: customer.properties.map(safeProperty),
  };
}

export function createCustomerCrmService(repository: CustomerCrmRepository) {
  return {
    async listCustomers(actor: CustomerCrmActor | null, input: unknown = {}) {
      requireStaffCustomerRead(actor);
      const parsed = parseInput(customerListInputSchema, input);
      return repositoryOperation(() =>
        repository.listStaffCustomers(actor!.profileId, parsed),
      );
    },

    async listMyCustomers(actor: CustomerCrmActor | null) {
      requireCustomerSelfRead(actor);
      const customers = await repositoryOperation(() =>
        repository.listLinkedCustomers(actor!.profileId),
      );
      return customers.map(safeCustomerSummary);
    },

    async getCustomer(actor: CustomerCrmActor | null, input: unknown) {
      requireStaffCustomerRead(actor);
      const parsed = parseInput(customerIdSchema, input);
      const customer = await repositoryOperation(() =>
        repository.getStaffCustomer(actor!.profileId, parsed.customerId),
      );
      if (!customer) {
        throw new CustomerCrmServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
      }
      return customer;
    },

    async getMyCustomer(actor: CustomerCrmActor | null, input: unknown) {
      requireCustomerSelfRead(actor);
      const parsed = parseInput(customerIdSchema, input);
      const customer = await repositoryOperation(() =>
        repository.getLinkedCustomer(actor!.profileId, parsed.customerId),
      );
      if (!customer) {
        throw new CustomerCrmServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
      }
      return toCustomerSelfDetail(customer);
    },

    async createCustomer(actor: CustomerCrmActor | null, input: unknown) {
      requireStaffCustomerManagement(actor);
      const parsed = parseInput(createCustomerSchema, input);
      return requireCreated(
        await repositoryOperation(() =>
          repository.createCustomer(actor!.profileId, parsed),
        ),
      );
    },

    async updateCustomer(actor: CustomerCrmActor | null, input: unknown) {
      requireStaffCustomerManagement(actor);
      const parsed = parseInput(updateCustomerSchema, input);
      return requireMutated(
        await repositoryOperation(() =>
          repository.updateCustomer(actor!.profileId, parsed),
        ),
      );
    },

    async archiveCustomer(actor: CustomerCrmActor | null, input: unknown) {
      requireStaffCustomerManagement(actor);
      const parsed = parseInput(archiveCustomerSchema, input);
      return requireMutated(
        await repositoryOperation(() =>
          repository.archiveCustomer(actor!.profileId, parsed),
        ),
      );
    },

    async createContact(actor: CustomerCrmActor | null, input: unknown) {
      requireStaffCustomerManagement(actor);
      const parsed = parseInput(createContactSchema, input);
      return requireCreated(
        await repositoryOperation(() =>
          repository.createContact(actor!.profileId, parsed),
        ),
      );
    },

    async archiveContact(actor: CustomerCrmActor | null, input: unknown) {
      requireStaffCustomerManagement(actor);
      const parsed = parseInput(archiveContactSchema, input);
      return requireMutated(
        await repositoryOperation(() =>
          repository.archiveContact(actor!.profileId, parsed),
        ),
      );
    },

    async createProperty(actor: CustomerCrmActor | null, input: unknown) {
      requireStaffCustomerManagement(actor);
      const parsed = parseInput(createPropertySchema, input);
      return requireCreated(
        await repositoryOperation(() =>
          repository.createProperty(actor!.profileId, parsed),
        ),
      );
    },

    async updateProperty(actor: CustomerCrmActor | null, input: unknown) {
      requireStaffCustomerManagement(actor);
      const parsed = parseInput(updatePropertySchema, input);
      return requireMutated(
        await repositoryOperation(() =>
          repository.updateProperty(actor!.profileId, parsed),
        ),
      );
    },

    async archiveProperty(actor: CustomerCrmActor | null, input: unknown) {
      requireStaffCustomerManagement(actor);
      const parsed = parseInput(archivePropertySchema, input);
      return requireMutated(
        await repositoryOperation(() =>
          repository.archiveProperty(actor!.profileId, parsed),
        ),
      );
    },

    async createPropertyArea(actor: CustomerCrmActor | null, input: unknown) {
      requireStaffCustomerManagement(actor);
      const parsed = parseInput(createPropertyAreaSchema, input);
      return requireCreated(
        await repositoryOperation(() =>
          repository.createPropertyArea(actor!.profileId, parsed),
        ),
      );
    },

    async archivePropertyArea(actor: CustomerCrmActor | null, input: unknown) {
      requireStaffCustomerManagement(actor);
      const parsed = parseInput(archivePropertyAreaSchema, input);
      return requireMutated(
        await repositoryOperation(() =>
          repository.archivePropertyArea(actor!.profileId, parsed),
        ),
      );
    },

    async createCleaningAsset(actor: CustomerCrmActor | null, input: unknown) {
      requireStaffCustomerManagement(actor);
      const parsed = parseInput(createCleaningAssetSchema, input);
      return requireCreated(
        await repositoryOperation(() =>
          repository.createCleaningAsset(actor!.profileId, parsed),
        ),
      );
    },

    async archiveCleaningAsset(actor: CustomerCrmActor | null, input: unknown) {
      requireStaffCustomerManagement(actor);
      const parsed = parseInput(archiveCleaningAssetSchema, input);
      return requireMutated(
        await repositoryOperation(() =>
          repository.archiveCleaningAsset(actor!.profileId, parsed),
        ),
      );
    },

    async linkCustomerIdentity(actor: CustomerCrmActor | null, input: unknown) {
      requireCustomerIdentityLinkManagement(actor);
      const parsed = parseInput(linkCustomerIdentitySchema, input);
      return requireLinkWritten(
        await repositoryOperation(() =>
          repository.linkCustomerIdentity(actor!.profileId, parsed),
        ),
      );
    },

    async revokeCustomerIdentityLink(
      actor: CustomerCrmActor | null,
      input: unknown,
    ) {
      requireCustomerIdentityLinkManagement(actor);
      const parsed = parseInput(revokeCustomerIdentityLinkSchema, input);
      return requireLinkWritten(
        await repositoryOperation(() =>
          repository.revokeCustomerIdentityLink(actor!.profileId, parsed),
        ),
      );
    },
  };
}

export type CustomerCrmService = ReturnType<typeof createCustomerCrmService>;
