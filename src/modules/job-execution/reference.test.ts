import { describe, expect, it } from "vitest";
import { generateJobReference } from "./reference";

describe("Job references", () => {
  it("uses the controlled prefix with 96 bits rendered as uppercase hex", () => {
    const reference = generateJobReference();

    expect(reference).toMatch(/^JOB-[A-F0-9]{24}$/);
    expect(reference).toHaveLength(28);
  });

  it("does not expose a sequential identifier", () => {
    const references = new Set(
      Array.from({ length: 32 }, () => generateJobReference()),
    );

    expect(references.size).toBe(32);
  });
});
