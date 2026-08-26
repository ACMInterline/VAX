import { describe, expect, it } from "vitest";
import {
  financeReviewReasonCodes,
  invoiceEligibilityModes,
  invoiceStoredStatuses,
  invoiceTypes,
  paymentMethods,
  paymentStatuses,
} from "@/modules/finance-invoicing/types";
import { financeContent } from "./finance";

describe("finance localized content", () => {
  it("keeps Bulgarian and English on the same exact content contract", () => {
    expect(Object.keys(financeContent.bg)).toEqual(Object.keys(financeContent.en));
    for (const section of [
      "common",
      "labels",
      "staff",
      "customer",
      "invoice",
      "states",
    ] as const) {
      expect(Object.keys(financeContent.bg[section])).toEqual(
        Object.keys(financeContent.en[section]),
      );
    }
  });

  it.each(["bg", "en"] as const)(
    "covers every controlled finance code in %s",
    (locale) => {
      const labels = financeContent[locale].labels;
      expect(Object.keys(labels.invoiceStatuses)).toEqual([
        ...invoiceStoredStatuses,
        "OVERDUE",
      ]);
      expect(Object.keys(labels.invoiceTypes)).toEqual(invoiceTypes);
      expect(Object.keys(labels.eligibilityModes)).toEqual(
        invoiceEligibilityModes,
      );
      expect(Object.keys(labels.paymentMethods)).toEqual(paymentMethods);
      expect(Object.keys(labels.paymentStatuses)).toEqual(paymentStatuses);
      expect(Object.keys(labels.reviewReasons)).toEqual(
        financeReviewReasonCodes,
      );
      expect(
        Object.values(labels).flatMap((record) => Object.values(record)),
      ).not.toContain("");
    },
  );

  it("describes customer visibility as issued and exactly linked", () => {
    expect(financeContent.en.customer.issuedOnlyNotice).toContain("only issued");
    expect(financeContent.en.customer.issuedOnlyNotice).toContain(
      "linked exactly",
    );
    expect(financeContent.bg.customer.issuedOnlyNotice).toContain(
      "само издадени",
    );
  });
});
