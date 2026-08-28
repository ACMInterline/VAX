import { describe, expect, it } from "vitest";
import { createSafeOperationalLogRecord } from "./safe-log";

describe("safe operational logging", () => {
  it("projects only allowlisted operational fields", () => {
    const unsafeInput = {
      eventCode: "RATE_LIMIT_BACKEND_FAILURE",
      status: "ERROR",
      correlationId: "48f6fe15-3795-4db3-90be-ea2157f948f7",
      route: "/login",
      actorProfileId: "5cb879c5-8645-4ebf-a5ec-249dc54a1aa8",
      durationMs: 12.4,
      errorClass: "DEPENDENCY_UNAVAILABLE",
      password: "must-not-appear",
      token: "must-not-appear",
      sessionCookie: "must-not-appear",
      requestBody: { email: "person@example.invalid" },
      paymentDetails: "must-not-appear",
    } as const;

    const record = createSafeOperationalLogRecord(
      unsafeInput,
      () => new Date("2026-08-28T00:00:00.000Z"),
    );
    const serialized = JSON.stringify(record);

    expect(record).toEqual({
      timestamp: "2026-08-28T00:00:00.000Z",
      eventCode: "RATE_LIMIT_BACKEND_FAILURE",
      status: "ERROR",
      correlationId: "48f6fe15-3795-4db3-90be-ea2157f948f7",
      route: "/login",
      actorProfileId: "5cb879c5-8645-4ebf-a5ec-249dc54a1aa8",
      durationMs: 12,
      errorClass: "DEPENDENCY_UNAVAILABLE",
    });
    for (const prohibited of [
      "password",
      "token",
      "sessionCookie",
      "requestBody",
      "person@example.invalid",
      "paymentDetails",
      "must-not-appear",
    ]) {
      expect(serialized).not.toContain(prohibited);
    }
  });

  it("drops unsafe route and actor values instead of serializing them", () => {
    const record = createSafeOperationalLogRecord({
      eventCode: "READINESS_CHECK_FAILED",
      status: "WARNING",
      route: "/readiness?token=secret",
      actorProfileId: "not-a-profile-id",
    });

    expect(record).not.toHaveProperty("route");
    expect(record).not.toHaveProperty("actorProfileId");
    expect(record.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
