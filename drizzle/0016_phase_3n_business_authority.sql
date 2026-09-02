DO $phase3n_business_authority_preflight$
BEGIN
  IF current_user <> 'vax_migrator' THEN
    RAISE EXCEPTION 'Phase 3N business-authority migration requires vax_migrator';
  END IF;
  IF to_regclass('public.business_authority_records') IS NOT NULL
     OR to_regclass('public.business_authority_audit_events') IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 3N business-authority tables already exist outside migration history';
  END IF;
  IF to_regprocedure('public.vax_business_authority_guard_record()') IS NOT NULL
     OR to_regprocedure('public.vax_business_authority_guard_audit()') IS NOT NULL
     OR to_regprocedure('public.vax_business_authority_validate_graph()') IS NOT NULL
     OR to_regprocedure('public.vax_business_authority_assert_actor_context(uuid,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 3N business-authority functions already exist outside migration history';
  END IF;
END
$phase3n_business_authority_preflight$;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TABLE "business_authority_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"authority_record_id" uuid NOT NULL,
	"authority_key" varchar(96) NOT NULL,
	"authority_version" integer NOT NULL,
	"record_version" integer NOT NULL,
	"environment_scope" varchar(16) NOT NULL,
	"category" varchar(32) NOT NULL,
	"event_type" varchar(48) NOT NULL,
	"previous_status" varchar(32),
	"next_status" varchar(32) NOT NULL,
	"decision_authority_type" varchar(32),
	"actor_profile_id" uuid NOT NULL,
	"actor_role_codes" jsonb NOT NULL,
	"evidence_reference" varchar(500),
	"safe_evidence_summary" text,
	"correlation_id" uuid NOT NULL,
	"safe_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_authority_audit_events_version_valid" CHECK ("business_authority_audit_events"."authority_version" >= 1 and "business_authority_audit_events"."record_version" >= 0),
	CONSTRAINT "business_authority_audit_events_environment_valid" CHECK ("business_authority_audit_events"."environment_scope" in ('DEVELOPMENT', 'STAGING', 'PRODUCTION')),
	CONSTRAINT "business_authority_audit_events_status_valid" CHECK (("business_authority_audit_events"."previous_status" is null or "business_authority_audit_events"."previous_status" in ('PROPOSED', 'UNDER_REVIEW', 'APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION', 'SUPERSEDED', 'REJECTED')) and "business_authority_audit_events"."next_status" in ('PROPOSED', 'UNDER_REVIEW', 'APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION', 'SUPERSEDED', 'REJECTED')),
	CONSTRAINT "business_authority_audit_events_event_valid" CHECK ("business_authority_audit_events"."event_type" in ('AUTHORITY_PROPOSED', 'AUTHORITY_SUBMITTED_FOR_REVIEW', 'AUTHORITY_APPROVAL_RECORDED', 'AUTHORITY_APPROVED', 'AUTHORITY_REJECTED', 'AUTHORITY_SUPERSEDED')),
	CONSTRAINT "business_authority_audit_events_authority_type_valid" CHECK ("business_authority_audit_events"."decision_authority_type" is null or "business_authority_audit_events"."decision_authority_type" in ('OWNER', 'ACCOUNTANT', 'LEGAL', 'OPERATIONS', 'TECHNICAL', 'CONTENT_CLAIMS')),
	CONSTRAINT "business_authority_audit_events_role_snapshot_valid" CHECK (jsonb_typeof("business_authority_audit_events"."actor_role_codes") = 'array' and jsonb_array_length("business_authority_audit_events"."actor_role_codes") > 0),
	CONSTRAINT "business_authority_audit_events_metadata_valid" CHECK (jsonb_typeof("business_authority_audit_events"."safe_metadata") = 'object'),
	CONSTRAINT "business_authority_audit_events_semantics_valid" CHECK (("business_authority_audit_events"."event_type" = 'AUTHORITY_PROPOSED' and "business_authority_audit_events"."previous_status" is null and "business_authority_audit_events"."next_status" = 'PROPOSED' and "business_authority_audit_events"."decision_authority_type" is null) or ("business_authority_audit_events"."event_type" = 'AUTHORITY_SUBMITTED_FOR_REVIEW' and "business_authority_audit_events"."previous_status" = 'PROPOSED' and "business_authority_audit_events"."next_status" = 'UNDER_REVIEW' and "business_authority_audit_events"."decision_authority_type" is null) or ("business_authority_audit_events"."event_type" = 'AUTHORITY_APPROVAL_RECORDED' and "business_authority_audit_events"."previous_status" = 'UNDER_REVIEW' and "business_authority_audit_events"."next_status" = 'UNDER_REVIEW' and "business_authority_audit_events"."decision_authority_type" is not null) or ("business_authority_audit_events"."event_type" = 'AUTHORITY_APPROVED' and "business_authority_audit_events"."previous_status" = 'UNDER_REVIEW' and "business_authority_audit_events"."next_status" in ('APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION') and "business_authority_audit_events"."decision_authority_type" is not null) or ("business_authority_audit_events"."event_type" = 'AUTHORITY_REJECTED' and "business_authority_audit_events"."previous_status" in ('PROPOSED', 'UNDER_REVIEW') and "business_authority_audit_events"."next_status" = 'REJECTED' and "business_authority_audit_events"."decision_authority_type" is null) or ("business_authority_audit_events"."event_type" = 'AUTHORITY_SUPERSEDED' and "business_authority_audit_events"."previous_status" in ('APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION') and "business_authority_audit_events"."next_status" = 'SUPERSEDED' and "business_authority_audit_events"."decision_authority_type" is null))
);
--> statement-breakpoint
CREATE TABLE "business_authority_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"authority_key" varchar(96) NOT NULL,
	"category" varchar(32) NOT NULL,
	"version" integer NOT NULL,
	"record_version" integer DEFAULT 0 NOT NULL,
	"environment_scope" varchar(16) NOT NULL,
	"status" varchar(32) DEFAULT 'PROPOSED' NOT NULL,
	"evidence_class" varchar(32) NOT NULL,
	"required_authority_types" jsonb NOT NULL,
	"authority_value" jsonb NOT NULL,
	"source_reference" varchar(500),
	"safe_evidence_summary" text,
	"internal_notes" text,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_until" timestamp with time zone,
	"proposed_by_profile_id" uuid NOT NULL,
	"approved_by_profile_id" uuid,
	"approved_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"superseded_by_record_id" uuid,
	"transition_correlation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_authority_records_key_valid" CHECK ("business_authority_records"."authority_key" ~ '^[A-Z][A-Z0-9_]{1,95}$'),
	CONSTRAINT "business_authority_records_category_valid" CHECK ("business_authority_records"."category" in ('BRAND_CONTENT', 'SERVICE_SCOPE', 'PRICING', 'VAT_TAX', 'SELLER_LEGAL', 'SCHEDULING', 'TRAVEL', 'TEAMS_EQUIPMENT', 'AUTH', 'PRIVACY_RETENTION', 'EMAIL', 'MONITORING', 'BACKUP_RECOVERY', 'FINANCE_FISCAL', 'DATABASE', 'DOMAIN_TLS', 'DEPLOYMENT_AUTHORIZATION')),
	CONSTRAINT "business_authority_records_environment_valid" CHECK ("business_authority_records"."environment_scope" in ('DEVELOPMENT', 'STAGING', 'PRODUCTION')),
	CONSTRAINT "business_authority_records_status_valid" CHECK ("business_authority_records"."status" in ('PROPOSED', 'UNDER_REVIEW', 'APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION', 'SUPERSEDED', 'REJECTED')),
	CONSTRAINT "business_authority_records_evidence_class_valid" CHECK ("business_authority_records"."evidence_class" in ('OWNER_INPUT', 'SYSTEM_VERIFIED', 'EXTERNAL_EVIDENCE_REQUIRED')),
	CONSTRAINT "business_authority_records_version_valid" CHECK ("business_authority_records"."version" >= 1 and "business_authority_records"."record_version" >= 0),
	CONSTRAINT "business_authority_records_authority_types_valid" CHECK (jsonb_typeof("business_authority_records"."required_authority_types") = 'array' and jsonb_array_length("business_authority_records"."required_authority_types") > 0 and not jsonb_path_exists("business_authority_records"."required_authority_types", '$[*] ? (@ != "OWNER" && @ != "ACCOUNTANT" && @ != "LEGAL" && @ != "OPERATIONS" && @ != "TECHNICAL" && @ != "CONTENT_CLAIMS")')),
	CONSTRAINT "business_authority_records_value_valid" CHECK (jsonb_typeof("business_authority_records"."authority_value") = 'object' and jsonb_typeof("business_authority_records"."authority_value"->'kind') = 'string'),
	CONSTRAINT "business_authority_records_external_evidence_present" CHECK ("business_authority_records"."evidence_class" <> 'EXTERNAL_EVIDENCE_REQUIRED' or "business_authority_records"."source_reference" is not null),
	CONSTRAINT "business_authority_records_effective_window_valid" CHECK ("business_authority_records"."effective_until" is null or "business_authority_records"."effective_until" > "business_authority_records"."effective_from"),
	CONSTRAINT "business_authority_records_environment_approval_valid" CHECK (("business_authority_records"."status" <> 'APPROVED_FOR_STAGING' or "business_authority_records"."environment_scope" = 'STAGING') and ("business_authority_records"."status" <> 'APPROVED_FOR_PRODUCTION' or "business_authority_records"."environment_scope" = 'PRODUCTION')),
	CONSTRAINT "business_authority_records_lifecycle_valid" CHECK (("business_authority_records"."status" in ('PROPOSED', 'UNDER_REVIEW', 'REJECTED') and "business_authority_records"."approved_by_profile_id" is null and "business_authority_records"."approved_at" is null and "business_authority_records"."superseded_at" is null and "business_authority_records"."superseded_by_record_id" is null) or ("business_authority_records"."status" in ('APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION') and "business_authority_records"."approved_by_profile_id" is not null and "business_authority_records"."approved_at" is not null and "business_authority_records"."superseded_at" is null and "business_authority_records"."superseded_by_record_id" is null) or ("business_authority_records"."status" = 'SUPERSEDED' and "business_authority_records"."approved_by_profile_id" is not null and "business_authority_records"."approved_at" is not null and "business_authority_records"."superseded_at" is not null and "business_authority_records"."superseded_by_record_id" is not null and "business_authority_records"."superseded_at" >= "business_authority_records"."approved_at"))
);
--> statement-breakpoint
ALTER TABLE "business_legal_profiles" DROP CONSTRAINT "business_legal_profiles_environment_valid";--> statement-breakpoint
ALTER TABLE "invoice_numbering_policies" DROP CONSTRAINT "invoice_numbering_policies_environment_valid";--> statement-breakpoint
ALTER TABLE "invoice_policies" DROP CONSTRAINT "invoice_policies_environment_valid";--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_environment_valid";--> statement-breakpoint
ALTER TABLE "business_authority_audit_events" ADD CONSTRAINT "business_authority_audit_events_authority_record_id_business_authority_records_id_fk" FOREIGN KEY ("authority_record_id") REFERENCES "public"."business_authority_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_authority_audit_events" ADD CONSTRAINT "business_authority_audit_events_actor_profile_id_user_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_authority_records" ADD CONSTRAINT "business_authority_records_proposed_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("proposed_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_authority_records" ADD CONSTRAINT "business_authority_records_approved_by_profile_id_user_profiles_id_fk" FOREIGN KEY ("approved_by_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_authority_records" ADD CONSTRAINT "business_authority_records_superseded_by_fk" FOREIGN KEY ("superseded_by_record_id") REFERENCES "public"."business_authority_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_authority_audit_events_correlation_unique" ON "business_authority_audit_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "business_authority_audit_events_record_version_unique" ON "business_authority_audit_events" USING btree ("authority_record_id","record_version");--> statement-breakpoint
CREATE INDEX "business_authority_audit_events_record_time_idx" ON "business_authority_audit_events" USING btree ("authority_record_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "business_authority_records_key_environment_version_unique" ON "business_authority_records" USING btree ("authority_key","environment_scope","version");--> statement-breakpoint
CREATE UNIQUE INDEX "business_authority_records_transition_correlation_unique" ON "business_authority_records" USING btree ("transition_correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "business_authority_records_current_approved_unique" ON "business_authority_records" USING btree ("authority_key","environment_scope") WHERE "business_authority_records"."status" in ('APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION');--> statement-breakpoint
CREATE INDEX "business_authority_records_readiness_idx" ON "business_authority_records" USING btree ("environment_scope","category","status","effective_from");--> statement-breakpoint
ALTER TABLE "business_legal_profiles" ADD CONSTRAINT "business_legal_profiles_environment_valid" CHECK ("business_legal_profiles"."environment_scope" in ('DEVELOPMENT', 'STAGING', 'PRODUCTION'));--> statement-breakpoint
ALTER TABLE "invoice_numbering_policies" ADD CONSTRAINT "invoice_numbering_policies_environment_valid" CHECK ("invoice_numbering_policies"."environment_scope" in ('DEVELOPMENT', 'STAGING', 'PRODUCTION'));--> statement-breakpoint
ALTER TABLE "invoice_policies" ADD CONSTRAINT "invoice_policies_environment_valid" CHECK ("invoice_policies"."environment_scope" in ('DEVELOPMENT', 'STAGING', 'PRODUCTION'));--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_environment_valid" CHECK ("invoices"."environment_scope" in ('DEVELOPMENT', 'STAGING', 'PRODUCTION'));
--> statement-breakpoint
CREATE FUNCTION public.vax_business_authority_assert_actor_context(
  expected_actor_profile_id uuid,
  expected_correlation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $phase3n_actor_context$
DECLARE
  actor_profile_text text;
  provider_user_id text;
  primary_correlation_text text;
  secondary_correlation_text text;
  issued_at_text text;
  supplied_signature text;
  derived_key_hex text;
  actor_profile_id uuid;
  primary_correlation_id uuid;
  secondary_correlation_id uuid;
  issued_at_epoch bigint;
  current_epoch bigint;
  encoded_actor_profile text;
  encoded_provider_user text;
  encoded_primary_correlation text;
  encoded_secondary_correlation text;
  signed_payload text;
  expected_signature bytea;
  context_use_id integer;
BEGIN
  -- Migration and recovery sessions are separately protected by the migrator
  -- role. Every runtime write must carry a fresh application-signed binding.
  IF session_user = 'vax_migrator' THEN
    RETURN;
  END IF;
  IF session_user <> 'vax_runtime' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'business-authority actor context is invalid';
  END IF;

  actor_profile_text := current_setting(
    'vax.business_authority.actor_profile_id', true
  );
  provider_user_id := current_setting(
    'vax.business_authority.provider_user_id', true
  );
  primary_correlation_text := current_setting(
    'vax.business_authority.primary_correlation_id', true
  );
  secondary_correlation_text := current_setting(
    'vax.business_authority.secondary_correlation_id', true
  );
  issued_at_text := current_setting(
    'vax.business_authority.issued_at', true
  );
  supplied_signature := current_setting(
    'vax.business_authority.signature', true
  );

  IF actor_profile_text IS NULL OR actor_profile_text = ''
     OR provider_user_id IS NULL OR provider_user_id = ''
     OR length(provider_user_id) > 255
     OR primary_correlation_text IS NULL OR primary_correlation_text = ''
     OR secondary_correlation_text IS NULL
     OR issued_at_text IS NULL OR issued_at_text !~ '^[0-9]{1,12}$'
     OR supplied_signature IS NULL
     OR supplied_signature !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'business-authority actor context is invalid';
  END IF;

  actor_profile_id := actor_profile_text::uuid;
  primary_correlation_id := primary_correlation_text::uuid;
  IF secondary_correlation_text = '' THEN
    secondary_correlation_id := NULL;
  ELSE
    secondary_correlation_id := secondary_correlation_text::uuid;
  END IF;
  issued_at_epoch := issued_at_text::bigint;
  current_epoch := floor(extract(epoch FROM clock_timestamp()))::bigint;
  IF issued_at_epoch < current_epoch - 120
     OR issued_at_epoch > current_epoch + 30 THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'business-authority actor context is invalid';
  END IF;

  SELECT metadata.value->>'derivedKeyHex'
  INTO derived_key_hex
  FROM public.system_metadata metadata
  WHERE metadata.key = 'business_authority_actor_context_v1';
  IF derived_key_hex IS NULL OR derived_key_hex !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'business-authority actor context is invalid';
  END IF;

  encoded_actor_profile := replace(replace(
    encode(convert_to(actor_profile_text, 'UTF8'), 'base64'), chr(10), ''
  ), chr(13), '');
  encoded_provider_user := replace(replace(
    encode(convert_to(provider_user_id, 'UTF8'), 'base64'), chr(10), ''
  ), chr(13), '');
  encoded_primary_correlation := replace(replace(
    encode(convert_to(primary_correlation_text, 'UTF8'), 'base64'), chr(10), ''
  ), chr(13), '');
  encoded_secondary_correlation := replace(replace(
    encode(convert_to(secondary_correlation_text, 'UTF8'), 'base64'), chr(10), ''
  ), chr(13), '');
  signed_payload := 'vax/business-authority/actor-context/signature/v1|'
    || length(encoded_actor_profile)::text || ':' || encoded_actor_profile || '|'
    || length(encoded_provider_user)::text || ':' || encoded_provider_user || '|'
    || length(encoded_primary_correlation)::text || ':' || encoded_primary_correlation || '|'
    || length(encoded_secondary_correlation)::text || ':' || encoded_secondary_correlation || '|'
    || issued_at_text;
  expected_signature := public.hmac(
    convert_to(signed_payload, 'UTF8'),
    decode(derived_key_hex, 'hex'),
    'sha256'
  );
  IF decode(supplied_signature, 'hex') <> expected_signature THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'business-authority actor context is invalid';
  END IF;

  IF expected_actor_profile_id IS NOT NULL
     AND actor_profile_id <> expected_actor_profile_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'business-authority actor context is invalid';
  END IF;
  IF expected_correlation_id IS NOT NULL
     AND expected_correlation_id <> primary_correlation_id
     AND (
       secondary_correlation_id IS NULL
       OR expected_correlation_id <> secondary_correlation_id
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'business-authority actor context is invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_profiles profile
    JOIN public.user_roles assignment
      ON assignment.user_profile_id = profile.id
     AND assignment.active = true
    JOIN public.application_roles role
      ON role.id = assignment.role_id
     AND role.active = true
     AND role.code = 'OWNER'
    JOIN public.role_permissions mapping ON mapping.role_id = role.id
    JOIN public.permissions permission
      ON permission.id = mapping.permission_id
     AND permission.active = true
     AND permission.code = 'SYSTEM_SETTINGS_MANAGE'
    WHERE profile.id = actor_profile_id
      AND profile.auth_provider_user_id = provider_user_id
      AND profile.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'business-authority actor context is invalid';
  END IF;

  -- The same signed tuple may authorize the record and audit triggers within
  -- one transaction, but it must never authorize a second transaction.
  DELETE FROM public.system_metadata metadata
  WHERE starts_with(
      metadata.key,
      'business_authority_actor_context_use:'
    )
    AND metadata.updated_at < clock_timestamp() - interval '10 minutes';
  INSERT INTO public.system_metadata AS metadata (key, value)
  VALUES (
    'business_authority_actor_context_use:' || supplied_signature,
    jsonb_build_object('transactionId', txid_current()::text)
  )
  ON CONFLICT (key) DO UPDATE
    SET updated_at = metadata.updated_at
    WHERE metadata.value->>'transactionId' = txid_current()::text
  RETURNING metadata.id INTO context_use_id;
  IF context_use_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'business-authority actor context is invalid';
  END IF;
EXCEPTION
  WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'business-authority actor context is invalid';
END
$phase3n_actor_context$;
--> statement-breakpoint
CREATE FUNCTION public.vax_business_authority_guard_record()
RETURNS trigger
LANGUAGE plpgsql
AS $phase3n_record_guard$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'business-authority records cannot be deleted';
  END IF;

  IF current_user = 'vax_runtime' THEN
    PERFORM public.vax_business_authority_assert_actor_context(
      CASE WHEN TG_OP = 'INSERT' THEN NEW.proposed_by_profile_id ELSE NULL END,
      NEW.transition_correlation_id
    );
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'PROPOSED'
       OR NEW.record_version <> 0
       OR NEW.approved_by_profile_id IS NOT NULL
       OR NEW.approved_at IS NOT NULL
       OR NEW.superseded_at IS NOT NULL
       OR NEW.superseded_by_record_id IS NOT NULL THEN
      RAISE EXCEPTION 'business-authority records must start as PROPOSED';
    END IF;
    IF current_user = 'vax_runtime'
       AND NEW.evidence_class = 'SYSTEM_VERIFIED' THEN
      RAISE EXCEPTION 'runtime cannot self-assert system-verified authority';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.authority_key IS DISTINCT FROM OLD.authority_key
     OR NEW.category IS DISTINCT FROM OLD.category
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.environment_scope IS DISTINCT FROM OLD.environment_scope
     OR NEW.evidence_class IS DISTINCT FROM OLD.evidence_class
     OR NEW.required_authority_types IS DISTINCT FROM OLD.required_authority_types
     OR NEW.authority_value IS DISTINCT FROM OLD.authority_value
     OR NEW.source_reference IS DISTINCT FROM OLD.source_reference
     OR NEW.safe_evidence_summary IS DISTINCT FROM OLD.safe_evidence_summary
     OR NEW.internal_notes IS DISTINCT FROM OLD.internal_notes
     OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
     OR NEW.effective_until IS DISTINCT FROM OLD.effective_until
     OR NEW.proposed_by_profile_id IS DISTINCT FROM OLD.proposed_by_profile_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'business-authority content is immutable; create a new version';
  END IF;
  IF NEW.record_version <> OLD.record_version + 1
     OR NEW.transition_correlation_id = OLD.transition_correlation_id
     OR NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'business-authority transition version is invalid';
  END IF;

  IF NOT (
    (OLD.status = 'PROPOSED' AND NEW.status IN ('UNDER_REVIEW', 'REJECTED'))
    OR (OLD.status = 'UNDER_REVIEW' AND NEW.status IN (
      'UNDER_REVIEW', 'APPROVED_FOR_STAGING',
      'APPROVED_FOR_PRODUCTION', 'REJECTED'
    ))
    OR (OLD.status IN ('APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION')
      AND NEW.status = 'SUPERSEDED')
  ) THEN
    RAISE EXCEPTION 'invalid business-authority status transition';
  END IF;

  IF OLD.status IN ('APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION') THEN
    IF NEW.approved_by_profile_id IS DISTINCT FROM OLD.approved_by_profile_id
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'approved business-authority provenance is immutable';
    END IF;
  END IF;

  RETURN NEW;
END
$phase3n_record_guard$;
--> statement-breakpoint
CREATE FUNCTION public.vax_business_authority_guard_audit()
RETURNS trigger
LANGUAGE plpgsql
AS $phase3n_audit_guard$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'business-authority audit events are append-only';
  END IF;
  IF current_user = 'vax_runtime' THEN
    PERFORM public.vax_business_authority_assert_actor_context(
      NEW.actor_profile_id,
      NEW.correlation_id
    );
  END IF;
  NEW.occurred_at := clock_timestamp();
  RETURN NEW;
END
$phase3n_audit_guard$;
--> statement-breakpoint
CREATE FUNCTION public.vax_business_authority_validate_graph()
RETURNS trigger
LANGUAGE plpgsql
AS $phase3n_graph_guard$
DECLARE
  target_record public.business_authority_records%ROWTYPE;
  target_event public.business_authority_audit_events%ROWTYPE;
  prior_event public.business_authority_audit_events%ROWTYPE;
  missing_authority text;
BEGIN
  IF TG_TABLE_NAME = 'business_authority_records' THEN
    target_record := NEW;
    SELECT event.* INTO target_event
    FROM public.business_authority_audit_events event
    WHERE event.authority_record_id = NEW.id
      AND event.record_version = NEW.record_version
      AND event.correlation_id = NEW.transition_correlation_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'business-authority transition lacks exact audit evidence';
    END IF;
  ELSE
    target_event := NEW;
    SELECT record.* INTO target_record
    FROM public.business_authority_records record
    WHERE record.id = NEW.authority_record_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'business-authority audit target is missing';
    END IF;
  END IF;

  IF target_event.authority_key <> target_record.authority_key
     OR target_event.authority_version <> target_record.version
     OR target_event.environment_scope <> target_record.environment_scope
     OR target_event.category <> target_record.category
     OR target_event.record_version <> target_record.record_version
     OR target_event.next_status <> target_record.status
     OR target_event.correlation_id <> target_record.transition_correlation_id THEN
    RAISE EXCEPTION 'business-authority audit identity does not match its record';
  END IF;

  IF target_event.record_version = 0 THEN
    IF target_event.event_type <> 'AUTHORITY_PROPOSED'
       OR target_event.previous_status IS NOT NULL THEN
      RAISE EXCEPTION 'business-authority initial audit transition is invalid';
    END IF;
  ELSE
    SELECT event.* INTO prior_event
    FROM public.business_authority_audit_events event
    WHERE event.authority_record_id = target_event.authority_record_id
      AND event.record_version = target_event.record_version - 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'business-authority audit transition lacks prior state';
    END IF;
    IF target_event.previous_status IS DISTINCT FROM prior_event.next_status
       OR NOT (
         (prior_event.next_status = 'PROPOSED'
           AND target_event.event_type IN (
             'AUTHORITY_SUBMITTED_FOR_REVIEW', 'AUTHORITY_REJECTED'
           ))
         OR (prior_event.next_status = 'UNDER_REVIEW'
           AND target_event.event_type IN (
             'AUTHORITY_APPROVAL_RECORDED', 'AUTHORITY_APPROVED',
             'AUTHORITY_REJECTED'
           ))
         OR (prior_event.next_status IN (
             'APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION'
           ) AND target_event.event_type = 'AUTHORITY_SUPERSEDED')
       ) THEN
      RAISE EXCEPTION 'business-authority audit transition chain is invalid';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_profiles profile
    JOIN public.user_roles assignment
      ON assignment.user_profile_id = profile.id
     AND assignment.active = true
    JOIN public.application_roles role
      ON role.id = assignment.role_id
     AND role.active = true
     AND role.code = 'OWNER'
    JOIN public.role_permissions mapping ON mapping.role_id = role.id
    JOIN public.permissions permission
      ON permission.id = mapping.permission_id
     AND permission.active = true
     AND permission.code = 'SYSTEM_SETTINGS_MANAGE'
    WHERE profile.id = target_event.actor_profile_id
      AND profile.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'business-authority transition requires an active Owner';
  END IF;

  IF target_event.event_type = 'AUTHORITY_PROPOSED'
     AND target_event.actor_profile_id <> target_record.proposed_by_profile_id THEN
    RAISE EXCEPTION 'business-authority proposer provenance does not match';
  END IF;
  IF target_event.event_type = 'AUTHORITY_APPROVED'
     AND target_event.actor_profile_id <> target_record.approved_by_profile_id THEN
    RAISE EXCEPTION 'business-authority approver provenance does not match';
  END IF;
  IF target_event.decision_authority_type IN ('ACCOUNTANT', 'LEGAL')
     AND target_event.evidence_reference IS NULL THEN
    RAISE EXCEPTION 'professional authority requires a safe evidence reference';
  END IF;
  IF target_event.event_type IN (
       'AUTHORITY_APPROVAL_RECORDED', 'AUTHORITY_APPROVED'
     ) AND NOT (
       target_record.required_authority_types
         ? target_event.decision_authority_type
     ) THEN
    RAISE EXCEPTION 'business-authority audit approval type is not required';
  END IF;
  IF target_event.event_type IN (
       'AUTHORITY_APPROVAL_RECORDED', 'AUTHORITY_APPROVED'
     ) AND EXISTS (
       SELECT 1
       FROM public.business_authority_audit_events prior_approval
       WHERE prior_approval.authority_record_id = target_record.id
         AND prior_approval.record_version < target_event.record_version
         AND prior_approval.event_type IN (
           'AUTHORITY_APPROVAL_RECORDED', 'AUTHORITY_APPROVED'
         )
         AND prior_approval.decision_authority_type =
           target_event.decision_authority_type
     ) THEN
    RAISE EXCEPTION 'business-authority audit approval type is duplicated';
  END IF;

  IF target_record.status IN ('APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION') THEN
    SELECT required.value INTO missing_authority
    FROM jsonb_array_elements_text(target_record.required_authority_types) required(value)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.business_authority_audit_events approval
      WHERE approval.authority_record_id = target_record.id
        AND approval.decision_authority_type = required.value
        AND approval.event_type IN (
          'AUTHORITY_APPROVAL_RECORDED', 'AUTHORITY_APPROVED'
        )
    )
    LIMIT 1;
    IF missing_authority IS NOT NULL THEN
      RAISE EXCEPTION 'business-authority approval is incomplete';
    END IF;
  END IF;

  IF target_record.status = 'SUPERSEDED' AND NOT EXISTS (
    SELECT 1
    FROM public.business_authority_records replacement
    WHERE replacement.id = target_record.superseded_by_record_id
      AND replacement.authority_key = target_record.authority_key
      AND replacement.environment_scope = target_record.environment_scope
      AND replacement.version > target_record.version
      AND replacement.status IN (
        'APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION'
      )
      AND replacement.effective_from >= target_record.effective_from
      AND target_record.superseded_at >= replacement.effective_from
  ) THEN
    RAISE EXCEPTION 'business-authority supersession target is invalid';
  END IF;

  IF target_record.status IN (
       'APPROVED_FOR_STAGING', 'APPROVED_FOR_PRODUCTION'
     ) AND EXISTS (
       SELECT 1
       FROM public.business_authority_records predecessor
       WHERE predecessor.superseded_by_record_id = target_record.id
         AND predecessor.authority_key = target_record.authority_key
         AND predecessor.environment_scope = target_record.environment_scope
         AND predecessor.effective_from > target_record.effective_from
     ) THEN
    RAISE EXCEPTION 'business-authority supersession chronology is invalid';
  END IF;

  RETURN NEW;
END
$phase3n_graph_guard$;
--> statement-breakpoint
CREATE TRIGGER vax_business_authority_record_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.business_authority_records
FOR EACH ROW EXECUTE FUNCTION public.vax_business_authority_guard_record();
--> statement-breakpoint
CREATE TRIGGER vax_business_authority_audit_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.business_authority_audit_events
FOR EACH ROW EXECUTE FUNCTION public.vax_business_authority_guard_audit();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER vax_business_authority_record_graph
AFTER INSERT OR UPDATE ON public.business_authority_records
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.vax_business_authority_validate_graph();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER vax_business_authority_audit_graph
AFTER INSERT ON public.business_authority_audit_events
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.vax_business_authority_validate_graph();
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE
  public.business_authority_records,
  public.business_authority_audit_events
FROM PUBLIC, authenticated, anonymous, vax_runtime;
--> statement-breakpoint
ALTER TABLE public.business_authority_records ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.business_authority_audit_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.business_authority_records TO vax_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT
  ON TABLE public.business_authority_audit_events TO vax_runtime;
--> statement-breakpoint
CREATE POLICY vax_runtime_select ON public.business_authority_records
  FOR SELECT TO vax_runtime USING (true);
--> statement-breakpoint
CREATE POLICY vax_runtime_insert ON public.business_authority_records
  FOR INSERT TO vax_runtime WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY vax_runtime_update ON public.business_authority_records
  FOR UPDATE TO vax_runtime USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY vax_runtime_select ON public.business_authority_audit_events
  FOR SELECT TO vax_runtime USING (true);
--> statement-breakpoint
CREATE POLICY vax_runtime_insert ON public.business_authority_audit_events
  FOR INSERT TO vax_runtime WITH CHECK (true);
--> statement-breakpoint
REVOKE ALL PRIVILEGES
  ON FUNCTION public.vax_business_authority_guard_record(),
  public.vax_business_authority_guard_audit(),
  public.vax_business_authority_validate_graph()
  FROM PUBLIC, authenticated, anonymous, vax_runtime;
--> statement-breakpoint
REVOKE ALL PRIVILEGES
  ON FUNCTION public.vax_business_authority_assert_actor_context(uuid, uuid)
  FROM PUBLIC, authenticated, anonymous, vax_runtime;
--> statement-breakpoint
GRANT EXECUTE
  ON FUNCTION public.vax_business_authority_assert_actor_context(uuid, uuid)
  TO vax_runtime;
