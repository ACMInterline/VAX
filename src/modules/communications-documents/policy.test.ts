import { describe, expect, it } from "vitest";
import {
  rolePermissionMatrix,
  type ApplicationRoleCode,
  type PermissionCode,
} from "@/modules/identity-access/policy";
import {
  CommunicationsAuthorizationError,
  requireCustomerCommunicationRead,
  requireCustomerCommunicationUpdate,
  requireStaffCommunicationManage,
  requireStaffCommunicationsManage,
  requireStaffCommunicationsRead,
  sourcePermissions,
} from "./policy";
import type { CommunicationsActor } from "./types";

const profileId = "10000000-0000-4000-8000-000000000001";

function actor(
  role: ApplicationRoleCode | null,
  options: Partial<Pick<CommunicationsActor, "status" | "roles" | "permissions">> = {},
): CommunicationsActor {
  return {
    profileId,
    status: options.status ?? "ACTIVE",
    roles: options.roles ?? new Set(role ? [role] : []),
    permissions:
      options.permissions ?? new Set(role ? rolePermissionMatrix[role] : []),
  };
}

function expectDenied(
  operation: () => unknown,
  code: CommunicationsAuthorizationError["code"],
): void {
  expect(operation).toThrowError(
    expect.objectContaining({
      name: "CommunicationsAuthorizationError",
      code,
    }),
  );
}

describe("communications authorization policy", () => {
  it.each(["OWNER", "ADMIN", "DISPATCHER"] as const)(
    "permits %s to read and manage the communications layer",
    (role) => {
      expect(() => requireStaffCommunicationsRead(actor(role))).not.toThrow();
      expect(() => requireStaffCommunicationsManage(actor(role))).not.toThrow();
    },
  );

  it.each([
    ["QUOTE_ISSUED", ["CUSTOMER_RECORDS_READ", "OPERATIONS_READ"]],
    [
      "BOOKING_CONFIRMED",
      ["CUSTOMER_RECORDS_READ", "OPERATIONS_READ", "SCHEDULE_READ"],
    ],
    [
      "BOOKING_RESCHEDULED",
      ["CUSTOMER_RECORDS_READ", "OPERATIONS_READ", "SCHEDULE_READ"],
    ],
    [
      "BOOKING_CANCELLED",
      ["CUSTOMER_RECORDS_READ", "OPERATIONS_READ", "SCHEDULE_READ"],
    ],
    [
      "JOB_COMPLETED",
      ["CUSTOMER_RECORDS_READ", "OPERATIONS_READ", "FIELD_JOBS_READ"],
    ],
    ["INVOICE_ISSUED", ["CUSTOMER_RECORDS_READ", "FINANCE_READ"]],
    ["PAYMENT_CONFIRMED", ["CUSTOMER_RECORDS_READ", "FINANCE_READ"]],
    ["PAYMENT_REVERSED", ["CUSTOMER_RECORDS_READ", "FINANCE_READ"]],
  ] as const)(
    "requires the complete source permission conjunction for %s",
    (eventType, sourceRequired) => {
      expect(sourcePermissions(eventType)).toEqual(sourceRequired);
      const required = [
        "COMMUNICATIONS_READ",
        "COMMUNICATIONS_MANAGE",
        ...sourceRequired,
      ] as PermissionCode[];

      expect(() =>
        requireStaffCommunicationManage(
          actor("OWNER", { permissions: new Set(required) }),
          eventType,
        ),
      ).not.toThrow();

      for (const omitted of required) {
        expectDenied(
          () =>
            requireStaffCommunicationManage(
              actor("OWNER", {
                permissions: new Set(
                  required.filter((permission) => permission !== omitted),
                ),
              }),
              eventType,
            ),
          "PERMISSION_DENIED",
        );
      }
    },
  );

  it("keeps finance communications outside Dispatcher authority", () => {
    const dispatcher = actor("DISPATCHER");

    expect(() =>
      requireStaffCommunicationManage(dispatcher, "QUOTE_ISSUED"),
    ).not.toThrow();
    expect(() =>
      requireStaffCommunicationManage(dispatcher, "JOB_COMPLETED"),
    ).not.toThrow();
    expectDenied(
      () => requireStaffCommunicationManage(dispatcher, "INVOICE_ISSUED"),
      "PERMISSION_DENIED",
    );
    expectDenied(
      () => requireStaffCommunicationManage(dispatcher, "PAYMENT_CONFIRMED"),
      "PERMISSION_DENIED",
    );
  });

  it("authorizes customer read and preference update only from explicit own-data permissions", () => {
    const customer = actor("CUSTOMER");

    expect(() => requireCustomerCommunicationRead(customer)).not.toThrow();
    expect(() => requireCustomerCommunicationUpdate(customer)).not.toThrow();
    expectDenied(
      () =>
        requireCustomerCommunicationUpdate(
          actor("CUSTOMER", {
            permissions: new Set(["OWN_CUSTOMER_DATA_READ"]),
          }),
        ),
      "PERMISSION_DENIED",
    );
    expectDenied(
      () => requireStaffCommunicationsRead(customer),
      "PERMISSION_DENIED",
    );
  });

  it.each(["SUSPENDED", "DISABLED"] as const)(
    "denies a %s actor before evaluating permissions",
    (status) => {
      expectDenied(
        () => requireStaffCommunicationsRead(actor("OWNER", { status })),
        "ACCOUNT_UNAVAILABLE",
      );
      expectDenied(
        () => requireCustomerCommunicationRead(actor("CUSTOMER", { status })),
        "ACCOUNT_UNAVAILABLE",
      );
    },
  );

  it("distinguishes missing authentication, missing role assignment, and missing permissions", () => {
    expectDenied(
      () => requireStaffCommunicationsRead(null),
      "AUTHENTICATION_REQUIRED",
    );
    expectDenied(
      () => requireStaffCommunicationsRead(actor(null)),
      "ACCOUNT_UNAVAILABLE",
    );
    expectDenied(
      () =>
        requireStaffCommunicationsManage(
          actor("OWNER", { permissions: new Set(["COMMUNICATIONS_READ"]) }),
        ),
      "PERMISSION_DENIED",
    );
  });
});
