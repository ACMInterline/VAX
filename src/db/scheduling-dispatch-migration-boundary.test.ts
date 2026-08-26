import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationPath = path.join(
  root,
  "drizzle/0009_phase_3g_scheduling_dispatch.sql",
);
const journalPath = path.join(root, "drizzle/meta/_journal.json");

const protectedMigrationChecksums = new Map([
  ["0001_add_service_catalogue.sql", "82c358c2cd23ead4e2e88aff76419045e7fd5d31523e1bddd17b963c5237cc53"],
  ["0002_add_commercial_engine.sql", "57a638063cf4bcc870af51c21e477a5d4c3ffe73172fe1604dec0e7908c8832b"],
  ["0003_add_availability_capacity.sql", "9a7bdace95a77714d5a7050272b76ee2c60b1f10a1cf1b11cb34c04e04c45a84"],
  ["0004_add_identity_access.sql", "d5a2aeaa86e719759d5c7c10f65758b348eebcefbd7486f2cdca7bc7a329795c"],
  ["0005_add_customer_property_crm.sql", "36a13247e4a5475db3917dcbcf6d7092a5373c98e935af07dc9fb4e894d6fb8c"],
  ["0006_phase_3d_request_quote.sql", "4a1e002b5a1896629041328ca4c00e434232023afdefd11cf73b473e462cbf6e"],
  ["0007_phase_3e_booking_engine.sql", "c412a89227c7a54f0e7d812797a78d74ac7d65a370951d9f6a42fd77414fc6c2"],
  ["0008_phase_3f_job_execution.sql", "1e2de59c546b9f52f430b71a04d0461528a05d8ffea2e33bd1332e668b4bc9f9"],
]);

function statements(migration: string): string[] {
  return migration
    .split(/-->\s*statement-breakpoint/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

describe("Phase 3G scheduling and dispatch migration boundary", () => {
  it("changes only the existing occupancy and booking-audit ledgers", async () => {
    const migration = await readFile(migrationPath, "utf8");
    expect(migration).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(migration).not.toMatch(/\bDROP\s+(?:TABLE|COLUMN|INDEX|SCHEMA)\b/i);
    expect(migration).not.toMatch(/\b(?:TRUNCATE|DELETE|UPDATE|INSERT)\b/i);
    expect(migration).not.toMatch(/neon_auth/i);
    expect(migration).not.toMatch(/\bCASCADE\b/i);

    const alteredTables = [
      ...migration.matchAll(/ALTER TABLE "([^"]+)"/g),
    ].map((match) => match[1]);
    expect(new Set(alteredTables)).toEqual(
      new Set(["booking_audit_events", "booking_occupancies"]),
    );
  });

  it("allows only the exact audit allowlist replacement", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const destructive = statements(migration).filter((statement) =>
      /\bDROP\b/i.test(statement),
    );
    expect(destructive).toEqual([
      'ALTER TABLE "booking_audit_events" DROP CONSTRAINT "booking_audit_events_type_valid";',
    ]);
    expect(migration).toContain("'BOOKING_SCHEDULED'");
    expect(migration).toContain("'BOOKING_RESCHEDULED'");
    expect(migration).toContain("'TEAM_ASSIGNED'");
    expect(migration).toContain("'EQUIPMENT_ASSIGNED'");
    expect(migration).toContain("'SCHEDULE_REVIEW_REQUIRED'");
    expect(migration).toContain("'OCCUPANCY_RELEASED'");
  });

  it("adds only immutable occupancy-revision provenance", async () => {
    const migration = await readFile(migrationPath, "utf8");
    const addedColumns = [
      ...migration.matchAll(/ADD COLUMN "([^"]+)"/g),
    ].map((match) => match[1]);
    expect(addedColumns).toEqual([
      "revision_kind",
      "revision_reason_category",
      "revision_note",
    ]);
    expect(migration).toContain(
      'ADD COLUMN "revision_kind" varchar(16) DEFAULT \'INITIAL\' NOT NULL',
    );
    expect(migration).toContain("booking_occupancies_revision_consistent");
    expect(migration).toContain("booking_occupancies_revision_note_valid");
    expect(migration).toContain(
      "booking_occupancies_other_revision_note_required",
    );
  });

  it("preserves every completed migration byte-for-byte", async () => {
    for (const [fileName, expectedChecksum] of protectedMigrationChecksums) {
      const contents = await readFile(path.join(root, "drizzle", fileName));
      const checksum = createHash("sha256").update(contents).digest("hex");
      expect(checksum, fileName).toBe(expectedChecksum);
    }
  });

  it("places migration 0009 directly after Phase 3F", async () => {
    const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
      version: string;
      dialect: string;
      entries: Array<{
        idx: number;
        tag: string;
        breakpoints: boolean;
      }>;
    };
    expect(journal).toMatchObject({ version: "7", dialect: "postgresql" });
    expect(journal.entries.at(-2)).toMatchObject({
      idx: 8,
      tag: "0008_phase_3f_job_execution",
      breakpoints: true,
    });
    expect(journal.entries.at(-1)).toMatchObject({
      idx: 9,
      tag: "0009_phase_3g_scheduling_dispatch",
      breakpoints: true,
    });
  });
});
