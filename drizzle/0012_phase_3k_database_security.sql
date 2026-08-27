-- Phase 3K requires the separately reviewed database-role provisioning step
-- before this migration. That step creates vax_migrator/vax_runtime and makes
-- vax_migrator the owner of VAX objects without touching provider schemas.
DO $phase3k_preflight$
BEGIN
  IF to_regrole('vax_migrator') IS NULL
     OR to_regrole('vax_runtime') IS NULL THEN
    RAISE EXCEPTION 'Phase 3K database roles are not provisioned';
  END IF;
  IF current_user <> 'vax_migrator' THEN
    RAISE EXCEPTION 'Phase 3K migration requires vax_migrator';
  END IF;
END
$phase3k_preflight$;
--> statement-breakpoint

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. VAX trigger
-- functions are not application APIs: trigger execution does not require a
-- direct EXECUTE grant to the row-changing runtime role.
DO $phase3k_functions$
DECLARE
  function_name text;
BEGIN
  FOREACH function_name IN ARRAY ARRAY[
    'vax_communications_guard_append_only',
    'vax_communications_guard_document',
    'vax_communications_guard_intent',
    'vax_communications_guard_template',
    'vax_communications_validate_delivery_graph',
    'vax_finance_guard_append_ledger',
    'vax_finance_guard_invoice',
    'vax_finance_guard_numbering_policy',
    'vax_finance_guard_payment',
    'vax_finance_guard_versioned_config',
    'vax_finance_require_operation_actor',
    'vax_finance_validate_allocation_audit',
    'vax_finance_validate_audit_graph',
    'vax_finance_validate_invoice_audit',
    'vax_finance_validate_invoice_item',
    'vax_finance_validate_invoice_number_allocation',
    'vax_finance_validate_number_allocation',
    'vax_finance_validate_payment_audit',
    'vax_finance_validate_settlement'
  ] LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON FUNCTION public.%I() FROM PUBLIC, vax_runtime',
      function_name
    );
    IF to_regrole('authenticated') IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION public.%I() FROM authenticated',
        function_name
      );
    END IF;
    IF to_regrole('anonymous') IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION public.%I() FROM anonymous',
        function_name
      );
    END IF;
  END LOOP;
END
$phase3k_functions$;
--> statement-breakpoint

-- Each row is the reviewed runtime DML contract for one VAX-owned table.
-- RLS is intentionally role/command scoped in Phase 3K. The server still
-- performs application authorization and customer/team filtering; no claim is
-- made that the current Neon HTTP request path supplies safe actor-row context.
DO $phase3k_tables$
DECLARE
  table_policy record;
