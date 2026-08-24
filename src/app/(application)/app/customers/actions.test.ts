import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationBoundaryError } from "@/auth/principal-policy";
import { crmContent } from "@/content/crm";
import { rolePermissionMatrix } from "@/modules/identity-access/policy";
import { CustomerCrmServiceError } from "@/modules/customer-crm/service";

const doubles = vi.hoisted(() => {
  const service = {
    createCustomer: vi.fn(),
    updateCustomer: vi.fn(),
    archiveCustomer: vi.fn(),
    createContact: vi.fn(),
    archiveContact: vi.fn(),
    linkCustomerIdentity: vi.fn(),
    revokeCustomerIdentityLink: vi.fn(),
    createProperty: vi.fn(),
    updateProperty: vi.fn(),
    archiveProperty: vi.fn(),
    createPropertyArea: vi.fn(),
    archivePropertyArea: vi.fn(),
    createCleaningAsset: vi.fn(),
    archiveCleaningAsset: vi.fn(),
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
vi.mock("@/auth/enforce-rate-limit", () => ({
  isAuthAttemptAllowed: doubles.isAuthAttemptAllowed,
}));
vi.mock("@/auth/authorization-service", () => ({
  requireUserPermission: doubles.requireUserPermission,
}));
vi.mock("@/db/client", () => ({ getDatabase: vi.fn(() => ({})) }));
vi.mock("@/modules/customer-crm/repository", () => ({
  createDatabaseCustomerCrmRepository: doubles.repositoryFactory,
}));
vi.mock("@/modules/customer-crm/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/customer-crm/service")>()),
  createCustomerCrmService: doubles.serviceFactory,
}));

import {
  archiveAreaAction,
  archiveAssetAction,
  archiveContactAction,
  archiveCustomerAction,
  archivePropertyAction,
  createAreaAction,
  createAssetAction,
  createContactAction,
  createCustomerAction,
  createPropertyAction,
  linkCustomerIdentityAction,
  revokeCustomerIdentityLinkAction,
  updateCustomerAction,
  updatePropertyAction,
} from "./actions";

const actorProfileId = "10000000-0000-4000-8000-000000000001";
const customerId = "20000000-0000-4000-8000-000000000001";
const propertyId = "30000000-0000-4000-8000-000000000001";
const areaId = "40000000-0000-4000-8000-000000000001";
const profileId = "50000000-0000-4000-8000-000000000001";

const adminPrincipal = {
  profile: {
    id: actorProfileId,
    displayName: "Administrator",
    preferredLocale: "en",
    phone: null,
    status: "ACTIVE",
  },
  roles: new Set(["ADMIN"]),
  permissions: new Set(rolePermissionMatrix.ADMIN),
};

const initialState = { status: "IDLE" as const };

function form(entries: readonly (readonly [string, string])[]): FormData {
  const formData = new FormData();
  for (const [key, value] of entries) formData.append(key, value);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  doubles.requireUserPermission.mockResolvedValue(adminPrincipal);
  doubles.isAuthAttemptAllowed.mockResolvedValue(true);
  doubles.serviceFactory.mockReturnValue(doubles.service);
  doubles.service.createCustomer.mockResolvedValue({ status: "CREATED" });
  doubles.service.updateCustomer.mockResolvedValue({ status: "CHANGED" });
  doubles.service.archiveCustomer.mockResolvedValue({ status: "CHANGED" });
  doubles.service.createContact.mockResolvedValue({ status: "CREATED" });
  doubles.service.archiveContact.mockResolvedValue({ status: "CHANGED" });
  doubles.service.linkCustomerIdentity.mockResolvedValue({ status: "CREATED" });
  doubles.service.revokeCustomerIdentityLink.mockResolvedValue({
    status: "CHANGED",
  });
  doubles.service.createProperty.mockResolvedValue({ status: "CREATED" });
  doubles.service.updateProperty.mockResolvedValue({ status: "CHANGED" });
  doubles.service.archiveProperty.mockResolvedValue({ status: "CHANGED" });
  doubles.service.createPropertyArea.mockResolvedValue({ status: "CREATED" });
  doubles.service.archivePropertyArea.mockResolvedValue({ status: "CHANGED" });
  doubles.service.createCleaningAsset.mockResolvedValue({ status: "CREATED" });
  doubles.service.archiveCleaningAsset.mockResolvedValue({ status: "CHANGED" });
});

