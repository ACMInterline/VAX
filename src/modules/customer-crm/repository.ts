import "server-only";

import {
  and,
  count,
  desc,
  eq,
  ilike,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Database } from "@/db/client";
import { travelZones } from "@/db/schema/commercial-engine";
import {
  cleaningAssetReportedIssues,
  cleaningAssetReportedRiskFlags,
  cleaningAssets,
  customerContacts,
  customerIdentityLinks,
  customers,
  properties,
  propertyAreas,
} from "@/db/schema/customer-crm";
import {
  applicationRoles,
  permissions,
  rolePermissions,
  userProfiles,
  userRoles,
} from "@/db/schema/identity-access";
import {
  cleaningItemTypes,
  conditionLevels,
  fibreMaterials,
  issueTypes,
  riskFlags,
  surfaceConstructions,
} from "@/db/schema/service-catalogue";
import type { PermissionCode } from "@/modules/identity-access/policy";
import type { CustomerCrmRepository } from "./service";
import {
  customerIdentityRelationshipTypes,
  customerRecordStatuses,
  customerTypes,
  preferredContactMethods,
  preferredLocales,
  propertyAreaTypes,
  propertyTypes,
  type CleaningAssetCore,
  type CustomerContact,
  type CustomerIdentityLink,
  type CustomerIdentityLinkWriteResult,
  type CustomerListInput,
  type CustomerPage,
  type CustomerProperty,
  type CustomerPropertyArea,
  type CustomerCrmCreateResult,
  type CustomerCrmMutationResult,
  type CustomerSelfDetail,
  type CustomerSummary,
  type PropertyArea,
  type PropertyCore,
  type StaffCleaningAsset,
  type StaffCustomerDetail,
  type StaffProperty,
} from "./types";
import type {
  ArchiveCleaningAssetInput,
  ArchiveContactInput,
  ArchiveCustomerInput,
  ArchivePropertyAreaInput,
  ArchivePropertyInput,
  CreateCleaningAssetInput,
  CreateContactInput,
  CreateCustomerInput,
  CreatePropertyAreaInput,
  CreatePropertyInput,
  LinkCustomerIdentityInput,
  RevokeCustomerIdentityLinkInput,
  UpdateCustomerInput,
  UpdatePropertyInput,
} from "./validation";

const customerSummarySelection = {
  id: customers.id,
  customerType: customers.customerType,
  displayName: customers.displayName,
  legalName: customers.legalName,
  preferredLocale: customers.preferredLocale,
  primaryEmail: customers.primaryEmail,
  primaryPhone: customers.primaryPhone,
  status: customers.status,
  version: customers.version,
  createdAt: customers.createdAt,
  updatedAt: customers.updatedAt,
} as const;

