import { describe, expect, it } from "vitest";
import type { SchedulingActor } from "./policy";
import {
  requireCustomerAppointmentRead,
  requireStaffSchedulingManage,
  requireStaffSchedulingRead,
  requireTechnicianTodayRead,
  SchedulingAuthorizationError,
} from "./policy";

function actor(
  permissions: SchedulingActor["permissions"],
  overrides: Partial<SchedulingActor> = {},
): SchedulingActor {
  return {
    profileId: "00000000-0000-4000-8000-000000000001",
    status: "ACTIVE",
    roles: new Set(["DISPATCHER"]),
    permissions,
    ...overrides,
  };
}

describe("scheduling authorization policy", () => {
  it("requires every staff dispatch read permission", () => {
    const complete = new Set([
      "CUSTOMER_RECORDS_READ",
      "OPERATIONS_READ",
      "SCHEDULE_READ",
    ] as const);
    expect(() => requireStaffSchedulingRead(actor(complete))).not.toThrow();

    for (const missing of complete) {
      const incomplete = new Set([...complete].filter((item) => item !== missing));
      expect(() => requireStaffSchedulingRead(actor(incomplete))).toThrowError(
        expect.objectContaining({ code: "PERMISSION_DENIED" }),
      );
    }
  });

  it("requires every scheduling mutation permission", () => {
    const complete = new Set([
      "CUSTOMER_RECORDS_MANAGE",
      "OPERATIONS_MANAGE",
      "SCHEDULE_MANAGE",
    ] as const);
    expect(() => requireStaffSchedulingManage(actor(complete))).not.toThrow();

    for (const missing of complete) {
      const incomplete = new Set([...complete].filter((item) => item !== missing));
      expect(() => requireStaffSchedulingManage(actor(incomplete))).toThrowError(
        expect.objectContaining({ code: "PERMISSION_DENIED" }),
      );
    }
  });

  it("keeps technician and customer read boundaries distinct", () => {
    expect(() =>
      requireTechnicianTodayRead(
        actor(
          new Set(["OPERATIONS_READ", "SCHEDULE_READ", "FIELD_JOBS_READ"]),
        ),
      ),
    ).not.toThrow();
    expect(() =>
      requireCustomerAppointmentRead(actor(new Set(["OWN_CUSTOMER_DATA_READ"]))),
    ).not.toThrow();
    expect(() =>
      requireStaffSchedulingManage(
        actor(new Set(["OPERATIONS_READ", "SCHEDULE_READ", "FIELD_JOBS_READ"])),
      ),
    ).toThrowError(expect.objectContaining({ code: "PERMISSION_DENIED" }));
  });

  it("fails closed for missing, inactive, or role-less actors", () => {
    expect(() => requireStaffSchedulingRead(null)).toThrowError(
      expect.objectContaining({ code: "AUTHENTICATION_REQUIRED" }),
    );
    expect(() =>
      requireStaffSchedulingRead(
        actor(new Set(), { status: "SUSPENDED" }),
      ),
    ).toThrowError(expect.objectContaining({ code: "ACCOUNT_UNAVAILABLE" }));
    expect(() =>
      requireStaffSchedulingRead(actor(new Set(), { roles: new Set() })),
    ).toThrowError(expect.objectContaining({ code: "ACCOUNT_UNAVAILABLE" }));
    expect(
      new SchedulingAuthorizationError("RECORD_NOT_FOUND_OR_FORBIDDEN").message,
    ).toBe("RECORD_NOT_FOUND_OR_FORBIDDEN");
  });
});
