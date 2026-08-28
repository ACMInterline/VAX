DO $phase3l_rate_limit_preflight$
BEGIN
  IF current_user <> 'vax_migrator' THEN
    RAISE EXCEPTION 'Phase 3L rate-limit migration requires vax_migrator';
  END IF;
  IF to_regclass('public.operational_rate_limits') IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 3L rate-limit table already exists outside migration history';
  END IF;
END
$phase3l_rate_limit_preflight$;
--> statement-breakpoint
CREATE TABLE "operational_rate_limits" (
	"scope" varchar(40) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resets_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operational_rate_limits_scope_key_hash_pk" PRIMARY KEY("scope","key_hash"),
	CONSTRAINT "operational_rate_limits_scope_valid" CHECK ("operational_rate_limits"."scope" in ('LOGIN', 'SIGNUP', 'PASSWORD_RESET', 'EMAIL_VERIFICATION', 'ADMIN_MUTATION', 'BOOKING_MUTATION', 'JOB_MUTATION', 'FINANCE_MUTATION', 'COMMUNICATION_MUTATION', 'PUBLIC_REQUEST')),
	CONSTRAINT "operational_rate_limits_key_hash_valid" CHECK ("operational_rate_limits"."key_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "operational_rate_limits_attempt_count_positive" CHECK ("operational_rate_limits"."attempt_count" >= 1),
	CONSTRAINT "operational_rate_limits_window_valid" CHECK ("operational_rate_limits"."resets_at" > "operational_rate_limits"."window_started_at"),
	CONSTRAINT "operational_rate_limits_updated_at_valid" CHECK ("operational_rate_limits"."updated_at" >= "operational_rate_limits"."window_started_at")
);
--> statement-breakpoint
CREATE INDEX "operational_rate_limits_expiry_idx" ON "operational_rate_limits" USING btree ("resets_at");
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.operational_rate_limits
  FROM PUBLIC, authenticated, anonymous, vax_runtime;
--> statement-breakpoint
ALTER TABLE public.operational_rate_limits ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.operational_rate_limits TO vax_runtime;
--> statement-breakpoint
CREATE POLICY vax_runtime_select ON public.operational_rate_limits
  FOR SELECT TO vax_runtime USING (true);
--> statement-breakpoint
CREATE POLICY vax_runtime_insert ON public.operational_rate_limits
  FOR INSERT TO vax_runtime WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY vax_runtime_update ON public.operational_rate_limits
  FOR UPDATE TO vax_runtime USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY vax_runtime_delete_expired ON public.operational_rate_limits
  FOR DELETE TO vax_runtime USING (resets_at <= clock_timestamp());
