import { getTableName } from "drizzle-orm";
import { getTableConfig, type AnyPgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { jobs as exportedJobs } from "../schema";
import { bookingItems, bookingOccupancies, bookings } from "./booking-engine";
import { cleaningAssets } from "./customer-crm";
import {
  cleaningPassportEntries,
  jobAuditEvents,
  jobItemInspectionIssues,
  jobItemInspectionRisks,
  jobItemInspections,
  jobItems,
  jobItemTreatmentExecutions,
  jobItemTreatmentPlanAddons,
  jobItemTreatmentPlans,
  jobs,
  teamMemberships,
} from "./job-execution";

const jobExecutionTables = [
  teamMemberships,
  jobs,
  jobItems,
  jobItemInspections,
  jobItemInspectionIssues,
  jobItemInspectionRisks,
  jobItemTreatmentPlans,
  jobItemTreatmentPlanAddons,
  jobItemTreatmentExecutions,
  cleaningPassportEntries,
  jobAuditEvents,
] as const;

function indexNames(table: AnyPgTable) {
  return getTableConfig(table).indexes.map((index) => index.config.name);
}

describe("job execution schema contract", () => {
  it("exports the focused Phase 3F tables without enabling browser-facing RLS", () => {
    expect(jobExecutionTables.map(getTableName)).toEqual([
      "team_memberships",
      "jobs",
      "job_items",
      "job_item_inspections",
      "job_item_inspection_issues",
      "job_item_inspection_risks",
      "job_item_treatment_plans",
      "job_item_treatment_plan_addons",
      "job_item_treatment_executions",
      "cleaning_passport_entries",
      "job_audit_events",
    ]);
    expect(exportedJobs).toBe(jobs);
    expect(
      jobExecutionTables.every((table) => !getTableConfig(table).enableRLS),
    ).toBe(true);
  });

  it("adds parent uniqueness only where composite provenance requires it", () => {
    expect(indexNames(bookings)).toContain(
      "bookings_id_customer_property_unique",
    );
    expect(indexNames(bookingItems)).toContain(
      "booking_items_id_booking_unique",
    );
    expect(indexNames(bookingOccupancies)).toContain(
      "booking_occupancies_id_booking_version_team_unique",
    );
    expect(indexNames(cleaningAssets)).toContain(
      "cleaning_assets_id_property_unique",
    );
  });

  it("binds booking, occupancy, booking-item, asset and child records to one provenance scope", () => {
    const expectedCompositeForeignKeys = [
      [jobs, "jobs_booking_provenance_fk", ["booking_id", "customer_id", "property_id"]],
      [
        jobs,
        "jobs_booking_occupancy_provenance_fk",
        [
          "source_occupancy_id",
          "booking_id",
          "source_occupancy_snapshot_version",
          "assigned_team_id",
        ],
      ],
      [jobItems, "job_items_job_provenance_fk", ["job_id", "booking_id", "property_id"]],
      [jobItems, "job_items_booking_item_provenance_fk", ["booking_item_id", "booking_id"]],
      [jobItems, "job_items_cleaning_asset_property_fk", ["cleaning_asset_id", "property_id"]],
      [jobItemInspections, "job_item_inspections_item_scope_fk", ["job_item_id", "job_id"]],
      [jobItemTreatmentPlans, "job_item_treatment_plans_inspection_scope_fk", ["inspection_id", "job_item_id", "job_id"]],
      [jobItemTreatmentExecutions, "job_item_treatment_executions_plan_scope_fk", ["treatment_plan_id", "job_item_id", "job_id"]],
      [cleaningPassportEntries, "cleaning_passport_entries_item_asset_scope_fk", ["job_item_id", "job_id", "cleaning_asset_id"]],
      [
        cleaningPassportEntries,
        "cleaning_passport_entries_execution_scope_fk",
        [
          "treatment_execution_id",
          "job_item_id",
          "job_id",
          "source_execution_status",
          "completed_at",
          "result_classification",
          "treatment_level_id",
          "mechanical_action_level_id",
          "treatment_approach_id",
        ],
      ],
    ] as const;

    for (const [table, name, columnNames] of expectedCompositeForeignKeys) {
      const foreignKey = getTableConfig(table).foreignKeys.find(
        (candidate) => candidate.getName() === name,
      );
      expect(foreignKey, name).toBeDefined();
      expect(
        foreignKey?.reference().columns.map((column) => column.name),
        name,
      ).toEqual(columnNames);
      expect(foreignKey?.onDelete, name).toBe("restrict");
    }
  });

  it("never cascades operational history and only nulls staff attribution", () => {
    const foreignKeys = jobExecutionTables.flatMap(
      (table) => getTableConfig(table).foreignKeys,
    );

    expect(foreignKeys.length).toBeGreaterThan(0);
    expect(
      foreignKeys.some((foreignKey) => foreignKey.onDelete === "cascade"),
    ).toBe(false);
    expect(
      foreignKeys.every(
        (foreignKey) =>
          foreignKey.onDelete === "restrict" ||
          foreignKey.onDelete === "set null",
      ),
    ).toBe(true);

    for (const foreignKey of foreignKeys.filter(
      (candidate) => candidate.onDelete === "set null",
    )) {
      expect(getTableName(foreignKey.reference().foreignTable)).toBe(
        "user_profiles",
      );
      expect(
        foreignKey.reference().columns.every((column) =>
          column.name.endsWith("_profile_id"),
        ),
      ).toBe(true);
    }
  });

  it("keeps planned scope and observed inspection facts in separate typed columns", () => {
    expect(jobItems.measurementModeId.notNull).toBe(true);
    expect(jobItems.quantity.notNull).toBe(true);
    expect(jobItems.areaHundredthsM2.notNull).toBe(false);
    expect(jobItems.seatCount.notNull).toBe(false);
    expect(jobItems.sides.notNull).toBe(false);

    expect(jobItemInspections.observedMeasurementModeId.notNull).toBe(true);
    expect(jobItemInspections.observedQuantity.notNull).toBe(true);
    expect(jobItemInspections.observedAreaHundredthsM2.notNull).toBe(false);
    expect(jobItemInspections.observedSeatCount.notNull).toBe(false);
    expect(jobItemInspections.observedSides.notNull).toBe(false);
    expect(jobItemInspections.observedMeasurementSnapshot.notNull).toBe(true);

    expect(
      getTableConfig(jobItemInspections).checks.map((constraint) =>
        constraint.name,
      ),
    ).toEqual(
      expect.arrayContaining([
        "job_item_inspections_measurements_valid",
        "job_item_inspections_damage_consistent",
        "job_item_inspections_feasibility_valid",
      ]),
    );
  });

  it("models controlled lifecycle and optimistic mutable records", () => {
    expect(jobs.version.notNull).toBe(true);
    expect(jobItems.version.notNull).toBe(true);
    expect(jobItemTreatmentExecutions.version.notNull).toBe(true);
    expect(teamMemberships.version.notNull).toBe(true);

    const checkNames = jobExecutionTables.flatMap((table) =>
      getTableConfig(table).checks.map((constraint) => constraint.name),
    );
    expect(checkNames).toEqual(
      expect.arrayContaining([
        "team_memberships_window_valid",
        "jobs_status_valid",
        "jobs_status_timestamps_consistent",
        "jobs_completion_consistent",
        "jobs_cancellation_consistent",
        "job_items_status_valid",
        "job_item_treatment_plans_decision_valid",
        "job_item_treatment_plans_material_change_review",
        "job_item_treatment_executions_status_valid",
        "job_item_treatment_executions_completion_consistent",
      ]),
    );
  });

  it("keeps inspections, plans, passport entries and audit events append-oriented", () => {
    for (const table of [
      jobItemInspections,
      jobItemInspectionIssues,
      jobItemInspectionRisks,
      jobItemTreatmentPlans,
      jobItemTreatmentPlanAddons,
      cleaningPassportEntries,
      jobAuditEvents,
    ] as const) {
      expect("updatedAt" in table, getTableName(table)).toBe(false);
    }

    expect(indexNames(jobItemInspections)).toContain(
      "job_item_inspections_item_unique",
    );
    expect(indexNames(jobItemTreatmentPlans)).toContain(
      "job_item_treatment_plans_item_unique",
    );
    expect(indexNames(cleaningPassportEntries)).toEqual(
      expect.arrayContaining([
        "cleaning_passport_entries_job_item_unique",
        "cleaning_passport_entries_execution_unique",
      ]),
    );
    expect(indexNames(jobAuditEvents)).toContain(
      "job_audit_events_correlation_unique",
    );
  });

  it("keeps products optional and contains no commercial amount columns", () => {
    expect(jobItemTreatmentPlans.cleaningProductId.notNull).toBe(false);
    expect(jobItemTreatmentExecutions.cleaningProductId.notNull).toBe(false);

    const operationalColumnNames = jobExecutionTables.flatMap((table) =>
      getTableConfig(table).columns.map((column) => column.name),
    );
    expect(
      operationalColumnNames.filter((name) =>
        /(?:amount|currency|margin|price|revenue|vat|cost)/i.test(name),
      ),
    ).toEqual([]);
  });

  it("separates customer-safe passport content from internal execution notes", () => {
    const passportColumns = getTableConfig(cleaningPassportEntries).columns.map(
      (column) => column.name,
    );
    expect(passportColumns).toEqual(
      expect.arrayContaining([
        "customer_visible_service_summary",
        "customer_visible_condition_summary",
        "customer_visible_treatment_summary",
        "customer_visible_care_recommendation",
        "customer_safe_snapshot",
      ]),
    );
    expect(passportColumns.some((name) => /internal|technician_notes/.test(name)))
      .toBe(false);
    expect("updatedAt" in cleaningPassportEntries).toBe(false);
  });

  it("binds Passport history to the exact successful completed execution facts", () => {
    expect(cleaningPassportEntries.sourceExecutionStatus.notNull).toBe(true);
    expect(indexNames(jobItemTreatmentExecutions)).toContain(
      "job_item_treatment_executions_passport_provenance_unique",
    );

    const executionForeignKey = getTableConfig(
      cleaningPassportEntries,
    ).foreignKeys.find(
      (candidate) =>
        candidate.getName() ===
        "cleaning_passport_entries_execution_scope_fk",
    );
    expect(
      executionForeignKey?.reference().columns.map((column) => column.name),
    ).toEqual([
      "treatment_execution_id",
      "job_item_id",
      "job_id",
      "source_execution_status",
      "completed_at",
      "result_classification",
      "treatment_level_id",
      "mechanical_action_level_id",
      "treatment_approach_id",
    ]);
    expect(
      executionForeignKey?.reference().foreignColumns.map(
        (column) => column.name,
      ),
    ).toEqual([
      "id",
      "job_item_id",
      "job_id",
      "status",
      "completed_at",
      "result_classification",
      "performed_treatment_level_id",
      "performed_mechanical_action_level_id",
      "performed_treatment_approach_id",
    ]);
    expect(
      getTableConfig(cleaningPassportEntries).checks.map(
        (constraint) => constraint.name,
      ),
    ).toEqual(
      expect.arrayContaining([
        "cleaning_passport_entries_source_execution_completed",
        "cleaning_passport_entries_result_valid",
      ]),
    );
  });

  it("uses one safe job reference and one job per booking", () => {
    expect(indexNames(jobs)).toEqual(
      expect.arrayContaining(["jobs_reference_unique", "jobs_booking_unique"]),
    );
    expect(
      getTableConfig(jobs).checks.map((constraint) => constraint.name),
    ).toContain("jobs_reference_valid");
    expect(jobs.jobReference.getSQLType()).toBe("varchar(40)");
  });
});
