-- Keep the internal Provisioner worker entry point out of the public RPC surface.
-- The worker is intended to run through the trusted service_role path only.
-- The function itself is SECURITY INVOKER; its internal claim/complete helpers
-- are deliberately not executable by anon or authenticated users.
DO $migration$
BEGIN
  IF to_regprocedure('public.provisioner_run_once(integer)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.provisioner_run_once(integer) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.provisioner_run_once(integer) TO service_role';
    EXECUTE 'ALTER FUNCTION public.provisioner_run_once(integer) SET search_path = pg_catalog, public';
  END IF;
END
$migration$;
