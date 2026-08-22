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
    const visible = visibleNavigationItems(customer).map((item) => item.code);
    expect(visible).toEqual(["ACCOUNT", "CUSTOMER_WORKSPACE"]);
    expect(visible).not.toContain("OPERATIONS");
    expect(() => requirePermission(customer, "OPERATIONS_READ")).toThrowError(
      new AuthorizationError("PERMISSION_DENIED"),
    );
  });
});
