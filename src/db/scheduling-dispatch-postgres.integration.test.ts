import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";
import { getDatabaseUrl } from "@/lib/environment";
import {
  assertDevelopmentDatabaseMutationTarget,
  loadMigrationEnvironment,
} from "./migration-environment";

const runLiveIntegration =
  process.env.RUN_PHASE3G_DATABASE_INTEGRATION === "1";

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
  },
);
