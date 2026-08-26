import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  hasPermission,
  requireAnyPermission,
  requirePermission,
  type AuthorizationContext,
} from "./authorization";
import { visibleNavigationItems } from "./navigation";
import { rolePermissionMatrix, type ApplicationRoleCode } from "./policy";

function context(role?: ApplicationRoleCode, status: AuthorizationContext["status"] = "ACTIVE") {
  return {
    status,
    roles: new Set(role ? [role] : []),
    permissions: new Set(role ? rolePermissionMatrix[role] : []),
  } satisfies AuthorizationContext;
}

describe("server authorization policy", () => {
  it("fails closed when no role supplies a permission", () => {
    const noRole = context();
    expect(hasPermission(noRole, "IDENTITY_SELF_READ")).toBe(false);
    expect(() => requirePermission(noRole, "IDENTITY_SELF_READ")).toThrowError(
      new AuthorizationError("PERMISSION_DENIED"),
    );
  });

  it.each(["SUSPENDED", "DISABLED"] as const)(
    "rejects a %s account even when its role has permission",
    (status) => {
      const owner = context("OWNER", status);
      expect(hasPermission(owner, "SYSTEM_SETTINGS_MANAGE")).toBe(false);
      expect(() => requirePermission(owner, "SYSTEM_SETTINGS_MANAGE")).toThrowError(
        new AuthorizationError("ACCOUNT_UNAVAILABLE"),
      );
    },
  );

  it("supports centralized any-permission enforcement", () => {
    const technician = context("TECHNICIAN");
    expect(() =>
      requireAnyPermission(technician, ["FIELD_JOBS_READ", "USER_ADMIN_READ"]),
    ).not.toThrow();
    expect(() =>
      requireAnyPermission(technician, ["USER_ADMIN_READ", "AUDIT_READ"]),
    ).toThrowError(new AuthorizationError("PERMISSION_DENIED"));
  });

  it("uses navigation visibility only as convenience", () => {
    const customer = context("CUSTOMER");
    const customerNavigation = visibleNavigationItems(customer);
    const visible = customerNavigation.map((item) => item.code);
    expect(visible).toEqual([
      "ACCOUNT",
      "CUSTOMER_WORKSPACE",
      "MY_REQUESTS",
      "MY_QUOTES",
      "MY_BOOKINGS",
    ]);
    expect(customerNavigation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "CUSTOMER_WORKSPACE",
          href: "/app/my-properties",
          requiredPermissions: ["OWN_CUSTOMER_DATA_READ"],
        }),
        expect.objectContaining({
          code: "MY_BOOKINGS",
          href: "/app/my-bookings",
          requiredPermissions: ["OWN_CUSTOMER_DATA_READ"],
        }),
      ]),
    );
    expect(visible).not.toContain("OPERATIONS");
    expect(visible).not.toContain("CUSTOMERS");
    expect(() => requirePermission(customer, "OPERATIONS_READ")).toThrowError(
      new AuthorizationError("PERMISSION_DENIED"),
    );
  });

  it("requires the complete staff booking and dispatch read boundary", () => {
    const completeBookingReader = {
      status: "ACTIVE",
      roles: new Set<ApplicationRoleCode>(),
      permissions: new Set([
        "CUSTOMER_RECORDS_READ",
        "OPERATIONS_READ",
        "SCHEDULE_READ",
      ] as const),
    } satisfies AuthorizationContext;
    const withoutScheduleRead = {
      ...completeBookingReader,
      permissions: new Set([
        "CUSTOMER_RECORDS_READ",
        "OPERATIONS_READ",
      ] as const),
    } satisfies AuthorizationContext;

    expect(visibleNavigationItems(completeBookingReader)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "BOOKINGS",
          href: "/app/bookings",
          permissionMatch: "ALL",
          requiredPermissions: [
            "CUSTOMER_RECORDS_READ",
            "OPERATIONS_READ",
            "SCHEDULE_READ",
          ],
        }),
        expect.objectContaining({
          code: "SCHEDULE",
          href: "/app/schedule",
          permissionMatch: "ALL",
          requiredPermissions: [
            "CUSTOMER_RECORDS_READ",
            "OPERATIONS_READ",
            "SCHEDULE_READ",
          ],
        }),
      ]),
    );
    expect(
      visibleNavigationItems(withoutScheduleRead).map((item) => item.code),
    ).not.toContain("BOOKINGS");
    expect(
      visibleNavigationItems(withoutScheduleRead).map((item) => item.code),
    ).not.toContain("SCHEDULE");
    expect(
      visibleNavigationItems(context("TECHNICIAN")).map((item) => item.code),
    ).not.toContain("BOOKINGS");
    expect(
      visibleNavigationItems(context("TECHNICIAN")).map((item) => item.code),
    ).not.toContain("SCHEDULE");
  });

  it("links staff CRM only for customer-record readers", () => {
    const customerReader = {
      status: "ACTIVE",
      roles: new Set<ApplicationRoleCode>(),
      permissions: new Set(["CUSTOMER_RECORDS_READ"] as const),
    } satisfies AuthorizationContext;
    const technician = context("TECHNICIAN");

    expect(visibleNavigationItems(customerReader)).toEqual([
      expect.objectContaining({
        code: "CUSTOMERS",
        href: "/app/customers",
        requiredPermissions: ["CUSTOMER_RECORDS_READ"],
      }),
    ]);
    expect(visibleNavigationItems(technician).map((item) => item.code)).not.toContain(
      "CUSTOMERS",
    );
  });

  it.each(["SUSPENDED", "DISABLED"] as const)(
    "hides CRM navigation for a %s profile even when permissions are present",
    (status) => {
      expect(visibleNavigationItems(context("OWNER", status))).toEqual([]);
    },
  );

  it("links user administration only for the matching read permission", () => {
    const userAdministrator = {
      status: "ACTIVE",
      roles: new Set<ApplicationRoleCode>(),
      permissions: new Set(["USER_ADMIN_READ"] as const),
    } satisfies AuthorizationContext;
    const settingsReader = {
      status: "ACTIVE",
      roles: new Set<ApplicationRoleCode>(),
      permissions: new Set(["SYSTEM_SETTINGS_READ"] as const),
    } satisfies AuthorizationContext;

    expect(visibleNavigationItems(userAdministrator)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ADMINISTRATION",
          href: "/app/admin/users",
        }),
      ]),
    );
    expect(visibleNavigationItems(settingsReader).map((item) => item.code)).not.toContain(
      "ADMINISTRATION",
    );
  });
});
