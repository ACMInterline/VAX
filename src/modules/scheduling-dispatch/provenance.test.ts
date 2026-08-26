import { describe, expect, it } from "vitest";
import {
  immutableOperationalRequirementsFromDurationSnapshot,
  immutableServiceCodesFromDurationSnapshot,
} from "./provenance";

function durationSnapshot(items: unknown): unknown {
  return {
    sourceEstimateDurationSnapshot: {
      input: { items },
    },
  };
}

describe("immutable scheduling service provenance", () => {
  it("reads ordered service codes from the accepted-estimate duration input", () => {
    expect(
      immutableServiceCodesFromDurationSnapshot(
        durationSnapshot([
          { serviceCode: "CARPET_CARE" },
          { serviceCode: "DELICATE_TEXTILE_ASSESSMENT" },
        ]),
      ),
    ).toEqual(["CARPET_CARE", "DELICATE_TEXTILE_ASSESSMENT"]);
  });

  it.each([
    ["missing snapshot", null],
    ["missing source", {}],
    ["non-array items", durationSnapshot({ serviceCode: "CARPET_CARE" })],
    ["empty items", durationSnapshot([])],
    ["missing service code", durationSnapshot([{}])],
    ["non-string service code", durationSnapshot([{ serviceCode: 42 }])],
  ])("fails closed for %s", (_label, value) => {
    expect(immutableServiceCodesFromDurationSnapshot(value)).toBeNull();
  });

  it("derives capabilities only when the immutable count and codes are known", () => {
    expect(
      immutableOperationalRequirementsFromDurationSnapshot(
        durationSnapshot([
          { serviceCode: "CARPET_CARE" },
          { serviceCode: "DELICATE_TEXTILE_ASSESSMENT" },
        ]),
        2,
      ),
    ).toEqual({
      team: ["SPECIALIST_ASSESSMENT", "STANDARD_RESIDENTIAL"],
      equipment: ["PORTABLE_EXTRACTION"],
    });
  });

  it("fails closed when the Booking item count does not match", () => {
    expect(
      immutableOperationalRequirementsFromDurationSnapshot(
        durationSnapshot([{ serviceCode: "CARPET_CARE" }]),
        2,
      ),
    ).toBeNull();
  });

  it("fails closed for a service code outside the operational allowlist", () => {
    expect(
      immutableOperationalRequirementsFromDurationSnapshot(
        durationSnapshot([{ serviceCode: "FUTURE_SERVICE" }]),
        1,
      ),
    ).toBeNull();
  });
});
