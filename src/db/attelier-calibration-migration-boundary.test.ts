import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationName = "0017_attelier_staging_calibration.sql";
const frozenPhase3nSha256 =
  "b68fd05476b5d32567f2f8838df4943e2a2beaa5db28ae9098b6aeb719ccb244";
const appliedAttelierCalibrationSha256 =
  "bae8003f894522ec2af46a589a664bd2a40e66b7233e716c0187375fdcd1a4b9";

describe("ATTELIER calibration migration boundary", () => {
  it("preserves the frozen Phase 3N migration byte-for-byte", async () => {
    const bytes = await readFile(
      path.join(root, "drizzle/0016_phase_3n_business_authority.sql"),
    );
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      frozenPhase3nSha256,
    );
  });

  it("preserves the applied ATTELIER calibration migration byte-for-byte", async () => {
    const bytes = await readFile(path.join(root, "drizzle", migrationName));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      appliedAttelierCalibrationSha256,
    );
  });

  it("is an additive, migrator-only commercial representation change", async () => {
    const contents = await readFile(path.join(root, "drizzle", migrationName), "utf8");

    expect(contents).toContain("ATTELIER staging calibration migration requires vax_migrator");
    expect(contents).toContain('ALTER TABLE "price_rules" ADD COLUMN "additional_side_percentage_basis_points"');
    expect(contents).toContain('ALTER TABLE "duration_rules" ADD COLUMN "additional_side_percentage_basis_points"');
    expect(contents).toContain("VAT_UNRESOLVED");
    expect(contents).toContain("price_books_vat_resolution_consistent");
    expect(contents).toContain("request_estimates_amount_group_consistent");
    expect(contents).toContain('"manual_assessment_required" = true');
    expect(contents).toContain('"status" = \'REVIEW_REQUIRED\'');
    expect(contents).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO|FROM)?\s*public\./i);
    expect(contents).not.toMatch(/\b(?:DROP TABLE|TRUNCATE|CREATE ROLE|DROP ROLE)\b/i);
    expect(contents).not.toMatch(/neon_auth\s*\./i);
    expect(contents).not.toMatch(/\bproduction\b/i);
  });

  it("retains the 100-table model and extends only the ordered migration ledger", async () => {
    const snapshot = JSON.parse(
      await readFile(path.join(root, "drizzle/meta/0018_snapshot.json"), "utf8"),
    ) as { tables: Record<string, unknown> };
    const journal = JSON.parse(
      await readFile(path.join(root, "drizzle/meta/_journal.json"), "utf8"),
    ) as { entries: Array<{ idx: number; tag: string }> };

    expect(Object.keys(snapshot.tables)).toHaveLength(100);
    expect(journal.entries).toHaveLength(19);
    expect(journal.entries.at(-1)).toMatchObject({
      idx: 18,
      tag: "0018_attelier_estimate_amount_compatibility",
    });
  });

  it("repairs only the estimate check without changing data, grants or prior snapshots", async () => {
    const contents = await readFile(
      path.join(root, "drizzle/0018_attelier_estimate_amount_compatibility.sql"),
      "utf8",
    );
    expect(contents).toContain("ATTELIER estimate compatibility migration requires vax_migrator");
    expect(contents.match(/ALTER TABLE/g)).toHaveLength(2);
    expect(contents).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE|CREATE TABLE|DROP TABLE)\b/i);
    expect(contents).not.toMatch(/neon_auth\s*\./i);
    const [before, after] = await Promise.all(
      ["0017", "0018"].map(async (version) => JSON.parse(await readFile(
        path.join(root, `drizzle/meta/${version}_snapshot.json`),
        "utf8",
      ))),
    );
    expect(after.prevId).toBe(before.id);
    const checkName = "request_estimates_amount_group_consistent";
    delete before.tables["public.request_estimates"].checkConstraints[checkName];
    delete after.tables["public.request_estimates"].checkConstraints[checkName];
    expect(after.tables).toEqual(before.tables);
  });
});
