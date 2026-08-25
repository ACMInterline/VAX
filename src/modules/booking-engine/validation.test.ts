import { describe, expect, it } from "vitest";
import {
  bookingReferenceSchema,
  cancelBookingSchema,
  customerQuoteAcceptanceSchema,
  staffBookingListSchema,
  staffQuoteAcceptanceSchema,
} from "./validation";

const quoteReference = "Q-000000000000000000000001";
const bookingReference = "BKG-000000000000000000000001";

describe("booking command validation", () => {
  it("requires an explicit literal customer acknowledgement", () => {
    expect(
      customerQuoteAcceptanceSchema.parse({
        quoteReference,
        expectedQuoteVersion: 2,
        acknowledged: true,
      }),
    ).toEqual({
      quoteReference,
      expectedQuoteVersion: 2,
      acknowledged: true,
    });

    for (const acknowledged of [false, "true", 1, undefined]) {
      expect(
        customerQuoteAcceptanceSchema.safeParse({
          quoteReference,
          expectedQuoteVersion: 2,
          ...(acknowledged === undefined ? {} : { acknowledged }),
        }).success,
      ).toBe(false);
    }
  });

  it("rejects unknown customer fields, unsafe references, and invalid optimistic versions", () => {
    expect(
      customerQuoteAcceptanceSchema.safeParse({
        quoteReference,
        expectedQuoteVersion: 2,
        acknowledged: true,
        customerId: "30000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(false);
    expect(
      customerQuoteAcceptanceSchema.safeParse({
        quoteReference: "Q-1",
        expectedQuoteVersion: 2,
        acknowledged: true,
      }).success,
    ).toBe(false);
    expect(
      customerQuoteAcceptanceSchema.safeParse({
        quoteReference,
        expectedQuoteVersion: 0,
        acknowledged: true,
      }).success,
    ).toBe(false);
  });

  it.each(["PHONE", "EMAIL", "IN_PERSON", "OTHER_RECORDED"] as const)(
    "accepts the controlled %s staff source and trims its evidence note",
    (acceptanceSource) => {
      expect(
        staffQuoteAcceptanceSchema.parse({
          quoteReference,
          expectedQuoteVersion: 3,
          customerInstructionConfirmed: true,
          acceptanceSource,
          acceptanceNote: "  Customer confirmed the issued quote.  ",
        }),
      ).toEqual({
        quoteReference,
        expectedQuoteVersion: 3,
        customerInstructionConfirmed: true,
        acceptanceSource,
        acceptanceNote: "Customer confirmed the issued quote.",
      });
    },
  );

  it("requires staff confirmation, an allowlisted source, and a bounded nonblank note", () => {
    const valid = {
      quoteReference,
      expectedQuoteVersion: 3,
      customerInstructionConfirmed: true,
      acceptanceSource: "PHONE",
      acceptanceNote: "Customer called to accept.",
    } as const;

    expect(
      staffQuoteAcceptanceSchema.safeParse({
        ...valid,
        customerInstructionConfirmed: false,
      }).success,
    ).toBe(false);
    expect(
      staffQuoteAcceptanceSchema.safeParse({
        ...valid,
        acceptanceSource: "CHAT_MESSAGE",
      }).success,
    ).toBe(false);
    expect(
      staffQuoteAcceptanceSchema.safeParse({ ...valid, acceptanceNote: "  " })
        .success,
    ).toBe(false);
    expect(
      staffQuoteAcceptanceSchema.safeParse({
        ...valid,
        acceptanceNote: "x".repeat(1_001),
      }).success,
    ).toBe(false);
    expect(
      staffQuoteAcceptanceSchema.safeParse({
        ...valid,
        providerSubject: "must-not-cross-the-boundary",
      }).success,
    ).toBe(false);
  });

  it("requires a reason only for OTHER cancellation and trims accepted text", () => {
    expect(
      cancelBookingSchema.parse({
        bookingReference,
        expectedVersion: 1,
        reasonCategory: "OTHER",
        reasonText: "  Duplicate instruction received.  ",
      }),
    ).toEqual({
      bookingReference,
      expectedVersion: 1,
      reasonCategory: "OTHER",
      reasonText: "Duplicate instruction received.",
    });
    expect(
      cancelBookingSchema.safeParse({
        bookingReference,
        expectedVersion: 1,
        reasonCategory: "OTHER",
        reasonText: null,
      }).success,
    ).toBe(false);
    expect(
      cancelBookingSchema.safeParse({
        bookingReference,
        expectedVersion: 1,
        reasonCategory: "CUSTOMER_REQUEST",
        reasonText: null,
      }).success,
    ).toBe(true);
  });

  it("bounds and orders staff-list filters", () => {
    expect(
      staffBookingListSchema.parse({
        search: "  BKG-000  ",
        scheduledFrom: new Date("2026-09-01T00:00:00.000Z"),
        scheduledTo: new Date("2026-10-01T00:00:00.000Z"),
        limit: 25,
        offset: 0,
      }),
    ).toMatchObject({ search: "BKG-000", limit: 25, offset: 0 });
    expect(
      staffBookingListSchema.safeParse({
        scheduledFrom: new Date("2026-10-01T00:00:00.000Z"),
        scheduledTo: new Date("2026-09-01T00:00:00.000Z"),
        limit: 25,
        offset: 0,
      }).success,
    ).toBe(false);
    expect(
      staffBookingListSchema.safeParse({ limit: 101, offset: 0 }).success,
    ).toBe(false);
  });

  it("recognizes only the random customer-safe booking reference shape", () => {
    expect(bookingReferenceSchema.parse(bookingReference)).toBe(
      bookingReference,
    );
    for (const unsafe of [
      "BKG-1",
      "BKG-00000000000000000000000g",
      "bkg-000000000000000000000001",
      "REQ-000000000000000000000001",
    ]) {
      expect(bookingReferenceSchema.safeParse(unsafe).success).toBe(false);
    }
  });
});
