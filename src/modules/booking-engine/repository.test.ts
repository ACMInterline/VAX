import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/client";

vi.mock("server-only", () => ({}));

import {
  acceptQuoteRecord,
  cancelBookingRecord,
  listBookingOccupancyRecords,
  listCustomerBookingRecords,
  loadCustomerBookingRecord,
  loadStaffBookingRecord,
  previewCustomerQuoteAcceptanceRecord,
} from "./repository";

const dialect = new PgDialect();
const actorId = "10000000-0000-4000-8000-000000000001";
const quoteReference = "Q-000000000000000000000001";
const bookingReference = "BKG-000000000000000000000001";

function executionDatabase(rows: readonly Record<string, unknown>[] = []) {
  const execute = vi.fn(async (query: SQL) => {
    void query;
    return { rows };
  });
  return {
    database: { execute } as unknown as Database,
    execute,
  };
}

function compiled(execute: ReturnType<typeof vi.fn>, call = 0) {
  return dialect.sqlToQuery(execute.mock.calls[call]![0] as SQL);
}

const customerAcceptance = {
  quoteReference,
  expectedQuoteVersion: 2,
  bookingReference,
  actorType: "CUSTOMER" as const,
  acceptanceSource: "CUSTOMER_PORTAL" as const,
  acceptanceNote: null,
};

