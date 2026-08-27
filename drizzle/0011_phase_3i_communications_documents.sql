CREATE TABLE "communication_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"communication_intent_id" uuid,
	"document_id" uuid,
	"delivery_attempt_id" uuid,
	"history_entry_id" uuid,
	"event_type" varchar(64) NOT NULL,
	"actor_profile_id" uuid,
	"source" varchar(16) NOT NULL,
	"correlation_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"safe_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "communication_audit_events_scope_present" CHECK (num_nonnulls("communication_audit_events"."customer_id", "communication_audit_events"."communication_intent_id", "communication_audit_events"."document_id", "communication_audit_events"."delivery_attempt_id", "communication_audit_events"."history_entry_id") >= 1),
	CONSTRAINT "communication_audit_events_type_valid" CHECK ("communication_audit_events"."event_type" in ('INTENT_CREATED', 'DOCUMENT_RENDERED', 'DOCUMENT_FINALIZED', 'PORTAL_PUBLISHED', 'FUTURE_CHANNEL_DEFERRED', 'INTENT_CANCELLED', 'DOCUMENT_SUPERSEDED', 'PREFERENCES_UPDATED')),
	CONSTRAINT "communication_audit_events_source_valid" CHECK ("communication_audit_events"."source" in ('STAFF', 'CUSTOMER', 'SYSTEM')),
	CONSTRAINT "communication_audit_events_metadata_object" CHECK (jsonb_typeof("communication_audit_events"."safe_metadata") = 'object')
);
--> statement-breakpoint
CREATE TABLE "communication_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"communication_reference" varchar(40) NOT NULL,
	"customer_id" uuid NOT NULL,
	"contact_id" uuid,
	"source_type" varchar(24) NOT NULL,
	"source_reference" varchar(96) NOT NULL,
	"source_version" integer NOT NULL,
	"quote_id" uuid,
	"booking_id" uuid,
	"booking_occupancy_id" uuid,
	"job_id" uuid,
	"invoice_id" uuid,
	"payment_id" uuid,
	"business_audit_event_id" uuid,
	"booking_audit_event_id" uuid,
	"job_audit_event_id" uuid,
	"finance_audit_event_id" uuid,
	"event_type" varchar(40) NOT NULL,
	"purpose" varchar(16) NOT NULL,
	"channel" varchar(24) NOT NULL,
	"locale" varchar(8) NOT NULL,
	"status" varchar(24) NOT NULL,
	"template_key" varchar(96) NOT NULL,
	"template_version" integer NOT NULL,
	"payload_snapshot" jsonb NOT NULL,
	"contact_snapshot" jsonb,
	"idempotency_key" uuid NOT NULL,
	"idempotency_fingerprint" varchar(64) NOT NULL,
	"created_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	"delivered_local_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "communication_intents_reference_valid" CHECK ("communication_intents"."communication_reference" ~ '^COM-[A-F0-9]{24}$'),
	CONSTRAINT "communication_intents_source_version_positive" CHECK ("communication_intents"."source_version" >= 1),
	CONSTRAINT "communication_intents_source_type_valid" CHECK ("communication_intents"."source_type" in ('QUOTE', 'BOOKING', 'JOB', 'INVOICE', 'PAYMENT', 'MANUAL')),
	CONSTRAINT "communication_intents_event_type_valid" CHECK ("communication_intents"."event_type" in ('QUOTE_ISSUED', 'BOOKING_CONFIRMED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED', 'JOB_COMPLETED', 'INVOICE_ISSUED', 'PAYMENT_CONFIRMED', 'PAYMENT_REVERSED', 'MANUAL_STAFF_MESSAGE')),
	CONSTRAINT "communication_intents_purpose_valid" CHECK ("communication_intents"."purpose" in ('OPERATIONAL', 'BILLING', 'MARKETING')),
	CONSTRAINT "communication_intents_no_marketing_automation" CHECK ("communication_intents"."purpose" <> 'MARKETING'),
	CONSTRAINT "communication_intents_channel_valid" CHECK ("communication_intents"."channel" in ('PORTAL', 'EMAIL_FUTURE', 'SMS_FUTURE', 'MANUAL')),
	CONSTRAINT "communication_intents_locale_valid" CHECK ("communication_intents"."locale" in ('bg', 'en')),
	CONSTRAINT "communication_intents_status_valid" CHECK ("communication_intents"."status" in ('DRAFT', 'READY', 'QUEUED_FUTURE', 'DELIVERED_LOCAL', 'FAILED', 'CANCELLED')),
	CONSTRAINT "communication_intents_source_exactly_one" CHECK (num_nonnulls("communication_intents"."quote_id", "communication_intents"."booking_id", "communication_intents"."job_id", "communication_intents"."invoice_id", "communication_intents"."payment_id") = case when "communication_intents"."source_type" = 'MANUAL' then 0 else 1 end),
	CONSTRAINT "communication_intents_source_matches_type" CHECK (("communication_intents"."source_type" = 'QUOTE' and "communication_intents"."quote_id" is not null and "communication_intents"."business_audit_event_id" is not null) or ("communication_intents"."source_type" = 'BOOKING' and "communication_intents"."booking_id" is not null and "communication_intents"."booking_audit_event_id" is not null) or ("communication_intents"."source_type" = 'JOB' and "communication_intents"."job_id" is not null and "communication_intents"."job_audit_event_id" is not null) or ("communication_intents"."source_type" = 'INVOICE' and "communication_intents"."invoice_id" is not null and "communication_intents"."finance_audit_event_id" is not null) or ("communication_intents"."source_type" = 'PAYMENT' and "communication_intents"."payment_id" is not null and "communication_intents"."finance_audit_event_id" is not null) or ("communication_intents"."source_type" = 'MANUAL' and num_nonnulls("communication_intents"."business_audit_event_id", "communication_intents"."booking_audit_event_id", "communication_intents"."job_audit_event_id", "communication_intents"."finance_audit_event_id") = 0)),
	CONSTRAINT "communication_intents_source_audit_exactly_one" CHECK (num_nonnulls("communication_intents"."business_audit_event_id", "communication_intents"."booking_audit_event_id", "communication_intents"."job_audit_event_id", "communication_intents"."finance_audit_event_id") = case when "communication_intents"."source_type" = 'MANUAL' then 0 else 1 end),
	CONSTRAINT "communication_intents_event_source_consistent" CHECK (("communication_intents"."event_type" = 'QUOTE_ISSUED' and "communication_intents"."source_type" = 'QUOTE') or ("communication_intents"."event_type" in ('BOOKING_CONFIRMED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED') and "communication_intents"."source_type" = 'BOOKING') or ("communication_intents"."event_type" = 'JOB_COMPLETED' and "communication_intents"."source_type" = 'JOB') or ("communication_intents"."event_type" = 'INVOICE_ISSUED' and "communication_intents"."source_type" = 'INVOICE') or ("communication_intents"."event_type" in ('PAYMENT_CONFIRMED', 'PAYMENT_REVERSED') and "communication_intents"."source_type" = 'PAYMENT') or ("communication_intents"."event_type" = 'MANUAL_STAFF_MESSAGE' and "communication_intents"."source_type" = 'MANUAL')),
	CONSTRAINT "communication_intents_event_purpose_consistent" CHECK (("communication_intents"."event_type" in ('QUOTE_ISSUED', 'BOOKING_CONFIRMED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED', 'JOB_COMPLETED', 'MANUAL_STAFF_MESSAGE') and "communication_intents"."purpose" = 'OPERATIONAL') or ("communication_intents"."event_type" in ('INVOICE_ISSUED', 'PAYMENT_CONFIRMED', 'PAYMENT_REVERSED') and "communication_intents"."purpose" = 'BILLING')),
	CONSTRAINT "communication_intents_booking_occupancy_consistent" CHECK (("communication_intents"."event_type" in ('BOOKING_CONFIRMED', 'BOOKING_RESCHEDULED') and "communication_intents"."booking_occupancy_id" is not null) or ("communication_intents"."event_type" not in ('BOOKING_CONFIRMED', 'BOOKING_RESCHEDULED') and "communication_intents"."booking_occupancy_id" is null)),
	CONSTRAINT "communication_intents_contact_snapshot_consistent" CHECK (("communication_intents"."contact_id" is null and "communication_intents"."contact_snapshot" is null) or ("communication_intents"."contact_id" is not null and "communication_intents"."contact_snapshot" is not null and jsonb_typeof("communication_intents"."contact_snapshot") = 'object')),
	CONSTRAINT "communication_intents_future_channel_has_contact" CHECK ("communication_intents"."channel" not in ('EMAIL_FUTURE', 'SMS_FUTURE') or "communication_intents"."contact_id" is not null),
	CONSTRAINT "communication_intents_payload_object" CHECK (jsonb_typeof("communication_intents"."payload_snapshot") = 'object'),
	CONSTRAINT "communication_intents_fingerprint_valid" CHECK ("communication_intents"."idempotency_fingerprint" ~ '^[A-Fa-f0-9]{64}$'),
	CONSTRAINT "communication_intents_lifecycle_consistent" CHECK (("communication_intents"."status" = 'DRAFT' and "communication_intents"."ready_at" is null and "communication_intents"."delivered_local_at" is null and "communication_intents"."cancelled_at" is null) or ("communication_intents"."status" = 'READY' and "communication_intents"."ready_at" is not null and "communication_intents"."delivered_local_at" is null and "communication_intents"."cancelled_at" is null) or ("communication_intents"."status" = 'QUEUED_FUTURE' and "communication_intents"."channel" in ('EMAIL_FUTURE', 'SMS_FUTURE') and "communication_intents"."ready_at" is not null and "communication_intents"."delivered_local_at" is null and "communication_intents"."cancelled_at" is null) or ("communication_intents"."status" = 'DELIVERED_LOCAL' and "communication_intents"."channel" = 'PORTAL' and "communication_intents"."ready_at" is not null and "communication_intents"."delivered_local_at" is not null and "communication_intents"."cancelled_at" is null and "communication_intents"."delivered_local_at" >= "communication_intents"."ready_at") or ("communication_intents"."status" = 'FAILED' and "communication_intents"."ready_at" is not null and "communication_intents"."delivered_local_at" is null and "communication_intents"."cancelled_at" is null) or ("communication_intents"."status" = 'CANCELLED' and "communication_intents"."delivered_local_at" is null and "communication_intents"."cancelled_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "communication_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_key" varchar(96) NOT NULL,
	"version" integer NOT NULL,
	"locale" varchar(8) NOT NULL,
	"document_type" varchar(40) NOT NULL,
	"title_template" text NOT NULL,
	"body_template" text NOT NULL,
	"variables_contract" jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"created_by_profile_id" uuid,
	CONSTRAINT "communication_templates_key_valid" CHECK ("communication_templates"."template_key" ~ '^[a-z][a-z0-9_]{2,95}$'),
	CONSTRAINT "communication_templates_version_positive" CHECK ("communication_templates"."version" >= 1),
	CONSTRAINT "communication_templates_locale_valid" CHECK ("communication_templates"."locale" in ('bg', 'en')),
	CONSTRAINT "communication_templates_document_type_valid" CHECK ("communication_templates"."document_type" in ('QUOTE_SUMMARY', 'BOOKING_CONFIRMATION', 'JOB_COMPLETION_SUMMARY', 'CLEANING_PASSPORT', 'INVOICE', 'PAYMENT_ACKNOWLEDGEMENT')),
	CONSTRAINT "communication_templates_content_not_blank" CHECK (length(trim("communication_templates"."title_template")) > 0 and length(trim("communication_templates"."body_template")) > 0),
	CONSTRAINT "communication_templates_contract_array" CHECK (jsonb_typeof("communication_templates"."variables_contract") = 'array'),
	CONSTRAINT "communication_templates_status_valid" CHECK ("communication_templates"."status" in ('DRAFT', 'ACTIVE', 'SUPERSEDED')),
	CONSTRAINT "communication_templates_lifecycle_consistent" CHECK (("communication_templates"."status" = 'DRAFT' and "communication_templates"."activated_at" is null and "communication_templates"."superseded_at" is null) or ("communication_templates"."status" = 'ACTIVE' and "communication_templates"."activated_at" is not null and "communication_templates"."superseded_at" is null) or ("communication_templates"."status" = 'SUPERSEDED' and "communication_templates"."activated_at" is not null and "communication_templates"."superseded_at" is not null and "communication_templates"."superseded_at" >= "communication_templates"."activated_at"))
);
--> statement-breakpoint
CREATE TABLE "customer_communication_history_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"history_reference" varchar(40) NOT NULL,
	"customer_id" uuid NOT NULL,
	"communication_intent_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"delivery_result_id" uuid NOT NULL,
	"event_type" varchar(40) NOT NULL,
	"locale" varchar(8) NOT NULL,
	"title_snapshot" text NOT NULL,
	"visible_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_history_reference_valid" CHECK ("customer_communication_history_entries"."history_reference" ~ '^HIS-[A-F0-9]{24}$'),
	CONSTRAINT "customer_history_locale_valid" CHECK ("customer_communication_history_entries"."locale" in ('bg', 'en')),
	CONSTRAINT "customer_history_title_not_blank" CHECK (length(trim("customer_communication_history_entries"."title_snapshot")) > 0)
);
--> statement-breakpoint
CREATE TABLE "customer_communication_preferences" (
	"customer_id" uuid PRIMARY KEY NOT NULL,
	"portal_enabled" boolean DEFAULT true NOT NULL,
	"email_future_enabled" boolean DEFAULT false NOT NULL,
	"sms_future_enabled" boolean DEFAULT false NOT NULL,
	"operational_allowed" boolean DEFAULT true NOT NULL,
	"billing_allowed" boolean DEFAULT true NOT NULL,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"preferred_locale" varchar(8) DEFAULT 'bg' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_profile_id" uuid,
	CONSTRAINT "customer_communication_preferences_locale_valid" CHECK ("customer_communication_preferences"."preferred_locale" in ('bg', 'en')),
	CONSTRAINT "customer_communication_preferences_version_positive" CHECK ("customer_communication_preferences"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "delivery_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_reference" varchar(40) NOT NULL,
	"communication_intent_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"channel" varchar(24) NOT NULL,
	"adapter_key" varchar(40) NOT NULL,
	"status" varchar(16) NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"attempted_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "delivery_attempts_reference_valid" CHECK ("delivery_attempts"."delivery_reference" ~ '^DEL-[A-F0-9]{24}$'),
	CONSTRAINT "delivery_attempts_number_positive" CHECK ("delivery_attempts"."attempt_number" >= 1),
	CONSTRAINT "delivery_attempts_portal_only" CHECK ("delivery_attempts"."channel" = 'PORTAL'),
	CONSTRAINT "delivery_attempts_local_adapter_only" CHECK ("delivery_attempts"."adapter_key" = 'PORTAL_LOCAL'),
	CONSTRAINT "delivery_attempts_status_valid" CHECK ("delivery_attempts"."status" in ('STARTED', 'COMPLETED', 'FAILED', 'CANCELLED')),
	CONSTRAINT "delivery_attempts_lifecycle_consistent" CHECK (("delivery_attempts"."status" = 'STARTED' and "delivery_attempts"."completed_at" is null) or ("delivery_attempts"."status" in ('COMPLETED', 'FAILED', 'CANCELLED') and "delivery_attempts"."completed_at" is not null and "delivery_attempts"."completed_at" >= "delivery_attempts"."started_at"))
);
--> statement-breakpoint
CREATE TABLE "delivery_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_attempt_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"outcome" varchar(24) NOT NULL,
	"result_code" varchar(64) NOT NULL,
	"retryable" boolean DEFAULT false NOT NULL,
	"safe_evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_results_outcome_valid" CHECK ("delivery_results"."outcome" in ('DELIVERED_LOCAL', 'FAILED', 'CANCELLED')),
	CONSTRAINT "delivery_results_code_valid" CHECK ("delivery_results"."result_code" in ('PORTAL_PUBLISHED', 'LOCAL_FAILURE', 'CANCELLED_BY_STAFF')),
	CONSTRAINT "delivery_results_outcome_code_consistent" CHECK (("delivery_results"."outcome" = 'DELIVERED_LOCAL' and "delivery_results"."result_code" = 'PORTAL_PUBLISHED' and "delivery_results"."retryable" = false) or ("delivery_results"."outcome" = 'FAILED' and "delivery_results"."result_code" = 'LOCAL_FAILURE') or ("delivery_results"."outcome" = 'CANCELLED' and "delivery_results"."result_code" = 'CANCELLED_BY_STAFF' and "delivery_results"."retryable" = false)),
	CONSTRAINT "delivery_results_evidence_object" CHECK (jsonb_typeof("delivery_results"."safe_evidence") = 'object')
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_reference" varchar(40) NOT NULL,
	"communication_intent_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"document_type" varchar(40) NOT NULL,
	"document_version" integer DEFAULT 1 NOT NULL,
	"source_type" varchar(24) NOT NULL,
	"source_reference" varchar(96) NOT NULL,
	"source_version" integer NOT NULL,
	"locale" varchar(8) NOT NULL,
	"template_key" varchar(96) NOT NULL,
	"template_version" integer NOT NULL,
	"renderer_version" integer NOT NULL,
	"title_snapshot" text NOT NULL,
	"content_snapshot" jsonb NOT NULL,
	"rendered_format" varchar(24) NOT NULL,
	"status" varchar(16) NOT NULL,
	"checksum_sha256" varchar(64) NOT NULL,
	"supersedes_document_id" uuid,
	"created_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rendered_at" timestamp with time zone,
	"finalized_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "documents_reference_valid" CHECK ("documents"."document_reference" ~ '^DOC-[A-F0-9]{24}$'),
	CONSTRAINT "documents_type_valid" CHECK ("documents"."document_type" in ('QUOTE_SUMMARY', 'BOOKING_CONFIRMATION', 'JOB_COMPLETION_SUMMARY', 'CLEANING_PASSPORT', 'INVOICE', 'PAYMENT_ACKNOWLEDGEMENT')),
	CONSTRAINT "documents_source_type_valid" CHECK ("documents"."source_type" in ('QUOTE', 'BOOKING', 'JOB', 'INVOICE', 'PAYMENT')),
	CONSTRAINT "documents_versions_positive" CHECK ("documents"."document_version" >= 1 and "documents"."source_version" >= 1 and "documents"."template_version" >= 1 and "documents"."renderer_version" >= 1),
	CONSTRAINT "documents_locale_valid" CHECK ("documents"."locale" in ('bg', 'en')),
	CONSTRAINT "documents_title_not_blank" CHECK (length(trim("documents"."title_snapshot")) > 0),
	CONSTRAINT "documents_content_object" CHECK (jsonb_typeof("documents"."content_snapshot") = 'object'),
	CONSTRAINT "documents_format_html_print" CHECK ("documents"."rendered_format" = 'HTML_PRINT'),
	CONSTRAINT "documents_status_valid" CHECK ("documents"."status" in ('DRAFT', 'RENDERED', 'FINAL', 'SUPERSEDED', 'CANCELLED')),
	CONSTRAINT "documents_checksum_valid" CHECK ("documents"."checksum_sha256" ~ '^[A-Fa-f0-9]{64}$'),
	CONSTRAINT "documents_not_self_superseding" CHECK ("documents"."supersedes_document_id" is null or "documents"."supersedes_document_id" <> "documents"."id"),
	CONSTRAINT "documents_lifecycle_consistent" CHECK (("documents"."status" = 'DRAFT' and "documents"."rendered_at" is null and "documents"."finalized_at" is null and "documents"."superseded_at" is null and "documents"."cancelled_at" is null) or ("documents"."status" = 'RENDERED' and "documents"."rendered_at" is not null and "documents"."finalized_at" is null and "documents"."superseded_at" is null and "documents"."cancelled_at" is null) or ("documents"."status" = 'FINAL' and "documents"."rendered_at" is not null and "documents"."finalized_at" is not null and "documents"."superseded_at" is null and "documents"."cancelled_at" is null) or ("documents"."status" = 'SUPERSEDED' and "documents"."rendered_at" is not null and "documents"."finalized_at" is not null and "documents"."superseded_at" is not null and "documents"."cancelled_at" is null) or ("documents"."status" = 'CANCELLED' and "documents"."finalized_at" is null and "documents"."superseded_at" is null and "documents"."cancelled_at" is not null)),
	CONSTRAINT "documents_lifecycle_ordered" CHECK (("documents"."finalized_at" is null or "documents"."rendered_at" is not null and "documents"."finalized_at" >= "documents"."rendered_at") and ("documents"."superseded_at" is null or "documents"."superseded_at" >= "documents"."finalized_at"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "communication_intents_id_customer_unique" ON "communication_intents" USING btree ("id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_templates_key_version_locale_unique" ON "communication_templates" USING btree ("template_key","version","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_attempts_id_customer_unique" ON "delivery_attempts" USING btree ("id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_results_id_customer_unique" ON "delivery_results" USING btree ("id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_id_customer_unique" ON "documents" USING btree ("id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_contacts_id_customer_unique" ON "customer_contacts" USING btree ("id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_id_customer_unique" ON "quotes" USING btree ("id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_id_customer_unique" ON "bookings" USING btree ("id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_id_customer_unique" ON "jobs" USING btree ("id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_id_customer_unique" ON "invoices" USING btree ("id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_id_customer_unique" ON "payments" USING btree ("id","customer_id");--> statement-breakpoint
ALTER TABLE "communication_audit_events" ADD CONSTRAINT "communication_audit_events_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_audit_events" ADD CONSTRAINT "communication_audit_events_communication_intent_id_communication_intents_id_fk" FOREIGN KEY ("communication_intent_id") REFERENCES "public"."communication_intents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_audit_events" ADD CONSTRAINT "communication_audit_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_audit_events" ADD CONSTRAINT "communication_audit_events_delivery_attempt_id_delivery_attempts_id_fk" FOREIGN KEY ("delivery_attempt_id") REFERENCES "public"."delivery_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_audit_events" ADD CONSTRAINT "communication_audit_events_history_entry_id_customer_communication_history_entries_id_fk" FOREIGN KEY ("history_entry_id") REFERENCES "public"."customer_communication_history_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_audit_events" ADD CONSTRAINT "communication_audit_events_actor_profile_id_user_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_intents" ADD CONSTRAINT "communication_intents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_intents" ADD CONSTRAINT "communication_intents_booking_occupancy_id_booking_occupancies_id_fk" FOREIGN KEY ("booking_occupancy_id") REFERENCES "public"."booking_occupancies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_intents" ADD CONSTRAINT "communication_intents_business_audit_event_id_business_audit_events_id_fk" FOREIGN KEY ("business_audit_event_id") REFERENCES "public"."business_audit_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_intents" ADD CONSTRAINT "communication_intents_booking_audit_event_id_booking_audit_events_id_fk" FOREIGN KEY ("booking_audit_event_id") REFERENCES "public"."booking_audit_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_intents" ADD CONSTRAINT "communication_intents_job_audit_event_id_job_audit_events_id_fk" FOREIGN KEY ("job_audit_event_id") REFERENCES "public"."job_audit_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_intents" ADD CONSTRAINT "communication_intents_finance_audit_event_id_finance_audit_events_id_fk" FOREIGN KEY ("finance_audit_event_id") REFERENCES "public"."finance_audit_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_intents" ADD CONSTRAINT "communication_intents_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_intents" ADD CONSTRAINT "communication_intents_contact_customer_fk" FOREIGN KEY ("contact_id","customer_id") REFERENCES "public"."customer_contacts"("id","customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_intents" ADD CONSTRAINT "communication_intents_quote_customer_fk" FOREIGN KEY ("quote_id","customer_id") REFERENCES "public"."quotes"("id","customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_intents" ADD CONSTRAINT "communication_intents_booking_customer_fk" FOREIGN KEY ("booking_id","customer_id") REFERENCES "public"."bookings"("id","customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_intents" ADD CONSTRAINT "communication_intents_job_customer_fk" FOREIGN KEY ("job_id","customer_id") REFERENCES "public"."jobs"("id","customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_intents" ADD CONSTRAINT "communication_intents_invoice_customer_fk" FOREIGN KEY ("invoice_id","customer_id") REFERENCES "public"."invoices"("id","customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_intents" ADD CONSTRAINT "communication_intents_payment_customer_fk" FOREIGN KEY ("payment_id","customer_id") REFERENCES "public"."payments"("id","customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_intents" ADD CONSTRAINT "communication_intents_template_fk" FOREIGN KEY ("template_key","template_version","locale") REFERENCES "public"."communication_templates"("template_key","version","locale") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_templates" ADD CONSTRAINT "communication_templates_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_communication_history_entries" ADD CONSTRAINT "customer_communication_history_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_communication_history_entries" ADD CONSTRAINT "customer_history_intent_customer_fk" FOREIGN KEY ("communication_intent_id","customer_id") REFERENCES "public"."communication_intents"("id","customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_communication_history_entries" ADD CONSTRAINT "customer_history_document_customer_fk" FOREIGN KEY ("document_id","customer_id") REFERENCES "public"."documents"("id","customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_communication_history_entries" ADD CONSTRAINT "customer_history_result_customer_fk" FOREIGN KEY ("delivery_result_id","customer_id") REFERENCES "public"."delivery_results"("id","customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_communication_preferences" ADD CONSTRAINT "customer_communication_preferences_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_communication_preferences" ADD CONSTRAINT "customer_communication_preferences_updated_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_attempted_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("attempted_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_intent_customer_fk" FOREIGN KEY ("communication_intent_id","customer_id") REFERENCES "public"."communication_intents"("id","customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_document_customer_fk" FOREIGN KEY ("document_id","customer_id") REFERENCES "public"."documents"("id","customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_results" ADD CONSTRAINT "delivery_results_attempt_customer_fk" FOREIGN KEY ("delivery_attempt_id","customer_id") REFERENCES "public"."delivery_attempts"("id","customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_intent_customer_fk" FOREIGN KEY ("communication_intent_id","customer_id") REFERENCES "public"."communication_intents"("id","customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_template_fk" FOREIGN KEY ("template_key","template_version","locale") REFERENCES "public"."communication_templates"("template_key","version","locale") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_supersedes_fk" FOREIGN KEY ("supersedes_document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "communication_audit_events_correlation_unique" ON "communication_audit_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "communication_audit_events_intent_timeline_idx" ON "communication_audit_events" USING btree ("communication_intent_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_intents_reference_unique" ON "communication_intents" USING btree ("communication_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_intents_idempotency_unique" ON "communication_intents" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_intents_business_event_unique" ON "communication_intents" USING btree ("business_audit_event_id","channel","template_key","template_version") WHERE "communication_intents"."business_audit_event_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "communication_intents_booking_event_unique" ON "communication_intents" USING btree ("booking_audit_event_id","channel","template_key","template_version") WHERE "communication_intents"."booking_audit_event_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "communication_intents_job_event_unique" ON "communication_intents" USING btree ("job_audit_event_id","channel","template_key","template_version") WHERE "communication_intents"."job_audit_event_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "communication_intents_finance_event_unique" ON "communication_intents" USING btree ("finance_audit_event_id","channel","template_key","template_version") WHERE "communication_intents"."finance_audit_event_id" is not null;--> statement-breakpoint
CREATE INDEX "communication_intents_staff_queue_idx" ON "communication_intents" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "communication_intents_customer_history_idx" ON "communication_intents" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "communication_templates_one_active_unique" ON "communication_templates" USING btree ("template_key","locale") WHERE "communication_templates"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "communication_templates_active_lookup_idx" ON "communication_templates" USING btree ("template_key","locale","status");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_history_reference_unique" ON "customer_communication_history_entries" USING btree ("history_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_history_intent_document_unique" ON "customer_communication_history_entries" USING btree ("communication_intent_id","document_id");--> statement-breakpoint
CREATE INDEX "customer_history_customer_visible_idx" ON "customer_communication_history_entries" USING btree ("customer_id","visible_at");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_attempts_reference_unique" ON "delivery_attempts" USING btree ("delivery_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_attempts_intent_number_unique" ON "delivery_attempts" USING btree ("communication_intent_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_attempts_idempotency_unique" ON "delivery_attempts" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_results_attempt_unique" ON "delivery_results" USING btree ("delivery_attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_reference_unique" ON "documents" USING btree ("document_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_intent_type_unique" ON "documents" USING btree ("communication_intent_id","document_type");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_supersedes_once_unique" ON "documents" USING btree ("supersedes_document_id") WHERE "documents"."supersedes_document_id" is not null;--> statement-breakpoint
CREATE INDEX "documents_customer_created_idx" ON "documents" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE FUNCTION "vax_communications_guard_template"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_row jsonb;
  new_row jsonb;
  actor_preserved boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'communication templates cannot be deleted'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  old_row := to_jsonb(OLD);
  new_row := to_jsonb(NEW);
  actor_preserved := NEW.created_by_profile_id IS NOT DISTINCT FROM
      OLD.created_by_profile_id
    OR (
      NEW.created_by_profile_id IS NULL
      AND OLD.created_by_profile_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.user_profiles profile
        WHERE profile.id = OLD.created_by_profile_id
      )
    );

  IF NOT actor_preserved THEN
    RAISE EXCEPTION 'communication template creator attribution is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.status = 'SUPERSEDED' THEN
    IF (new_row - 'created_by_profile_id') =
         (old_row - 'created_by_profile_id') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'superseded communication templates are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.status = 'ACTIVE' THEN
    IF NEW.status = 'SUPERSEDED'
       AND NEW.superseded_at IS NOT NULL
       AND (new_row - ARRAY[
         'status', 'superseded_at', 'created_by_profile_id'
       ]::text[]) = (old_row - ARRAY[
         'status', 'superseded_at', 'created_by_profile_id'
       ]::text[]) THEN
      RETURN NEW;
    END IF;
    IF (new_row - 'created_by_profile_id') =
         (old_row - 'created_by_profile_id') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'active communication templates may only be superseded'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status NOT IN ('DRAFT', 'ACTIVE') THEN
    RAISE EXCEPTION 'draft communication templates must be activated before supersession'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "communication_templates_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "communication_templates"
FOR EACH ROW EXECUTE FUNCTION "vax_communications_guard_template"();--> statement-breakpoint

CREATE FUNCTION "vax_communications_guard_intent"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_row jsonb;
  new_row jsonb;
  source_valid boolean := false;
  contact_valid boolean := false;
  actor_preserved boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'communication intents cannot be deleted'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    old_row := to_jsonb(OLD);
    new_row := to_jsonb(NEW);
    actor_preserved := NEW.created_by_profile_id IS NOT DISTINCT FROM
        OLD.created_by_profile_id
      OR (
        NEW.created_by_profile_id IS NULL
        AND OLD.created_by_profile_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.user_profiles profile
          WHERE profile.id = OLD.created_by_profile_id
        )
      );

    IF NOT actor_preserved
       OR (new_row - ARRAY[
         'status', 'updated_at', 'ready_at', 'delivered_local_at',
         'cancelled_at', 'created_by_profile_id'
       ]::text[]) IS DISTINCT FROM (old_row - ARRAY[
         'status', 'updated_at', 'ready_at', 'delivered_local_at',
         'cancelled_at', 'created_by_profile_id'
       ]::text[]) THEN
      RAISE EXCEPTION 'communication intent provenance and snapshots are immutable'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.status IN ('DELIVERED_LOCAL', 'CANCELLED')
       AND (new_row - 'created_by_profile_id') IS DISTINCT FROM
         (old_row - 'created_by_profile_id') THEN
      RAISE EXCEPTION 'terminal communication intents are immutable'
        USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.source_type = 'QUOTE' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.quotes quote
      JOIN public.business_audit_events event
        ON event.id = NEW.business_audit_event_id
       AND event.entity_type = 'QUOTE'
       AND event.entity_id = quote.id
       AND event.event_type = 'QUOTE_ISSUED'
      WHERE quote.id = NEW.quote_id
        AND quote.customer_id = NEW.customer_id
        AND quote.quote_reference = NEW.source_reference
        AND quote.status IN ('ISSUED', 'SUPERSEDED', 'EXPIRED', 'WITHDRAWN')
        AND quote.issued_at IS NOT NULL
        AND quote.acceptance_source_snapshot IS NOT NULL
        AND quote.acceptance_source_snapshot #>> '{schemaVersion}' = '1'
        AND quote.acceptance_source_snapshot #>> '{quote,id}' = quote.id::text
        AND quote.acceptance_source_snapshot #>> '{quote,customerId}' =
          quote.customer_id::text
        AND CASE WHEN pg_input_is_valid(
          quote.acceptance_source_snapshot #>> '{quote,recordVersion}',
          'integer'
        ) THEN (quote.acceptance_source_snapshot
          #>> '{quote,recordVersion}')::integer END = NEW.source_version
    ) INTO source_valid;
  ELSIF NEW.source_type = 'BOOKING' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.bookings booking
      JOIN public.booking_audit_events event
        ON event.id = NEW.booking_audit_event_id
       AND event.booking_id = booking.id
      LEFT JOIN public.booking_occupancies occupancy
        ON occupancy.id = NEW.booking_occupancy_id
       AND occupancy.booking_id = booking.id
      WHERE booking.id = NEW.booking_id
        AND booking.customer_id = NEW.customer_id
        AND booking.booking_reference = NEW.source_reference
        AND booking.version = NEW.source_version
        AND (
          (
            NEW.event_type = 'BOOKING_CONFIRMED'
            AND event.event_type = 'BOOKING_SCHEDULED'
            AND booking.status = 'CONFIRMED'
            AND booking.scheduling_status = 'SCHEDULED'
            AND occupancy.status = 'CONFIRMED'
            AND booking.scheduling_snapshot #>> '{occupancyId}' =
              occupancy.id::text
            AND booking.scheduling_snapshot
              #>> '{occupancySnapshotVersion}' =
              occupancy.snapshot_version::text
            AND occupancy.snapshot_version = CASE WHEN pg_input_is_valid(
              event.safe_metadata ->> 'occupancySnapshotVersion', 'integer'
            ) THEN (event.safe_metadata
              ->> 'occupancySnapshotVersion')::integer END
            AND event.safe_metadata ->> 'bookingVersion' =
              NEW.source_version::text
          ) OR (
            NEW.event_type = 'BOOKING_RESCHEDULED'
            AND event.event_type = 'BOOKING_RESCHEDULED'
            AND booking.status = 'CONFIRMED'
            AND booking.scheduling_status = 'SCHEDULED'
            AND occupancy.status = 'CONFIRMED'
            AND booking.scheduling_snapshot #>> '{occupancyId}' =
              occupancy.id::text
            AND booking.scheduling_snapshot
              #>> '{occupancySnapshotVersion}' =
              occupancy.snapshot_version::text
            AND occupancy.snapshot_version = CASE WHEN pg_input_is_valid(
              event.safe_metadata ->> 'occupancySnapshotVersion', 'integer'
            ) THEN (event.safe_metadata
              ->> 'occupancySnapshotVersion')::integer END
            AND event.safe_metadata ->> 'bookingVersion' =
              NEW.source_version::text
          ) OR (
            NEW.event_type = 'BOOKING_CANCELLED'
            AND event.event_type = 'BOOKING_CANCELLED'
            AND NEW.booking_occupancy_id IS NULL
            AND booking.status = 'CANCELLED'
            AND booking.cancelled_at IS NOT NULL
          )
        )
    ) INTO source_valid;
  ELSIF NEW.source_type = 'JOB' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.jobs job
      JOIN public.job_audit_events event
        ON event.id = NEW.job_audit_event_id
       AND event.job_id = job.id
       AND event.event_type = 'JOB_COMPLETED'
      WHERE job.id = NEW.job_id
        AND job.customer_id = NEW.customer_id
        AND job.job_reference = NEW.source_reference
        AND job.version = NEW.source_version
        AND job.status = 'COMPLETED'
        AND job.completed_at IS NOT NULL
        AND job.completion_snapshot ->> 'schemaVersion' = '1'
        AND (
          NEW.template_key <> 'cleaning_passport_ready'
          OR (
            pg_input_is_valid(
              event.safe_metadata ->> 'passportEntryCount', 'integer')
            AND (event.safe_metadata ->> 'passportEntryCount')::integer = (
              SELECT count(*)::integer
              FROM public.cleaning_passport_entries passport
              WHERE passport.job_id = job.id
                AND passport.source_execution_status = 'COMPLETED'
                AND passport.customer_safe_snapshot
                  ->> 'schemaVersion' = '1'
            )
          )
        )
    ) INTO source_valid;
  ELSIF NEW.source_type = 'INVOICE' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.invoices invoice
      JOIN public.finance_audit_events event
        ON event.id = NEW.finance_audit_event_id
       AND event.invoice_id = invoice.id
       AND event.event_type = 'INVOICE_ISSUED'
      WHERE invoice.id = NEW.invoice_id
        AND invoice.customer_id = NEW.customer_id
        AND invoice.invoice_reference = NEW.source_reference
        AND event.safe_metadata ->> 'invoiceVersion' = NEW.source_version::text
        AND invoice.status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID')
        AND invoice.finance_review_status = 'CLEAR'
        AND invoice.invoice_number IS NOT NULL
        AND invoice.issued_at IS NOT NULL
    ) INTO source_valid;
  ELSIF NEW.source_type = 'PAYMENT' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.payments payment
      JOIN public.finance_audit_events event
        ON event.id = NEW.finance_audit_event_id
       AND event.payment_id = payment.id
       AND event.event_type = NEW.event_type
      WHERE payment.id = NEW.payment_id
        AND payment.customer_id = NEW.customer_id
        AND payment.payment_reference = NEW.source_reference
        AND event.safe_metadata ->> 'paymentVersion' = NEW.source_version::text
        AND (
          (NEW.event_type = 'PAYMENT_CONFIRMED'
            AND payment.status = 'CONFIRMED'
            AND payment.confirmed_at IS NOT NULL)
          OR (NEW.event_type = 'PAYMENT_REVERSED'
            AND payment.status = 'REVERSED'
            AND payment.reversed_at IS NOT NULL)
        )
    ) INTO source_valid;
  ELSIF NEW.source_type = 'MANUAL' THEN
    source_valid := NEW.event_type = 'MANUAL_STAFF_MESSAGE'
      AND NEW.channel = 'MANUAL';
  END IF;

  IF NOT source_valid THEN
    RAISE EXCEPTION 'communication intent source provenance is stale or inconsistent'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.contact_id IS NULL THEN
    contact_valid := NEW.contact_snapshot IS NULL;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.customer_contacts contact
      WHERE contact.id = NEW.contact_id
        AND contact.customer_id = NEW.customer_id
        AND contact.active = true
        AND NEW.contact_snapshot ->> 'schemaVersion' = '1'
        AND NEW.contact_snapshot ->> 'contactName' = contact.contact_name
        AND (NEW.contact_snapshot ->> 'email') IS NOT DISTINCT FROM contact.email
        AND (NEW.contact_snapshot ->> 'phone') IS NOT DISTINCT FROM contact.phone
        AND NEW.contact_snapshot ->> 'locale' = contact.locale
        AND NEW.contact_snapshot ->> 'contactVersion' = contact.version::text
    ) INTO contact_valid;
  END IF;

  IF NOT contact_valid THEN
    RAISE EXCEPTION 'communication intent contact snapshot is stale or inconsistent'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "communication_intents_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "communication_intents"
FOR EACH ROW EXECUTE FUNCTION "vax_communications_guard_intent"();--> statement-breakpoint

CREATE FUNCTION "vax_communications_guard_document"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_row jsonb;
  new_row jsonb;
  actor_preserved boolean;
  document_valid boolean := false;
  replacement_exists boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'communication documents cannot be deleted'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    old_row := to_jsonb(OLD);
    new_row := to_jsonb(NEW);
    actor_preserved := NEW.created_by_profile_id IS NOT DISTINCT FROM
        OLD.created_by_profile_id
      OR (
        NEW.created_by_profile_id IS NULL
        AND OLD.created_by_profile_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.user_profiles profile
          WHERE profile.id = OLD.created_by_profile_id
        )
      );

    IF NOT actor_preserved THEN
      RAISE EXCEPTION 'communication document creator attribution is immutable'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.status = 'SUPERSEDED' THEN
      IF (new_row - 'created_by_profile_id') =
           (old_row - 'created_by_profile_id') THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'superseded communication documents are immutable'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.status = 'FINAL' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.documents replacement
        WHERE replacement.supersedes_document_id = OLD.id
          AND replacement.customer_id = OLD.customer_id
          AND replacement.document_type = OLD.document_type
          AND replacement.source_type = OLD.source_type
          AND replacement.source_reference = OLD.source_reference
          AND replacement.source_version = OLD.source_version
          AND replacement.document_version = OLD.document_version + 1
          AND replacement.status = 'FINAL'
      ) INTO replacement_exists;

      IF NEW.status = 'SUPERSEDED'
         AND NEW.superseded_at IS NOT NULL
         AND replacement_exists
         AND (new_row - ARRAY[
           'status', 'superseded_at', 'created_by_profile_id'
         ]::text[]) = (old_row - ARRAY[
           'status', 'superseded_at', 'created_by_profile_id'
         ]::text[]) THEN
        RETURN NEW;
      END IF;

      IF (new_row - 'created_by_profile_id') =
           (old_row - 'created_by_profile_id') THEN
        RETURN NEW;
      END IF;

      RAISE EXCEPTION 'final communication documents require a preserved superseding version'
        USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.communication_intents intent
    JOIN public.communication_templates template
      ON template.template_key = NEW.template_key
     AND template.version = NEW.template_version
     AND template.locale = NEW.locale
     AND template.document_type = NEW.document_type
     AND template.status = 'ACTIVE'
    LEFT JOIN public.job_audit_events job_event
      ON job_event.id = intent.job_audit_event_id
    WHERE intent.id = NEW.communication_intent_id
      AND intent.customer_id = NEW.customer_id
      AND intent.source_type = NEW.source_type
      AND intent.source_reference = NEW.source_reference
      AND intent.source_version = NEW.source_version
      AND intent.locale = NEW.locale
      AND intent.template_key = NEW.template_key
      AND intent.template_version = NEW.template_version
      AND intent.status IN ('DELIVERED_LOCAL', 'QUEUED_FUTURE')
      AND NEW.content_snapshot ->> 'schemaVersion' = '1'
      AND NEW.content_snapshot ->> 'rendererVersion' =
        NEW.renderer_version::text
      AND NEW.content_snapshot ->> 'eventType' = intent.event_type
      AND NEW.content_snapshot ->> 'sourceReference' = intent.source_reference
      AND NEW.content_snapshot ->> 'locale' = intent.locale
      AND NEW.content_snapshot ->> 'title' = NEW.title_snapshot
      AND (
        (intent.event_type = 'QUOTE_ISSUED'
          AND NEW.document_type = 'QUOTE_SUMMARY')
        OR (intent.event_type IN (
            'BOOKING_CONFIRMED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED'
          ) AND NEW.document_type = 'BOOKING_CONFIRMATION')
        OR (intent.event_type = 'JOB_COMPLETED'
          AND NEW.document_type = 'JOB_COMPLETION_SUMMARY'
          AND job_event.event_type = 'JOB_COMPLETED')
        OR (intent.event_type = 'JOB_COMPLETED'
          AND NEW.document_type = 'CLEANING_PASSPORT'
          AND job_event.event_type = 'JOB_COMPLETED'
          AND pg_input_is_valid(
            job_event.safe_metadata ->> 'passportEntryCount', 'integer')
          AND (job_event.safe_metadata ->> 'passportEntryCount')::integer = (
            SELECT count(*)::integer
            FROM public.cleaning_passport_entries passport
            WHERE passport.job_id = intent.job_id
              AND passport.source_execution_status = 'COMPLETED'
              AND passport.customer_safe_snapshot
                ->> 'schemaVersion' = '1'
          ))
        OR (intent.event_type = 'INVOICE_ISSUED'
          AND NEW.document_type = 'INVOICE')
        OR (intent.event_type IN ('PAYMENT_CONFIRMED', 'PAYMENT_REVERSED')
          AND NEW.document_type = 'PAYMENT_ACKNOWLEDGEMENT')
      )
  ) INTO document_valid;

  IF NOT document_valid THEN
    RAISE EXCEPTION 'communication document does not match its immutable intent source'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.supersedes_document_id IS NULL THEN
    document_valid := NEW.document_version = 1;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.documents prior
      WHERE prior.id = NEW.supersedes_document_id
        AND prior.customer_id = NEW.customer_id
        AND prior.document_type = NEW.document_type
        AND prior.source_type = NEW.source_type
        AND prior.source_reference = NEW.source_reference
        AND prior.source_version = NEW.source_version
        AND prior.status = 'FINAL'
        AND NEW.document_version = prior.document_version + 1
    ) INTO document_valid;
  END IF;

  IF NOT document_valid THEN
    RAISE EXCEPTION 'communication document version provenance is inconsistent'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "documents_guard"
AFTER INSERT OR UPDATE OR DELETE ON "documents"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "vax_communications_guard_document"();--> statement-breakpoint

CREATE FUNCTION "vax_communications_validate_delivery_graph"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  graph_valid boolean := false;
BEGIN
  IF TG_TABLE_NAME = 'delivery_attempts' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.communication_intents intent
      JOIN public.documents document
        ON document.id = NEW.document_id
       AND document.communication_intent_id = intent.id
       AND document.customer_id = intent.customer_id
      WHERE intent.id = NEW.communication_intent_id
        AND intent.customer_id = NEW.customer_id
        AND intent.channel = 'PORTAL'
        AND intent.status = 'DELIVERED_LOCAL'
        AND document.status = 'FINAL'
        AND NEW.channel = 'PORTAL'
        AND NEW.adapter_key = 'PORTAL_LOCAL'
    ) INTO graph_valid;
  ELSIF TG_TABLE_NAME = 'delivery_results' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.delivery_attempts attempt
      WHERE attempt.id = NEW.delivery_attempt_id
        AND attempt.customer_id = NEW.customer_id
        AND (
          (NEW.outcome = 'DELIVERED_LOCAL'
            AND attempt.status = 'COMPLETED')
          OR (NEW.outcome = 'FAILED' AND attempt.status = 'FAILED')
          OR (NEW.outcome = 'CANCELLED' AND attempt.status = 'CANCELLED')
        )
    ) INTO graph_valid;
  ELSIF TG_TABLE_NAME = 'customer_communication_history_entries' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.communication_intents intent
      JOIN public.documents document
        ON document.id = NEW.document_id
       AND document.communication_intent_id = intent.id
       AND document.customer_id = intent.customer_id
      JOIN public.delivery_results result
        ON result.id = NEW.delivery_result_id
       AND result.customer_id = intent.customer_id
      JOIN public.delivery_attempts attempt
        ON attempt.id = result.delivery_attempt_id
       AND attempt.communication_intent_id = intent.id
       AND attempt.document_id = document.id
       AND attempt.customer_id = intent.customer_id
      WHERE intent.id = NEW.communication_intent_id
        AND intent.customer_id = NEW.customer_id
        AND intent.channel = 'PORTAL'
        AND intent.status = 'DELIVERED_LOCAL'
        AND document.status IN ('FINAL', 'SUPERSEDED')
        AND result.outcome = 'DELIVERED_LOCAL'
        AND result.result_code = 'PORTAL_PUBLISHED'
        AND NEW.event_type = intent.event_type
        AND NEW.locale = document.locale
        AND NEW.title_snapshot = document.title_snapshot
    ) INTO graph_valid;
  ELSIF TG_TABLE_NAME = 'communication_audit_events' THEN
    IF NEW.event_type = 'PREFERENCES_UPDATED' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.customer_communication_preferences preference
        WHERE preference.customer_id = NEW.customer_id
          AND NEW.communication_intent_id IS NULL
          AND NEW.document_id IS NULL
          AND NEW.delivery_attempt_id IS NULL
          AND NEW.history_entry_id IS NULL
          AND NEW.source = 'CUSTOMER'
          AND NEW.actor_profile_id IS NOT NULL
          AND NEW.safe_metadata ->> 'preferenceVersion' =
            preference.version::text
      ) INTO graph_valid;
    ELSIF NEW.event_type = 'INTENT_CREATED' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.communication_intents intent
        WHERE intent.id = NEW.communication_intent_id
          AND intent.customer_id = NEW.customer_id
          AND NEW.document_id IS NULL
          AND NEW.delivery_attempt_id IS NULL
          AND NEW.history_entry_id IS NULL
          AND NEW.safe_metadata ->> 'eventType' = intent.event_type
          AND NEW.safe_metadata ->> 'channel' = intent.channel
          AND NEW.safe_metadata ->> 'templateKey' = intent.template_key
          AND NEW.safe_metadata ->> 'templateVersion' =
            intent.template_version::text
      ) INTO graph_valid;
    ELSIF NEW.event_type IN (
        'DOCUMENT_RENDERED', 'DOCUMENT_FINALIZED',
        'FUTURE_CHANNEL_DEFERRED', 'DOCUMENT_SUPERSEDED'
      ) THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.communication_intents intent
        JOIN public.documents document
          ON document.communication_intent_id = intent.id
         AND document.customer_id = intent.customer_id
        WHERE intent.id = NEW.communication_intent_id
          AND intent.customer_id = NEW.customer_id
          AND document.id = NEW.document_id
          AND NEW.delivery_attempt_id IS NULL
          AND NEW.history_entry_id IS NULL
          AND (
            NEW.event_type <> 'FUTURE_CHANNEL_DEFERRED'
            OR (
              intent.channel IN ('EMAIL_FUTURE', 'SMS_FUTURE')
              AND intent.status = 'QUEUED_FUTURE'
            )
          )
          AND (
            NEW.event_type <> 'DOCUMENT_FINALIZED'
            OR document.status IN ('FINAL', 'SUPERSEDED')
          )
          AND (
            NEW.event_type <> 'DOCUMENT_SUPERSEDED'
            OR document.status = 'SUPERSEDED'
          )
      ) INTO graph_valid;
    ELSIF NEW.event_type = 'PORTAL_PUBLISHED' THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.customer_communication_history_entries history
        JOIN public.delivery_results result
          ON result.id = history.delivery_result_id
        JOIN public.delivery_attempts attempt
          ON attempt.id = result.delivery_attempt_id
        WHERE history.id = NEW.history_entry_id
          AND history.customer_id = NEW.customer_id
          AND history.communication_intent_id = NEW.communication_intent_id
          AND history.document_id = NEW.document_id
          AND attempt.id = NEW.delivery_attempt_id
          AND result.outcome = 'DELIVERED_LOCAL'
          AND result.result_code = 'PORTAL_PUBLISHED'
      ) INTO graph_valid;
    ELSIF NEW.event_type = 'INTENT_CANCELLED' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.communication_intents intent
        WHERE intent.id = NEW.communication_intent_id
          AND intent.customer_id = NEW.customer_id
          AND intent.status = 'CANCELLED'
      ) INTO graph_valid;
    END IF;
  END IF;

  IF NOT graph_valid THEN
    RAISE EXCEPTION 'communication delivery or audit graph is inconsistent'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "delivery_attempts_graph_guard"
AFTER INSERT ON "delivery_attempts"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "vax_communications_validate_delivery_graph"();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "delivery_results_graph_guard"
AFTER INSERT ON "delivery_results"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "vax_communications_validate_delivery_graph"();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "customer_communication_history_graph_guard"
AFTER INSERT ON "customer_communication_history_entries"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "vax_communications_validate_delivery_graph"();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "communication_audit_events_graph_guard"
AFTER INSERT ON "communication_audit_events"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "vax_communications_validate_delivery_graph"();--> statement-breakpoint

CREATE FUNCTION "vax_communications_guard_append_only"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_row jsonb;
  new_row jsonb;
  actor_column text;
  old_actor_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'communication delivery, history, and audit evidence is append-only'
      USING ERRCODE = '23514';
  END IF;

  old_row := to_jsonb(OLD);
  new_row := to_jsonb(NEW);
  actor_column := CASE TG_TABLE_NAME
    WHEN 'delivery_attempts' THEN 'attempted_by_profile_id'
    WHEN 'communication_audit_events' THEN 'actor_profile_id'
    ELSE NULL
  END;

  IF actor_column IS NOT NULL
     AND old_row ->> actor_column IS NOT NULL
     AND new_row ->> actor_column IS NULL
     AND (new_row - actor_column) = (old_row - actor_column) THEN
    old_actor_id := (old_row ->> actor_column)::uuid;
    IF NOT EXISTS (
      SELECT 1 FROM public.user_profiles profile
      WHERE profile.id = old_actor_id
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'communication delivery, history, and audit evidence is append-only'
    USING ERRCODE = '23514';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "delivery_attempts_append_only_guard"
BEFORE UPDATE OR DELETE ON "delivery_attempts"
FOR EACH ROW EXECUTE FUNCTION "vax_communications_guard_append_only"();--> statement-breakpoint
CREATE TRIGGER "delivery_results_append_only_guard"
BEFORE UPDATE OR DELETE ON "delivery_results"
FOR EACH ROW EXECUTE FUNCTION "vax_communications_guard_append_only"();--> statement-breakpoint
CREATE TRIGGER "customer_communication_history_append_only_guard"
BEFORE UPDATE OR DELETE ON "customer_communication_history_entries"
FOR EACH ROW EXECUTE FUNCTION "vax_communications_guard_append_only"();--> statement-breakpoint
CREATE TRIGGER "communication_audit_events_append_only_guard"
BEFORE UPDATE OR DELETE ON "communication_audit_events"
FOR EACH ROW EXECUTE FUNCTION "vax_communications_guard_append_only"();
