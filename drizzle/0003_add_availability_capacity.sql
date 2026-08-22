CREATE TABLE "appointment_window_definitions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "appointment_window_definitions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"profile_code" varchar(96) NOT NULL,
	"version" integer NOT NULL,
	"status" varchar(32) NOT NULL,
	"window_code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_until" timestamp with time zone,
	"provisional" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointment_windows_version_positive" CHECK ("appointment_window_definitions"."version" > 0),
	CONSTRAINT "appointment_windows_status_valid" CHECK ("appointment_window_definitions"."status" in ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED')),
	CONSTRAINT "appointment_windows_code_valid" CHECK ("appointment_window_definitions"."window_code" in ('EARLY_MORNING', 'MORNING', 'MIDDAY', 'AFTERNOON', 'EVENING')),
	CONSTRAINT "appointment_windows_minutes_valid" CHECK ("appointment_window_definitions"."start_minute" >= 0 and "appointment_window_definitions"."end_minute" <= 1440 and "appointment_window_definitions"."end_minute" > "appointment_window_definitions"."start_minute"),
	CONSTRAINT "appointment_windows_effective_window_valid" CHECK ("appointment_window_definitions"."effective_from" is null or "appointment_window_definitions"."effective_until" is null or "appointment_window_definitions"."effective_until" > "appointment_window_definitions"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "equipment_resources" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "equipment_resources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"name" varchar(160) NOT NULL,
	"equipment_type_code" varchar(64) NOT NULL,
	"capability_code" varchar(64) NOT NULL,
	"status" varchar(32) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"serial_number" varchar(160),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_resources_code_unique" UNIQUE("code"),
	CONSTRAINT "equipment_resources_type_valid" CHECK ("equipment_resources"."equipment_type_code" in ('PORTABLE_CLEANING_MACHINE')),
	CONSTRAINT "equipment_resources_capability_valid" CHECK ("equipment_resources"."capability_code" in ('PORTABLE_EXTRACTION')),
	CONSTRAINT "equipment_resources_status_valid" CHECK ("equipment_resources"."status" in ('ACTIVE', 'UNAVAILABLE', 'MAINTENANCE'))
);
--> statement-breakpoint
CREATE TABLE "operations_teams" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "operations_teams_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"name" varchar(160) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"default_crew_size" integer NOT NULL,
	"working_hour_policy_id" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operations_teams_code_unique" UNIQUE("code"),
	CONSTRAINT "operations_teams_crew_size_positive" CHECK ("operations_teams"."default_crew_size" > 0)
);
--> statement-breakpoint
CREATE TABLE "team_capabilities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "team_capabilities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"team_id" integer NOT NULL,
	"capability_code" varchar(64) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_capabilities_code_valid" CHECK ("team_capabilities"."capability_code" in ('STANDARD_RESIDENTIAL', 'COMMERCIAL_AREA', 'SPECIALIST_ASSESSMENT', 'PORTABLE_EXTRACTION'))
);
--> statement-breakpoint
CREATE TABLE "team_equipment_assignments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "team_equipment_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"team_id" integer NOT NULL,
	"equipment_resource_id" integer NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_until" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_equipment_assignments_window_valid" CHECK ("team_equipment_assignments"."effective_from" is null or "team_equipment_assignments"."effective_until" is null or "team_equipment_assignments"."effective_until" > "team_equipment_assignments"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "travel_time_matrix_rules" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "travel_time_matrix_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"travel_time_profile_id" integer NOT NULL,
	"code" varchar(160) NOT NULL,
	"origin_travel_zone_id" integer NOT NULL,
	"destination_travel_zone_id" integer NOT NULL,
	"estimated_travel_minutes" integer,
	"bidirectional" boolean DEFAULT true NOT NULL,
	"same_district_only" boolean DEFAULT false NOT NULL,
	"manual_assessment_required" boolean DEFAULT false NOT NULL,
	"priority" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "travel_time_matrix_rules_code_unique" UNIQUE("code"),
	CONSTRAINT "travel_time_matrix_minutes_positive" CHECK ("travel_time_matrix_rules"."estimated_travel_minutes" is null or "travel_time_matrix_rules"."estimated_travel_minutes" > 0),
	CONSTRAINT "travel_time_matrix_priority_nonnegative" CHECK ("travel_time_matrix_rules"."priority" >= 0),
	CONSTRAINT "travel_time_matrix_manual_or_minutes" CHECK ("travel_time_matrix_rules"."manual_assessment_required" = true or "travel_time_matrix_rules"."estimated_travel_minutes" is not null)
);
--> statement-breakpoint
CREATE TABLE "travel_time_profiles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "travel_time_profiles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(96) NOT NULL,
	"name" varchar(255) NOT NULL,
	"market" varchar(64) NOT NULL,
	"version" integer NOT NULL,
	"status" varchar(32) NOT NULL,
	"default_travel_minutes" integer NOT NULL,
	"inter_job_buffer_minutes" integer NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_until" timestamp with time zone,
	"provisional" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "travel_time_profiles_code_unique" UNIQUE("code"),
	CONSTRAINT "travel_time_profiles_version_positive" CHECK ("travel_time_profiles"."version" > 0),
	CONSTRAINT "travel_time_profiles_status_valid" CHECK ("travel_time_profiles"."status" in ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED')),
	CONSTRAINT "travel_time_profiles_default_positive" CHECK ("travel_time_profiles"."default_travel_minutes" > 0),
	CONSTRAINT "travel_time_profiles_buffer_nonnegative" CHECK ("travel_time_profiles"."inter_job_buffer_minutes" >= 0),
	CONSTRAINT "travel_time_profiles_effective_window_valid" CHECK ("travel_time_profiles"."effective_from" is null or "travel_time_profiles"."effective_until" is null or "travel_time_profiles"."effective_until" > "travel_time_profiles"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "working_hour_policies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "working_hour_policies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(96) NOT NULL,
	"name" varchar(255) NOT NULL,
	"market" varchar(64) NOT NULL,
	"time_zone" varchar(64) NOT NULL,
	"version" integer NOT NULL,
	"status" varchar(32) NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_until" timestamp with time zone,
	"provisional" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "working_hour_policies_code_unique" UNIQUE("code"),
	CONSTRAINT "working_hour_policies_version_positive" CHECK ("working_hour_policies"."version" > 0),
	CONSTRAINT "working_hour_policies_status_valid" CHECK ("working_hour_policies"."status" in ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED')),
	CONSTRAINT "working_hour_policies_effective_window_valid" CHECK ("working_hour_policies"."effective_from" is null or "working_hour_policies"."effective_until" is null or "working_hour_policies"."effective_until" > "working_hour_policies"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "working_hour_rules" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "working_hour_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"policy_id" integer NOT NULL,
	"code" varchar(160) NOT NULL,
	"weekday" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"team_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "working_hour_rules_code_unique" UNIQUE("code"),
	CONSTRAINT "working_hour_rules_weekday_valid" CHECK ("working_hour_rules"."weekday" between 1 and 7),
	CONSTRAINT "working_hour_rules_minutes_valid" CHECK ("working_hour_rules"."start_minute" >= 0 and "working_hour_rules"."end_minute" <= 1440 and "working_hour_rules"."end_minute" > "working_hour_rules"."start_minute")
);
--> statement-breakpoint
ALTER TABLE "travel_zones" ADD COLUMN "service_eligible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "travel_zones" ADD COLUMN "minimum_order_override_minor_units" integer;--> statement-breakpoint
ALTER TABLE "travel_zones" ADD COLUMN "estimated_base_travel_minutes" integer;--> statement-breakpoint
ALTER TABLE "travel_zones" ADD COLUMN "manual_confirmation_required" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "travel_zones" ADD COLUMN "geographic_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "operations_teams" ADD CONSTRAINT "operations_teams_working_hour_policy_id_working_hour_policies_id_fk" FOREIGN KEY ("working_hour_policy_id") REFERENCES "public"."working_hour_policies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_capabilities" ADD CONSTRAINT "team_capabilities_team_id_operations_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."operations_teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_equipment_assignments" ADD CONSTRAINT "team_equipment_assignments_team_id_operations_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."operations_teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_equipment_assignments" ADD CONSTRAINT "team_equipment_assignments_equipment_resource_id_equipment_resources_id_fk" FOREIGN KEY ("equipment_resource_id") REFERENCES "public"."equipment_resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_time_matrix_rules" ADD CONSTRAINT "travel_time_matrix_rules_travel_time_profile_id_travel_time_profiles_id_fk" FOREIGN KEY ("travel_time_profile_id") REFERENCES "public"."travel_time_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_time_matrix_rules" ADD CONSTRAINT "travel_time_matrix_rules_origin_travel_zone_id_travel_zones_id_fk" FOREIGN KEY ("origin_travel_zone_id") REFERENCES "public"."travel_zones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_time_matrix_rules" ADD CONSTRAINT "travel_time_matrix_rules_destination_travel_zone_id_travel_zones_id_fk" FOREIGN KEY ("destination_travel_zone_id") REFERENCES "public"."travel_zones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_hour_rules" ADD CONSTRAINT "working_hour_rules_policy_id_working_hour_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."working_hour_policies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_hour_rules" ADD CONSTRAINT "working_hour_rules_team_id_operations_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."operations_teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_windows_profile_version_code_unique" ON "appointment_window_definitions" USING btree ("profile_code","version","window_code");--> statement-breakpoint
CREATE UNIQUE INDEX "team_capabilities_team_code_unique" ON "team_capabilities" USING btree ("team_id","capability_code");--> statement-breakpoint
CREATE UNIQUE INDEX "team_equipment_assignments_pair_unique" ON "team_equipment_assignments" USING btree ("team_id","equipment_resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "travel_time_matrix_profile_code_unique" ON "travel_time_matrix_rules" USING btree ("travel_time_profile_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "working_hour_rules_policy_code_unique" ON "working_hour_rules" USING btree ("policy_id","code");--> statement-breakpoint
ALTER TABLE "travel_zones" ADD CONSTRAINT "travel_zones_minimum_order_nonnegative" CHECK ("travel_zones"."minimum_order_override_minor_units" is null or "travel_zones"."minimum_order_override_minor_units" >= 0);--> statement-breakpoint
ALTER TABLE "travel_zones" ADD CONSTRAINT "travel_zones_base_travel_nonnegative" CHECK ("travel_zones"."estimated_base_travel_minutes" is null or "travel_zones"."estimated_base_travel_minutes" >= 0);