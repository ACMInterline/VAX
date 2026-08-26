CREATE TABLE "business_legal_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(96) NOT NULL,
	"version" integer NOT NULL,
	"environment_scope" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'DRAFT' NOT NULL,
	"legal_name" varchar(255) NOT NULL,
	"registration_number" varchar(64) NOT NULL,
	"vat_number" varchar(64),
	"vat_registration_status" varchar(24) DEFAULT 'UNVERIFIED' NOT NULL,
	"registered_address_line_1" text NOT NULL,
	"registered_address_line_2" text,
	"registered_city" varchar(160) NOT NULL,
	"registered_postal_code" varchar(20),
	"registered_country_code" varchar(2) DEFAULT 'BG' NOT NULL,
	"contact_email" varchar(320),
	"contact_phone" varchar(40),
	"customer_visible_payment_instructions" text,
	"approved_at" timestamp with time zone,
	"approved_by_profile_id" uuid,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	"updated_by_profile_id" uuid,
	CONSTRAINT "business_legal_profiles_environment_valid" CHECK ("business_legal_profiles"."environment_scope" in ('DEVELOPMENT', 'PRODUCTION')),
	CONSTRAINT "business_legal_profiles_status_valid" CHECK ("business_legal_profiles"."status" in ('DRAFT', 'APPROVED', 'SUPERSEDED')),
	CONSTRAINT "business_legal_profiles_version_positive" CHECK ("business_legal_profiles"."version" >= 1),
	CONSTRAINT "business_legal_profiles_required_text_not_blank" CHECK (length(trim("business_legal_profiles"."code")) > 0 and length(trim("business_legal_profiles"."legal_name")) > 0 and length(trim("business_legal_profiles"."registration_number")) > 0 and length(trim("business_legal_profiles"."registered_address_line_1")) > 0 and length(trim("business_legal_profiles"."registered_city")) > 0),
	CONSTRAINT "business_legal_profiles_optional_text_not_blank" CHECK (("business_legal_profiles"."vat_number" is null or length(trim("business_legal_profiles"."vat_number")) > 0) and ("business_legal_profiles"."registered_address_line_2" is null or length(trim("business_legal_profiles"."registered_address_line_2")) > 0) and ("business_legal_profiles"."registered_postal_code" is null or length(trim("business_legal_profiles"."registered_postal_code")) > 0) and ("business_legal_profiles"."contact_email" is null or length(trim("business_legal_profiles"."contact_email")) > 0) and ("business_legal_profiles"."contact_phone" is null or length(trim("business_legal_profiles"."contact_phone")) > 0) and ("business_legal_profiles"."customer_visible_payment_instructions" is null or length(trim("business_legal_profiles"."customer_visible_payment_instructions")) > 0)),
	CONSTRAINT "business_legal_profiles_country_code_valid" CHECK ("business_legal_profiles"."registered_country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "business_legal_profiles_vat_status_valid" CHECK ("business_legal_profiles"."vat_registration_status" in ('VAT_REGISTERED', 'VAT_NOT_REGISTERED', 'UNVERIFIED')),
	CONSTRAINT "business_legal_profiles_vat_status_consistent" CHECK (("business_legal_profiles"."vat_registration_status" = 'VAT_REGISTERED' and "business_legal_profiles"."vat_number" is not null) or ("business_legal_profiles"."vat_registration_status" = 'VAT_NOT_REGISTERED' and "business_legal_profiles"."vat_number" is null) or "business_legal_profiles"."vat_registration_status" = 'UNVERIFIED'),
	CONSTRAINT "business_legal_profiles_lifecycle_consistent" CHECK (("business_legal_profiles"."status" = 'DRAFT' and "business_legal_profiles"."approved_at" is null and "business_legal_profiles"."superseded_at" is null) or ("business_legal_profiles"."status" = 'APPROVED' and "business_legal_profiles"."approved_at" is not null and "business_legal_profiles"."superseded_at" is null) or ("business_legal_profiles"."status" = 'SUPERSEDED' and "business_legal_profiles"."approved_at" is not null and "business_legal_profiles"."superseded_at" is not null and "business_legal_profiles"."superseded_at" >= "business_legal_profiles"."approved_at"))
);
--> statement-breakpoint
CREATE TABLE "customer_billing_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" varchar(16) DEFAULT 'DRAFT' NOT NULL,
	"billing_name" varchar(255) NOT NULL,
	"billing_email" varchar(320),
	"billing_address_line_1" text NOT NULL,
	"billing_address_line_2" text,
	"billing_city" varchar(160) NOT NULL,
	"billing_postal_code" varchar(20),
	"billing_country_code" varchar(2) DEFAULT 'BG' NOT NULL,
	"company_registration_number" varchar(64),
	"vat_number" varchar(64),
	"vat_number_status" varchar(24) DEFAULT 'UNVERIFIED' NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_profile_id" uuid,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	"updated_by_profile_id" uuid,
	CONSTRAINT "customer_billing_profiles_status_valid" CHECK ("customer_billing_profiles"."status" in ('DRAFT', 'APPROVED', 'SUPERSEDED')),
	CONSTRAINT "customer_billing_profiles_version_positive" CHECK ("customer_billing_profiles"."version" >= 1),
	CONSTRAINT "customer_billing_profiles_required_text_not_blank" CHECK (length(trim("customer_billing_profiles"."billing_name")) > 0 and length(trim("customer_billing_profiles"."billing_address_line_1")) > 0 and length(trim("customer_billing_profiles"."billing_city")) > 0),
	CONSTRAINT "customer_billing_profiles_optional_text_not_blank" CHECK (("customer_billing_profiles"."billing_email" is null or length(trim("customer_billing_profiles"."billing_email")) > 0) and ("customer_billing_profiles"."billing_address_line_2" is null or length(trim("customer_billing_profiles"."billing_address_line_2")) > 0) and ("customer_billing_profiles"."billing_postal_code" is null or length(trim("customer_billing_profiles"."billing_postal_code")) > 0) and ("customer_billing_profiles"."company_registration_number" is null or length(trim("customer_billing_profiles"."company_registration_number")) > 0) and ("customer_billing_profiles"."vat_number" is null or length(trim("customer_billing_profiles"."vat_number")) > 0)),
	CONSTRAINT "customer_billing_profiles_country_code_valid" CHECK ("customer_billing_profiles"."billing_country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "customer_billing_profiles_vat_status_valid" CHECK ("customer_billing_profiles"."vat_number_status" in ('UNVERIFIED', 'VERIFIED_FUTURE', 'NOT_APPLICABLE')),
	CONSTRAINT "customer_billing_profiles_vat_status_consistent" CHECK (("customer_billing_profiles"."vat_number_status" = 'VERIFIED_FUTURE' and "customer_billing_profiles"."vat_number" is not null) or ("customer_billing_profiles"."vat_number_status" = 'NOT_APPLICABLE' and "customer_billing_profiles"."vat_number" is null) or "customer_billing_profiles"."vat_number_status" = 'UNVERIFIED'),
	CONSTRAINT "customer_billing_profiles_lifecycle_consistent" CHECK (("customer_billing_profiles"."status" = 'DRAFT' and "customer_billing_profiles"."approved_at" is null and "customer_billing_profiles"."superseded_at" is null) or ("customer_billing_profiles"."status" = 'APPROVED' and "customer_billing_profiles"."approved_at" is not null and "customer_billing_profiles"."superseded_at" is null) or ("customer_billing_profiles"."status" = 'SUPERSEDED' and "customer_billing_profiles"."approved_at" is not null and "customer_billing_profiles"."superseded_at" is not null and "customer_billing_profiles"."superseded_at" >= "customer_billing_profiles"."approved_at"))
);
--> statement-breakpoint
CREATE TABLE "finance_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid,
	"payment_id" uuid,
	"payment_allocation_id" uuid,
	"payment_reversal_id" uuid,
	"event_type" varchar(64) NOT NULL,
	"actor_profile_id" uuid,
	"source" varchar(16) NOT NULL,
	"previous_status" varchar(32),
	"next_status" varchar(32),
	"correlation_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"safe_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_audit_events_scope_present" CHECK ("finance_audit_events"."invoice_id" is not null or "finance_audit_events"."payment_id" is not null or "finance_audit_events"."payment_allocation_id" is not null or "finance_audit_events"."payment_reversal_id" is not null),
	CONSTRAINT "finance_audit_events_type_valid" CHECK ("finance_audit_events"."event_type" in ('INVOICE_DRAFT_CREATED', 'INVOICE_READY', 'INVOICE_ISSUED', 'INVOICE_PARTIALLY_PAID', 'INVOICE_PAID', 'INVOICE_CANCELLED', 'PAYMENT_RECORDED', 'PAYMENT_CONFIRMED', 'PAYMENT_ALLOCATED', 'PAYMENT_ALLOCATION_REVERSED', 'PAYMENT_REVERSED', 'FINANCE_REVIEW_REQUIRED')),
	CONSTRAINT "finance_audit_events_source_valid" CHECK ("finance_audit_events"."source" in ('STAFF', 'SYSTEM')),
	CONSTRAINT "finance_audit_events_status_not_blank" CHECK (("finance_audit_events"."previous_status" is null or length(trim("finance_audit_events"."previous_status")) > 0) and ("finance_audit_events"."next_status" is null or length(trim("finance_audit_events"."next_status")) > 0))
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"quote_item_id" uuid NOT NULL,
	"booking_item_id" uuid NOT NULL,
	"job_id" uuid,
	"job_item_id" uuid,
	"service_id" integer,
	"description_bg" text NOT NULL,
	"description_en" text NOT NULL,
	"quantity" integer NOT NULL,
	"measurement_snapshot" jsonb NOT NULL,
	"net_amount_minor_units" integer NOT NULL,
	"vat_rate_basis_points" integer NOT NULL,
	"vat_amount_minor_units" integer NOT NULL,
	"gross_total_minor_units" integer NOT NULL,
	"provenance_snapshot" jsonb NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_items_job_scope_consistent" CHECK (("invoice_items"."job_id" is null and "invoice_items"."job_item_id" is null) or ("invoice_items"."job_id" is not null and "invoice_items"."job_item_id" is not null)),
	CONSTRAINT "invoice_items_descriptions_not_blank" CHECK (length(trim("invoice_items"."description_bg")) > 0 and length(trim("invoice_items"."description_en")) > 0),
	CONSTRAINT "invoice_items_quantity_positive" CHECK ("invoice_items"."quantity" > 0),
	CONSTRAINT "invoice_items_amounts_consistent" CHECK ("invoice_items"."net_amount_minor_units" >= 0 and "invoice_items"."vat_amount_minor_units" >= 0 and "invoice_items"."gross_total_minor_units" = "invoice_items"."net_amount_minor_units" + "invoice_items"."vat_amount_minor_units"),
	CONSTRAINT "invoice_items_vat_rate_valid" CHECK ("invoice_items"."vat_rate_basis_points" between 0 and 10000),
	CONSTRAINT "invoice_items_sort_nonnegative" CHECK ("invoice_items"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "invoice_numbering_policies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invoice_numbering_policies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(96) NOT NULL,
	"version" integer NOT NULL,
	"environment_scope" varchar(16) NOT NULL,
	"document_type" varchar(24) DEFAULT 'STANDARD' NOT NULL,
	"status" varchar(16) DEFAULT 'DRAFT' NOT NULL,
	"prefix" varchar(32) NOT NULL,
	"padding_width" integer DEFAULT 6 NOT NULL,
	"next_sequence" integer DEFAULT 1 NOT NULL,
	"provisional" boolean DEFAULT true NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_profile_id" uuid,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	"updated_by_profile_id" uuid,
	CONSTRAINT "invoice_numbering_policies_environment_valid" CHECK ("invoice_numbering_policies"."environment_scope" in ('DEVELOPMENT', 'PRODUCTION')),
	CONSTRAINT "invoice_numbering_policies_document_type_valid" CHECK ("invoice_numbering_policies"."document_type" in ('STANDARD', 'PROFORMA', 'CREDIT_NOTE')),
	CONSTRAINT "invoice_numbering_policies_status_valid" CHECK ("invoice_numbering_policies"."status" in ('DRAFT', 'APPROVED', 'SUPERSEDED')),
	CONSTRAINT "invoice_numbering_policies_version_sequence_valid" CHECK ("invoice_numbering_policies"."version" >= 1 and "invoice_numbering_policies"."next_sequence" >= 1 and "invoice_numbering_policies"."padding_width" between 1 and 12),
	CONSTRAINT "invoice_numbering_policies_code_prefix_valid" CHECK (length(trim("invoice_numbering_policies"."code")) > 0 and "invoice_numbering_policies"."prefix" ~ '^[A-Z0-9][A-Z0-9-]{0,31}$'),
	CONSTRAINT "invoice_numbering_policies_production_approved_not_provisional" CHECK ("invoice_numbering_policies"."environment_scope" <> 'PRODUCTION' or "invoice_numbering_policies"."status" <> 'APPROVED' or "invoice_numbering_policies"."provisional" = false),
	CONSTRAINT "invoice_numbering_policies_lifecycle_consistent" CHECK (("invoice_numbering_policies"."status" = 'DRAFT' and "invoice_numbering_policies"."approved_at" is null and "invoice_numbering_policies"."superseded_at" is null) or ("invoice_numbering_policies"."status" = 'APPROVED' and "invoice_numbering_policies"."approved_at" is not null and "invoice_numbering_policies"."superseded_at" is null) or ("invoice_numbering_policies"."status" = 'SUPERSEDED' and "invoice_numbering_policies"."approved_at" is not null and "invoice_numbering_policies"."superseded_at" is not null and "invoice_numbering_policies"."superseded_at" >= "invoice_numbering_policies"."approved_at"))
);
--> statement-breakpoint
CREATE TABLE "invoice_policies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invoice_policies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(96) NOT NULL,
	"version" integer NOT NULL,
	"environment_scope" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'DRAFT' NOT NULL,
	"draft_eligibility" varchar(32) NOT NULL,
	"issue_eligibility" varchar(32) NOT NULL,
	"payment_terms" varchar(24) NOT NULL,
	"default_due_days" integer,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"numbering_policy_id" integer NOT NULL,
	"seller_legal_profile_id" uuid,
	"provisional" boolean DEFAULT true NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_profile_id" uuid,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	"updated_by_profile_id" uuid,
	CONSTRAINT "invoice_policies_environment_valid" CHECK ("invoice_policies"."environment_scope" in ('DEVELOPMENT', 'PRODUCTION')),
	CONSTRAINT "invoice_policies_status_valid" CHECK ("invoice_policies"."status" in ('DRAFT', 'APPROVED', 'SUPERSEDED')),
	CONSTRAINT "invoice_policies_eligibility_valid" CHECK ("invoice_policies"."draft_eligibility" in ('BOOKING_ACCEPTED', 'JOB_COMPLETED') and "invoice_policies"."issue_eligibility" in ('BOOKING_ACCEPTED', 'JOB_COMPLETED')),
	CONSTRAINT "invoice_policies_eligibility_order_valid" CHECK ("invoice_policies"."draft_eligibility" <> 'JOB_COMPLETED' or "invoice_policies"."issue_eligibility" = 'JOB_COMPLETED'),
	CONSTRAINT "invoice_policies_payment_terms_valid" CHECK ("invoice_policies"."payment_terms" in ('PAY_ON_COMPLETION', 'PAY_ON_INVOICE', 'PREPAYMENT', 'CUSTOM')),
	CONSTRAINT "invoice_policies_due_days_consistent" CHECK (("invoice_policies"."payment_terms" = 'CUSTOM' and "invoice_policies"."default_due_days" is null) or ("invoice_policies"."payment_terms" <> 'CUSTOM' and "invoice_policies"."default_due_days" is not null and "invoice_policies"."default_due_days" between 0 and 365)),
	CONSTRAINT "invoice_policies_currency_eur" CHECK ("invoice_policies"."currency" = 'EUR'),
	CONSTRAINT "invoice_policies_version_positive" CHECK ("invoice_policies"."version" >= 1),
	CONSTRAINT "invoice_policies_production_approved_not_provisional" CHECK ("invoice_policies"."environment_scope" <> 'PRODUCTION' or "invoice_policies"."status" <> 'APPROVED' or ("invoice_policies"."provisional" = false and "invoice_policies"."seller_legal_profile_id" is not null)),
	CONSTRAINT "invoice_policies_lifecycle_consistent" CHECK (("invoice_policies"."status" = 'DRAFT' and "invoice_policies"."approved_at" is null and "invoice_policies"."superseded_at" is null) or ("invoice_policies"."status" = 'APPROVED' and "invoice_policies"."approved_at" is not null and "invoice_policies"."superseded_at" is null) or ("invoice_policies"."status" = 'SUPERSEDED' and "invoice_policies"."approved_at" is not null and "invoice_policies"."superseded_at" is not null and "invoice_policies"."superseded_at" >= "invoice_policies"."approved_at"))
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_reference" varchar(40) NOT NULL,
	"invoice_number" varchar(96),
	"invoice_policy_id" integer NOT NULL,
	"invoice_policy_code" varchar(96) NOT NULL,
	"invoice_policy_version" integer NOT NULL,
	"environment_scope" varchar(16) NOT NULL,
	"numbering_policy_id" integer,
	"numbering_policy_code" varchar(96),
	"numbering_policy_version" integer,
	"numbering_sequence" integer,
	"request_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"quote_acceptance_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"job_id" uuid,
	"customer_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"customer_billing_profile_id" uuid,
	"customer_billing_profile_version" integer,
	"seller_legal_profile_id" uuid,
	"seller_legal_profile_version" integer,
	"type" varchar(24) DEFAULT 'STANDARD' NOT NULL,
	"status" varchar(24) DEFAULT 'DRAFT' NOT NULL,
	"finance_review_status" varchar(16) DEFAULT 'REQUIRED' NOT NULL,
	"finance_review_reason_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"issue_date" date,
	"due_date" date,
	"currency" varchar(3) NOT NULL,
	"price_basis" varchar(8) NOT NULL,
	"vat_mode" varchar(24) NOT NULL,
	"vat_basis" varchar(24) NOT NULL,
	"net_amount_minor_units" integer NOT NULL,
	"vat_rate_basis_points" integer NOT NULL,
	"vat_amount_minor_units" integer NOT NULL,
	"gross_total_minor_units" integer NOT NULL,
	"paid_amount_minor_units" integer DEFAULT 0 NOT NULL,
	"outstanding_amount_minor_units" integer GENERATED ALWAYS AS ("gross_total_minor_units" - "paid_amount_minor_units") STORED,
	"customer_snapshot" jsonb NOT NULL,
	"seller_snapshot" jsonb NOT NULL,
	"commercial_snapshot" jsonb NOT NULL,
	"terms_snapshot" jsonb NOT NULL,
	"provenance_snapshot" jsonb NOT NULL,
	"eligibility_snapshot" jsonb NOT NULL,
	"internal_notes" text,
	"customer_visible_notes" text,
	"creation_idempotency_key" uuid NOT NULL,
	"creation_fingerprint" varchar(64) NOT NULL,
	"issue_idempotency_key" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid,
	"issued_at" timestamp with time zone,
	"issued_by_profile_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_profile_id" uuid,
	CONSTRAINT "invoices_reference_valid" CHECK ("invoices"."invoice_reference" ~ '^INV-[A-F0-9]{24}$'),
	CONSTRAINT "invoices_environment_valid" CHECK ("invoices"."environment_scope" in ('DEVELOPMENT', 'PRODUCTION')),
	CONSTRAINT "invoices_fingerprint_valid" CHECK ("invoices"."creation_fingerprint" ~ '^[A-Fa-f0-9]{64}$'),
	CONSTRAINT "invoices_type_valid" CHECK ("invoices"."type" in ('STANDARD', 'PROFORMA', 'CREDIT_NOTE')),
	CONSTRAINT "invoices_status_valid" CHECK ("invoices"."status" in ('DRAFT', 'READY_TO_ISSUE', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'CREDITED_FUTURE')),
	CONSTRAINT "invoices_review_status_valid" CHECK ("invoices"."finance_review_status" in ('CLEAR', 'REQUIRED')),
	CONSTRAINT "invoices_review_reasons_consistent" CHECK (jsonb_typeof("invoices"."finance_review_reason_codes") = 'array' and (("invoices"."finance_review_status" = 'CLEAR' and jsonb_array_length("invoices"."finance_review_reason_codes") = 0) or ("invoices"."finance_review_status" = 'REQUIRED' and jsonb_array_length("invoices"."finance_review_reason_codes") > 0))),
	CONSTRAINT "invoices_currency_eur" CHECK ("invoices"."currency" = 'EUR'),
	CONSTRAINT "invoices_price_basis_valid" CHECK ("invoices"."price_basis" in ('NET', 'GROSS')),
	CONSTRAINT "invoices_vat_mode_valid" CHECK ("invoices"."vat_mode" in ('VAT_REGISTERED', 'VAT_NOT_REGISTERED')),
	CONSTRAINT "invoices_vat_basis_valid" CHECK ("invoices"."vat_basis" in ('NET', 'GROSS', 'NOT_REGISTERED')),
	CONSTRAINT "invoices_amounts_consistent" CHECK ("invoices"."net_amount_minor_units" >= 0 and "invoices"."vat_amount_minor_units" >= 0 and "invoices"."gross_total_minor_units" = "invoices"."net_amount_minor_units" + "invoices"."vat_amount_minor_units" and "invoices"."paid_amount_minor_units" between 0 and "invoices"."gross_total_minor_units"),
	CONSTRAINT "invoices_vat_rate_valid" CHECK ("invoices"."vat_rate_basis_points" between 0 and 10000),
	CONSTRAINT "invoices_vat_configuration_consistent" CHECK (("invoices"."vat_mode" = 'VAT_NOT_REGISTERED' and "invoices"."vat_basis" = 'NOT_REGISTERED' and "invoices"."vat_rate_basis_points" = 0 and "invoices"."vat_amount_minor_units" = 0 and "invoices"."net_amount_minor_units" = "invoices"."gross_total_minor_units") or ("invoices"."vat_mode" = 'VAT_REGISTERED' and "invoices"."vat_basis" = "invoices"."price_basis")),
	CONSTRAINT "invoices_profile_references_consistent" CHECK (("invoices"."customer_billing_profile_id" is null and "invoices"."customer_billing_profile_version" is null) or ("invoices"."customer_billing_profile_id" is not null and "invoices"."customer_billing_profile_version" is not null and "invoices"."customer_billing_profile_version" >= 1)),
	CONSTRAINT "invoices_seller_references_consistent" CHECK (("invoices"."seller_legal_profile_id" is null and "invoices"."seller_legal_profile_version" is null) or ("invoices"."seller_legal_profile_id" is not null and "invoices"."seller_legal_profile_version" is not null and "invoices"."seller_legal_profile_version" >= 1)),
	CONSTRAINT "invoices_numbering_fields_consistent" CHECK (("invoices"."invoice_number" is null and "invoices"."numbering_policy_id" is null and "invoices"."numbering_policy_code" is null and "invoices"."numbering_policy_version" is null and "invoices"."numbering_sequence" is null) or ("invoices"."invoice_number" is not null and "invoices"."numbering_policy_id" is not null and "invoices"."numbering_policy_code" is not null and "invoices"."numbering_policy_version" is not null and "invoices"."numbering_policy_version" >= 1 and "invoices"."numbering_sequence" is not null and "invoices"."numbering_sequence" >= 1)),
	CONSTRAINT "invoices_lifecycle_consistent" CHECK (("invoices"."status" in ('DRAFT', 'READY_TO_ISSUE') and "invoices"."invoice_number" is null and "invoices"."issue_date" is null and "invoices"."due_date" is null and "invoices"."issued_at" is null and "invoices"."issued_by_profile_id" is null and "invoices"."cancelled_at" is null and "invoices"."cancelled_by_profile_id" is null) or ("invoices"."status" = 'CANCELLED' and "invoices"."invoice_number" is null and "invoices"."issue_date" is null and "invoices"."due_date" is null and "invoices"."issued_at" is null and "invoices"."issued_by_profile_id" is null and "invoices"."cancelled_at" is not null) or ("invoices"."status" in ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'CREDITED_FUTURE') and "invoices"."invoice_number" is not null and "invoices"."issue_date" is not null and "invoices"."due_date" is not null and "invoices"."issued_at" is not null and "invoices"."cancelled_at" is null and "invoices"."cancelled_by_profile_id" is null)),
	CONSTRAINT "invoices_issue_dates_consistent" CHECK ("invoices"."issue_date" is null or ("invoices"."due_date" is not null and "invoices"."due_date" >= "invoices"."issue_date")),
	CONSTRAINT "invoices_ready_to_issue_complete" CHECK ("invoices"."status" not in ('READY_TO_ISSUE', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CREDITED_FUTURE') or ("invoices"."finance_review_status" = 'CLEAR' and "invoices"."customer_billing_profile_id" is not null and "invoices"."seller_legal_profile_id" is not null)),
	CONSTRAINT "invoices_settlement_status_consistent" CHECK (("invoices"."status" in ('DRAFT', 'READY_TO_ISSUE', 'ISSUED', 'CANCELLED') and "invoices"."paid_amount_minor_units" = 0) or ("invoices"."status" = 'PARTIALLY_PAID' and "invoices"."paid_amount_minor_units" > 0 and "invoices"."paid_amount_minor_units" < "invoices"."gross_total_minor_units") or ("invoices"."status" = 'PAID' and "invoices"."gross_total_minor_units" > 0 and "invoices"."paid_amount_minor_units" = "invoices"."gross_total_minor_units") or "invoices"."status" = 'CREDITED_FUTURE'),
	CONSTRAINT "invoices_version_positive" CHECK ("invoices"."version" >= 1 and "invoices"."invoice_policy_version" >= 1),
	CONSTRAINT "invoices_optional_notes_not_blank" CHECK (("invoices"."internal_notes" is null or length(trim("invoices"."internal_notes")) > 0) and ("invoices"."customer_visible_notes" is null or length(trim("invoices"."customer_visible_notes")) > 0))
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"allocation_reference" varchar(40) NOT NULL,
	"entry_type" varchar(16) DEFAULT 'ALLOCATION' NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount_minor_units" integer NOT NULL,
	"reverses_allocation_id" uuid,
	"reversed_entry_type" varchar(16),
	"idempotency_key" uuid NOT NULL,
	"idempotency_fingerprint" varchar(64) NOT NULL,
	"allocated_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_allocations_reference_valid" CHECK ("payment_allocations"."allocation_reference" ~ '^PAL-[A-F0-9]{24}$'),
	CONSTRAINT "payment_allocations_fingerprint_valid" CHECK ("payment_allocations"."idempotency_fingerprint" ~ '^[A-Fa-f0-9]{64}$'),
	CONSTRAINT "payment_allocations_entry_type_valid" CHECK ("payment_allocations"."entry_type" in ('ALLOCATION', 'REVERSAL')),
	CONSTRAINT "payment_allocations_currency_eur" CHECK ("payment_allocations"."currency" = 'EUR'),
	CONSTRAINT "payment_allocations_amount_positive" CHECK ("payment_allocations"."amount_minor_units" > 0),
	CONSTRAINT "payment_allocations_reversal_consistent" CHECK (("payment_allocations"."entry_type" = 'ALLOCATION' and "payment_allocations"."reverses_allocation_id" is null and "payment_allocations"."reversed_entry_type" is null) or ("payment_allocations"."entry_type" = 'REVERSAL' and "payment_allocations"."reverses_allocation_id" is not null and "payment_allocations"."reversed_entry_type" = 'ALLOCATION'))
);
--> statement-breakpoint
CREATE TABLE "payment_reversals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reversal_reference" varchar(40) NOT NULL,
	"payment_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount_minor_units" integer NOT NULL,
	"reason_category" varchar(32) NOT NULL,
	"reason_text" text,
	"idempotency_key" uuid NOT NULL,
	"idempotency_fingerprint" varchar(64) NOT NULL,
	"reversed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reversed_by_profile_id" uuid,
	CONSTRAINT "payment_reversals_reference_valid" CHECK ("payment_reversals"."reversal_reference" ~ '^PRV-[A-F0-9]{24}$'),
	CONSTRAINT "payment_reversals_fingerprint_valid" CHECK ("payment_reversals"."idempotency_fingerprint" ~ '^[A-Fa-f0-9]{64}$'),
	CONSTRAINT "payment_reversals_reason_category_valid" CHECK ("payment_reversals"."reason_category" in ('DUPLICATE', 'ENTRY_ERROR', 'BANK_RETURN', 'OTHER')),
	CONSTRAINT "payment_reversals_currency_eur" CHECK ("payment_reversals"."currency" = 'EUR'),
	CONSTRAINT "payment_reversals_amount_positive" CHECK ("payment_reversals"."amount_minor_units" > 0),
	CONSTRAINT "payment_reversals_reason_text_consistent" CHECK (("payment_reversals"."reason_text" is null or length(trim("payment_reversals"."reason_text")) > 0) and ("payment_reversals"."reason_category" <> 'OTHER' or "payment_reversals"."reason_text" is not null))
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_reference" varchar(40) NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'RECORDED' NOT NULL,
	"method" varchar(32) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount_minor_units" integer NOT NULL,
	"allocated_amount_minor_units" integer DEFAULT 0 NOT NULL,
	"unallocated_amount_minor_units" integer GENERATED ALWAYS AS ("amount_minor_units" - "allocated_amount_minor_units") STORED,
	"received_at" timestamp with time zone NOT NULL,
	"external_reference" varchar(255),
	"recording_idempotency_key" uuid NOT NULL,
	"recording_fingerprint" varchar(64) NOT NULL,
	"recorded_by_profile_id" uuid,
	"confirmed_at" timestamp with time zone,
	"confirmed_by_profile_id" uuid,
	"reversed_at" timestamp with time zone,
	"reversed_by_profile_id" uuid,
	"internal_notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_reference_valid" CHECK ("payments"."payment_reference" ~ '^PAY-[A-F0-9]{24}$'),
	CONSTRAINT "payments_fingerprint_valid" CHECK ("payments"."recording_fingerprint" ~ '^[A-Fa-f0-9]{64}$'),
	CONSTRAINT "payments_status_valid" CHECK ("payments"."status" in ('RECORDED', 'CONFIRMED', 'REVERSED')),
	CONSTRAINT "payments_method_valid" CHECK ("payments"."method" in ('BANK_TRANSFER', 'CASH', 'CARD_MANUAL_REFERENCE', 'OTHER')),
	CONSTRAINT "payments_currency_eur" CHECK ("payments"."currency" = 'EUR'),
	CONSTRAINT "payments_amounts_consistent" CHECK ("payments"."amount_minor_units" > 0 and "payments"."allocated_amount_minor_units" between 0 and "payments"."amount_minor_units"),
	CONSTRAINT "payments_lifecycle_consistent" CHECK (("payments"."status" = 'RECORDED' and "payments"."confirmed_at" is null and "payments"."confirmed_by_profile_id" is null and "payments"."reversed_at" is null and "payments"."reversed_by_profile_id" is null) or ("payments"."status" = 'CONFIRMED' and "payments"."confirmed_at" is not null and "payments"."reversed_at" is null and "payments"."reversed_by_profile_id" is null) or ("payments"."status" = 'REVERSED' and "payments"."reversed_at" is not null)),
	CONSTRAINT "payments_timestamps_ordered" CHECK (("payments"."confirmed_at" is null or "payments"."confirmed_at" >= "payments"."received_at") and ("payments"."reversed_at" is null or "payments"."reversed_at" >= "payments"."received_at")),
	CONSTRAINT "payments_version_positive" CHECK ("payments"."version" >= 1),
	CONSTRAINT "payments_optional_text_not_blank" CHECK (("payments"."external_reference" is null or length(trim("payments"."external_reference")) > 0) and ("payments"."internal_notes" is null or length(trim("payments"."internal_notes")) > 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "business_legal_profiles_id_version_environment_unique" ON "business_legal_profiles" USING btree ("id","version","environment_scope");--> statement-breakpoint
CREATE UNIQUE INDEX "business_legal_profiles_id_environment_unique" ON "business_legal_profiles" USING btree ("id","environment_scope");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_billing_profiles_id_customer_version_unique" ON "customer_billing_profiles" USING btree ("id","customer_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_numbering_policies_id_code_version_environment_unique" ON "invoice_numbering_policies" USING btree ("id","code","version","environment_scope");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_numbering_policies_id_environment_unique" ON "invoice_numbering_policies" USING btree ("id","environment_scope");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_policies_id_code_version_environment_unique" ON "invoice_policies" USING btree ("id","code","version","environment_scope");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_id_customer_currency_unique" ON "invoices" USING btree ("id","customer_id","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_id_booking_quote_unique" ON "invoices" USING btree ("id","booking_id","quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_allocations_reversal_provenance_unique" ON "payment_allocations" USING btree ("id","payment_id","invoice_id","customer_id","currency","amount_minor_units","entry_type");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_id_customer_currency_unique" ON "payments" USING btree ("id","customer_id","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_reversal_provenance_unique" ON "payments" USING btree ("id","customer_id","currency","amount_minor_units");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_items_id_quote_unique" ON "quote_items" USING btree ("id","quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_items_id_booking_quote_item_unique" ON "booking_items" USING btree ("id","booking_id","quote_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_id_commercial_provenance_unique" ON "bookings" USING btree ("id","request_id","quote_id","quote_acceptance_id","customer_id","property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_items_id_job_booking_item_unique" ON "job_items" USING btree ("id","job_id","booking_item_id");--> statement-breakpoint
ALTER TABLE "business_legal_profiles" ADD CONSTRAINT "business_legal_profiles_approved_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("approved_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_legal_profiles" ADD CONSTRAINT "business_legal_profiles_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_legal_profiles" ADD CONSTRAINT "business_legal_profiles_updated_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_billing_profiles" ADD CONSTRAINT "customer_billing_profiles_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_billing_profiles" ADD CONSTRAINT "customer_billing_profiles_approved_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("approved_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_billing_profiles" ADD CONSTRAINT "customer_billing_profiles_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_billing_profiles" ADD CONSTRAINT "customer_billing_profiles_updated_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_audit_events" ADD CONSTRAINT "finance_audit_events_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_audit_events" ADD CONSTRAINT "finance_audit_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_audit_events" ADD CONSTRAINT "finance_audit_events_payment_allocation_id_payment_allocations_id_fk" FOREIGN KEY ("payment_allocation_id") REFERENCES "public"."payment_allocations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_audit_events" ADD CONSTRAINT "finance_audit_events_payment_reversal_id_payment_reversals_id_fk" FOREIGN KEY ("payment_reversal_id") REFERENCES "public"."payment_reversals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_audit_events" ADD CONSTRAINT "finance_audit_events_actor_profile_id_user_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_quote_item_id_quote_items_id_fk" FOREIGN KEY ("quote_item_id") REFERENCES "public"."quote_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_scope_fk" FOREIGN KEY ("invoice_id","booking_id","quote_id") REFERENCES "public"."invoices"("id","booking_id","quote_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_booking_item_scope_fk" FOREIGN KEY ("booking_item_id","booking_id","quote_item_id") REFERENCES "public"."booking_items"("id","booking_id","quote_item_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_quote_item_scope_fk" FOREIGN KEY ("quote_item_id","quote_id") REFERENCES "public"."quote_items"("id","quote_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_job_item_scope_fk" FOREIGN KEY ("job_item_id","job_id","booking_item_id") REFERENCES "public"."job_items"("id","job_id","booking_item_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_numbering_policies" ADD CONSTRAINT "invoice_numbering_policies_approved_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("approved_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_numbering_policies" ADD CONSTRAINT "invoice_numbering_policies_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_numbering_policies" ADD CONSTRAINT "invoice_numbering_policies_updated_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_policies" ADD CONSTRAINT "invoice_policies_approved_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("approved_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_policies" ADD CONSTRAINT "invoice_policies_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_policies" ADD CONSTRAINT "invoice_policies_updated_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_policies" ADD CONSTRAINT "invoice_policies_numbering_environment_fk" FOREIGN KEY ("numbering_policy_id","environment_scope") REFERENCES "public"."invoice_numbering_policies"("id","environment_scope") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_policies" ADD CONSTRAINT "invoice_policies_seller_environment_fk" FOREIGN KEY ("seller_legal_profile_id","environment_scope") REFERENCES "public"."business_legal_profiles"("id","environment_scope") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issued_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("issued_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_cancelled_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("cancelled_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_acceptance_provenance_fk" FOREIGN KEY ("quote_acceptance_id","quote_id","request_id","customer_id","property_id") REFERENCES "public"."quote_acceptances"("id","quote_id","request_id","customer_id","property_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_commercial_provenance_fk" FOREIGN KEY ("booking_id","request_id","quote_id","quote_acceptance_id","customer_id","property_id") REFERENCES "public"."bookings"("id","request_id","quote_id","quote_acceptance_id","customer_id","property_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_booking_property_fk" FOREIGN KEY ("job_id","booking_id","property_id") REFERENCES "public"."jobs"("id","booking_id","property_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_billing_profile_fk" FOREIGN KEY ("customer_billing_profile_id","customer_id","customer_billing_profile_version") REFERENCES "public"."customer_billing_profiles"("id","customer_id","version") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_seller_legal_profile_fk" FOREIGN KEY ("seller_legal_profile_id","seller_legal_profile_version","environment_scope") REFERENCES "public"."business_legal_profiles"("id","version","environment_scope") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_policy_provenance_fk" FOREIGN KEY ("invoice_policy_id","invoice_policy_code","invoice_policy_version","environment_scope") REFERENCES "public"."invoice_policies"("id","code","version","environment_scope") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_numbering_policy_provenance_fk" FOREIGN KEY ("numbering_policy_id","numbering_policy_code","numbering_policy_version","environment_scope") REFERENCES "public"."invoice_numbering_policies"("id","code","version","environment_scope") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_allocated_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("allocated_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_scope_fk" FOREIGN KEY ("payment_id","customer_id","currency") REFERENCES "public"."payments"("id","customer_id","currency") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_scope_fk" FOREIGN KEY ("invoice_id","customer_id","currency") REFERENCES "public"."invoices"("id","customer_id","currency") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_reversal_scope_fk" FOREIGN KEY ("reverses_allocation_id","payment_id","invoice_id","customer_id","currency","amount_minor_units","reversed_entry_type") REFERENCES "public"."payment_allocations"("id","payment_id","invoice_id","customer_id","currency","amount_minor_units","entry_type") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reversals" ADD CONSTRAINT "payment_reversals_reversed_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("reversed_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reversals" ADD CONSTRAINT "payment_reversals_payment_provenance_fk" FOREIGN KEY ("payment_id","customer_id","currency","amount_minor_units") REFERENCES "public"."payments"("id","customer_id","currency","amount_minor_units") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("recorded_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_confirmed_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("confirmed_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reversed_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("reversed_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_legal_profiles_code_version_unique" ON "business_legal_profiles" USING btree ("code","version");--> statement-breakpoint
CREATE UNIQUE INDEX "business_legal_profiles_id_version_unique" ON "business_legal_profiles" USING btree ("id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "business_legal_profiles_current_approved_unique" ON "business_legal_profiles" USING btree ("environment_scope") WHERE "business_legal_profiles"."status" = 'APPROVED';--> statement-breakpoint
CREATE UNIQUE INDEX "customer_billing_profiles_customer_version_unique" ON "customer_billing_profiles" USING btree ("customer_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_billing_profiles_current_approved_unique" ON "customer_billing_profiles" USING btree ("customer_id") WHERE "customer_billing_profiles"."status" = 'APPROVED';--> statement-breakpoint
CREATE INDEX "customer_billing_profiles_customer_status_idx" ON "customer_billing_profiles" USING btree ("customer_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_audit_events_correlation_unique" ON "finance_audit_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "finance_audit_events_invoice_lifecycle_version_unique" ON "finance_audit_events" USING btree ("invoice_id",("safe_metadata" ->> 'invoiceVersion')) WHERE "finance_audit_events"."invoice_id" is not null and "finance_audit_events"."event_type" in ('INVOICE_DRAFT_CREATED', 'INVOICE_READY', 'INVOICE_ISSUED', 'INVOICE_CANCELLED', 'FINANCE_REVIEW_REQUIRED');--> statement-breakpoint
CREATE UNIQUE INDEX "finance_audit_events_payment_lifecycle_version_unique" ON "finance_audit_events" USING btree ("payment_id",("safe_metadata" ->> 'paymentVersion')) WHERE "finance_audit_events"."payment_id" is not null and "finance_audit_events"."event_type" in ('PAYMENT_RECORDED', 'PAYMENT_CONFIRMED', 'PAYMENT_REVERSED');--> statement-breakpoint
CREATE UNIQUE INDEX "finance_audit_events_allocation_event_unique" ON "finance_audit_events" USING btree ("payment_allocation_id","event_type") WHERE "finance_audit_events"."payment_allocation_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "finance_audit_events_allocation_invoice_settlement_unique" ON "finance_audit_events" USING btree ("payment_allocation_id") WHERE "finance_audit_events"."payment_allocation_id" is not null and "finance_audit_events"."event_type" in ('INVOICE_PARTIALLY_PAID', 'INVOICE_PAID');--> statement-breakpoint
CREATE INDEX "finance_audit_events_invoice_timeline_idx" ON "finance_audit_events" USING btree ("invoice_id","created_at") WHERE "finance_audit_events"."invoice_id" is not null;--> statement-breakpoint
CREATE INDEX "finance_audit_events_payment_timeline_idx" ON "finance_audit_events" USING btree ("payment_id","created_at") WHERE "finance_audit_events"."payment_id" is not null;--> statement-breakpoint
CREATE INDEX "finance_audit_events_type_created_idx" ON "finance_audit_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_items_invoice_sort_unique" ON "invoice_items" USING btree ("invoice_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_items_invoice_booking_item_unique" ON "invoice_items" USING btree ("invoice_id","booking_item_id");--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_idx" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_numbering_policies_code_version_unique" ON "invoice_numbering_policies" USING btree ("code","version");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_numbering_policies_id_code_version_unique" ON "invoice_numbering_policies" USING btree ("id","code","version");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_numbering_policies_current_approved_unique" ON "invoice_numbering_policies" USING btree ("environment_scope","document_type") WHERE "invoice_numbering_policies"."status" = 'APPROVED';--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_policies_code_version_unique" ON "invoice_policies" USING btree ("code","version");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_policies_id_code_version_unique" ON "invoice_policies" USING btree ("id","code","version");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_policies_current_approved_unique" ON "invoice_policies" USING btree ("environment_scope") WHERE "invoice_policies"."status" = 'APPROVED';--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_reference_unique" ON "invoices" USING btree ("invoice_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_unique" ON "invoices" USING btree ("invoice_number") WHERE "invoices"."invoice_number" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_numbering_sequence_unique" ON "invoices" USING btree ("numbering_policy_id","numbering_sequence") WHERE "invoices"."numbering_policy_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_creation_idempotency_unique" ON "invoices" USING btree ("creation_idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_issue_idempotency_unique" ON "invoices" USING btree ("issue_idempotency_key") WHERE "invoices"."issue_idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_live_standard_booking_unique" ON "invoices" USING btree ("booking_id") WHERE "invoices"."type" = 'STANDARD' and "invoices"."status" <> 'CANCELLED';--> statement-breakpoint
CREATE INDEX "invoices_staff_status_due_idx" ON "invoices" USING btree ("status","due_date","created_at");--> statement-breakpoint
CREATE INDEX "invoices_customer_status_created_idx" ON "invoices" USING btree ("customer_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_allocations_reference_unique" ON "payment_allocations" USING btree ("allocation_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_allocations_idempotency_unique" ON "payment_allocations" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_allocations_reversal_once_unique" ON "payment_allocations" USING btree ("reverses_allocation_id") WHERE "payment_allocations"."reverses_allocation_id" is not null;--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_created_idx" ON "payment_allocations" USING btree ("payment_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_allocations_invoice_created_idx" ON "payment_allocations" USING btree ("invoice_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_reversals_reference_unique" ON "payment_reversals" USING btree ("reversal_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_reversals_payment_unique" ON "payment_reversals" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_reversals_idempotency_unique" ON "payment_reversals" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_reference_unique" ON "payments" USING btree ("payment_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_recording_idempotency_unique" ON "payments" USING btree ("recording_idempotency_key");--> statement-breakpoint
CREATE INDEX "payments_customer_status_received_idx" ON "payments" USING btree ("customer_id","status","received_at");--> statement-breakpoint
CREATE FUNCTION "vax_finance_guard_versioned_config"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_row jsonb;
  new_row jsonb;
  immutable_old jsonb;
  immutable_new jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'finance configuration rows cannot be deleted'
      USING ERRCODE = '23514';
  END IF;

  new_row := to_jsonb(NEW);

  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by_profile_id IS NULL
       OR (NEW.status = 'APPROVED'
         AND NEW.approved_by_profile_id IS NULL) THEN
      RAISE EXCEPTION 'finance configuration transitions require actor attribution'
        USING ERRCODE = '23514';
    END IF;
    IF TG_TABLE_NAME = 'invoice_policies'
       AND NEW.status = 'APPROVED'
       AND NOT EXISTS (
         SELECT 1
         FROM public.invoice_numbering_policies numbering
         LEFT JOIN public.business_legal_profiles seller
           ON seller.id = (new_row ->> 'seller_legal_profile_id')::uuid
         WHERE numbering.id = (new_row ->> 'numbering_policy_id')::integer
           AND numbering.environment_scope = (new_row ->> 'environment_scope')
           AND numbering.document_type = 'STANDARD'
           AND numbering.status = 'APPROVED'
           AND ((new_row ->> 'environment_scope') <> 'PRODUCTION' OR numbering.provisional = false)
           AND (
             new_row ->> 'seller_legal_profile_id' IS NULL
             OR (
               seller.environment_scope = (new_row ->> 'environment_scope')
               AND seller.status = 'APPROVED'
             )
           )
           AND (
             (new_row ->> 'environment_scope') <> 'PRODUCTION'
             OR (
               (new_row ->> 'provisional')::boolean = false
               AND new_row ->> 'seller_legal_profile_id' IS NOT NULL
             )
           )
       ) THEN
      RAISE EXCEPTION 'invoice policy approval references unapproved or cross-environment configuration'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  old_row := to_jsonb(OLD);

  -- Preserve ON DELETE SET NULL for historical actor references without
  -- opening any commercial field to mutation.
  IF (new_row - ARRAY['approved_by_profile_id', 'created_by_profile_id', 'updated_by_profile_id']::text[]) =
       (old_row - ARRAY['approved_by_profile_id', 'created_by_profile_id', 'updated_by_profile_id']::text[])
     AND (NEW.approved_by_profile_id IS NOT DISTINCT FROM OLD.approved_by_profile_id
       OR (NEW.approved_by_profile_id IS NULL AND NOT EXISTS (
         SELECT 1 FROM public.user_profiles profile
         WHERE profile.id = OLD.approved_by_profile_id
       )))
     AND (NEW.created_by_profile_id IS NOT DISTINCT FROM OLD.created_by_profile_id
       OR (NEW.created_by_profile_id IS NULL AND NOT EXISTS (
         SELECT 1 FROM public.user_profiles profile
         WHERE profile.id = OLD.created_by_profile_id
       )))
     AND (NEW.updated_by_profile_id IS NOT DISTINCT FROM OLD.updated_by_profile_id
       OR (NEW.updated_by_profile_id IS NULL AND NOT EXISTS (
         SELECT 1 FROM public.user_profiles profile
         WHERE profile.id = OLD.updated_by_profile_id
     ))) THEN
    RETURN NEW;
  END IF;

  IF NEW.created_by_profile_id IS DISTINCT FROM OLD.created_by_profile_id
     OR (OLD.approved_by_profile_id IS NOT NULL
       AND NEW.approved_by_profile_id IS DISTINCT FROM OLD.approved_by_profile_id)
     OR (NEW.status = 'DRAFT' AND NEW.approved_by_profile_id IS NOT NULL) THEN
    RAISE EXCEPTION 'finance configuration actor history is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF (OLD.status = 'DRAFT' AND NEW.status = 'APPROVED'
       AND (NEW.approved_by_profile_id IS NULL
         OR NEW.updated_by_profile_id IS NULL))
     OR (OLD.status = 'APPROVED' AND NEW.status = 'SUPERSEDED'
       AND NEW.updated_by_profile_id IS NULL) THEN
    RAISE EXCEPTION 'finance configuration transitions require actor attribution'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.updated_by_profile_id IS NULL THEN
    RAISE EXCEPTION 'finance configuration updates require actor attribution'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.status = 'SUPERSEDED' THEN
    RAISE EXCEPTION 'superseded finance configuration is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.status = 'DRAFT' AND NEW.status NOT IN ('DRAFT', 'APPROVED') THEN
    RAISE EXCEPTION 'draft finance configuration must be approved before supersession'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.status = 'APPROVED' THEN
    immutable_old := old_row - ARRAY[
      'status', 'superseded_at', 'updated_at', 'updated_by_profile_id'
    ]::text[];
    immutable_new := new_row - ARRAY[
      'status', 'superseded_at', 'updated_at', 'updated_by_profile_id'
    ]::text[];
    IF NEW.status <> 'SUPERSEDED'
       OR NEW.superseded_at IS NULL
       OR immutable_new IS DISTINCT FROM immutable_old THEN
      RAISE EXCEPTION 'approved finance configuration may only be superseded'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'invoice_policies'
     AND OLD.status = 'DRAFT'
     AND NEW.status = 'APPROVED'
     AND NOT EXISTS (
       SELECT 1
       FROM public.invoice_numbering_policies numbering
       LEFT JOIN public.business_legal_profiles seller
         ON seller.id = (new_row ->> 'seller_legal_profile_id')::uuid
       WHERE numbering.id = (new_row ->> 'numbering_policy_id')::integer
         AND numbering.environment_scope = (new_row ->> 'environment_scope')
         AND numbering.document_type = 'STANDARD'
         AND numbering.status = 'APPROVED'
         AND ((new_row ->> 'environment_scope') <> 'PRODUCTION' OR numbering.provisional = false)
         AND (
           new_row ->> 'seller_legal_profile_id' IS NULL
           OR (
             seller.environment_scope = (new_row ->> 'environment_scope')
             AND seller.status = 'APPROVED'
           )
         )
         AND (
           (new_row ->> 'environment_scope') <> 'PRODUCTION'
           OR (
             (new_row ->> 'provisional')::boolean = false
             AND new_row ->> 'seller_legal_profile_id' IS NOT NULL
           )
         )
     ) THEN
    RAISE EXCEPTION 'invoice policy approval references unapproved or cross-environment configuration'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "business_legal_profiles_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "business_legal_profiles"
FOR EACH ROW EXECUTE FUNCTION "vax_finance_guard_versioned_config"();--> statement-breakpoint
CREATE TRIGGER "customer_billing_profiles_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "customer_billing_profiles"
FOR EACH ROW EXECUTE FUNCTION "vax_finance_guard_versioned_config"();--> statement-breakpoint
CREATE TRIGGER "invoice_policies_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "invoice_policies"
FOR EACH ROW EXECUTE FUNCTION "vax_finance_guard_versioned_config"();--> statement-breakpoint

CREATE FUNCTION "vax_finance_guard_numbering_policy"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_row jsonb;
  new_row jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'invoice numbering policies cannot be deleted'
      USING ERRCODE = '23514';
  END IF;

  new_row := to_jsonb(NEW);

  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by_profile_id IS NULL
       OR (NEW.status = 'APPROVED'
         AND NEW.approved_by_profile_id IS NULL) THEN
      RAISE EXCEPTION 'finance configuration transitions require actor attribution'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  old_row := to_jsonb(OLD);

  IF (new_row - ARRAY['approved_by_profile_id', 'created_by_profile_id', 'updated_by_profile_id']::text[]) =
       (old_row - ARRAY['approved_by_profile_id', 'created_by_profile_id', 'updated_by_profile_id']::text[])
     AND (NEW.approved_by_profile_id IS NOT DISTINCT FROM OLD.approved_by_profile_id
       OR (NEW.approved_by_profile_id IS NULL AND NOT EXISTS (
         SELECT 1 FROM public.user_profiles profile
         WHERE profile.id = OLD.approved_by_profile_id
       )))
     AND (NEW.created_by_profile_id IS NOT DISTINCT FROM OLD.created_by_profile_id
       OR (NEW.created_by_profile_id IS NULL AND NOT EXISTS (
         SELECT 1 FROM public.user_profiles profile
         WHERE profile.id = OLD.created_by_profile_id
       )))
     AND (NEW.updated_by_profile_id IS NOT DISTINCT FROM OLD.updated_by_profile_id
       OR (NEW.updated_by_profile_id IS NULL AND NOT EXISTS (
         SELECT 1 FROM public.user_profiles profile
         WHERE profile.id = OLD.updated_by_profile_id
     ))) THEN
    RETURN NEW;
  END IF;

  IF NEW.created_by_profile_id IS DISTINCT FROM OLD.created_by_profile_id
     OR (OLD.approved_by_profile_id IS NOT NULL
       AND NEW.approved_by_profile_id IS DISTINCT FROM OLD.approved_by_profile_id)
     OR (NEW.status = 'DRAFT' AND NEW.approved_by_profile_id IS NOT NULL) THEN
    RAISE EXCEPTION 'finance configuration actor history is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF (OLD.status = 'DRAFT' AND NEW.status = 'APPROVED'
       AND (NEW.approved_by_profile_id IS NULL
         OR NEW.updated_by_profile_id IS NULL))
     OR (OLD.status = 'APPROVED' AND NEW.status = 'SUPERSEDED'
       AND NEW.updated_by_profile_id IS NULL)
     OR (OLD.status = 'APPROVED' AND NEW.status = 'APPROVED'
       AND NEW.next_sequence <> OLD.next_sequence
       AND NEW.updated_by_profile_id IS NULL) THEN
    RAISE EXCEPTION 'finance configuration transitions require actor attribution'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.updated_by_profile_id IS NULL THEN
    RAISE EXCEPTION 'finance configuration updates require actor attribution'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.status = 'SUPERSEDED' THEN
    RAISE EXCEPTION 'superseded numbering policy is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.status = 'DRAFT' AND NEW.status NOT IN ('DRAFT', 'APPROVED') THEN
    RAISE EXCEPTION 'draft numbering policy must be approved before supersession'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.status = 'APPROVED' AND NEW.status = 'APPROVED' THEN
    IF NEW.next_sequence <> OLD.next_sequence + 1
       OR (new_row - ARRAY['next_sequence', 'updated_at', 'updated_by_profile_id']::text[]) IS DISTINCT FROM
          (old_row - ARRAY['next_sequence', 'updated_at', 'updated_by_profile_id']::text[]) THEN
      RAISE EXCEPTION 'approved numbering counter must advance exactly once'
        USING ERRCODE = '23514';
    END IF;
  ELSIF OLD.status = 'APPROVED' THEN
    IF NEW.status <> 'SUPERSEDED'
       OR NEW.next_sequence <> OLD.next_sequence
       OR NEW.superseded_at IS NULL
       OR (new_row - ARRAY['status', 'superseded_at', 'updated_at', 'updated_by_profile_id']::text[]) IS DISTINCT FROM
          (old_row - ARRAY['status', 'superseded_at', 'updated_at', 'updated_by_profile_id']::text[]) THEN
      RAISE EXCEPTION 'approved numbering policy may only advance or be superseded'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "invoice_numbering_policies_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "invoice_numbering_policies"
FOR EACH ROW EXECUTE FUNCTION "vax_finance_guard_numbering_policy"();--> statement-breakpoint

CREATE FUNCTION "vax_finance_validate_number_allocation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'APPROVED' AND NEW.next_sequence = OLD.next_sequence + 1
     AND NOT EXISTS (
       SELECT 1
       FROM public.invoices invoice
       WHERE invoice.numbering_policy_id = NEW.id
         AND invoice.numbering_sequence = NEW.next_sequence - 1
         AND invoice.status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID')
         AND invoice.invoice_number = NEW.prefix || lpad(
           (NEW.next_sequence - 1)::text,
           greatest(NEW.padding_width, length((NEW.next_sequence - 1)::text)),
           '0'
         )
     ) THEN
    RAISE EXCEPTION 'numbering counter advance has no matching issued invoice'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "invoice_numbering_allocation_integrity"
AFTER UPDATE ON "invoice_numbering_policies"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "vax_finance_validate_number_allocation"();--> statement-breakpoint

CREATE FUNCTION "vax_finance_guard_append_ledger"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  actor_column text;
  old_row jsonb;
  new_row jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'finance ledger and audit rows cannot be deleted'
      USING ERRCODE = '23514';
  END IF;

  actor_column := CASE TG_TABLE_NAME
    WHEN 'payment_allocations' THEN 'allocated_by_profile_id'
    WHEN 'payment_reversals' THEN 'reversed_by_profile_id'
    WHEN 'finance_audit_events' THEN 'actor_profile_id'
    ELSE NULL
  END;
  IF actor_column IS NOT NULL THEN
    old_row := to_jsonb(OLD);
    new_row := to_jsonb(NEW);
    IF (new_row - actor_column) = (old_row - actor_column)
       AND new_row -> actor_column = 'null'::jsonb
       AND (
         old_row ->> actor_column IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM public.user_profiles profile
           WHERE profile.id = (old_row ->> actor_column)::uuid
         )
       ) THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'finance ledger and audit rows are append-only'
    USING ERRCODE = '23514';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "invoice_items_append_only"
BEFORE UPDATE OR DELETE ON "invoice_items"
FOR EACH ROW EXECUTE FUNCTION "vax_finance_guard_append_ledger"();--> statement-breakpoint
CREATE TRIGGER "payment_allocations_append_only"
BEFORE UPDATE OR DELETE ON "payment_allocations"
FOR EACH ROW EXECUTE FUNCTION "vax_finance_guard_append_ledger"();--> statement-breakpoint
CREATE TRIGGER "payment_reversals_append_only"
BEFORE UPDATE OR DELETE ON "payment_reversals"
FOR EACH ROW EXECUTE FUNCTION "vax_finance_guard_append_ledger"();--> statement-breakpoint
CREATE TRIGGER "finance_audit_events_append_only"
BEFORE UPDATE OR DELETE ON "finance_audit_events"
FOR EACH ROW EXECUTE FUNCTION "vax_finance_guard_append_ledger"();--> statement-breakpoint

CREATE FUNCTION "vax_finance_require_operation_actor"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  row_data jsonb := to_jsonb(NEW);
BEGIN
  IF (TG_TABLE_NAME = 'invoices'
       AND row_data ->> 'created_by_profile_id' IS NULL)
     OR (TG_TABLE_NAME = 'payments'
       AND row_data ->> 'recorded_by_profile_id' IS NULL)
     OR (TG_TABLE_NAME = 'payment_allocations'
       AND row_data ->> 'allocated_by_profile_id' IS NULL)
     OR (TG_TABLE_NAME = 'payment_reversals'
       AND row_data ->> 'reversed_by_profile_id' IS NULL)
     OR (TG_TABLE_NAME = 'finance_audit_events'
       AND row_data ->> 'source' = 'STAFF'
       AND row_data ->> 'actor_profile_id' IS NULL) THEN
    RAISE EXCEPTION 'staff finance operations require actor attribution'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "invoices_actor_required"
BEFORE INSERT ON "invoices"
FOR EACH ROW EXECUTE FUNCTION "vax_finance_require_operation_actor"();--> statement-breakpoint
CREATE TRIGGER "payments_actor_required"
BEFORE INSERT ON "payments"
FOR EACH ROW EXECUTE FUNCTION "vax_finance_require_operation_actor"();--> statement-breakpoint
CREATE TRIGGER "payment_allocations_actor_required"
BEFORE INSERT ON "payment_allocations"
FOR EACH ROW EXECUTE FUNCTION "vax_finance_require_operation_actor"();--> statement-breakpoint
CREATE TRIGGER "payment_reversals_actor_required"
BEFORE INSERT ON "payment_reversals"
FOR EACH ROW EXECUTE FUNCTION "vax_finance_require_operation_actor"();--> statement-breakpoint
CREATE TRIGGER "finance_audit_events_actor_required"
BEFORE INSERT ON "finance_audit_events"
FOR EACH ROW EXECUTE FUNCTION "vax_finance_require_operation_actor"();--> statement-breakpoint

CREATE FUNCTION "vax_finance_guard_invoice"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_row jsonb;
  new_row jsonb;
  expected_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'invoices cannot be deleted'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.type <> 'STANDARD'
       OR NEW.status NOT IN ('DRAFT', 'READY_TO_ISSUE')
       OR NEW.version <> 1
       OR NEW.paid_amount_minor_units <> 0 THEN
      RAISE EXCEPTION 'finance documents must enter through the standard draft boundary'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  old_row := to_jsonb(OLD);
  new_row := to_jsonb(NEW);

  -- Historical actor references use ON DELETE SET NULL. Permit only that
  -- referential action, never actor replacement or commercial mutation.
  IF (new_row - ARRAY[
        'created_by_profile_id', 'issued_by_profile_id',
        'cancelled_by_profile_id', 'outstanding_amount_minor_units'
      ]::text[]) =
       (old_row - ARRAY[
        'created_by_profile_id', 'issued_by_profile_id',
        'cancelled_by_profile_id', 'outstanding_amount_minor_units'
      ]::text[])
     AND (NEW.created_by_profile_id IS NOT DISTINCT FROM OLD.created_by_profile_id
       OR (NEW.created_by_profile_id IS NULL AND NOT EXISTS (
         SELECT 1 FROM public.user_profiles profile
         WHERE profile.id = OLD.created_by_profile_id
       )))
     AND (NEW.issued_by_profile_id IS NOT DISTINCT FROM OLD.issued_by_profile_id
       OR (NEW.issued_by_profile_id IS NULL AND NOT EXISTS (
         SELECT 1 FROM public.user_profiles profile
         WHERE profile.id = OLD.issued_by_profile_id
       )))
     AND (NEW.cancelled_by_profile_id IS NOT DISTINCT FROM OLD.cancelled_by_profile_id
       OR (NEW.cancelled_by_profile_id IS NULL AND NOT EXISTS (
         SELECT 1 FROM public.user_profiles profile
         WHERE profile.id = OLD.cancelled_by_profile_id
       ))) THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('DRAFT', 'READY_TO_ISSUE') AND NEW.status = 'CANCELLED' THEN
    IF NEW.version <> OLD.version + 1
       OR NEW.cancelled_at IS NULL
       OR NEW.cancelled_by_profile_id IS NULL
       OR (new_row - ARRAY[
          'status', 'cancelled_at', 'cancelled_by_profile_id',
          'internal_notes', 'updated_at', 'version',
          'outstanding_amount_minor_units'
        ]::text[]) IS DISTINCT FROM
          (old_row - ARRAY[
          'status', 'cancelled_at', 'cancelled_by_profile_id',
          'internal_notes', 'updated_at', 'version',
          'outstanding_amount_minor_units'
        ]::text[]) THEN
      RAISE EXCEPTION 'invalid invoice cancellation mutation'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF (
       OLD.status = 'READY_TO_ISSUE'
       OR (
         OLD.status = 'DRAFT'
         AND OLD.finance_review_status = 'REQUIRED'
         AND OLD.finance_review_reason_codes = '["JOB_COMPLETION_REQUIRED"]'::jsonb
       )
     )
     AND NEW.status = 'ISSUED' THEN
    IF NEW.version <> OLD.version + 1
       OR NEW.issued_at IS NULL
       OR NEW.issued_by_profile_id IS NULL
       OR NEW.issue_idempotency_key IS NULL
       OR NEW.finance_review_status <> 'CLEAR'
       OR NEW.finance_review_reason_codes <> '[]'::jsonb
       OR (OLD.status = 'READY_TO_ISSUE' AND (
         OLD.finance_review_status <> 'CLEAR'
         OR OLD.finance_review_reason_codes <> '[]'::jsonb
       ))
       OR (new_row - ARRAY[
          'invoice_number', 'numbering_policy_id', 'numbering_policy_code',
          'numbering_policy_version', 'numbering_sequence', 'status',
          'finance_review_status', 'finance_review_reason_codes',
          'issue_date', 'due_date', 'issue_idempotency_key', 'updated_at',
          'version', 'issued_at', 'issued_by_profile_id',
          'outstanding_amount_minor_units'
        ]::text[]) IS DISTINCT FROM
          (old_row - ARRAY[
          'invoice_number', 'numbering_policy_id', 'numbering_policy_code',
          'numbering_policy_version', 'numbering_sequence', 'status',
          'finance_review_status', 'finance_review_reason_codes',
          'issue_date', 'due_date', 'issue_idempotency_key', 'updated_at',
          'version', 'issued_at', 'issued_by_profile_id',
          'outstanding_amount_minor_units'
        ]::text[]) THEN
      RAISE EXCEPTION 'issued invoice content or provenance changed'
        USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.invoice_policies policy
      JOIN public.invoice_numbering_policies numbering
        ON numbering.id = policy.numbering_policy_id
       AND numbering.environment_scope = policy.environment_scope
      JOIN public.business_legal_profiles seller
        ON seller.id = policy.seller_legal_profile_id
       AND seller.environment_scope = policy.environment_scope
      JOIN public.customer_billing_profiles billing
        ON billing.id = NEW.customer_billing_profile_id
       AND billing.customer_id = NEW.customer_id
       AND billing.version = NEW.customer_billing_profile_version
      JOIN public.bookings booking
        ON booking.id = NEW.booking_id
       AND booking.request_id = NEW.request_id
       AND booking.quote_id = NEW.quote_id
       AND booking.quote_acceptance_id = NEW.quote_acceptance_id
       AND booking.customer_id = NEW.customer_id
       AND booking.property_id = NEW.property_id
      JOIN public.quote_acceptances acceptance
        ON acceptance.id = NEW.quote_acceptance_id
       AND acceptance.quote_id = NEW.quote_id
       AND acceptance.request_id = NEW.request_id
       AND acceptance.customer_id = NEW.customer_id
       AND acceptance.property_id = NEW.property_id
      JOIN public.quotes quote
        ON quote.id = NEW.quote_id
       AND quote.request_id = NEW.request_id
       AND quote.customer_id = NEW.customer_id
       AND quote.property_id = NEW.property_id
      JOIN public.customers customer ON customer.id = NEW.customer_id
      LEFT JOIN public.jobs job
        ON job.id = NEW.job_id
       AND job.booking_id = NEW.booking_id
       AND job.property_id = NEW.property_id
      WHERE policy.id = NEW.invoice_policy_id
        AND policy.code = NEW.invoice_policy_code
        AND policy.version = NEW.invoice_policy_version
        AND policy.environment_scope = NEW.environment_scope
        AND policy.status = 'APPROVED'
        AND policy.default_due_days IS NOT NULL
        AND policy.currency = NEW.currency
        AND policy.seller_legal_profile_id = NEW.seller_legal_profile_id
        AND numbering.id = NEW.numbering_policy_id
        AND numbering.code = NEW.numbering_policy_code
        AND numbering.version = NEW.numbering_policy_version
        AND numbering.status = 'APPROVED'
        AND numbering.document_type = 'STANDARD'
        AND seller.id = NEW.seller_legal_profile_id
        AND seller.version = NEW.seller_legal_profile_version
        AND seller.status = 'APPROVED'
        AND billing.status = 'APPROVED'
        AND NEW.type = 'STANDARD'
        AND NEW.finance_review_status = 'CLEAR'
        AND jsonb_array_length(NEW.finance_review_reason_codes) = 0
        AND NEW.paid_amount_minor_units = 0
        AND NEW.invoice_number = numbering.prefix || lpad(
          NEW.numbering_sequence::text,
          greatest(numbering.padding_width, length(NEW.numbering_sequence::text)),
          '0'
        )
        AND NEW.issue_date = (transaction_timestamp() AT TIME ZONE 'Europe/Sofia')::date
        AND NEW.due_date = NEW.issue_date + policy.default_due_days
        AND (NEW.environment_scope <> 'PRODUCTION' OR (
          policy.provisional = false AND numbering.provisional = false
        ))
        AND (
          (seller.vat_registration_status = 'VAT_NOT_REGISTERED'
            AND NEW.vat_mode = 'VAT_NOT_REGISTERED'
            AND NEW.vat_basis = 'NOT_REGISTERED'
            AND NEW.vat_rate_basis_points = 0
            AND NEW.vat_amount_minor_units = 0)
          OR (seller.vat_registration_status = 'VAT_REGISTERED'
            AND NEW.vat_mode = 'VAT_REGISTERED'
            AND NEW.vat_basis = NEW.price_basis)
        )
        AND booking.status <> 'CANCELLED'
        AND quote.status = 'ISSUED'
        AND quote.acceptance_source_snapshot IS NOT NULL
        AND NEW.currency = quote.currency
        AND NEW.price_basis = quote.price_basis
        AND NEW.net_amount_minor_units = quote.net_amount_minor_units
        AND NEW.vat_rate_basis_points = quote.vat_rate_basis_points
        AND NEW.vat_amount_minor_units = quote.vat_amount_minor_units
        AND NEW.gross_total_minor_units = quote.gross_total_minor_units
        AND booking.price_snapshot #> '{grossTotalMinorUnits}' =
          to_jsonb(NEW.gross_total_minor_units)
        AND NEW.commercial_snapshot = quote.commercial_snapshot
        AND acceptance.commercial_snapshot = quote.commercial_snapshot
        AND acceptance.terms_snapshot = quote.terms_snapshot
        AND NEW.terms_snapshot -> 'quoteTerms' = acceptance.terms_snapshot
        AND NEW.terms_snapshot ->> 'paymentTerms' = policy.payment_terms
        AND (NEW.terms_snapshot ->> 'defaultDueDays')::integer = policy.default_due_days
        AND NEW.customer_snapshot = jsonb_build_object(
          'customerType', customer.customer_type,
          'billingName', billing.billing_name,
          'billingEmail', billing.billing_email,
          'addressLine1', billing.billing_address_line_1,
          'addressLine2', billing.billing_address_line_2,
          'city', billing.billing_city,
          'postalCode', billing.billing_postal_code,
          'countryCode', billing.billing_country_code,
          'companyRegistrationNumber', billing.company_registration_number,
          'vatNumber', billing.vat_number,
          'vatNumberStatus', billing.vat_number_status
        )
        AND (customer.customer_type <> 'BUSINESS'
          OR (billing.company_registration_number IS NOT NULL
            AND billing.vat_number_status <> 'UNVERIFIED'))
        AND NEW.seller_snapshot = jsonb_build_object(
          'legalName', seller.legal_name,
          'registrationNumber', seller.registration_number,
          'vatNumber', seller.vat_number,
          'vatRegistrationStatus', seller.vat_registration_status,
          'addressLine1', seller.registered_address_line_1,
          'addressLine2', seller.registered_address_line_2,
          'city', seller.registered_city,
          'postalCode', seller.registered_postal_code,
          'countryCode', seller.registered_country_code,
          'contactEmail', seller.contact_email,
          'contactPhone', seller.contact_phone,
          'paymentInstructions', seller.customer_visible_payment_instructions
        )
        AND NEW.provenance_snapshot = jsonb_build_object(
          'quoteReference', quote.quote_reference,
          'bookingReference', booking.booking_reference,
          'quoteAcceptanceId', acceptance.id,
          'acceptanceProvenance', acceptance.provenance_snapshot,
          'acceptancePricing', acceptance.pricing_snapshot
        )
        AND NEW.eligibility_snapshot - 'jobStatus' = jsonb_build_object(
          'draftEligibility', policy.draft_eligibility,
          'issueEligibility', policy.issue_eligibility,
          'jobReference', job.job_reference
        )
        AND (NEW.job_id IS NULL OR (
          job.id IS NOT NULL
          AND job.status NOT IN ('REQUIRES_REVIEW', 'CANCELLED')
          AND (SELECT count(*) FROM public.job_items item
               WHERE item.job_id = job.id) =
              (SELECT count(*) FROM public.booking_items item
               WHERE item.booking_id = booking.id)
          AND NOT EXISTS (
            SELECT 1
            FROM public.job_items job_item
            LEFT JOIN public.booking_items booking_item
              ON booking_item.id = job_item.booking_item_id
             AND booking_item.booking_id = booking.id
            WHERE job_item.job_id = job.id
              AND (
                booking_item.id IS NULL
                OR job_item.status IN (
                  'DECLINED', 'REFERRED', 'REQUIRES_REVIEW'
                )
                OR job_item.quantity <> booking_item.quantity
                OR job_item.planned_measurement_snapshot <>
                  booking_item.measurement_snapshot
              )
          )
        ))
        AND (policy.issue_eligibility <> 'JOB_COMPLETED' OR job.status = 'COMPLETED')
        AND (job.status IS DISTINCT FROM 'COMPLETED' OR (
          (SELECT count(*) FROM public.job_items item WHERE item.job_id = job.id) =
            (SELECT count(*) FROM public.booking_items item WHERE item.booking_id = booking.id)
          AND NOT EXISTS (
            SELECT 1
            FROM public.job_items job_item
            JOIN public.booking_items booking_item
              ON booking_item.id = job_item.booking_item_id
             AND booking_item.booking_id = booking.id
            WHERE job_item.job_id = job.id
              AND (
                job_item.status <> 'COMPLETED'
                OR job_item.quantity <> booking_item.quantity
                OR job_item.planned_measurement_snapshot <>
                  booking_item.measurement_snapshot
              )
          )
        ))
        AND (SELECT count(*) FROM public.invoice_items item WHERE item.invoice_id = NEW.id) > 0
        AND (SELECT count(*) FROM public.invoice_items item WHERE item.invoice_id = NEW.id) =
          (SELECT count(*) FROM public.booking_items item WHERE item.booking_id = booking.id)
        AND (SELECT count(*) FROM public.booking_items item WHERE item.booking_id = booking.id) =
          (SELECT count(*) FROM public.quote_items item WHERE item.quote_id = quote.id)
        AND (SELECT coalesce(sum(item.net_amount_minor_units), 0)
          FROM public.invoice_items item WHERE item.invoice_id = NEW.id) = NEW.net_amount_minor_units
        AND (SELECT coalesce(sum(item.vat_amount_minor_units), 0)
          FROM public.invoice_items item WHERE item.invoice_id = NEW.id) = NEW.vat_amount_minor_units
        AND (SELECT coalesce(sum(item.gross_total_minor_units), 0)
          FROM public.invoice_items item WHERE item.invoice_id = NEW.id) = NEW.gross_total_minor_units
        AND (SELECT coalesce(sum(item.net_amount_minor_units), 0)
          FROM public.booking_items item WHERE item.booking_id = booking.id) = NEW.net_amount_minor_units
        AND (SELECT coalesce(sum(item.vat_amount_minor_units), 0)
          FROM public.booking_items item WHERE item.booking_id = booking.id) = NEW.vat_amount_minor_units
        AND (SELECT coalesce(sum(item.gross_total_minor_units), 0)
          FROM public.booking_items item WHERE item.booking_id = booking.id) = NEW.gross_total_minor_units
        AND (SELECT coalesce(sum(item.net_amount_minor_units), 0)
          FROM public.quote_items item WHERE item.quote_id = quote.id) = NEW.net_amount_minor_units
        AND (SELECT coalesce(sum(item.vat_amount_minor_units), 0)
          FROM public.quote_items item WHERE item.quote_id = quote.id) = NEW.vat_amount_minor_units
        AND (SELECT coalesce(sum(item.gross_total_minor_units), 0)
          FROM public.quote_items item WHERE item.quote_id = quote.id) = NEW.gross_total_minor_units
        AND NOT EXISTS (
          SELECT 1
          FROM public.invoice_items invoice_item
          LEFT JOIN public.booking_items booking_item
            ON booking_item.id = invoice_item.booking_item_id
           AND booking_item.booking_id = booking.id
           AND booking_item.quote_item_id = invoice_item.quote_item_id
          LEFT JOIN public.quote_items quote_item
            ON quote_item.id = invoice_item.quote_item_id
           AND quote_item.quote_id = quote.id
          WHERE invoice_item.invoice_id = NEW.id
            AND (
              booking_item.id IS NULL OR quote_item.id IS NULL
              OR invoice_item.service_id IS DISTINCT FROM booking_item.service_id
              OR invoice_item.description_bg <> booking_item.description_bg
              OR invoice_item.description_en <> booking_item.description_en
              OR invoice_item.quantity <> booking_item.quantity
              OR invoice_item.measurement_snapshot <> booking_item.measurement_snapshot
              OR invoice_item.net_amount_minor_units <> booking_item.net_amount_minor_units
              OR invoice_item.vat_rate_basis_points <> booking_item.vat_rate_basis_points
              OR invoice_item.vat_amount_minor_units <> booking_item.vat_amount_minor_units
              OR invoice_item.gross_total_minor_units <> booking_item.gross_total_minor_units
              OR invoice_item.sort_order <> booking_item.sort_order
              OR invoice_item.provenance_snapshot ->> 'bookingItemId'
                IS DISTINCT FROM invoice_item.booking_item_id::text
              OR invoice_item.provenance_snapshot ->> 'quoteItemId'
                IS DISTINCT FROM invoice_item.quote_item_id::text
              OR invoice_item.provenance_snapshot ->> 'jobItemId'
                IS DISTINCT FROM invoice_item.job_item_id::text
              OR invoice_item.provenance_snapshot -> 'calculationSnapshot'
                IS DISTINCT FROM booking_item.calculation_snapshot
              OR booking_item.request_item_id IS DISTINCT FROM quote_item.request_item_id
              OR booking_item.service_id IS DISTINCT FROM quote_item.service_id
              OR booking_item.cleaning_item_type_id IS DISTINCT FROM quote_item.cleaning_item_type_id
              OR booking_item.measurement_mode_id IS DISTINCT FROM quote_item.measurement_mode_id
              OR booking_item.description_bg <> quote_item.description_bg
              OR booking_item.description_en <> quote_item.description_en
              OR booking_item.quantity <> quote_item.quantity
              OR booking_item.measurement_snapshot <> quote_item.measurement_snapshot
              OR booking_item.base_amount_minor_units <> quote_item.base_amount_minor_units
              OR booking_item.modifier_amount_minor_units <> quote_item.modifier_amount_minor_units
              OR booking_item.addon_amount_minor_units <> quote_item.addon_amount_minor_units
              OR booking_item.net_amount_minor_units <> quote_item.net_amount_minor_units
              OR booking_item.vat_rate_basis_points <> quote_item.vat_rate_basis_points
              OR booking_item.vat_amount_minor_units <> quote_item.vat_amount_minor_units
              OR booking_item.gross_total_minor_units <> quote_item.gross_total_minor_units
              OR booking_item.calculation_snapshot <> quote_item.calculation_snapshot
              OR booking_item.sort_order <> quote_item.sort_order
            )
        )
    ) THEN
      RAISE EXCEPTION 'invoice issue provenance or commercial snapshot is stale'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID')
     AND NEW.status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID') THEN
    expected_status := CASE
      WHEN NEW.paid_amount_minor_units = 0 THEN 'ISSUED'
      WHEN NEW.paid_amount_minor_units = NEW.gross_total_minor_units THEN 'PAID'
      ELSE 'PARTIALLY_PAID'
    END;
    IF NEW.status <> expected_status
       OR NEW.version <> OLD.version + 1
       OR (new_row - ARRAY[
          'status', 'paid_amount_minor_units', 'updated_at', 'version',
          'outstanding_amount_minor_units'
        ]::text[]) IS DISTINCT FROM
          (old_row - ARRAY[
          'status', 'paid_amount_minor_units', 'updated_at', 'version',
          'outstanding_amount_minor_units'
        ]::text[]) THEN
      RAISE EXCEPTION 'issued invoice mutation is not a derived settlement transition'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'invalid invoice lifecycle transition'
    USING ERRCODE = '23514';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "invoices_lifecycle_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "invoices"
FOR EACH ROW EXECUTE FUNCTION "vax_finance_guard_invoice"();--> statement-breakpoint

CREATE FUNCTION "vax_finance_validate_invoice_number_allocation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IN ('DRAFT', 'READY_TO_ISSUE')
     AND NEW.status = 'ISSUED'
     AND NOT EXISTS (
       SELECT 1
       FROM public.invoice_numbering_policies numbering
       WHERE numbering.id = NEW.numbering_policy_id
         AND numbering.code = NEW.numbering_policy_code
         AND numbering.version = NEW.numbering_policy_version
         AND numbering.environment_scope = NEW.environment_scope
         AND numbering.next_sequence = NEW.numbering_sequence + 1
     ) THEN
    RAISE EXCEPTION 'issued invoice has no reciprocal numbering counter allocation'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "invoices_numbering_allocation_integrity"
AFTER UPDATE ON "invoices"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "vax_finance_validate_invoice_number_allocation"();--> statement-breakpoint

CREATE FUNCTION "vax_finance_guard_payment"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_row jsonb;
  new_row jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'payments cannot be deleted'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'RECORDED'
       OR NEW.version <> 1
       OR NEW.allocated_amount_minor_units <> 0 THEN
      RAISE EXCEPTION 'payments must enter as unallocated recorded payments'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  old_row := to_jsonb(OLD);
  new_row := to_jsonb(NEW);

  IF (new_row - ARRAY[
        'recorded_by_profile_id', 'confirmed_by_profile_id',
        'reversed_by_profile_id', 'unallocated_amount_minor_units'
      ]::text[]) =
       (old_row - ARRAY[
        'recorded_by_profile_id', 'confirmed_by_profile_id',
        'reversed_by_profile_id', 'unallocated_amount_minor_units'
      ]::text[])
     AND (NEW.recorded_by_profile_id IS NOT DISTINCT FROM OLD.recorded_by_profile_id
       OR (NEW.recorded_by_profile_id IS NULL AND NOT EXISTS (
         SELECT 1 FROM public.user_profiles profile
         WHERE profile.id = OLD.recorded_by_profile_id
       )))
     AND (NEW.confirmed_by_profile_id IS NOT DISTINCT FROM OLD.confirmed_by_profile_id
       OR (NEW.confirmed_by_profile_id IS NULL AND NOT EXISTS (
         SELECT 1 FROM public.user_profiles profile
         WHERE profile.id = OLD.confirmed_by_profile_id
       )))
     AND (NEW.reversed_by_profile_id IS NOT DISTINCT FROM OLD.reversed_by_profile_id
       OR (NEW.reversed_by_profile_id IS NULL AND NOT EXISTS (
         SELECT 1 FROM public.user_profiles profile
         WHERE profile.id = OLD.reversed_by_profile_id
       ))) THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'RECORDED' AND NEW.status = 'CONFIRMED' THEN
    IF NEW.version <> OLD.version + 1
       OR NEW.confirmed_at IS NULL
       OR NEW.confirmed_by_profile_id IS NULL
       OR NEW.allocated_amount_minor_units <> 0
       OR (new_row - ARRAY[
          'status', 'confirmed_at', 'confirmed_by_profile_id',
          'updated_at', 'version', 'unallocated_amount_minor_units'
        ]::text[]) IS DISTINCT FROM
          (old_row - ARRAY[
          'status', 'confirmed_at', 'confirmed_by_profile_id',
          'updated_at', 'version', 'unallocated_amount_minor_units'
        ]::text[]) THEN
      RAISE EXCEPTION 'invalid payment confirmation transition'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'CONFIRMED' AND NEW.status = 'CONFIRMED' THEN
    IF NEW.version <> OLD.version + 1
       OR NEW.allocated_amount_minor_units <= OLD.allocated_amount_minor_units
       OR (new_row - ARRAY[
          'allocated_amount_minor_units', 'updated_at', 'version',
          'unallocated_amount_minor_units'
        ]::text[]) IS DISTINCT FROM
          (old_row - ARRAY[
          'allocated_amount_minor_units', 'updated_at', 'version',
          'unallocated_amount_minor_units'
        ]::text[]) THEN
      RAISE EXCEPTION 'confirmed payment mutation is not an allocation transition'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status IN ('RECORDED', 'CONFIRMED') AND NEW.status = 'REVERSED' THEN
    IF NEW.version <> OLD.version + 1
       OR NEW.allocated_amount_minor_units <> 0
       OR NEW.reversed_at IS NULL
       OR NEW.reversed_by_profile_id IS NULL
       OR (NEW.confirmed_at IS NOT NULL AND NEW.reversed_at < NEW.confirmed_at)
       OR (new_row - ARRAY[
          'status', 'allocated_amount_minor_units', 'reversed_at',
          'reversed_by_profile_id', 'updated_at', 'version',
          'unallocated_amount_minor_units'
        ]::text[]) IS DISTINCT FROM
          (old_row - ARRAY[
          'status', 'allocated_amount_minor_units', 'reversed_at',
          'reversed_by_profile_id', 'updated_at', 'version',
          'unallocated_amount_minor_units'
        ]::text[]) THEN
      RAISE EXCEPTION 'invalid payment reversal transition'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'invalid payment lifecycle transition'
    USING ERRCODE = '23514';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "payments_lifecycle_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "payments"
FOR EACH ROW EXECUTE FUNCTION "vax_finance_guard_payment"();--> statement-breakpoint

CREATE FUNCTION "vax_finance_validate_invoice_item"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.invoices invoice
    JOIN public.booking_items booking_item
      ON booking_item.id = NEW.booking_item_id
     AND booking_item.booking_id = invoice.booking_id
     AND booking_item.quote_item_id = NEW.quote_item_id
    JOIN public.quote_items quote_item
      ON quote_item.id = NEW.quote_item_id
     AND quote_item.quote_id = invoice.quote_id
    LEFT JOIN public.job_items job_item
      ON job_item.id = NEW.job_item_id
     AND job_item.job_id = NEW.job_id
     AND job_item.booking_item_id = NEW.booking_item_id
    WHERE invoice.id = NEW.invoice_id
      AND invoice.status IN ('DRAFT', 'READY_TO_ISSUE')
      AND invoice.created_at = NEW.created_at
      AND NEW.booking_id = invoice.booking_id
      AND NEW.quote_id = invoice.quote_id
      AND NEW.job_id IS NOT DISTINCT FROM invoice.job_id
      AND NEW.job_item_id IS NOT DISTINCT FROM job_item.id
      AND NEW.service_id IS NOT DISTINCT FROM booking_item.service_id
      AND NEW.description_bg = booking_item.description_bg
      AND NEW.description_en = booking_item.description_en
      AND NEW.quantity = booking_item.quantity
      AND NEW.measurement_snapshot = booking_item.measurement_snapshot
      AND NEW.net_amount_minor_units = booking_item.net_amount_minor_units
      AND NEW.vat_rate_basis_points = booking_item.vat_rate_basis_points
      AND NEW.vat_amount_minor_units = booking_item.vat_amount_minor_units
      AND NEW.gross_total_minor_units = booking_item.gross_total_minor_units
      AND NEW.sort_order = booking_item.sort_order
      AND NEW.provenance_snapshot ->> 'bookingItemId' = NEW.booking_item_id::text
      AND NEW.provenance_snapshot ->> 'quoteItemId' = NEW.quote_item_id::text
      AND NEW.provenance_snapshot ->> 'jobItemId' IS NOT DISTINCT FROM NEW.job_item_id::text
      AND NEW.provenance_snapshot -> 'calculationSnapshot' = booking_item.calculation_snapshot
      AND booking_item.request_item_id IS NOT DISTINCT FROM quote_item.request_item_id
      AND booking_item.service_id IS NOT DISTINCT FROM quote_item.service_id
      AND booking_item.cleaning_item_type_id IS NOT DISTINCT FROM quote_item.cleaning_item_type_id
      AND booking_item.measurement_mode_id IS NOT DISTINCT FROM quote_item.measurement_mode_id
      AND booking_item.description_bg = quote_item.description_bg
      AND booking_item.description_en = quote_item.description_en
      AND booking_item.quantity = quote_item.quantity
      AND booking_item.measurement_snapshot = quote_item.measurement_snapshot
      AND booking_item.base_amount_minor_units = quote_item.base_amount_minor_units
      AND booking_item.modifier_amount_minor_units = quote_item.modifier_amount_minor_units
      AND booking_item.addon_amount_minor_units = quote_item.addon_amount_minor_units
      AND booking_item.net_amount_minor_units = quote_item.net_amount_minor_units
      AND booking_item.vat_rate_basis_points = quote_item.vat_rate_basis_points
      AND booking_item.vat_amount_minor_units = quote_item.vat_amount_minor_units
      AND booking_item.gross_total_minor_units = quote_item.gross_total_minor_units
      AND booking_item.calculation_snapshot = quote_item.calculation_snapshot
      AND booking_item.sort_order = quote_item.sort_order
  ) THEN
    RAISE EXCEPTION 'invoice item is not an exact immutable source snapshot'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "invoice_items_source_integrity"
AFTER INSERT ON "invoice_items"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "vax_finance_validate_invoice_item"();--> statement-breakpoint

CREATE FUNCTION "vax_finance_validate_settlement"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  row_data jsonb := to_jsonb(NEW);
  payment_uuid uuid;
  invoice_uuid uuid;
  payment_status text;
  invoice_status text;
  stored_amount integer;
  total_amount integer;
  ledger_amount bigint;
BEGIN
  IF TG_TABLE_NAME = 'payments' THEN
    payment_uuid := (row_data ->> 'id')::uuid;
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    invoice_uuid := (row_data ->> 'id')::uuid;
  ELSE
    payment_uuid := (row_data ->> 'payment_id')::uuid;
    IF TG_TABLE_NAME = 'payment_allocations' THEN
      invoice_uuid := (row_data ->> 'invoice_id')::uuid;
    END IF;
  END IF;

  IF payment_uuid IS NOT NULL THEN
    SELECT payment.status, payment.allocated_amount_minor_units,
      payment.amount_minor_units
    INTO payment_status, stored_amount, total_amount
    FROM public.payments payment
    WHERE payment.id = payment_uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'settlement references a missing payment'
        USING ERRCODE = '23514';
    END IF;

    SELECT coalesce(sum(CASE allocation.entry_type
      WHEN 'ALLOCATION' THEN allocation.amount_minor_units
      ELSE -allocation.amount_minor_units
    END), 0)
    INTO ledger_amount
    FROM public.payment_allocations allocation
    WHERE allocation.payment_id = payment_uuid;

    IF ledger_amount <> stored_amount
       OR stored_amount < 0
       OR stored_amount > total_amount THEN
      RAISE EXCEPTION 'payment balance does not reconcile to its append-only ledger'
        USING ERRCODE = '23514';
    END IF;

    IF payment_status = 'RECORDED'
       AND (stored_amount <> 0 OR EXISTS (
         SELECT 1 FROM public.payment_allocations allocation
         WHERE allocation.payment_id = payment_uuid
       )) THEN
      RAISE EXCEPTION 'recorded payments cannot have allocations'
        USING ERRCODE = '23514';
    END IF;

    IF payment_status <> 'REVERSED' AND (
      EXISTS (
        SELECT 1 FROM public.payment_reversals reversal
        WHERE reversal.payment_id = payment_uuid
      )
      OR EXISTS (
        SELECT 1 FROM public.payment_allocations allocation
        WHERE allocation.payment_id = payment_uuid
          AND allocation.entry_type = 'REVERSAL'
      )
    ) THEN
      RAISE EXCEPTION 'reversal ledger exists for a non-reversed payment'
        USING ERRCODE = '23514';
    END IF;

    IF payment_status = 'REVERSED' AND (
      stored_amount <> 0
      OR NOT EXISTS (
        SELECT 1
        FROM public.payment_reversals reversal
        WHERE reversal.payment_id = payment_uuid
          AND reversal.amount_minor_units = total_amount
      )
      OR EXISTS (
        SELECT 1
        FROM public.payment_allocations original
        WHERE original.payment_id = payment_uuid
          AND original.entry_type = 'ALLOCATION'
          AND NOT EXISTS (
            SELECT 1
            FROM public.payment_allocations compensation
            WHERE compensation.reverses_allocation_id = original.id
              AND compensation.entry_type = 'REVERSAL'
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.payment_allocations compensation
        WHERE compensation.payment_id = payment_uuid
          AND compensation.entry_type = 'REVERSAL'
          AND NOT EXISTS (
            SELECT 1
            FROM public.payment_reversals reversal
            WHERE reversal.payment_id = compensation.payment_id
          )
      )
    ) THEN
      RAISE EXCEPTION 'reversed payment does not have a complete compensating ledger'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF invoice_uuid IS NOT NULL THEN
    SELECT invoice.status, invoice.paid_amount_minor_units,
      invoice.gross_total_minor_units
    INTO invoice_status, stored_amount, total_amount
    FROM public.invoices invoice
    WHERE invoice.id = invoice_uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'settlement references a missing invoice'
        USING ERRCODE = '23514';
    END IF;

    SELECT coalesce(sum(CASE allocation.entry_type
      WHEN 'ALLOCATION' THEN allocation.amount_minor_units
      ELSE -allocation.amount_minor_units
    END), 0)
    INTO ledger_amount
    FROM public.payment_allocations allocation
    WHERE allocation.invoice_id = invoice_uuid;

    IF ledger_amount <> stored_amount
       OR stored_amount < 0
       OR stored_amount > total_amount
       OR invoice_status <> (CASE
         WHEN invoice_status IN ('DRAFT', 'READY_TO_ISSUE', 'CANCELLED')
           AND stored_amount = 0 THEN invoice_status
         WHEN stored_amount = 0 THEN 'ISSUED'
         WHEN stored_amount = total_amount AND total_amount > 0 THEN 'PAID'
         ELSE 'PARTIALLY_PAID'
       END) THEN
      RAISE EXCEPTION 'invoice balance or status does not reconcile to the payment ledger'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "payments_settlement_integrity"
AFTER INSERT OR UPDATE ON "payments"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "vax_finance_validate_settlement"();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "invoices_settlement_integrity"
AFTER INSERT OR UPDATE ON "invoices"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "vax_finance_validate_settlement"();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "payment_allocations_settlement_integrity"
AFTER INSERT ON "payment_allocations"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "vax_finance_validate_settlement"();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "payment_reversals_settlement_integrity"
AFTER INSERT ON "payment_reversals"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "vax_finance_validate_settlement"();--> statement-breakpoint

CREATE FUNCTION "vax_finance_validate_audit_graph"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.event_type IN (
      'INVOICE_DRAFT_CREATED', 'INVOICE_READY', 'INVOICE_ISSUED',
      'INVOICE_CANCELLED', 'FINANCE_REVIEW_REQUIRED'
    ) THEN
    IF NEW.invoice_id IS NULL
       OR NEW.payment_id IS NOT NULL
       OR NEW.payment_allocation_id IS NOT NULL
       OR NEW.payment_reversal_id IS NOT NULL THEN
      RAISE EXCEPTION 'invoice audit event has an invalid entity graph'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.event_type IN ('PAYMENT_RECORDED', 'PAYMENT_CONFIRMED') THEN
    IF NEW.payment_id IS NULL
       OR NEW.invoice_id IS NOT NULL
       OR NEW.payment_allocation_id IS NOT NULL
       OR NEW.payment_reversal_id IS NOT NULL THEN
      RAISE EXCEPTION 'payment audit event has an invalid entity graph'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.event_type IN (
      'PAYMENT_ALLOCATED', 'INVOICE_PARTIALLY_PAID', 'INVOICE_PAID'
    ) THEN
    IF NEW.invoice_id IS NULL
       OR NEW.payment_id IS NULL
       OR NEW.payment_allocation_id IS NULL
       OR NEW.payment_reversal_id IS NOT NULL
       OR NOT EXISTS (
         SELECT 1
         FROM public.payment_allocations allocation
         WHERE allocation.id = NEW.payment_allocation_id
           AND allocation.payment_id = NEW.payment_id
           AND allocation.invoice_id = NEW.invoice_id
           AND allocation.entry_type = 'ALLOCATION'
       ) THEN
      RAISE EXCEPTION 'allocation audit event has an invalid entity graph'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.event_type = 'PAYMENT_ALLOCATION_REVERSED' THEN
    IF NEW.invoice_id IS NULL
       OR NEW.payment_id IS NULL
       OR NEW.payment_allocation_id IS NULL
       OR NEW.payment_reversal_id IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM public.payment_allocations allocation
         JOIN public.payment_reversals reversal
           ON reversal.id = NEW.payment_reversal_id
          AND reversal.payment_id = allocation.payment_id
         WHERE allocation.id = NEW.payment_allocation_id
           AND allocation.payment_id = NEW.payment_id
           AND allocation.invoice_id = NEW.invoice_id
           AND allocation.entry_type = 'REVERSAL'
       ) THEN
      RAISE EXCEPTION 'reversal allocation audit has an invalid entity graph'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.event_type = 'PAYMENT_REVERSED' THEN
    IF NEW.payment_id IS NULL
       OR NEW.payment_reversal_id IS NULL
       OR NEW.invoice_id IS NOT NULL
       OR NEW.payment_allocation_id IS NOT NULL
       OR NOT EXISTS (
         SELECT 1
         FROM public.payment_reversals reversal
         WHERE reversal.id = NEW.payment_reversal_id
           AND reversal.payment_id = NEW.payment_id
       ) THEN
      RAISE EXCEPTION 'payment reversal audit has an invalid entity graph'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'unsupported finance audit event type'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.invoice_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.invoices invoice
    LEFT JOIN public.payment_allocations allocation
      ON allocation.id = NEW.payment_allocation_id
    LEFT JOIN public.payment_reversals reversal
      ON reversal.id = NEW.payment_reversal_id
    WHERE invoice.id = NEW.invoice_id
      AND NEW.safe_metadata ->> 'invoiceVersion' = invoice.version::text
      AND NEW.source = 'STAFF'
      AND NEW.actor_profile_id = CASE
        WHEN NEW.event_type IN (
          'INVOICE_DRAFT_CREATED', 'INVOICE_READY',
          'FINANCE_REVIEW_REQUIRED'
        ) THEN invoice.created_by_profile_id
        WHEN NEW.event_type = 'INVOICE_ISSUED'
          THEN invoice.issued_by_profile_id
        WHEN NEW.event_type = 'INVOICE_CANCELLED'
          THEN invoice.cancelled_by_profile_id
        WHEN NEW.event_type IN (
          'PAYMENT_ALLOCATED', 'INVOICE_PARTIALLY_PAID', 'INVOICE_PAID'
        ) THEN allocation.allocated_by_profile_id
        WHEN NEW.event_type = 'PAYMENT_ALLOCATION_REVERSED'
          THEN reversal.reversed_by_profile_id
        ELSE NULL
      END
      AND CASE
        WHEN NEW.event_type = 'INVOICE_DRAFT_CREATED'
          THEN NEW.previous_status IS NULL
            AND NEW.next_status = 'DRAFT'
            AND invoice.status = 'DRAFT'
            AND invoice.version = 1
            AND invoice.finance_review_status = 'CLEAR'
        WHEN NEW.event_type = 'INVOICE_READY'
          THEN NEW.previous_status IS NULL
            AND NEW.next_status = 'READY_TO_ISSUE'
            AND invoice.status = 'READY_TO_ISSUE'
            AND invoice.version = 1
            AND invoice.finance_review_status = 'CLEAR'
        WHEN NEW.event_type = 'FINANCE_REVIEW_REQUIRED'
          THEN NEW.previous_status IS NULL
            AND NEW.next_status = 'DRAFT'
            AND invoice.status = 'DRAFT'
            AND invoice.version = 1
            AND invoice.finance_review_status = 'REQUIRED'
        WHEN NEW.event_type = 'INVOICE_ISSUED'
          THEN NEW.previous_status IN ('DRAFT', 'READY_TO_ISSUE')
            AND NEW.next_status = 'ISSUED'
            AND invoice.status = 'ISSUED'
            AND invoice.version = 2
        WHEN NEW.event_type = 'INVOICE_CANCELLED'
          THEN NEW.previous_status IN ('DRAFT', 'READY_TO_ISSUE')
            AND NEW.next_status = 'CANCELLED'
            AND invoice.status = 'CANCELLED'
            AND invoice.version = 2
        WHEN NEW.event_type = 'PAYMENT_ALLOCATED'
          THEN NEW.previous_status = 'CONFIRMED'
            AND NEW.next_status = 'CONFIRMED'
        WHEN NEW.event_type = 'INVOICE_PARTIALLY_PAID'
          THEN NEW.previous_status IN ('ISSUED', 'PARTIALLY_PAID')
            AND NEW.next_status = 'PARTIALLY_PAID'
            AND invoice.status = 'PARTIALLY_PAID'
        WHEN NEW.event_type = 'INVOICE_PAID'
          THEN NEW.previous_status IN ('ISSUED', 'PARTIALLY_PAID')
            AND NEW.next_status = 'PAID'
            AND invoice.status = 'PAID'
        WHEN NEW.event_type = 'PAYMENT_ALLOCATION_REVERSED'
          THEN NEW.previous_status IN ('PARTIALLY_PAID', 'PAID')
            AND NEW.next_status = invoice.status
            AND invoice.status IN ('ISSUED', 'PARTIALLY_PAID')
        ELSE false
      END
  ) THEN
    RAISE EXCEPTION 'invoice audit event is not bound to its exact operation'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.payment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.payments payment
    LEFT JOIN public.payment_allocations allocation
      ON allocation.id = NEW.payment_allocation_id
    LEFT JOIN public.payment_reversals reversal
      ON reversal.id = NEW.payment_reversal_id
    WHERE payment.id = NEW.payment_id
      AND NEW.safe_metadata ->> 'paymentVersion' = payment.version::text
      AND NEW.source = 'STAFF'
      AND NEW.actor_profile_id = CASE
        WHEN NEW.event_type = 'PAYMENT_RECORDED'
          THEN payment.recorded_by_profile_id
        WHEN NEW.event_type = 'PAYMENT_CONFIRMED'
          THEN payment.confirmed_by_profile_id
        WHEN NEW.event_type IN (
          'PAYMENT_ALLOCATED', 'INVOICE_PARTIALLY_PAID', 'INVOICE_PAID'
        ) THEN allocation.allocated_by_profile_id
        WHEN NEW.event_type IN (
          'PAYMENT_ALLOCATION_REVERSED', 'PAYMENT_REVERSED'
        ) THEN reversal.reversed_by_profile_id
        ELSE NULL
      END
      AND CASE
        WHEN NEW.event_type = 'PAYMENT_RECORDED'
          THEN NEW.previous_status IS NULL
            AND NEW.next_status = 'RECORDED'
            AND payment.status = 'RECORDED'
            AND payment.version = 1
        WHEN NEW.event_type = 'PAYMENT_CONFIRMED'
          THEN NEW.previous_status = 'RECORDED'
            AND NEW.next_status = 'CONFIRMED'
            AND payment.status = 'CONFIRMED'
            AND payment.version = 2
            AND payment.allocated_amount_minor_units = 0
        WHEN NEW.event_type = 'PAYMENT_ALLOCATED'
          THEN NEW.previous_status = 'CONFIRMED'
            AND NEW.next_status = 'CONFIRMED'
            AND payment.status = 'CONFIRMED'
        WHEN NEW.event_type IN (
          'INVOICE_PARTIALLY_PAID', 'INVOICE_PAID',
          'PAYMENT_ALLOCATION_REVERSED'
        ) THEN true
        WHEN NEW.event_type = 'PAYMENT_REVERSED'
          THEN NEW.previous_status IN ('RECORDED', 'CONFIRMED')
            AND NEW.next_status = 'REVERSED'
            AND payment.status = 'REVERSED'
        ELSE false
      END
  ) THEN
    RAISE EXCEPTION 'payment audit event is not bound to its exact operation'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "finance_audit_events_graph_integrity"
AFTER INSERT ON "finance_audit_events"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "vax_finance_validate_audit_graph"();--> statement-breakpoint

CREATE FUNCTION "vax_finance_validate_allocation_audit"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.entry_type = 'ALLOCATION' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.finance_audit_events payment_audit
      JOIN public.finance_audit_events invoice_audit
        ON invoice_audit.payment_allocation_id = payment_audit.payment_allocation_id
       AND invoice_audit.invoice_id = payment_audit.invoice_id
       AND invoice_audit.payment_id = payment_audit.payment_id
      JOIN public.invoices invoice ON invoice.id = NEW.invoice_id
      JOIN public.payments payment ON payment.id = NEW.payment_id
      WHERE payment_audit.payment_allocation_id = NEW.id
        AND payment_audit.invoice_id = NEW.invoice_id
        AND payment_audit.payment_id = NEW.payment_id
        AND payment_audit.event_type = 'PAYMENT_ALLOCATED'
        AND payment_audit.actor_profile_id = NEW.allocated_by_profile_id
        AND payment_audit.safe_metadata ->> 'amountMinorUnits' =
          NEW.amount_minor_units::text
        AND payment_audit.safe_metadata ->> 'invoiceVersion' =
          invoice.version::text
        AND payment_audit.safe_metadata ->> 'paymentVersion' =
          payment.version::text
        AND invoice_audit.event_type = CASE invoice.status
          WHEN 'PAID' THEN 'INVOICE_PAID'
          ELSE 'INVOICE_PARTIALLY_PAID'
        END
        AND invoice_audit.actor_profile_id = NEW.allocated_by_profile_id
        AND invoice_audit.safe_metadata ->> 'amountMinorUnits' =
          NEW.amount_minor_units::text
        AND invoice_audit.safe_metadata ->> 'invoiceVersion' =
          invoice.version::text
        AND invoice_audit.safe_metadata ->> 'paymentVersion' =
          payment.version::text
    ) THEN
      RAISE EXCEPTION 'payment allocation has no exact audit pair'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM public.finance_audit_events audit
    JOIN public.invoices invoice ON invoice.id = NEW.invoice_id
    JOIN public.payments payment ON payment.id = NEW.payment_id
    JOIN public.payment_reversals reversal
      ON reversal.id = audit.payment_reversal_id
     AND reversal.payment_id = NEW.payment_id
    WHERE audit.payment_allocation_id = NEW.id
      AND audit.invoice_id = NEW.invoice_id
      AND audit.payment_id = NEW.payment_id
      AND audit.event_type = 'PAYMENT_ALLOCATION_REVERSED'
      AND audit.actor_profile_id = NEW.allocated_by_profile_id
      AND audit.safe_metadata ->> 'amountMinorUnits' =
        NEW.amount_minor_units::text
      AND audit.safe_metadata ->> 'invoiceVersion' = invoice.version::text
      AND audit.safe_metadata ->> 'paymentVersion' = payment.version::text
  ) THEN
    RAISE EXCEPTION 'payment allocation reversal has no exact audit fact'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "payment_allocations_audit_integrity"
AFTER INSERT ON "payment_allocations"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "vax_finance_validate_allocation_audit"();--> statement-breakpoint

CREATE FUNCTION "vax_finance_validate_invoice_audit"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  accepted_events text[];
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = OLD.status
     AND NEW.paid_amount_minor_units = OLD.paid_amount_minor_units THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
         SELECT 1 FROM public.invoice_items item WHERE item.invoice_id = NEW.id
       )
       OR (SELECT count(*) FROM public.invoice_items item
           WHERE item.invoice_id = NEW.id) <>
          (SELECT count(*) FROM public.booking_items item
           WHERE item.booking_id = NEW.booking_id)
       OR (SELECT count(*) FROM public.booking_items item
           WHERE item.booking_id = NEW.booking_id) <>
          (SELECT count(*) FROM public.quote_items item
           WHERE item.quote_id = NEW.quote_id)
       OR (NEW.job_id IS NOT NULL
         AND (SELECT count(*) FROM public.job_items item
              WHERE item.job_id = NEW.job_id) <>
             (SELECT count(*) FROM public.booking_items item
              WHERE item.booking_id = NEW.booking_id))
       OR (NEW.job_id IS NULL AND EXISTS (
         SELECT 1
         FROM public.invoice_policies policy
         WHERE policy.id = NEW.invoice_policy_id
           AND policy.code = NEW.invoice_policy_code
           AND policy.version = NEW.invoice_policy_version
           AND policy.environment_scope = NEW.environment_scope
           AND policy.issue_eligibility = 'JOB_COMPLETED'
       ))
       OR (NEW.job_id IS NOT NULL
         AND EXISTS (
           SELECT 1
           FROM public.jobs job
           WHERE job.id = NEW.job_id
             AND (
               job.status IN ('REQUIRES_REVIEW', 'CANCELLED')
               OR EXISTS (
                 SELECT 1
                 FROM public.job_items job_item
                 LEFT JOIN public.booking_items booking_item
                   ON booking_item.id = job_item.booking_item_id
                  AND booking_item.booking_id = NEW.booking_id
                 WHERE job_item.job_id = job.id
                   AND (
                     booking_item.id IS NULL
                     OR job_item.status IN (
                       'DECLINED', 'REFERRED', 'REQUIRES_REVIEW'
                     )
                     OR (job.status = 'COMPLETED'
                       AND job_item.status <> 'COMPLETED')
                     OR job_item.quantity <> booking_item.quantity
                     OR job_item.planned_measurement_snapshot <>
                       booking_item.measurement_snapshot
                   )
               )
             )
         )
         AND NOT (
           NEW.status = 'DRAFT'
           AND NEW.finance_review_status = 'REQUIRED'
           AND NEW.finance_review_reason_codes ? 'JOB_SCOPE_DIFFERENCE'
         ))
       OR (SELECT coalesce(sum(item.net_amount_minor_units), 0)
           FROM public.invoice_items item WHERE item.invoice_id = NEW.id) <>
          NEW.net_amount_minor_units
       OR (SELECT coalesce(sum(item.vat_amount_minor_units), 0)
           FROM public.invoice_items item WHERE item.invoice_id = NEW.id) <>
          NEW.vat_amount_minor_units
       OR (SELECT coalesce(sum(item.gross_total_minor_units), 0)
           FROM public.invoice_items item WHERE item.invoice_id = NEW.id) <>
          NEW.gross_total_minor_units THEN
      RAISE EXCEPTION 'invoice creation requires a complete balanced item snapshot'
        USING ERRCODE = '23514';
    END IF;
    accepted_events := CASE NEW.status
      WHEN 'READY_TO_ISSUE' THEN ARRAY['INVOICE_READY']::text[]
      ELSE ARRAY['INVOICE_DRAFT_CREATED', 'FINANCE_REVIEW_REQUIRED']::text[]
    END;
  ELSIF NEW.status = 'CANCELLED' THEN
    accepted_events := ARRAY['INVOICE_CANCELLED']::text[];
  ELSIF NEW.status = 'ISSUED' AND OLD.status IN ('DRAFT', 'READY_TO_ISSUE') THEN
    accepted_events := ARRAY['INVOICE_ISSUED']::text[];
  ELSIF NEW.paid_amount_minor_units < OLD.paid_amount_minor_units THEN
    accepted_events := ARRAY['PAYMENT_ALLOCATION_REVERSED']::text[];
  ELSIF NEW.status = 'PAID' THEN
    accepted_events := ARRAY['INVOICE_PAID']::text[];
  ELSE
    accepted_events := ARRAY['INVOICE_PARTIALLY_PAID']::text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.finance_audit_events audit
    WHERE audit.invoice_id = NEW.id
      AND audit.event_type = ANY(accepted_events)
      AND audit.safe_metadata ->> 'invoiceVersion' = NEW.version::text
      AND audit.source = 'STAFF'
      AND (
        (TG_OP = 'INSERT' AND audit.previous_status IS NULL)
        OR (TG_OP = 'UPDATE' AND audit.previous_status = OLD.status)
      )
      AND audit.next_status = NEW.status
  ) THEN
    RAISE EXCEPTION 'invoice lifecycle mutation has no matching finance audit event'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "invoices_audit_integrity"
AFTER INSERT OR UPDATE ON "invoices"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "vax_finance_validate_invoice_audit"();--> statement-breakpoint

CREATE FUNCTION "vax_finance_validate_payment_audit"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  expected_event text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = OLD.status
     AND NEW.allocated_amount_minor_units = OLD.allocated_amount_minor_units THEN
    RETURN NULL;
  END IF;

  expected_event := CASE
    WHEN TG_OP = 'INSERT' THEN 'PAYMENT_RECORDED'
    WHEN NEW.status = 'CONFIRMED' AND OLD.status = 'RECORDED'
      THEN 'PAYMENT_CONFIRMED'
    WHEN NEW.status = 'REVERSED' THEN 'PAYMENT_REVERSED'
    ELSE 'PAYMENT_ALLOCATED'
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM public.finance_audit_events audit
    WHERE audit.payment_id = NEW.id
      AND audit.event_type = expected_event
      AND audit.safe_metadata ->> 'paymentVersion' = NEW.version::text
      AND audit.source = 'STAFF'
      AND (
        (TG_OP = 'INSERT' AND audit.previous_status IS NULL)
        OR (TG_OP = 'UPDATE' AND audit.previous_status = OLD.status)
      )
      AND audit.next_status = NEW.status
  ) THEN
    RAISE EXCEPTION 'payment lifecycle mutation has no matching finance audit event'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "payments_audit_integrity"
AFTER INSERT OR UPDATE ON "payments"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "vax_finance_validate_payment_audit"();
