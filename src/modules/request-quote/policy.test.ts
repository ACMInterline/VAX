import { describe, expect, it } from "vitest";
import {
  rolePermissionMatrix,
  type ApplicationRoleCode,
  type PermissionCode,
} from "@/modules/identity-access/policy";
import {
  assertExactActiveCustomerLink,
  RequestQuoteAuthorizationError,
  requireCustomerRequestRead,
  requireCustomerRequestUpdate,
  requireStaffRequestManagement,
  requireStaffRequestRead,
  type RequestQuoteActor,
} from "./policy";

function actor(
  role: ApplicationRoleCode | null,
  options: Partial<
    Pick<RequestQuoteActor, "status" | "permissions" | "roles">
  > = {},
): RequestQuoteActor {
  return {
    profileId: "10000000-0000-4000-8000-000000000001",
    status: options.status ?? "ACTIVE",
    roles: options.roles ?? new Set(role ? [role] : []),
    permissions:
      options.permissions ?? new Set(role ? rolePermissionMatrix[role] : []),
  };
}

function expectDenied(
  callback: () => unknown,
  code: RequestQuoteAuthorizationError["code"],
) {
  expect(callback).toThrowError(
    expect.objectContaining({
      name: "RequestQuoteAuthorizationError",
      code,
    }),
  );
}

describe("request and quote authorization policy", () => {
  it.each(["OWNER", "ADMIN", "DISPATCHER"] as const)(
    "requires the complete staff permission conjunction for %s",
    (role) => {
      expect(requireStaffRequestRead(actor(role))).toBe("STAFF");
      expect(requireStaffRequestManagement(actor(role))).toBe("STAFF");
    },
  );

  it("does not authorize staff operations from either permission alone", () => {
    const readPermissions: PermissionCode[] = ["CUSTOMER_RECORDS_READ"];
    const managePermissions: PermissionCode[] = ["OPERATIONS_MANAGE"];

    expectDenied(
      () =>
        requireStaffRequestRead(
          actor("OWNER", { permissions: new Set(readPermissions) }),
        ),
      "PERMISSION_DENIED",
    );
    expectDenied(
      () =>
        requireStaffRequestManagement(
          actor("OWNER", { permissions: new Set(managePermissions) }),
        ),
      "PERMISSION_DENIED",
    );
  });

  it("authorizes customers only from explicit own-record permissions", () => {
    const customer = actor("CUSTOMER");
    expect(requireCustomerRequestRead(customer)).toBe("LINKED_CUSTOMER");
    expect(requireCustomerRequestUpdate(customer)).toBe("LINKED_CUSTOMER");

    expectDenied(
      () =>
        requireCustomerRequestRead(
          actor("CUSTOMER", {
            permissions: new Set(["OWN_CUSTOMER_DATA_UPDATE"]),
          }),
        ),
      "PERMISSION_DENIED",
    );
  });

  it("treats a missing exact active link as not found or forbidden", () => {
    expect(() => assertExactActiveCustomerLink(true)).not.toThrow();
    expectDenied(
      () => assertExactActiveCustomerLink(false),
      "RECORD_NOT_FOUND_OR_FORBIDDEN",
    );
  });

  it.each(["SUSPENDED", "DISABLED"] as const)(
    "denies a %s account before permission evaluation",
    (status) => {
      expectDenied(
        () => requireStaffRequestRead(actor("OWNER", { status })),
        "ACCOUNT_UNAVAILABLE",
      );
      expectDenied(
        () => requireCustomerRequestRead(actor("CUSTOMER", { status })),
        "ACCOUNT_UNAVAILABLE",
      );
    },
  );

  it("does not authorize from a role label when permissions are absent", () => {
    expectDenied(
      () => requireStaffRequestRead(actor("OWNER", { permissions: new Set() })),
      "PERMISSION_DENIED",
    );
  });
});
