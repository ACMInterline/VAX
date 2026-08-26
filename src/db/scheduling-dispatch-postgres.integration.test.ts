import { randomBytes, randomUUID } from "node:crypto";
import {
  neon,
  type NeonQueryFunction,
} from "@neondatabase/serverless";
import { describe, expect, it, vi } from "vitest";
import { getDatabase } from "@/db/client";
import { getDatabaseUrl } from "@/lib/environment";
import { cancelBookingRecord } from "@/modules/booking-engine/repository";
import {
  executeScheduleConfirmationCandidate,
  previewBookingScheduleRecord,
} from "@/modules/scheduling-dispatch/repository";
import type { ScheduleCandidate } from "@/modules/scheduling-dispatch/types";
import {
  assertDevelopmentDatabaseMutationTarget,
  loadMigrationEnvironment,
} from "./migration-environment";

vi.mock("server-only", () => ({}));

const runLiveIntegration =
  process.env.RUN_PHASE3G_DATABASE_INTEGRATION === "1";

type NeonQuery = NeonQueryFunction<false, false>;

type SchedulingFixture = Readonly<{
  profileId: string;
  customerId: string;
  propertyId: string;
  requestId: string;
  estimateId: string;
  quoteId: string;
  quoteItemId: string;
  acceptanceId: string;
  bookingId: string;
  bookingItemId: string;
  bookingReference: string;
  workDate: string;
}>;

