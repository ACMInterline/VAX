import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/client";

vi.mock("server-only", () => ({}));

import {
  assignJobTeamRecord,
  cancelJobRecord,
  completeJobItemTreatmentRecord,
  completeJobRecord,
  confirmJobItemTreatmentPlanRecord,
  createJobFromBookingRecord,
  loadCustomerCleaningPassportRecord,
  loadStaffCleaningPassportRecords,
  recordJobItemInspectionRecord,
  startJobItemTreatmentRecord,
  transitionJobRecord,
} from "./repository";

const dialect = new PgDialect();
const actorId = "10000000-0000-4000-8000-000000000001";
const jobItemId = "20000000-0000-4000-8000-000000000002";
const inspectionId = "30000000-0000-4000-8000-000000000003";
const treatmentPlanId = "40000000-0000-4000-8000-000000000004";
const treatmentExecutionId = "50000000-0000-4000-8000-000000000005";
const propertyId = "60000000-0000-4000-8000-000000000006";
const assetId = "70000000-0000-4000-8000-000000000007";
const bookingReference = "BKG-000000000000000000000001";
const jobReference = "JOB-000000000000000000000001";

function executionDatabase(
  responses: readonly (readonly Record<string, unknown>[])[] = [[]],
) {
  let index = 0;
  const execute = vi.fn(async (query: SQL) => {
    void query;
    const rows = responses[Math.min(index, responses.length - 1)] ?? [];
    index += 1;
    return { rows };
  });
  return { database: { execute } as unknown as Database, execute };
}

function compiled(execute: ReturnType<typeof vi.fn>, call = 0) {
  return dialect.sqlToQuery(execute.mock.calls[call]![0] as SQL);
}

const inspection = {
  jobReference,
  jobItemId,
  expectedJobVersion: 4,
  expectedJobItemVersion: 1,
  observedCleaningItemTypeId: 1,
  observedMeasurement: {
    measurementModeId: 2,
    quantity: 1,
    areaHundredthsM2: 250,
    seatCount: null,
    sides: null,
  },
  observedConditionLevelId: 3,
  confirmedFibreMaterialId: 4,
  confirmedSurfaceConstructionId: 5,
  existingDamageObserved: true,
  existingDamageNotes: "Existing fraying at one edge.",
  colourfastnessConcern: false,
  moistureSensitivity: false,
  unsafeContaminationObserved: false,
  unsafeStructuralConditionObserved: false,
  technicianNotes: "Inspection complete.",
  issues: [{ issueTypeId: 6, technicianNote: "Observed on arrival." }],
  risks: [{ riskFlagId: 7, technicianNote: null }],
};