BEGIN
  FOR table_policy IN
    SELECT * FROM (VALUES
      ('application_roles', true, false, false, false),
      ('appointment_window_definitions', true, false, false, false),
      ('auth_audit_events', true, true, false, false),
      ('booking_audit_events', true, true, false, false),
      ('booking_items', true, true, false, false),
      ('booking_occupancies', true, true, true, false),
      ('bookings', true, true, true, false),
      ('business_audit_events', true, true, false, false),
      ('business_legal_profiles', true, false, false, false),
      ('capability_statuses', true, false, false, false),
      ('cleaning_asset_reported_issues', true, true, false, false),
      ('cleaning_asset_reported_risk_flags', true, true, false, false),
      ('cleaning_assets', true, true, true, false),
      ('cleaning_item_type_measurement_modes', true, false, false, false),
      ('cleaning_item_types', true, false, false, false),
      ('cleaning_passport_entries', true, true, false, false),
      ('cleaning_product_categories', true, false, false, false),
      ('cleaning_products', true, false, false, false),
      ('commercial_condition_bands', true, false, false, false),
      ('communication_audit_events', false, true, false, false),
      ('communication_intents', true, true, false, false),
      ('communication_templates', true, false, false, false),
      ('condition_levels', true, false, false, false),
      ('customer_billing_profiles', true, false, false, false),
      ('customer_communication_history_entries', true, true, false, false),
      ('customer_communication_preferences', true, true, true, false),
      ('customer_contacts', true, true, true, false),
      ('customer_identity_links', true, true, true, false),
      ('customers', true, true, true, false),
      ('delivery_attempts', false, true, false, false),
      ('delivery_results', true, true, false, false),
      ('documents', true, true, false, false),
      ('duration_models', true, false, false, false),
      ('duration_rules', true, false, false, false),
      ('equipment_resources', true, false, false, false),
      ('fibre_materials', true, false, false, false),
      ('finance_audit_events', true, true, false, false),
      ('invoice_items', true, true, false, false),
      ('invoice_numbering_policies', true, false, true, false),
      ('invoice_policies', true, false, false, false),
      ('invoices', true, true, true, false),
      ('issue_handling_classifications', true, false, false, false),
      ('issue_types', true, false, false, false),
      ('job_audit_events', true, true, false, false),
      ('job_item_inspection_issues', true, true, false, false),
      ('job_item_inspection_risks', true, true, false, false),
      ('job_item_inspections', true, true, false, false),
      ('job_item_treatment_executions', true, true, true, false),
      ('job_item_treatment_plan_addons', true, true, false, false),
      ('job_item_treatment_plans', true, true, false, false),
      ('job_items', true, true, true, false),
      ('jobs', true, true, true, false),
      ('material_treatment_considerations', true, false, false, false),
      ('measurement_modes', true, false, false, false),
      ('mechanical_action_levels', true, false, false, false),
      ('operations_teams', true, false, false, false),
      ('parking_policies', true, false, false, false),
      ('payment_allocations', true, true, false, false),
      ('payment_reversals', true, true, false, false),
      ('payments', true, true, true, false),
      ('permissions', true, false, false, false),
      ('price_books', true, false, false, false),
      ('price_rules', true, false, false, false),
      ('properties', true, true, true, false),
      ('property_areas', true, true, true, false),
      ('quote_acceptances', true, true, false, false),
      ('quote_items', true, true, false, true),
      ('quotes', true, true, true, false),
      ('request_estimates', true, true, false, false),
      ('reuse_advisory_categories', true, false, false, false),
      ('risk_flags', true, false, false, false),
      ('role_permissions', true, false, false, false),
      ('service_addon_capabilities', true, false, false, false),
      ('service_addons', true, false, false, false),
      ('service_categories', true, false, false, false),
      ('service_item_capabilities', true, false, false, false),
      ('service_request_item_addons', true, true, true, true),
      ('service_request_item_issues', true, true, true, true),
      ('service_request_items', true, true, true, false),
      ('service_requests', true, true, true, false),
      ('service_treatment_levels', true, false, false, false),
      ('services', true, false, false, false),
      ('surface_constructions', true, false, false, false),
      ('system_metadata', false, false, false, false),
      ('team_capabilities', true, false, false, false),
      ('team_equipment_assignments', true, false, false, false),
      ('team_memberships', true, false, false, false),
      ('timing_categories', true, false, false, false),
      ('travel_time_matrix_rules', true, false, false, false),
      ('travel_time_profiles', true, false, false, false),
      ('travel_zones', true, false, false, false),
      ('treatment_approaches', true, false, false, false),
      ('treatment_levels', true, false, false, false),
      ('user_profiles', true, true, true, false),
      ('user_roles', true, true, true, false),
      ('working_hour_policies', true, false, false, false),
      ('working_hour_rules', true, false, false, false)
    ) AS policy(
      table_name,
      allow_select,
      allow_insert,
      allow_update,
      allow_delete
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, vax_runtime',
      table_policy.table_name
    );
    IF to_regrole('authenticated') IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM authenticated',
        table_policy.table_name
      );
    END IF;
    IF to_regrole('anonymous') IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anonymous',
        table_policy.table_name
      );
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      table_policy.table_name
    );

    IF table_policy.allow_select THEN
      EXECUTE format(
        'GRANT SELECT ON TABLE public.%I TO vax_runtime',
        table_policy.table_name
      );
      EXECUTE format(
        'CREATE POLICY vax_runtime_select ON public.%I FOR SELECT TO vax_runtime USING (true)',
        table_policy.table_name
      );
    END IF;
    IF table_policy.allow_insert THEN
      EXECUTE format(
        'GRANT INSERT ON TABLE public.%I TO vax_runtime',
        table_policy.table_name
      );
      EXECUTE format(
        'CREATE POLICY vax_runtime_insert ON public.%I FOR INSERT TO vax_runtime WITH CHECK (true)',
        table_policy.table_name
      );
    END IF;
    IF table_policy.allow_update THEN
      EXECUTE format(
        'GRANT UPDATE ON TABLE public.%I TO vax_runtime',
        table_policy.table_name
      );
      EXECUTE format(
        'CREATE POLICY vax_runtime_update ON public.%I FOR UPDATE TO vax_runtime USING (true) WITH CHECK (true)',
        table_policy.table_name
      );
    END IF;
    IF table_policy.allow_delete THEN
      EXECUTE format(
        'GRANT DELETE ON TABLE public.%I TO vax_runtime',
        table_policy.table_name
      );
      EXECUTE format(
        'CREATE POLICY vax_runtime_delete ON public.%I FOR DELETE TO vax_runtime USING (true)',
        table_policy.table_name
      );
    END IF;
  END LOOP;
END
$phase3k_tables$;
--> statement-breakpoint

-- The runtime does not insert into identity-backed integer configuration
-- tables, so no public sequence capability is required.
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
  FROM PUBLIC, vax_runtime;
--> statement-breakpoint

-- Future VAX objects are deny-by-default. A later reviewed migration must add
-- its own exact runtime grants and policies when it introduces a runtime path.
ALTER DEFAULT PRIVILEGES FOR ROLE vax_migrator
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE vax_migrator IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, vax_runtime;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE vax_migrator IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, vax_runtime;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE vax_migrator IN SCHEMA public
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM vax_runtime;
--> statement-breakpoint

DO $phase3k_data_api_defaults$
BEGIN
  IF to_regrole('authenticated') IS NOT NULL THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE vax_migrator IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE vax_migrator IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE vax_migrator IN SCHEMA public REVOKE ALL PRIVILEGES ON FUNCTIONS FROM authenticated';
  END IF;
  IF to_regrole('anonymous') IS NOT NULL THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE vax_migrator IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM anonymous';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE vax_migrator IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM anonymous';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE vax_migrator IN SCHEMA public REVOKE ALL PRIVILEGES ON FUNCTIONS FROM anonymous';
  END IF;
END
$phase3k_data_api_defaults$;
