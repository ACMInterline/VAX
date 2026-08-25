import { describe, expect, it } from "vitest";
import {
  generatePublicReference,
  generateQuoteReference,
  generateRequestReference,
  PUBLIC_REFERENCE_ENTROPY_BYTES,
} from "./reference";

describe("customer-safe references", () => {
  it("uses 96 bits of entropy and the controlled request/quote prefixes", () => {
    const entropy = Uint8Array.from({
      length: PUBLIC_REFERENCE_ENTROPY_BYTES,
    }, (_, index) => index);
    const source = (requestedBytes: number) => {
      expect(requestedBytes).toBe(12);
      return entropy;
    };

    expect(PUBLIC_REFERENCE_ENTROPY_BYTES * 8).toBeGreaterThanOrEqual(80);
    expect(generateRequestReference(source)).toBe(
      "REQ-000102030405060708090A0B",
    );
    expect(generateQuoteReference(source)).toBe("Q-000102030405060708090A0B");
  });

  it("rejects a faulty entropy source instead of weakening references", () => {
    expect(() =>
      generatePublicReference("REQ", () => new Uint8Array(4)),
    ).toThrow("invalid length");
  });

  it("does not expose sequential database identifiers", () => {
    const first = generateRequestReference();
    const second = generateRequestReference();

    expect(first).toMatch(/^REQ-[A-F0-9]{24}$/);
    expect(second).toMatch(/^REQ-[A-F0-9]{24}$/);
    expect(first).not.toBe(second);
  });
});
