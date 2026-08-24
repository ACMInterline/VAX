import { describe, expect, it, vi } from "vitest";
import { rolePermissionMatrix, type ApplicationRoleCode } from "@/modules/identity-access/policy";

vi.mock("server-only", () => ({}));
import {
  createCustomerCrmService,
  CustomerCrmServiceError,
  type CustomerCrmRepository,
} from "./service";
import type {
  CustomerCrmActor,
  CustomerSelfDetail,
  CustomerSummary,
  StaffCustomerDetail,
} from "./types";

const customerAId = "10000000-0000-4000-8000-000000000001";
const customerBId = "10000000-0000-4000-8000-000000000002";
const propertyAId = "20000000-0000-4000-8000-000000000001";
const areaAId = "30000000-0000-4000-8000-000000000001";
const assetAId = "40000000-0000-4000-8000-000000000001";
const profileId = "50000000-0000-4000-8000-000000000001";
const now = new Date("2026-08-24T09:00:00.000Z");

function actor(
  role: ApplicationRoleCode,
  options: Partial<Pick<CustomerCrmActor, "status" | "permissions">> = {},
): CustomerCrmActor {
  return {
    profileId,
    status: options.status ?? "ACTIVE",
    roles: new Set([role]),
    permissions: options.permissions ?? new Set(rolePermissionMatrix[role]),
  };
}

const summary: CustomerSummary = {
  id: customerAId,
  customerType: "INDIVIDUAL",
  displayName: "Customer A",
  legalName: null,
  preferredLocale: "bg",
  primaryEmail: "customer-a@example.invalid",
  primaryPhone: "+359 88 123 4567",
  status: "ACTIVE",
  version: 1,
  createdAt: now,
  updatedAt: now,
};

