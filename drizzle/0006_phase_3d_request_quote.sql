CREATE TABLE "business_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"actor_profile_id" uuid,
	"source" varchar(32) NOT NULL,
	"correlation_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"safe_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_audit_events_entity_type_valid" CHECK ("business_audit_events"."entity_type" in ('SERVICE_REQUEST', 'REQUEST_ESTIMATE', 'QUOTE')),
	CONSTRAINT "business_audit_events_event_type_valid" CHECK ("business_audit_events"."event_type" in ('REQUEST_SUBMITTED', 'REQUEST_LINKED', 'REQUEST_STATUS_CHANGED', 'REQUEST_NORMALIZED', 'ESTIMATE_CREATED', 'QUOTE_DRAFT_CREATED', 'QUOTE_DRAFT_UPDATED', 'QUOTE_ISSUED', 'QUOTE_SUPERSEDED', 'QUOTE_WITHDRAWN', 'QUOTE_EXPIRED')),
	CONSTRAINT "business_audit_events_source_valid" CHECK ("business_audit_events"."source" in ('PUBLIC_WEB', 'CUSTOMER_PORTAL', 'STAFF', 'SYSTEM'))
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"request_item_id" uuid,
	"service_id" integer,
	"cleaning_item_type_id" integer,
	"measurement_mode_id" integer,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"quantity" integer NOT NULL,
	"measurement_snapshot" jsonb NOT NULL,
	"base_amount_minor_units" integer NOT NULL,
	"modifier_amount_minor_units" integer DEFAULT 0 NOT NULL,
	"addon_amount_minor_units" integer DEFAULT 0 NOT NULL,
	"net_amount_minor_units" integer NOT NULL,
	"vat_rate_basis_points" integer NOT NULL,
	"vat_amount_minor_units" integer NOT NULL,
	"gross_total_minor_units" integer NOT NULL,
	"calculation_snapshot" jsonb NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_items_descriptions_not_blank" CHECK (length(trim("quote_items"."description_bg")) > 0 and length(trim("quote_items"."description_en")) > 0),
	CONSTRAINT "quote_items_quantity_positive" CHECK ("quote_items"."quantity" > 0),
	CONSTRAINT "quote_items_amounts_consistent" CHECK ("quote_items"."base_amount_minor_units" >= 0 and "quote_items"."addon_amount_minor_units" >= 0 and "quote_items"."net_amount_minor_units" = "quote_items"."base_amount_minor_units" + "quote_items"."modifier_amount_minor_units" + "quote_items"."addon_amount_minor_units" and "quote_items"."net_amount_minor_units" >= 0 and "quote_items"."vat_amount_minor_units" >= 0 and "quote_items"."gross_total_minor_units" = "quote_items"."net_amount_minor_units" + "quote_items"."vat_amount_minor_units"),
	CONSTRAINT "quote_items_vat_rate_valid" CHECK ("quote_items"."vat_rate_basis_points" between 0 and 10000),
	CONSTRAINT "quote_items_sort_nonnegative" CHECK ("quote_items"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_reference" varchar(40) NOT NULL,
	"request_id" uuid NOT NULL,
	"source_request_version" integer NOT NULL,
	"customer_id" uuid NOT NULL,
	"property_id" uuid,
	"estimate_id" uuid NOT NULL,
	"quote_version" integer NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	"status" varchar(24) DEFAULT 'DRAFT' NOT NULL,
	"currency" varchar(3) NOT NULL,
	"price_basis" varchar(8) NOT NULL,
	"net_amount_minor_units" integer NOT NULL,
	"vat_rate_basis_points" integer NOT NULL,
	"vat_amount_minor_units" integer NOT NULL,
	"gross_total_minor_units" integer NOT NULL,
	"estimated_duration_minutes" integer,
	"commercial_snapshot" jsonb NOT NULL,
	"terms_snapshot" jsonb NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"staff_notes" text,
	"customer_notes" text,
	"issued_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	"updated_by_profile_id" uuid,
	CONSTRAINT "quotes_quote_reference_unique" UNIQUE("quote_reference"),
	CONSTRAINT "quotes_reference_valid" CHECK ("quotes"."quote_reference" ~ '^Q-[A-F0-9]{24}$'),
	CONSTRAINT "quotes_status_valid" CHECK ("quotes"."status" in ('DRAFT', 'ISSUED', 'SUPERSEDED', 'EXPIRED', 'WITHDRAWN')),
	CONSTRAINT "quotes_currency_eur" CHECK ("quotes"."currency" = 'EUR'),
	CONSTRAINT "quotes_price_basis_valid" CHECK ("quotes"."price_basis" in ('NET', 'GROSS')),
	CONSTRAINT "quotes_quote_version_positive" CHECK ("quotes"."quote_version" >= 1),
	CONSTRAINT "quotes_source_request_version_positive" CHECK ("quotes"."source_request_version" >= 1),
	CONSTRAINT "quotes_record_version_positive" CHECK ("quotes"."record_version" >= 1),
	CONSTRAINT "quotes_vat_rate_valid" CHECK ("quotes"."vat_rate_basis_points" between 0 and 10000),
	CONSTRAINT "quotes_amounts_consistent" CHECK ("quotes"."net_amount_minor_units" >= 0 and "quotes"."vat_amount_minor_units" >= 0 and "quotes"."gross_total_minor_units" = "quotes"."net_amount_minor_units" + "quotes"."vat_amount_minor_units"),
	CONSTRAINT "quotes_duration_nonnegative" CHECK ("quotes"."estimated_duration_minutes" is null or "quotes"."estimated_duration_minutes" >= 0),
	CONSTRAINT "quotes_validity_window_valid" CHECK ("quotes"."valid_until" > "quotes"."valid_from"),
	CONSTRAINT "quotes_staff_notes_not_blank" CHECK ("quotes"."staff_notes" is null or length(trim("quotes"."staff_notes")) > 0),
	CONSTRAINT "quotes_customer_notes_not_blank" CHECK ("quotes"."customer_notes" is null or length(trim("quotes"."customer_notes")) > 0),
	CONSTRAINT "quotes_lifecycle_timestamps_consistent" CHECK (("quotes"."status" = 'DRAFT' and "quotes"."issued_at" is null and "quotes"."superseded_at" is null and "quotes"."expired_at" is null and "quotes"."withdrawn_at" is null) or ("quotes"."status" = 'ISSUED' and "quotes"."issued_at" is not null and "quotes"."superseded_at" is null and "quotes"."expired_at" is null and "quotes"."withdrawn_at" is null) or ("quotes"."status" = 'SUPERSEDED' and "quotes"."issued_at" is not null and "quotes"."superseded_at" is not null and "quotes"."expired_at" is null and "quotes"."withdrawn_at" is null) or ("quotes"."status" = 'EXPIRED' and "quotes"."issued_at" is not null and "quotes"."superseded_at" is null and "quotes"."expired_at" is not null and "quotes"."withdrawn_at" is null) or ("quotes"."status" = 'WITHDRAWN' and "quotes"."issued_at" is not null and "quotes"."superseded_at" is null and "quotes"."expired_at" is null and "quotes"."withdrawn_at" is not null)),
	CONSTRAINT "quotes_lifecycle_after_issue" CHECK (("quotes"."superseded_at" is null or "quotes"."superseded_at" >= "quotes"."issued_at") and ("quotes"."expired_at" is null or "quotes"."expired_at" >= "quotes"."issued_at") and ("quotes"."withdrawn_at" is null or "quotes"."withdrawn_at" >= "quotes"."issued_at"))
);
--> statement-breakpoint
CREATE TABLE "request_estimates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"source_request_version" integer NOT NULL,
	"estimate_version" integer NOT NULL,
	"status" varchar(24) NOT NULL,
	"price_book_id" integer NOT NULL,
	"price_book_code" varchar(96) NOT NULL,
	"price_book_version" integer NOT NULL,
	"duration_model_id" integer NOT NULL,
	"duration_model_code" varchar(96) NOT NULL,
	"duration_model_version" integer NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"price_snapshot" jsonb NOT NULL,
	"duration_snapshot" jsonb NOT NULL,
	"availability_snapshot" jsonb NOT NULL,
	"net_amount_minor_units" integer,
	"vat_rate_basis_points" integer NOT NULL,
	"vat_amount_minor_units" integer,
	"gross_total_minor_units" integer,
	"currency" varchar(3) NOT NULL,
	"estimated_service_minutes" integer,
	"estimated_travel_minutes" integer,
	"manual_assessment_required" boolean DEFAULT true NOT NULL,
	"decline_or_refer_required" boolean DEFAULT false NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"review_reason_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"calculated_by_profile_id" uuid,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_estimates_status_valid" CHECK ("request_estimates"."status" in ('CALCULATED', 'REVIEW_REQUIRED', 'DECLINE_OR_REFER')),
	CONSTRAINT "request_estimates_version_positive" CHECK ("request_estimates"."estimate_version" >= 1),
	CONSTRAINT "request_estimates_source_request_version_positive" CHECK ("request_estimates"."source_request_version" >= 1),
	CONSTRAINT "request_estimates_model_versions_positive" CHECK ("request_estimates"."price_book_version" >= 1 and "request_estimates"."duration_model_version" >= 1),
	CONSTRAINT "request_estimates_currency_eur" CHECK ("request_estimates"."currency" = 'EUR'),
	CONSTRAINT "request_estimates_vat_rate_valid" CHECK ("request_estimates"."vat_rate_basis_points" between 0 and 10000),
	CONSTRAINT "request_estimates_amount_group_consistent" CHECK (("request_estimates"."net_amount_minor_units" is null and "request_estimates"."vat_amount_minor_units" is null and "request_estimates"."gross_total_minor_units" is null) or ("request_estimates"."net_amount_minor_units" is not null and "request_estimates"."net_amount_minor_units" >= 0 and "request_estimates"."vat_amount_minor_units" is not null and "request_estimates"."vat_amount_minor_units" >= 0 and "request_estimates"."gross_total_minor_units" = "request_estimates"."net_amount_minor_units" + "request_estimates"."vat_amount_minor_units")),
	CONSTRAINT "request_estimates_minutes_nonnegative" CHECK (("request_estimates"."estimated_service_minutes" is null or "request_estimates"."estimated_service_minutes" >= 0) and ("request_estimates"."estimated_travel_minutes" is null or "request_estimates"."estimated_travel_minutes" >= 0)),
	CONSTRAINT "request_estimates_decline_requires_manual" CHECK ("request_estimates"."decline_or_refer_required" = false or "request_estimates"."manual_assessment_required" = true)
);
--> statement-breakpoint
CREATE TABLE "service_request_item_addons" (
	"request_item_id" uuid NOT NULL,
	"addon_id" integer NOT NULL,
	"customer_requested" boolean DEFAULT false NOT NULL,
	"staff_included" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	CONSTRAINT "service_request_item_addons_request_item_id_addon_id_pk" PRIMARY KEY("request_item_id","addon_id"),
	CONSTRAINT "service_request_item_addons_provenance_present" CHECK ("service_request_item_addons"."customer_requested" = true or "service_request_item_addons"."staff_included" = true),
	CONSTRAINT "service_request_item_addons_notes_not_blank" CHECK ("service_request_item_addons"."notes" is null or length(trim("service_request_item_addons"."notes")) > 0)
);
--> statement-breakpoint
CREATE TABLE "service_request_item_issues" (
	"request_item_id" uuid NOT NULL,
	"issue_type_id" integer NOT NULL,
	"customer_reported" boolean DEFAULT false NOT NULL,
	"staff_confirmed" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	CONSTRAINT "service_request_item_issues_request_item_id_issue_type_id_pk" PRIMARY KEY("request_item_id","issue_type_id"),
	CONSTRAINT "service_request_item_issues_provenance_present" CHECK ("service_request_item_issues"."customer_reported" = true or "service_request_item_issues"."staff_confirmed" = true),
	CONSTRAINT "service_request_item_issues_notes_not_blank" CHECK ("service_request_item_issues"."notes" is null or length(trim("service_request_item_issues"."notes")) > 0)
);
--> statement-breakpoint
CREATE TABLE "service_request_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"service_id" integer,
	"cleaning_item_type_id" integer,
	"cleaning_asset_id" uuid,
	"measurement_mode_id" integer,
	"customer_reported_condition_level_id" integer,
	"normalized_condition_level_id" integer,
	"reported_fibre_material_id" integer,
	"normalized_fibre_material_id" integer,
	"reported_surface_construction_id" integer,
	"normalized_surface_construction_id" integer,
	"customer_description" text NOT NULL,
	"normalized_description" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"area_hundredths_m2" integer,
	"seat_count" integer,
	"sides" integer,
	"sort_order" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	"updated_by_profile_id" uuid,
	CONSTRAINT "service_request_items_customer_description_not_blank" CHECK (length(trim("service_request_items"."customer_description")) > 0),
	CONSTRAINT "service_request_items_normalized_description_not_blank" CHECK ("service_request_items"."normalized_description" is null or length(trim("service_request_items"."normalized_description")) > 0),
	CONSTRAINT "service_request_items_quantity_positive" CHECK ("service_request_items"."quantity" > 0),
	CONSTRAINT "service_request_items_measurements_positive" CHECK (("service_request_items"."area_hundredths_m2" is null or "service_request_items"."area_hundredths_m2" > 0) and ("service_request_items"."seat_count" is null or "service_request_items"."seat_count" > 0)),
	CONSTRAINT "service_request_items_sides_valid" CHECK ("service_request_items"."sides" is null or "service_request_items"."sides" in (1, 2)),
	CONSTRAINT "service_request_items_sort_nonnegative" CHECK ("service_request_items"."sort_order" >= 0),
	CONSTRAINT "service_request_items_version_positive" CHECK ("service_request_items"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_reference" varchar(40) NOT NULL,
	"source" varchar(32) NOT NULL,
	"customer_resolution_status" varchar(32) DEFAULT 'UNRESOLVED' NOT NULL,
	"customer_id" uuid,
	"requesting_profile_id" uuid,
	"property_id" uuid,
	"status" varchar(24) DEFAULT 'SUBMITTED' NOT NULL,
	"preferred_locale" varchar(8) DEFAULT 'bg' NOT NULL,
	"contact_name" varchar(160) NOT NULL,
	"contact_email" varchar(320),
	"contact_phone" varchar(40),
	"customer_notes" text,
	"staff_notes" text,
	"preferred_date" date,
	"preferred_window_code" varchar(64),
	"original_submission" jsonb NOT NULL,
	"manual_review_required" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	"updated_by_profile_id" uuid,
	CONSTRAINT "service_requests_request_reference_unique" UNIQUE("request_reference"),
	CONSTRAINT "service_requests_reference_valid" CHECK ("service_requests"."request_reference" ~ '^REQ-[A-F0-9]{24}$'),
	CONSTRAINT "service_requests_source_valid" CHECK ("service_requests"."source" in ('PUBLIC_WEB', 'CUSTOMER_PORTAL', 'STAFF_CREATED')),
	CONSTRAINT "service_requests_resolution_valid" CHECK ("service_requests"."customer_resolution_status" in ('UNRESOLVED', 'MATCH_CANDIDATE', 'LINKED', 'NEW_CUSTOMER_REQUIRED')),
	CONSTRAINT "service_requests_linked_resolution_consistent" CHECK (("service_requests"."customer_resolution_status" = 'LINKED' and "service_requests"."customer_id" is not null) or ("service_requests"."customer_resolution_status" <> 'LINKED' and "service_requests"."customer_id" is null)),
	CONSTRAINT "service_requests_status_valid" CHECK ("service_requests"."status" in ('SUBMITTED', 'IN_REVIEW', 'NEEDS_REVIEW', 'READY_TO_QUOTE', 'QUOTED', 'CLOSED', 'DECLINED')),
	CONSTRAINT "service_requests_locale_valid" CHECK ("service_requests"."preferred_locale" in ('bg', 'en')),
	CONSTRAINT "service_requests_contact_name_not_blank" CHECK (length(trim("service_requests"."contact_name")) > 0),
	CONSTRAINT "service_requests_contact_channel_present" CHECK ("service_requests"."contact_email" is not null or "service_requests"."contact_phone" is not null),
	CONSTRAINT "service_requests_contact_email_not_blank" CHECK ("service_requests"."contact_email" is null or length(trim("service_requests"."contact_email")) > 0),
	CONSTRAINT "service_requests_contact_phone_not_blank" CHECK ("service_requests"."contact_phone" is null or length(trim("service_requests"."contact_phone")) > 0),
	CONSTRAINT "service_requests_customer_notes_not_blank" CHECK ("service_requests"."customer_notes" is null or length(trim("service_requests"."customer_notes")) > 0),
	CONSTRAINT "service_requests_staff_notes_not_blank" CHECK ("service_requests"."staff_notes" is null or length(trim("service_requests"."staff_notes")) > 0),
	CONSTRAINT "service_requests_preferred_window_not_blank" CHECK ("service_requests"."preferred_window_code" is null or length(trim("service_requests"."preferred_window_code")) > 0),
	CONSTRAINT "service_requests_source_identity_consistent" CHECK (("service_requests"."source" = 'CUSTOMER_PORTAL' and "service_requests"."requesting_profile_id" is not null) or ("service_requests"."source" <> 'CUSTOMER_PORTAL' and "service_requests"."requesting_profile_id" is null)),
	CONSTRAINT "service_requests_source_customer_consistent" CHECK ("service_requests"."source" = 'PUBLIC_WEB' or "service_requests"."customer_id" is not null),
	CONSTRAINT "service_requests_property_requires_customer" CHECK ("service_requests"."property_id" is null or "service_requests"."customer_id" is not null),
	CONSTRAINT "service_requests_version_positive" CHECK ("service_requests"."version" >= 1),
	CONSTRAINT "service_requests_closed_at_consistent" CHECK (("service_requests"."status" = 'CLOSED' and "service_requests"."closed_at" is not null) or ("service_requests"."status" <> 'CLOSED' and "service_requests"."closed_at" is null)),
	CONSTRAINT "service_requests_closed_after_submission" CHECK ("service_requests"."closed_at" is null or "service_requests"."closed_at" >= "service_requests"."submitted_at")
);
--> statement-breakpoint
ALTER TABLE "business_audit_events" ADD CONSTRAINT "business_audit_events_actor_profile_id_user_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_request_item_id_service_request_items_id_fk" FOREIGN KEY ("request_item_id") REFERENCES "public"."service_request_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_cleaning_item_type_id_cleaning_item_types_id_fk" FOREIGN KEY ("cleaning_item_type_id") REFERENCES "public"."cleaning_item_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_measurement_mode_id_measurement_modes_id_fk" FOREIGN KEY ("measurement_mode_id") REFERENCES "public"."measurement_modes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_updated_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "request_estimates_id_request_unique" ON "request_estimates" USING btree ("id","request_id");--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_estimate_request_fk" FOREIGN KEY ("estimate_id","request_id") REFERENCES "public"."request_estimates"("id","request_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_estimates" ADD CONSTRAINT "request_estimates_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_estimates" ADD CONSTRAINT "request_estimates_price_book_id_price_books_id_fk" FOREIGN KEY ("price_book_id") REFERENCES "public"."price_books"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_estimates" ADD CONSTRAINT "request_estimates_duration_model_id_duration_models_id_fk" FOREIGN KEY ("duration_model_id") REFERENCES "public"."duration_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_estimates" ADD CONSTRAINT "request_estimates_calculated_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("calculated_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_item_addons" ADD CONSTRAINT "service_request_item_addons_request_item_id_service_request_items_id_fk" FOREIGN KEY ("request_item_id") REFERENCES "public"."service_request_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_item_addons" ADD CONSTRAINT "service_request_item_addons_addon_id_service_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."service_addons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_item_addons" ADD CONSTRAINT "service_request_item_addons_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_item_issues" ADD CONSTRAINT "service_request_item_issues_request_item_id_service_request_items_id_fk" FOREIGN KEY ("request_item_id") REFERENCES "public"."service_request_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_item_issues" ADD CONSTRAINT "service_request_item_issues_issue_type_id_issue_types_id_fk" FOREIGN KEY ("issue_type_id") REFERENCES "public"."issue_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_item_issues" ADD CONSTRAINT "service_request_item_issues_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_items" ADD CONSTRAINT "service_request_items_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_items" ADD CONSTRAINT "service_request_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_items" ADD CONSTRAINT "service_request_items_cleaning_item_type_id_cleaning_item_types_id_fk" FOREIGN KEY ("cleaning_item_type_id") REFERENCES "public"."cleaning_item_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_items" ADD CONSTRAINT "service_request_items_cleaning_asset_id_cleaning_assets_id_fk" FOREIGN KEY ("cleaning_asset_id") REFERENCES "public"."cleaning_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_items" ADD CONSTRAINT "service_request_items_measurement_mode_id_measurement_modes_id_fk" FOREIGN KEY ("measurement_mode_id") REFERENCES "public"."measurement_modes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_items" ADD CONSTRAINT "service_request_items_customer_reported_condition_level_id_condition_levels_id_fk" FOREIGN KEY ("customer_reported_condition_level_id") REFERENCES "public"."condition_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_items" ADD CONSTRAINT "service_request_items_normalized_condition_level_id_condition_levels_id_fk" FOREIGN KEY ("normalized_condition_level_id") REFERENCES "public"."condition_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_items" ADD CONSTRAINT "service_request_items_reported_fibre_material_id_fibre_materials_id_fk" FOREIGN KEY ("reported_fibre_material_id") REFERENCES "public"."fibre_materials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_items" ADD CONSTRAINT "service_request_items_normalized_fibre_material_id_fibre_materials_id_fk" FOREIGN KEY ("normalized_fibre_material_id") REFERENCES "public"."fibre_materials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_items" ADD CONSTRAINT "service_request_items_reported_surface_construction_id_surface_constructions_id_fk" FOREIGN KEY ("reported_surface_construction_id") REFERENCES "public"."surface_constructions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_items" ADD CONSTRAINT "service_request_items_normalized_surface_construction_id_surface_constructions_id_fk" FOREIGN KEY ("normalized_surface_construction_id") REFERENCES "public"."surface_constructions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_items" ADD CONSTRAINT "service_request_items_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_items" ADD CONSTRAINT "service_request_items_updated_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_requesting_profile_id_user_profiles_id_fk" FOREIGN KEY ("requesting_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_updated_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_audit_events_correlation_unique" ON "business_audit_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "business_audit_events_entity_timeline_idx" ON "business_audit_events" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "business_audit_events_type_created_idx" ON "business_audit_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_items_quote_sort_unique" ON "quote_items" USING btree ("quote_id","sort_order");--> statement-breakpoint
CREATE INDEX "quote_items_quote_idx" ON "quote_items" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_request_version_unique" ON "quotes" USING btree ("request_id","quote_version");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_active_issued_request_unique" ON "quotes" USING btree ("request_id") WHERE "quotes"."status" = 'ISSUED';--> statement-breakpoint
CREATE INDEX "quotes_customer_status_idx" ON "quotes" USING btree ("customer_id","status","created_at");--> statement-breakpoint
CREATE INDEX "quotes_request_created_idx" ON "quotes" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "request_estimates_request_version_unique" ON "request_estimates" USING btree ("request_id","estimate_version");--> statement-breakpoint
CREATE INDEX "request_estimates_request_calculated_idx" ON "request_estimates" USING btree ("request_id","calculated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "service_request_items_request_sort_unique" ON "service_request_items" USING btree ("request_id","sort_order");--> statement-breakpoint
CREATE INDEX "service_request_items_request_idx" ON "service_request_items" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "service_requests_staff_inbox_idx" ON "service_requests" USING btree ("status","manual_review_required","submitted_at");--> statement-breakpoint
CREATE INDEX "service_requests_source_resolution_idx" ON "service_requests" USING btree ("source","customer_resolution_status","submitted_at");--> statement-breakpoint
CREATE INDEX "service_requests_customer_status_idx" ON "service_requests" USING btree ("customer_id","status","submitted_at") WHERE "service_requests"."customer_id" is not null;--> statement-breakpoint
CREATE INDEX "service_requests_requesting_profile_idx" ON "service_requests" USING btree ("requesting_profile_id","submitted_at") WHERE "service_requests"."requesting_profile_id" is not null;
