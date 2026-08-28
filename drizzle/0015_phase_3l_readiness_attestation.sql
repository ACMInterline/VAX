DO $phase3l_readiness_preflight$
BEGIN
  IF current_user <> 'vax_migrator' THEN
    RAISE EXCEPTION 'Phase 3L readiness migration requires vax_migrator';
  END IF;
  IF to_regprocedure('public.vax_migration_history_hashes()') IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 3L readiness function already exists outside migration history';
  END IF;
END
$phase3l_readiness_preflight$;
--> statement-breakpoint
CREATE FUNCTION public.vax_migration_history_hashes()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $phase3l_readiness_function$
  SELECT coalesce(array_agg(migration.hash ORDER BY migration.id), ARRAY[]::text[])
  FROM drizzle.__drizzle_migrations AS migration
$phase3l_readiness_function$;
--> statement-breakpoint
REVOKE ALL PRIVILEGES
  ON FUNCTION public.vax_migration_history_hashes()
  FROM PUBLIC, authenticated, anonymous;
--> statement-breakpoint
GRANT EXECUTE
  ON FUNCTION public.vax_migration_history_hashes()
  TO vax_runtime;
