DO $attelier_estimate_amount_compatibility_preflight$
BEGIN
  IF current_user <> 'vax_migrator' THEN
    RAISE EXCEPTION 'ATTELIER estimate compatibility migration requires vax_migrator';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = to_regclass('public.request_estimates')
      AND conname = 'request_estimates_amount_group_consistent'
      AND contype = 'c'
  ) THEN
    RAISE EXCEPTION 'ATTELIER estimate compatibility prerequisite is unavailable';
  END IF;
END
$attelier_estimate_amount_compatibility_preflight$;
--> statement-breakpoint
ALTER TABLE "request_estimates" DROP CONSTRAINT "request_estimates_amount_group_consistent";--> statement-breakpoint
ALTER TABLE "request_estimates" ADD CONSTRAINT "request_estimates_amount_group_consistent" CHECK (("request_estimates"."net_amount_minor_units" is null and "request_estimates"."vat_amount_minor_units" is null and "request_estimates"."gross_total_minor_units" is null) or ("request_estimates"."net_amount_minor_units" is null and "request_estimates"."vat_rate_basis_points" is null and "request_estimates"."vat_amount_minor_units" is null and "request_estimates"."gross_total_minor_units" is not null and "request_estimates"."gross_total_minor_units" >= 0 and "request_estimates"."manual_assessment_required" = true and "request_estimates"."status" = 'REVIEW_REQUIRED') or ("request_estimates"."net_amount_minor_units" is not null and "request_estimates"."net_amount_minor_units" >= 0 and "request_estimates"."vat_rate_basis_points" is not null and "request_estimates"."vat_amount_minor_units" is not null and "request_estimates"."vat_amount_minor_units" >= 0 and "request_estimates"."gross_total_minor_units" is not null and "request_estimates"."gross_total_minor_units" = "request_estimates"."net_amount_minor_units" + "request_estimates"."vat_amount_minor_units"));
