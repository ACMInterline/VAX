import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationPath = path.join(
  root,
  "drizzle/0005_add_customer_property_crm.sql",
);
const journalPath = path.join(root, "drizzle/meta/_journal.json");

const expectedTables = [
  "cleaning_asset_reported_issues",
  "cleaning_asset_reported_risk_flags",
  "cleaning_assets",
  "customer_contacts",
  "customer_identity_links",
  "customers",
  "properties",
  "property_areas",
] as const;

const expectedIndexes = [
  "cleaning_assets_area_status_idx",
  "cleaning_assets_item_type_status_idx",
  "cleaning_assets_property_status_idx",
  "customer_contacts_active_primary_unique",
  "customer_contacts_customer_active_idx",
  "customer_contacts_email_idx",
  "customer_identity_links_active_pair_unique",
  "customer_identity_links_customer_active_idx",
  "customers_primary_email_idx",
  "customers_status_type_name_idx",
  "properties_customer_status_idx",
  "property_areas_id_property_unique",
  "property_areas_property_active_idx",
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

describe("Phase 3C CRM migration boundary", () => {
  it("creates exactly the eight approved CRM tables", async () => {
    const migration = await readFile(migrationPath, "utf8");

    expect(namedObjects(migration, /CREATE TABLE "([^"]+)"/g)).toEqual(
      [...expectedTables].sort(),
    );
    expect(
      namedObjects(migration, /CREATE TABLE "([^"]+)"/g).filter((table) =>
        /request|quote|booking|payment|invoice|job/i.test(table),
      ),
    ).toEqual([]);
  });

  it("contains no destructive or data-mutation statement and never touches Neon Auth", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const withoutForeignKeyActions = migration
      .replace(/\bON DELETE (?:restrict|set null|no action)\b/gi, "")
      .replace(/\bON UPDATE (?:restrict|set null|no action)\b/gi, "");

    expect(withoutForeignKeyActions).not.toMatch(
      /\b(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/i,
    );
    expect(statements(migration)).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/i),
      ]),
    );
    expect(migration).not.toMatch(/neon_auth/i);
    expect(migration).not.toMatch(/\bCASCADE\b/i);
  });

  it("restricts every business or canonical reference and sets null only actor metadata", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const foreignKeys = statements(migration).filter((statement) =>
      statement.includes(" FOREIGN KEY "),
    );

    expect(foreignKeys).toHaveLength(32);
    for (const foreignKey of foreignKeys) {
      const localColumns = foreignKey.match(/FOREIGN KEY \(([^)]+)\)/)?.[1];
      const isActorMetadata = localColumns
        ?.split(",")
        .map((column) => column.replaceAll('"', "").trim())
        .every((column) =>
          [
            "created_by_profile_id",
            "updated_by_profile_id",
            "revoked_by_profile_id",
          ].includes(column),
        );

      if (isActorMetadata) {
        expect(foreignKey).toMatch(/ON DELETE set null/i);
      } else {
        expect(foreignKey).toMatch(/ON DELETE restrict/i);
      }
    }

    const setNullForeignKeys = foreignKeys.filter((foreignKey) =>
      /ON DELETE set null/i.test(foreignKey),
    );
    expect(setNullForeignKeys).toHaveLength(16);
    expect(
      setNullForeignKeys.every((foreignKey) =>
        /FOREIGN KEY \("(?:created|updated|revoked)_by_profile_id"\)/.test(
          foreignKey,
        ),
      ),
    ).toBe(true);
  });

  it("retains the ownership FK, optimistic versions and practical access indexes", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const migrationStatements = statements(migration);

    expect(migration).toContain(
      'FOREIGN KEY ("area_id","property_id") REFERENCES "public"."property_areas"("id","property_id") ON DELETE restrict',
    );
    expect(
      migration.indexOf(
        'CREATE UNIQUE INDEX "property_areas_id_property_unique"',
      ),
    ).toBeLessThan(
      migration.indexOf(
        'ADD CONSTRAINT "cleaning_assets_area_property_fk"',
      ),
    );
    expect(namedObjects(migration, /CREATE (?:UNIQUE )?INDEX "([^"]+)"/g)).toEqual(
      [...expectedIndexes].sort(),
    );
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "customer_contacts_active_primary_unique"[\s\S]*?WHERE[\s\S]*?"is_primary" = true/,
    );
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "customer_identity_links_active_pair_unique"[\s\S]*?WHERE[\s\S]*?"active" = true/,
    );

    for (const table of [
      "customers",
      "customer_contacts",
      "properties",
      "property_areas",
      "cleaning_assets",
    ]) {
      const createStatement = migrationStatements.find((statement) =>
        statement.startsWith(`CREATE TABLE "${table}"`),
      );
      expect(createStatement).toContain(
        '"version" integer DEFAULT 1 NOT NULL',
      );
      expect(createStatement).toContain(
        `CONSTRAINT "${table}_version_positive" CHECK ("${table}"."version" >= 1)`,
      );
    }
  });

  it("places migration 0005 directly after the identity-access migration", async () => {
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
    const previous = journal.entries.at(-2);
    const current = journal.entries.at(-1);

    expect(journal).toMatchObject({ version: "7", dialect: "postgresql" });
    expect(previous).toMatchObject({
      idx: 4,
      version: "7",
      tag: "0004_add_identity_access",
      breakpoints: true,
    });
    expect(current).toMatchObject({
      idx: 5,
      version: "7",
      tag: "0005_add_customer_property_crm",
      breakpoints: true,
    });
    expect(current?.idx).toBe((previous?.idx ?? -1) + 1);
    expect(journal.entries.map((entry) => entry.idx)).toEqual(
      journal.entries.map((_, index) => index),
    );
  });
});