describe("CRM Server Action authentication", () => {
  it("reauthenticates every exported mutation before parsing client input", async () => {
    const actions = [
      createCustomerAction,
      updateCustomerAction,
      archiveCustomerAction,
      createContactAction,
      archiveContactAction,
      linkCustomerIdentityAction,
      revokeCustomerIdentityLinkAction,
      createPropertyAction,
      updatePropertyAction,
      archivePropertyAction,
      createAreaAction,
      archiveAreaAction,
      createAssetAction,
      archiveAssetAction,
    ];

    for (const action of actions) {
      doubles.requireUserPermission.mockClear();
      doubles.requireUserPermission.mockRejectedValueOnce(
        new AuthenticationBoundaryError("AUTHENTICATION_REQUIRED"),
      );
      const submitted = new FormData();
      const getAll = vi.spyOn(submitted, "getAll");

      await expect(action(initialState, submitted)).resolves.toEqual({
        status: "ERROR",
        message: crmContent.bg.action.forbidden,
      });
      expect(doubles.requireUserPermission).toHaveBeenCalledWith(
        "CUSTOMER_RECORDS_MANAGE",
      );
      expect(getAll).not.toHaveBeenCalled();
    }
    expect(
      Object.values(doubles.service).every((method) => method.mock.calls.length === 0),
    ).toBe(true);
  });

  it("requires USER_ADMIN_MANAGE as well as CRM management for identity links", async () => {
    doubles.requireUserPermission.mockResolvedValue({
      ...adminPrincipal,
      roles: new Set(["DISPATCHER"]),
      permissions: new Set(rolePermissionMatrix.DISPATCHER),
    });

    const result = await linkCustomerIdentityAction(
      initialState,
      form([
        ["customerId", customerId],
        ["userProfileId", profileId],
        ["relationshipType", "AUTHORIZED_CONTACT"],
      ]),
    );

    expect(result).toEqual({
      status: "ERROR",
      message: crmContent.en.action.forbidden,
      values: {
        customerId,
        userProfileId: profileId,
        relationshipType: "AUTHORIZED_CONTACT",
      },
    });
    expect(doubles.service.linkCustomerIdentity).not.toHaveBeenCalled();
  });

  it("rate-limits after authentication without losing submitted values", async () => {
    doubles.isAuthAttemptAllowed.mockResolvedValue(false);

    const result = await createContactAction(
      initialState,
      form([
        ["customerId", customerId],
        ["contactName", "Reception"],
        ["email", "reception@example.invalid"],
      ]),
    );

    expect(result).toMatchObject({
      status: "ERROR",
      message: crmContent.en.action.unavailable,
      values: {
        customerId,
        contactName: "Reception",
        email: "reception@example.invalid",
      },
    });
    expect(doubles.isAuthAttemptAllowed).toHaveBeenCalledWith(
      "ADMIN_MUTATION",
      actorProfileId,
    );
    expect(doubles.service.createContact).not.toHaveBeenCalled();
  });
});