const staffDetail: StaffCustomerDetail = {
  ...summary,
  internalNotes: "Staff only",
  contacts: [
    {
      id: "60000000-0000-4000-8000-000000000001",
      customerId: customerAId,
      contactName: "Customer A",
      email: "customer-a@example.invalid",
      phone: null,
      roleTitle: null,
      isPrimary: true,
      preferredContactMethod: "EMAIL",
      locale: "bg",
      active: true,
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
  ],
  identityLinks: [
    {
      id: "70000000-0000-4000-8000-000000000001",
      customerId: customerAId,
      userProfileId: profileId,
      relationshipType: "OWNER",
      active: true,
      createdAt: now,
      revokedAt: null,
    },
  ],
  properties: [
    {
      id: propertyAId,
      customerId: customerAId,
      propertyType: "RESIDENTIAL",
      label: "Home",
      city: "Sofia",
      district: "Lozenets",
      streetAddress: "Synthetic 1",
      postalCode: "1000",
      latitude: 42.7,
      longitude: 23.3,
      accessNotes: "Gate code",
      parkingNotes: "Use rear entrance",
      serviceZoneId: null,
      status: "ACTIVE",
      version: 1,
      createdAt: now,
      updatedAt: now,
      areas: [
        {
          id: areaAId,
          propertyId: propertyAId,
          areaType: "LIVING_ROOM",
          customLabel: null,
          floorLevel: "1",
          notes: "Staff area note",
          active: true,
          version: 1,
          createdAt: now,
          updatedAt: now,
        },
      ],
      cleaningAssets: [
        {
          id: assetAId,
          propertyId: propertyAId,
          areaId: areaAId,
          cleaningItemTypeId: 1,
          label: "Sofa",
          approximateLengthCm: 220,
          approximateWidthCm: 95,
          approximateAreaHundredthsM2: null,
          approximateSeatCount: 3,
          reportedFibreMaterialId: null,
          reportedSurfaceConstructionId: null,
          customerReportedConditionLevelId: null,
          customerConditionNotes: "Used daily",
          colourAppearanceNotes: "Grey",
          approximateAcquisitionYear: 2020,
          status: "ACTIVE",
          operationalNotes: "Staff asset note",
          reportedIssueTypeIds: [1],
          reportedRiskFlagIds: [2],
          version: 1,
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
  ],
};

function fakeRepository(overrides: Partial<CustomerCrmRepository> = {}) {
  const calls: { method: string; actorProfileId: string; input?: unknown }[] = [];
  const repository: CustomerCrmRepository = {
    async listStaffCustomers(actorProfileId, input) {
      calls.push({ method: "listStaffCustomers", actorProfileId, input });
      return { items: [summary], total: 1, limit: input.limit, offset: input.offset };
    },
    async listLinkedCustomers(actorProfileId) {
      calls.push({ method: "listLinkedCustomers", actorProfileId });
      return [summary];
    },
    async getStaffCustomer(actorProfileId, customerId) {
      calls.push({ method: "getStaffCustomer", actorProfileId, input: customerId });
      return customerId === customerAId ? staffDetail : null;
    },
    async getLinkedCustomer(actorProfileId, customerId) {
      calls.push({ method: "getLinkedCustomer", actorProfileId, input: customerId });
      return customerId === customerAId
        ? (staffDetail as unknown as CustomerSelfDetail)
        : null;
    },
    async createCustomer(actorProfileId, input) {
      calls.push({ method: "createCustomer", actorProfileId, input });
      return { status: "CREATED", id: customerAId, version: 1, updatedAt: now };
    },
    async updateCustomer(actorProfileId, input) {
      calls.push({ method: "updateCustomer", actorProfileId, input });
      return { status: "CHANGED", id: input.customerId, version: 2, updatedAt: now };
    },
    async archiveCustomer(actorProfileId, input) {
      calls.push({ method: "archiveCustomer", actorProfileId, input });
      return { status: "CHANGED", id: input.customerId, version: 2, updatedAt: now };
    },
    async createContact(actorProfileId, input) {
      calls.push({ method: "createContact", actorProfileId, input });
      return { status: "CREATED", id: customerAId, version: 1, updatedAt: now };
    },
    async archiveContact(actorProfileId, input) {
      calls.push({ method: "archiveContact", actorProfileId, input });
      return { status: "CHANGED", id: input.contactId, version: 2, updatedAt: now };
    },
    async createProperty(actorProfileId, input) {
      calls.push({ method: "createProperty", actorProfileId, input });
      return { status: "CREATED", id: propertyAId, version: 1, updatedAt: now };
    },
    async updateProperty(actorProfileId, input) {
      calls.push({ method: "updateProperty", actorProfileId, input });
      return { status: "CHANGED", id: input.propertyId, version: 2, updatedAt: now };
    },
    async archiveProperty(actorProfileId, input) {
      calls.push({ method: "archiveProperty", actorProfileId, input });
      return { status: "CHANGED", id: input.propertyId, version: 2, updatedAt: now };
    },
    async createPropertyArea(actorProfileId, input) {
      calls.push({ method: "createPropertyArea", actorProfileId, input });
      return { status: "CREATED", id: areaAId, version: 1, updatedAt: now };
    },
    async archivePropertyArea(actorProfileId, input) {
      calls.push({ method: "archivePropertyArea", actorProfileId, input });
      return { status: "CHANGED", id: input.areaId, version: 2, updatedAt: now };
    },
    async createCleaningAsset(actorProfileId, input) {
      calls.push({ method: "createCleaningAsset", actorProfileId, input });
      return { status: "CREATED", id: assetAId, version: 1, updatedAt: now };
    },
    async archiveCleaningAsset(actorProfileId, input) {
      calls.push({ method: "archiveCleaningAsset", actorProfileId, input });
      return { status: "CHANGED", id: input.assetId, version: 2, updatedAt: now };
    },
    async linkCustomerIdentity(actorProfileId, input) {
      calls.push({ method: "linkCustomerIdentity", actorProfileId, input });
      return { status: "CREATED", id: customerAId, changedAt: now };
    },
    async revokeCustomerIdentityLink(actorProfileId, input) {
      calls.push({ method: "revokeCustomerIdentityLink", actorProfileId, input });
      return { status: "CHANGED", id: input.linkId, changedAt: now };
    },
    ...overrides,
  };
  return { repository, calls };
}

async function expectServiceFailure(
  promise: Promise<unknown>,
  code: CustomerCrmServiceError["code"],
) {
  await expect(promise).rejects.toMatchObject({
    name: "CustomerCrmServiceError",
    code,
  });
}

describe("customer CRM service authorization", () => {
  it("allows staff list access and passes only the application profile identifier", async () => {
    const fake = fakeRepository();
    const result = await createCustomerCrmService(fake.repository).listCustomers(
      actor("DISPATCHER"),
      { search: "  Customer  " },
    );

    expect(result.items).toEqual([summary]);
    expect(fake.calls).toEqual([
      {
        method: "listStaffCustomers",
        actorProfileId: profileId,
        input: { search: "Customer", limit: 25, offset: 0 },
      },
    ]);
  });

  it("denies technician and customer access before repository use", async () => {
    for (const role of ["TECHNICIAN", "CUSTOMER"] as const) {
      const fake = fakeRepository();
      await expect(
        createCustomerCrmService(fake.repository).listCustomers(actor(role), {}),
      ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
      expect(fake.calls).toHaveLength(0);
    }
  });

  it("uses a linked-only repository path and returns a safe empty list", async () => {
    const fake = fakeRepository({
      async listLinkedCustomers() {
        return [];
      },
    });

    await expect(
      createCustomerCrmService(fake.repository).listMyCustomers(actor("CUSTOMER")),
    ).resolves.toEqual([]);
  });

  it("does not disclose whether a linked customer ID exists", async () => {
    const service = createCustomerCrmService(fakeRepository().repository);
    await expectServiceFailure(
      service.getMyCustomer(actor("CUSTOMER"), { customerId: customerBId }),
      "RECORD_NOT_FOUND_OR_FORBIDDEN",
    );
    await expectServiceFailure(
      service.getMyCustomer(actor("CUSTOMER"), {
        customerId: "90000000-0000-4000-8000-000000000009",
      }),
      "RECORD_NOT_FOUND_OR_FORBIDDEN",
    );
  });

  it("rebuilds the customer projection without staff-only fields", async () => {
    const result = await createCustomerCrmService(
      fakeRepository().repository,
    ).getMyCustomer(actor("CUSTOMER"), { customerId: customerAId });
    const property = result.properties[0] as unknown as Record<string, unknown>;
    const area = result.properties[0]?.areas[0] as unknown as Record<string, unknown>;
    const asset = result.properties[0]?.cleaningAssets[0] as unknown as Record<
      string,
      unknown
    >;

    expect(result).not.toHaveProperty("internalNotes");
    expect(result).not.toHaveProperty("identityLinks");
    expect(property).not.toHaveProperty("accessNotes");
    expect(property).not.toHaveProperty("parkingNotes");
    expect(property).not.toHaveProperty("latitude");
    expect(property).not.toHaveProperty("longitude");
    expect(area).not.toHaveProperty("notes");
    expect(asset).not.toHaveProperty("operationalNotes");
    expect(JSON.stringify(result)).not.toMatch(/createdByProfileId|updatedByProfileId/);
    expect(property.streetAddress).toBe("Synthetic 1");
  });

  it("denies suspended and disabled actors before reads", async () => {
    for (const status of ["SUSPENDED", "DISABLED"] as const) {
      const fake = fakeRepository();
      await expect(
        createCustomerCrmService(fake.repository).getCustomer(
          actor("OWNER", { status }),
          { customerId: customerAId },
        ),
      ).rejects.toMatchObject({ code: "ACCOUNT_UNAVAILABLE" });
      expect(fake.calls).toHaveLength(0);
    }
  });
});

describe("customer CRM service mutations", () => {
  it("creates a business and its initial primary contact in one repository command", async () => {
    const fake = fakeRepository();
    await expect(
      createCustomerCrmService(fake.repository).createCustomer(actor("ADMIN"), {
        customerType: "BUSINESS",
        displayName: "Example Hotel",
        preferredLocale: "en",
        primaryEmail: "office@example.invalid",
        initialContact: {
          contactName: "Reception",
          email: "reception@example.invalid",
          phone: null,
          roleTitle: "Front desk",
          preferredContactMethod: "EMAIL",
          locale: "en",
        },
      }),
    ).resolves.toMatchObject({ status: "CREATED", id: customerAId });

    expect(fake.calls[0]).toMatchObject({
      method: "createCustomer",
      actorProfileId: profileId,
      input: {
        customerType: "BUSINESS",
        initialContact: { contactName: "Reception" },
      },
    });
  });

  it("does not wire OWN_CUSTOMER_DATA_UPDATE into Phase 3C mutations", async () => {
    const fake = fakeRepository();
    await expect(
      createCustomerCrmService(fake.repository).updateCustomer(actor("CUSTOMER"), {
        customerId: customerAId,
        expectedVersion: 1,
        displayName: "Changed",
      }),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(fake.calls).toHaveLength(0);
  });

  it("maps stale versions and unauthorized target IDs to bounded errors", async () => {
    const conflict = fakeRepository({
      async updateCustomer() {
        return { status: "CONFLICT" };
      },
    });
    await expectServiceFailure(
      createCustomerCrmService(conflict.repository).updateCustomer(actor("ADMIN"), {
        customerId: customerAId,
        expectedVersion: 1,
        displayName: "Changed",
      }),
      "CONFLICT",
    );

    const crossCustomer = fakeRepository({
      async archiveProperty() {
        return { status: "NOT_FOUND_OR_FORBIDDEN" };
      },
    });
    await expectServiceFailure(
      createCustomerCrmService(crossCustomer.repository).archiveProperty(
        actor("DISPATCHER"),
        { propertyId: propertyAId, expectedVersion: 1 },
      ),
      "RECORD_NOT_FOUND_OR_FORBIDDEN",
    );
  });

  it("requires CRM manage and user administration manage to link identities", async () => {
    for (const role of ["DISPATCHER", "TECHNICIAN", "CUSTOMER"] as const) {
      const fake = fakeRepository();
      await expect(
        createCustomerCrmService(fake.repository).linkCustomerIdentity(actor(role), {
          customerId: customerAId,
          userProfileId: profileId,
          relationshipType: "OWNER",
        }),
      ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
      expect(fake.calls).toHaveLength(0);
    }

    await expect(
      createCustomerCrmService(fakeRepository().repository).linkCustomerIdentity(
        actor("ADMIN"),
        {
          customerId: customerAId,
          userProfileId: profileId,
          relationshipType: "AUTHORIZED_CONTACT",
        },
      ),
    ).resolves.toMatchObject({ status: "CREATED" });
  });

  it("rejects invalid nested IDs before a repository call", async () => {
    const fake = fakeRepository();
    await expectServiceFailure(
      createCustomerCrmService(fake.repository).createPropertyArea(actor("ADMIN"), {
        propertyId: "not-a-uuid",
        areaType: "BEDROOM",
      }),
      "INVALID_REQUEST",
    );
    expect(fake.calls).toHaveLength(0);
  });
});
