import { describe, expect, it } from "vitest";
import {
  acceptanceActorTypes,
  bookingStatuses,
  cancellationReasonCategories,
  schedulingStatuses,
  staffAcceptanceSources,
} from "@/modules/booking-engine/types";
import { bookingContent } from "./booking";

describe("booking localized content", () => {
  it("keeps Bulgarian and English on the same exact content contract", () => {
    expect(Object.keys(bookingContent.bg)).toEqual(Object.keys(bookingContent.en));

    for (const section of [
      "common",
      "labels",
      "acceptance",
      "customer",
      "staff",
      "cancellation",
      "states",
    ] as const) {
      expect(Object.keys(bookingContent.bg[section])).toEqual(
        Object.keys(bookingContent.en[section]),
      );
    }
  });

  it.each(["bg", "en"] as const)(
    "covers every controlled booking code in %s",
    (locale) => {
      const labels = bookingContent[locale].labels;

      expect(Object.keys(labels.bookingStatuses)).toEqual(bookingStatuses);
      expect(Object.keys(labels.schedulingStatuses)).toEqual(schedulingStatuses);
      expect(Object.keys(labels.acceptanceActorTypes)).toEqual(
        acceptanceActorTypes,
      );
      expect(Object.keys(labels.staffAcceptanceSources)).toEqual(
        staffAcceptanceSources,
      );
      expect(Object.keys(labels.cancellationReasons)).toEqual(
        cancellationReasonCategories,
      );
      expect(
        Object.values(labels).flatMap((record) => Object.values(record)),
      ).not.toContain("");
    },
  );

  it("states the customer acceptance boundary without implying scheduling or payment", () => {
    const copy = bookingContent.en.acceptance;

    expect(copy.acknowledgement).toContain("this exact issued quote");
    expect(copy.scheduleDisclaimer).toContain(
      "does not confirm an exact appointment",
    );
    expect(copy.noPaymentDisclaimer).toContain(
      "No payment is taken or recorded",
    );
    expect(copy.submit).toBe("Accept quote and request scheduling");
    expect(bookingContent.bg.acceptance.scheduleDisclaimer).toContain(
      "не потвърждава точен час",
    );
  });

  it("keeps provenance inconsistencies fail-closed to staff review", () => {
    const copy = bookingContent.en.acceptance;

    expect(copy.reviewRequired).toContain("staff must review");
    expect(copy.reviewRequired).toContain("No new booking was created");
    expect(copy.provenanceGuard).toContain("Fail closed");
    expect(copy.provenanceGuard).toContain("Do not reinterpret");
    expect(copy.provenanceGuard).toContain("renormalize");
    expect(copy.provenanceGuard).toContain("silently refresh");
  });

  it("distinguishes pending scheduling, review, confirmation, and cancellation", () => {
    const copy = bookingContent.en.customer;

    expect(copy.pendingScheduling).toContain("exact appointment remains unconfirmed");
    expect(copy.reviewRequired).toContain("staff review");
    expect(copy.confirmed).toContain("exact appointment is confirmed");
    expect(copy.cancelled).toContain("cancelled");
  });

  it("documents cancellation without inventing financial processing", () => {
    expect(bookingContent.en.cancellation.financeDisclaimer).toContain(
      "No cancellation fee, refund, payment, or invoice",
    );
    expect(bookingContent.bg.cancellation.financeDisclaimer).toContain(
      "такса за отмяна, възстановяване, плащане или фактура",
    );
  });

  it.each(["bg", "en"] as const)(
    "provides complete empty, loading, and generic retry states in %s",
    (locale) => {
      const copy = bookingContent[locale];

      expect(copy.customer.emptyTitle).not.toBe("");
      expect(copy.customer.emptyText).not.toBe("");
      expect(copy.staff.empty).not.toBe("");
      expect(copy.states.customerLoadingTitle).not.toBe("");
      expect(copy.states.customerLoadingText).not.toBe("");
      expect(copy.states.customerErrorTitle).not.toBe("");
      expect(copy.states.customerErrorText).not.toBe("");
      expect(copy.states.staffLoadingTitle).not.toBe("");
      expect(copy.states.staffLoadingText).not.toBe("");
      expect(copy.states.staffErrorTitle).not.toBe("");
      expect(copy.states.staffErrorText).not.toBe("");
      expect(copy.common.retry).not.toBe("");
    },
  );
});
