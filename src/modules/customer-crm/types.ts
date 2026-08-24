import type { AccountStatus } from "@/modules/identity-access/authorization";
import type {
  ApplicationRoleCode,
  PermissionCode,
} from "@/modules/identity-access/policy";

export const customerTypes = ["INDIVIDUAL", "BUSINESS"] as const;
export type CustomerType = (typeof customerTypes)[number];

export const customerRecordStatuses = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type CustomerRecordStatus = (typeof customerRecordStatuses)[number];

export const preferredLocales = ["bg", "en"] as const;
export type PreferredLocale = (typeof preferredLocales)[number];

export const preferredContactMethods = [
  "EMAIL",
  "PHONE",
  "NO_PREFERENCE",
] as const;
export type PreferredContactMethod = (typeof preferredContactMethods)[number];

export const customerIdentityRelationshipTypes = [
  "OWNER",
  "PRIMARY_CONTACT",
  "AUTHORIZED_CONTACT",
] as const;
export type CustomerIdentityRelationshipType =
  (typeof customerIdentityRelationshipTypes)[number];

export const propertyTypes = [
  "RESIDENTIAL",
  "OFFICE",
  "HOTEL_GUEST_ACCOMMODATION",
  "SERVICED_APARTMENT",
  "RESTAURANT_CAFE",
  "COMMERCIAL_PUBLIC",
  "OTHER",
] as const;
export type PropertyType = (typeof propertyTypes)[number];

export const propertyAreaTypes = [
  "LIVING_ROOM",
  "BEDROOM",
  "DINING_ROOM",
  "OFFICE",
  "RECEPTION",
  "CORRIDOR",
  "STAIRCASE",
  "MEETING_ROOM",
  "HOTEL_ROOM",
  "OTHER",
] as const;
export type PropertyAreaType = (typeof propertyAreaTypes)[number];

export type CustomerCrmActor = {
  profileId: string;
  status: AccountStatus;
  roles: ReadonlySet<ApplicationRoleCode>;
  permissions: ReadonlySet<PermissionCode>;
};

export type CustomerRecordAccessScope = "STAFF" | "LINKED_CUSTOMER";

export type CustomerListInput = {
  search?: string;
  status?: CustomerRecordStatus;
  customerType?: CustomerType;
  limit: number;
  offset: number;
};

export type CustomerSummary = {
  id: string;
  customerType: CustomerType;
  displayName: string;
  legalName: string | null;
  preferredLocale: PreferredLocale;
  primaryEmail: string | null;
  primaryPhone: string | null;
  status: CustomerRecordStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerPage = {
  items: readonly CustomerSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type CustomerContact = {
  id: string;
  customerId: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  roleTitle: string | null;
  isPrimary: boolean;
  preferredContactMethod: PreferredContactMethod;
  locale: PreferredLocale;
  active: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerIdentityLink = {
  id: string;
  customerId: string;
  userProfileId: string;
  relationshipType: CustomerIdentityRelationshipType;
  active: boolean;
  createdAt: Date;
  revokedAt: Date | null;
};

export type PropertyArea = {
  id: string;
  propertyId: string;
  areaType: PropertyAreaType;
  customLabel: string | null;
  floorLevel: string | null;
  notes: string | null;
  active: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CleaningAssetCore = {
  id: string;
  propertyId: string;
  areaId: string | null;
  cleaningItemTypeId: number;
  label: string;
  approximateLengthCm: number | null;
  approximateWidthCm: number | null;
  approximateAreaHundredthsM2: number | null;
  approximateSeatCount: number | null;
  reportedFibreMaterialId: number | null;
  reportedSurfaceConstructionId: number | null;
  customerReportedConditionLevelId: number | null;
  customerConditionNotes: string | null;
  colourAppearanceNotes: string | null;
  approximateAcquisitionYear: number | null;
  status: CustomerRecordStatus;
  reportedIssueTypeIds: readonly number[];
  reportedRiskFlagIds: readonly number[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type StaffCleaningAsset = CleaningAssetCore & {
  operationalNotes: string | null;
};

export type CustomerCleaningAsset = CleaningAssetCore;

export type PropertyCore = {
  id: string;
  customerId: string;
  propertyType: PropertyType;
  label: string;
  city: string;
  district: string | null;
  streetAddress: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  accessNotes: string | null;
  parkingNotes: string | null;
  serviceZoneId: number | null;
  status: CustomerRecordStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type StaffProperty = PropertyCore & {
  areas: readonly PropertyArea[];
  cleaningAssets: readonly StaffCleaningAsset[];
};

export type CustomerPropertyArea = Omit<PropertyArea, "notes">;

export type CustomerProperty = Omit<
  PropertyCore,
  "accessNotes" | "parkingNotes" | "latitude" | "longitude"
> & {
  areas: readonly CustomerPropertyArea[];
  cleaningAssets: readonly CustomerCleaningAsset[];
};

export type StaffCustomerDetail = CustomerSummary & {
  internalNotes: string | null;
  contacts: readonly CustomerContact[];
  identityLinks: readonly CustomerIdentityLink[];
  properties: readonly StaffProperty[];
};

/** Customer-facing projection. Staff-only notes, actor IDs and identity links are absent. */
export type CustomerSelfDetail = CustomerSummary & {
  contacts: readonly CustomerContact[];
  properties: readonly CustomerProperty[];
};

export type CustomerCrmMutationResult =
  | { status: "CHANGED"; id: string; version: number; updatedAt: Date }
  | { status: "NO_CHANGE"; id: string; version: number; updatedAt: Date }
  | { status: "CONFLICT" }
  | { status: "NOT_FOUND_OR_FORBIDDEN" }
  | { status: "INVALID_REFERENCE" };

export type CustomerCrmCreateResult =
  | { status: "CREATED"; id: string; version: number; updatedAt: Date }
  | { status: "NOT_FOUND_OR_FORBIDDEN" }
  | { status: "INVALID_REFERENCE" }
  | { status: "CONFLICT" };

export type CustomerIdentityLinkWriteResult =
  | { status: "CREATED" | "CHANGED" | "NO_CHANGE"; id: string; changedAt: Date }
  | { status: "NOT_FOUND_OR_FORBIDDEN" }
  | { status: "CONFLICT" };