describe("Phase 3F repository security and provenance boundaries", () => {
  it("creates a Job only from the immutable Booking/issued-Quote snapshot", async () => {
    const fake = executionDatabase([[{
      result: "CREATED",
      jobReference,
      jobStatus: "READY",
      reasonCodes: [],
    }]]);
    await createJobFromBookingRecord(fake.database, actorId, {
      bookingReference,
      expectedBookingVersion: 2,
      jobReference,
    });
    const query = compiled(fake.execute);
    expect(query.sql).toContain("acceptance_source_snapshot");
    expect(query.sql).toContain("source_provenance_valid");
    expect(query.sql).toContain("requestNormalizationPreserved");
    expect(query.sql).toContain("quote_item_count");
    expect(query.sql).toContain("quoteItemCount");
    expect(query.sql).toContain("issuedRequestVersion");
    expect(query.sql).toContain("estimateVersion");
    expect(query.sql).toContain("jsonb_array_elements");
    expect(query.sql).toContain("customerReportedConditionLevelId");
    expect(query.sql).toContain("normalizedSurfaceConstructionId");
    expect(query.sql).toContain("customerRequested");
    expect(query.sql).toContain("staffIncluded");
    expect(query.sql).toContain("select count(*) = count(distinct case");
    expect(query.sql).toMatch(/issueTypeId'\)::integer > 0/);
    expect(query.sql).toMatch(/addonId'\)::integer > 0/);
    expect(query.sql).toContain('from "issue_types" source_issue');
    expect(query.sql).toContain('from "service_addons" source_addon');
    expect(query.sql).toContain("issue.value -> 'customerReported' <> 'true'::jsonb");
    expect(query.sql).toContain("addon.value -> 'staffIncluded' <> 'true'::jsonb");
    expect(query.sql).toContain("length(trim(request_item.value ->> 'customerDescription')) > 0");
    expect(query.sql).toContain('insert into "jobs"');
    expect(query.sql).toContain('insert into "job_items"');
    expect(query.sql).toContain("for update of booking, acceptance, quote_record");
    expect(query.sql).not.toContain('from "service_requests"');
    expect(query.sql).not.toContain('from "request_estimates"');
    expect(query.sql).not.toMatch(/\b(?:normalize|reprice|calculate)\s*\(/i);
    expect(query.sql).not.toMatch(/update\s+"?(?:bookings|quotes|service_requests)"?/i);
  });

  it("assigns only an exact current confirmed occupancy and locks versions", async () => {
    const fake = executionDatabase([[{
      result: "CHANGED", jobReference, version: 5,
    }]]);
    await assignJobTeamRecord(fake.database, actorId, {
      jobReference,
      operationsTeamId: 1,
      expectedJobVersion: 4,
    });
    const query = compiled(fake.execute);
    expect(query.params).toEqual(expect.arrayContaining([
      "FIELD_JOBS_READ", "OPERATIONS_MANAGE", "SCHEDULE_MANAGE",
    ]));
    expect(query.sql).toContain("occupancy.status = 'CONFIRMED'");
    expect(query.sql).toContain("target.scheduled_start = occupancy.service_start");
    expect(query.sql).toContain("target.version <>");
    expect(query.sql).toContain("for update of job, booking");
  });

  it("uses server-owned timestamps and exact active team scope for transitions", async () => {
    const fake = executionDatabase([[{
      result: "CHANGED", jobReference, version: 6,
    }]]);
    await transitionJobRecord(fake.database, actorId, {
      jobReference,
      expectedJobVersion: 5,
    }, "ARRIVED");
    const query = compiled(fake.execute);
    expect(query.params).toContain("FIELD_JOBS_UPDATE");
    expect(query.sql).toContain("scoped_role.code = 'TECHNICIAN'");
    expect(query.sql).toContain('from "team_memberships" scoped_membership');
    expect(query.sql).toContain("scoped_membership.valid_from <= now()");
    expect(query.sql).toContain(
      "scoped_membership.team_id = job.assigned_team_id",
    );
    expect(query.sql).toContain("arrived_at = case");
    expect(query.sql).not.toContain("clientTimestamp");
  });

  it("records planned and observed facts separately and computes safety in SQL", async () => {
    const fake = executionDatabase([[{
      result: "CHANGED",
      jobReference,
      jobVersion: 5,
      jobItemVersion: 2,
      reasonCodes: [],
    }]]);
    await recordJobItemInspectionRecord(fake.database, actorId, inspection);
    const query = compiled(fake.execute);
    expect(query.sql).toContain('insert into "job_item_inspections"');
    expect(query.sql).toContain('insert into "job_item_inspection_issues"');
    expect(query.sql).toContain('insert into "job_item_inspection_risks"');
    expect(query.sql).toContain("CLEANING_ITEM_TYPE_CHANGED");
    expect(query.sql).toContain("MEASUREMENT_CHANGED");
    expect(query.sql).toContain("CONDITION_LEVEL_CHANGED");
    expect(query.sql).toContain("FIBRE_MATERIAL_CHANGED");
    expect(query.sql).toContain("SURFACE_CONSTRUCTION_CHANGED");
    expect(query.sql).toContain("planned_condition_level_id");
    expect(query.sql).toContain("planned_fibre_material_id");
    expect(query.sql).toContain("planned_surface_construction_id");
    expect(query.sql).toMatch(
      /planned_condition_level_id is distinct from\s+\$\d+/,
    );
    expect(query.sql).toMatch(
      /planned_fibre_material_id is distinct from\s+\$\d+/,
    );
    expect(query.sql).toMatch(
      /planned_surface_construction_id is distinct from\s+\$\d+/,
    );
    expect(query.sql).toContain("UNSAFE_CONTAMINATION");
    expect(query.sql).toContain("SPECIALIST_ONLY");
    expect(query.sql).toContain("for update of job, item");
    expect(query.sql).not.toMatch(/update\s+"?(?:booking_items|service_request_items)"?/i);
  });

  it("allows only canonical, issued-scope add-ons in a treatment plan", async () => {
    const fake = executionDatabase([[{
      result: "CHANGED", jobReference, jobVersion: 6, jobItemVersion: 3,
    }]]);
    await confirmJobItemTreatmentPlanRecord(fake.database, actorId, {
      jobReference,
      jobItemId,
      expectedJobVersion: 5,
      expectedJobItemVersion: 2,
      sourceInspectionId: inspectionId,
      decision: "PERFORM",
      treatmentLevelId: 1,
      mechanicalActionLevelId: 2,
      treatmentApproachId: 3,
      addonIds: [4],
      cleaningProductId: null,
      technicianRationale: "Confirmed after inspection.",
    });
    const query = compiled(fake.execute);
    expect(query.sql).toContain("staffIncluded");
    expect(query.sql).toContain('insert into "job_item_treatment_plans"');
    expect(query.sql).toContain('insert into "job_item_treatment_plan_addons"');
    expect(query.sql).toContain("MATERIAL_SCOPE_CHANGE");
    expect(query.sql).toContain("planned_condition_level_id");
    expect(query.sql).toContain("planned_fibre_material_id");
    expect(query.sql).toContain("planned_surface_construction_id");
    expect(query.sql).toContain("confirmed_surface_construction_id");
    expect(query.sql).toMatch(
      /planned_fibre_material_id is distinct from\s+target\.confirmed_fibre_material_id/,
    );
    expect(query.sql).toMatch(
      /planned_surface_construction_id is distinct from\s+target\.confirmed_surface_construction_id/,
    );
    expect(query.sql).toContain("TREATMENT_CAPABILITY_REQUIRES_REVIEW");
    expect(query.sql).not.toMatch(/(?:price|amount|total)_minor_units\s*=/i);
  });

  it("freshly revalidates every operational resource before executable mutations", async () => {
    const inputs = [
      async () => {
        const fake = executionDatabase();
        await transitionJobRecord(fake.database, actorId, {
          jobReference,
          expectedJobVersion: 5,
        }, "ARRIVED");
        return compiled(fake.execute);
      },
      async () => {
        const fake = executionDatabase();
        await recordJobItemInspectionRecord(fake.database, actorId, inspection);
        return compiled(fake.execute);
      },
      async () => {
        const fake = executionDatabase();
        await confirmJobItemTreatmentPlanRecord(fake.database, actorId, {
          jobReference,
          jobItemId,
          expectedJobVersion: 5,
          expectedJobItemVersion: 2,
          sourceInspectionId: inspectionId,
          decision: "PERFORM",
          treatmentLevelId: 1,
          mechanicalActionLevelId: 2,
          treatmentApproachId: 3,
          addonIds: [4],
          cleaningProductId: null,
          technicianRationale: "Confirmed after inspection.",
        });
        return compiled(fake.execute);
      },
      async () => {
        const fake = executionDatabase();
        await startJobItemTreatmentRecord(fake.database, actorId, {
          jobReference,
          jobItemId,
          expectedJobVersion: 6,
          expectedJobItemVersion: 3,
          treatmentPlanId,
        });
        return compiled(fake.execute);
      },
      async () => {
        const fake = executionDatabase();
        await completeJobItemTreatmentRecord(fake.database, actorId, {
          jobReference,
          jobItemId,
          expectedJobVersion: 7,
          expectedJobItemVersion: 4,
          treatmentExecutionId,
          expectedTreatmentExecutionVersion: 1,
          performedTreatmentLevelId: 1,
          performedMechanicalActionLevelId: 2,
          performedTreatmentApproachId: 3,
          performedAddonIds: [4],
          cleaningProductId: null,
          technicianNotes: "Completed.",
          resultClassification: "COMPLETED_AS_PLANNED",
        });
        return compiled(fake.execute);
      },
      async () => {
        const fake = executionDatabase();
        await completeJobRecord(fake.database, actorId, {
          jobReference,
          expectedJobVersion: 8,
          internalCompletionNotes: "All items resolved and handed over.",
          customerVisibleCompletionNotes: "Service completed.",
          customerVisibleCareNotes: "Allow the surface to dry before normal use.",
          maintenanceRecommendations: [],
        });
        return compiled(fake.execute);
      },
    ];

    for (const compileMutation of inputs) {
      const query = await compileMutation();
      expect(query.sql).toContain("operational_resource_reason_codes");
      expect(query.sql).toContain('from "booking_occupancies" current_occupancy');
      expect(query.sql).toContain("current_occupancy.status = 'CONFIRMED'");
      expect(query.sql).toContain("current_occupancy.snapshot_version");
      expect(query.sql).toContain("current_occupancy.service_start");
      expect(query.sql).toContain("current_occupancy.service_end");
      expect(query.sql).toContain("current_booking.status = 'CONFIRMED'");
      expect(query.sql).toContain("current_booking.scheduling_status = 'SCHEDULED'");
      expect(query.sql).toContain("current_booking.assigned_team_id");
      expect(query.sql).toContain("current_booking.scheduled_start");
      expect(query.sql).toContain("current_booking.scheduled_end");
      expect(query.sql).toContain('from "operations_teams" current_team');
      expect(query.sql).toContain("current_team.active = true");
      expect(query.sql).toContain('from "team_capabilities" current_capability');
      expect(query.sql).toContain("current_capability.active = true");
      expect(query.sql).toContain('from "equipment_resources" current_equipment');
      expect(query.sql).toContain("current_equipment.status = 'ACTIVE'");
      expect(query.sql).toContain('"team_equipment_assignments" current_assignment');
      expect(query.sql).toContain("current_assignment.effective_from <= now()");
      expect(query.sql).toContain("current_assignment.effective_until > now()");
      expect(query.sql).toContain('from "team_memberships" scoped_membership');
      expect(query.sql).toContain("scoped_membership.valid_from <= now()");
      expect(query.sql).toContain("CONFIRMED_OCCUPANCY_INCONSISTENT");
      expect(query.sql).toContain("TEAM_INACTIVE");
      expect(query.sql).toContain("TEAM_CAPABILITY_REVOKED");
      expect(query.sql).toContain("EQUIPMENT_UNAVAILABLE");
      expect(query.sql).toContain("ACTOR_ASSIGNMENT_REVOKED");
      expect(query.sql).toContain("then 'REQUIRES_REVIEW'");
    }
  });

  it("returns only safe operational reason codes when resources were revoked", async () => {
    const fake = executionDatabase([[
      {
        result: "REQUIRES_REVIEW",
        jobReference,
        version: 5,
        reasonCodes: ["TEAM_CAPABILITY_REVOKED"],
      },
    ]]);
    const result = await transitionJobRecord(fake.database, actorId, {
      jobReference,
      expectedJobVersion: 4,
    }, "EN_ROUTE");
    expect(result).toEqual({
      status: "REQUIRES_REVIEW",
      reasonCodes: ["TEAM_CAPABILITY_REVOKED"],
    });
  });

  it("starts the immutable plan once and copies rather than reinterprets it", async () => {
    const fake = executionDatabase([[{
      result: "CHANGED", jobReference, jobVersion: 7, jobItemVersion: 4,
    }]]);
    await startJobItemTreatmentRecord(fake.database, actorId, {
      jobReference,
      jobItemId,
      expectedJobVersion: 6,
      expectedJobItemVersion: 3,
      treatmentPlanId,
    });
    const query = compiled(fake.execute);
    expect(query.sql).toContain("target.existing_execution_id is not null");
    expect(query.sql).toContain('insert into "job_item_treatment_executions"');
    expect(query.sql).toContain("target.treatment_level_id");
    expect(query.sql).toContain("'TREATMENT_STARTED'");
  });

  it("retains performed deviations and fails closed to review", async () => {
    const fake = executionDatabase([[{
      result: "CHANGED", jobReference, jobVersion: 8, jobItemVersion: 5,
    }]]);
    await completeJobItemTreatmentRecord(fake.database, actorId, {
      jobReference,
      jobItemId,
      expectedJobVersion: 7,
      expectedJobItemVersion: 4,
      treatmentExecutionId,
      expectedTreatmentExecutionVersion: 1,
      performedTreatmentLevelId: 1,
      performedMechanicalActionLevelId: 2,
      performedTreatmentApproachId: 3,
      performedAddonIds: [4],
      cleaningProductId: null,
      technicianNotes: "Completed.",
      resultClassification: "COMPLETED_AS_PLANNED",
    });
    const query = compiled(fake.execute);
    for (const reason of [
      "TREATMENT_LEVEL_CHANGED", "MECHANICAL_ACTION_CHANGED",
      "TREATMENT_APPROACH_CHANGED", "ADDONS_CHANGED", "PRODUCT_CHANGED",
      "STOPPED_FOR_SAFETY",
    ]) expect(query.sql).toContain(reason);
    expect(query.sql).toContain("then 'REQUIRES_REVIEW'");
    expect(query.sql).toContain("completed_at = now()");
    expect(query.sql).toMatch(
      /when conformance\.execution_status = 'COMPLETED'[\s\S]*and conformance\.execution_id = \$\d+::uuid/,
    );
    expect(query.sql).toContain(
      "existing_internal_technician_notes is not distinct from",
    );
    expect(query.sql).toContain("when conformance.execution_status = 'COMPLETED' then 'CONFLICT'");
  });

  it("completes and appends passports in one locked statement without upsert", async () => {
    const fake = executionDatabase([[{
      result: "CHANGED", jobReference, version: 9, reasonCodes: [],
    }]]);
    await completeJobRecord(fake.database, actorId, {
      jobReference,
      expectedJobVersion: 8,
      internalCompletionNotes: "All items resolved and handed over.",
      customerVisibleCompletionNotes: "Service completed.",
      customerVisibleCareNotes: "Allow the surface to dry before normal use.",
      maintenanceRecommendations: [],
    });
    const query = compiled(fake.execute);
    expect(query.sql).toContain("for update of job");
    expect(query.sql).toContain("for update of item");
    expect(query.sql).toContain("ITEM_UNRESOLVED");
    expect(query.sql).toContain("TREATMENT_EXECUTION_INCOMPLETE");
    expect(query.sql).toContain('insert into "cleaning_passport_entries"');
    expect(query.sql).toContain("execution.completed_at as execution_completed_at");
    expect(query.sql).toContain("source_execution_status, completed_at");
    expect(query.sql).toContain("item.execution_id, 'COMPLETED', item.execution_completed_at");
    expect(query.sql).toContain("existing_recommendations");
    expect(query.sql).toContain("readiness.internal_completion_notes =");
    expect(query.sql).toContain("customerVisibleCareNotes");
    expect(query.sql).toContain("then 'NO_CHANGE'");
    expect(query.sql).toContain("when readiness.status = 'COMPLETED' then 'CONFLICT'");
    expect(query.sql).toContain("item.cleaning_asset_id is not null");
    expect(query.sql).toContain("item.result_classification in");
    expect(query.sql).not.toContain("STOPPED_FOR_SAFETY',\n          '");
    expect(query.sql).not.toContain("on conflict");
    expect(query.sql).toContain("extract(epoch from (now() - job.started_at))");
    expect(query.sql).toContain("'PASSPORT_ENTRY_CREATED'");
  });

  it("keeps customer passport SQL whitelist-only and exact-owner scoped", async () => {
    const fake = executionDatabase([
      [{ assetLabel: "Synthetic asset", locale: "en" }],
      [{
        jobReference,
        completedAt: new Date("2026-08-25T12:00:00Z"),
        serviceDescription: "Service",
        observedConditionSummary: "Condition",
        treatmentSummary: "Treatment",
        resultClassification: "COMPLETED_AS_PLANNED",
        careRecommendation: null,
        maintenanceRecommendationValue: null,
      }],
    ]);
    await loadCustomerCleaningPassportRecord(fake.database, actorId, {
      propertyId, assetId,
    });
    const header = compiled(fake.execute, 0);
    const history = compiled(fake.execute, 1);
    expect(header.params).toContain("OWN_CUSTOMER_DATA_READ");
    expect(header.sql).toContain("exact_link.active = true");
    expect(history.sql).toContain("customer_safe_snapshot");
    expect(history.sql).not.toContain("internal_technician_notes");
    expect(history.sql).not.toContain("issues_treated_snapshot");
    expect(history.sql).not.toContain("risks_noted_snapshot");
  });

  it("keeps staff asset history behind the full staff permission conjunction", async () => {
    const fake = executionDatabase([[{ assetLabel: "Synthetic asset" }], []]);
    await loadStaffCleaningPassportRecords(fake.database, actorId, {
      propertyId, assetId,
    });
    const header = compiled(fake.execute, 0);
    const history = compiled(fake.execute, 1);
    expect(header.params).toEqual(expect.arrayContaining([
      "CUSTOMER_RECORDS_READ", "OPERATIONS_READ", "FIELD_JOBS_READ",
    ]));
    expect(history.sql).toContain("internal_technician_notes");
    expect(history.sql).toContain("issues_treated_snapshot");
    expect(history.sql).toContain("risks_noted_snapshot");
  });

  it("cancels only pre-work Jobs and preserves an audit record", async () => {
    const fake = executionDatabase([[{
      result: "CHANGED", jobReference, version: 2,
    }]]);
    await cancelJobRecord(fake.database, actorId, {
      jobReference,
      expectedJobVersion: 1,
      reasonCategory: "OPERATIONAL",
      reasonText: "Synthetic cancellation.",
    });
    const query = compiled(fake.execute);
    expect(query.sql).toContain("target.status not in ('PREPARED', 'READY')");
    expect(query.sql).toContain("target.cancellation_reason_category =");
    expect(query.sql).toContain("target.cancellation_reason_text is not distinct from");
    expect(query.sql).toContain("when target.status = 'CANCELLED' then 'CONFLICT'");
    expect(query.sql).toContain("cancelled_at = now()");
    expect(query.sql).toContain("'JOB_CANCELLED'");
  });
});
