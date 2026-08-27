-- PostgreSQL row-locking clauses require UPDATE authority even when the query
-- never changes a row. These tables are locked by existing VAX repositories
-- but remain read-only to ordinary runtime DML.
DO $phase3k_lock_preflight$
BEGIN
  IF current_user <> 'vax_migrator' THEN
    RAISE EXCEPTION 'Phase 3K locking migration requires vax_migrator';
  END IF;
END
$phase3k_lock_preflight$;
--> statement-breakpoint

DO $phase3k_locking$
DECLARE
  lock_policy record;
BEGIN
  FOR lock_policy IN
    SELECT * FROM (VALUES
      ('appointment_window_definitions', 'id'),
      ('business_legal_profiles', 'id'),
      ('capability_statuses', 'id'),
      ('cleaning_item_type_measurement_modes', 'item_type_id'),
      ('cleaning_item_types', 'id'),
      ('condition_levels', 'id'),
      ('customer_billing_profiles', 'id'),
      ('equipment_resources', 'id'),
      ('fibre_materials', 'id'),
      ('invoice_policies', 'id'),
      ('issue_types', 'id'),
      ('measurement_modes', 'id'),
      ('operations_teams', 'id'),
      ('quote_acceptances', 'id'),
      ('quote_items', 'id'),
      ('request_estimates', 'id'),
      ('service_addon_capabilities', 'service_id'),
      ('service_addons', 'id'),
      ('service_item_capabilities', 'service_id'),
      ('services', 'id'),
      ('surface_constructions', 'id'),
      ('team_capabilities', 'id'),
      ('team_equipment_assignments', 'id'),
      ('travel_time_matrix_rules', 'id'),
      ('travel_time_profiles', 'id'),
      ('travel_zones', 'id'),
      ('working_hour_policies', 'id'),
      ('working_hour_rules', 'id')
    ) AS policy(table_name, column_name)
  LOOP
    EXECUTE format(
      'GRANT UPDATE (%I) ON TABLE public.%I TO vax_runtime',
      lock_policy.column_name,
      lock_policy.table_name
    );
    EXECUTE format(
      'CREATE POLICY vax_runtime_lock ON public.%I FOR UPDATE TO vax_runtime USING (true) WITH CHECK (false)',
      lock_policy.table_name
    );
  END LOOP;
END
$phase3k_locking$;
