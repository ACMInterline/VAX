import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/client";

vi.mock("server-only", () => ({}));

import {
  activeActorPermissionSql,
  archiveCustomerContact,
  archivePropertyAreaRecord,
  createCleaningAssetRecord,
  createCustomerContact,
  createCustomerRecord,
  customerListSearchSql,
  linkedCustomerReadSql,
  linkCustomerIdentityRecord,
  updateCustomerRecord,
  updatePropertyRecord,
} from "./repository";

const actorProfileId = "10000000-0000-4000-8000-000000000001";
const customerId = "20000000-0000-4000-8000-000000000001";
const userProfileId = "30000000-0000-4000-8000-000000000001";
const propertyId = "40000000-0000-4000-8000-000000000001";
const areaId = "50000000-0000-4000-8000-000000000001";
const assetId = "60000000-0000-4000-8000-000000000001";
const updatedAt = new Date("2026-08-24T12:00:00.000Z");
const dialect = new PgDialect();

function compile(query: SQL) {
  return dialect.sqlToQuery(query);
}

function executionDatabase(row: Record<string, unknown>) {
  const execute = vi.fn(async (query: SQL) => {
    void query;
    return { rows: [row] };
  });
  return {
    database: { execute } as unknown as Database,
    execute,
  };
}

function lockedMutationDatabase(row: Record<string, unknown>) {
  const execute = vi.fn((query: SQL) => query);
  const batch = vi.fn(async () => [
    { rows: [] },
    { rows: [] },
    { rows: [row] },
  ]);
  return {
    database: { execute, batch } as unknown as Database,
    execute,
    batch,
  };
}

function compiledStatements(execute: ReturnType<typeof vi.fn>): string[] {
  return execute.mock.calls.map(([query]) => compile(query as SQL).sql);
}

describe("customer CRM repository authorization SQL", () => {
  it("rechecks the current active actor, assignments, roles and permissions", () => {
    const compiled = compile(
      activeActorPermissionSql(actorProfileId, "CUSTOMER_RECORDS_MANAGE"),
    );

    expect(compiled.sql).toContain('from "user_profiles" actor_profile');
    expect(compiled.sql).toContain("actor_profile.status = 'ACTIVE'");
    expect(compiled.sql).toContain("actor_assignment.active = true");
    expect(compiled.sql).toContain("actor_role.active = true");
    expect(compiled.sql).toContain("actor_permission.active = true");
    expect(compiled.params).toEqual(
      expect.arrayContaining([actorProfileId, "CUSTOMER_RECORDS_MANAGE"]),
    );
  });

  it("binds self-service access to one exact active, unrevoked customer link", () => {
    const compiled = compile(linkedCustomerReadSql(actorProfileId, customerId));

    expect(compiled.sql).toContain(
      'from "customer_identity_links" access_link',
    );
    expect(compiled.sql).toContain("access_link.active = true");
    expect(compiled.sql).toContain("access_link.revoked_at is null");
    expect(compiled.params).toEqual(
      expect.arrayContaining([
        actorProfileId,
        customerId,
        "OWN_CUSTOMER_DATA_READ",
      ]),
    );
    expect(compiled.params).not.toContain("OWN_CUSTOMER_DATA_UPDATE");
  });

  it("searches by name or CRM UUID without putting email PII in GET queries", () => {
    const compiled = compile(customerListSearchSql("Example")!);

    expect(compiled.sql).toContain('"customers"."display_name" ilike');
    expect(compiled.sql).toContain('"customers"."legal_name" ilike');
    expect(compiled.sql).toContain('"customers"."id"::text =');
    expect(compiled.sql).not.toContain("primary_email");
  });

  it("requires both CRM manage and user administration manage to link identity", async () => {
    const fake = executionDatabase({
      result: "CREATED",
      id: userProfileId,
      changedAt: updatedAt,
    });

    await linkCustomerIdentityRecord(fake.database, actorProfileId, {
      customerId,
      userProfileId,
      relationshipType: "OWNER",
    });

    const compiled = compile(fake.execute.mock.calls[0]![0] as SQL);
    expect(compiled.params).toEqual(
      expect.arrayContaining([
        "CUSTOMER_RECORDS_MANAGE",
        "USER_ADMIN_MANAGE",
        actorProfileId,
        customerId,
        userProfileId,
      ]),
    );
    expect(compiled.sql).toContain('from "user_profiles" profile');
    expect(compiled.sql).not.toContain("auth_provider_user_id");
    expect(compiled.sql).not.toContain("primary_email =");
  });
});

