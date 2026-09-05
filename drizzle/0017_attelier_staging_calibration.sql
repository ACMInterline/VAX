DO $attelier_staging_calibration_preflight$
BEGIN
  IF current_user <> 'vax_migrator' THEN
    RAISE EXCEPTION 'ATTELIER staging calibration migration requires vax_migrator';
  END IF;
  IF to_regclass('public.price_books') IS NULL
     OR to_regclass('public.price_rules') IS NULL
     OR to_regclass('public.duration_rules') IS NULL
     OR to_regclass('public.request_estimates') IS NULL THEN
    RAISE EXCEPTION 'ATTELIER staging calibration prerequisites are unavailable';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('price_rules', 'duration_rules')
      AND column_name = 'additional_side_percentage_basis_points'
  ) THEN
    RAISE EXCEPTION 'ATTELIER additional-side columns already exist outside migration history';
  END IF;
END
$attelier_staging_calibration_preflight$;
--> statement-breakpoint
ALTER TABLE "price_books" DROP CONSTRAINT "price_books_vat_mode_valid";--> statement-breakpoint
ALTER TABLE "price_books" DROP CONSTRAINT "price_books_vat_rate_valid";--> statement-breakpoint
ALTER TABLE "request_estimates" DROP CONSTRAINT "request_estimates_vat_rate_valid";--> statement-breakpoint
ALTER TABLE "request_estimates" DROP CONSTRAINT "request_estimates_amount_group_consistent";--> statement-breakpoint
ALTER TABLE "price_books" ALTER COLUMN "default_vat_rate_basis_points" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "request_estimates" ALTER COLUMN "vat_rate_basis_points" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "duration_rules" ADD COLUMN "additional_side_percentage_basis_points" integer;--> statement-breakpoint
ALTER TABLE "price_rules" ADD COLUMN "additional_side_percentage_basis_points" integer;--> statement-breakpoint
ALTER TABLE "duration_rules" ADD CONSTRAINT "duration_rules_additional_side_percentage_valid" CHECK ("duration_rules"."additional_side_percentage_basis_points" is null or ("duration_rules"."billing_unit" = 'PER_SIDE' and "duration_rules"."additional_side_percentage_basis_points" between 0 and 100000));--> statement-breakpoint
ALTER TABLE "price_books" ADD CONSTRAINT "price_books_vat_resolution_consistent" CHECK (("price_books"."vat_mode" = 'VAT_UNRESOLVED' and "price_books"."default_vat_rate_basis_points" is null) or ("price_books"."vat_mode" <> 'VAT_UNRESOLVED' and "price_books"."default_vat_rate_basis_points" is not null));--> statement-breakpoint
ALTER TABLE "price_books" ADD CONSTRAINT "price_books_vat_mode_valid" CHECK ("price_books"."vat_mode" in ('VAT_REGISTERED', 'VAT_NOT_REGISTERED', 'VAT_UNRESOLVED'));--> statement-breakpoint
ALTER TABLE "price_books" ADD CONSTRAINT "price_books_vat_rate_valid" CHECK ("price_books"."default_vat_rate_basis_points" is null or "price_books"."default_vat_rate_basis_points" between 0 and 10000);--> statement-breakpoint
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_additional_side_percentage_valid" CHECK ("price_rules"."additional_side_percentage_basis_points" is null or ("price_rules"."billing_unit" = 'PER_SIDE' and "price_rules"."additional_side_percentage_basis_points" between 0 and 100000));--> statement-breakpoint
ALTER TABLE "request_estimates" ADD CONSTRAINT "request_estimates_vat_rate_valid" CHECK ("request_estimates"."vat_rate_basis_points" is null or "request_estimates"."vat_rate_basis_points" between 0 and 10000);--> statement-breakpoint
ALTER TABLE "request_estimates" ADD CONSTRAINT "request_estimates_amount_group_consistent" CHECK (("request_estimates"."net_amount_minor_units" is null and "request_estimates"."vat_rate_basis_points" is null and "request_estimates"."vat_amount_minor_units" is null and ("request_estimates"."gross_total_minor_units" is null or ("request_estimates"."gross_total_minor_units" >= 0 and "request_estimates"."manual_assessment_required" = true and "request_estimates"."status" = 'REVIEW_REQUIRED'))) or ("request_estimates"."net_amount_minor_units" is not null and "request_estimates"."net_amount_minor_units" >= 0 and "request_estimates"."vat_rate_basis_points" is not null and "request_estimates"."vat_amount_minor_units" is not null and "request_estimates"."vat_amount_minor_units" >= 0 and "request_estimates"."gross_total_minor_units" = "request_estimates"."net_amount_minor_units" + "request_estimates"."vat_amount_minor_units"));
