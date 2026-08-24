import { describe, expect, it } from "vitest";
import { rolePermissionMatrix, type ApplicationRoleCode } from "@/modules/identity-access/policy";
import {
  CustomerCrmAuthorizationError,
  requireCustomerIdentityLinkManagement,
  requireCustomerSelfRead,
  requireStaffCustomerManagement,
  requireStaffCustomerRead,
  resolveCustomerRecordReadScope,
  type CustomerCrmActor,
} from "./policy";

function actor(
  role: ApplicationRoleCode | null,
  options: Partial<Pick<CustomerCrmActor, "profileId" | "status" | "permissions">> = {},
): CustomerCrmActor {
  return {
    profileId: options.profileId ?? "actor-profile",
    status: options.status ?? "ACTIVE",
    roles: new Set(role ? [role] : []),
    permissions:
      options.permissions ?? new Set(role ? rolePermissionMatrix[role] : []),
  };
}

function expectDenied(callback: () => unknown, code: CustomerCrmAuthorizationError["code"]) {
  expect(callback).toThrowError(
    expect.objectContaining({
      name: "CustomerCrmAuthorizationError",
      code,
    }),
  );
}

describe("customer CRM record-level policy", () => {
  it.each(["OWNER", "ADMIN", "DISPATCHER"] as const)(
    "grants %s broad staff read and management from permissions",
    (role) => {
      expect(requireStaffCustomerRead(actor(role))).toBe("STAFF");
      expect(requireStaffCustomerManagement(actor(role))).toBe("STAFF");
    },
  );

  it.each(["TECHNICIAN", "CUSTOMER"] as const)(
    "denies %s unrestricted customer records",
    (role) => {
      expectDenied(() => requireStaffCustomerRead(actor(role)), "PERMISSION_DENIED");
      expectDenied(
        () => requireStaffCustomerManagement(actor(role)),
        "PERMISSION_DENIED",
      );
    },
  );

  it("requires both own-data permission and an active exact-customer link", () => {
    const customer = actor("CUSTOMER");

    expect(requireCustomerSelfRead(customer)).toBe("LINKED_CUSTOMER");
    expect(resolveCustomerRecordReadScope(customer, true)).toBe("LINKED_CUSTOMER");
    expectDenied(
      () => resolveCustomerRecordReadScope(customer, false),
      "RECORD_NOT_FOUND_OR_FORBIDDEN",
    );
  });

  it("does not let a link grant access without the own-data permission", () => {
    const customerWithoutOwnRead = actor("CUSTOMER", {
      permissions: new Set(["IDENTITY_SELF_READ"]),
    });

    expectDenied(
      () => resolveCustomerRecordReadScope(customerWithoutOwnRead, true),
      "PERMISSION_DENIED",
    );
  });

  it.each(["SUSPENDED", "DISABLED"] as const)(
    "denies a %s actor even with broad and linked permissions",
    (status) => {
      const owner = actor("OWNER", { status });
      expectDenied(() => requireStaffCustomerRead(owner), "ACCOUNT_UNAVAILABLE");
      expectDenied(
        () => resolveCustomerRecordReadScope(owner, true),
        "ACCOUNT_UNAVAILABLE",
      );
    },
  );

  it("uses a permission conjunction for identity-link administration", () => {
    expect(requireCustomerIdentityLinkManagement(actor("OWNER"))).toBe("STAFF");
    expect(requireCustomerIdentityLinkManagement(actor("ADMIN"))).toBe("STAFF");

    expectDenied(
      () => requireCustomerIdentityLinkManagement(actor("DISPATCHER")),
      "PERMISSION_DENIED",
    );
    expectDenied(
      () => requireCustomerIdentityLinkManagement(actor("CUSTOMER")),
      "PERMISSION_DENIED",
    );
  });

  it("does not authorize from role labels when permissions are absent", () => {
    expectDenied(
      () => requireStaffCustomerRead(actor("OWNER", { permissions: new Set() })),
      "PERMISSION_DENIED",
    );
  });
});
