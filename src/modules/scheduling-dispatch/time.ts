import { SOFIA_TIME_ZONE } from "./types";

const localPartsFormatter = new Intl.DateTimeFormat(
  "en-GB-u-ca-gregory-nu-latn",
  {
    timeZone: SOFIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  },
);

type CalendarParts = Readonly<{
  year: number;
  month: number;
  day: number;
}>;

type DateTimeParts = CalendarParts &
  Readonly<{
    hour: number;
    minute: number;
    second: number;
  }>;

function utcMilliseconds(parts: DateTimeParts): number {
  const instant = new Date(0);
  instant.setUTCHours(
    parts.hour,
    parts.minute,
    parts.second,
    0,
  );
  instant.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  return instant.valueOf();
}

function parseCalendarDate(localDate: string): CalendarParts {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    throw new Error("Sofia date must use YYYY-MM-DD.");
  }
  const [yearText, monthText, dayText] = localDate.split("-");
  const parts = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
  };
  const roundTrip = new Date(
    utcMilliseconds({ ...parts, hour: 0, minute: 0, second: 0 }),
  );
  if (
    roundTrip.getUTCFullYear() !== parts.year ||
    roundTrip.getUTCMonth() !== parts.month - 1 ||
    roundTrip.getUTCDate() !== parts.day
  ) {
    throw new Error("Sofia date must be a real calendar date.");
  }
  return parts;
}

function partsAt(instant: Date): DateTimeParts {
  if (Number.isNaN(instant.valueOf())) {
    throw new Error("Instant must be a valid Date.");
  }
  const values = new Map(
    localPartsFormatter
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const part = (name: Intl.DateTimeFormatPartTypes): number => {
    const value = values.get(name);
    if (value === undefined || !Number.isInteger(value)) {
      throw new Error(`Unable to read Sofia ${name}.`);
    }
    return value;
  };
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

function sameDateTime(left: DateTimeParts, right: DateTimeParts): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  );
}

function shiftSofiaDate(localDate: string, days: number): string {
  const parts = parseCalendarDate(localDate);
  const shifted = new Date(
    utcMilliseconds({ ...parts, hour: 12, minute: 0, second: 0 }),
  );
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return [
    String(shifted.getUTCFullYear()).padStart(4, "0"),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function sofiaLocalDate(instant: Date): string {
  const parts = partsAt(instant);
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

export function sofiaTodayDate(now: Date = new Date()): string {
  return sofiaLocalDate(now);
}

export function sofiaMinuteOfDay(
  instant: Date,
  expectedLocalDate?: string,
): number {
  const parts = partsAt(instant);
  const localDate = sofiaLocalDate(instant);
  if (expectedLocalDate !== undefined && localDate !== expectedLocalDate) {
    throw new Error("Instant is outside the expected Sofia calendar date.");
  }
  return parts.hour * 60 + parts.minute;
}

export function previousSofiaDate(localDate: string): string {
  return shiftSofiaDate(localDate, -1);
}

export function nextSofiaDate(localDate: string): string {
  return shiftSofiaDate(localDate, 1);
}

/**
 * Converts one Sofia wall-clock minute to its sole matching instant. A local
 * time skipped by the spring transition or repeated by the autumn transition
 * is rejected rather than guessed.
 */
export function sofiaLocalMinuteToInstant(
  localDate: string,
  minuteOfDay: number,
): Date {
  const date = parseCalendarDate(localDate);
  if (
    !Number.isSafeInteger(minuteOfDay) ||
    minuteOfDay < 0 ||
    minuteOfDay >= 24 * 60
  ) {
    throw new Error("Sofia minute must be an integer from 0 through 1439.");
  }
  const target: DateTimeParts = {
    ...date,
    hour: Math.floor(minuteOfDay / 60),
    minute: minuteOfDay % 60,
    second: 0,
  };
  const nominalUtc = utcMilliseconds(target);
  const possibleOffsets = new Set<number>();

  // Sampling both sides of the civil date captures every offset involved in a
  // Sofia transition without trusting the deployment host's local zone.
  for (let deltaHours = -48; deltaHours <= 48; deltaHours += 3) {
    const sample = new Date(nominalUtc + deltaHours * 60 * 60 * 1_000);
    possibleOffsets.add(utcMilliseconds(partsAt(sample)) - sample.valueOf());
  }

  const matches = [...possibleOffsets]
    .map((offset) => new Date(nominalUtc - offset))
    .filter((candidate) => sameDateTime(partsAt(candidate), target))
    .filter(
      (candidate, index, candidates) =>
        candidates.findIndex(
          (other) => other.valueOf() === candidate.valueOf(),
        ) === index,
    )
    .sort((left, right) => left.valueOf() - right.valueOf());

  if (matches.length === 0) {
    throw new Error("Sofia local time does not exist because of a clock change.");
  }
  if (matches.length > 1) {
    throw new Error("Sofia local time is ambiguous because of a clock change.");
  }
  return matches[0];
}

export type SofiaDayBounds = Readonly<{
  startInclusive: Date;
  endExclusive: Date;
}>;

export function sofiaDayBounds(localDate: string): SofiaDayBounds {
  return {
    startInclusive: sofiaLocalMinuteToInstant(localDate, 0),
    endExclusive: sofiaLocalMinuteToInstant(nextSofiaDate(localDate), 0),
  };
}
