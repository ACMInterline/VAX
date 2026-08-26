import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationPath = path.join(
  root,
  "drizzle/0008_phase_3f_job_execution.sql",
);
const journalPath = path.join(root, "drizzle/meta/_journal.json");

const expectedTables = [
  "cleaning_passport_entries",
  "job_audit_events",
  "job_item_inspection_issues",
  "job_item_inspection_risks",
  "job_item_inspections",
  "job_item_treatment_executions",
  "job_item_treatment_plan_addons",
  "job_item_treatment_plans",
  "job_items",
  "jobs",
  "team_memberships",
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

describe("Phase 3F Job execution migration boundary", () => {
  it("creates exactly the eleven authorized operational tables", async () => {
    const migration = await readFile(migrationPath, "utf8");
    expect(namedObjects(migration, /CREATE TABLE "([^"]+)"/g)).toEqual(
      [...expectedTables].sort(),
    );
    expect(migration).not.toMatch(
      /CREATE TABLE "[^"]*(?:payment|invoice|message|notification|payroll|inventory)[^"]*"/i,
    );
  });

  it("is additive, contains no data rewrite, and never touches Neon Auth", async () => {
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

  it("keeps commercial values out of the operational Job tables", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const tableStatements = statements(migration).filter((statement) =>
      statement.startsWith("CREATE TABLE"),
    );
    for (const statement of tableStatements) {
      expect(statement).not.toMatch(
        /"(?:price|amount|gross|net|vat|currency|margin|revenue)[^"]*"/i,
      );
    }
    expect(migration).toContain('"source_provenance_snapshot" jsonb NOT NULL');
    expect(migration).toContain('"completion_snapshot" jsonb');
    expect(migration).toContain('"customer_safe_snapshot" jsonb NOT NULL');
  });

  it("preserves history with explicit restrictive or actor-set-null references", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const foreignKeys = statements(migration).filter((statement) =>
      statement.includes(" FOREIGN KEY "),
    );
    expect(foreignKeys).toHaveLength(64);
    expect(foreignKeys.filter((key) => /ON DELETE restrict/i.test(key)))
      .toHaveLength(52);
    expect(foreignKeys.filter((key) => /ON DELETE set null/i.test(key)))
      .toHaveLength(12);
    for (const key of foreignKeys) {
      expect(key).toMatch(/ON DELETE (?:restrict|set null)/i);
      if (/ON DELETE set null/i.test(key)) {
        expect(key).toMatch(
          /FOREIGN KEY \("(?:actor|created_by|updated_by|completed_by|cancelled_by|inspected_by|confirmed_by|performed_by)_profile_id"\) REFERENCES "public"\."user_profiles"/,
        );
      }
    }
  });

  it("creates every composite parent key before its dependent foreign key", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const prerequisites = [
      ["cleaning_assets_id_property_unique", "job_items_cleaning_asset_property_fk"],
      ["booking_items_id_booking_unique", "job_items_booking_item_provenance_fk"],
      [
        "booking_occupancies_id_booking_version_team_unique",
        "jobs_booking_occupancy_provenance_fk",
      ],
      ["bookings_id_customer_property_unique", "jobs_booking_provenance_fk"],
      ["jobs_id_booking_property_unique", "job_items_job_provenance_fk"],
      ["job_items_id_job_unique", "job_item_inspections_item_scope_fk"],
      ["job_items_id_job_asset_unique", "cleaning_passport_entries_item_asset_scope_fk"],
      ["job_item_inspections_id_item_job_unique", "job_item_treatment_plans_inspection_scope_fk"],
      ["job_item_treatment_plans_id_item_job_unique", "job_item_treatment_executions_plan_scope_fk"],
      [
        "job_item_treatment_executions_passport_provenance_unique",
        "cleaning_passport_entries_execution_scope_fk",
      ],
    ] as const;
    for (const [indexName, foreignKeyName] of prerequisites) {
      const indexPosition = migration.indexOf(`CREATE UNIQUE INDEX "${indexName}"`);
      const foreignKeyPosition = migration.indexOf(
        `ADD CONSTRAINT "${foreignKeyName}"`,
      );
      expect(indexPosition).toBeGreaterThanOrEqual(0);
      expect(foreignKeyPosition).toBeGreaterThanOrEqual(0);
      expect(indexPosition).toBeLessThan(foreignKeyPosition);
    }
  });

  it("enforces one Booking, inspection, plan, execution and Passport chain", async () => {
    const migration = await readFile(migrationPath, "utf8");
    for (const indexName of [
      "jobs_booking_unique",
      "job_items_booking_item_unique",
      "job_item_inspections_item_unique",
      "job_item_treatment_plans_item_unique",
      "job_item_treatment_executions_item_unique",
      "job_item_treatment_executions_plan_unique",
      "cleaning_passport_entries_job_item_unique",
      "cleaning_passport_entries_execution_unique",
    ]) {
      expect(migration).toContain(`CREATE UNIQUE INDEX "${indexName}"`);
    }
    expect(migration).toContain("job_item_inspections_unsafe_not_feasible");
    expect(migration).toContain("jobs_status_timestamps_consistent");
    expect(migration).toContain("jobs_completion_consistent");
    expect(migration).toContain(
      'FOREIGN KEY ("source_occupancy_id","booking_id","source_occupancy_snapshot_version","assigned_team_id") REFERENCES "public"."booking_occupancies"("id","booking_id","snapshot_version","team_id")',
    );
  });

  it("binds Passport entries to exact successful completed execution facts", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const passportTable = statements(migration).find((statement) =>
      statement.startsWith('CREATE TABLE "cleaning_passport_entries"'),
    );

    expect(passportTable).toBeDefined();
    expect(passportTable).toContain(
      '"source_execution_status" varchar(16) NOT NULL',
    );
    expect(passportTable).toContain(
      'CONSTRAINT "cleaning_passport_entries_source_execution_completed" CHECK ("cleaning_passport_entries"."source_execution_status" = \'COMPLETED\')',
    );
    expect(passportTable).not.toContain("NO_OBSERVABLE_IMPROVEMENT");
    expect(passportTable).not.toContain("STOPPED_FOR_SAFETY");
    expect(migration).toContain(
      'FOREIGN KEY ("treatment_execution_id","job_item_id","job_id","source_execution_status","completed_at","result_classification","treatment_level_id","mechanical_action_level_id","treatment_approach_id") REFERENCES "public"."job_item_treatment_executions"("id","job_item_id","job_id","status","completed_at","result_classification","performed_treatment_level_id","performed_mechanical_action_level_id","performed_treatment_approach_id")',
    );
  });

  it("places migration 0008 directly after Phase 3E", async () => {
    const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
      version: string;
      dialect: string;
      entries: Array<{
        idx: number;
        tag: string;
        breakpoints: boolean;
      }>;
    };
    const previous = journal.entries.at(-2);
    const current = journal.entries.at(-1);
    expect(journal).toMatchObject({ version: "7", dialect: "postgresql" });
    expect(previous).toMatchObject({
      idx: 7,
      tag: "0007_phase_3e_booking_engine",
      breakpoints: true,
    });
    expect(current).toMatchObject({
      idx: 8,
      tag: "0008_phase_3f_job_execution",
      breakpoints: true,
    });
  });
});
