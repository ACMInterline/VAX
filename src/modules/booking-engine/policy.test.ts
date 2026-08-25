import { describe, expect, it } from "vitest";
import {
  rolePermissionMatrix,
  type ApplicationRoleCode,
  type PermissionCode,
} from "@/modules/identity-access/policy";
import {
  BookingAuthorizationError,
  requireCustomerBookingRead,
  requireCustomerQuoteAcceptance,
  requireStaffBookingRead,
  requireStaffBookingScheduling,
  requireStaffQuoteAcceptance,
  type BookingActor,
} from "./policy";

const profileId = "10000000-0000-4000-8000-000000000001";

function actor(
  role: ApplicationRoleCode | null,
  options: Partial<Pick<BookingActor, "status" | "permissions" | "roles">> = {},
): BookingActor {
  return {
    profileId,
    status: options.status ?? "ACTIVE",
    roles: options.roles ?? new Set(role ? [role] : []),
    permissions:
      options.permissions ?? new Set(role ? rolePermissionMatrix[role] : []),
  };
}

function expectDenied(
  callback: () => unknown,
  code: BookingAuthorizationError["code"],
): void {
  expect(callback).toThrowError(
    expect.objectContaining({
      name: "BookingAuthorizationError",
      code,
    }),
  );
}

describe("booking authorization policy", () => {
  it.each(["OWNER", "ADMIN", "DISPATCHER"] as const)(
    "permits %s through each complete staff permission conjunction",
    (role) => {
      expect(() => requireStaffBookingRead(actor(role))).not.toThrow();
      expect(() => requireStaffQuoteAcceptance(actor(role))).not.toThrow();
      expect(() => requireStaffBookingScheduling(actor(role))).not.toThrow();
    },
  );

  it.each([
    [
      requireStaffBookingRead,
      ["CUSTOMER_RECORDS_READ", "OPERATIONS_READ", "SCHEDULE_READ"],
    ],
    [
      requireStaffQuoteAcceptance,
      ["CUSTOMER_RECORDS_MANAGE", "OPERATIONS_MANAGE"],
    ],
    [
      requireStaffBookingScheduling,
      ["CUSTOMER_RECORDS_MANAGE", "OPERATIONS_MANAGE", "SCHEDULE_MANAGE"],
    ],
  ] as const)(
    "denies a staff operation whenever any member of its conjunction is missing",
    (authorize, required) => {
      for (const omitted of required) {
        const incomplete: PermissionCode[] = required.filter(
          (permission) => permission !== omitted,
        );
        expectDenied(
          () => authorize(actor("OWNER", { permissions: new Set(incomplete) })),
          "PERMISSION_DENIED",
        );
      }
    },
  );

  it("keeps Technician out of unrestricted booking and acceptance administration", () => {
    const technician = actor("TECHNICIAN");

    expectDenied(
      () => requireStaffBookingRead(technician),
      "PERMISSION_DENIED",
    );
    expectDenied(
      () => requireStaffQuoteAcceptance(technician),
      "PERMISSION_DENIED",
    );
    expectDenied(
      () => requireStaffBookingScheduling(technician),
      "PERMISSION_DENIED",
    );
  });

  it("authorizes customer read and acceptance only from the explicit own-record permissions", () => {
    const customer = actor("CUSTOMER");

    expect(() => requireCustomerBookingRead(customer)).not.toThrow();
    expect(() => requireCustomerQuoteAcceptance(customer)).not.toThrow();
    expectDenied(
      () =>
        requireCustomerBookingRead(
          actor("CUSTOMER", {
            permissions: new Set(["OWN_CUSTOMER_DATA_UPDATE"]),
          }),
        ),
      "PERMISSION_DENIED",
    );
    expectDenied(
      () =>
        requireCustomerQuoteAcceptance(
          actor("CUSTOMER", {
            permissions: new Set(["OWN_CUSTOMER_DATA_READ"]),
          }),
        ),
      "PERMISSION_DENIED",
    );
  });

  it.each(["SUSPENDED", "DISABLED"] as const)(
    "denies a %s actor before evaluating permissions",
    (status) => {
      expectDenied(
        () => requireCustomerBookingRead(actor("CUSTOMER", { status })),
        "ACCOUNT_UNAVAILABLE",
      );
      expectDenied(
        () => requireStaffBookingRead(actor("OWNER", { status })),
        "ACCOUNT_UNAVAILABLE",
      );
    },
  );

  it("distinguishes missing authentication from an active profile with no role", () => {
    expectDenied(
      () => requireCustomerBookingRead(null),
      "AUTHENTICATION_REQUIRED",
    );
    expectDenied(
      () => requireStaffQuoteAcceptance(null),
      "AUTHENTICATION_REQUIRED",
    );
    expectDenied(
      () => requireStaffBookingScheduling(actor(null)),
      "ACCOUNT_UNAVAILABLE",
    );
  });

  it("does not authorize from a privileged role label without permissions", () => {
    expectDenied(
      () =>
        requireStaffBookingScheduling(
          actor("OWNER", { permissions: new Set() }),
        ),
      "PERMISSION_DENIED",
    );
  });
});
