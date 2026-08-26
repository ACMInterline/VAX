import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationPath = path.join(
  root,
  "drizzle/0007_phase_3e_booking_engine.sql",
);
const journalPath = path.join(root, "drizzle/meta/_journal.json");

const expectedTables = [
  "booking_audit_events",
  "booking_items",
  "booking_occupancies",
  "bookings",
  "quote_acceptances",
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

function statementContaining(migration: string, text: string): string {
  const statement = statements(migration).find((candidate) =>
    candidate.includes(text),
  );

  expect(
    statement,
    `missing migration statement containing ${text}`,
  ).toBeDefined();
  return statement ?? "";
}

describe("Phase 3E quote acceptance and booking migration boundary", () => {
  it("creates exactly the five authorized Phase 3E tables", async () => {
    const migration = await readFile(migrationPath, "utf8");

    expect(namedObjects(migration, /CREATE TABLE "([^"]+)"/g)).toEqual(
      [...expectedTables].sort(),
    );
    expect(migration).not.toMatch(
      /CREATE TABLE "[^"]*(?:payment|invoice|job|message|treatment_record)[^"]*"/i,
    );
  });

  it("is additive apart from the required btree_gist extension and never touches Neon Auth", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const extensionStatements = statements(migration).filter((statement) =>
      /^CREATE EXTENSION\b/i.test(statement),
    );
    const withoutForeignKeyActions = migration
      .replace(/\bON DELETE (?:restrict|set null|no action)\b/gi, "")
      .replace(/\bON UPDATE (?:restrict|set null|no action)\b/gi, "");

    expect(extensionStatements).toEqual([
      'CREATE EXTENSION IF NOT EXISTS "btree_gist";',
    ]);
    expect(withoutForeignKeyActions).not.toMatch(
      /\b(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/i,
    );
    expect(migration).not.toMatch(/neon_auth/i);
    expect(migration).not.toMatch(/\bCASCADE\b/i);
    expect(migration).toContain(
      'ALTER TABLE "quotes" ADD COLUMN "acceptance_source_snapshot" jsonb;',
    );
    expect(migration).not.toMatch(
      /acceptance_source_snapshot" jsonb NOT NULL/i,
    );
  });

  it("creates composite uniqueness before each dependent provenance foreign key", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const prerequisites = [
      [
        'CREATE UNIQUE INDEX "quote_acceptances_booking_provenance_unique"',
        'ADD CONSTRAINT "bookings_acceptance_provenance_fk"',
      ],
      [
        'CREATE UNIQUE INDEX "quotes_booking_provenance_unique"',
        'ADD CONSTRAINT "quote_acceptances_quote_provenance_fk"',
      ],
    ] as const;

    for (const [uniqueIndex, foreignKey] of prerequisites) {
      expect(migration.indexOf(uniqueIndex)).toBeGreaterThanOrEqual(0);
      expect(migration.indexOf(foreignKey)).toBeGreaterThanOrEqual(0);
      expect(migration.indexOf(uniqueIndex)).toBeLessThan(
        migration.indexOf(foreignKey),
      );
    }
  });

  it("preserves acceptance, booking, item, occupancy and audit history through restrictive references", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const foreignKeys = statements(migration).filter((statement) =>
      statement.includes(" FOREIGN KEY "),
    );

    expect(foreignKeys).toHaveLength(22);
    expect(
      foreignKeys.filter((key) => /ON DELETE restrict/i.test(key)),
    ).toHaveLength(15);
    expect(
      foreignKeys.filter((key) => /ON DELETE set null/i.test(key)),
    ).toHaveLength(7);

    for (const foreignKey of foreignKeys) {
      expect(foreignKey).toMatch(/ON DELETE (?:restrict|set null)/i);
      if (/ON DELETE set null/i.test(foreignKey)) {
        expect(foreignKey).toMatch(
          /FOREIGN KEY \("(?:accepted_by|actor|created_by|updated_by|cancelled_by)_profile_id"\) REFERENCES "public"\."user_profiles"/,
        );
      }
    }

    expect(migration).toContain(
      'FOREIGN KEY ("quote_id","request_id","customer_id","property_id") REFERENCES "public"."quotes"("id","request_id","customer_id","property_id") ON DELETE restrict',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("quote_acceptance_id","quote_id","request_id","customer_id","property_id") REFERENCES "public"."quote_acceptances"("id","quote_id","request_id","customer_id","property_id") ON DELETE restrict',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("previous_occupancy_id") REFERENCES "public"."booking_occupancies"("id") ON DELETE restrict',
    );
  });

  it("uses immutable JSON snapshots and integer minor-unit money", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const createStatements = statements(migration).filter((statement) =>
      statement.startsWith("CREATE TABLE"),
    );
    const moneyColumns = [
      "base_amount_minor_units",
      "modifier_amount_minor_units",
      "addon_amount_minor_units",
      "net_amount_minor_units",
      "vat_rate_basis_points",
      "vat_amount_minor_units",
      "gross_total_minor_units",
    ];
    const snapshotColumns = [
      "commercial_snapshot",
      "terms_snapshot",
      "pricing_snapshot",
      "duration_snapshot",
      "provenance_snapshot",
      "price_snapshot",
      "scheduling_snapshot",
      "customer_snapshot",
      "property_snapshot",
      "measurement_snapshot",
      "calculation_snapshot",
      "duration_basis_snapshot",
      "availability_input_snapshot",
      "availability_result_snapshot",
      "travel_snapshot",
      "working_hours_snapshot",
      "equipment_snapshot",
    ];

    for (const column of moneyColumns) {
      const owner = createStatements.find((statement) =>
        statement.includes(`"${column}"`),
      );
      expect(owner, `missing monetary column ${column}`).toBeDefined();
      expect(owner).toMatch(new RegExp(`"${column}" integer NOT NULL`));
      expect(owner).not.toMatch(
        new RegExp(`"${column}" (?:real|double precision|numeric)`),
      );
    }

    for (const column of snapshotColumns) {
      expect(migration).toMatch(new RegExp(`"${column}" jsonb NOT NULL`));
    }

    expect(
      statementContaining(migration, 'CREATE TABLE "quote_acceptances"'),
    ).not.toContain('"updated_at"');
    expect(
      statementContaining(migration, 'CREATE TABLE "booking_items"'),
    ).not.toContain('"updated_at"');
    expect(
      statementContaining(migration, 'CREATE TABLE "booking_occupancies"'),
    ).not.toContain('"updated_at"');
    expect(
      statementContaining(migration, 'CREATE TABLE "booking_audit_events"'),
    ).not.toContain('"updated_at"');
  });

  it("enforces quote, acceptance, booking and append-only occupancy uniqueness", async () => {
    const migration = await readFile(migrationPath, "utf8");

    for (const indexName of [
      "quote_acceptances_quote_unique",
      "quote_acceptances_booking_provenance_unique",
      "bookings_quote_unique",
      "bookings_acceptance_unique",
      "bookings_reference_unique",
      "booking_items_booking_sort_unique",
      "booking_items_booking_quote_item_unique",
      "booking_occupancies_booking_version_unique",
      "booking_occupancies_blocking_booking_unique",
    ]) {
      expect(migration).toContain(`CREATE UNIQUE INDEX "${indexName}"`);
    }

    expect(migration).toContain(
      'CREATE UNIQUE INDEX "quote_acceptances_quote_unique" ON "quote_acceptances" USING btree ("quote_id")',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "bookings_quote_unique" ON "bookings" USING btree ("quote_id")',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "bookings_acceptance_unique" ON "bookings" USING btree ("quote_acceptance_id")',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "bookings_reference_unique" ON "bookings" USING btree ("booking_reference")',
    );
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "booking_occupancies_blocking_booking_unique"[\s\S]*?WHERE "booking_occupancies"\."status" in \('PENDING', 'CONFIRMED'\)/,
    );
  });

  it("prevents concurrent team and equipment overlaps with half-open operational ranges", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const teamConstraint = statementContaining(
      migration,
      'CONSTRAINT "booking_occupancies_team_no_overlap"',
    );
    const equipmentConstraint = statementContaining(
      migration,
      'CONSTRAINT "booking_occupancies_equipment_no_overlap"',
    );

    expect(teamConstraint).toMatch(/EXCLUDE USING gist/i);
    expect(teamConstraint).toContain('"team_id" WITH =');
    expect(teamConstraint).toContain(
      'tstzrange("operational_start", "operational_end", \'[)\') WITH &&',
    );
    expect(teamConstraint).toMatch(
      /WHERE \("status" in \('PENDING', 'CONFIRMED'\)\)/,
    );
    expect(teamConstraint).not.toContain("CANCELLED");

    expect(equipmentConstraint).toMatch(/EXCLUDE USING gist/i);
    expect(equipmentConstraint).toContain('"equipment_resource_id" WITH =');
    expect(equipmentConstraint).toContain(
      'tstzrange("operational_start", "operational_end", \'[)\') WITH &&',
    );
    expect(equipmentConstraint).toMatch(
      /WHERE \("equipment_resource_id" is not null and "status" in \('PENDING', 'CONFIRMED'\)\)/,
    );
    expect(equipmentConstraint).not.toContain("CANCELLED");

    expect(migration).toContain(
      'CHECK ("booking_occupancies"."status" in (\'PENDING\', \'CONFIRMED\', \'CANCELLED\'))',
    );
  });

  it("places migration 0007 directly after the Phase 3D request and quote migration", async () => {
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
      (entry) => entry.tag === "0006_phase_3d_request_quote",
    );
    const current = journal.entries.find(
      (entry) => entry.tag === "0007_phase_3e_booking_engine",
    );

    expect(journal).toMatchObject({ version: "7", dialect: "postgresql" });
    expect(previous).toMatchObject({
      idx: 6,
      tag: "0006_phase_3d_request_quote",
      breakpoints: true,
    });
    expect(current).toMatchObject({
      idx: 7,
      tag: "0007_phase_3e_booking_engine",
      breakpoints: true,
    });
    expect(current?.idx).toBe((previous?.idx ?? -1) + 1);
  });
});
