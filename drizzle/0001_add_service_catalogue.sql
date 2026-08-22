CREATE TABLE "capability_statuses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "capability_statuses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capability_statuses_code_unique" UNIQUE("code"),
	CONSTRAINT "capability_statuses_sort_order_nonnegative" CHECK ("capability_statuses"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cleaning_item_type_measurement_modes" (
	"item_type_id" integer NOT NULL,
	"measurement_mode_id" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cleaning_item_type_measurement_modes_item_type_id_measurement_mode_id_pk" PRIMARY KEY("item_type_id","measurement_mode_id")
);
--> statement-breakpoint
CREATE TABLE "cleaning_item_types" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cleaning_item_types_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"category_id" integer NOT NULL,
	CONSTRAINT "cleaning_item_types_code_unique" UNIQUE("code"),
	CONSTRAINT "cleaning_item_types_sort_order_nonnegative" CHECK ("cleaning_item_types"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cleaning_product_categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cleaning_product_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cleaning_product_categories_code_unique" UNIQUE("code"),
	CONSTRAINT "cleaning_product_categories_sort_order_nonnegative" CHECK ("cleaning_product_categories"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cleaning_products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cleaning_products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"manufacturer" varchar(160),
	"product_name" varchar(255) NOT NULL,
	"category_id" integer NOT NULL,
	"intended_application" text,
	"compatible_material_notes" text,
	"dilution_guidance" text,
	"safety_document_reference" text,
	"evidence_document_reference" text,
	"active" boolean DEFAULT true NOT NULL,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cleaning_products_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "condition_levels" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "condition_levels_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "condition_levels_code_unique" UNIQUE("code"),
	CONSTRAINT "condition_levels_sort_order_nonnegative" CHECK ("condition_levels"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "fibre_materials" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fibre_materials_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fibre_materials_code_unique" UNIQUE("code"),
	CONSTRAINT "fibre_materials_sort_order_nonnegative" CHECK ("fibre_materials"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "issue_handling_classifications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "issue_handling_classifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_handling_classifications_code_unique" UNIQUE("code"),
	CONSTRAINT "issue_handling_classifications_sort_order_nonnegative" CHECK ("issue_handling_classifications"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "issue_types" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "issue_types_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"handling_classification_id" integer NOT NULL,
	CONSTRAINT "issue_types_code_unique" UNIQUE("code"),
	CONSTRAINT "issue_types_sort_order_nonnegative" CHECK ("issue_types"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "material_treatment_considerations" (
	"material_id" integer NOT NULL,
	"treatment_level_id" integer NOT NULL,
	"status_id" integer NOT NULL,
	"notes_bg" text NOT NULL,
	"notes_en" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_treatment_considerations_material_id_treatment_level_id_pk" PRIMARY KEY("material_id","treatment_level_id")
);
--> statement-breakpoint
CREATE TABLE "measurement_modes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "measurement_modes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "measurement_modes_code_unique" UNIQUE("code"),
	CONSTRAINT "measurement_modes_sort_order_nonnegative" CHECK ("measurement_modes"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "mechanical_action_levels" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mechanical_action_levels_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mechanical_action_levels_code_unique" UNIQUE("code"),
	CONSTRAINT "mechanical_action_levels_sort_order_nonnegative" CHECK ("mechanical_action_levels"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reuse_advisory_categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reuse_advisory_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reuse_advisory_categories_code_unique" UNIQUE("code"),
	CONSTRAINT "reuse_advisory_categories_sort_order_nonnegative" CHECK ("reuse_advisory_categories"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "risk_flags" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "risk_flags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "risk_flags_code_unique" UNIQUE("code"),
	CONSTRAINT "risk_flags_sort_order_nonnegative" CHECK ("risk_flags"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "service_addon_capabilities" (
	"service_id" integer NOT NULL,
	"addon_id" integer NOT NULL,
	"status_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_addon_capabilities_service_id_addon_id_pk" PRIMARY KEY("service_id","addon_id")
);
--> statement-breakpoint
CREATE TABLE "service_addons" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "service_addons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_addons_code_unique" UNIQUE("code"),
	CONSTRAINT "service_addons_sort_order_nonnegative" CHECK ("service_addons"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "service_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_categories_code_unique" UNIQUE("code"),
	CONSTRAINT "service_categories_sort_order_nonnegative" CHECK ("service_categories"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "service_item_capabilities" (
	"service_id" integer NOT NULL,
	"item_type_id" integer NOT NULL,
	"status_id" integer NOT NULL,
	"inspection_required" boolean DEFAULT true NOT NULL,
	"instant_quote_eligible" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_item_capabilities_service_id_item_type_id_pk" PRIMARY KEY("service_id","item_type_id")
);
--> statement-breakpoint
CREATE TABLE "service_treatment_levels" (
	"service_id" integer NOT NULL,
	"treatment_level_id" integer NOT NULL,
	"status_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_treatment_levels_service_id_treatment_level_id_pk" PRIMARY KEY("service_id","treatment_level_id")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "services_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"category_id" integer NOT NULL,
	"public_slug" varchar(96),
	"base_setup_minutes" integer,
	"duration_minutes_per_unit" numeric(10, 2),
	"complexity_multiplier_eligible" boolean,
	"minimum_service_duration_minutes" integer,
	"inspection_required" boolean DEFAULT true NOT NULL,
	"instant_quote_eligible" boolean DEFAULT false NOT NULL,
	"reuse_advisory_category_id" integer NOT NULL,
	CONSTRAINT "services_code_unique" UNIQUE("code"),
	CONSTRAINT "services_public_slug_unique" UNIQUE("public_slug"),
	CONSTRAINT "services_sort_order_nonnegative" CHECK ("services"."sort_order" >= 0),
	CONSTRAINT "services_base_setup_minutes_nonnegative" CHECK ("services"."base_setup_minutes" is null or "services"."base_setup_minutes" >= 0),
	CONSTRAINT "services_duration_factor_positive" CHECK ("services"."duration_minutes_per_unit" is null or "services"."duration_minutes_per_unit" > 0),
	CONSTRAINT "services_minimum_duration_nonnegative" CHECK ("services"."minimum_service_duration_minutes" is null or "services"."minimum_service_duration_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "surface_constructions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "surface_constructions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "surface_constructions_code_unique" UNIQUE("code"),
	CONSTRAINT "surface_constructions_sort_order_nonnegative" CHECK ("surface_constructions"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "treatment_approaches" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "treatment_approaches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "treatment_approaches_code_unique" UNIQUE("code"),
	CONSTRAINT "treatment_approaches_sort_order_nonnegative" CHECK ("treatment_approaches"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "treatment_levels" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "treatment_levels_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"customer_selectable" boolean DEFAULT false NOT NULL,
	CONSTRAINT "treatment_levels_code_unique" UNIQUE("code"),
	CONSTRAINT "treatment_levels_sort_order_nonnegative" CHECK ("treatment_levels"."sort_order" >= 0),
	CONSTRAINT "treatment_levels_not_customer_selectable" CHECK ("treatment_levels"."customer_selectable" = false)
);
--> statement-breakpoint
ALTER TABLE "cleaning_item_type_measurement_modes" ADD CONSTRAINT "cleaning_item_type_measurement_modes_item_type_id_cleaning_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."cleaning_item_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_item_type_measurement_modes" ADD CONSTRAINT "cleaning_item_type_measurement_modes_measurement_mode_id_measurement_modes_id_fk" FOREIGN KEY ("measurement_mode_id") REFERENCES "public"."measurement_modes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_item_types" ADD CONSTRAINT "cleaning_item_types_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_products" ADD CONSTRAINT "cleaning_products_category_id_cleaning_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."cleaning_product_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_types" ADD CONSTRAINT "issue_types_handling_classification_id_issue_handling_classifications_id_fk" FOREIGN KEY ("handling_classification_id") REFERENCES "public"."issue_handling_classifications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_treatment_considerations" ADD CONSTRAINT "material_treatment_considerations_material_id_fibre_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."fibre_materials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_treatment_considerations" ADD CONSTRAINT "material_treatment_considerations_treatment_level_id_treatment_levels_id_fk" FOREIGN KEY ("treatment_level_id") REFERENCES "public"."treatment_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_treatment_considerations" ADD CONSTRAINT "material_treatment_considerations_status_id_capability_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."capability_statuses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_addon_capabilities" ADD CONSTRAINT "service_addon_capabilities_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_addon_capabilities" ADD CONSTRAINT "service_addon_capabilities_addon_id_service_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."service_addons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_addon_capabilities" ADD CONSTRAINT "service_addon_capabilities_status_id_capability_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."capability_statuses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_item_capabilities" ADD CONSTRAINT "service_item_capabilities_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_item_capabilities" ADD CONSTRAINT "service_item_capabilities_item_type_id_cleaning_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."cleaning_item_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_item_capabilities" ADD CONSTRAINT "service_item_capabilities_status_id_capability_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."capability_statuses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_treatment_levels" ADD CONSTRAINT "service_treatment_levels_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_treatment_levels" ADD CONSTRAINT "service_treatment_levels_treatment_level_id_treatment_levels_id_fk" FOREIGN KEY ("treatment_level_id") REFERENCES "public"."treatment_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_treatment_levels" ADD CONSTRAINT "service_treatment_levels_status_id_capability_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."capability_statuses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_reuse_advisory_category_id_reuse_advisory_categories_id_fk" FOREIGN KEY ("reuse_advisory_category_id") REFERENCES "public"."reuse_advisory_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cleaning_item_type_default_measurement_unique" ON "cleaning_item_type_measurement_modes" USING btree ("item_type_id") WHERE "cleaning_item_type_measurement_modes"."is_default" = true;