import { describe, expect, it } from "vitest";
import {
  displayInvoiceStatus,
  storedSettlementStatus,
  validateInvoiceArithmetic,
} from "./settlement";

describe("finance settlement", () => {
  it("keeps integer invoice arithmetic exact", () => {
    expect(() =>
      validateInvoiceArithmetic({
        netAmountMinorUnits: 4_083,
        vatAmountMinorUnits: 817,
        grossAmountMinorUnits: 4_900,
      }),
    ).not.toThrow();
    expect(() =>
      validateInvoiceArithmetic({
        netAmountMinorUnits: 4_083,
        vatAmountMinorUnits: 816,
        grossAmountMinorUnits: 4_900,
      }),
    ).toThrow();
    expect(() =>
      validateInvoiceArithmetic({
        netAmountMinorUnits: 1.5,
        vatAmountMinorUnits: 0,
        grossAmountMinorUnits: 1.5,
      }),
    ).toThrow();
  });

  it("derives partial and full settlement without floating point", () => {
    expect(storedSettlementStatus(12_000, 0)).toBe("ISSUED");
    expect(storedSettlementStatus(12_000, 5_000)).toBe("PARTIALLY_PAID");
    expect(storedSettlementStatus(12_000, 12_000)).toBe("PAID");
    expect(() => storedSettlementStatus(12_000, 12_001)).toThrow();
  });

  it("derives overdue only after the due date for unpaid issued states", () => {
    expect(displayInvoiceStatus("ISSUED", "2026-08-25", "2026-08-26")).toBe(
      "OVERDUE",
    );
    expect(displayInvoiceStatus("PARTIALLY_PAID", "2026-08-25", "2026-08-26")).toBe(
      "OVERDUE",
    );
    expect(displayInvoiceStatus("ISSUED", "2026-08-26", "2026-08-26")).toBe(
      "ISSUED",
    );
    expect(displayInvoiceStatus("PAID", "2026-08-25", "2026-08-26")).toBe(
      "PAID",
    );
    expect(displayInvoiceStatus("DRAFT", "2026-08-25", "2026-08-26")).toBe(
      "DRAFT",
    );
  });
});
