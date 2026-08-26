import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/client";

vi.mock("server-only", () => ({}));

import {
  confirmBookingScheduleRecord,
  loadDispatchDayRecord,
  previewBookingScheduleRecord,
} from "./repository";

const dialect = new PgDialect();
const profileId = "10000000-0000-4000-8000-000000000001";
const bookingReference = "BKG-000000000000000000000001";

const durationSnapshot = {
  quotedDurationMinutes: 60,
  sourceEstimateDurationSnapshot: {
    input: { items: [{ serviceCode: "CARPET_CARE" }] },
    result: { totalEstimatedMinutes: 60 },
  },
};

const previewResponses = [
  [{
    id: "20000000-0000-4000-8000-000000000002",
    bookingReference,
    status: "PENDING_SCHEDULING",
    schedulingStatus: "UNSCHEDULED",
    version: 4,
    preferredDate: null,
    appointmentWindowCode: null,
    durationSnapshot,
    acceptanceDurationSnapshot: durationSnapshot,
    acceptanceProvenanceSnapshot: {
      quoteSourceSnapshotMatched: true,
      requestSourceSnapshotMatched: true,
      requestNormalizationPreserved: true,
    },
    schedulingSnapshot: {},
    customerSnapshot: { displayName: "Synthetic customer" },
    propertySnapshot: {
      label: "Synthetic property",
      city: "Sofia",
      district: "Centre",
      streetAddress: "Synthetic address",
      postalCode: "1000",
      travelZoneCode: "SOFIA_CORE",
    },
    customerStatus: "ACTIVE",
    propertyStatus: "ACTIVE",
    propertyCustomerMatches: true,
    itemCount: 1,
    occupancyId: null,
    occupancySnapshotVersion: null,
    occupancyServiceStart: null,
    occupancyServiceEnd: null,
    occupancyTeamName: null,
    occupancyEquipmentLabel: null,
    jobStatus: null,
  }],
  [{
    id: 1,
    code: "SOFIA_TEAM_HOURS_V1_DRAFT",
    name: "Synthetic hours",
    timeZone: "Europe/Sofia",
    version: 1,
    status: "DRAFT",
    provisional: true,
    active: false,
    rules: [{
      id: "TUE",
      weekday: 2,
      startMinute: 360,
      endMinute: 1_320,
      enabled: true,
      teamCode: "TEAM_A",
    }],
  }],
  [{
    id: 1,
    code: "SOFIA_TRAVEL_V1_DRAFT",
    name: "Synthetic travel",
    market: "SOFIA",
    version: 1,
    status: "DRAFT",
    defaultTravelMinutes: 20,
    interJobBufferMinutes: 10,
    provisional: true,
    active: false,
    rules: [],
  }],
  [{
    id: 1,
    code: "TEAM_A",
    name: "Team A",
    active: true,
    defaultCrewSize: 2,
    workingHourPolicyId: 1,
    capabilities: ["STANDARD_RESIDENTIAL"],
    equipment: [{
      id: 1,
      code: "MACHINE_A",
      name: "Machine A",
      equipmentTypeCode: "PORTABLE_CLEANING_MACHINE",
      capabilityCode: "PORTABLE_EXTRACTION",
      status: "ACTIVE",
      active: true,
      assignmentActive: true,
      effectiveFrom: "2026-09-08T03:00:00.000Z",
      effectiveUntil: "2026-09-08T20:00:00.000Z",
    }],
  }],
  [{
    code: "SOFIA_CORE",
    nameBg: "София център",
    nameEn: "Sofia core",
    active: true,
    serviceEligible: true,
    minimumOrderOverrideMinorUnits: null,
    estimatedBaseTravelMinutes: 20,
    manualConfirmationRequired: false,
    geographicMetadata: {},
    notes: null,
  }],
  [],
  [],
] as const;

function fakeDatabase(
  extraResponses: readonly unknown[][] = [],
  teams: readonly unknown[] = previewResponses[3],
) {
  let responseIndex = 0;
  const responses = [
    previewResponses[0],
    previewResponses[1],
    previewResponses[2],
    teams,
    previewResponses[4],
    previewResponses[5],
    previewResponses[6],
    ...extraResponses,
  ];
  const execute = vi.fn((query: SQL) => {
    void query;
    const rows = responses[responseIndex] ?? [];
    responseIndex += 1;
    return Promise.resolve({ rows });
  });
  const batch = vi.fn(async (queries: readonly Promise<unknown>[]) =>
    Promise.all(queries));
  return {
    database: { execute, batch } as unknown as Database,
    execute,
    batch,
  };
}

