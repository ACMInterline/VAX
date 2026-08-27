import { randomBytes } from "node:crypto";

function generateReference(prefix: "COM" | "DOC" | "DEL" | "HIS"): string {
  return `${prefix}-${randomBytes(12).toString("hex").toUpperCase()}`;
}

export function generateCommunicationReference(): string {
  return generateReference("COM");
}

export function generateDocumentReference(): string {
  return generateReference("DOC");
}

export function generateDeliveryReference(): string {
  return generateReference("DEL");
}

export function generateHistoryReference(): string {
  return generateReference("HIS");
}
