import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client";
import { communicationTemplates } from "./schema/communications-documents";
import { seedCommunicationsDocuments } from "./seed-communications-documents";

type SeedTemplateRow = Readonly<{
  templateKey: string;
  version: number;
  locale: "bg" | "en";
  status: "ACTIVE";
  activatedAt: Date;
}>;

describe("communications and documents canonical seed", () => {
  it("seeds exactly one active Bulgarian and English version of all nine templates", async () => {
    const onConflictDoNothing = vi.fn(async () => undefined);
    const values = vi.fn((rows: readonly SeedTemplateRow[]) => {
      void rows;
      return { onConflictDoNothing };
    });
    const insert = vi.fn(() => ({ values }));
    const database = { insert } as unknown as Database;

    await seedCommunicationsDocuments(database);

    expect(insert).toHaveBeenCalledWith(communicationTemplates);
    expect(values).toHaveBeenCalledTimes(1);
    const rows = values.mock.calls[0]![0];
    expect(rows).toHaveLength(18);
    expect(new Set(rows.map((row) => row.templateKey))).toEqual(
      new Set([
        "quote_issued",
        "booking_confirmed",
        "booking_rescheduled",
        "booking_cancelled",
        "job_completed",
        "cleaning_passport_ready",
        "invoice_issued",
        "payment_confirmed",
        "payment_reversed",
      ]),
    );
    for (const templateKey of new Set(rows.map((row) => row.templateKey))) {
      const variants = rows.filter((row) => row.templateKey === templateKey);
      expect(variants.map((row) => row.locale).sort()).toEqual(["bg", "en"]);
      expect(variants.every((row) => row.version === 1)).toBe(true);
      expect(variants.every((row) => row.status === "ACTIVE")).toBe(true);
      expect(variants.every((row) => row.activatedAt instanceof Date)).toBe(
        true,
      );
    }
  });

  it("preserves an existing canonical version through conflict-do-nothing", async () => {
    const onConflictDoNothing = vi.fn(async () => undefined);
    const values = vi.fn((rows: readonly SeedTemplateRow[]) => {
      void rows;
      return { onConflictDoNothing };
    });
    const insert = vi.fn(() => ({ values }));

    await seedCommunicationsDocuments({ insert } as unknown as Database);

    expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
    expect(onConflictDoNothing).toHaveBeenCalledWith();
  });
});
