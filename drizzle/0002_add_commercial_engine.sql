CREATE TABLE "commercial_condition_bands" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "commercial_condition_bands_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commercial_condition_bands_code_unique" UNIQUE("code"),
	CONSTRAINT "commercial_condition_bands_sort_nonnegative" CHECK ("commercial_condition_bands"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "duration_models" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "duration_models_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(96) NOT NULL,
	"name" varchar(255) NOT NULL,
	"market" varchar(64) NOT NULL,
	"version" integer NOT NULL,
	"status" varchar(32) NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_until" timestamp with time zone,
	"provisional" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "duration_models_code_unique" UNIQUE("code"),
	CONSTRAINT "duration_models_version_positive" CHECK ("duration_models"."version" > 0),
	CONSTRAINT "duration_models_status_valid" CHECK ("duration_models"."status" in ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED')),
	CONSTRAINT "duration_models_effective_window_valid" CHECK ("duration_models"."effective_from" is null or "duration_models"."effective_until" is null or "duration_models"."effective_until" > "duration_models"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "duration_rules" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "duration_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"duration_model_id" integer NOT NULL,
	"code" varchar(160) NOT NULL,
	"rule_type" varchar(40) NOT NULL,
	"label" varchar(255) NOT NULL,
	"service_id" integer,
	"item_type_id" integer,
	"condition_band_id" integer,
	"issue_type_id" integer,
	"addon_id" integer,
	"risk_flag_id" integer,
	"fibre_material_id" integer,
	"treatment_level_id" integer,
	"billing_unit" varchar(24),
	"minutes" integer,
	"multiplier_basis_points" integer,
	"productivity_hundredths_m2_per_hour" integer,
	"manual_assessment_required" boolean DEFAULT false NOT NULL,
	"decline_or_refer_required" boolean DEFAULT false NOT NULL,
	"priority" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "duration_rules_code_unique" UNIQUE("code"),
	CONSTRAINT "duration_rules_type_valid" CHECK ("duration_rules"."rule_type" in ('JOB_SETUP', 'JOB_INSPECTION', 'JOB_CLEANUP', 'ITEM_BASE', 'AREA_PRODUCTIVITY', 'CONDITION_MULTIPLIER', 'ISSUE_COMPLEXITY', 'MATERIAL_SENSITIVITY', 'TREATMENT_COMPLEXITY', 'ADD_ON_TIME', 'CUSTOM_ASSESSMENT')),
	CONSTRAINT "duration_rules_billing_unit_valid" CHECK ("duration_rules"."billing_unit" is null or "duration_rules"."billing_unit" in ('PER_ITEM', 'PER_SIDE', 'PER_SEAT', 'AREA_M2')),
	CONSTRAINT "duration_rules_minutes_nonnegative" CHECK ("duration_rules"."minutes" is null or "duration_rules"."minutes" >= 0),
	CONSTRAINT "duration_rules_multiplier_positive" CHECK ("duration_rules"."multiplier_basis_points" is null or "duration_rules"."multiplier_basis_points" > 0),
	CONSTRAINT "duration_rules_productivity_positive" CHECK ("duration_rules"."productivity_hundredths_m2_per_hour" is null or "duration_rules"."productivity_hundredths_m2_per_hour" > 0),
	CONSTRAINT "duration_rules_priority_nonnegative" CHECK ("duration_rules"."priority" >= 0),
	CONSTRAINT "duration_rules_decline_requires_manual" CHECK ("duration_rules"."decline_or_refer_required" = false or "duration_rules"."manual_assessment_required" = true)
);
--> statement-breakpoint
CREATE TABLE "parking_policies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "parking_policies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parking_policies_code_unique" UNIQUE("code"),
	CONSTRAINT "parking_policies_sort_nonnegative" CHECK ("parking_policies"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "price_books" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "price_books_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(96) NOT NULL,
	"name" varchar(255) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"market" varchar(64) NOT NULL,
	"customer_segment" varchar(32) NOT NULL,
	"version" integer NOT NULL,
	"status" varchar(32) NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_until" timestamp with time zone,
	"vat_mode" varchar(32) NOT NULL,
	"price_basis" varchar(8) NOT NULL,
	"default_vat_rate_basis_points" integer NOT NULL,
	"provisional" boolean DEFAULT true NOT NULL,
	"approved_for_publication" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_books_code_unique" UNIQUE("code"),
	CONSTRAINT "price_books_eur_only" CHECK ("price_books"."currency" = 'EUR'),
	CONSTRAINT "price_books_version_positive" CHECK ("price_books"."version" > 0),
	CONSTRAINT "price_books_status_valid" CHECK ("price_books"."status" in ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED')),
	CONSTRAINT "price_books_segment_valid" CHECK ("price_books"."customer_segment" in ('RESIDENTIAL', 'B2B')),
	CONSTRAINT "price_books_vat_mode_valid" CHECK ("price_books"."vat_mode" in ('VAT_REGISTERED', 'VAT_NOT_REGISTERED')),
	CONSTRAINT "price_books_price_basis_valid" CHECK ("price_books"."price_basis" in ('GROSS', 'NET')),
	CONSTRAINT "price_books_vat_rate_valid" CHECK ("price_books"."default_vat_rate_basis_points" between 0 and 10000),
	CONSTRAINT "price_books_nonregistered_vat_zero" CHECK ("price_books"."vat_mode" <> 'VAT_NOT_REGISTERED' or "price_books"."default_vat_rate_basis_points" = 0),
	CONSTRAINT "price_books_effective_window_valid" CHECK ("price_books"."effective_from" is null or "price_books"."effective_until" is null or "price_books"."effective_until" > "price_books"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "price_rules" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "price_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"price_book_id" integer NOT NULL,
	"code" varchar(160) NOT NULL,
	"rule_type" varchar(40) NOT NULL,
	"label" varchar(255) NOT NULL,
	"adjustment_kind" varchar(32) NOT NULL,
	"service_id" integer,
	"item_type_id" integer,
	"measurement_mode_id" integer,
	"condition_band_id" integer,
	"issue_type_id" integer,
	"addon_id" integer,
	"suggested_addon_id" integer,
	"risk_flag_id" integer,
	"travel_zone_id" integer,
	"timing_category_id" integer,
	"billing_unit" varchar(24),
	"amount_minor_units" integer,
	"percentage_basis_points" integer,
	"measurement_min_hundredths" integer,
	"measurement_max_hundredths" integer,
	"manual_assessment_required" boolean DEFAULT false NOT NULL,
	"decline_or_refer_required" boolean DEFAULT false NOT NULL,
	"priority" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_rules_code_unique" UNIQUE("code"),
	CONSTRAINT "price_rules_type_valid" CHECK ("price_rules"."rule_type" in ('BASE_ITEM', 'PER_AREA_M2', 'PER_ITEM', 'PER_SEAT', 'MINIMUM_VISIT', 'CONDITION_MODIFIER', 'ISSUE_MODIFIER', 'ADD_ON', 'TRAVEL_ZONE', 'TIMING_MODIFIER', 'VOLUME_TIER', 'CUSTOM_ASSESSMENT')),
	CONSTRAINT "price_rules_adjustment_valid" CHECK ("price_rules"."adjustment_kind" in ('NONE', 'FIXED', 'RATE_PER_UNIT', 'PERCENTAGE', 'MANUAL_ASSESSMENT', 'DECLINE_OR_REFER', 'SUGGEST_ADD_ON')),
	CONSTRAINT "price_rules_billing_unit_valid" CHECK ("price_rules"."billing_unit" is null or "price_rules"."billing_unit" in ('PER_ITEM', 'PER_SIDE', 'PER_SEAT', 'AREA_M2')),
	CONSTRAINT "price_rules_percentage_valid" CHECK ("price_rules"."percentage_basis_points" is null or "price_rules"."percentage_basis_points" between -10000 and 100000),
	CONSTRAINT "price_rules_measurement_min_nonnegative" CHECK ("price_rules"."measurement_min_hundredths" is null or "price_rules"."measurement_min_hundredths" >= 0),
	CONSTRAINT "price_rules_measurement_window_valid" CHECK ("price_rules"."measurement_min_hundredths" is null or "price_rules"."measurement_max_hundredths" is null or "price_rules"."measurement_max_hundredths" >= "price_rules"."measurement_min_hundredths"),
	CONSTRAINT "price_rules_priority_nonnegative" CHECK ("price_rules"."priority" >= 0),
	CONSTRAINT "price_rules_decline_requires_manual" CHECK ("price_rules"."decline_or_refer_required" = false or "price_rules"."manual_assessment_required" = true)
);
--> statement-breakpoint
CREATE TABLE "timing_categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "timing_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "timing_categories_code_unique" UNIQUE("code"),
	CONSTRAINT "timing_categories_sort_nonnegative" CHECK ("timing_categories"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "travel_zones" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "travel_zones_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"default_parking_policy_id" integer NOT NULL,
	"distance_threshold_hundredths_km" integer,
	"travel_time_threshold_minutes" integer,
	"boundary_notes" text,
	CONSTRAINT "travel_zones_code_unique" UNIQUE("code"),
	CONSTRAINT "travel_zones_sort_nonnegative" CHECK ("travel_zones"."sort_order" >= 0),
	CONSTRAINT "travel_zones_distance_nonnegative" CHECK ("travel_zones"."distance_threshold_hundredths_km" is null or "travel_zones"."distance_threshold_hundredths_km" >= 0),
	CONSTRAINT "travel_zones_time_nonnegative" CHECK ("travel_zones"."travel_time_threshold_minutes" is null or "travel_zones"."travel_time_threshold_minutes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "duration_rules" ADD CONSTRAINT "duration_rules_duration_model_id_duration_models_id_fk" FOREIGN KEY ("duration_model_id") REFERENCES "public"."duration_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duration_rules" ADD CONSTRAINT "duration_rules_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duration_rules" ADD CONSTRAINT "duration_rules_item_type_id_cleaning_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."cleaning_item_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duration_rules" ADD CONSTRAINT "duration_rules_condition_band_id_commercial_condition_bands_id_fk" FOREIGN KEY ("condition_band_id") REFERENCES "public"."commercial_condition_bands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duration_rules" ADD CONSTRAINT "duration_rules_issue_type_id_issue_types_id_fk" FOREIGN KEY ("issue_type_id") REFERENCES "public"."issue_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duration_rules" ADD CONSTRAINT "duration_rules_addon_id_service_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."service_addons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duration_rules" ADD CONSTRAINT "duration_rules_risk_flag_id_risk_flags_id_fk" FOREIGN KEY ("risk_flag_id") REFERENCES "public"."risk_flags"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duration_rules" ADD CONSTRAINT "duration_rules_fibre_material_id_fibre_materials_id_fk" FOREIGN KEY ("fibre_material_id") REFERENCES "public"."fibre_materials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duration_rules" ADD CONSTRAINT "duration_rules_treatment_level_id_treatment_levels_id_fk" FOREIGN KEY ("treatment_level_id") REFERENCES "public"."treatment_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_price_book_id_price_books_id_fk" FOREIGN KEY ("price_book_id") REFERENCES "public"."price_books"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_item_type_id_cleaning_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."cleaning_item_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_measurement_mode_id_measurement_modes_id_fk" FOREIGN KEY ("measurement_mode_id") REFERENCES "public"."measurement_modes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_condition_band_id_commercial_condition_bands_id_fk" FOREIGN KEY ("condition_band_id") REFERENCES "public"."commercial_condition_bands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_issue_type_id_issue_types_id_fk" FOREIGN KEY ("issue_type_id") REFERENCES "public"."issue_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_addon_id_service_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."service_addons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_suggested_addon_id_service_addons_id_fk" FOREIGN KEY ("suggested_addon_id") REFERENCES "public"."service_addons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_risk_flag_id_risk_flags_id_fk" FOREIGN KEY ("risk_flag_id") REFERENCES "public"."risk_flags"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_travel_zone_id_travel_zones_id_fk" FOREIGN KEY ("travel_zone_id") REFERENCES "public"."travel_zones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_timing_category_id_timing_categories_id_fk" FOREIGN KEY ("timing_category_id") REFERENCES "public"."timing_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_zones" ADD CONSTRAINT "travel_zones_default_parking_policy_id_parking_policies_id_fk" FOREIGN KEY ("default_parking_policy_id") REFERENCES "public"."parking_policies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "duration_rules_model_code_unique" ON "duration_rules" USING btree ("duration_model_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "price_rules_book_code_unique" ON "price_rules" USING btree ("price_book_id","code");