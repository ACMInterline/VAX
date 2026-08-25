import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationPath = path.join(
  root,
  "drizzle/0006_phase_3d_request_quote.sql",
);
const journalPath = path.join(root, "drizzle/meta/_journal.json");

const expectedTables = [
  "business_audit_events",
  "quote_items",
  "quotes",
  "request_estimates",
  "service_request_item_addons",
  "service_request_item_issues",
  "service_request_items",
  "service_requests",
] as const;

function statements(migration: string): string[] {
  return migration
    .split(/-->\s*statement-breakpoint/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function namedObjects(migration: string, pattern: RegExp): string[] {
  return [...migration.matchAll(pattern)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined)
    .sort();
}

describe("Phase 3D request and quote migration boundary", () => {
  it("creates exactly the eight authorized Phase 3D tables", async () => {
    const migration = await readFile(migrationPath, "utf8");

    expect(namedObjects(migration, /CREATE TABLE "([^"]+)"/g)).toEqual(
      [...expectedTables].sort(),
    );
    expect(migration).not.toMatch(
      /CREATE TABLE "(?:bookings?|payments?|invoices?|jobs?|messages?|files?|schedule_occupancy)"/i,
    );
  });

  it("contains no destructive or data-rewrite statement and never touches Neon Auth", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const withoutForeignKeyActions = migration
      .replace(/\bON DELETE (?:restrict|set null|no action)\b/gi, "")
      .replace(/\bON UPDATE (?:restrict|set null|no action)\b/gi, "");

    expect(withoutForeignKeyActions).not.toMatch(
      /\b(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/i,
    );
    expect(migration).not.toMatch(/neon_auth/i);
    expect(migration).not.toMatch(/\bCASCADE\b/i);
  });

  it("preserves business history through restrictive references", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const foreignKeys = statements(migration).filter((statement) =>
      statement.includes(" FOREIGN KEY "),
    );

    expect(foreignKeys).toHaveLength(40);
    for (const foreignKey of foreignKeys) {
      expect(foreignKey).toMatch(/ON DELETE (?:restrict|set null)/i);
      if (/ON DELETE set null/i.test(foreignKey)) {
        expect(foreignKey).toMatch(
          /FOREIGN KEY \("(?:actor_profile_id|calculated_by_profile_id|created_by_profile_id|updated_by_profile_id)"\)/,
        );
      }
    }

    expect(foreignKeys.filter((key) => /ON DELETE set null/i.test(key)))
      .toHaveLength(10);
    expect(foreignKeys.filter((key) => /ON DELETE restrict/i.test(key)))
      .toHaveLength(30);

    expect(migration).toContain('"customer_reported_condition_level_id" integer');
    expect(migration).toContain('"normalized_condition_level_id" integer');
    expect(migration).toContain('"reported_fibre_material_id" integer');
    expect(migration).toContain('"normalized_fibre_material_id" integer');
    expect(migration).toContain('"reported_surface_construction_id" integer');
    expect(migration).toContain('"normalized_surface_construction_id" integer');
    expect(migration).toContain(
      'FOREIGN KEY ("normalized_fibre_material_id") REFERENCES "public"."fibre_materials"("id") ON DELETE restrict',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("normalized_surface_construction_id") REFERENCES "public"."surface_constructions"("id") ON DELETE restrict',
    );
    expect(migration).toContain('"source_request_version" integer NOT NULL');
  });

  it("uses integer money and enforces version, issue and quote concurrency invariants", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const createStatements = statements(migration).filter((statement) =>
      statement.startsWith("CREATE TABLE"),
    );
    const moneyColumns = [
      "net_amount_minor_units",
      "vat_amount_minor_units",
      "gross_total_minor_units",
      "base_amount_minor_units",
      "modifier_amount_minor_units",
      "addon_amount_minor_units",
    ];

    for (const statement of createStatements) {
      for (const column of moneyColumns) {
        if (statement.includes(`"${column}"`)) {
          expect(statement).toMatch(new RegExp(`"${column}" integer`));
          expect(statement).not.toMatch(
            new RegExp(`"${column}" (?:real|double precision|numeric)`),
          );
        }
      }
    }

    expect(migration).toContain(
      'CREATE UNIQUE INDEX "request_estimates_request_version_unique"',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "quotes_request_version_unique"',
    );
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "quotes_active_issued_request_unique"[\s\S]*?WHERE "quotes"\."status" = 'ISSUED'/,
    );
    expect(migration).toContain(
      'FOREIGN KEY ("estimate_id","request_id") REFERENCES "public"."request_estimates"("id","request_id") ON DELETE restrict',
    );
    const estimateRequestTargetIndex = migration.indexOf(
      'CREATE UNIQUE INDEX "request_estimates_id_request_unique"',
    );
    const estimateRequestForeignKey = migration.indexOf(
      'ADD CONSTRAINT "quotes_estimate_request_fk"',
    );
    expect(migration.indexOf('CREATE TABLE "request_estimates"')).toBeLessThan(
      estimateRequestTargetIndex,
    );
    expect(estimateRequestTargetIndex).toBeLessThan(estimateRequestForeignKey);
  });

  it("places migration 0006 directly after the Phase 3C CRM migration", async () => {
    const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
      version: string;
      dialect: string;
      entries: Array<{
        idx: number;
        version: string;
        tag: string;
        breakpoints: boolean;
      }>;
    };
    const previous = journal.entries.find(
      (entry) => entry.tag === "0005_add_customer_property_crm",
    );
    const current = journal.entries.find(
      (entry) => entry.tag === "0006_phase_3d_request_quote",
    );

    expect(journal).toMatchObject({ version: "7", dialect: "postgresql" });
    expect(previous).toMatchObject({
      idx: 5,
      tag: "0005_add_customer_property_crm",
      breakpoints: true,
    });
    expect(current).toMatchObject({
      idx: 6,
      tag: "0006_phase_3d_request_quote",
      breakpoints: true,
    });
    expect(current?.idx).toBe((previous?.idx ?? -1) + 1);
  });
});
