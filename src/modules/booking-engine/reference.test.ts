import { describe, expect, it } from "vitest";
import { generateBookingReference } from "./reference";

describe("booking references", () => {
  it("uses the controlled prefix with 96 bits rendered as uppercase hex", () => {
    const reference = generateBookingReference();

    expect(reference).toMatch(/^BKG-[A-F0-9]{24}$/);
    expect(reference).toHaveLength(28);
  });

  it("does not expose a sequential identifier", () => {
    const references = new Set(
      Array.from({ length: 32 }, () => generateBookingReference()),
    );

    expect(references.size).toBe(32);
    for (const reference of references) {
      expect(reference).toMatch(/^BKG-[A-F0-9]{24}$/);
    }
  });
});
