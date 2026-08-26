import { describe, expect, it } from "vitest";
import {
  bookingPreviewInputSchema,
  dispatchDayInputSchema,
  scheduleCandidateKeySchema,
  scheduleConfirmationInputSchema,
  schedulingBookingReferenceSchema,
  schedulingDateSchema,
  schedulingExpectedVersionSchema,
} from "./validation";

const bookingReference = "BKG-" + "A".repeat(24);
const candidateKey = "TEAM_A-2026-08-26T06:00:00Z";

const initialSchedule = {
  bookingReference,
  expectedBookingVersion: 2,
  workDate: "2026-08-26",
  candidateKey,
  expectedOccupancySnapshotVersion: null,
  reasonCategory: null,
  reasonText: null,
  acknowledged: true,
} as const;

describe("scheduling validation", () => {
  it("validates real date-only, Booking reference, candidate key, and versions", () => {
    expect(schedulingDateSchema.safeParse("2028-02-29").success).toBe(true);
    expect(schedulingDateSchema.safeParse("2027-02-29").success).toBe(false);
    expect(schedulingBookingReferenceSchema.safeParse(bookingReference).success).toBe(
      true,
    );
    expect(schedulingBookingReferenceSchema.safeParse("BKG-unsafe").success).toBe(
      false,
    );
    expect(scheduleCandidateKeySchema.safeParse(candidateKey).success).toBe(true);
    expect(scheduleCandidateKeySchema.safeParse("bad key").success).toBe(false);
    expect(schedulingExpectedVersionSchema.safeParse(1).success).toBe(true);
    expect(schedulingExpectedVersionSchema.safeParse(0).success).toBe(false);
    expect(schedulingExpectedVersionSchema.safeParse(1.5).success).toBe(false);
  });

  it("accepts only an explicit review acknowledgement", () => {
    expect(scheduleConfirmationInputSchema.safeParse(initialSchedule).success).toBe(
      true,
    );
    for (const acknowledged of [false, "true", 1, undefined]) {
      const input = { ...initialSchedule, acknowledged };
      expect(scheduleConfirmationInputSchema.safeParse(input).success).toBe(false);
    }
  });

  it("requires controlled reschedule reasons and a note for OTHER", () => {
    const reschedule = {
      ...initialSchedule,
      expectedOccupancySnapshotVersion: 1,
      reasonCategory: "OTHER",
      reasonText: "  Customer requested a different access time.  ",
    } as const;
    expect(scheduleConfirmationInputSchema.parse(reschedule).reasonText).toBe(
      "Customer requested a different access time.",
    );
    expect(
      scheduleConfirmationInputSchema.safeParse({
        ...reschedule,
        reasonText: "   ",
      }).success,
    ).toBe(false);
    expect(
      scheduleConfirmationInputSchema.safeParse({
        ...reschedule,
        reasonCategory: null,
      }).success,
    ).toBe(false);
    expect(
      scheduleConfirmationInputSchema.safeParse({
        ...reschedule,
        reasonCategory: "NOT_CONTROLLED",
      }).success,
    ).toBe(false);
  });

  it("limits and sanitizes optional reason notes", () => {
    const base = {
      ...initialSchedule,
      expectedOccupancySnapshotVersion: 1,
      reasonCategory: "OPERATIONAL",
    } as const;
    expect(
      scheduleConfirmationInputSchema.parse({ ...base, reasonText: "  note  " })
        .reasonText,
    ).toBe("note");
    expect(
      scheduleConfirmationInputSchema.parse({ ...base, reasonText: "   " })
        .reasonText,
    ).toBeNull();
    expect(
      scheduleConfirmationInputSchema.safeParse({
        ...base,
        reasonText: "x".repeat(501),
      }).success,
    ).toBe(false);
    expect(
      scheduleConfirmationInputSchema.safeParse({
        ...base,
        reasonText: "unsafe\u0000note",
      }).success,
    ).toBe(false);
  });

  it("rejects reschedule fields on an initial schedule and unknown fields", () => {
    expect(
      scheduleConfirmationInputSchema.safeParse({
        ...initialSchedule,
        reasonCategory: "OPERATIONAL",
      }).success,
    ).toBe(false);
    expect(
      scheduleConfirmationInputSchema.safeParse({
        ...initialSchedule,
        injectedEndTime: "20:00",
      }).success,
    ).toBe(false);
    expect(
      dispatchDayInputSchema.safeParse({
        workDate: "2026-08-26",
        includeRevenue: false,
        customerId: "untrusted",
      }).success,
    ).toBe(false);
    expect(
      bookingPreviewInputSchema.safeParse({
        bookingReference,
        workDate: "2026-08-26",
        teamId: 1,
      }).success,
    ).toBe(false);
  });
});
