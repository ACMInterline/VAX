import { describe, expect, it } from "vitest";
import {
  nextSofiaDate,
  previousSofiaDate,
  sofiaDayBounds,
  sofiaLocalDate,
  sofiaLocalMinuteToInstant,
  sofiaTodayDate,
} from "./time";

describe("Europe/Sofia civil-time helpers", () => {
  it("derives today and neighboring civil dates independently of host timezone", () => {
    expect(sofiaTodayDate(new Date("2026-08-25T21:30:00.000Z"))).toBe(
      "2026-08-26",
    );
    expect(sofiaLocalDate(new Date("2026-12-31T22:30:00.000Z"))).toBe(
      "2027-01-01",
    );
    expect(previousSofiaDate("2026-03-01")).toBe("2026-02-28");
    expect(nextSofiaDate("2028-02-28")).toBe("2028-02-29");
    expect(nextSofiaDate("2026-12-31")).toBe("2027-01-01");
  });

  it("converts an ordinary Sofia local minute to its sole instant", () => {
    expect(
      sofiaLocalMinuteToInstant("2026-08-26", 9 * 60 + 30).toISOString(),
    ).toBe("2026-08-26T06:30:00.000Z");
  });

  it("rejects the nonexistent local time at the spring transition", () => {
    expect(() =>
      sofiaLocalMinuteToInstant("2026-03-29", 3 * 60 + 30),
    ).toThrow(/does not exist/i);
  });

  it("rejects the repeated local time at the autumn transition", () => {
    expect(() =>
      sofiaLocalMinuteToInstant("2026-10-25", 3 * 60 + 30),
    ).toThrow(/ambiguous/i);
  });

  it("uses civil-day bounds that retain 23-hour and 25-hour DST days", () => {
    const spring = sofiaDayBounds("2026-03-29");
    const autumn = sofiaDayBounds("2026-10-25");
    expect(
      (spring.endExclusive.valueOf() - spring.startInclusive.valueOf()) /
        3_600_000,
    ).toBe(23);
    expect(
      (autumn.endExclusive.valueOf() - autumn.startInclusive.valueOf()) /
        3_600_000,
    ).toBe(25);
  });

  it("rejects malformed dates and out-of-range local minutes", () => {
    expect(() => sofiaDayBounds("2026-02-30")).toThrow(/real calendar/i);
    expect(() => sofiaLocalMinuteToInstant("2026-08-26", 1_440)).toThrow(
      /0 through 1439/i,
    );
  });
});