async function createSchedulingFixture(
  query: NeonQuery,
): Promise<SchedulingFixture> {
  const token = randomBytes(12).toString("hex").toUpperCase();
  const fixture: SchedulingFixture = {
    profileId: randomUUID(),
    customerId: randomUUID(),
    propertyId: randomUUID(),
    requestId: randomUUID(),
    estimateId: randomUUID(),
    quoteId: randomUUID(),
    quoteItemId: randomUUID(),
    acceptanceId: randomUUID(),
    bookingId: randomUUID(),
    bookingItemId: randomUUID(),
    bookingReference: `BKG-${token}`,
    workDate: "2026-09-08",
  };
  const durationSnapshot = JSON.stringify({
    quotedDurationMinutes: 60,
    sourceEstimateDurationSnapshot: {
      input: { items: [{ serviceCode: "CARPET_CARE" }] },
      result: { totalEstimatedMinutes: 60 },
    },
  });

  const rows = (await query.query(`
    with model_authority as materialized (
      select price_book.id as price_book_id,
        price_book.code as price_book_code,
        price_book.version as price_book_version,
        duration_model.id as duration_model_id,
        duration_model.code as duration_model_code,
        duration_model.version as duration_model_version
      from public.price_books price_book
      cross join public.duration_models duration_model
      order by price_book.id, duration_model.id
      limit 1
    ),
    inserted_profile as (
      insert into public.user_profiles (
        id, auth_provider_user_id, display_name, preferred_locale, status
      ) values ($1::uuid, $2::text, 'Phase 3G integration dispatcher',
        'en', 'ACTIVE')
      returning id
    ),
    inserted_role as (
      insert into public.user_roles (
        user_profile_id, role_id, active, assignment_source
      )
      select inserted_profile.id, application_role.id, true,
        'OWNER_BOOTSTRAP'
      from inserted_profile
      join public.application_roles application_role
        on application_role.code = 'OWNER' and application_role.active = true
      returning role_id
    ),
    inserted_customer as (
      insert into public.customers (
        id, customer_type, display_name, preferred_locale, status
      ) values ($3::uuid, 'INDIVIDUAL',
        'Phase 3G integration customer', 'en', 'ACTIVE')
      returning id
    ),
    inserted_property as (
      insert into public.properties (
        id, customer_id, property_type, label, city, district,
        street_address, postal_code, access_notes, service_zone_id, status
      )
      select $4::uuid, inserted_customer.id, 'RESIDENTIAL',
        'Phase 3G integration property', 'Sofia', 'Centre',
        'Synthetic integration address', '1000',
        'Synthetic access note', zone.id, 'ACTIVE'
      from inserted_customer
      join public.travel_zones zone on zone.code = 'SOFIA_CORE'
      returning id
    ),
    inserted_request as (
      insert into public.service_requests (
        id, request_reference, source, customer_resolution_status,
        customer_id, property_id, status, preferred_locale, contact_name,
        contact_phone, preferred_date, original_submission,
        manual_review_required
      )
      select $5::uuid, $6::text, 'STAFF_CREATED', 'LINKED',
        inserted_customer.id, inserted_property.id, 'QUOTED', 'en',
        'Phase 3G integration customer', '0000000000', $15::date,
        '{"phase":"3G_INTEGRATION"}'::jsonb, false
      from inserted_customer cross join inserted_property
      returning id
    ),
    inserted_estimate as (
      insert into public.request_estimates (
        id, request_id, source_request_version, estimate_version, status,
        price_book_id, price_book_code, price_book_version,
        duration_model_id, duration_model_code, duration_model_version,
        input_snapshot, price_snapshot, duration_snapshot,
        availability_snapshot, net_amount_minor_units,
        vat_rate_basis_points, vat_amount_minor_units,
        gross_total_minor_units, currency, estimated_service_minutes,
        estimated_travel_minutes, manual_assessment_required,
        decline_or_refer_required
      )
      select $7::uuid, inserted_request.id, 1, 1, 'CALCULATED',
        model_authority.price_book_id, model_authority.price_book_code,
        model_authority.price_book_version,
        model_authority.duration_model_id,
        model_authority.duration_model_code,
        model_authority.duration_model_version,
        '{}'::jsonb, '{}'::jsonb, $16::jsonb, '{}'::jsonb,
        0, 0, 0, 0, 'EUR', 60, 0, false, false
      from inserted_request cross join model_authority
      returning id, request_id
    ),
    inserted_quote as (
      insert into public.quotes (
        id, quote_reference, request_id, source_request_version,
        customer_id, property_id, estimate_id, quote_version,
        record_version, status, currency, price_basis,
        net_amount_minor_units, vat_rate_basis_points,
        vat_amount_minor_units, gross_total_minor_units,
        estimated_duration_minutes, commercial_snapshot, terms_snapshot,
        valid_from, valid_until, issued_at
      )
      select $8::uuid, $9::text, inserted_request.id, 1,
        inserted_customer.id, inserted_property.id, inserted_estimate.id,
        1, 1, 'ISSUED', 'EUR', 'GROSS', 0, 0, 0, 0, 60,
        '{}'::jsonb, '{}'::jsonb, now() - interval '1 hour',
        now() + interval '30 days', now()
      from inserted_request cross join inserted_customer
      cross join inserted_property cross join inserted_estimate
      returning id, request_id, customer_id, property_id
    ),
    inserted_quote_item as (
      insert into public.quote_items (
        id, quote_id, description_bg, description_en, quantity,
        measurement_snapshot, base_amount_minor_units,
        modifier_amount_minor_units, addon_amount_minor_units,
        net_amount_minor_units, vat_rate_basis_points,
        vat_amount_minor_units, gross_total_minor_units,
        calculation_snapshot, sort_order
      )
      select $10::uuid, inserted_quote.id, 'Синтетична услуга',
        'Synthetic service', 1, '{}'::jsonb, 0, 0, 0, 0, 0, 0, 0,
        '{}'::jsonb, 0
      from inserted_quote
      returning id
    ),
    inserted_acceptance as (
      insert into public.quote_acceptances (
        id, quote_id, quote_version, quote_record_version, request_id,
        source_request_version, customer_id, property_id, actor_type,
        acceptance_source, acceptance_note, commercial_snapshot,
        terms_snapshot, pricing_snapshot, duration_snapshot,
        provenance_snapshot
      )
      select $11::uuid, inserted_quote.id, 1, 1,
        inserted_quote.request_id, 1, inserted_quote.customer_id,
        inserted_quote.property_id, 'STAFF_ON_BEHALF', 'PHONE',
        'Synthetic Phase 3G integration acceptance', '{}'::jsonb,
        '{}'::jsonb, '{}'::jsonb, $16::jsonb,
        '{"quoteSourceSnapshotMatched":true,
          "requestSourceSnapshotMatched":true,
          "requestNormalizationPreserved":true}'::jsonb
      from inserted_quote
      returning id, quote_id, request_id, customer_id, property_id
    ),
    inserted_booking as (
      insert into public.bookings (
        id, booking_reference, request_id, quote_id, quote_acceptance_id,
        customer_id, property_id, status, scheduling_status,
        preferred_date, price_snapshot, duration_snapshot,
        scheduling_snapshot, customer_snapshot, property_snapshot, version
      )
      select $12::uuid, $13::text, inserted_acceptance.request_id,
        inserted_acceptance.quote_id, inserted_acceptance.id,
        inserted_acceptance.customer_id, inserted_acceptance.property_id,
        'PENDING_SCHEDULING', 'UNSCHEDULED', $15::date,
        '{"currency":"EUR","grossTotalMinorUnits":0}'::jsonb,
        $16::jsonb, '{}'::jsonb,
        '{"displayName":"Phase 3G integration customer"}'::jsonb,
        '{"label":"Phase 3G integration property","city":"Sofia",
          "district":"Centre","streetAddress":"Synthetic integration address",
          "postalCode":"1000","travelZoneCode":"SOFIA_CORE",
          "accessNotes":"Synthetic access note"}'::jsonb, 1
      from inserted_acceptance
      returning id
    ),
    inserted_booking_item as (
      insert into public.booking_items (
        id, booking_id, quote_item_id, description_bg, description_en,
        quantity, measurement_snapshot, base_amount_minor_units,
        modifier_amount_minor_units, addon_amount_minor_units,
        net_amount_minor_units, vat_rate_basis_points,
        vat_amount_minor_units, gross_total_minor_units,
        calculation_snapshot, duration_basis_snapshot, sort_order
      )
      select $14::uuid, inserted_booking.id, inserted_quote_item.id,
        'Синтетична услуга', 'Synthetic service', 1, '{}'::jsonb,
        0, 0, 0, 0, 0, 0, 0, '{}'::jsonb, $16::jsonb, 0
      from inserted_booking cross join inserted_quote_item
      returning id
    )
    select (select count(*) from inserted_role)::integer as role_count,
      (select count(*) from inserted_booking_item)::integer as item_count
  `, [
    fixture.profileId,
    `phase3g-integration-${token.toLowerCase()}`,
    fixture.customerId,
    fixture.propertyId,
    fixture.requestId,
    `REQ-${token}`,
    fixture.estimateId,
    fixture.quoteId,
    `Q-${token}`,
    fixture.quoteItemId,
    fixture.acceptanceId,
    fixture.bookingId,
    fixture.bookingReference,
    fixture.bookingItemId,
    fixture.workDate,
    durationSnapshot,
  ])) as Array<{ role_count: number; item_count: number }>;

  expect(rows).toEqual([{ role_count: 1, item_count: 1 }]);
  return fixture;
}