describe("customer CRM repository authoritative mutations", () => {
  it("creates a business customer and initial primary contact atomically", async () => {
    const fake = executionDatabase({
      result: "CREATED",
      id: customerId,
      version: 1,
      updatedAt,
    });

    await createCustomerRecord(fake.database, actorProfileId, {
      customerType: "BUSINESS",
      displayName: "Example Hotel",
      legalName: "Example Hotel EOOD",
      preferredLocale: "en",
      primaryEmail: null,
      primaryPhone: null,
      internalNotes: null,
      initialContact: {
        contactName: "Reception",
        email: "reception@example.invalid",
        phone: null,
        roleTitle: "Front desk",
        preferredContactMethod: "EMAIL",
        locale: "en",
      },
    });

    expect(fake.execute).toHaveBeenCalledOnce();
    const compiled = compile(fake.execute.mock.calls[0]![0] as SQL);
    expect(compiled.sql).toContain('insert into "customers"');
    expect(compiled.sql).toContain('insert into "customer_contacts"');
    expect(compiled.sql).toContain("created_contact as");
    expect(compiled.sql).toContain("true");
    expect(compiled.params).toEqual(
      expect.arrayContaining([
        "BUSINESS",
        "Reception",
        "reception@example.invalid",
      ]),
    );
  });

  it("serializes primary-contact demotion and creation in one transaction", async () => {
    const fake = executionDatabase({
      result: "CREATED",
      id: userProfileId,
      version: 1,
      updatedAt,
    });

    await createCustomerContact(fake.database, actorProfileId, {
      customerId,
      contactName: "New Primary",
      email: "primary@example.invalid",
      phone: null,
      roleTitle: null,
      isPrimary: true,
      preferredContactMethod: "EMAIL",
      locale: "en",
    });

    expect(fake.execute).toHaveBeenCalledOnce();
    const statement = compile(fake.execute.mock.calls[0]![0] as SQL);
    expect(statement.sql).toContain("demoted as");
    expect(statement.sql).toContain("set is_primary = false");
    expect(statement.sql).toContain("demotion_barrier");
    expect(statement.sql).toContain('insert into "customer_contacts"');
    expect(statement.params).toContain("CUSTOMER_RECORDS_MANAGE");
  });

  it("uses expectedVersion in the update predicate and increments monotonically", async () => {
    const fake = lockedMutationDatabase({
      result: "CHANGED",
      id: customerId,
      version: 8,
      updatedAt,
    });

    await updateCustomerRecord(fake.database, actorProfileId, {
      customerId,
      expectedVersion: 7,
      displayName: "Updated customer",
    });

    expect(fake.batch).toHaveBeenCalledOnce();
    const [isolationStatement, lockStatement, mutationStatement] =
      compiledStatements(fake.execute);
    expect(isolationStatement).toBe(
      "set transaction isolation level read committed",
    );
    expect(lockStatement).toContain("select customer.id");
    expect(lockStatement).toContain('from "customers" customer');
    expect(lockStatement).toContain("for update of customer");
    expect(compile(fake.execute.mock.calls[1]![0] as SQL).params).toEqual(
      expect.arrayContaining([
        customerId,
        actorProfileId,
        "CUSTOMER_RECORDS_MANAGE",
      ]),
    );
    const compiled = compile(fake.execute.mock.calls[2]![0] as SQL);
    expect(compiled.sql).toBe(mutationStatement);
    expect(compiled.sql).toContain("customer.version =");
    expect(compiled.sql).toContain("version = customer.version + 1");
    expect(compiled.sql).toContain("then 'CONFLICT'");
    expect(compiled.sql).toContain('from "customer_contacts" primary_contact');
    expect(compiled.sql).toContain("primary_contact.is_primary = true");
    expect(compiled.params).toContain(7);
    expect(compiled.sql).not.toContain("expected_updated_at");
  });

  it("serializes primary-contact archival against customer type changes", async () => {
    const fake = lockedMutationDatabase({
      result: "CHANGED",
      id: userProfileId,
      version: 2,
      updatedAt,
    });

    await archiveCustomerContact(fake.database, actorProfileId, {
      contactId: userProfileId,
      expectedVersion: 1,
    });

    expect(fake.batch).toHaveBeenCalledOnce();
    const [isolationStatement, lockStatement, mutationStatement] =
      compiledStatements(fake.execute);
    expect(isolationStatement).toBe(
      "set transaction isolation level read committed",
    );
    expect(lockStatement).toContain("select customer.id");
    expect(lockStatement).toContain('from "customer_contacts" contact');
    expect(lockStatement).toContain(
      'join "customers" customer on customer.id = contact.customer_id',
    );
    expect(lockStatement).toContain("for update of customer");
    expect(compile(fake.execute.mock.calls[1]![0] as SQL).params).toEqual(
      expect.arrayContaining([
        userProfileId,
        actorProfileId,
        "CUSTOMER_RECORDS_MANAGE",
      ]),
    );
    const compiled = compile(fake.execute.mock.calls[2]![0] as SQL);
    expect(compiled.sql).toBe(mutationStatement);
    expect(compiled.sql).not.toContain('update "customers" customer');
    expect(compiled.sql).toContain("customer_type from target");
    expect(compiled.sql).toContain("then 'INVALID_REFERENCE'");
    expect(compiled.params).toEqual(
      expect.arrayContaining([
        userProfileId,
        actorProfileId,
        "CUSTOMER_RECORDS_MANAGE",
        1,
      ]),
    );
  });

  it("accepts a property's unchanged zone while rejecting another inactive zone", async () => {
    const fake = executionDatabase({
      result: "NO_CHANGE",
      id: propertyId,
      version: 3,
      updatedAt,
    });

    await updatePropertyRecord(fake.database, actorProfileId, {
      propertyId,
      expectedVersion: 3,
      serviceZoneId: 44,
    });

    const compiled = compile(fake.execute.mock.calls[0]![0] as SQL);
    expect(compiled.sql).toContain("select 1 from target");
    expect(compiled.sql).toContain("where service_zone_id =");
    expect(compiled.sql).toContain('from "travel_zones" zone');
    expect(compiled.sql).toContain("zone.active = true");
  });

  it("derives an area's owning customer through its property before archive", async () => {
    const fake = executionDatabase({
      result: "CHANGED",
      id: areaId,
      version: 2,
      updatedAt,
    });

    await archivePropertyAreaRecord(fake.database, actorProfileId, {
      areaId,
      expectedVersion: 1,
    });

    const compiled = compile(fake.execute.mock.calls[0]![0] as SQL);
    expect(compiled.sql).toContain(
      'join "properties" property on property.id = area.property_id',
    );
    expect(compiled.sql).toContain(
      'join "customers" customer on customer.id = property.customer_id',
    );
    expect(compiled.params).toEqual(
      expect.arrayContaining([
        areaId,
        actorProfileId,
        "CUSTOMER_RECORDS_MANAGE",
      ]),
    );
  });

  it("validates an asset's area ownership and canonical taxonomy associations", async () => {
    const fake = executionDatabase({
      result: "CREATED",
      id: assetId,
      version: 1,
      updatedAt,
    });

    await createCleaningAssetRecord(fake.database, actorProfileId, {
      propertyId,
      areaId,
      cleaningItemTypeId: 10,
      label: "Sofa",
      approximateLengthCm: 220,
      approximateWidthCm: 95,
      approximateAreaHundredthsM2: null,
      approximateSeatCount: 3,
      reportedFibreMaterialId: 20,
      reportedSurfaceConstructionId: 30,
      customerReportedConditionLevelId: 40,
      customerConditionNotes: "Used daily",
      colourAppearanceNotes: "Grey",
      approximateAcquisitionYear: 2020,
      operationalNotes: "Staff only",
      reportedIssueTypeIds: [50],
      reportedRiskFlagIds: [60, 61],
    });

    const compiled = compile(fake.execute.mock.calls[0]![0] as SQL);
    expect(compiled.sql).toContain("area.property_id =");
    expect(compiled.sql).toContain('from "cleaning_item_types" item_type');
    expect(compiled.sql).toContain('join "issue_types" issue_type');
    expect(compiled.sql).toContain('join "risk_flags" risk_flag');
    expect(compiled.sql).toContain(
      'insert into "cleaning_asset_reported_issues"',
    );
    expect(compiled.sql).toContain(
      'insert into "cleaning_asset_reported_risk_flags"',
    );
    expect(compiled.sql).not.toContain("delicate");
    expect(compiled.params).toEqual(
      expect.arrayContaining([propertyId, areaId, 10, 50, 60, 61]),
    );
  });

  it("maps indistinguishable database denial to the safe outcome", async () => {
    const fake = lockedMutationDatabase({
      result: "NOT_FOUND_OR_FORBIDDEN",
      id: null,
      version: null,
      updatedAt: null,
    });

    await expect(
      updateCustomerRecord(fake.database, actorProfileId, {
        customerId,
        expectedVersion: 1,
        displayName: "Hidden target",
      }),
    ).resolves.toEqual({ status: "NOT_FOUND_OR_FORBIDDEN" });
  });
});
