import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function source(): Promise<string> {
  return readFile(
    path.join(
      process.cwd(),
      "src/modules/scheduling-dispatch/repository.ts",
    ),
    "utf8",
  );
}

async function typesSource(): Promise<string> {
  return readFile(
    path.join(process.cwd(), "src/modules/scheduling-dispatch/types.ts"),
    "utf8",
  );
}

function confirmationBoundary(repository: string): string {
  const start = repository.indexOf(
    "export async function confirmBookingScheduleRecord",
  );
  const end = repository.indexOf(
    "export function createDatabaseSchedulingDispatchRepository",
  );
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return repository.slice(start, end);
}

describe("Phase 3G repository security and provenance boundary", () => {
  it("re-authorizes the complete manage conjunction inside the mutation query", async () => {
    const repository = await source();
    const manage = repository.slice(
      repository.indexOf("function staffManageSql"),
      repository.indexOf("function object"),
    );
    expect(manage).toContain('"CUSTOMER_RECORDS_MANAGE"');
    expect(manage).toContain('"OPERATIONS_MANAGE"');
    expect(manage).toContain('"SCHEDULE_MANAGE"');
    expect(confirmationBoundary(repository)).toContain(
      "and ${staffManageSql(profileId)}",
    );
  });

  it("recomputes the candidate, locks the Booking and team/day, and rejects stale versions and neighbors", async () => {
    const boundary = confirmationBoundary(await source());
    expect(boundary).toContain("previewBookingScheduleRecord");
    expect(boundary).toContain("item.key === command.candidateKey");
    expect(boundary).toContain("workDate: command.workDate");
    expect(boundary).toContain("for update of booking");
    expect(boundary).toContain("pg_advisory_xact_lock");
    expect(boundary).toContain("target.version <> ${command.expectedBookingVersion}");
    expect(boundary).toContain("expectedOccupancySnapshotVersion");
    expect(boundary).toContain("actual_previous as materialized");
    expect(boundary).toContain("actual_next as materialized");
    expect(boundary).toContain("${candidate.previousOccupancyId ?? null}::uuid");
    expect(boundary).toContain("${candidate.nextOccupancyId ?? null}::uuid");
  });

  it("freshly rechecks immutable provenance, customer/property safety, capabilities, and equipment", async () => {
    const boundary = confirmationBoundary(await source());
    expect(boundary).toContain("target.duration_snapshot is distinct from");
    expect(boundary).toContain("target.acceptance_duration_snapshot");
    expect(boundary).toContain("quoteSourceSnapshotMatched");
    expect(boundary).toContain("requestSourceSnapshotMatched");
    expect(boundary).toContain("requestNormalizationPreserved");
    expect(boundary).toContain("is distinct from 'true'");
    expect(boundary).toContain("target.customer_status <> 'ACTIVE'");
    expect(boundary).toContain("target.property_status <> 'ACTIVE'");
    expect(boundary).toContain("target.property_customer_id <> target.customer_id");
    expect(boundary).toContain("from ${teamCapabilities} capability");
    expect(boundary).toContain("capability.active = true");
    expect(boundary).toContain("equipment_context as materialized");
    expect(boundary).toContain("active and status = 'ACTIVE'");
    expect(boundary).toContain("currently_assigned");
    expect(boundary).toContain(
      "#> '{sourceEstimateDurationSnapshot,input,items}'",
    );
    expect(boundary).toContain("jsonb_array_elements(case");
    expect(boundary).toContain("snapshot_item.item ->> 'serviceCode'");
    expect(boundary).toContain(
      "'source', 'IMMUTABLE_ACCEPTED_ESTIMATE_DURATION_INPUT'",
    );
    expect(boundary).toContain("'bookingItemCountVerified', true");
    expect(boundary).not.toContain("join ${services}");
  });

  it("appends an immutable reschedule revision, releases only the predecessor, and records every assignment event", async () => {
    const boundary = confirmationBoundary(await source());
    expect(boundary).toContain("update ${bookingOccupancies} occupancy");
    expect(boundary).toContain("set status = 'CANCELLED'");
    expect(boundary).toContain("decision.result = 'READY'");
    expect(boundary).toContain("insert into ${bookingOccupancies}");
    expect(boundary).toContain("previous_occupancy_id");
    expect(boundary).toContain("'INITIAL'");
    expect(boundary).toContain("'RESCHEDULE'");
    expect(boundary).toContain("max(history.snapshot_version) + 1");
    expect(boundary).toContain("'BOOKING_SCHEDULED'");
    expect(boundary).toContain("'BOOKING_RESCHEDULED'");
    expect(boundary).toContain("'TEAM_ASSIGNED'");
    expect(boundary).toContain("'EQUIPMENT_ASSIGNED'");
    expect(boundary).toContain("'OCCUPANCY_RELEASED'");
  });

  it("never accepts client duration/end/travel authority or rewrites upstream CRM and commercial facts", async () => {
    const [repository, types] = await Promise.all([source(), typesSource()]);
    const boundary = confirmationBoundary(repository);
    const commandType = types.slice(
      types.indexOf("export type ScheduleConfirmationCommand"),
      types.indexOf("export type ScheduleMutationResult"),
    );
    expect(commandType).not.toMatch(/serviceEnd|durationMinutes|travelMinutes/);
    expect(boundary).not.toMatch(/update\s+\$\{(?:customers|properties)\}/i);
    expect(boundary).not.toMatch(
      /update\s+\$\{(?:quoteAcceptances|bookingItems|services)\}/i,
    );
    expect(boundary).not.toMatch(/duration_snapshot\s*=/i);
    expect(boundary).not.toMatch(/price_snapshot\s*=/i);
    expect(boundary).not.toMatch(/\b(?:reprice|renormalize|refreshCrm)\b/i);
    expect(boundary).toContain("target.duration_snapshot");
    expect(boundary).not.toContain("from ${services}");
    expect(boundary).toContain("target.property_snapshot");
    expect(boundary).toContain("'commercialTermsPreserved', true");
  });
});