const dispatchAppointment = {
  bookingId: "30000000-0000-4000-8000-000000000003",
  bookingReference,
  bookingStatus: "CONFIRMED",
  customerStatus: "ACTIVE",
  propertyStatus: "ACTIVE",
  propertyCustomerMatches: true,
  customerDisplayName: "Synthetic customer",
  propertyLabel: "Synthetic property",
  propertyAddress: "Synthetic address",
  propertyArea: "Centre",
  teamId: 1,
  equipmentResourceId: 1,
  serviceStart: new Date("2026-09-08T03:00:00.000Z"),
  serviceEnd: new Date("2026-09-08T04:00:00.000Z"),
  operationalStart: new Date("2026-09-08T03:00:00.000Z"),
  operationalEnd: new Date("2026-09-08T04:00:00.000Z"),
  serviceDurationMinutes: 60,
  locationSnapshot: {
    city: "Sofia",
    district: "Centre",
    streetAddress: "Synthetic address",
    postalCode: "1000",
    travelZoneCode: "SOFIA_CORE",
  },
  requirementsSnapshot: {
    source: "IMMUTABLE_ACCEPTED_ESTIMATE_DURATION_INPUT",
    bookingItemCountVerified: true,
    requiredTeamCount: 1,
    requiredCapabilityCodes: ["STANDARD_RESIDENTIAL"],
    requiredEquipmentCapabilityCodes: ["PORTABLE_EXTRACTION"],
  },
  travelSnapshot: {
    travelBeforeMinutes: 0,
    travelAfterMinutes: 0,
    bufferMinutes: 0,
    parkingBufferMinutes: 0,
  },
  equipmentLabel: "Machine A",
  jobReference: "JOB-000000000000000000000001",
  jobStatus: "READY",
  grossRevenueMinorUnits: null,
} as const;

function fakeDispatchDatabase(
  appointments: readonly unknown[],
  teams: readonly unknown[] = previewResponses[3],
) {
  let responseIndex = 0;
  const responses = [
    previewResponses[1],
    previewResponses[2],
    teams,
    previewResponses[4],
    previewResponses[5],
    appointments,
    [],
  ];
  const execute = vi.fn((query: SQL) => {
    void query;
    const rows = responses[responseIndex] ?? [];
    responseIndex += 1;
    return Promise.resolve({ rows });
  });
  return { execute } as unknown as Database;
}

