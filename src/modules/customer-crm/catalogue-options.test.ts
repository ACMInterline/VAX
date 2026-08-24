import { sql, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/client";
import { travelZones } from "@/db/schema/commercial-engine";
import {
  cleaningItemTypes,
  conditionLevels,
  fibreMaterials,
  issueTypes,
  riskFlags,
  surfaceConstructions,
} from "@/db/schema/service-catalogue";

vi.mock("server-only", () => ({}));

import { getCustomerCrmCatalogueOptions } from "./catalogue-options";

type OptionRow = { id: number; label: string };

type QueryCall = {
  selection: Record<string, unknown>;
  table: unknown;
  condition: SQL;
  order: readonly unknown[];
};

function fakeDatabase(resultSets: readonly (readonly OptionRow[])[]) {
  const calls: QueryCall[] = [];
  const select = vi.fn((selection: Record<string, unknown>) => ({
    from: (table: unknown) => ({
      where: (condition: SQL) => ({
        orderBy: (...order: unknown[]) => {
          const result = resultSets[calls.length] ?? [];
          calls.push({ selection, table, condition, order });
          return Promise.resolve(result);
        },
      }),
    }),
  }));

  return {
    database: { select } as unknown as Database,
    calls,
    select,
  };
}

const sources = [
  cleaningItemTypes,
  fibreMaterials,
  surfaceConstructions,
  conditionLevels,
  issueTypes,
  riskFlags,
  travelZones,
] as const;

describe("customer CRM catalogue options", () => {
  it.each([
    ["bg", "Български етикет", "labelBg"],
    ["en", "English label", "labelEn"],
  ] as const)(
    "selects numeric IDs with the %s label only",
    async (locale, label, expectedLabelColumn) => {
      const fake = fakeDatabase(
        sources.map((_, index) => [{ id: index + 1, label }]),
      );

      const result = await getCustomerCrmCatalogueOptions(fake.database, locale);

      expect(result).toEqual({
        itemTypes: [{ id: 1, label }],
        fibreMaterials: [{ id: 2, label }],
        surfaceConstructions: [{ id: 3, label }],
        conditionLevels: [{ id: 4, label }],
        issueTypes: [{ id: 5, label }],
        riskFlags: [{ id: 6, label }],
        serviceZones: [{ id: 7, label }],
      });
      expect(fake.calls).toHaveLength(sources.length);
      for (const [index, call] of fake.calls.entries()) {
        expect(call.selection.id).toBe(sources[index]!.id);
        expect(call.selection.label).toBe(sources[index]![expectedLabelColumn]);
        expect(Object.keys(call.selection)).toEqual(["id", "label"]);
      }
    },
  );

  it("queries only active rows in deterministic canonical order", async () => {
    const fake = fakeDatabase(sources.map(() => []));
    const dialect = new PgDialect();

    await getCustomerCrmCatalogueOptions(fake.database, "en");

    expect(fake.select).toHaveBeenCalledTimes(sources.length);
    for (const [index, call] of fake.calls.entries()) {
      const source = sources[index]!;
      const condition = dialect.sqlToQuery(call.condition);
      const orderedColumns = call.order.map((column) =>
        dialect.sqlToQuery(sql`${column}`).sql,
      );

      expect(call.table).toBe(source);
      expect(condition.sql).toContain("active");
      expect(condition.params).toEqual([true]);
      expect(orderedColumns).toEqual([
        expect.stringContaining("sort_order"),
        expect.stringContaining("code"),
        expect.stringContaining("id"),
      ]);
    }
  });

  it("returns safe empty option arrays when no active rows exist", async () => {
    const fake = fakeDatabase(sources.map(() => []));

    await expect(
      getCustomerCrmCatalogueOptions(fake.database, "bg"),
    ).resolves.toEqual({
      itemTypes: [],
      fibreMaterials: [],
      surfaceConstructions: [],
      conditionLevels: [],
      issueTypes: [],
      riskFlags: [],
      serviceZones: [],
    });
  });
});