function enumValue<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
): T {
  if ((allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new Error(`Unexpected ${label}.`);
}

function customerSummary(row: typeof customers.$inferSelect): CustomerSummary {
  return {
    id: row.id,
    customerType: enumValue(row.customerType, customerTypes, "customer type"),
    displayName: row.displayName,
    legalName: row.legalName,
    preferredLocale: enumValue(row.preferredLocale, preferredLocales, "locale"),
    primaryEmail: row.primaryEmail,
    primaryPhone: row.primaryPhone,
    status: enumValue(row.status, customerRecordStatuses, "customer status"),
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function contactRecord(
  row: typeof customerContacts.$inferSelect,
): CustomerContact {
  return {
    id: row.id,
    customerId: row.customerId,
    contactName: row.contactName,
    email: row.email,
    phone: row.phone,
    roleTitle: row.roleTitle,
    isPrimary: row.isPrimary,
    preferredContactMethod: enumValue(
      row.preferredContactMethod,
      preferredContactMethods,
      "preferred contact method",
    ),
    locale: enumValue(row.locale, preferredLocales, "contact locale"),
    active: row.active,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function identityLinkRecord(
  row: typeof customerIdentityLinks.$inferSelect,
): CustomerIdentityLink {
  return {
    id: row.id,
    customerId: row.customerId,
    userProfileId: row.userProfileId,
    relationshipType: enumValue(
      row.relationshipType,
      customerIdentityRelationshipTypes,
      "customer identity relationship",
    ),
    active: row.active,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
  };
}

function commonPropertyRecord(
  row: Omit<
    typeof properties.$inferSelect,
    "latitude" | "longitude" | "accessNotes" | "parkingNotes"
  >,
): Omit<
  PropertyCore,
  "latitude" | "longitude" | "accessNotes" | "parkingNotes"
> {
  return {
    id: row.id,
    customerId: row.customerId,
    propertyType: enumValue(row.propertyType, propertyTypes, "property type"),
    label: row.label,
    city: row.city,
    district: row.district,
    streetAddress: row.streetAddress,
    postalCode: row.postalCode,
    serviceZoneId: row.serviceZoneId,
    status: enumValue(row.status, customerRecordStatuses, "property status"),
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function commonAreaRecord(
  row: Omit<typeof propertyAreas.$inferSelect, "notes">,
): CustomerPropertyArea {
  return {
    id: row.id,
    propertyId: row.propertyId,
    areaType: enumValue(row.areaType, propertyAreaTypes, "property area type"),
    customLabel: row.customLabel,
    floorLevel: row.floorLevel,
    active: row.active,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function commonAssetRecord(
  row: Omit<typeof cleaningAssets.$inferSelect, "operationalNotes">,
  issueIds: readonly number[],
  riskFlagIds: readonly number[],
): CleaningAssetCore {
  return {
    id: row.id,
    propertyId: row.propertyId,
    areaId: row.areaId,
    cleaningItemTypeId: row.cleaningItemTypeId,
    label: row.label,
    approximateLengthCm: row.approximateLengthCm,
    approximateWidthCm: row.approximateWidthCm,
    approximateAreaHundredthsM2: row.approximateAreaHundredthsM2,
    approximateSeatCount: row.approximateSeatCount,
    reportedFibreMaterialId: row.reportedFibreMaterialId,
    reportedSurfaceConstructionId: row.reportedSurfaceConstructionId,
    customerReportedConditionLevelId: row.customerReportedConditionLevelId,
    customerConditionNotes: row.customerConditionNotes,
    colourAppearanceNotes: row.colourAppearanceNotes,
    approximateAcquisitionYear: row.approximateAcquisitionYear,
    status: enumValue(row.status, customerRecordStatuses, "asset status"),
    reportedIssueTypeIds: issueIds,
    reportedRiskFlagIds: riskFlagIds,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * This predicate is repeated at every database boundary. The application
 * principal is an early policy decision, never a stale authority token.
 */
export function activeActorPermissionSql(
  actorProfileId: string,
  permissionCode: PermissionCode,
): SQL {
  return sql`exists (
    select 1
    from ${userProfiles} actor_profile
    join ${userRoles} actor_assignment
      on actor_assignment.user_profile_id = actor_profile.id
     and actor_assignment.active = true
    join ${applicationRoles} actor_role
      on actor_role.id = actor_assignment.role_id
     and actor_role.active = true
    join ${rolePermissions} actor_mapping
      on actor_mapping.role_id = actor_role.id
    join ${permissions} actor_permission
      on actor_permission.id = actor_mapping.permission_id
     and actor_permission.active = true
    where actor_profile.id = ${actorProfileId}::uuid
      and actor_profile.status = 'ACTIVE'
      and actor_permission.code = ${permissionCode}
  )`;
}

export function linkedCustomerReadSql(
  actorProfileId: string,
  customerId: string,
): SQL {
  return sql`${activeActorPermissionSql(actorProfileId, "OWN_CUSTOMER_DATA_READ")}
    and exists (
      select 1
      from ${customerIdentityLinks} access_link
      where access_link.user_profile_id = ${actorProfileId}::uuid
        and access_link.customer_id = ${customerId}::uuid
        and access_link.active = true
        and access_link.revoked_at is null
    )`;
}

export function customerListSearchSql(search: string): SQL | undefined {
  return or(
    ilike(customers.displayName, `%${search}%`),
    ilike(customers.legalName, `%${search}%`),
    sql`${customers.id}::text = ${search}`,
  );
}

function graphAccessSql(
  actorProfileId: string,
  customerId: string,
  audience: "STAFF" | "LINKED_CUSTOMER",
): SQL {
  return audience === "STAFF"
    ? activeActorPermissionSql(actorProfileId, "CUSTOMER_RECORDS_READ")
    : linkedCustomerReadSql(actorProfileId, customerId);
}

export async function listStaffCustomers(
  database: Database,
  actorProfileId: string,
  input: CustomerListInput,
): Promise<CustomerPage> {
  const search = input.search?.trim();
  const conditions: SQL[] = [
    activeActorPermissionSql(actorProfileId, "CUSTOMER_RECORDS_READ"),
  ];
  if (input.status) conditions.push(eq(customers.status, input.status));
  if (input.customerType) {
    conditions.push(eq(customers.customerType, input.customerType));
  }
  if (search) {
    const searchCondition = customerListSearchSql(search);
    if (searchCondition) conditions.push(searchCondition);
  }
  const where = and(...conditions);
  const [[totalRow], rows] = await Promise.all([
    database.select({ value: count() }).from(customers).where(where),
    database
      .select(customerSummarySelection)
      .from(customers)
      .where(where)
      .orderBy(desc(customers.updatedAt), customers.id)
      .limit(input.limit)
      .offset(input.offset),
  ]);

  return {
    items: rows.map((row) =>
      customerSummary(row as typeof customers.$inferSelect),
    ),
    total: Number(totalRow?.value ?? 0),
    limit: input.limit,
    offset: input.offset,
  };
}

export async function listLinkedCustomers(
  database: Database,
  actorProfileId: string,
): Promise<readonly CustomerSummary[]> {
  const rows = await database
    .select(customerSummarySelection)
    .from(customers)
    .innerJoin(
      customerIdentityLinks,
      and(
        eq(customerIdentityLinks.customerId, customers.id),
        eq(customerIdentityLinks.userProfileId, actorProfileId),
        eq(customerIdentityLinks.active, true),
        sql`${customerIdentityLinks.revokedAt} is null`,
      ),
    )
    .where(
      and(
        activeActorPermissionSql(actorProfileId, "OWN_CUSTOMER_DATA_READ"),
        ne(customers.status, "ARCHIVED"),
      ),
    )
    .orderBy(customers.displayName, customers.id);

  return rows.map((row) =>
    customerSummary(row as typeof customers.$inferSelect),
  );
}

type GraphRows = {
  contacts: (typeof customerContacts.$inferSelect)[];
  links: (typeof customerIdentityLinks.$inferSelect)[];
  properties: (typeof properties.$inferSelect)[];
  areas: (typeof propertyAreas.$inferSelect)[];
  assets: (typeof cleaningAssets.$inferSelect)[];
  issueRows: { assetId: string; issueTypeId: number }[];
  riskRows: { assetId: string; riskFlagId: number }[];
};

async function loadGraphRows(
  database: Database,
  actorProfileId: string,
  customerId: string,
  audience: "STAFF" | "LINKED_CUSTOMER",
): Promise<GraphRows> {
  const access = graphAccessSql(actorProfileId, customerId, audience);
  const selfService = audience === "LINKED_CUSTOMER";
  const propertyCondition = and(
    eq(properties.customerId, customerId),
    access,
    selfService ? ne(properties.status, "ARCHIVED") : undefined,
  );
  const areaCondition = and(
    eq(properties.customerId, customerId),
    access,
    selfService ? eq(propertyAreas.active, true) : undefined,
  );
  const assetCondition = and(
    eq(properties.customerId, customerId),
    access,
    selfService ? ne(cleaningAssets.status, "ARCHIVED") : undefined,
  );

  const [contactRows, propertyRows, areaRows, assetRows] = await Promise.all([
    database
      .select()
      .from(customerContacts)
      .where(
        and(
          eq(customerContacts.customerId, customerId),
          access,
          selfService ? eq(customerContacts.active, true) : undefined,
        ),
      )
      .orderBy(desc(customerContacts.isPrimary), customerContacts.contactName),
    database
      .select()
      .from(properties)
      .where(propertyCondition)
      .orderBy(properties.label, properties.id),
    database
      .select({ area: propertyAreas })
      .from(propertyAreas)
      .innerJoin(properties, eq(propertyAreas.propertyId, properties.id))
      .where(areaCondition)
      .orderBy(
        propertyAreas.propertyId,
        propertyAreas.areaType,
        propertyAreas.id,
      ),
    database
      .select({ asset: cleaningAssets })
      .from(cleaningAssets)
      .innerJoin(properties, eq(cleaningAssets.propertyId, properties.id))
      .where(assetCondition)
      .orderBy(
        cleaningAssets.propertyId,
        cleaningAssets.label,
        cleaningAssets.id,
      ),
  ]);

  const [linkRows, issueRows, riskRows] = await Promise.all([
    audience === "STAFF"
      ? database
          .select()
          .from(customerIdentityLinks)
          .where(and(eq(customerIdentityLinks.customerId, customerId), access))
          .orderBy(
            desc(customerIdentityLinks.active),
            customerIdentityLinks.createdAt,
          )
      : Promise.resolve([]),
    database
      .select({
        assetId: cleaningAssetReportedIssues.assetId,
        issueTypeId: cleaningAssetReportedIssues.issueTypeId,
      })
      .from(cleaningAssetReportedIssues)
      .innerJoin(
        cleaningAssets,
        eq(cleaningAssetReportedIssues.assetId, cleaningAssets.id),
      )
      .innerJoin(properties, eq(cleaningAssets.propertyId, properties.id))
      .where(
        and(
          eq(properties.customerId, customerId),
          eq(cleaningAssetReportedIssues.active, true),
          access,
          selfService ? ne(cleaningAssets.status, "ARCHIVED") : undefined,
        ),
      ),
    database
      .select({
        assetId: cleaningAssetReportedRiskFlags.assetId,
        riskFlagId: cleaningAssetReportedRiskFlags.riskFlagId,
      })
      .from(cleaningAssetReportedRiskFlags)
      .innerJoin(
        cleaningAssets,
        eq(cleaningAssetReportedRiskFlags.assetId, cleaningAssets.id),
      )
      .innerJoin(properties, eq(cleaningAssets.propertyId, properties.id))
      .where(
        and(
          eq(properties.customerId, customerId),
          eq(cleaningAssetReportedRiskFlags.active, true),
          access,
          selfService ? ne(cleaningAssets.status, "ARCHIVED") : undefined,
        ),
      ),
  ]);

  return {
    contacts: contactRows,
    links: linkRows,
    properties: propertyRows,
    areas: areaRows.map((row) => row.area),
    assets: assetRows.map((row) => row.asset),
    issueRows,
    riskRows,
  };
}

function idsByAsset<T extends { assetId: string }>(
  rows: readonly T[],
  id: (row: T) => number,
): ReadonlyMap<string, readonly number[]> {
  const values = new Map<string, number[]>();
  for (const row of rows) {
    const current = values.get(row.assetId) ?? [];
    current.push(id(row));
    values.set(row.assetId, current);
  }
  return values;
}

function propertiesFromGraph(rows: GraphRows): StaffProperty[] {
  const issues = idsByAsset(rows.issueRows, (row) => row.issueTypeId);
  const risks = idsByAsset(rows.riskRows, (row) => row.riskFlagId);
  const areasByProperty = new Map<string, PropertyArea[]>();
  for (const row of rows.areas) {
    const common = commonAreaRecord(row);
    const area: PropertyArea = { ...common, notes: row.notes };
    const existing = areasByProperty.get(row.propertyId) ?? [];
    existing.push(area);
    areasByProperty.set(row.propertyId, existing);
  }
  const assetsByProperty = new Map<string, StaffCleaningAsset[]>();
  for (const row of rows.assets) {
    const asset: StaffCleaningAsset = {
      ...commonAssetRecord(
        row,
        issues.get(row.id) ?? [],
        risks.get(row.id) ?? [],
      ),
      operationalNotes: row.operationalNotes,
    };
    const existing = assetsByProperty.get(row.propertyId) ?? [];
    existing.push(asset);
    assetsByProperty.set(row.propertyId, existing);
  }

  return rows.properties.map((row) => ({
    ...commonPropertyRecord(row),
    latitude: row.latitude,
    longitude: row.longitude,
    accessNotes: row.accessNotes,
    parkingNotes: row.parkingNotes,
    areas: areasByProperty.get(row.id) ?? [],
    cleaningAssets: assetsByProperty.get(row.id) ?? [],
  }));
}

function customerPropertiesFromGraph(rows: GraphRows): CustomerProperty[] {
  const issues = idsByAsset(rows.issueRows, (row) => row.issueTypeId);
  const risks = idsByAsset(rows.riskRows, (row) => row.riskFlagId);
  const areasByProperty = new Map<string, CustomerPropertyArea[]>();
  for (const row of rows.areas) {
    const existing = areasByProperty.get(row.propertyId) ?? [];
    existing.push(commonAreaRecord(row));
    areasByProperty.set(row.propertyId, existing);
  }
  const assetsByProperty = new Map<string, CleaningAssetCore[]>();
  for (const row of rows.assets) {
    const existing = assetsByProperty.get(row.propertyId) ?? [];
    existing.push(
      commonAssetRecord(row, issues.get(row.id) ?? [], risks.get(row.id) ?? []),
    );
    assetsByProperty.set(row.propertyId, existing);
  }

  return rows.properties.map((row) => ({
    ...commonPropertyRecord(row),
    areas: areasByProperty.get(row.id) ?? [],
    cleaningAssets: assetsByProperty.get(row.id) ?? [],
  }));
}

export async function loadStaffCustomer(
  database: Database,
  actorProfileId: string,
  customerId: string,
): Promise<StaffCustomerDetail | null> {
  const [row] = await database
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.id, customerId),
        activeActorPermissionSql(actorProfileId, "CUSTOMER_RECORDS_READ"),
      ),
    )
    .limit(1);
  if (!row) return null;

  const graph = await loadGraphRows(
    database,
    actorProfileId,
    customerId,
    "STAFF",
  );
  return {
    ...customerSummary(row),
    internalNotes: row.internalNotes,
    contacts: graph.contacts.map(contactRecord),
    identityLinks: graph.links.map(identityLinkRecord),
    properties: propertiesFromGraph(graph),
  };
}

export async function loadLinkedCustomer(
  database: Database,
  actorProfileId: string,
  customerId: string,
): Promise<CustomerSelfDetail | null> {
  const [row] = await database
    .select(customerSummarySelection)
    .from(customers)
    .where(
      and(
        eq(customers.id, customerId),
        ne(customers.status, "ARCHIVED"),
        linkedCustomerReadSql(actorProfileId, customerId),
      ),
    )
    .limit(1);
  if (!row) return null;

  const graph = await loadGraphRows(
    database,
    actorProfileId,
    customerId,
    "LINKED_CUSTOMER",
  );
  return {
    ...customerSummary(row as typeof customers.$inferSelect),
    contacts: graph.contacts.map(contactRecord),
    properties: customerPropertiesFromGraph(graph),
  };
}

type VersionedWriteRow = {
  result:
    CustomerCrmCreateResult["status"] | CustomerCrmMutationResult["status"];
  id: string | null;
  version: number | null;
  updatedAt: Date | string | null;
};

type IdentityLinkWriteRow = {
  result: CustomerIdentityLinkWriteResult["status"];
  id: string | null;
  changedAt: Date | string | null;
};

function dateValue(value: Date | string | null): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  throw new Error("The database did not return a mutation timestamp.");
}

function createResult(
  row: VersionedWriteRow | undefined,
): CustomerCrmCreateResult {
  if (!row) return { status: "NOT_FOUND_OR_FORBIDDEN" };
  if (row.result !== "CREATED") {
    if (
      row.result === "NOT_FOUND_OR_FORBIDDEN" ||
      row.result === "INVALID_REFERENCE" ||
      row.result === "CONFLICT"
    ) {
      return { status: row.result };
    }
    throw new Error("Unexpected create result.");
  }
  if (!row.id || row.version === null) {
    throw new Error("The database returned an incomplete create result.");
  }
  return {
    status: "CREATED",
    id: row.id,
    version: row.version,
    updatedAt: dateValue(row.updatedAt),
  };
}

function mutationResult(
  row: VersionedWriteRow | undefined,
): CustomerCrmMutationResult {
  if (!row) return { status: "NOT_FOUND_OR_FORBIDDEN" };
  if (row.result !== "CHANGED" && row.result !== "NO_CHANGE") {
    if (
      row.result === "NOT_FOUND_OR_FORBIDDEN" ||
      row.result === "INVALID_REFERENCE" ||
      row.result === "CONFLICT"
    ) {
      return { status: row.result };
    }
    throw new Error("Unexpected mutation result.");
  }
  if (!row.id || row.version === null) {
    throw new Error("The database returned an incomplete mutation result.");
  }
  return {
    status: row.result,
    id: row.id,
    version: row.version,
    updatedAt: dateValue(row.updatedAt),
  };
}

function identityLinkResult(
  row: IdentityLinkWriteRow | undefined,
): CustomerIdentityLinkWriteResult {
  if (!row) return { status: "NOT_FOUND_OR_FORBIDDEN" };
  if (row.result === "NOT_FOUND_OR_FORBIDDEN" || row.result === "CONFLICT") {
    return { status: row.result };
  }
  if (!row.id) {
    throw new Error(
      "The database returned an incomplete identity-link result.",
    );
  }
  return {
    status: row.result,
    id: row.id,
    changedAt: dateValue(row.changedAt),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

async function executeCreate(
  database: Database,
  statement: SQL,
): Promise<CustomerCrmCreateResult> {
  try {
    const result = await database.execute<VersionedWriteRow>(statement);
    return createResult(result.rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "CONFLICT" };
    throw error;
  }
}

async function executeMutation(
  database: Database,
  statement: SQL,
): Promise<CustomerCrmMutationResult> {
  const result = await database.execute<VersionedWriteRow>(statement);
  return mutationResult(result.rows[0]);
}

async function executeLockedCustomerMutation(
  database: Database,
  lock: SQL,
  statement: SQL,
): Promise<CustomerCrmMutationResult> {
  // READ COMMITTED takes a new snapshot for each statement. Acquiring the
  // aggregate lock first makes the mutation observe the result of an earlier
  // customer/contact mutation without changing customer metadata just to lock.
  const [, , result] = await database.batch([
    database.execute(sql`set transaction isolation level read committed`),
    database.execute(lock),
    database.execute<VersionedWriteRow>(statement),
  ]);

  return mutationResult(result.rows[0]);
}

function customerAggregateLockSql(
  actorProfileId: string,
  customerId: string,
): SQL {
  return sql`select customer.id
    from ${customers} customer
    where customer.id = ${customerId}::uuid
      and ${managementSql(actorProfileId)}
    for update of customer`;
}

function contactCustomerAggregateLockSql(
  actorProfileId: string,
  contactId: string,
): SQL {
  return sql`select customer.id
    from ${customerContacts} contact
    join ${customers} customer on customer.id = contact.customer_id
    where contact.id = ${contactId}::uuid
      and ${managementSql(actorProfileId)}
    for update of customer`;
}

function managementSql(actorProfileId: string): SQL {
  return activeActorPermissionSql(actorProfileId, "CUSTOMER_RECORDS_MANAGE");
}

function identityLinkManagementSql(actorProfileId: string): SQL {
  return sql`${managementSql(actorProfileId)}
    and ${activeActorPermissionSql(actorProfileId, "USER_ADMIN_MANAGE")}`;
}

export async function createCustomerRecord(
  database: Database,
  actorProfileId: string,
  input: CreateCustomerInput,
): Promise<CustomerCrmCreateResult> {
  const initialContact = input.initialContact;
  const hasInitialContact = initialContact !== undefined;
  const primaryEmail = input.primaryEmail ?? initialContact?.email ?? null;
  const primaryPhone = input.primaryPhone ?? initialContact?.phone ?? null;

  return executeCreate(
    database,
    sql`
    with authorized as materialized (
      select 1 as allowed
      where ${managementSql(actorProfileId)}
    ),
    created_customer as (
      insert into ${customers} (
        customer_type, display_name, legal_name, preferred_locale,
        primary_email, primary_phone, status, version, internal_notes,
        created_at, updated_at, created_by_profile_id, updated_by_profile_id
      )
      select
        ${input.customerType}, ${input.displayName}, ${input.legalName ?? null},
        ${input.preferredLocale}, ${primaryEmail}, ${primaryPhone},
        'ACTIVE', 1, ${input.internalNotes ?? null}, now(), now(),
        ${actorProfileId}::uuid, ${actorProfileId}::uuid
      from authorized
      where ${input.customerType} <> 'BUSINESS' or ${hasInitialContact}
      returning id, version, updated_at
    ),
    created_contact as (
      insert into ${customerContacts} (
        customer_id, contact_name, email, phone, role_title, is_primary,
        preferred_contact_method, locale, active, version, created_at,
        updated_at, created_by_profile_id, updated_by_profile_id
      )
      select
        created_customer.id, ${initialContact?.contactName ?? null},
        ${initialContact?.email ?? null}, ${initialContact?.phone ?? null},
        ${initialContact?.roleTitle ?? null}, true,
        ${initialContact?.preferredContactMethod ?? "NO_PREFERENCE"},
        ${initialContact?.locale ?? input.preferredLocale}, true, 1, now(), now(),
        ${actorProfileId}::uuid, ${actorProfileId}::uuid
      from created_customer
      where ${hasInitialContact}
      returning id
    ),
    decision as materialized (
      select case
        when not exists (select 1 from authorized)
          then 'NOT_FOUND_OR_FORBIDDEN'
        when ${input.customerType} = 'BUSINESS' and not ${hasInitialContact}
          then 'INVALID_REFERENCE'
        when exists (select 1 from created_customer)
          and (not ${hasInitialContact} or exists (select 1 from created_contact))
          then 'CREATED'
        else 'CONFLICT'
      end as result
    )
    select
      decision.result::text as result,
      created_customer.id,
      created_customer.version,
      created_customer.updated_at as "updatedAt"
    from decision
    left join created_customer on true
  `,
  );
}

export async function updateCustomerRecord(
  database: Database,
  actorProfileId: string,
  input: UpdateCustomerInput,
): Promise<CustomerCrmMutationResult> {
  return executeLockedCustomerMutation(
    database,
    customerAggregateLockSql(actorProfileId, input.customerId),
    sql`
    with authorized as materialized (
      select 1 as allowed where ${managementSql(actorProfileId)}
    ),
    target as materialized (
      select customer.*
      from ${customers} customer
      where customer.id = ${input.customerId}::uuid
        and customer.status <> 'ARCHIVED'
    ),
    decision as materialized (
      select case
        when not exists (select 1 from authorized)
          or not exists (select 1 from target)
          then 'NOT_FOUND_OR_FORBIDDEN'
        when (select version from target) <> ${input.expectedVersion}
          then 'CONFLICT'
        when (case when ${input.customerType !== undefined}
          then ${input.customerType ?? null}
          else (select customer_type from target) end) = 'BUSINESS'
          and not exists (
            select 1
            from ${customerContacts} primary_contact
            where primary_contact.customer_id = ${input.customerId}::uuid
              and primary_contact.active = true
              and primary_contact.is_primary = true
          ) then 'INVALID_REFERENCE'
        when not (
          (case when ${input.customerType !== undefined}
            then ${input.customerType ?? null} else (select customer_type from target) end)
              is distinct from (select customer_type from target)
          or (case when ${input.displayName !== undefined}
            then ${input.displayName ?? null} else (select display_name from target) end)
              is distinct from (select display_name from target)
          or (case when ${input.legalName !== undefined}
            then ${input.legalName ?? null} else (select legal_name from target) end)
              is distinct from (select legal_name from target)
          or (case when ${input.preferredLocale !== undefined}
            then ${input.preferredLocale ?? null} else (select preferred_locale from target) end)
              is distinct from (select preferred_locale from target)
          or (case when ${input.primaryEmail !== undefined}
            then ${input.primaryEmail ?? null} else (select primary_email from target) end)
              is distinct from (select primary_email from target)
          or (case when ${input.primaryPhone !== undefined}
            then ${input.primaryPhone ?? null} else (select primary_phone from target) end)
              is distinct from (select primary_phone from target)
          or (case when ${input.internalNotes !== undefined}
            then ${input.internalNotes ?? null} else (select internal_notes from target) end)
              is distinct from (select internal_notes from target)
        ) then 'NO_CHANGE'
        else 'CHANGED'
      end as result
    ),
    changed as (
      update ${customers} customer
      set
        customer_type = case when ${input.customerType !== undefined}
          then ${input.customerType ?? null} else customer.customer_type end,
        display_name = case when ${input.displayName !== undefined}
          then ${input.displayName ?? null} else customer.display_name end,
        legal_name = case when ${input.legalName !== undefined}
          then ${input.legalName ?? null} else customer.legal_name end,
        preferred_locale = case when ${input.preferredLocale !== undefined}
          then ${input.preferredLocale ?? null} else customer.preferred_locale end,
        primary_email = case when ${input.primaryEmail !== undefined}
          then ${input.primaryEmail ?? null} else customer.primary_email end,
        primary_phone = case when ${input.primaryPhone !== undefined}
          then ${input.primaryPhone ?? null} else customer.primary_phone end,
        internal_notes = case when ${input.internalNotes !== undefined}
          then ${input.internalNotes ?? null} else customer.internal_notes end,
        version = customer.version + 1,
        updated_at = now(),
        updated_by_profile_id = ${actorProfileId}::uuid
      from decision
      where customer.id = ${input.customerId}::uuid
        and customer.version = ${input.expectedVersion}
        and decision.result = 'CHANGED'
      returning customer.id, customer.version, customer.updated_at
    ),
    final_result as (
      select case
        when decision.result = 'CHANGED' and not exists (select 1 from changed)
          then 'CONFLICT'
        else decision.result
      end as result
      from decision
    )
    select
      final_result.result::text as result,
      coalesce(changed.id, target.id) as id,
      coalesce(changed.version, target.version) as version,
      coalesce(changed.updated_at, target.updated_at) as "updatedAt"
    from final_result
    left join target on true
    left join changed on true
    `,
  );
}

export async function archiveCustomerRecord(
  database: Database,
  actorProfileId: string,
  input: ArchiveCustomerInput,
): Promise<CustomerCrmMutationResult> {
  return executeMutation(
    database,
    sql`
    with authorized as materialized (
      select 1 as allowed where ${managementSql(actorProfileId)}
    ),
    target as materialized (
      select customer.id, customer.status, customer.version, customer.updated_at
      from ${customers} customer
      where customer.id = ${input.customerId}::uuid
    ),
    decision as materialized (
      select case
        when not exists (select 1 from authorized)
          or not exists (select 1 from target)
          then 'NOT_FOUND_OR_FORBIDDEN'
        when (select version from target) <> ${input.expectedVersion}
          then 'CONFLICT'
        when (select status from target) = 'ARCHIVED' then 'NO_CHANGE'
        else 'CHANGED'
      end as result
    ),
    changed as (
      update ${customers} customer
      set status = 'ARCHIVED', version = customer.version + 1,
          updated_at = now(), updated_by_profile_id = ${actorProfileId}::uuid
      from decision
      where customer.id = ${input.customerId}::uuid
        and customer.version = ${input.expectedVersion}
        and decision.result = 'CHANGED'
      returning customer.id, customer.version, customer.updated_at
    ),
    final_result as (
      select case
        when decision.result = 'CHANGED' and not exists (select 1 from changed)
          then 'CONFLICT'
        else decision.result
      end as result
      from decision
    )
    select
      final_result.result::text as result,
      coalesce(changed.id, target.id) as id,
      coalesce(changed.version, target.version) as version,
      coalesce(changed.updated_at, target.updated_at) as "updatedAt"
    from final_result
    left join target on true
    left join changed on true
  `,
  );
}

export async function createCustomerContact(
  database: Database,
  actorProfileId: string,
  input: CreateContactInput,
): Promise<CustomerCrmCreateResult> {
  return executeCreate(
    database,
    sql`
    with authorized as materialized (
      select 1 as allowed where ${managementSql(actorProfileId)}
    ),
    target_customer as materialized (
      select customer.id
      from ${customers} customer
      where customer.id = ${input.customerId}::uuid
        and customer.status <> 'ARCHIVED'
    ),
    demoted as (
      update ${customerContacts} contact
      set is_primary = false,
          version = contact.version + 1,
          updated_at = now(),
          updated_by_profile_id = ${actorProfileId}::uuid
      from target_customer, authorized
      where ${input.isPrimary}
        and contact.customer_id = target_customer.id
        and contact.active = true
        and contact.is_primary = true
      returning contact.id
    ),
    created as (
      insert into ${customerContacts} (
        customer_id, contact_name, email, phone, role_title, is_primary,
        preferred_contact_method, locale, active, version, created_at,
        updated_at, created_by_profile_id, updated_by_profile_id
      )
      select
        target_customer.id, ${input.contactName}, ${input.email ?? null},
        ${input.phone ?? null}, ${input.roleTitle ?? null}, ${input.isPrimary},
        ${input.preferredContactMethod}, ${input.locale}, true, 1, now(), now(),
        ${actorProfileId}::uuid, ${actorProfileId}::uuid
      from target_customer, authorized,
        (select count(*) as demoted_count from demoted) demotion_barrier
      returning id, version, updated_at
    ),
    decision as materialized (
      select case
        when not exists (select 1 from authorized)
          or not exists (select 1 from target_customer)
          then 'NOT_FOUND_OR_FORBIDDEN'
        when exists (select 1 from created) then 'CREATED'
        else 'CONFLICT'
      end as result
    )
    select
      decision.result::text as result,
      created.id,
      created.version,
      created.updated_at as "updatedAt"
    from decision
    left join created on true
  `,
  );
}

export async function archiveCustomerContact(
  database: Database,
  actorProfileId: string,
  input: ArchiveContactInput,
): Promise<CustomerCrmMutationResult> {
  return executeLockedCustomerMutation(
    database,
    contactCustomerAggregateLockSql(actorProfileId, input.contactId),
    sql`
    with authorized as materialized (
      select 1 as allowed where ${managementSql(actorProfileId)}
    ),
    target as materialized (
      select
        contact.id, contact.active, contact.is_primary, contact.version,
        contact.updated_at, contact.customer_id, customer.customer_type
      from ${customerContacts} contact
      join ${customers} customer on customer.id = contact.customer_id
      where contact.id = ${input.contactId}::uuid
    ),
    decision as materialized (
      select case
        when not exists (select 1 from authorized)
          or not exists (select 1 from target)
          then 'NOT_FOUND_OR_FORBIDDEN'
        when (select version from target) <> ${input.expectedVersion}
          then 'CONFLICT'
        when (select active from target) = false then 'NO_CHANGE'
        when (select is_primary from target) = true
          and (select customer_type from target) = 'BUSINESS'
          then 'INVALID_REFERENCE'
        else 'CHANGED'
      end as result
    ),
    changed as (
      update ${customerContacts} contact
      set active = false, is_primary = false,
          version = contact.version + 1,
          updated_at = now(), updated_by_profile_id = ${actorProfileId}::uuid
      from decision
      where contact.id = ${input.contactId}::uuid
        and contact.version = ${input.expectedVersion}
        and decision.result = 'CHANGED'
      returning contact.id, contact.version, contact.updated_at
    ),
    final_result as (
      select case
        when decision.result = 'CHANGED' and not exists (select 1 from changed)
          then 'CONFLICT'
        else decision.result
      end as result
      from decision
    )
    select
      final_result.result::text as result,
      coalesce(changed.id, target.id) as id,
      coalesce(changed.version, target.version) as version,
      coalesce(changed.updated_at, target.updated_at) as "updatedAt"
    from final_result
    left join target on true
    left join changed on true
    `,
  );
}

export async function createPropertyRecord(
  database: Database,
  actorProfileId: string,
  input: CreatePropertyInput,
): Promise<CustomerCrmCreateResult> {
  return executeCreate(
    database,
    sql`
    with authorized as materialized (
      select 1 as allowed where ${managementSql(actorProfileId)}
    ),
    target_customer as materialized (
      select customer.id
      from ${customers} customer
      where customer.id = ${input.customerId}::uuid
        and customer.status <> 'ARCHIVED'
    ),
    reference_valid as materialized (
      select 1 as valid
      where ${input.serviceZoneId === undefined || input.serviceZoneId === null}
        or exists (
          select 1 from ${travelZones} zone
          where zone.id = ${input.serviceZoneId ?? null}
            and zone.active = true
        )
    ),
    created as (
      insert into ${properties} (
        customer_id, property_type, label, city, district, street_address,
        postal_code, latitude, longitude, access_notes, parking_notes,
        service_zone_id, status, version, created_at, updated_at,
        created_by_profile_id, updated_by_profile_id
      )
      select
        target_customer.id, ${input.propertyType}, ${input.label}, ${input.city},
        ${input.district ?? null}, ${input.streetAddress},
        ${input.postalCode ?? null}, ${input.latitude ?? null},
        ${input.longitude ?? null}, ${input.accessNotes ?? null},
        ${input.parkingNotes ?? null}, ${input.serviceZoneId ?? null},
        'ACTIVE', 1, now(), now(), ${actorProfileId}::uuid,
        ${actorProfileId}::uuid
      from target_customer, authorized, reference_valid
      returning id, version, updated_at
    ),
    decision as materialized (
      select case
        when not exists (select 1 from authorized)
          or not exists (select 1 from target_customer)
          then 'NOT_FOUND_OR_FORBIDDEN'
        when not exists (select 1 from reference_valid)
          then 'INVALID_REFERENCE'
        when exists (select 1 from created) then 'CREATED'
        else 'CONFLICT'
      end as result
    )
    select
      decision.result::text as result,
      created.id,
      created.version,
      created.updated_at as "updatedAt"
    from decision
    left join created on true
  `,
  );
}

export async function updatePropertyRecord(
  database: Database,
  actorProfileId: string,
  input: UpdatePropertyInput,
): Promise<CustomerCrmMutationResult> {
  return executeMutation(
    database,
    sql`
    with authorized as materialized (
      select 1 as allowed where ${managementSql(actorProfileId)}
    ),
    target as materialized (
      select property.*
      from ${properties} property
      join ${customers} customer on customer.id = property.customer_id
      where property.id = ${input.propertyId}::uuid
        and property.status <> 'ARCHIVED'
        and customer.status <> 'ARCHIVED'
    ),
    reference_valid as materialized (
      select 1 as valid
      where ${input.serviceZoneId === undefined || input.serviceZoneId === null}
        or exists (
          select 1 from target
          where service_zone_id = ${input.serviceZoneId ?? null}
        )
        or exists (
          select 1 from ${travelZones} zone
          where zone.id = ${input.serviceZoneId ?? null}
            and zone.active = true
        )
    ),
    decision as materialized (
      select case
        when not exists (select 1 from authorized)
          or not exists (select 1 from target)
          then 'NOT_FOUND_OR_FORBIDDEN'
        when (select version from target) <> ${input.expectedVersion}
          then 'CONFLICT'
        when not exists (select 1 from reference_valid)
          then 'INVALID_REFERENCE'
        when not (
          (case when ${input.propertyType !== undefined}
            then ${input.propertyType ?? null} else (select property_type from target) end)
              is distinct from (select property_type from target)
          or (case when ${input.label !== undefined}
            then ${input.label ?? null} else (select label from target) end)
              is distinct from (select label from target)
          or (case when ${input.city !== undefined}
            then ${input.city ?? null} else (select city from target) end)
              is distinct from (select city from target)
          or (case when ${input.district !== undefined}
            then ${input.district ?? null} else (select district from target) end)
              is distinct from (select district from target)
          or (case when ${input.streetAddress !== undefined}
            then ${input.streetAddress ?? null} else (select street_address from target) end)
              is distinct from (select street_address from target)
          or (case when ${input.postalCode !== undefined}
            then ${input.postalCode ?? null} else (select postal_code from target) end)
              is distinct from (select postal_code from target)
          or (case when ${input.latitude !== undefined}
            then ${input.latitude ?? null} else (select latitude from target) end)
              is distinct from (select latitude from target)
          or (case when ${input.longitude !== undefined}
            then ${input.longitude ?? null} else (select longitude from target) end)
              is distinct from (select longitude from target)
          or (case when ${input.accessNotes !== undefined}
            then ${input.accessNotes ?? null} else (select access_notes from target) end)
              is distinct from (select access_notes from target)
          or (case when ${input.parkingNotes !== undefined}
            then ${input.parkingNotes ?? null} else (select parking_notes from target) end)
              is distinct from (select parking_notes from target)
          or (case when ${input.serviceZoneId !== undefined}
            then ${input.serviceZoneId ?? null} else (select service_zone_id from target) end)
              is distinct from (select service_zone_id from target)
        ) then 'NO_CHANGE'
        else 'CHANGED'
      end as result
    ),
    changed as (
      update ${properties} property
      set
        property_type = case when ${input.propertyType !== undefined}
          then ${input.propertyType ?? null} else property.property_type end,
        label = case when ${input.label !== undefined}
          then ${input.label ?? null} else property.label end,
        city = case when ${input.city !== undefined}
          then ${input.city ?? null} else property.city end,
        district = case when ${input.district !== undefined}
          then ${input.district ?? null} else property.district end,
        street_address = case when ${input.streetAddress !== undefined}
          then ${input.streetAddress ?? null} else property.street_address end,
        postal_code = case when ${input.postalCode !== undefined}
          then ${input.postalCode ?? null} else property.postal_code end,
        latitude = case when ${input.latitude !== undefined}
          then ${input.latitude ?? null} else property.latitude end,
        longitude = case when ${input.longitude !== undefined}
          then ${input.longitude ?? null} else property.longitude end,
        access_notes = case when ${input.accessNotes !== undefined}
          then ${input.accessNotes ?? null} else property.access_notes end,
        parking_notes = case when ${input.parkingNotes !== undefined}
          then ${input.parkingNotes ?? null} else property.parking_notes end,
        service_zone_id = case when ${input.serviceZoneId !== undefined}
          then ${input.serviceZoneId ?? null} else property.service_zone_id end,
        version = property.version + 1,
        updated_at = now(), updated_by_profile_id = ${actorProfileId}::uuid
      from decision
      where property.id = ${input.propertyId}::uuid
        and property.version = ${input.expectedVersion}
        and decision.result = 'CHANGED'
      returning property.id, property.version, property.updated_at
    ),
    final_result as (
      select case
        when decision.result = 'CHANGED' and not exists (select 1 from changed)
          then 'CONFLICT'
        else decision.result
      end as result
      from decision
    )
    select
      final_result.result::text as result,
      coalesce(changed.id, target.id) as id,
      coalesce(changed.version, target.version) as version,
      coalesce(changed.updated_at, target.updated_at) as "updatedAt"
    from final_result
    left join target on true
    left join changed on true
  `,
  );
}

export async function archivePropertyRecord(
  database: Database,
  actorProfileId: string,
  input: ArchivePropertyInput,
): Promise<CustomerCrmMutationResult> {
  return executeMutation(
    database,
    sql`
    with authorized as materialized (
      select 1 as allowed where ${managementSql(actorProfileId)}
    ),
    target as materialized (
      select property.id, property.status, property.version, property.updated_at
      from ${properties} property
      join ${customers} customer on customer.id = property.customer_id
      where property.id = ${input.propertyId}::uuid
    ),
    decision as materialized (
      select case
        when not exists (select 1 from authorized)
          or not exists (select 1 from target)
          then 'NOT_FOUND_OR_FORBIDDEN'
        when (select version from target) <> ${input.expectedVersion}
          then 'CONFLICT'
        when (select status from target) = 'ARCHIVED' then 'NO_CHANGE'
        else 'CHANGED'
      end as result
    ),
    changed as (
      update ${properties} property
      set status = 'ARCHIVED', version = property.version + 1,
          updated_at = now(), updated_by_profile_id = ${actorProfileId}::uuid
      from decision
      where property.id = ${input.propertyId}::uuid
        and property.version = ${input.expectedVersion}
        and decision.result = 'CHANGED'
      returning property.id, property.version, property.updated_at
    ),
    final_result as (
      select case
        when decision.result = 'CHANGED' and not exists (select 1 from changed)
          then 'CONFLICT'
        else decision.result
      end as result
      from decision
    )
    select
      final_result.result::text as result,
      coalesce(changed.id, target.id) as id,
      coalesce(changed.version, target.version) as version,
      coalesce(changed.updated_at, target.updated_at) as "updatedAt"
    from final_result
    left join target on true
    left join changed on true
  `,
  );
}

export async function createPropertyAreaRecord(
  database: Database,
  actorProfileId: string,
  input: CreatePropertyAreaInput,
): Promise<CustomerCrmCreateResult> {
  return executeCreate(
    database,
    sql`
    with authorized as materialized (
      select 1 as allowed where ${managementSql(actorProfileId)}
    ),
    target_property as materialized (
      select property.id
      from ${properties} property
      join ${customers} customer on customer.id = property.customer_id
      where property.id = ${input.propertyId}::uuid
        and property.status <> 'ARCHIVED'
        and customer.status <> 'ARCHIVED'
    ),
    created as (
      insert into ${propertyAreas} (
        property_id, area_type, custom_label, floor_level, notes, active,
        version, created_at, updated_at, created_by_profile_id,
        updated_by_profile_id
      )
      select
        target_property.id, ${input.areaType}, ${input.customLabel ?? null},
        ${input.floorLevel ?? null}, ${input.notes ?? null}, true, 1, now(), now(),
        ${actorProfileId}::uuid, ${actorProfileId}::uuid
      from target_property, authorized
      returning id, version, updated_at
    ),
    decision as materialized (
      select case
        when not exists (select 1 from authorized)
          or not exists (select 1 from target_property)
          then 'NOT_FOUND_OR_FORBIDDEN'
        when exists (select 1 from created) then 'CREATED'
        else 'CONFLICT'
      end as result
    )
    select
      decision.result::text as result,
      created.id,
      created.version,
      created.updated_at as "updatedAt"
    from decision
    left join created on true
  `,
  );
}

export async function archivePropertyAreaRecord(
  database: Database,
  actorProfileId: string,
  input: ArchivePropertyAreaInput,
): Promise<CustomerCrmMutationResult> {
  return executeMutation(
    database,
    sql`
    with authorized as materialized (
      select 1 as allowed where ${managementSql(actorProfileId)}
    ),
    target as materialized (
      select area.id, area.active, area.version, area.updated_at
      from ${propertyAreas} area
      join ${properties} property on property.id = area.property_id
      join ${customers} customer on customer.id = property.customer_id
      where area.id = ${input.areaId}::uuid
    ),
    decision as materialized (
      select case
        when not exists (select 1 from authorized)
          or not exists (select 1 from target)
          then 'NOT_FOUND_OR_FORBIDDEN'
        when (select version from target) <> ${input.expectedVersion}
          then 'CONFLICT'
        when (select active from target) = false then 'NO_CHANGE'
        else 'CHANGED'
      end as result
    ),
    changed as (
      update ${propertyAreas} area
      set active = false, version = area.version + 1,
          updated_at = now(), updated_by_profile_id = ${actorProfileId}::uuid
      from decision
      where area.id = ${input.areaId}::uuid
        and area.version = ${input.expectedVersion}
        and decision.result = 'CHANGED'
      returning area.id, area.version, area.updated_at
    ),
    final_result as (
      select case
        when decision.result = 'CHANGED' and not exists (select 1 from changed)
          then 'CONFLICT'
        else decision.result
      end as result
      from decision
    )
    select
      final_result.result::text as result,
      coalesce(changed.id, target.id) as id,
      coalesce(changed.version, target.version) as version,
      coalesce(changed.updated_at, target.updated_at) as "updatedAt"
    from final_result
    left join target on true
    left join changed on true
  `,
  );
}

function requestedIntegerRows(ids: readonly number[]): SQL {
  if (ids.length === 0) {
    return sql`select null::integer as id where false`;
  }
  return sql`select unnest(array[
    ${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )}
  ]::integer[]) as id`;
}

export async function createCleaningAssetRecord(
  database: Database,
  actorProfileId: string,
  input: CreateCleaningAssetInput,
): Promise<CustomerCrmCreateResult> {
  const requestedIssues = requestedIntegerRows(input.reportedIssueTypeIds);
  const requestedRisks = requestedIntegerRows(input.reportedRiskFlagIds);

  return executeCreate(
    database,
    sql`
    with authorized as materialized (
      select 1 as allowed where ${managementSql(actorProfileId)}
    ),
    target_property as materialized (
      select property.id
      from ${properties} property
      join ${customers} customer on customer.id = property.customer_id
      where property.id = ${input.propertyId}::uuid
        and property.status <> 'ARCHIVED'
        and customer.status <> 'ARCHIVED'
    ),
    requested_issues(id) as materialized (${requestedIssues}),
    requested_risks(id) as materialized (${requestedRisks}),
    reference_valid as materialized (
      select 1 as valid
      where exists (
        select 1 from ${cleaningItemTypes} item_type
        where item_type.id = ${input.cleaningItemTypeId}
          and item_type.active = true
      )
        and (
          ${input.areaId === undefined || input.areaId === null}
          or exists (
            select 1 from ${propertyAreas} area
            where area.id = ${input.areaId ?? null}::uuid
              and area.property_id = ${input.propertyId}::uuid
              and area.active = true
          )
        )
        and (
          ${input.reportedFibreMaterialId === undefined || input.reportedFibreMaterialId === null}
          or exists (
            select 1 from ${fibreMaterials} fibre
            where fibre.id = ${input.reportedFibreMaterialId ?? null}
              and fibre.active = true
          )
        )
        and (
          ${input.reportedSurfaceConstructionId === undefined || input.reportedSurfaceConstructionId === null}
          or exists (
            select 1 from ${surfaceConstructions} construction
            where construction.id = ${input.reportedSurfaceConstructionId ?? null}
              and construction.active = true
          )
        )
        and (
          ${input.customerReportedConditionLevelId === undefined || input.customerReportedConditionLevelId === null}
          or exists (
            select 1 from ${conditionLevels} condition_level
            where condition_level.id = ${input.customerReportedConditionLevelId ?? null}
              and condition_level.active = true
          )
        )
        and (
          select count(*) from requested_issues requested
          join ${issueTypes} issue_type on issue_type.id = requested.id
          where issue_type.active = true
        ) = ${input.reportedIssueTypeIds.length}
        and (
          select count(*) from requested_risks requested
          join ${riskFlags} risk_flag on risk_flag.id = requested.id
          where risk_flag.active = true
        ) = ${input.reportedRiskFlagIds.length}
    ),
    decision as materialized (
      select case
        when not exists (select 1 from authorized)
          or not exists (select 1 from target_property)
          then 'NOT_FOUND_OR_FORBIDDEN'
        when not exists (select 1 from reference_valid)
          then 'INVALID_REFERENCE'
        else 'CREATED'
      end as result
    ),
    created as (
      insert into ${cleaningAssets} (
        property_id, area_id, cleaning_item_type_id, label,
        approximate_length_cm, approximate_width_cm,
        approximate_area_hundredths_m2, approximate_seat_count,
        reported_fibre_material_id, reported_surface_construction_id,
        customer_reported_condition_level_id, customer_condition_notes,
        colour_appearance_notes, approximate_acquisition_year, status, version,
        operational_notes, created_at, updated_at, created_by_profile_id,
        updated_by_profile_id
      )
      select
        target_property.id, ${input.areaId ?? null}::uuid,
        ${input.cleaningItemTypeId}, ${input.label},
        ${input.approximateLengthCm ?? null},
        ${input.approximateWidthCm ?? null},
        ${input.approximateAreaHundredthsM2 ?? null},
        ${input.approximateSeatCount ?? null},
        ${input.reportedFibreMaterialId ?? null},
        ${input.reportedSurfaceConstructionId ?? null},
        ${input.customerReportedConditionLevelId ?? null},
        ${input.customerConditionNotes ?? null},
        ${input.colourAppearanceNotes ?? null},
        ${input.approximateAcquisitionYear ?? null}, 'ACTIVE', 1,
        ${input.operationalNotes ?? null}, now(), now(),
        ${actorProfileId}::uuid, ${actorProfileId}::uuid
      from target_property, authorized, reference_valid, decision
      where decision.result = 'CREATED'
      returning id, version, updated_at
    ),
    created_issues as (
      insert into ${cleaningAssetReportedIssues} (
        cleaning_asset_id, issue_type_id, notes, active, created_at, updated_at,
        created_by_profile_id, updated_by_profile_id
      )
      select created.id, requested.id, null, true, now(), now(),
        ${actorProfileId}::uuid, ${actorProfileId}::uuid
      from created, requested_issues requested
      returning cleaning_asset_id
    ),
    created_risks as (
      insert into ${cleaningAssetReportedRiskFlags} (
        cleaning_asset_id, risk_flag_id, notes, active, created_at, updated_at,
        created_by_profile_id, updated_by_profile_id
      )
      select created.id, requested.id, null, true, now(), now(),
        ${actorProfileId}::uuid, ${actorProfileId}::uuid
      from created, requested_risks requested
      returning cleaning_asset_id
    ),
    final_result as materialized (
      select case
        when decision.result <> 'CREATED' then decision.result
        when not exists (select 1 from created) then 'CONFLICT'
        when (select count(*) from created_issues) <> ${input.reportedIssueTypeIds.length}
          then 'CONFLICT'
        when (select count(*) from created_risks) <> ${input.reportedRiskFlagIds.length}
          then 'CONFLICT'
        else 'CREATED'
      end as result
      from decision
    )
    select
      final_result.result::text as result,
      created.id,
      created.version,
      created.updated_at as "updatedAt"
    from final_result
    left join created on true
  `,
  );
}

export async function archiveCleaningAssetRecord(
  database: Database,
  actorProfileId: string,
  input: ArchiveCleaningAssetInput,
): Promise<CustomerCrmMutationResult> {
  return executeMutation(
    database,
    sql`
    with authorized as materialized (
      select 1 as allowed where ${managementSql(actorProfileId)}
    ),
    target as materialized (
      select asset.id, asset.status, asset.version, asset.updated_at
      from ${cleaningAssets} asset
      join ${properties} property on property.id = asset.property_id
      join ${customers} customer on customer.id = property.customer_id
      where asset.id = ${input.assetId}::uuid
    ),
    decision as materialized (
      select case
        when not exists (select 1 from authorized)
          or not exists (select 1 from target)
          then 'NOT_FOUND_OR_FORBIDDEN'
        when (select version from target) <> ${input.expectedVersion}
          then 'CONFLICT'
        when (select status from target) = 'ARCHIVED' then 'NO_CHANGE'
        else 'CHANGED'
      end as result
    ),
    changed as (
      update ${cleaningAssets} asset
      set status = 'ARCHIVED', version = asset.version + 1,
          updated_at = now(), updated_by_profile_id = ${actorProfileId}::uuid
      from decision
      where asset.id = ${input.assetId}::uuid
        and asset.version = ${input.expectedVersion}
        and decision.result = 'CHANGED'
      returning asset.id, asset.version, asset.updated_at
    ),
    final_result as (
      select case
        when decision.result = 'CHANGED' and not exists (select 1 from changed)
          then 'CONFLICT'
        else decision.result
      end as result
      from decision
    )
    select
      final_result.result::text as result,
      coalesce(changed.id, target.id) as id,
      coalesce(changed.version, target.version) as version,
      coalesce(changed.updated_at, target.updated_at) as "updatedAt"
    from final_result
    left join target on true
    left join changed on true
  `,
  );
}

export async function linkCustomerIdentityRecord(
  database: Database,
  actorProfileId: string,
  input: LinkCustomerIdentityInput,
): Promise<CustomerIdentityLinkWriteResult> {
  try {
    const result = await database.execute<IdentityLinkWriteRow>(sql`
      with authorized as materialized (
        select 1 as allowed where ${identityLinkManagementSql(actorProfileId)}
      ),
      target_customer as materialized (
        select customer.id
        from ${customers} customer
        where customer.id = ${input.customerId}::uuid
          and customer.status <> 'ARCHIVED'
      ),
      target_profile as materialized (
        select profile.id
        from ${userProfiles} profile
        where profile.id = ${input.userProfileId}::uuid
          and profile.status = 'ACTIVE'
      ),
      current_link as materialized (
        select link.id, link.relationship_type, link.created_at
        from ${customerIdentityLinks} link
        where link.customer_id = ${input.customerId}::uuid
          and link.user_profile_id = ${input.userProfileId}::uuid
          and link.active = true
          and link.revoked_at is null
      ),
      decision as materialized (
        select case
          when not exists (select 1 from authorized)
            or not exists (select 1 from target_customer)
            or not exists (select 1 from target_profile)
            then 'NOT_FOUND_OR_FORBIDDEN'
          when exists (
            select 1 from current_link
            where relationship_type = ${input.relationshipType}
          ) then 'NO_CHANGE'
          when exists (select 1 from current_link) then 'CONFLICT'
          else 'CREATED'
        end as result
      ),
      created as (
        insert into ${customerIdentityLinks} (
          user_profile_id, customer_id, relationship_type, active,
          created_at, created_by_profile_id, revoked_at, revoked_by_profile_id
        )
        select
          target_profile.id, target_customer.id, ${input.relationshipType},
          true, now(), ${actorProfileId}::uuid, null, null
        from target_profile, target_customer, authorized, decision
        where decision.result = 'CREATED'
        returning id, created_at
      ),
      final_result as materialized (
        select case
          when decision.result = 'CREATED'
            and not exists (select 1 from created) then 'CONFLICT'
          else decision.result
        end as result
        from decision
      )
      select
        final_result.result::text as result,
        coalesce(created.id, current_link.id) as id,
        coalesce(created.created_at, current_link.created_at) as "changedAt"
      from final_result
      left join current_link on true
      left join created on true
    `);
    return identityLinkResult(result.rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "CONFLICT" };
    throw error;
  }
}

export async function revokeCustomerIdentityRecord(
  database: Database,
  actorProfileId: string,
  input: RevokeCustomerIdentityLinkInput,
): Promise<CustomerIdentityLinkWriteResult> {
  const result = await database.execute<IdentityLinkWriteRow>(sql`
    with authorized as materialized (
      select 1 as allowed where ${identityLinkManagementSql(actorProfileId)}
    ),
    target as materialized (
      select link.id, link.active, link.created_at, link.revoked_at
      from ${customerIdentityLinks} link
      join ${customers} customer on customer.id = link.customer_id
      where link.id = ${input.linkId}::uuid
    ),
    decision as materialized (
      select case
        when not exists (select 1 from authorized)
          or not exists (select 1 from target)
          then 'NOT_FOUND_OR_FORBIDDEN'
        when (select active from target) = false then 'NO_CHANGE'
        else 'CHANGED'
      end as result
    ),
    changed as (
      update ${customerIdentityLinks} link
      set active = false, revoked_at = now(),
          revoked_by_profile_id = ${actorProfileId}::uuid
      from decision
      where link.id = ${input.linkId}::uuid
        and link.active = true
        and link.revoked_at is null
        and decision.result = 'CHANGED'
      returning link.id, link.revoked_at
    ),
    final_result as materialized (
      select case
        when decision.result = 'CHANGED' and not exists (select 1 from changed)
          then 'NO_CHANGE'
        else decision.result
      end as result
      from decision
    )
    select
      final_result.result::text as result,
      coalesce(changed.id, target.id) as id,
      coalesce(changed.revoked_at, target.revoked_at, target.created_at)
        as "changedAt"
    from final_result
    left join target on true
    left join changed on true
  `);
  return identityLinkResult(result.rows[0]);
}

export type DatabaseCustomerCrmRepository = CustomerCrmRepository;

export function createDatabaseCustomerCrmRepository(
  database: Database,
): DatabaseCustomerCrmRepository {
  return {
    listStaffCustomers: (actorProfileId, input) =>
      listStaffCustomers(database, actorProfileId, input),
    listLinkedCustomers: (actorProfileId) =>
      listLinkedCustomers(database, actorProfileId),
    getStaffCustomer: (actorProfileId, customerId) =>
      loadStaffCustomer(database, actorProfileId, customerId),
    getLinkedCustomer: (actorProfileId, customerId) =>
      loadLinkedCustomer(database, actorProfileId, customerId),
    createCustomer: (actorProfileId, input) =>
      createCustomerRecord(database, actorProfileId, input),
    updateCustomer: (actorProfileId, input) =>
      updateCustomerRecord(database, actorProfileId, input),
    archiveCustomer: (actorProfileId, input) =>
      archiveCustomerRecord(database, actorProfileId, input),
    createContact: (actorProfileId, input) =>
      createCustomerContact(database, actorProfileId, input),
    archiveContact: (actorProfileId, input) =>
      archiveCustomerContact(database, actorProfileId, input),
    createProperty: (actorProfileId, input) =>
      createPropertyRecord(database, actorProfileId, input),
    updateProperty: (actorProfileId, input) =>
      updatePropertyRecord(database, actorProfileId, input),
    archiveProperty: (actorProfileId, input) =>
      archivePropertyRecord(database, actorProfileId, input),
    createPropertyArea: (actorProfileId, input) =>
      createPropertyAreaRecord(database, actorProfileId, input),
    archivePropertyArea: (actorProfileId, input) =>
      archivePropertyAreaRecord(database, actorProfileId, input),
    createCleaningAsset: (actorProfileId, input) =>
      createCleaningAssetRecord(database, actorProfileId, input),
    archiveCleaningAsset: (actorProfileId, input) =>
      archiveCleaningAssetRecord(database, actorProfileId, input),
    linkCustomerIdentity: (actorProfileId, input) =>
      linkCustomerIdentityRecord(database, actorProfileId, input),
    revokeCustomerIdentityLink: (actorProfileId, input) =>
      revokeCustomerIdentityRecord(database, actorProfileId, input),
  };
}
