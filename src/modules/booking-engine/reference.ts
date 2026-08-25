import { randomBytes } from "node:crypto";

export function generateBookingReference(): string {
  return `BKG-${randomBytes(12).toString("hex").toUpperCase()}`;
}
