import { describe, expect, it } from "vitest";
import {
  assertNextAggregateVersion,
  assertQuoteCommercialTermsMutable,
  assertQuoteStatusTransition,
  assertRequestStatusTransition,
  canEditQuoteCommercialTerms,
  canTransitionQuoteStatus,
  canTransitionRequestStatus,
  InvalidLifecycleTransitionError,
  nextAggregateVersion,
} from "./lifecycle";

describe("request and quote lifecycle", () => {
  it("permits the controlled request review path and rejects arbitrary jumps", () => {
    expect(canTransitionRequestStatus("SUBMITTED", "IN_REVIEW")).toBe(true);
    expect(canTransitionRequestStatus("IN_REVIEW", "NEEDS_REVIEW")).toBe(true);
    expect(canTransitionRequestStatus("NEEDS_REVIEW", "READY_TO_QUOTE")).toBe(
      true,
    );
    expect(canTransitionRequestStatus("READY_TO_QUOTE", "QUOTED")).toBe(false);
    expect(canTransitionRequestStatus("QUOTED", "CLOSED")).toBe(true);

    expect(canTransitionRequestStatus("SUBMITTED", "QUOTED")).toBe(false);
    expect(canTransitionRequestStatus("CLOSED", "IN_REVIEW")).toBe(false);
    expect(canTransitionRequestStatus("QUOTED", "READY_TO_QUOTE")).toBe(false);
    expect(
      canTransitionRequestStatus("QUOTED", "READY_TO_QUOTE", {
        cause: "ACTIVE_QUOTE_BECAME_INACTIVE",
      }),
    ).toBe(true);
    expect(() => assertRequestStatusTransition("SUBMITTED", "QUOTED")).toThrow(
      InvalidLifecycleTransitionError,
    );
  });

  it("makes issued quotes historical and one-way", () => {
    expect(canTransitionQuoteStatus("DRAFT", "ISSUED")).toBe(true);
    expect(canTransitionQuoteStatus("ISSUED", "SUPERSEDED")).toBe(true);
    expect(canTransitionQuoteStatus("ISSUED", "EXPIRED")).toBe(true);
    expect(canTransitionQuoteStatus("ISSUED", "WITHDRAWN")).toBe(true);

    expect(canTransitionQuoteStatus("ISSUED", "DRAFT")).toBe(false);
    expect(canTransitionQuoteStatus("SUPERSEDED", "ISSUED")).toBe(false);
    expect(() => assertQuoteStatusTransition("ISSUED", "DRAFT")).toThrow(
      InvalidLifecycleTransitionError,
    );
  });

  it("allows commercial edits only while a quote is a draft", () => {
    expect(canEditQuoteCommercialTerms("DRAFT")).toBe(true);
    for (const status of [
      "ISSUED",
      "SUPERSEDED",
      "EXPIRED",
      "WITHDRAWN",
    ] as const) {
      expect(canEditQuoteCommercialTerms(status)).toBe(false);
      expect(() => assertQuoteCommercialTermsMutable(status)).toThrow(
        "Only a DRAFT quote",
      );
    }
  });

  it("requires contiguous positive aggregate versions", () => {
    expect(nextAggregateVersion(0)).toBe(1);
    expect(nextAggregateVersion(7)).toBe(8);
    expect(() => assertNextAggregateVersion(2, 4)).toThrow("next positive");
    expect(() => assertNextAggregateVersion(-1, 0)).toThrow("next positive");
    expect(() => nextAggregateVersion(Number.MAX_SAFE_INTEGER)).toThrow(
      "next positive",
    );
  });
});
