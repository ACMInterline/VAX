import { describe, expect, it } from "vitest";
import {
  applicationRoleCodes,
  canAssignRole,
  canonicalPermissions,
  canonicalRoles,
  customerSelfRegistrationRoles,
  permissionCodes,
  rolePermissionMatrix,
  rolePermissionRows,
} from "./policy";

describe("canonical identity and access policy", () => {
  it("defines unique stable role and permission seeds", () => {
    expect(applicationRoleCodes).toHaveLength(5);
    expect(applicationRoleCodes).not.toContain("ACCOUNTANT");
    expect(permissionCodes).toHaveLength(26);
    expect(new Set(applicationRoleCodes).size).toBe(applicationRoleCodes.length);
    expect(new Set(permissionCodes).size).toBe(permissionCodes.length);
    expect(canonicalRoles.map((role) => role.code)).toEqual(applicationRoleCodes);
    expect(canonicalPermissions.map((permission) => permission.code)).toEqual(
      permissionCodes,
    );
  });

  it("grants the owner every canonical permission", () => {
    expect(new Set(rolePermissionMatrix.OWNER)).toEqual(new Set(permissionCodes));
  });

  it("keeps customer self-registration customer-only", () => {
    expect(customerSelfRegistrationRoles).toEqual(["CUSTOMER"]);
    expect(rolePermissionMatrix.CUSTOMER).toEqual([
      "IDENTITY_SELF_READ",
      "IDENTITY_SELF_UPDATE",
      "OWN_CUSTOMER_DATA_READ",
      "OWN_CUSTOMER_DATA_UPDATE",
    ]);
    expect(rolePermissionMatrix.CUSTOMER).not.toContain("USER_ADMIN_MANAGE");
    expect(rolePermissionMatrix.CUSTOMER).not.toContain("OPERATIONS_READ");
    expect(rolePermissionMatrix.CUSTOMER).not.toContain("FINANCE_READ");
    expect(rolePermissionMatrix.CUSTOMER).not.toContain("FINANCE_MANAGE");
    expect(rolePermissionMatrix.CUSTOMER).not.toContain("INVOICE_ISSUE");
    expect(rolePermissionMatrix.CUSTOMER).not.toContain("PAYMENT_RECORD");
  });

  it("keeps technician permissions field-oriented", () => {
    expect(rolePermissionMatrix.TECHNICIAN).toContain("FIELD_JOBS_READ");
    expect(rolePermissionMatrix.TECHNICIAN).toContain("FIELD_JOBS_UPDATE");
    expect(rolePermissionMatrix.TECHNICIAN).not.toContain("CUSTOMER_RECORDS_READ");
    expect(rolePermissionMatrix.TECHNICIAN).not.toContain("COMMERCIAL_RULES_MANAGE");
    expect(rolePermissionMatrix.TECHNICIAN).not.toContain("SYSTEM_SETTINGS_READ");
    expect(rolePermissionMatrix.TECHNICIAN).not.toContain("FINANCE_READ");
    expect(rolePermissionMatrix.TECHNICIAN).not.toContain("FINANCE_MANAGE");
    expect(rolePermissionMatrix.TECHNICIAN).not.toContain("INVOICE_ISSUE");
    expect(rolePermissionMatrix.TECHNICIAN).not.toContain("PAYMENT_RECORD");
  });

  it("grants dispatch operations without protected settings", () => {
    expect(rolePermissionMatrix.DISPATCHER).toEqual(
      expect.arrayContaining([
        "OPERATIONS_MANAGE",
        "SCHEDULE_MANAGE",
        "CUSTOMER_RECORDS_MANAGE",
      ]),
    );
    expect(rolePermissionMatrix.DISPATCHER).not.toContain("SYSTEM_SETTINGS_READ");
    expect(rolePermissionMatrix.DISPATCHER).not.toContain("ROLE_ASSIGN");
    expect(rolePermissionMatrix.DISPATCHER).not.toContain("FINANCE_READ");
    expect(rolePermissionMatrix.DISPATCHER).not.toContain("FINANCE_MANAGE");
    expect(rolePermissionMatrix.DISPATCHER).not.toContain("INVOICE_ISSUE");
    expect(rolePermissionMatrix.DISPATCHER).not.toContain("PAYMENT_RECORD");
  });

  it("keeps protected owner authority out of administrator permissions", () => {
    expect(rolePermissionMatrix.ADMIN).toContain("USER_ADMIN_MANAGE");
    expect(rolePermissionMatrix.ADMIN).toContain("ROLE_ASSIGN");
    expect(rolePermissionMatrix.ADMIN).toEqual(
      expect.arrayContaining([
        "FINANCE_READ",
        "FINANCE_MANAGE",
        "INVOICE_ISSUE",
        "PAYMENT_RECORD",
      ]),
    );
    expect(rolePermissionMatrix.ADMIN).not.toContain("SYSTEM_SETTINGS_MANAGE");
    expect(canAssignRole(new Set(["ADMIN"]), "OWNER")).toBe(false);
    expect(canAssignRole(new Set(["ADMIN"]), "ADMIN")).toBe(false);
    expect(canAssignRole(new Set(["ADMIN"]), "DISPATCHER")).toBe(true);
    expect(canAssignRole(new Set(["ADMIN"]), "TECHNICIAN")).toBe(true);
    expect(canAssignRole(new Set(["ADMIN"]), "CUSTOMER")).toBe(true);
    expect(canAssignRole(new Set(["OWNER"]), "OWNER")).toBe(true);
    expect(canAssignRole(new Set(["OWNER"]), "ADMIN")).toBe(true);
    expect(canAssignRole(new Set(["DISPATCHER"]), "CUSTOMER")).toBe(false);
  });

  it("produces one deterministic mapping per role and permission pair", () => {
    const rows = rolePermissionRows();
    expect(rows).toHaveLength(70);
    const keys = rows.map((row) => `${row.roleCode}:${row.permissionCode}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
