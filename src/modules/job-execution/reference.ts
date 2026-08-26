import { randomBytes } from "node:crypto";

/** 96 bits of randomness; callers still retry on a unique-key collision. */
export function generateJobReference(): string {
  return `JOB-${randomBytes(12).toString("hex").toUpperCase()}`;
}
