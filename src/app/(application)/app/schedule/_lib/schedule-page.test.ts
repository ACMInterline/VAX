import { describe, expect, it, vi } from "vitest";
import type { BookingSchedulePreview } from "@/modules/scheduling-dispatch/types";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/db/client", () => ({ getDatabase: vi.fn(() => ({})) }));
vi.mock("../../application-principal", () => ({
  requireApplicationPrincipal: vi.fn(),
}));
vi.mock("@/modules/scheduling-dispatch/repository", () => ({
  createDatabaseSchedulingDispatchRepository: vi.fn(() => ({})),
}));

import { presentBookingSchedulePreview } from "./schedule-page";

const serviceStart = new Date("2026-10-25T06:30:00.000Z");
const serviceEnd = new Date("2026-10-25T08:00:00.000Z");

describe("scheduling route presentation adapter", () => {
  it("removes server-only authority and ranking evidence before the client form", () => {
    const domainPreview = {
      bookingReference: "BKG-0123456789ABCDEF01234567",
      expectedBookingVersion: 4,
      customerDisplayName: "Synthetic customer",
      propertyLabel: "Synthetic property",
      propertyAddress: "Synthetic address",
      preferredTimingLabel: "Morning",
      serviceDurationMinutes: 90,
      workDate: "2026-10-25",
      timeZone: "Europe/Sofia",
      currentAppointment: {
        occupancyId: "private-occupancy-id",
        snapshotVersion: 2,
        serviceStart,
        serviceEnd,
        teamName: "Team A",
        equipmentLabel: "Machine A",
        providerInternalReference: "private-provider-value",
      },
      candidates: [
        {
          key: "candidate-key-0001",
          rank: 1,
          teamId: 99,
          teamCode: "TEAM_A",
          teamName: "Team A",
          equipmentResourceId: 77,
          equipmentLabel: "Machine A",
          workDate: "2026-10-25",
          serviceStart,
          serviceEnd,
          operationalStart: new Date("2026-10-25T06:00:00.000Z"),
          operationalEnd: new Date("2026-10-25T08:30:00.000Z"),
          serviceDurationMinutes: 90,
          travelBeforeMinutes: 10,
          travelAfterMinutes: 10,
          travelMinutes: 20,
          bufferMinutes: 15,
          parkingBufferMinutes: 5,
          readiness: "READY",
          selectable: true,
          fallbackTravelUsed: false,
          manualReviewRequired: false,
          warnings: [
            "Draft scheduling configuration requires explicit staff review.",
          ],
          preferredWindowMatch: true,
          additionalTravelMinutes: 20,
          nearbyWorkContinuity: true,
          occupiedWorkloadMinutes: 200,
          providerInternalReference: "private-provider-value",
        },
      ],
      reviewWarnings: ["SCHEDULING_CONFIGURATION_DRAFT"],
      provisionalConfiguration: true,
      commercialSnapshot: { secret: "private-commercial-value" },
    } as unknown as BookingSchedulePreview;

    const view = presentBookingSchedulePreview(domainPreview, "bg");
    const serialized = JSON.stringify(view);

    expect(view.currentAppointment).toEqual({
      snapshotVersion: 2,
      serviceStart,
      serviceEnd,
      teamName: "Team A",
      equipmentLabel: "Machine A",
    });
    expect(view.candidates[0]).toEqual({
      key: "candidate-key-0001",
      rank: 1,
      teamName: "Team A",
      equipmentLabel: "Machine A",
      serviceStart,
      serviceEnd,
      serviceDurationMinutes: 90,
      travelMinutes: 20,
      bufferMinutes: 15,
      readiness: "READY",
      selectable: true,
      fallbackTravelUsed: false,
      warnings: ["DRAFT конфигурацията изисква изричен служебен преглед."],
    });
    expect(view.preferredTimingLabel).toBe("Сутрин");
    expect(view.reviewWarnings).toEqual([
      "Използва се DRAFT оперативна конфигурация за преглед.",
    ]);
    expect(serialized).not.toMatch(
      /private-|occupancyId|teamId|teamCode|equipmentResourceId|operationalStart|operationalEnd|travelBeforeMinutes|travelAfterMinutes|parkingBufferMinutes|occupiedWorkloadMinutes|commercialSnapshot|SCHEDULING_CONFIGURATION_DRAFT/,
    );
  });
});
