import { randomBytes } from "node:crypto";

function reference(prefix: "INV" | "PAY"): string {
  return `${prefix}-${randomBytes(12).toString("hex").toUpperCase()}`;
}

export function generateInvoiceReference(): string {
  return reference("INV");
}

export function generatePaymentReference(): string {
  return reference("PAY");
}