describe("Phase 3G scheduling persistence", () => {
  it("generates future candidates only from assignments covering service", async () => {
    const fake = fakeDatabase();
    const preview = await previewBookingScheduleRecord(
      fake.database,
      profileId,
      { bookingReference, workDate: "2026-09-08" },
    );

    expect(preview?.candidates.length).toBeGreaterThan(0);
    expect(preview?.candidates[0]?.equipmentLabel).toBe("Machine A");
    const teamQuery = dialect.sqlToQuery(
      fake.execute.mock.calls[3]![0] as SQL,
    ).sql;
    expect(teamQuery).not.toContain("effective_from <= now()");
    expect(teamQuery).not.toContain("effective_until > now()");
  });

  it("preserves non-selectable candidates and their review reason", async () => {
    const teamsWithoutCapability = [{
      ...previewResponses[3][0],
      capabilities: [],
    }];
    const preview = await previewBookingScheduleRecord(
      fakeDatabase([], teamsWithoutCapability).database,
      profileId,
      { bookingReference, workDate: "2026-09-08" },
    );

    expect(preview?.candidates.length).toBeGreaterThan(0);
    expect(preview?.candidates[0]).toMatchObject({
      readiness: "CAPABILITY_REVIEW",
      selectable: false,
      warnings: expect.arrayContaining(["Missing required team capability."]),
    });
  });

  it("keeps feasible slots ahead of more than twelve blocked slots", async () => {
    const lateEquipmentAssignment = [{
      ...previewResponses[3][0],
      equipment: [{
        ...previewResponses[3][0].equipment[0],
        effectiveFrom: "2026-09-08T10:00:00.000Z",
      }],
    }];
    const preview = await previewBookingScheduleRecord(
      fakeDatabase([], lateEquipmentAssignment).database,
      profileId,
      { bookingReference, workDate: "2026-09-08" },
    );

    expect(preview?.candidates).toHaveLength(12);
    expect(preview?.candidates.every((candidate) => candidate.selectable)).toBe(
      true,
    );
  });

  it("locks before the mutation snapshot and recompiles travel from current neighbors", async () => {
    const previewFake = fakeDatabase();
    const preview = await previewBookingScheduleRecord(
      previewFake.database,
      profileId,
      { bookingReference, workDate: "2026-09-08" },
    );
    const candidate = preview?.candidates[0];
    expect(candidate).toBeDefined();

    const fake = fakeDatabase([
      [],
      [],
      [{
        result: "STALE",
        bookingReference,
        occupancyId: null,
        occupancySnapshotVersion: null,
        bookingVersion: 4,
        serviceStart: null,
        serviceEnd: null,
        reasonCodes: [],
      }],
    ]);
    await expect(
      confirmBookingScheduleRecord(fake.database, profileId, {
        bookingReference,
        expectedBookingVersion: 4,
        workDate: "2026-09-08",
        candidateKey: candidate!.key,
        expectedOccupancySnapshotVersion: null,
        reasonCategory: null,
        reasonText: null,
      }),
    ).resolves.toEqual({ status: "STALE" });

    expect(fake.batch).toHaveBeenCalledOnce();
    const isolation = dialect.sqlToQuery(
      fake.execute.mock.calls[7]![0] as SQL,
    ).sql;
    const lock = dialect.sqlToQuery(fake.execute.mock.calls[8]![0] as SQL).sql;
    const compiledMutation = dialect.sqlToQuery(
      fake.execute.mock.calls[9]![0] as SQL,
    );
    const mutation = compiledMutation.sql;
    expect(isolation).toContain("set transaction isolation level read committed");
    expect(lock).toContain("pg_advisory_xact_lock");
    expect(mutation).toContain("previous_rule as materialized");
    expect(mutation).toContain("next_rule as materialized");
    expect(mutation).toContain("travel_revalidation as materialized");
    expect(mutation).toContain("for update of occupancy");
    expect(mutation).toContain("assigned_for_service");
    expect(mutation).not.toContain("effective_from <= now()");
  });

  it("keeps a currently valid confirmed appointment ready and out of the review queue", async () => {
    const dispatch = await loadDispatchDayRecord(
      fakeDispatchDatabase([dispatchAppointment]),
      profileId,
      { workDate: "2026-09-08", includeRevenue: false },
    );

    expect(dispatch.teams[0]?.appointments[0]?.readiness).toBe("READY");
    expect(dispatch.unscheduledBookings).toEqual([]);
  });

  it("rechecks current team capability and queues a confirmed conflict", async () => {
    const teamsWithoutCapability = [{
      ...previewResponses[3][0],
      capabilities: [],
    }];
    const dispatch = await loadDispatchDayRecord(
      fakeDispatchDatabase([dispatchAppointment], teamsWithoutCapability),
      profileId,
      { workDate: "2026-09-08", includeRevenue: false },
    );

    expect(dispatch.teams[0]?.appointments[0]).toMatchObject({
      readiness: "CAPABILITY_REVIEW",
      warnings: expect.arrayContaining(["Missing required team capability."]),
    });
    expect(dispatch.unscheduledBookings).toEqual([
      expect.objectContaining({
        bookingReference,
        readiness: "CAPABILITY_REVIEW",
      }),
    ]);
  });

  it("keeps an appointment visible but queues invalid current CRM ownership", async () => {
    const dispatch = await loadDispatchDayRecord(
      fakeDispatchDatabase([{
        ...dispatchAppointment,
        customerStatus: "ARCHIVED",
        propertyCustomerMatches: false,
      }]),
      profileId,
      { workDate: "2026-09-08", includeRevenue: false },
    );

    expect(dispatch.teams[0]?.appointments[0]).toMatchObject({
      bookingReference,
      readiness: "CUSTOMER_REVIEW",
      warnings: expect.arrayContaining(["CRM_OWNERSHIP_REVIEW_REQUIRED"]),
    });
    expect(dispatch.unscheduledBookings).toEqual([
      expect.objectContaining({
        bookingReference,
        readiness: "CUSTOMER_REVIEW",
      }),
    ]);
  });

  it("rechecks full-service equipment assignment and current travel evidence", async () => {
    const teamsWithExpiredAssignment = [{
      ...previewResponses[3][0],
      equipment: [{
        ...previewResponses[3][0].equipment[0],
        effectiveUntil: "2026-09-08T03:30:00.000Z",
      }],
    }];
    const equipmentDispatch = await loadDispatchDayRecord(
      fakeDispatchDatabase(
        [dispatchAppointment],
        teamsWithExpiredAssignment,
      ),
      profileId,
      { workDate: "2026-09-08", includeRevenue: false },
    );
    expect(equipmentDispatch.teams[0]?.appointments[0]?.readiness).toBe(
      "MISSING_EQUIPMENT",
    );
    expect(equipmentDispatch.unscheduledBookings[0]?.readiness).toBe(
      "MISSING_EQUIPMENT",
    );

    const travelDispatch = await loadDispatchDayRecord(
      fakeDispatchDatabase([{
        ...dispatchAppointment,
        operationalStart: new Date("2026-09-08T02:50:00.000Z"),
      }]),
      profileId,
      { workDate: "2026-09-08", includeRevenue: false },
    );
    expect(travelDispatch.teams[0]?.appointments[0]).toMatchObject({
      readiness: "TRAVEL_REVIEW",
      warnings: expect.arrayContaining(["CURRENT_TRAVEL_OR_BUFFER_CHANGED"]),
    });
    expect(travelDispatch.unscheduledBookings[0]?.readiness).toBe(
      "TRAVEL_REVIEW",
    );

    const missingTravelEvidence = await loadDispatchDayRecord(
      fakeDispatchDatabase([{
        ...dispatchAppointment,
        travelSnapshot: {},
      }]),
      profileId,
      { workDate: "2026-09-08", includeRevenue: false },
    );
    expect(missingTravelEvidence.teams[0]?.appointments[0]).toMatchObject({
      readiness: "TRAVEL_REVIEW",
      warnings: expect.arrayContaining(["CURRENT_TRAVEL_OR_BUFFER_CHANGED"]),
    });
    expect(missingTravelEvidence.unscheduledBookings[0]?.readiness).toBe(
      "TRAVEL_REVIEW",
    );
  });
});
