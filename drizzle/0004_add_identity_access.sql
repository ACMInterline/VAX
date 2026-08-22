CREATE TABLE "application_roles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "application_roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(64) NOT NULL,
	"label_bg" varchar(160) NOT NULL,
	"label_en" varchar(160) NOT NULL,
	"description" text NOT NULL,
	"system_role" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "auth_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"outcome" varchar(16) NOT NULL,
	"actor_profile_id" uuid,
	"subject_profile_id" uuid,
	"correlation_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"safe_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_audit_events_outcome_valid" CHECK ("auth_audit_events"."outcome" in ('SUCCESS', 'FAILURE', 'DENIED')),
	CONSTRAINT "auth_audit_events_type_valid" CHECK ("auth_audit_events"."event_type" in ('SIGNUP_SUCCEEDED', 'LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'LOGOUT_SUCCEEDED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'EMAIL_VERIFICATION_REQUESTED', 'EMAIL_VERIFIED', 'ROLE_ASSIGNED', 'ROLE_REMOVED', 'ACCOUNT_STATUS_CHANGED', 'OWNER_BOOTSTRAPPED'))
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "permissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(96) NOT NULL,
	"description" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_provider_user_id" varchar(255) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"preferred_locale" varchar(8) DEFAULT 'bg' NOT NULL,
	"phone" varchar(40),
	"status" varchar(16) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_auth_provider_user_id_unique" UNIQUE("auth_provider_user_id"),
	CONSTRAINT "user_profiles_locale_valid" CHECK ("user_profiles"."preferred_locale" in ('bg', 'en')),
	CONSTRAINT "user_profiles_status_valid" CHECK ("user_profiles"."status" in ('ACTIVE', 'SUSPENDED', 'DISABLED')),
	CONSTRAINT "user_profiles_display_name_not_blank" CHECK (length(trim("user_profiles"."display_name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_profile_id" uuid NOT NULL,
	"role_id" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"assignment_source" varchar(32) NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by_profile_id" uuid,
	"revoked_at" timestamp with time zone,
	"revoked_by_profile_id" uuid,
	CONSTRAINT "user_roles_user_profile_id_role_id_pk" PRIMARY KEY("user_profile_id","role_id"),
	CONSTRAINT "user_roles_assignment_source_valid" CHECK ("user_roles"."assignment_source" in ('CUSTOMER_SIGNUP', 'OWNER_BOOTSTRAP', 'PRIVILEGED_ASSIGNMENT')),
	CONSTRAINT "user_roles_active_revocation_consistent" CHECK (("user_roles"."active" = true and "user_roles"."revoked_at" is null) or ("user_roles"."active" = false and "user_roles"."revoked_at" is not null)),
	CONSTRAINT "user_roles_revocation_after_assignment" CHECK ("user_roles"."revoked_at" is null or "user_roles"."revoked_at" >= "user_roles"."assigned_at")
);
--> statement-breakpoint
ALTER TABLE "auth_audit_events" ADD CONSTRAINT "auth_audit_events_actor_profile_id_user_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_audit_events" ADD CONSTRAINT "auth_audit_events_subject_profile_id_user_profiles_id_fk" FOREIGN KEY ("subject_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_application_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."application_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_profile_id_user_profiles_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_application_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."application_roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("assigned_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_revoked_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("revoked_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_audit_events_correlation_id_unique" ON "auth_audit_events" USING btree ("correlation_id");