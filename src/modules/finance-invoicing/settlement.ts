import type {
  InvoiceDisplayStatus,
  InvoiceStoredStatus,
} from "./types";

export function assertMinorUnits(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be non-negative integer minor units.`);
  }
}

export function validateInvoiceArithmetic(input: Readonly<{
  netAmountMinorUnits: number;
  vatAmountMinorUnits: number;
  grossAmountMinorUnits: number;
  paidAmountMinorUnits?: number;
}>): void {
  assertMinorUnits(input.netAmountMinorUnits, "netAmountMinorUnits");
  assertMinorUnits(input.vatAmountMinorUnits, "vatAmountMinorUnits");
  assertMinorUnits(input.grossAmountMinorUnits, "grossAmountMinorUnits");
  assertMinorUnits(input.paidAmountMinorUnits ?? 0, "paidAmountMinorUnits");
  if (
    input.netAmountMinorUnits + input.vatAmountMinorUnits !==
    input.grossAmountMinorUnits
  ) {
    throw new Error("Invoice net and VAT must reproduce gross amount.");
  }
  if ((input.paidAmountMinorUnits ?? 0) > input.grossAmountMinorUnits) {
    throw new Error("Paid amount cannot exceed invoice gross amount.");
  }
}

export function storedSettlementStatus(
  grossAmountMinorUnits: number,
  paidAmountMinorUnits: number,
): "ISSUED" | "PARTIALLY_PAID" | "PAID" {
  assertMinorUnits(grossAmountMinorUnits, "grossAmountMinorUnits");
  assertMinorUnits(paidAmountMinorUnits, "paidAmountMinorUnits");
  if (grossAmountMinorUnits <= 0 || paidAmountMinorUnits > grossAmountMinorUnits) {
    throw new Error("Invalid invoice settlement amounts.");
  }
  if (paidAmountMinorUnits === 0) return "ISSUED";
  if (paidAmountMinorUnits === grossAmountMinorUnits) return "PAID";
  return "PARTIALLY_PAID";
}

export function displayInvoiceStatus(
  storedStatus: InvoiceStoredStatus,
  dueDate: string | null,
  today: string,
): InvoiceDisplayStatus {
  if (
    (storedStatus === "ISSUED" || storedStatus === "PARTIALLY_PAID") &&
    dueDate !== null &&
    dueDate < today
  ) {
    return "OVERDUE";
  }
  return storedStatus;
}
