import { describe, expect, it } from "vitest";
import { equipmentAssignmentCoversService } from "./equipment-assignment";

const serviceStart = new Date("2026-09-08T07:00:00.000Z");
const serviceEnd = new Date("2026-09-08T09:00:00.000Z");

describe("scheduling equipment assignment windows", () => {
  it("accepts an open assignment and boundaries covering the full service", () => {
    expect(
      equipmentAssignmentCoversService(
        { effectiveFrom: null, effectiveUntil: null },
        serviceStart,
        serviceEnd,
      ),
    ).toBe(true);
    expect(
      equipmentAssignmentCoversService(
        { effectiveFrom: serviceStart, effectiveUntil: serviceEnd },
        serviceStart,
        serviceEnd,
      ),
    ).toBe(true);
  });

  it("rejects an assignment that begins late or expires during service", () => {
    expect(
      equipmentAssignmentCoversService(
        {
          effectiveFrom: new Date("2026-09-08T07:00:00.001Z"),
          effectiveUntil: null,
        },
        serviceStart,
        serviceEnd,
      ),
    ).toBe(false);
    expect(
      equipmentAssignmentCoversService(
        {
          effectiveFrom: null,
          effectiveUntil: new Date("2026-09-08T08:59:59.999Z"),
        },
        serviceStart,
        serviceEnd,
      ),
    ).toBe(false);
  });

  it("rejects an invalid service interval", () => {
    expect(
      equipmentAssignmentCoversService(
        { effectiveFrom: null, effectiveUntil: null },
        serviceEnd,
        serviceStart,
      ),
    ).toBe(false);
  });
});