describe("CRM Server Action parsing and results", () => {
  it("parses a business and its structured primary contact", async () => {
    const result = await createCustomerAction(
      initialState,
      form([
        ["customerType", "BUSINESS"],
        ["displayName", "  Example Hotel  "],
        ["legalName", " Example Hotel EOOD "],
        ["preferredLocale", "en"],
        ["primaryEmail", ""],
        ["primaryPhone", ""],
        ["internalNotes", "  Staff only  "],
        ["initialContact.contactName", " Reception "],
        ["initialContact.email", " RECEPTION@EXAMPLE.INVALID "],
        ["initialContact.phone", ""],
        ["initialContact.roleTitle", " Front desk "],
        ["initialContact.preferredContactMethod", "EMAIL"],
        ["initialContact.locale", "en"],
      ]),
    );

    expect(doubles.service.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: actorProfileId }),
      {
        customerType: "BUSINESS",
        displayName: "Example Hotel",
        legalName: "Example Hotel EOOD",
        preferredLocale: "en",
        primaryEmail: null,
        primaryPhone: null,
        internalNotes: "Staff only",
        initialContact: {
          contactName: "Reception",
          email: "reception@example.invalid",
          phone: null,
          roleTitle: "Front desk",
          preferredContactMethod: "EMAIL",
          locale: "en",
        },
      },
    );
    expect(result).toEqual({
      status: "SUCCESS",
      message: crmContent.en.action.success,
    });
    expect(doubles.revalidatePath.mock.calls).toEqual([
      ["/app/customers"],
      ["/app/customers/[customerId]", "page"],
      ["/app/customers/[customerId]/edit", "page"],
      [
        "/app/customers/[customerId]/properties/[propertyId]",
        "page",
      ],
      [
        "/app/customers/[customerId]/properties/[propertyId]/edit",
        "page",
      ],
      ["/app/my-properties"],
    ]);
  });

  it("returns localized field errors and preserves a rejected business form", async () => {
    const result = await createCustomerAction(
      initialState,
      form([
        ["customerType", "BUSINESS"],
        ["displayName", "Example Hotel"],
        ["preferredLocale", "en"],
        ["primaryEmail", "office@example.invalid"],
      ]),
    );

    expect(result).toMatchObject({
      status: "ERROR",
      message: crmContent.en.action.invalid,
      fieldErrors: {
        "initialContact.contactName": [crmContent.en.action.invalid],
      },
      values: {
        customerType: "BUSINESS",
        displayName: "Example Hotel",
        preferredLocale: "en",
        primaryEmail: "office@example.invalid",
      },
    });
    expect(doubles.service.createCustomer).not.toHaveBeenCalled();
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });

  it("parses asset numbers and repeated canonical issue/risk identifiers", async () => {
    doubles.service.createCleaningAsset.mockRejectedValue(
      new CustomerCrmServiceError("INVALID_REFERENCE"),
    );
    const result = await createAssetAction(
      initialState,
      form([
        ["propertyId", propertyId],
        ["areaId", areaId],
        ["cleaningItemTypeId", "10"],
        ["label", " Sofa "],
        ["approximateLengthCm", "220"],
        ["approximateWidthCm", "95"],
        ["approximateAreaHundredthsM2", ""],
        ["approximateSeatCount", "3"],
        ["reportedFibreMaterialId", ""],
        ["reportedSurfaceConstructionId", "30"],
        ["customerReportedConditionLevelId", "40"],
        ["customerConditionNotes", " Used daily "],
        ["colourAppearanceNotes", " Grey "],
        ["approximateAcquisitionYear", "2020"],
        ["operationalNotes", " Staff only "],
        ["reportedIssueTypeIds", "50"],
        ["reportedIssueTypeIds", "51"],
        ["reportedRiskFlagIds", "60"],
        ["reportedRiskFlagIds", "61"],
      ]),
    );

    expect(doubles.service.createCleaningAsset).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: actorProfileId }),
      expect.objectContaining({
        propertyId,
        areaId,
        cleaningItemTypeId: 10,
        label: "Sofa",
        approximateLengthCm: 220,
        approximateWidthCm: 95,
        approximateAreaHundredthsM2: null,
        approximateSeatCount: 3,
        reportedFibreMaterialId: null,
        reportedSurfaceConstructionId: 30,
        customerReportedConditionLevelId: 40,
        reportedIssueTypeIds: [50, 51],
        reportedRiskFlagIds: [60, 61],
      }),
    );
    expect(result).toMatchObject({
      status: "ERROR",
      message: crmContent.en.action.invalidRelationship,
      values: {
        reportedIssueTypeIds: ["50", "51"],
        reportedRiskFlagIds: ["60", "61"],
      },
    });
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects duplicate canonical IDs before service invocation", async () => {
    const result = await createAssetAction(
      initialState,
      form([
        ["propertyId", propertyId],
        ["cleaningItemTypeId", "10"],
        ["label", "Sofa"],
        ["reportedIssueTypeIds", "50"],
        ["reportedIssueTypeIds", "50"],
      ]),
    );

    expect(result).toMatchObject({
      status: "ERROR",
      fieldErrors: {
        reportedIssueTypeIds: [crmContent.en.action.invalid],
      },
      values: { reportedIssueTypeIds: ["50", "50"] },
    });
    expect(doubles.service.createCleaningAsset).not.toHaveBeenCalled();
  });

  it("rejects duplicate scalar fields instead of choosing an attacker value", async () => {
    const result = await archiveCustomerAction(
      initialState,
      form([
        ["customerId", customerId],
        ["customerId", "90000000-0000-4000-8000-000000000009"],
        ["expectedVersion", "1"],
      ]),
    );

    expect(result).toMatchObject({
      status: "ERROR",
      fieldErrors: { customerId: [crmContent.en.action.invalid] },
      values: {
        customerId: [customerId, "90000000-0000-4000-8000-000000000009"],
      },
    });
    expect(doubles.service.archiveCustomer).not.toHaveBeenCalled();
  });

  it("does not revalidate when a valid mutation reports no change", async () => {
    doubles.service.updateCustomer.mockResolvedValue({ status: "NO_CHANGE" });
    const result = await updateCustomerAction(
      initialState,
      form([
        ["customerId", customerId],
        ["expectedVersion", "3"],
        ["displayName", "Customer"],
      ]),
    );

    expect(result).toEqual({
      status: "SUCCESS",
      message: crmContent.en.action.noChange,
    });
    expect(doubles.revalidatePath).not.toHaveBeenCalled();
  });

  it("uses one safe missing-or-forbidden response and never forwards provider fields", async () => {
    doubles.service.linkCustomerIdentity.mockRejectedValue(
      new CustomerCrmServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN"),
    );
    const result = await linkCustomerIdentityAction(
      initialState,
      form([
        ["customerId", customerId],
        ["userProfileId", profileId],
        ["relationshipType", "OWNER"],
        ["authProviderUserId", "provider-internal"],
        ["email", "must-not-link@example.invalid"],
      ]),
    );

    expect(doubles.service.linkCustomerIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: actorProfileId }),
      { customerId, userProfileId: profileId, relationshipType: "OWNER" },
    );
    expect(result).toEqual({
      status: "ERROR",
      message: crmContent.en.action.notFound,
      values: { customerId, userProfileId: profileId, relationshipType: "OWNER" },
    });
    expect(JSON.stringify(result)).not.toMatch(/provider|must-not-link/);
  });
});
