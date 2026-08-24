CREATE TABLE "cleaning_asset_reported_issues" (
	"cleaning_asset_id" uuid NOT NULL,
	"issue_type_id" integer NOT NULL,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	"updated_by_profile_id" uuid,
	CONSTRAINT "cleaning_asset_reported_issues_cleaning_asset_id_issue_type_id_pk" PRIMARY KEY("cleaning_asset_id","issue_type_id"),
	CONSTRAINT "cleaning_asset_reported_issues_notes_not_blank" CHECK ("cleaning_asset_reported_issues"."notes" is null or length(trim("cleaning_asset_reported_issues"."notes")) > 0)
);
--> statement-breakpoint
CREATE TABLE "cleaning_asset_reported_risk_flags" (
	"cleaning_asset_id" uuid NOT NULL,
	"risk_flag_id" integer NOT NULL,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	"updated_by_profile_id" uuid,
	CONSTRAINT "cleaning_asset_reported_risk_flags_cleaning_asset_id_risk_flag_id_pk" PRIMARY KEY("cleaning_asset_id","risk_flag_id"),
	CONSTRAINT "cleaning_asset_reported_risk_flags_notes_not_blank" CHECK ("cleaning_asset_reported_risk_flags"."notes" is null or length(trim("cleaning_asset_reported_risk_flags"."notes")) > 0)
);
--> statement-breakpoint
CREATE TABLE "cleaning_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"area_id" uuid,
	"cleaning_item_type_id" integer NOT NULL,
	"label" varchar(160) NOT NULL,
	"approximate_length_cm" integer,
	"approximate_width_cm" integer,
	"approximate_area_hundredths_m2" integer,
	"approximate_seat_count" integer,
	"reported_fibre_material_id" integer,
	"reported_surface_construction_id" integer,
	"customer_reported_condition_level_id" integer,
	"customer_condition_notes" text,
	"colour_appearance_notes" text,
	"approximate_acquisition_year" integer,
	"status" varchar(16) DEFAULT 'ACTIVE' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"operational_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	"updated_by_profile_id" uuid,
	CONSTRAINT "cleaning_assets_label_not_blank" CHECK (length(trim("cleaning_assets"."label")) > 0),
	CONSTRAINT "cleaning_assets_status_valid" CHECK ("cleaning_assets"."status" in ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
	CONSTRAINT "cleaning_assets_version_positive" CHECK ("cleaning_assets"."version" >= 1),
	CONSTRAINT "cleaning_assets_dimensions_positive" CHECK (("cleaning_assets"."approximate_length_cm" is null or "cleaning_assets"."approximate_length_cm" > 0) and ("cleaning_assets"."approximate_width_cm" is null or "cleaning_assets"."approximate_width_cm" > 0) and ("cleaning_assets"."approximate_area_hundredths_m2" is null or "cleaning_assets"."approximate_area_hundredths_m2" > 0) and ("cleaning_assets"."approximate_seat_count" is null or "cleaning_assets"."approximate_seat_count" > 0)),
	CONSTRAINT "cleaning_assets_acquisition_year_valid" CHECK ("cleaning_assets"."approximate_acquisition_year" is null or "cleaning_assets"."approximate_acquisition_year" between 1800 and 3000)
);
--> statement-breakpoint
CREATE TABLE "customer_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"contact_name" varchar(160) NOT NULL,
	"email" varchar(320),
	"phone" varchar(40),
	"role_title" varchar(160),
	"is_primary" boolean DEFAULT false NOT NULL,
	"preferred_contact_method" varchar(20) DEFAULT 'NO_PREFERENCE' NOT NULL,
	"locale" varchar(8) DEFAULT 'bg' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	"updated_by_profile_id" uuid,
	CONSTRAINT "customer_contacts_name_not_blank" CHECK (length(trim("customer_contacts"."contact_name")) > 0),
	CONSTRAINT "customer_contacts_email_not_blank" CHECK ("customer_contacts"."email" is null or length(trim("customer_contacts"."email")) > 0),
	CONSTRAINT "customer_contacts_phone_not_blank" CHECK ("customer_contacts"."phone" is null or length(trim("customer_contacts"."phone")) > 0),
	CONSTRAINT "customer_contacts_role_title_not_blank" CHECK ("customer_contacts"."role_title" is null or length(trim("customer_contacts"."role_title")) > 0),
	CONSTRAINT "customer_contacts_channel_present" CHECK ("customer_contacts"."email" is not null or "customer_contacts"."phone" is not null),
	CONSTRAINT "customer_contacts_preferred_method_valid" CHECK ("customer_contacts"."preferred_contact_method" in ('EMAIL', 'PHONE', 'NO_PREFERENCE')),
	CONSTRAINT "customer_contacts_preferred_method_channel_present" CHECK (("customer_contacts"."preferred_contact_method" = 'EMAIL' and "customer_contacts"."email" is not null) or ("customer_contacts"."preferred_contact_method" = 'PHONE' and "customer_contacts"."phone" is not null) or "customer_contacts"."preferred_contact_method" = 'NO_PREFERENCE'),
	CONSTRAINT "customer_contacts_locale_valid" CHECK ("customer_contacts"."locale" in ('bg', 'en')),
	CONSTRAINT "customer_contacts_primary_active" CHECK ("customer_contacts"."is_primary" = false or "customer_contacts"."active" = true),
	CONSTRAINT "customer_contacts_version_positive" CHECK ("customer_contacts"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "customer_identity_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_profile_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"relationship_type" varchar(32) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	"revoked_at" timestamp with time zone,
	"revoked_by_profile_id" uuid,
	CONSTRAINT "customer_identity_links_relationship_valid" CHECK ("customer_identity_links"."relationship_type" in ('OWNER', 'PRIMARY_CONTACT', 'AUTHORIZED_CONTACT')),
	CONSTRAINT "customer_identity_links_active_revocation_consistent" CHECK (("customer_identity_links"."active" = true and "customer_identity_links"."revoked_at" is null) or ("customer_identity_links"."active" = false and "customer_identity_links"."revoked_at" is not null)),
	CONSTRAINT "customer_identity_links_revocation_after_creation" CHECK ("customer_identity_links"."revoked_at" is null or "customer_identity_links"."revoked_at" >= "customer_identity_links"."created_at")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_type" varchar(16) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"legal_name" varchar(255),
	"preferred_locale" varchar(8) DEFAULT 'bg' NOT NULL,
	"primary_email" varchar(320),
	"primary_phone" varchar(40),
	"status" varchar(16) DEFAULT 'ACTIVE' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	"updated_by_profile_id" uuid,
	CONSTRAINT "customers_type_valid" CHECK ("customers"."customer_type" in ('INDIVIDUAL', 'BUSINESS')),
	CONSTRAINT "customers_status_valid" CHECK ("customers"."status" in ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
	CONSTRAINT "customers_version_positive" CHECK ("customers"."version" >= 1),
	CONSTRAINT "customers_locale_valid" CHECK ("customers"."preferred_locale" in ('bg', 'en')),
	CONSTRAINT "customers_display_name_not_blank" CHECK (length(trim("customers"."display_name")) > 0),
	CONSTRAINT "customers_legal_name_not_blank" CHECK ("customers"."legal_name" is null or length(trim("customers"."legal_name")) > 0),
	CONSTRAINT "customers_primary_email_not_blank" CHECK ("customers"."primary_email" is null or length(trim("customers"."primary_email")) > 0),
	CONSTRAINT "customers_primary_phone_not_blank" CHECK ("customers"."primary_phone" is null or length(trim("customers"."primary_phone")) > 0)
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"property_type" varchar(40) NOT NULL,
	"label" varchar(160) NOT NULL,
	"city" varchar(160) NOT NULL,
	"district" varchar(160),
	"street_address" text NOT NULL,
	"postal_code" varchar(20),
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"access_notes" text,
	"parking_notes" text,
	"service_zone_id" integer,
	"status" varchar(16) DEFAULT 'ACTIVE' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	"updated_by_profile_id" uuid,
	CONSTRAINT "properties_type_valid" CHECK ("properties"."property_type" in ('RESIDENTIAL', 'OFFICE', 'HOTEL_GUEST_ACCOMMODATION', 'SERVICED_APARTMENT', 'RESTAURANT_CAFE', 'COMMERCIAL_PUBLIC', 'OTHER')),
	CONSTRAINT "properties_status_valid" CHECK ("properties"."status" in ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
	CONSTRAINT "properties_version_positive" CHECK ("properties"."version" >= 1),
	CONSTRAINT "properties_label_not_blank" CHECK (length(trim("properties"."label")) > 0),
	CONSTRAINT "properties_city_not_blank" CHECK (length(trim("properties"."city")) > 0),
	CONSTRAINT "properties_street_address_not_blank" CHECK (length(trim("properties"."street_address")) > 0),
	CONSTRAINT "properties_district_not_blank" CHECK ("properties"."district" is null or length(trim("properties"."district")) > 0),
	CONSTRAINT "properties_postal_code_not_blank" CHECK ("properties"."postal_code" is null or length(trim("properties"."postal_code")) > 0),
	CONSTRAINT "properties_coordinates_complete" CHECK (("properties"."latitude" is null and "properties"."longitude" is null) or ("properties"."latitude" is not null and "properties"."longitude" is not null)),
	CONSTRAINT "properties_coordinates_valid" CHECK (("properties"."latitude" is null or "properties"."latitude" between -90 and 90) and ("properties"."longitude" is null or "properties"."longitude" between -180 and 180))
);
--> statement-breakpoint
CREATE TABLE "property_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"area_type" varchar(32) NOT NULL,
	"custom_label" varchar(160),
	"floor_level" varchar(64),
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	"updated_by_profile_id" uuid,
	CONSTRAINT "property_areas_type_valid" CHECK ("property_areas"."area_type" in ('LIVING_ROOM', 'BEDROOM', 'DINING_ROOM', 'OFFICE', 'RECEPTION', 'CORRIDOR', 'STAIRCASE', 'MEETING_ROOM', 'HOTEL_ROOM', 'OTHER')),
	CONSTRAINT "property_areas_custom_label_not_blank" CHECK ("property_areas"."custom_label" is null or length(trim("property_areas"."custom_label")) > 0),
	CONSTRAINT "property_areas_floor_level_not_blank" CHECK ("property_areas"."floor_level" is null or length(trim("property_areas"."floor_level")) > 0),
	CONSTRAINT "property_areas_other_label_present" CHECK ("property_areas"."area_type" <> 'OTHER' or ("property_areas"."custom_label" is not null and length(trim("property_areas"."custom_label")) > 0)),
	CONSTRAINT "property_areas_version_positive" CHECK ("property_areas"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "cleaning_asset_reported_issues" ADD CONSTRAINT "cleaning_asset_reported_issues_cleaning_asset_id_cleaning_assets_id_fk" FOREIGN KEY ("cleaning_asset_id") REFERENCES "public"."cleaning_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_asset_reported_issues" ADD CONSTRAINT "cleaning_asset_reported_issues_issue_type_id_issue_types_id_fk" FOREIGN KEY ("issue_type_id") REFERENCES "public"."issue_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_asset_reported_issues" ADD CONSTRAINT "cleaning_asset_reported_issues_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_asset_reported_issues" ADD CONSTRAINT "cleaning_asset_reported_issues_updated_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_asset_reported_risk_flags" ADD CONSTRAINT "cleaning_asset_reported_risk_flags_cleaning_asset_id_cleaning_assets_id_fk" FOREIGN KEY ("cleaning_asset_id") REFERENCES "public"."cleaning_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_asset_reported_risk_flags" ADD CONSTRAINT "cleaning_asset_reported_risk_flags_risk_flag_id_risk_flags_id_fk" FOREIGN KEY ("risk_flag_id") REFERENCES "public"."risk_flags"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_asset_reported_risk_flags" ADD CONSTRAINT "cleaning_asset_reported_risk_flags_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_asset_reported_risk_flags" ADD CONSTRAINT "cleaning_asset_reported_risk_flags_updated_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_assets" ADD CONSTRAINT "cleaning_assets_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_assets" ADD CONSTRAINT "cleaning_assets_cleaning_item_type_id_cleaning_item_types_id_fk" FOREIGN KEY ("cleaning_item_type_id") REFERENCES "public"."cleaning_item_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_assets" ADD CONSTRAINT "cleaning_assets_reported_fibre_material_id_fibre_materials_id_fk" FOREIGN KEY ("reported_fibre_material_id") REFERENCES "public"."fibre_materials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_assets" ADD CONSTRAINT "cleaning_assets_reported_surface_construction_id_surface_constructions_id_fk" FOREIGN KEY ("reported_surface_construction_id") REFERENCES "public"."surface_constructions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_assets" ADD CONSTRAINT "cleaning_assets_customer_reported_condition_level_id_condition_levels_id_fk" FOREIGN KEY ("customer_reported_condition_level_id") REFERENCES "public"."condition_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_assets" ADD CONSTRAINT "cleaning_assets_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_assets" ADD CONSTRAINT "cleaning_assets_updated_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "property_areas_id_property_unique" ON "property_areas" USING btree ("id","property_id");--> statement-breakpoint
ALTER TABLE "cleaning_assets" ADD CONSTRAINT "cleaning_assets_area_property_fk" FOREIGN KEY ("area_id","property_id") REFERENCES "public"."property_areas"("id","property_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_updated_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_identity_links" ADD CONSTRAINT "customer_identity_links_user_profile_id_user_profiles_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_identity_links" ADD CONSTRAINT "customer_identity_links_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_identity_links" ADD CONSTRAINT "customer_identity_links_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_identity_links" ADD CONSTRAINT "customer_identity_links_revoked_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("revoked_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_updated_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_service_zone_id_travel_zones_id_fk" FOREIGN KEY ("service_zone_id") REFERENCES "public"."travel_zones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_updated_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_areas" ADD CONSTRAINT "property_areas_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_areas" ADD CONSTRAINT "property_areas_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_areas" ADD CONSTRAINT "property_areas_updated_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cleaning_assets_property_status_idx" ON "cleaning_assets" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "cleaning_assets_area_status_idx" ON "cleaning_assets" USING btree ("area_id","status") WHERE "cleaning_assets"."area_id" is not null;--> statement-breakpoint
CREATE INDEX "cleaning_assets_item_type_status_idx" ON "cleaning_assets" USING btree ("cleaning_item_type_id","status");--> statement-breakpoint
CREATE INDEX "customer_contacts_customer_active_idx" ON "customer_contacts" USING btree ("customer_id","active");--> statement-breakpoint
CREATE INDEX "customer_contacts_email_idx" ON "customer_contacts" USING btree (lower("email")) WHERE "customer_contacts"."email" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_contacts_active_primary_unique" ON "customer_contacts" USING btree ("customer_id") WHERE "customer_contacts"."active" = true and "customer_contacts"."is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_identity_links_active_pair_unique" ON "customer_identity_links" USING btree ("user_profile_id","customer_id") WHERE "customer_identity_links"."active" = true;--> statement-breakpoint
CREATE INDEX "customer_identity_links_customer_active_idx" ON "customer_identity_links" USING btree ("customer_id","active");--> statement-breakpoint
CREATE INDEX "customers_status_type_name_idx" ON "customers" USING btree ("status","customer_type","display_name");--> statement-breakpoint
CREATE INDEX "customers_primary_email_idx" ON "customers" USING btree (lower("primary_email")) WHERE "customers"."primary_email" is not null;--> statement-breakpoint
CREATE INDEX "properties_customer_status_idx" ON "properties" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "property_areas_property_active_idx" ON "property_areas" USING btree ("property_id","active");
