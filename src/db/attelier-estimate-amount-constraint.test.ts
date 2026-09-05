import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { requestEstimates } from "./schema/request-quote";

const constraintName = "request_estimates_amount_group_consistent";
const dialect = new PgDialect();
const currentConstraint = dialect.sqlToQuery(
  getTableConfig(requestEstimates).checks.find(
    (check) => check.name === constraintName,
  )!.value,
).sql;

type AmountShape = Readonly<{
  net: number | null;
  rate: number | null;
  vat: number | null;
  gross: number | null;
  manual: boolean;
  status: "CALCULATED" | "REVIEW_REQUIRED" | "DECLINE_OR_REFER";
}>;

// These predicates use only integer arithmetic, Boolean comparisons and SQL
// NULL operators, whose three-valued CHECK semantics are shared by SQLite and
// PostgreSQL. Execute the actual predicate locally without any database URL.
const truthTableRunner = `
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
const { predicate, rows } = JSON.parse(readFileSync(0, "utf8"));
const database = new DatabaseSync(":memory:");
database.exec("CREATE TABLE request_estimates (net_amount_minor_units INTEGER, vat_rate_basis_points INTEGER, vat_amount_minor_units INTEGER, gross_total_minor_units INTEGER, manual_assessment_required INTEGER NOT NULL, status TEXT NOT NULL, CHECK (" + predicate.replaceAll('"request_estimates".', '') + "))");
const insert = database.prepare("INSERT INTO request_estimates VALUES (?, ?, ?, ?, ?, ?)");
const results = rows.map((row) => {
  try {
    insert.run(row.net, row.rate, row.vat, row.gross, row.manual ? 1 : 0, row.status);
    return true;
  } catch (error) {
    if (!String(error.message).includes("CHECK constraint failed")) throw error;
    return false;
  }
});
database.close();
process.stdout.write(JSON.stringify(results));
`;

function accepted(predicate: string, rows: readonly AmountShape[]): boolean[] {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", truthTableRunner],
    {
      input: JSON.stringify({ predicate, rows }),
      encoding: "utf8",
      timeout: 5_000,
      env: { NODE_ENV: "test" },
    },
  );
  expect({ status: result.status, error: result.error?.message }).toEqual({
    status: 0,
    error: undefined,
  });
  return JSON.parse(result.stdout) as boolean[];
}

function snapshotConstraint(version: "0016" | "0017" | "0018"): string {
  const snapshot = JSON.parse(readFileSync(
    path.join(process.cwd(), `drizzle/meta/${version}_snapshot.json`),
    "utf8",
  ));
  return snapshot.tables["public.request_estimates"].checkConstraints[constraintName].value as string;
}

const complete: AmountShape = {
  net: 100, rate: 2_000, vat: 20, gross: 120,
  manual: true, status: "REVIEW_REQUIRED",
};
const manualKnownRate: AmountShape = {
  ...complete, net: null, vat: null, gross: null,
};

describe("ATTELIER estimate amount constraint compatibility", () => {
  it("uses the same constraint in the schema, generated SQL and snapshot", () => {
    const migration = readFileSync(path.join(
      process.cwd(), "drizzle/0018_attelier_estimate_amount_compatibility.sql",
    ), "utf8");
    const generatedPredicate = migration.match(
      /ADD CONSTRAINT "request_estimates_amount_group_consistent" CHECK \((.+)\);/,
    )?.[1];
    expect(generatedPredicate).toBe(currentConstraint);
    expect(snapshotConstraint("0018")).toBe(currentConstraint);
  });

  it("demonstrates the applied 0017 regression against the prior known-rate manual shape", () => {
    expect(accepted(snapshotConstraint("0016"), [manualKnownRate])).toEqual([true]);
    expect(accepted(snapshotConstraint("0017"), [manualKnownRate])).toEqual([false]);
  });

  it("preserves known-rate manual and decline estimates with no calculated amounts", () => {
    expect(accepted(currentConstraint, [
      manualKnownRate,
      { ...manualKnownRate, status: "DECLINE_OR_REFER" },
      { ...manualKnownRate, rate: 0 },
      { ...manualKnownRate, rate: null },
    ])).toEqual([true, true, true, true]);
  });

  it("permits gross-only unknown VAT solely in the closed review shape", () => {
    const grossOnly = { ...complete, net: null, rate: null, vat: null };
    expect(accepted(currentConstraint, [
      grossOnly,
      { ...grossOnly, manual: false },
      { ...grossOnly, status: "CALCULATED" },
      { ...grossOnly, status: "DECLINE_OR_REFER" },
      { ...grossOnly, gross: -1 },
      { ...grossOnly, rate: 0 },
    ])).toEqual([true, false, false, false, false, false]);
  });

  it("rejects every incomplete mixture of monetary fields without accepting SQL UNKNOWN", () => {
    const fields = ["net", "rate", "vat", "gross"] as const;
    const rows = Array.from({ length: 16 }, (_, mask) => {
      const row = { ...complete };
      fields.forEach((field, index) => {
        if ((mask & (1 << index)) === 0) row[field] = null;
      });
      return row;
    });
    // Nothing calculated (with or without known rate), unresolved-VAT gross
    // for review, or complete arithmetic are the only permitted groups.
    const expected = rows.map((_row, mask) => [0, 2, 8, 15].includes(mask));
    expect(accepted(currentConstraint, rows)).toEqual(expected);
  });

  it("preserves complete statutory arithmetic and rejects mismatches or negative amounts", () => {
    expect(accepted(currentConstraint, [
      complete,
      { ...complete, manual: false, status: "CALCULATED" },
      { ...complete, gross: 121 },
      { ...complete, net: -1, gross: 19 },
      { ...complete, vat: -1, gross: 99 },
      { ...complete, net: 0, rate: 0, vat: 0, gross: 0 },
    ])).toEqual([true, true, false, false, false, true]);
  });
});