describe("quote acceptance persistence", () => {
  it("atomically consumes only an exact immutable issued-quote chain", async () => {
    const fake = executionDatabase([
      {
        result: "CREATED",
        bookingReference,
        reasonCodes: [],
      },
    ]);

    await acceptQuoteRecord(fake.database, actorId, customerAcceptance);
    const query = compiled(fake.execute);

    expect(query.sql).toContain("for update of quote_record, request_record");
    expect(query.sql).toContain("for share of customer, property");
    expect(query.sql).toContain("for share of zone");
    expect(query.sql).toContain("for share of estimate");
    expect(query.sql).toContain("estimate_evidence_integrity as materialized");
    expect(query.sql).toContain(
      "not exists (select 1 from estimate_evidence_integrity)",
    );
    expect(query.sql).toContain("jsonb_object_keys");
    expect(query.sql).toContain("jsonb_array_elements");
    expect(query.sql).toContain("'schedulingConfigurationReady'");
    expect(query.sql).toContain("pg_input_is_valid");
    expect(query.sql).toContain("price_config_rule");
    expect(query.sql).toContain("duration_config_rule");
    expect(query.sql).toContain("price_evidence_line");
    expect(query.sql).toContain("price_minimum_line");
    expect(query.sql).toContain("duration_evidence_line");
    expect(query.sql).toContain("unique_price_rule");
    expect(query.sql).toContain("unique_duration_rule");
    expect(query.sql).toContain("estimated_travel_minutes is null");
    expect(query.sql).not.toContain("jsonb_object_length");
    expect(query.sql).toContain("current_source_snapshot as materialized");
    expect(query.sql).toContain(
      "acceptance_source_snapshot from target) is null",
    );
    expect(query.sql).toContain(
      "is distinct from (\n                select current_acceptance_source_snapshot from integrity",
    );
    for (const child of [
      "'quote', jsonb_build_object",
      "'request', jsonb_build_object",
      "'estimate', jsonb_build_object",
      "'customer', jsonb_build_object",
      "'property', jsonb_build_object",
      "'travelZone', jsonb_build_object",
    ]) {
      expect(query.sql).toContain(child);
    }
    expect(query.sql).toContain("'quoteItems', coalesce");
    expect(query.sql).toContain("for share of quote_item");
    expect(query.sql).toContain("request_item.customer_description");
    expect(query.sql).toContain("request_item.normalized_description");
    expect(query.sql).toContain("request_version");
    expect(query.sql).toMatch(/source_request_version \+ 1/);
    expect(query.sql).toContain("estimate_source_request_version");
    expect(query.sql).toContain("priceSnapshotSha256");
    expect(query.sql).toContain("encode(sha256(convert_to");
    expect(query.sql).toContain("sourceEstimateDurationSnapshot");
    expect(query.sql).toContain("current_customer_segment");
    expect(query.sql).toContain("travel_zone_code");
    expect(query.sql).toContain("graph_matches");
    expect(query.sql).toContain("all_quoted");
    expect(query.sql).toContain('insert into "quote_acceptances"');
    expect(query.sql).toContain('insert into "bookings"');
    expect(query.sql).toContain('insert into "booking_items"');
    expect(query.sql).toContain('insert into "booking_audit_events"');
    expect(query.sql).toContain("'PENDING_SCHEDULING', 'REVIEW_REQUIRED'");
    expect(query.sql).toContain("'OPERATIONAL_REQUIREMENTS_NOT_FROZEN'");
    expect(query.sql).toContain("'SCHEDULING_CONFIGURATION_UNAPPROVED'");
    expect(query.sql).toContain(
      "acceptance_source_snapshot #> '{quote,commercialSnapshot}'",
    );
    expect(query.sql).toContain(
      "#> '{estimate,priceSnapshot}'",
    );
    expect(query.sql).toContain(
      "#> '{estimate,durationSnapshot}'",
    );
    expect(query.sql).toContain("#> '{customer,displayName}'");
    expect(query.sql).toContain("#> '{property,streetAddress}'");
    expect(query.sql).toContain(
      "jsonb_to_recordset(\n          integrity.acceptance_source_snapshot -> 'quoteItems'",
    );
    expect(query.sql).not.toContain(
      "'sourceEstimatePriceSnapshot', integrity.price_snapshot",
    );
    expect(query.sql).not.toContain(
      "'displayName', integrity.customer_display_name",
    );
    expect(query.sql).not.toContain(
      "'streetAddress', integrity.property_street_address",
    );

    expect(query.sql).not.toMatch(/update\s+"?(?:service_requests|quotes|request_estimates|service_request_items)"?/i);
    expect(query.sql).not.toMatch(/\b(?:calculate|normalize|reprice)\s*\(/i);
    expect(query.sql).not.toContain("price_rules");
    expect(query.sql).not.toContain("duration_rules");
  });

  it("keeps legacy issued quotes without frozen evidence out of the eligible UI", async () => {
    const fake = executionDatabase([
      { state: "REVIEW_REQUIRED", bookingReference: null },
    ]);
    await previewCustomerQuoteAcceptanceRecord(
      fake.database,
      actorId,
      quoteReference,
    );
    const query = compiled(fake.execute);
    expect(query.sql).toContain("acceptance_source_snapshot is not null");
    expect(query.sql).toContain(
      "acceptance_source_snapshot ->> 'schemaVersion' = '1'",
    );
  });

  it("uses inclusive valid-from and exclusive valid-until eligibility", async () => {
    const fake = executionDatabase([
      { result: "REVIEW_REQUIRED", bookingReference: null, reasonCodes: [] },
    ]);
    await acceptQuoteRecord(fake.database, actorId, customerAcceptance);
    const query = compiled(fake.execute);
    expect(query.sql).toContain("now() <");
    expect(query.sql).toContain("valid_from");
    expect(query.sql).toContain("now() >=");
    expect(query.sql).toContain("valid_until");
  });

  it("binds customer acceptance to an exact active link and own-update permission", async () => {
    const fake = executionDatabase([
      { result: "NOT_FOUND_OR_FORBIDDEN", bookingReference: null, reasonCodes: [] },
    ]);
    await acceptQuoteRecord(fake.database, actorId, customerAcceptance);
    const query = compiled(fake.execute);
    expect(query.sql).toContain('from "customer_identity_links" exact_link');
    expect(query.sql).toContain("exact_link.active = true");
    expect(query.sql).toContain("exact_link.revoked_at is null");
    expect(query.params).toContain("OWN_CUSTOMER_DATA_UPDATE");
  });

  it("requires both staff management permissions for on-behalf acceptance", async () => {
    const fake = executionDatabase([
      { result: "REVIEW_REQUIRED", bookingReference: null, reasonCodes: [] },
    ]);
    await acceptQuoteRecord(fake.database, actorId, {
      ...customerAcceptance,
      actorType: "STAFF_ON_BEHALF",
      acceptanceSource: "PHONE",
      acceptanceNote: "Customer instructed staff by phone.",
    });
    const query = compiled(fake.execute);
    expect(query.params).toContain("CUSTOMER_RECORDS_MANAGE");
    expect(query.params).toContain("OPERATIONS_MANAGE");
    expect(query.params).not.toContain("OWN_CUSTOMER_DATA_UPDATE");
  });

  it("converts a concurrent unique conflict into the existing idempotent booking", async () => {
    const uniqueError = Object.assign(new Error("synthetic unique conflict"), {
      code: "23505",
    });
    const execute = vi
      .fn()
      .mockRejectedValueOnce(uniqueError)
      .mockResolvedValueOnce({
        rows: [
          {
            result: "EXISTING",
            bookingReference,
            reasonCodes: [],
          },
        ],
      });
    const database = { execute } as unknown as Database;

    await expect(
      acceptQuoteRecord(database, actorId, customerAcceptance),
    ).resolves.toEqual({ status: "EXISTING", bookingReference });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(compiled(execute, 1).sql).toContain("'EXISTING'::text");
  });
});

describe("booking read, cancellation, and availability boundaries", () => {
  it("keeps staff notes, audit actors, calculation evidence and raw IDs out of customer DTO SQL", async () => {
    const fake = executionDatabase();
    await loadCustomerBookingRecord(fake.database, actorId, bookingReference);
    const query = compiled(fake.execute).sql;
    expect(query).toContain('as "bookingReference"');
    expect(query).toContain('as "termsSnapshot"');
    expect(query).not.toContain("internal_notes");
    expect(query).not.toContain("calculation_snapshot");
    expect(query).not.toContain("actor_profile_id");
    expect(query).not.toContain("customer_id as");
    expect(query).not.toContain("property_id as");
  });

  it("requires exact customer ownership for every customer booking list", async () => {
    const fake = executionDatabase();
    await listCustomerBookingRecords(fake.database, actorId);
    const query = compiled(fake.execute);
    expect(query.params).toContain("OWN_CUSTOMER_DATA_READ");
    expect(query.sql).toContain("exact_link.customer_id = booking.customer_id");
  });

  it("keeps internal evidence and audit timeline behind all three staff read permissions", async () => {
    const fake = executionDatabase();
    await loadStaffBookingRecord(fake.database, actorId, bookingReference);
    const query = compiled(fake.execute);
    expect(query.params).toEqual(
      expect.arrayContaining([
        "CUSTOMER_RECORDS_READ",
        "OPERATIONS_READ",
        "SCHEDULE_READ",
      ]),
    );
    expect(query.sql).toContain('booking.internal_notes as "internalNotes"');
    expect(query.sql).toContain('as "auditTimeline"');
  });

  it("cancels booking and blocking occupancy atomically without changing quote terms", async () => {
    const fake = executionDatabase([
      { result: "CANCELLED", bookingReference },
    ]);
    await cancelBookingRecord(fake.database, actorId, {
      bookingReference,
      expectedVersion: 1,
      reasonCategory: "CUSTOMER_REQUEST",
      reasonText: "Customer requested cancellation.",
    });
    const query = compiled(fake.execute);
    expect(query.params).toEqual(
      expect.arrayContaining([
        "CUSTOMER_RECORDS_MANAGE",
        "OPERATIONS_MANAGE",
        "SCHEDULE_MANAGE",
      ]),
    );
    expect(query.sql).toContain('update "booking_occupancies" occupancy');
    expect(query.sql).toContain("occupancy.status in ('PENDING', 'CONFIRMED')");
    expect(query.sql).toContain('update "bookings" booking');
    expect(query.sql).toContain("'BOOKING_CANCELLED'");
    expect(query.sql).not.toMatch(/update\s+"?(?:quotes|quote_items|request_estimates)"?/i);
  });

  it("feeds only durable pending/confirmed occupancy into availability", async () => {
    const fake = executionDatabase();
    await listBookingOccupancyRecords(fake.database, "2026-09-01", "TEAM_A");
    const query = compiled(fake.execute);
    expect(query.sql).toContain("occupancy.status in ('PENDING', 'CONFIRMED')");
    expect(query.sql).not.toContain("'CANCELLED'");
    expect(query.sql).toContain("at time zone 'Europe/Sofia'");
    expect(query.sql).toContain("occupancy.operational_start");
    expect(query.sql).toContain("occupancy.operational_end");
    expect(query.sql).toContain('left join "working_hour_policies"');
    expect(query.sql).toContain('left join "travel_time_profiles"');
    expect(query.sql).toContain('as "configurationReferencesMatch"');
    expect(query.sql).toContain('as "operationalStartMinute"');
    expect(query.sql).toContain('as "travelSnapshot"');
    expect(query.sql).toContain('as "workingHourPolicyVersion"');
    expect(query.sql).toContain('as "travelTimeProfileVersion"');
  });
});
