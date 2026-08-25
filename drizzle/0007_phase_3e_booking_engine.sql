CREATE EXTENSION IF NOT EXISTS "btree_gist";
--> statement-breakpoint
CREATE TABLE "booking_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"quote_acceptance_id" uuid NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"actor_profile_id" uuid,
	"source" varchar(32) NOT NULL,
	"correlation_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"safe_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_audit_events_type_valid" CHECK ("booking_audit_events"."event_type" in ('QUOTE_ACCEPTED', 'BOOKING_CREATED', 'BOOKING_SCHEDULED', 'BOOKING_CANCELLED', 'TEAM_ASSIGNED')),
	CONSTRAINT "booking_audit_events_source_valid" CHECK ("booking_audit_events"."source" in ('CUSTOMER_PORTAL', 'STAFF', 'SYSTEM'))
);
--> statement-breakpoint
CREATE TABLE "booking_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"quote_item_id" uuid NOT NULL,
	"request_item_id" uuid,
	"service_id" integer,
	"cleaning_item_type_id" integer,
	"measurement_mode_id" integer,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"quantity" integer NOT NULL,
	"measurement_snapshot" jsonb NOT NULL,
	"base_amount_minor_units" integer NOT NULL,
	"modifier_amount_minor_units" integer NOT NULL,
	"addon_amount_minor_units" integer NOT NULL,
	"net_amount_minor_units" integer NOT NULL,
	"vat_rate_basis_points" integer NOT NULL,
	"vat_amount_minor_units" integer NOT NULL,
	"gross_total_minor_units" integer NOT NULL,
	"calculation_snapshot" jsonb NOT NULL,
	"duration_basis_snapshot" jsonb NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_items_descriptions_not_blank" CHECK (length(trim("booking_items"."description_bg")) > 0 and length(trim("booking_items"."description_en")) > 0),
	CONSTRAINT "booking_items_quantity_positive" CHECK ("booking_items"."quantity" > 0),
	CONSTRAINT "booking_items_amounts_consistent" CHECK ("booking_items"."base_amount_minor_units" >= 0 and "booking_items"."addon_amount_minor_units" >= 0 and "booking_items"."net_amount_minor_units" = "booking_items"."base_amount_minor_units" + "booking_items"."modifier_amount_minor_units" + "booking_items"."addon_amount_minor_units" and "booking_items"."net_amount_minor_units" >= 0 and "booking_items"."vat_amount_minor_units" >= 0 and "booking_items"."gross_total_minor_units" = "booking_items"."net_amount_minor_units" + "booking_items"."vat_amount_minor_units"),
	CONSTRAINT "booking_items_vat_rate_valid" CHECK ("booking_items"."vat_rate_basis_points" between 0 and 10000),
	CONSTRAINT "booking_items_sort_nonnegative" CHECK ("booking_items"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "booking_occupancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"snapshot_version" integer NOT NULL,
	"previous_occupancy_id" uuid,
	"team_id" integer NOT NULL,
	"equipment_resource_id" integer,
	"service_start" timestamp with time zone NOT NULL,
	"service_end" timestamp with time zone NOT NULL,
	"operational_start" timestamp with time zone NOT NULL,
	"operational_end" timestamp with time zone NOT NULL,
	"time_zone" varchar(64) DEFAULT 'Europe/Sofia' NOT NULL,
	"status" varchar(16) DEFAULT 'CONFIRMED' NOT NULL,
	"service_duration_minutes" integer NOT NULL,
	"required_equipment_capability_code" varchar(64),
	"scheduling_policy_code" varchar(96) NOT NULL,
	"scheduling_policy_version" integer NOT NULL,
	"working_hour_policy_id" integer NOT NULL,
	"working_hour_policy_code" varchar(96) NOT NULL,
	"working_hour_policy_version" integer NOT NULL,
	"travel_time_profile_id" integer NOT NULL,
	"travel_time_profile_code" varchar(96) NOT NULL,
	"travel_time_profile_version" integer NOT NULL,
	"duration_snapshot" jsonb NOT NULL,
	"location_snapshot" jsonb NOT NULL,
	"requirements_snapshot" jsonb NOT NULL,
	"availability_input_snapshot" jsonb NOT NULL,
	"availability_result_snapshot" jsonb NOT NULL,
	"travel_snapshot" jsonb NOT NULL,
	"working_hours_snapshot" jsonb NOT NULL,
	"equipment_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_profile_id" uuid,
	CONSTRAINT "booking_occupancies_status_valid" CHECK ("booking_occupancies"."status" in ('PENDING', 'CONFIRMED', 'CANCELLED')),
	CONSTRAINT "booking_occupancies_intervals_valid" CHECK ("booking_occupancies"."service_end" > "booking_occupancies"."service_start" and "booking_occupancies"."operational_end" > "booking_occupancies"."operational_start" and "booking_occupancies"."operational_start" <= "booking_occupancies"."service_start" and "booking_occupancies"."operational_end" >= "booking_occupancies"."service_end" and extract(epoch from ("booking_occupancies"."service_end" - "booking_occupancies"."service_start")) / 60 = "booking_occupancies"."service_duration_minutes"),
	CONSTRAINT "booking_occupancies_versions_positive" CHECK ("booking_occupancies"."snapshot_version" >= 1 and "booking_occupancies"."service_duration_minutes" > 0 and "booking_occupancies"."scheduling_policy_version" >= 1 and "booking_occupancies"."working_hour_policy_version" >= 1 and "booking_occupancies"."travel_time_profile_version" >= 1),
	CONSTRAINT "booking_occupancies_time_zone_sofia" CHECK ("booking_occupancies"."time_zone" = 'Europe/Sofia'),
	CONSTRAINT "booking_occupancies_equipment_consistent" CHECK (("booking_occupancies"."equipment_resource_id" is null and "booking_occupancies"."required_equipment_capability_code" is null) or ("booking_occupancies"."equipment_resource_id" is not null and "booking_occupancies"."required_equipment_capability_code" is not null and length(trim("booking_occupancies"."required_equipment_capability_code")) > 0)),
	CONSTRAINT "booking_occupancies_cancellation_consistent" CHECK (("booking_occupancies"."status" in ('PENDING', 'CONFIRMED') and "booking_occupancies"."cancelled_at" is null and "booking_occupancies"."cancelled_by_profile_id" is null) or ("booking_occupancies"."status" = 'CANCELLED' and "booking_occupancies"."cancelled_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_reference" varchar(40) NOT NULL,
	"request_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"quote_acceptance_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"status" varchar(24) DEFAULT 'PENDING_SCHEDULING' NOT NULL,
	"scheduling_status" varchar(24) DEFAULT 'REVIEW_REQUIRED' NOT NULL,
	"preferred_date" date,
	"appointment_window_code" varchar(64),
	"scheduled_start" timestamp with time zone,
	"scheduled_end" timestamp with time zone,
	"assigned_team_id" integer,
	"assigned_equipment_resource_id" integer,
	"price_snapshot" jsonb NOT NULL,
	"duration_snapshot" jsonb NOT NULL,
	"scheduling_snapshot" jsonb NOT NULL,
	"customer_snapshot" jsonb NOT NULL,
	"property_snapshot" jsonb NOT NULL,
	"customer_notes_snapshot" text,
	"internal_notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	"updated_by_profile_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_profile_id" uuid,
	"cancellation_reason_category" varchar(32),
	"cancellation_reason_text" text,
	CONSTRAINT "bookings_booking_reference_unique" UNIQUE("booking_reference"),
	CONSTRAINT "bookings_reference_valid" CHECK ("bookings"."booking_reference" ~ '^BKG-[A-F0-9]{24}$'),
	CONSTRAINT "bookings_status_valid" CHECK ("bookings"."status" in ('PENDING_SCHEDULING', 'CONFIRMED', 'CANCELLED')),
	CONSTRAINT "bookings_scheduling_status_valid" CHECK ("bookings"."scheduling_status" in ('UNSCHEDULED', 'REVIEW_REQUIRED', 'SCHEDULED')),
	CONSTRAINT "bookings_version_positive" CHECK ("bookings"."version" >= 1),
	CONSTRAINT "bookings_schedule_interval_consistent" CHECK (("bookings"."scheduled_start" is null and "bookings"."scheduled_end" is null and "bookings"."assigned_team_id" is null and "bookings"."assigned_equipment_resource_id" is null) or ("bookings"."scheduled_start" is not null and "bookings"."scheduled_end" is not null and "bookings"."scheduled_end" > "bookings"."scheduled_start" and "bookings"."assigned_team_id" is not null)),
	CONSTRAINT "bookings_scheduling_lifecycle_consistent" CHECK (("bookings"."scheduling_status" = 'SCHEDULED' and "bookings"."scheduled_start" is not null and "bookings"."scheduled_end" is not null and "bookings"."assigned_team_id" is not null) or ("bookings"."scheduling_status" <> 'SCHEDULED' and "bookings"."scheduled_start" is null and "bookings"."scheduled_end" is null and "bookings"."assigned_team_id" is null and "bookings"."assigned_equipment_resource_id" is null)),
	CONSTRAINT "bookings_status_schedule_consistent" CHECK (("bookings"."status" = 'PENDING_SCHEDULING' and "bookings"."scheduling_status" <> 'SCHEDULED') or ("bookings"."status" = 'CONFIRMED' and "bookings"."scheduling_status" = 'SCHEDULED') or "bookings"."status" = 'CANCELLED'),
	CONSTRAINT "bookings_cancellation_consistent" CHECK (("bookings"."status" = 'CANCELLED' and "bookings"."cancelled_at" is not null and "bookings"."cancellation_reason_category" is not null) or ("bookings"."status" <> 'CANCELLED' and "bookings"."cancelled_at" is null and "bookings"."cancelled_by_profile_id" is null and "bookings"."cancellation_reason_category" is null and "bookings"."cancellation_reason_text" is null)),
	CONSTRAINT "bookings_cancellation_category_valid" CHECK ("bookings"."cancellation_reason_category" is null or "bookings"."cancellation_reason_category" in ('CUSTOMER_REQUEST', 'OPERATIONAL', 'DUPLICATE', 'OTHER')),
	CONSTRAINT "bookings_notes_not_blank" CHECK (("bookings"."customer_notes_snapshot" is null or length(trim("bookings"."customer_notes_snapshot")) > 0) and ("bookings"."internal_notes" is null or length(trim("bookings"."internal_notes")) > 0) and ("bookings"."cancellation_reason_text" is null or length(trim("bookings"."cancellation_reason_text")) > 0))
);
--> statement-breakpoint
CREATE TABLE "quote_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"quote_version" integer NOT NULL,
	"quote_record_version" integer NOT NULL,
	"request_id" uuid NOT NULL,
	"source_request_version" integer NOT NULL,
	"customer_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"accepted_by_profile_id" uuid,
	"actor_type" varchar(24) NOT NULL,
	"acceptance_source" varchar(32) NOT NULL,
	"acceptance_note" text,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"commercial_snapshot" jsonb NOT NULL,
	"terms_snapshot" jsonb NOT NULL,
	"pricing_snapshot" jsonb NOT NULL,
	"duration_snapshot" jsonb NOT NULL,
	"provenance_snapshot" jsonb NOT NULL,
	"safe_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "quote_acceptances_versions_positive" CHECK ("quote_acceptances"."quote_version" >= 1 and "quote_acceptances"."quote_record_version" >= 1 and "quote_acceptances"."source_request_version" >= 1),
	CONSTRAINT "quote_acceptances_actor_type_valid" CHECK ("quote_acceptances"."actor_type" in ('CUSTOMER', 'STAFF_ON_BEHALF')),
	CONSTRAINT "quote_acceptances_source_valid" CHECK ("quote_acceptances"."acceptance_source" in ('CUSTOMER_PORTAL', 'PHONE', 'EMAIL', 'IN_PERSON', 'OTHER_RECORDED')),
	CONSTRAINT "quote_acceptances_actor_source_consistent" CHECK (("quote_acceptances"."actor_type" = 'CUSTOMER' and "quote_acceptances"."acceptance_source" = 'CUSTOMER_PORTAL' and "quote_acceptances"."acceptance_note" is null) or ("quote_acceptances"."actor_type" = 'STAFF_ON_BEHALF' and "quote_acceptances"."acceptance_source" <> 'CUSTOMER_PORTAL' and "quote_acceptances"."acceptance_note" is not null and length(trim("quote_acceptances"."acceptance_note")) > 0))
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "acceptance_source_snapshot" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "quote_acceptances_booking_provenance_unique" ON "quote_acceptances" USING btree ("id","quote_id","request_id","customer_id","property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_booking_provenance_unique" ON "quotes" USING btree ("id","request_id","customer_id","property_id");--> statement-breakpoint
ALTER TABLE "booking_audit_events" ADD CONSTRAINT "booking_audit_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_audit_events" ADD CONSTRAINT "booking_audit_events_quote_acceptance_id_quote_acceptances_id_fk" FOREIGN KEY ("quote_acceptance_id") REFERENCES "public"."quote_acceptances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_audit_events" ADD CONSTRAINT "booking_audit_events_actor_profile_id_user_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_quote_item_id_quote_items_id_fk" FOREIGN KEY ("quote_item_id") REFERENCES "public"."quote_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_request_item_id_service_request_items_id_fk" FOREIGN KEY ("request_item_id") REFERENCES "public"."service_request_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_occupancies" ADD CONSTRAINT "booking_occupancies_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_occupancies" ADD CONSTRAINT "booking_occupancies_team_id_operations_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."operations_teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_occupancies" ADD CONSTRAINT "booking_occupancies_equipment_resource_id_equipment_resources_id_fk" FOREIGN KEY ("equipment_resource_id") REFERENCES "public"."equipment_resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_occupancies" ADD CONSTRAINT "booking_occupancies_working_hour_policy_id_working_hour_policies_id_fk" FOREIGN KEY ("working_hour_policy_id") REFERENCES "public"."working_hour_policies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_occupancies" ADD CONSTRAINT "booking_occupancies_travel_time_profile_id_travel_time_profiles_id_fk" FOREIGN KEY ("travel_time_profile_id") REFERENCES "public"."travel_time_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_occupancies" ADD CONSTRAINT "booking_occupancies_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_occupancies" ADD CONSTRAINT "booking_occupancies_cancelled_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("cancelled_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_occupancies" ADD CONSTRAINT "booking_occupancies_previous_fk" FOREIGN KEY ("previous_occupancy_id") REFERENCES "public"."booking_occupancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_assigned_team_id_operations_teams_id_fk" FOREIGN KEY ("assigned_team_id") REFERENCES "public"."operations_teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_assigned_equipment_resource_id_equipment_resources_id_fk" FOREIGN KEY ("assigned_equipment_resource_id") REFERENCES "public"."equipment_resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_updated_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("cancelled_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_acceptance_provenance_fk" FOREIGN KEY ("quote_acceptance_id","quote_id","request_id","customer_id","property_id") REFERENCES "public"."quote_acceptances"("id","quote_id","request_id","customer_id","property_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_acceptances" ADD CONSTRAINT "quote_acceptances_accepted_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("accepted_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_acceptances" ADD CONSTRAINT "quote_acceptances_quote_provenance_fk" FOREIGN KEY ("quote_id","request_id","customer_id","property_id") REFERENCES "public"."quotes"("id","request_id","customer_id","property_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_audit_events_correlation_unique" ON "booking_audit_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "booking_audit_events_booking_timeline_idx" ON "booking_audit_events" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "booking_audit_events_type_created_idx" ON "booking_audit_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_items_booking_sort_unique" ON "booking_items" USING btree ("booking_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_items_booking_quote_item_unique" ON "booking_items" USING btree ("booking_id","quote_item_id");--> statement-breakpoint
CREATE INDEX "booking_items_booking_idx" ON "booking_items" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_occupancies_booking_version_unique" ON "booking_occupancies" USING btree ("booking_id","snapshot_version");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_occupancies_blocking_booking_unique" ON "booking_occupancies" USING btree ("booking_id") WHERE "booking_occupancies"."status" in ('PENDING', 'CONFIRMED');--> statement-breakpoint
CREATE INDEX "booking_occupancies_team_time_idx" ON "booking_occupancies" USING btree ("team_id","operational_start","operational_end");--> statement-breakpoint
CREATE INDEX "booking_occupancies_equipment_time_idx" ON "booking_occupancies" USING btree ("equipment_resource_id","operational_start","operational_end");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_quote_unique" ON "bookings" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_acceptance_unique" ON "bookings" USING btree ("quote_acceptance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_reference_unique" ON "bookings" USING btree ("booking_reference");--> statement-breakpoint
CREATE INDEX "bookings_customer_status_idx" ON "bookings" USING btree ("customer_id","status","created_at");--> statement-breakpoint
CREATE INDEX "bookings_staff_schedule_idx" ON "bookings" USING btree ("scheduling_status","scheduled_start","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_acceptances_quote_unique" ON "quote_acceptances" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quote_acceptances_customer_accepted_idx" ON "quote_acceptances" USING btree ("customer_id","accepted_at");--> statement-breakpoint
ALTER TABLE "booking_occupancies" ADD CONSTRAINT "booking_occupancies_team_no_overlap" EXCLUDE USING gist ("team_id" WITH =, tstzrange("operational_start", "operational_end", '[)') WITH &&) WHERE ("status" in ('PENDING', 'CONFIRMED'));--> statement-breakpoint
ALTER TABLE "booking_occupancies" ADD CONSTRAINT "booking_occupancies_equipment_no_overlap" EXCLUDE USING gist ("equipment_resource_id" WITH =, tstzrange("operational_start", "operational_end", '[)') WITH &&) WHERE ("equipment_resource_id" is not null and "status" in ('PENDING', 'CONFIRMED'));