async function cleanupSchedulingFixture(
  query: NeonQuery,
  fixture: SchedulingFixture,
): Promise<void> {
  await query.query(
    "delete from public.booking_audit_events where booking_id = $1::uuid",
    [fixture.bookingId],
  );
  await query.query(
    "delete from public.booking_occupancies where booking_id = $1::uuid",
    [fixture.bookingId],
  );
  await query.query(
    "delete from public.booking_items where booking_id = $1::uuid",
    [fixture.bookingId],
  );
  await query.query("delete from public.bookings where id = $1::uuid", [
    fixture.bookingId,
  ]);
  await query.query(
    "delete from public.quote_acceptances where id = $1::uuid",
    [fixture.acceptanceId],
  );
  await query.query("delete from public.quote_items where id = $1::uuid", [
    fixture.quoteItemId,
  ]);
  await query.query("delete from public.quotes where id = $1::uuid", [
    fixture.quoteId,
  ]);
  await query.query(
    "delete from public.request_estimates where id = $1::uuid",
    [fixture.estimateId],
  );
  await query.query("delete from public.service_requests where id = $1::uuid", [
    fixture.requestId,
  ]);
  await query.query("delete from public.properties where id = $1::uuid", [
    fixture.propertyId,
  ]);
  await query.query("delete from public.customers where id = $1::uuid", [
    fixture.customerId,
  ]);
  await query.query(
    "delete from public.user_roles where user_profile_id = $1::uuid",
    [fixture.profileId],
  );
  await query.query("delete from public.user_profiles where id = $1::uuid", [
    fixture.profileId,
  ]);

  const residue = (await query.query(`
    select (
      (select count(*) from public.user_profiles where id = $1::uuid) +
      (select count(*) from public.customers where id = $2::uuid) +
      (select count(*) from public.properties where id = $3::uuid) +
      (select count(*) from public.service_requests where id = $4::uuid) +
      (select count(*) from public.request_estimates where id = $5::uuid) +
      (select count(*) from public.quotes where id = $6::uuid) +
      (select count(*) from public.quote_items where id = $7::uuid) +
      (select count(*) from public.quote_acceptances where id = $8::uuid) +
      (select count(*) from public.bookings where id = $9::uuid) +
      (select count(*) from public.booking_items where id = $10::uuid) +
      (select count(*) from public.booking_occupancies
        where booking_id = $9::uuid) +
      (select count(*) from public.booking_audit_events
        where booking_id = $9::uuid)
    )::integer as residue_count
  `, [
    fixture.profileId,
    fixture.customerId,
    fixture.propertyId,
    fixture.requestId,
    fixture.estimateId,
    fixture.quoteId,
    fixture.quoteItemId,
    fixture.acceptanceId,
    fixture.bookingId,
    fixture.bookingItemId,
  ])) as Array<{ residue_count: number }>;
  expect(residue).toEqual([{ residue_count: 0 }]);
}

