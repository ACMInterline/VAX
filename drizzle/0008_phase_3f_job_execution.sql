CREATE TABLE "cleaning_passport_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cleaning_asset_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"job_item_id" uuid NOT NULL,
	"treatment_execution_id" uuid NOT NULL,
	"source_execution_status" varchar(16) NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"observed_condition_level_id" integer NOT NULL,
	"treatment_level_id" integer NOT NULL,
	"mechanical_action_level_id" integer NOT NULL,
	"treatment_approach_id" integer NOT NULL,
	"result_classification" varchar(40) NOT NULL,
	"customer_visible_service_summary" text NOT NULL,
	"customer_visible_condition_summary" text NOT NULL,
	"customer_visible_treatment_summary" text NOT NULL,
	"customer_visible_care_recommendation" text,
	"issues_treated_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"risks_noted_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"customer_safe_snapshot" jsonb NOT NULL,
	"recommended_review_date" date,
	"suggested_interval_months" integer,
	"maintenance_recommendation_reason" text,
	"maintenance_recommendation_source_type" varchar(32),
	"performed_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cleaning_passport_entries_result_valid" CHECK ("cleaning_passport_entries"."result_classification" in ('COMPLETED_AS_PLANNED', 'COMPLETED_WITH_LIMITATIONS', 'PARTIAL_IMPROVEMENT')),
	CONSTRAINT "cleaning_passport_entries_source_execution_completed" CHECK ("cleaning_passport_entries"."source_execution_status" = 'COMPLETED'),
	CONSTRAINT "cleaning_passport_entries_summaries_not_blank" CHECK (length(trim("cleaning_passport_entries"."customer_visible_service_summary")) > 0 and length(trim("cleaning_passport_entries"."customer_visible_condition_summary")) > 0 and length(trim("cleaning_passport_entries"."customer_visible_treatment_summary")) > 0 and ("cleaning_passport_entries"."customer_visible_care_recommendation" is null or length(trim("cleaning_passport_entries"."customer_visible_care_recommendation")) > 0)),
	CONSTRAINT "cleaning_passport_entries_maintenance_consistent" CHECK (("cleaning_passport_entries"."recommended_review_date" is null and "cleaning_passport_entries"."suggested_interval_months" is null and "cleaning_passport_entries"."maintenance_recommendation_reason" is null and "cleaning_passport_entries"."maintenance_recommendation_source_type" is null) or (("cleaning_passport_entries"."recommended_review_date" is not null or "cleaning_passport_entries"."suggested_interval_months" is not null) and "cleaning_passport_entries"."maintenance_recommendation_reason" is not null and length(trim("cleaning_passport_entries"."maintenance_recommendation_reason")) > 0 and "cleaning_passport_entries"."maintenance_recommendation_source_type" in ('TECHNICIAN_ASSESSMENT', 'CATALOGUE_EVIDENCE'))),
	CONSTRAINT "cleaning_passport_entries_interval_positive" CHECK ("cleaning_passport_entries"."suggested_interval_months" is null or "cleaning_passport_entries"."suggested_interval_months" > 0)
);
--> statement-breakpoint
CREATE TABLE "job_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"job_item_id" uuid,
	"event_type" varchar(64) NOT NULL,
	"actor_profile_id" uuid,
	"source" varchar(24) NOT NULL,
	"previous_status" varchar(32),
	"next_status" varchar(32),
	"correlation_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"safe_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_audit_events_type_valid" CHECK ("job_audit_events"."event_type" in ('JOB_CREATED', 'TEAM_ASSIGNED', 'JOB_READY', 'EN_ROUTE', 'ARRIVED', 'WORK_STARTED', 'INSPECTION_COMPLETED', 'TREATMENT_CONFIRMED', 'TREATMENT_STARTED', 'TREATMENT_COMPLETED', 'ITEM_DECLINED', 'ITEM_REFERRED', 'REQUIRES_REVIEW', 'JOB_COMPLETED', 'PASSPORT_ENTRY_CREATED', 'JOB_CANCELLED')),
	CONSTRAINT "job_audit_events_source_valid" CHECK ("job_audit_events"."source" in ('STAFF', 'TECHNICIAN', 'SYSTEM')),
	CONSTRAINT "job_audit_events_status_not_blank" CHECK (("job_audit_events"."previous_status" is null or length(trim("job_audit_events"."previous_status")) > 0) and ("job_audit_events"."next_status" is null or length(trim("job_audit_events"."next_status")) > 0))
);
--> statement-breakpoint
CREATE TABLE "job_item_inspection_issues" (
	"inspection_id" uuid NOT NULL,
	"job_item_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"issue_type_id" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_item_inspection_issues_inspection_id_issue_type_id_pk" PRIMARY KEY("inspection_id","issue_type_id"),
	CONSTRAINT "job_item_inspection_issues_notes_not_blank" CHECK ("job_item_inspection_issues"."notes" is null or length(trim("job_item_inspection_issues"."notes")) > 0)
);
--> statement-breakpoint
CREATE TABLE "job_item_inspection_risks" (
	"inspection_id" uuid NOT NULL,
	"job_item_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"risk_flag_id" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_item_inspection_risks_inspection_id_risk_flag_id_pk" PRIMARY KEY("inspection_id","risk_flag_id"),
	CONSTRAINT "job_item_inspection_risks_notes_not_blank" CHECK ("job_item_inspection_risks"."notes" is null or length(trim("job_item_inspection_risks"."notes")) > 0)
);
--> statement-breakpoint
CREATE TABLE "job_item_inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"job_item_id" uuid NOT NULL,
	"source_job_item_version" integer NOT NULL,
	"observed_cleaning_item_type_id" integer NOT NULL,
	"observed_measurement_mode_id" integer NOT NULL,
	"observed_quantity" integer NOT NULL,
	"observed_area_hundredths_m2" integer,
	"observed_seat_count" integer,
	"observed_sides" integer,
	"observed_condition_level_id" integer NOT NULL,
	"confirmed_fibre_material_id" integer NOT NULL,
	"confirmed_surface_construction_id" integer NOT NULL,
	"observed_measurement_snapshot" jsonb NOT NULL,
	"existing_damage_present" boolean DEFAULT false NOT NULL,
	"existing_damage_notes" text,
	"colourfastness_concern" boolean DEFAULT false NOT NULL,
	"moisture_sensitivity" boolean DEFAULT false NOT NULL,
	"unsafe_contamination_observed" boolean DEFAULT false NOT NULL,
	"unsafe_structural_condition_observed" boolean DEFAULT false NOT NULL,
	"treatment_feasibility" varchar(32) NOT NULL,
	"internal_technician_notes" text,
	"inspected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"inspected_by_profile_id" uuid,
	CONSTRAINT "job_item_inspections_source_version_positive" CHECK ("job_item_inspections"."source_job_item_version" >= 1),
	CONSTRAINT "job_item_inspections_measurements_valid" CHECK ("job_item_inspections"."observed_quantity" > 0 and ("job_item_inspections"."observed_area_hundredths_m2" is null or "job_item_inspections"."observed_area_hundredths_m2" > 0) and ("job_item_inspections"."observed_seat_count" is null or "job_item_inspections"."observed_seat_count" > 0) and ("job_item_inspections"."observed_sides" is null or "job_item_inspections"."observed_sides" in (1, 2))),
	CONSTRAINT "job_item_inspections_feasibility_valid" CHECK ("job_item_inspections"."treatment_feasibility" in ('FEASIBLE', 'CONDITIONAL', 'NOT_FEASIBLE', 'SPECIALIST_REVIEW')),
	CONSTRAINT "job_item_inspections_damage_consistent" CHECK (("job_item_inspections"."existing_damage_present" = true and "job_item_inspections"."existing_damage_notes" is not null and length(trim("job_item_inspections"."existing_damage_notes")) > 0) or ("job_item_inspections"."existing_damage_present" = false and "job_item_inspections"."existing_damage_notes" is null)),
	CONSTRAINT "job_item_inspections_unsafe_not_feasible" CHECK (("job_item_inspections"."unsafe_contamination_observed" = false and "job_item_inspections"."unsafe_structural_condition_observed" = false) or "job_item_inspections"."treatment_feasibility" = 'NOT_FEASIBLE'),
	CONSTRAINT "job_item_inspections_notes_not_blank" CHECK ("job_item_inspections"."internal_technician_notes" is null or length(trim("job_item_inspections"."internal_technician_notes")) > 0)
);
--> statement-breakpoint
CREATE TABLE "job_item_treatment_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"job_item_id" uuid NOT NULL,
	"treatment_plan_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'IN_PROGRESS' NOT NULL,
	"performed_treatment_level_id" integer NOT NULL,
	"performed_mechanical_action_level_id" integer NOT NULL,
	"performed_treatment_approach_id" integer NOT NULL,
	"cleaning_product_id" integer,
	"performed_addons_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_classification" varchar(40),
	"internal_technician_notes" text,
	"customer_visible_result_notes" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"performed_by_profile_id" uuid,
	"completed_by_profile_id" uuid,
	"completion_snapshot" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_item_treatment_executions_status_valid" CHECK ("job_item_treatment_executions"."status" in ('IN_PROGRESS', 'COMPLETED')),
	CONSTRAINT "job_item_treatment_executions_result_valid" CHECK ("job_item_treatment_executions"."result_classification" is null or "job_item_treatment_executions"."result_classification" in ('COMPLETED_AS_PLANNED', 'COMPLETED_WITH_LIMITATIONS', 'PARTIAL_IMPROVEMENT', 'NO_OBSERVABLE_IMPROVEMENT', 'STOPPED_FOR_SAFETY')),
	CONSTRAINT "job_item_treatment_executions_completion_consistent" CHECK (("job_item_treatment_executions"."status" = 'IN_PROGRESS' and "job_item_treatment_executions"."completed_at" is null and "job_item_treatment_executions"."completed_by_profile_id" is null and "job_item_treatment_executions"."result_classification" is null and "job_item_treatment_executions"."customer_visible_result_notes" is null and "job_item_treatment_executions"."completion_snapshot" is null) or ("job_item_treatment_executions"."status" = 'COMPLETED' and "job_item_treatment_executions"."completed_at" is not null and "job_item_treatment_executions"."completed_at" >= "job_item_treatment_executions"."started_at" and "job_item_treatment_executions"."result_classification" is not null and "job_item_treatment_executions"."completion_snapshot" is not null)),
	CONSTRAINT "job_item_treatment_executions_version_positive" CHECK ("job_item_treatment_executions"."version" >= 1),
	CONSTRAINT "job_item_treatment_executions_notes_not_blank" CHECK (("job_item_treatment_executions"."internal_technician_notes" is null or length(trim("job_item_treatment_executions"."internal_technician_notes")) > 0) and ("job_item_treatment_executions"."customer_visible_result_notes" is null or length(trim("job_item_treatment_executions"."customer_visible_result_notes")) > 0))
);
--> statement-breakpoint
CREATE TABLE "job_item_treatment_plan_addons" (
	"treatment_plan_id" uuid NOT NULL,
	"job_item_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"service_addon_id" integer NOT NULL,
	"approval_source" varchar(24) DEFAULT 'ISSUED_QUOTE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_item_treatment_plan_addons_treatment_plan_id_service_addon_id_pk" PRIMARY KEY("treatment_plan_id","service_addon_id"),
	CONSTRAINT "job_item_treatment_plan_addons_source_valid" CHECK ("job_item_treatment_plan_addons"."approval_source" = 'ISSUED_QUOTE')
);
--> statement-breakpoint
CREATE TABLE "job_item_treatment_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"job_item_id" uuid NOT NULL,
	"inspection_id" uuid NOT NULL,
	"source_job_item_version" integer NOT NULL,
	"decision" varchar(32) NOT NULL,
	"treatment_level_id" integer,
	"mechanical_action_level_id" integer,
	"treatment_approach_id" integer,
	"cleaning_product_id" integer,
	"material_scope_change" boolean DEFAULT false NOT NULL,
	"technician_rationale" text NOT NULL,
	"internal_technician_notes" text,
	"customer_visible_explanation" text,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_by_profile_id" uuid,
	CONSTRAINT "job_item_treatment_plans_source_version_positive" CHECK ("job_item_treatment_plans"."source_job_item_version" >= 1),
	CONSTRAINT "job_item_treatment_plans_decision_valid" CHECK ("job_item_treatment_plans"."decision" in ('PERFORM', 'PERFORM_WITH_LIMITATIONS', 'DECLINE', 'REFER', 'REQUIRES_REVIEW')),
	CONSTRAINT "job_item_treatment_plans_technical_fields_consistent" CHECK (("job_item_treatment_plans"."decision" in ('PERFORM', 'PERFORM_WITH_LIMITATIONS') and "job_item_treatment_plans"."treatment_level_id" is not null and "job_item_treatment_plans"."mechanical_action_level_id" is not null and "job_item_treatment_plans"."treatment_approach_id" is not null) or ("job_item_treatment_plans"."decision" in ('DECLINE', 'REFER', 'REQUIRES_REVIEW') and "job_item_treatment_plans"."treatment_level_id" is null and "job_item_treatment_plans"."mechanical_action_level_id" is null and "job_item_treatment_plans"."treatment_approach_id" is null and "job_item_treatment_plans"."cleaning_product_id" is null)),
	CONSTRAINT "job_item_treatment_plans_material_change_review" CHECK ("job_item_treatment_plans"."material_scope_change" = false or "job_item_treatment_plans"."decision" = 'REQUIRES_REVIEW'),
	CONSTRAINT "job_item_treatment_plans_text_not_blank" CHECK (length(trim("job_item_treatment_plans"."technician_rationale")) > 0 and ("job_item_treatment_plans"."internal_technician_notes" is null or length(trim("job_item_treatment_plans"."internal_technician_notes")) > 0) and ("job_item_treatment_plans"."customer_visible_explanation" is null or length(trim("job_item_treatment_plans"."customer_visible_explanation")) > 0))
);
--> statement-breakpoint
CREATE TABLE "job_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"booking_item_id" uuid NOT NULL,
	"source_request_item_id" uuid NOT NULL,
	"source_request_item_version" integer NOT NULL,
	"cleaning_asset_id" uuid,
	"service_id" integer NOT NULL,
	"cleaning_item_type_id" integer NOT NULL,
	"measurement_mode_id" integer NOT NULL,
	"customer_reported_condition_level_id" integer,
	"staff_normalized_condition_level_id" integer,
	"customer_reported_fibre_material_id" integer,
	"staff_normalized_fibre_material_id" integer,
	"customer_reported_surface_construction_id" integer,
	"staff_normalized_surface_construction_id" integer,
	"customer_visible_description_bg" text NOT NULL,
	"customer_visible_description_en" text NOT NULL,
	"customer_description_snapshot" text,
	"staff_normalized_description_snapshot" text,
	"quantity" integer NOT NULL,
	"area_hundredths_m2" integer,
	"seat_count" integer,
	"sides" integer,
	"planned_measurement_snapshot" jsonb NOT NULL,
	"planned_treatment_assumptions_snapshot" jsonb NOT NULL,
	"source_scope_snapshot" jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'PENDING_INSPECTION' NOT NULL,
	"sort_order" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_items_status_valid" CHECK ("job_items"."status" in ('PENDING_INSPECTION', 'INSPECTED', 'TREATMENT_CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'REFERRED', 'REQUIRES_REVIEW')),
	CONSTRAINT "job_items_versions_quantity_sort_valid" CHECK ("job_items"."source_request_item_version" >= 1 and "job_items"."quantity" > 0 and "job_items"."sort_order" >= 0 and "job_items"."version" >= 1 and ("job_items"."area_hundredths_m2" is null or "job_items"."area_hundredths_m2" > 0) and ("job_items"."seat_count" is null or "job_items"."seat_count" > 0) and ("job_items"."sides" is null or "job_items"."sides" in (1, 2))),
	CONSTRAINT "job_items_descriptions_not_blank" CHECK (length(trim("job_items"."customer_visible_description_bg")) > 0 and length(trim("job_items"."customer_visible_description_en")) > 0 and ("job_items"."customer_description_snapshot" is null or length(trim("job_items"."customer_description_snapshot")) > 0) and ("job_items"."staff_normalized_description_snapshot" is null or length(trim("job_items"."staff_normalized_description_snapshot")) > 0))
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_reference" varchar(40) NOT NULL,
	"booking_id" uuid NOT NULL,
	"source_booking_version" integer NOT NULL,
	"source_occupancy_id" uuid,
	"source_occupancy_snapshot_version" integer,
	"customer_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"assigned_team_id" integer,
	"assigned_equipment_resource_id" integer,
	"status" varchar(24) DEFAULT 'PREPARED' NOT NULL,
	"scheduled_start_snapshot" timestamp with time zone,
	"scheduled_end_snapshot" timestamp with time zone,
	"planned_service_duration_minutes" integer NOT NULL,
	"planned_team_size" integer,
	"source_provenance_snapshot" jsonb NOT NULL,
	"scheduling_snapshot" jsonb NOT NULL,
	"planned_duration_snapshot" jsonb NOT NULL,
	"property_access_snapshot" jsonb NOT NULL,
	"visit_contact_snapshot" jsonb,
	"en_route_at" timestamp with time zone,
	"arrived_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"actual_productive_minutes" integer,
	"actual_occupied_team_minutes" integer,
	"review_reason_code" varchar(64),
	"review_reason_text" text,
	"internal_completion_notes" text,
	"customer_visible_completion_notes" text,
	"completion_snapshot" jsonb,
	"cancellation_reason_category" varchar(32),
	"cancellation_reason_text" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	"updated_by_profile_id" uuid,
	"completed_by_profile_id" uuid,
	"cancelled_by_profile_id" uuid,
	CONSTRAINT "jobs_reference_valid" CHECK ("jobs"."job_reference" ~ '^JOB-[A-F0-9]{24}$'),
	CONSTRAINT "jobs_status_valid" CHECK ("jobs"."status" in ('PREPARED', 'READY', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'REQUIRES_REVIEW', 'COMPLETED', 'CANCELLED')),
	CONSTRAINT "jobs_versions_and_planning_positive" CHECK ("jobs"."source_booking_version" >= 1 and "jobs"."version" >= 1 and "jobs"."planned_service_duration_minutes" > 0 and ("jobs"."source_occupancy_snapshot_version" is null or "jobs"."source_occupancy_snapshot_version" >= 1) and ("jobs"."planned_team_size" is null or "jobs"."planned_team_size" > 0)),
	CONSTRAINT "jobs_schedule_snapshot_consistent" CHECK (("jobs"."scheduled_start_snapshot" is null and "jobs"."scheduled_end_snapshot" is null) or ("jobs"."scheduled_start_snapshot" is not null and "jobs"."scheduled_end_snapshot" is not null and "jobs"."scheduled_end_snapshot" > "jobs"."scheduled_start_snapshot")),
	CONSTRAINT "jobs_executable_context_present" CHECK ("jobs"."status" in ('PREPARED', 'REQUIRES_REVIEW', 'CANCELLED') or ("jobs"."source_occupancy_id" is not null and "jobs"."source_occupancy_snapshot_version" is not null and "jobs"."assigned_team_id" is not null and "jobs"."scheduled_start_snapshot" is not null and "jobs"."scheduled_end_snapshot" is not null)),
	CONSTRAINT "jobs_source_occupancy_fields_consistent" CHECK (("jobs"."source_occupancy_id" is null and "jobs"."source_occupancy_snapshot_version" is null) or ("jobs"."source_occupancy_id" is not null and "jobs"."source_occupancy_snapshot_version" is not null and "jobs"."assigned_team_id" is not null)),
	CONSTRAINT "jobs_equipment_requires_team" CHECK ("jobs"."assigned_equipment_resource_id" is null or "jobs"."assigned_team_id" is not null),
	CONSTRAINT "jobs_operational_timestamps_ordered" CHECK (("jobs"."arrived_at" is null or ("jobs"."en_route_at" is not null and "jobs"."arrived_at" >= "jobs"."en_route_at")) and ("jobs"."started_at" is null or ("jobs"."arrived_at" is not null and "jobs"."started_at" >= "jobs"."arrived_at")) and ("jobs"."completed_at" is null or ("jobs"."started_at" is not null and "jobs"."completed_at" >= "jobs"."started_at"))),
	CONSTRAINT "jobs_status_timestamps_consistent" CHECK (("jobs"."status" in ('PREPARED', 'READY') and "jobs"."en_route_at" is null and "jobs"."arrived_at" is null and "jobs"."started_at" is null and "jobs"."completed_at" is null and "jobs"."cancelled_at" is null) or ("jobs"."status" = 'EN_ROUTE' and "jobs"."en_route_at" is not null and "jobs"."arrived_at" is null and "jobs"."started_at" is null and "jobs"."completed_at" is null and "jobs"."cancelled_at" is null) or ("jobs"."status" = 'ARRIVED' and "jobs"."en_route_at" is not null and "jobs"."arrived_at" is not null and "jobs"."started_at" is null and "jobs"."completed_at" is null and "jobs"."cancelled_at" is null) or ("jobs"."status" = 'IN_PROGRESS' and "jobs"."en_route_at" is not null and "jobs"."arrived_at" is not null and "jobs"."started_at" is not null and "jobs"."completed_at" is null and "jobs"."cancelled_at" is null) or ("jobs"."status" = 'REQUIRES_REVIEW' and "jobs"."completed_at" is null and "jobs"."cancelled_at" is null) or ("jobs"."status" = 'COMPLETED' and "jobs"."en_route_at" is not null and "jobs"."arrived_at" is not null and "jobs"."started_at" is not null and "jobs"."completed_at" is not null and "jobs"."cancelled_at" is null) or ("jobs"."status" = 'CANCELLED' and "jobs"."started_at" is null and "jobs"."completed_at" is null and "jobs"."cancelled_at" is not null)),
	CONSTRAINT "jobs_review_reason_consistent" CHECK (("jobs"."status" = 'REQUIRES_REVIEW' and "jobs"."review_reason_code" is not null and length(trim("jobs"."review_reason_code")) > 0) or ("jobs"."status" <> 'REQUIRES_REVIEW' and "jobs"."review_reason_code" is null and "jobs"."review_reason_text" is null)),
	CONSTRAINT "jobs_completion_consistent" CHECK (("jobs"."status" = 'COMPLETED' and "jobs"."actual_productive_minutes" is not null and "jobs"."actual_occupied_team_minutes" is not null and "jobs"."actual_productive_minutes" >= 0 and "jobs"."actual_occupied_team_minutes" >= "jobs"."actual_productive_minutes" and "jobs"."internal_completion_notes" is not null and length(trim("jobs"."internal_completion_notes")) > 0 and "jobs"."completion_snapshot" is not null) or ("jobs"."status" <> 'COMPLETED' and "jobs"."completed_at" is null and "jobs"."completed_by_profile_id" is null and "jobs"."actual_productive_minutes" is null and "jobs"."actual_occupied_team_minutes" is null and "jobs"."internal_completion_notes" is null and "jobs"."customer_visible_completion_notes" is null and "jobs"."completion_snapshot" is null)),
	CONSTRAINT "jobs_cancellation_consistent" CHECK (("jobs"."status" = 'CANCELLED' and "jobs"."cancellation_reason_category" is not null) or ("jobs"."status" <> 'CANCELLED' and "jobs"."cancelled_at" is null and "jobs"."cancelled_by_profile_id" is null and "jobs"."cancellation_reason_category" is null and "jobs"."cancellation_reason_text" is null)),
	CONSTRAINT "jobs_cancellation_category_valid" CHECK ("jobs"."cancellation_reason_category" is null or "jobs"."cancellation_reason_category" in ('CUSTOMER_REQUEST', 'OPERATIONAL', 'DUPLICATE', 'SAFETY', 'OTHER')),
	CONSTRAINT "jobs_optional_text_not_blank" CHECK (("jobs"."review_reason_text" is null or length(trim("jobs"."review_reason_text")) > 0) and ("jobs"."customer_visible_completion_notes" is null or length(trim("jobs"."customer_visible_completion_notes")) > 0) and ("jobs"."cancellation_reason_text" is null or length(trim("jobs"."cancellation_reason_text")) > 0))
);
--> statement-breakpoint
CREATE TABLE "team_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_profile_id" uuid NOT NULL,
	"team_id" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	"updated_by_profile_id" uuid,
	CONSTRAINT "team_memberships_window_valid" CHECK ("team_memberships"."valid_until" is null or "team_memberships"."valid_until" >= "team_memberships"."valid_from"),
	CONSTRAINT "team_memberships_inactive_has_end" CHECK ("team_memberships"."active" = true or "team_memberships"."valid_until" is not null),
	CONSTRAINT "team_memberships_version_positive" CHECK ("team_memberships"."version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cleaning_assets_id_property_unique" ON "cleaning_assets" USING btree ("id","property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_items_id_booking_unique" ON "booking_items" USING btree ("id","booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_occupancies_id_booking_version_team_unique" ON "booking_occupancies" USING btree ("id","booking_id","snapshot_version","team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_id_customer_property_unique" ON "bookings" USING btree ("id","customer_id","property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_id_booking_property_unique" ON "jobs" USING btree ("id","booking_id","property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_items_id_job_unique" ON "job_items" USING btree ("id","job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_items_id_job_asset_unique" ON "job_items" USING btree ("id","job_id","cleaning_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_item_inspections_id_item_job_unique" ON "job_item_inspections" USING btree ("id","job_item_id","job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_item_treatment_plans_id_item_job_unique" ON "job_item_treatment_plans" USING btree ("id","job_item_id","job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_item_treatment_executions_passport_provenance_unique" ON "job_item_treatment_executions" USING btree ("id","job_item_id","job_id","status","completed_at","result_classification","performed_treatment_level_id","performed_mechanical_action_level_id","performed_treatment_approach_id");--> statement-breakpoint
ALTER TABLE "cleaning_passport_entries" ADD CONSTRAINT "cleaning_passport_entries_cleaning_asset_id_cleaning_assets_id_fk" FOREIGN KEY ("cleaning_asset_id") REFERENCES "public"."cleaning_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_passport_entries" ADD CONSTRAINT "cleaning_passport_entries_observed_condition_level_id_condition_levels_id_fk" FOREIGN KEY ("observed_condition_level_id") REFERENCES "public"."condition_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_passport_entries" ADD CONSTRAINT "cleaning_passport_entries_treatment_level_id_treatment_levels_id_fk" FOREIGN KEY ("treatment_level_id") REFERENCES "public"."treatment_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_passport_entries" ADD CONSTRAINT "cleaning_passport_entries_mechanical_action_level_id_mechanical_action_levels_id_fk" FOREIGN KEY ("mechanical_action_level_id") REFERENCES "public"."mechanical_action_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_passport_entries" ADD CONSTRAINT "cleaning_passport_entries_treatment_approach_id_treatment_approaches_id_fk" FOREIGN KEY ("treatment_approach_id") REFERENCES "public"."treatment_approaches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_passport_entries" ADD CONSTRAINT "cleaning_passport_entries_performed_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("performed_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_passport_entries" ADD CONSTRAINT "cleaning_passport_entries_item_asset_scope_fk" FOREIGN KEY ("job_item_id","job_id","cleaning_asset_id") REFERENCES "public"."job_items"("id","job_id","cleaning_asset_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_passport_entries" ADD CONSTRAINT "cleaning_passport_entries_execution_scope_fk" FOREIGN KEY ("treatment_execution_id","job_item_id","job_id","source_execution_status","completed_at","result_classification","treatment_level_id","mechanical_action_level_id","treatment_approach_id") REFERENCES "public"."job_item_treatment_executions"("id","job_item_id","job_id","status","completed_at","result_classification","performed_treatment_level_id","performed_mechanical_action_level_id","performed_treatment_approach_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_audit_events" ADD CONSTRAINT "job_audit_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_audit_events" ADD CONSTRAINT "job_audit_events_actor_profile_id_user_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_audit_events" ADD CONSTRAINT "job_audit_events_item_scope_fk" FOREIGN KEY ("job_item_id","job_id") REFERENCES "public"."job_items"("id","job_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_inspection_issues" ADD CONSTRAINT "job_item_inspection_issues_issue_type_id_issue_types_id_fk" FOREIGN KEY ("issue_type_id") REFERENCES "public"."issue_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_inspection_issues" ADD CONSTRAINT "job_item_inspection_issues_scope_fk" FOREIGN KEY ("inspection_id","job_item_id","job_id") REFERENCES "public"."job_item_inspections"("id","job_item_id","job_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_inspection_risks" ADD CONSTRAINT "job_item_inspection_risks_risk_flag_id_risk_flags_id_fk" FOREIGN KEY ("risk_flag_id") REFERENCES "public"."risk_flags"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_inspection_risks" ADD CONSTRAINT "job_item_inspection_risks_scope_fk" FOREIGN KEY ("inspection_id","job_item_id","job_id") REFERENCES "public"."job_item_inspections"("id","job_item_id","job_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_inspections" ADD CONSTRAINT "job_item_inspections_observed_cleaning_item_type_id_cleaning_item_types_id_fk" FOREIGN KEY ("observed_cleaning_item_type_id") REFERENCES "public"."cleaning_item_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_inspections" ADD CONSTRAINT "job_item_inspections_observed_measurement_mode_id_measurement_modes_id_fk" FOREIGN KEY ("observed_measurement_mode_id") REFERENCES "public"."measurement_modes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_inspections" ADD CONSTRAINT "job_item_inspections_observed_condition_level_id_condition_levels_id_fk" FOREIGN KEY ("observed_condition_level_id") REFERENCES "public"."condition_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_inspections" ADD CONSTRAINT "job_item_inspections_confirmed_fibre_material_id_fibre_materials_id_fk" FOREIGN KEY ("confirmed_fibre_material_id") REFERENCES "public"."fibre_materials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_inspections" ADD CONSTRAINT "job_item_inspections_confirmed_surface_construction_id_surface_constructions_id_fk" FOREIGN KEY ("confirmed_surface_construction_id") REFERENCES "public"."surface_constructions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_inspections" ADD CONSTRAINT "job_item_inspections_inspected_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("inspected_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_inspections" ADD CONSTRAINT "job_item_inspections_item_scope_fk" FOREIGN KEY ("job_item_id","job_id") REFERENCES "public"."job_items"("id","job_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_treatment_executions" ADD CONSTRAINT "job_item_treatment_executions_performed_treatment_level_id_treatment_levels_id_fk" FOREIGN KEY ("performed_treatment_level_id") REFERENCES "public"."treatment_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_treatment_executions" ADD CONSTRAINT "job_item_treatment_executions_performed_mechanical_action_level_id_mechanical_action_levels_id_fk" FOREIGN KEY ("performed_mechanical_action_level_id") REFERENCES "public"."mechanical_action_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_treatment_executions" ADD CONSTRAINT "job_item_treatment_executions_performed_treatment_approach_id_treatment_approaches_id_fk" FOREIGN KEY ("performed_treatment_approach_id") REFERENCES "public"."treatment_approaches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_treatment_executions" ADD CONSTRAINT "job_item_treatment_executions_cleaning_product_id_cleaning_products_id_fk" FOREIGN KEY ("cleaning_product_id") REFERENCES "public"."cleaning_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_treatment_executions" ADD CONSTRAINT "job_item_treatment_executions_performed_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("performed_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_treatment_executions" ADD CONSTRAINT "job_item_treatment_executions_completed_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("completed_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_treatment_executions" ADD CONSTRAINT "job_item_treatment_executions_plan_scope_fk" FOREIGN KEY ("treatment_plan_id","job_item_id","job_id") REFERENCES "public"."job_item_treatment_plans"("id","job_item_id","job_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_treatment_plan_addons" ADD CONSTRAINT "job_item_treatment_plan_addons_service_addon_id_service_addons_id_fk" FOREIGN KEY ("service_addon_id") REFERENCES "public"."service_addons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_treatment_plan_addons" ADD CONSTRAINT "job_item_treatment_plan_addons_scope_fk" FOREIGN KEY ("treatment_plan_id","job_item_id","job_id") REFERENCES "public"."job_item_treatment_plans"("id","job_item_id","job_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_treatment_plans" ADD CONSTRAINT "job_item_treatment_plans_treatment_level_id_treatment_levels_id_fk" FOREIGN KEY ("treatment_level_id") REFERENCES "public"."treatment_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_treatment_plans" ADD CONSTRAINT "job_item_treatment_plans_mechanical_action_level_id_mechanical_action_levels_id_fk" FOREIGN KEY ("mechanical_action_level_id") REFERENCES "public"."mechanical_action_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_treatment_plans" ADD CONSTRAINT "job_item_treatment_plans_treatment_approach_id_treatment_approaches_id_fk" FOREIGN KEY ("treatment_approach_id") REFERENCES "public"."treatment_approaches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_treatment_plans" ADD CONSTRAINT "job_item_treatment_plans_cleaning_product_id_cleaning_products_id_fk" FOREIGN KEY ("cleaning_product_id") REFERENCES "public"."cleaning_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_treatment_plans" ADD CONSTRAINT "job_item_treatment_plans_confirmed_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("confirmed_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_item_treatment_plans" ADD CONSTRAINT "job_item_treatment_plans_inspection_scope_fk" FOREIGN KEY ("inspection_id","job_item_id","job_id") REFERENCES "public"."job_item_inspections"("id","job_item_id","job_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_items" ADD CONSTRAINT "job_items_cleaning_asset_id_cleaning_assets_id_fk" FOREIGN KEY ("cleaning_asset_id") REFERENCES "public"."cleaning_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_items" ADD CONSTRAINT "job_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_items" ADD CONSTRAINT "job_items_cleaning_item_type_id_cleaning_item_types_id_fk" FOREIGN KEY ("cleaning_item_type_id") REFERENCES "public"."cleaning_item_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_items" ADD CONSTRAINT "job_items_measurement_mode_id_measurement_modes_id_fk" FOREIGN KEY ("measurement_mode_id") REFERENCES "public"."measurement_modes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_items" ADD CONSTRAINT "job_items_customer_reported_condition_level_id_condition_levels_id_fk" FOREIGN KEY ("customer_reported_condition_level_id") REFERENCES "public"."condition_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_items" ADD CONSTRAINT "job_items_staff_normalized_condition_level_id_condition_levels_id_fk" FOREIGN KEY ("staff_normalized_condition_level_id") REFERENCES "public"."condition_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_items" ADD CONSTRAINT "job_items_customer_reported_fibre_material_id_fibre_materials_id_fk" FOREIGN KEY ("customer_reported_fibre_material_id") REFERENCES "public"."fibre_materials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_items" ADD CONSTRAINT "job_items_staff_normalized_fibre_material_id_fibre_materials_id_fk" FOREIGN KEY ("staff_normalized_fibre_material_id") REFERENCES "public"."fibre_materials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_items" ADD CONSTRAINT "job_items_customer_reported_surface_construction_id_surface_constructions_id_fk" FOREIGN KEY ("customer_reported_surface_construction_id") REFERENCES "public"."surface_constructions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_items" ADD CONSTRAINT "job_items_staff_normalized_surface_construction_id_surface_constructions_id_fk" FOREIGN KEY ("staff_normalized_surface_construction_id") REFERENCES "public"."surface_constructions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_items" ADD CONSTRAINT "job_items_job_provenance_fk" FOREIGN KEY ("job_id","booking_id","property_id") REFERENCES "public"."jobs"("id","booking_id","property_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_items" ADD CONSTRAINT "job_items_booking_item_provenance_fk" FOREIGN KEY ("booking_item_id","booking_id") REFERENCES "public"."booking_items"("id","booking_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_items" ADD CONSTRAINT "job_items_cleaning_asset_property_fk" FOREIGN KEY ("cleaning_asset_id","property_id") REFERENCES "public"."cleaning_assets"("id","property_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_assigned_team_id_operations_teams_id_fk" FOREIGN KEY ("assigned_team_id") REFERENCES "public"."operations_teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_assigned_equipment_resource_id_equipment_resources_id_fk" FOREIGN KEY ("assigned_equipment_resource_id") REFERENCES "public"."equipment_resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_updated_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_completed_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("completed_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_cancelled_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("cancelled_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_booking_provenance_fk" FOREIGN KEY ("booking_id","customer_id","property_id") REFERENCES "public"."bookings"("id","customer_id","property_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_booking_occupancy_provenance_fk" FOREIGN KEY ("source_occupancy_id","booking_id","source_occupancy_snapshot_version","assigned_team_id") REFERENCES "public"."booking_occupancies"("id","booking_id","snapshot_version","team_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_user_profile_id_user_profiles_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_operations_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."operations_teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_updated_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cleaning_passport_entries_job_item_unique" ON "cleaning_passport_entries" USING btree ("job_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cleaning_passport_entries_execution_unique" ON "cleaning_passport_entries" USING btree ("treatment_execution_id");--> statement-breakpoint
CREATE INDEX "cleaning_passport_entries_asset_completed_idx" ON "cleaning_passport_entries" USING btree ("cleaning_asset_id","completed_at");--> statement-breakpoint
CREATE INDEX "cleaning_passport_entries_job_idx" ON "cleaning_passport_entries" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_audit_events_correlation_unique" ON "job_audit_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "job_audit_events_job_timeline_idx" ON "job_audit_events" USING btree ("job_id","created_at");--> statement-breakpoint
CREATE INDEX "job_audit_events_item_timeline_idx" ON "job_audit_events" USING btree ("job_item_id","created_at") WHERE "job_audit_events"."job_item_id" is not null;--> statement-breakpoint
CREATE INDEX "job_audit_events_type_created_idx" ON "job_audit_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "job_item_inspection_issues_job_idx" ON "job_item_inspection_issues" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_item_inspection_risks_job_idx" ON "job_item_inspection_risks" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_item_inspections_item_unique" ON "job_item_inspections" USING btree ("job_item_id");--> statement-breakpoint
CREATE INDEX "job_item_inspections_job_time_idx" ON "job_item_inspections" USING btree ("job_id","inspected_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_item_treatment_executions_plan_unique" ON "job_item_treatment_executions" USING btree ("treatment_plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_item_treatment_executions_item_unique" ON "job_item_treatment_executions" USING btree ("job_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_item_treatment_executions_id_item_job_unique" ON "job_item_treatment_executions" USING btree ("id","job_item_id","job_id");--> statement-breakpoint
CREATE INDEX "job_item_treatment_executions_job_status_idx" ON "job_item_treatment_executions" USING btree ("job_id","status");--> statement-breakpoint
CREATE INDEX "job_item_treatment_plan_addons_job_idx" ON "job_item_treatment_plan_addons" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_item_treatment_plans_item_unique" ON "job_item_treatment_plans" USING btree ("job_item_id");--> statement-breakpoint
CREATE INDEX "job_item_treatment_plans_job_time_idx" ON "job_item_treatment_plans" USING btree ("job_id","confirmed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_items_booking_item_unique" ON "job_items" USING btree ("booking_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_items_job_sort_unique" ON "job_items" USING btree ("job_id","sort_order");--> statement-breakpoint
CREATE INDEX "job_items_job_status_idx" ON "job_items" USING btree ("job_id","status");--> statement-breakpoint
CREATE INDEX "job_items_asset_created_idx" ON "job_items" USING btree ("cleaning_asset_id","created_at") WHERE "job_items"."cleaning_asset_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_reference_unique" ON "jobs" USING btree ("job_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_booking_unique" ON "jobs" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "jobs_staff_status_schedule_idx" ON "jobs" USING btree ("status","scheduled_start_snapshot","created_at");--> statement-breakpoint
CREATE INDEX "jobs_team_status_schedule_idx" ON "jobs" USING btree ("assigned_team_id","status","scheduled_start_snapshot");--> statement-breakpoint
CREATE INDEX "jobs_customer_created_idx" ON "jobs" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "jobs_property_created_idx" ON "jobs" USING btree ("property_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "team_memberships_active_pair_unique" ON "team_memberships" USING btree ("user_profile_id","team_id") WHERE "team_memberships"."active" = true;--> statement-breakpoint
CREATE INDEX "team_memberships_profile_active_idx" ON "team_memberships" USING btree ("user_profile_id","active","valid_from","valid_until");--> statement-breakpoint
CREATE INDEX "team_memberships_team_active_idx" ON "team_memberships" USING btree ("team_id","active","valid_from","valid_until");--> statement-breakpoint
