import { describe, expect, it } from "vitest";
import {
  generateCommunicationReference,
  generateDeliveryReference,
  generateDocumentReference,
  generateHistoryReference,
} from "./reference";

describe("communications and documents references", () => {
  it.each([
    ["communication", generateCommunicationReference, /^COM-[A-F0-9]{24}$/, 28],
    ["document", generateDocumentReference, /^DOC-[A-F0-9]{24}$/, 28],
    ["delivery", generateDeliveryReference, /^DEL-[A-F0-9]{24}$/, 28],
    ["history", generateHistoryReference, /^HIS-[A-F0-9]{24}$/, 28],
  ] as const)(
    "creates a customer-safe %s reference with 96 bits of uppercase hex entropy",
    (_label, generate, pattern, length) => {
      const reference = generate();

      expect(reference).toMatch(pattern);
      expect(reference).toHaveLength(length);
    },
  );

  it("does not expose sequential identifiers", () => {
    const references = new Set(
      Array.from({ length: 64 }, () => generateCommunicationReference()),
    );

    expect(references.size).toBe(64);
  });
});