describe.skipIf(!runLiveIntegration)(
  "Phase 3G PostgreSQL occupancy constraints",
  () => {
    it("enforces team and equipment collisions without durable fixtures", async () => {
      loadMigrationEnvironment();
      assertDevelopmentDatabaseMutationTarget();
      const query = neon(getDatabaseUrl());

      const constraints = (await query.query(`
        select conname
        from pg_constraint
        where conrelid = 'public.booking_occupancies'::regclass
          and conname in (
            'booking_occupancies_team_no_overlap',
            'booking_occupancies_equipment_no_overlap'
          )
        order by conname
      `)) as Array<{ conname: string }>;
      expect(constraints.map((row) => row.conname)).toEqual([
        "booking_occupancies_equipment_no_overlap",
        "booking_occupancies_team_no_overlap",
      ]);

      await query.query(`
        do $phase3g$
        declare
          before_failed_insert integer;
          after_failed_insert integer;
          final_count integer;
        begin
          create temp table phase3g_occupancy_probe
            (like public.booking_occupancies including all)
            on commit drop;

          insert into phase3g_occupancy_probe (
            booking_id, snapshot_version, team_id, equipment_resource_id,
            service_start, service_end, operational_start, operational_end,
            service_duration_minutes, required_equipment_capability_code,
            scheduling_policy_code, scheduling_policy_version,
            working_hour_policy_id, working_hour_policy_code,
            working_hour_policy_version, travel_time_profile_id,
            travel_time_profile_code, travel_time_profile_version,
            duration_snapshot, location_snapshot, requirements_snapshot,
            availability_input_snapshot, availability_result_snapshot,
            travel_snapshot, working_hours_snapshot, equipment_snapshot
          ) values (
            gen_random_uuid(), 1, 101, 201,
            '2026-09-08 08:00:00+03', '2026-09-08 10:00:00+03',
            '2026-09-08 07:30:00+03', '2026-09-08 10:30:00+03',
            120, 'PORTABLE_EXTRACTION', 'PHASE3G_PROBE', 1,
            1, 'PHASE3G_PROBE', 1, 1, 'PHASE3G_PROBE', 1,
            '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
            '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb
          );

          select count(*) into before_failed_insert
          from phase3g_occupancy_probe;
          begin
            insert into phase3g_occupancy_probe (
              booking_id, snapshot_version, team_id, equipment_resource_id,
              service_start, service_end, operational_start, operational_end,
              service_duration_minutes, required_equipment_capability_code,
              scheduling_policy_code, scheduling_policy_version,
              working_hour_policy_id, working_hour_policy_code,
              working_hour_policy_version, travel_time_profile_id,
              travel_time_profile_code, travel_time_profile_version,
              duration_snapshot, location_snapshot, requirements_snapshot,
              availability_input_snapshot, availability_result_snapshot,
              travel_snapshot, working_hours_snapshot, equipment_snapshot
            ) values (
              gen_random_uuid(), 1, 101, 202,
              '2026-09-08 09:00:00+03', '2026-09-08 11:00:00+03',
              '2026-09-08 08:30:00+03', '2026-09-08 11:30:00+03',
              120, 'PORTABLE_EXTRACTION', 'PHASE3G_PROBE', 1,
              1, 'PHASE3G_PROBE', 1, 1, 'PHASE3G_PROBE', 1,
              '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
              '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb
            );
            raise exception 'same-team overlap was accepted';
          exception when exclusion_violation then
            null;
          end;
          select count(*) into after_failed_insert
          from phase3g_occupancy_probe;
          if before_failed_insert <> after_failed_insert then
            raise exception 'failed same-team insert left partial state';
          end if;

          insert into phase3g_occupancy_probe (
            booking_id, snapshot_version, team_id, equipment_resource_id,
            service_start, service_end, operational_start, operational_end,
            service_duration_minutes, required_equipment_capability_code,
            scheduling_policy_code, scheduling_policy_version,
            working_hour_policy_id, working_hour_policy_code,
            working_hour_policy_version, travel_time_profile_id,
            travel_time_profile_code, travel_time_profile_version,
            duration_snapshot, location_snapshot, requirements_snapshot,
            availability_input_snapshot, availability_result_snapshot,
            travel_snapshot, working_hours_snapshot, equipment_snapshot
          ) values (
            gen_random_uuid(), 1, 102, 203,
            '2026-09-08 12:00:00+03', '2026-09-08 14:00:00+03',
            '2026-09-08 11:30:00+03', '2026-09-08 14:30:00+03',
            120, 'PORTABLE_EXTRACTION', 'PHASE3G_PROBE', 1,
            1, 'PHASE3G_PROBE', 1, 1, 'PHASE3G_PROBE', 1,
            '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
            '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb
          );
          begin
            insert into phase3g_occupancy_probe (
              booking_id, snapshot_version, team_id, equipment_resource_id,
              service_start, service_end, operational_start, operational_end,
              service_duration_minutes, required_equipment_capability_code,
              scheduling_policy_code, scheduling_policy_version,
              working_hour_policy_id, working_hour_policy_code,
              working_hour_policy_version, travel_time_profile_id,
              travel_time_profile_code, travel_time_profile_version,
              duration_snapshot, location_snapshot, requirements_snapshot,
              availability_input_snapshot, availability_result_snapshot,
              travel_snapshot, working_hours_snapshot, equipment_snapshot
            ) values (
              gen_random_uuid(), 1, 103, 203,
              '2026-09-08 13:00:00+03', '2026-09-08 15:00:00+03',
              '2026-09-08 12:30:00+03', '2026-09-08 15:30:00+03',
              120, 'PORTABLE_EXTRACTION', 'PHASE3G_PROBE', 1,
              1, 'PHASE3G_PROBE', 1, 1, 'PHASE3G_PROBE', 1,
              '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
              '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb
            );
            raise exception 'same-equipment overlap was accepted';
          exception when exclusion_violation then
            null;
          end;

          insert into phase3g_occupancy_probe (
            booking_id, snapshot_version, team_id, equipment_resource_id,
            service_start, service_end, operational_start, operational_end,
            service_duration_minutes, required_equipment_capability_code,
            scheduling_policy_code, scheduling_policy_version,
            working_hour_policy_id, working_hour_policy_code,
            working_hour_policy_version, travel_time_profile_id,
            travel_time_profile_code, travel_time_profile_version,
            duration_snapshot, location_snapshot, requirements_snapshot,
            availability_input_snapshot, availability_result_snapshot,
            travel_snapshot, working_hours_snapshot, equipment_snapshot
          ) values (
            gen_random_uuid(), 1, 104, 204,
            '2026-09-08 08:00:00+03', '2026-09-08 10:00:00+03',
            '2026-09-08 07:30:00+03', '2026-09-08 10:30:00+03',
            120, 'PORTABLE_EXTRACTION', 'PHASE3G_PROBE', 1,
            1, 'PHASE3G_PROBE', 1, 1, 'PHASE3G_PROBE', 1,
            '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
            '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb
          );

          insert into phase3g_occupancy_probe (
            booking_id, snapshot_version, team_id, equipment_resource_id,
            service_start, service_end, operational_start, operational_end,
            service_duration_minutes, required_equipment_capability_code,
            scheduling_policy_code, scheduling_policy_version,
            working_hour_policy_id, working_hour_policy_code,
            working_hour_policy_version, travel_time_profile_id,
            travel_time_profile_code, travel_time_profile_version,
            duration_snapshot, location_snapshot, requirements_snapshot,
            availability_input_snapshot, availability_result_snapshot,
            travel_snapshot, working_hours_snapshot, equipment_snapshot,
            status, cancelled_at
          ) values (
            gen_random_uuid(), 1, 105, 205,
            '2026-09-08 16:00:00+03', '2026-09-08 18:00:00+03',
            '2026-09-08 15:30:00+03', '2026-09-08 18:30:00+03',
            120, 'PORTABLE_EXTRACTION', 'PHASE3G_PROBE', 1,
            1, 'PHASE3G_PROBE', 1, 1, 'PHASE3G_PROBE', 1,
            '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
            '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
            'CANCELLED', clock_timestamp()
          );
          insert into phase3g_occupancy_probe (
            booking_id, snapshot_version, team_id, equipment_resource_id,
            service_start, service_end, operational_start, operational_end,
            service_duration_minutes, required_equipment_capability_code,
            scheduling_policy_code, scheduling_policy_version,
            working_hour_policy_id, working_hour_policy_code,
            working_hour_policy_version, travel_time_profile_id,
            travel_time_profile_code, travel_time_profile_version,
            duration_snapshot, location_snapshot, requirements_snapshot,
            availability_input_snapshot, availability_result_snapshot,
            travel_snapshot, working_hours_snapshot, equipment_snapshot
          ) values (
            gen_random_uuid(), 1, 106, 205,
            '2026-09-08 16:00:00+03', '2026-09-08 18:00:00+03',
            '2026-09-08 15:30:00+03', '2026-09-08 18:30:00+03',
            120, 'PORTABLE_EXTRACTION', 'PHASE3G_PROBE', 1,
            1, 'PHASE3G_PROBE', 1, 1, 'PHASE3G_PROBE', 1,
            '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
            '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb
          );

          select count(*) into final_count from phase3g_occupancy_probe;
          if final_count <> 5 then
            raise exception 'occupancy probe expected 5 rows, found %', final_count;
          end if;
        end
        $phase3g$;
      `);
    });

    it("parses and executes the locked confirmation statement without durable fixtures", async () => {
      loadMigrationEnvironment();
      assertDevelopmentDatabaseMutationTarget();
      const serviceStart = new Date("2026-09-08T05:00:00.000Z");
      const serviceEnd = new Date("2026-09-08T06:00:00.000Z");
      const candidate: ScheduleCandidate = {
        key: "a".repeat(64),
        rank: 1,
        teamId: 2_147_483_647,
        teamCode: "TEAM_A",
        teamName: "Synthetic unavailable team",
        equipmentResourceId: null,
        equipmentLabel: null,
        workDate: "2026-09-08",
        serviceStart,
        serviceEnd,
        operationalStart: serviceStart,
        operationalEnd: serviceEnd,
        serviceDurationMinutes: 60,
        travelBeforeMinutes: 0,
        travelAfterMinutes: 0,
        travelMinutes: 0,
        bufferMinutes: 0,
        parkingBufferMinutes: 0,
        readiness: "READY",
        selectable: true,
        fallbackTravelUsed: false,
        manualReviewRequired: false,
        warnings: [],
        preferredWindowMatch: true,
        additionalTravelMinutes: 0,
        nearbyWorkContinuity: false,
        occupiedWorkloadMinutes: 0,
        previousOccupancyId: null,
        nextOccupancyId: null,
      };

      await expect(
        executeScheduleConfirmationCandidate(
          getDatabase(),
          "ffffffff-ffff-4fff-8fff-ffffffffffff",
          {
            bookingReference: `BKG-${"F".repeat(24)}`,
            expectedBookingVersion: 1,
            workDate: "2026-09-08",
            candidateKey: candidate.key,
            expectedOccupancySnapshotVersion: null,
            reasonCategory: null,
            reasonText: null,
          },
          candidate,
        ),
      ).resolves.toEqual({ status: "NOT_FOUND_OR_FORBIDDEN" });
    });

    it(
      "serializes competing dispatchers and preserves a consistent reschedule/cancel race",
      async () => {
        loadMigrationEnvironment();
        assertDevelopmentDatabaseMutationTarget();
        const query = neon(getDatabaseUrl());
        let fixture: SchedulingFixture | null = null;
        try {
          fixture = await createSchedulingFixture(query);
          const database = getDatabase();
          const preview = await previewBookingScheduleRecord(
            database,
            fixture.profileId,
            {
              bookingReference: fixture.bookingReference,
              workDate: fixture.workDate,
            },
          );
          const candidate = preview?.candidates.find((item) => item.selectable);
          expect(candidate).toBeDefined();

          const initialCommand = {
            bookingReference: fixture.bookingReference,
            expectedBookingVersion: 1,
            workDate: fixture.workDate,
            candidateKey: candidate!.key,
            expectedOccupancySnapshotVersion: null,
            reasonCategory: null,
            reasonText: null,
          } as const;
          const initialResults = await Promise.all([
            executeScheduleConfirmationCandidate(
              database,
              fixture.profileId,
              initialCommand,
              candidate!,
            ),
            executeScheduleConfirmationCandidate(
              database,
              fixture.profileId,
              initialCommand,
              candidate!,
            ),
          ]);
          expect(initialResults.map((result) => result.status).sort()).toEqual([
            "SCHEDULED",
            "STALE",
          ]);

          const scheduledState = (await query.query(`
            select booking.version, booking.scheduled_start,
              occupancy.snapshot_version as occupancy_snapshot_version,
              (select count(*) from public.booking_occupancies candidate
                where candidate.booking_id = booking.id
                  and candidate.status in ('PENDING', 'CONFIRMED'))::integer
                as active_occupancy_count,
              (select count(*) from public.booking_audit_events audit
                where audit.booking_id = booking.id)::integer
                as audit_event_count
            from public.bookings booking
            join public.booking_occupancies occupancy
              on occupancy.booking_id = booking.id
             and occupancy.status in ('PENDING', 'CONFIRMED')
            where booking.id = $1::uuid
          `, [fixture.bookingId])) as Array<{
            version: number;
            scheduled_start: string | Date;
            occupancy_snapshot_version: number;
            active_occupancy_count: number;
            audit_event_count: number;
          }>;
          expect(scheduledState).toHaveLength(1);
          expect(scheduledState[0]).toMatchObject({
            version: 2,
            occupancy_snapshot_version: 1,
            active_occupancy_count: 1,
            audit_event_count: 3,
          });

          const reschedulePreview = await previewBookingScheduleRecord(
            database,
            fixture.profileId,
            {
              bookingReference: fixture.bookingReference,
              workDate: fixture.workDate,
            },
          );
          const scheduledStart = new Date(
            scheduledState[0]!.scheduled_start,
          ).valueOf();
          const rescheduleCandidate = reschedulePreview?.candidates.find(
            (item) => item.selectable &&
              item.serviceStart.valueOf() !== scheduledStart,
          );
          expect(rescheduleCandidate).toBeDefined();

          const [rescheduleResult, cancellationResult] = await Promise.all([
            executeScheduleConfirmationCandidate(
              database,
              fixture.profileId,
              {
                bookingReference: fixture.bookingReference,
                expectedBookingVersion: 2,
                workDate: fixture.workDate,
                candidateKey: rescheduleCandidate!.key,
                expectedOccupancySnapshotVersion: 1,
                reasonCategory: "OPERATIONAL",
                reasonText: "Synthetic Phase 3G concurrency verification",
              },
              rescheduleCandidate!,
            ),
            cancelBookingRecord(database, fixture.profileId, {
              bookingReference: fixture.bookingReference,
              expectedVersion: 2,
              reasonCategory: "OPERATIONAL",
              reasonText: "Synthetic Phase 3G concurrency verification",
            }),
          ]);
          expect([
            ["RESCHEDULED", "CONFLICT"],
            ["STALE", "CANCELLED"],
          ]).toContainEqual([
            rescheduleResult.status,
            cancellationResult.status,
          ]);

          const finalState = (await query.query(`
            select booking.status, booking.version,
              (select count(*) from public.booking_occupancies occupancy
                where occupancy.booking_id = booking.id)::integer
                as occupancy_count,
              (select count(*) from public.booking_occupancies occupancy
                where occupancy.booking_id = booking.id
                  and occupancy.status in ('PENDING', 'CONFIRMED'))::integer
                as active_occupancy_count,
              (select count(*) from public.booking_occupancies occupancy
                where occupancy.booking_id = booking.id
                  and occupancy.revision_kind = 'RESCHEDULE'
                  and occupancy.previous_occupancy_id is not null)::integer
                as linked_revision_count,
              (select count(*) from public.booking_audit_events audit
                where audit.booking_id = booking.id)::integer
                as audit_event_count
            from public.bookings booking
            where booking.id = $1::uuid
          `, [fixture.bookingId])) as Array<{
            status: "CONFIRMED" | "CANCELLED";
            version: number;
            occupancy_count: number;
            active_occupancy_count: number;
            linked_revision_count: number;
            audit_event_count: number;
          }>;
          expect(finalState).toHaveLength(1);
          if (finalState[0]!.status === "CONFIRMED") {
            expect(finalState[0]).toMatchObject({
              version: 3,
              occupancy_count: 2,
              active_occupancy_count: 1,
              linked_revision_count: 1,
              audit_event_count: 7,
            });
          } else {
            expect(finalState[0]).toMatchObject({
              version: 3,
              occupancy_count: 1,
              active_occupancy_count: 0,
              linked_revision_count: 0,
              audit_event_count: 4,
            });
          }
        } finally {
          if (fixture) await cleanupSchedulingFixture(query, fixture);
        }
      },
      30_000,
    );
  },
);
