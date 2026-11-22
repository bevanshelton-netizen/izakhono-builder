-- Runs only against the disposable PostgreSQL service in GitHub Actions.
\set ON_ERROR_STOP on

DO $$
DECLARE
  tenant_a constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  tenant_b constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  visible_count integer;
  changed_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'owned_worker_jobs' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on owned_worker_jobs';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'owned_worker_events' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on owned_worker_events';
  END IF;

  IF (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'runtime login must not be superuser or BYPASSRLS';
  END IF;

  IF pg_has_role(current_user, 'owned_worker_gateway', 'USAGE') IS NOT TRUE THEN
    RAISE EXCEPTION 'runtime login is not a member of owned_worker_gateway';
  END IF;

  IF has_table_privilege(current_user, 'public.owned_worker_credentials', 'SELECT') THEN
    RAISE EXCEPTION 'runtime login must not read credential rows directly';
  END IF;

  IF has_table_privilege(current_user, 'public.owned_worker_jobs', 'DELETE') THEN
    RAISE EXCEPTION 'runtime login must not delete jobs';
  END IF;

  IF has_table_privilege(current_user, 'public.owned_worker_events', 'UPDATE') OR
     has_table_privilege(current_user, 'public.owned_worker_events', 'DELETE') THEN
    RAISE EXCEPTION 'event log must be append-only for runtime login';
  END IF;

  IF has_table_privilege(current_user, 'public.owned_worker_ci_unrelated', 'SELECT') THEN
    RAISE EXCEPTION 'runtime login has access to unrelated application data';
  END IF;

  PERFORM set_config('app.tenant_id', tenant_a::text, true);
  SELECT count(*) INTO visible_count FROM public.owned_worker_jobs;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'tenant A should see exactly one job; saw %', visible_count;
  END IF;

  UPDATE public.owned_worker_jobs SET status = 'completed'
  WHERE tenant_id = tenant_b;
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 0 THEN
    RAISE EXCEPTION 'tenant A updated tenant B rows';
  END IF;

  BEGIN
    INSERT INTO public.owned_worker_jobs
      (tenant_id, idempotency_key, worker_key, job_type)
    VALUES (tenant_b, 'cross-tenant-insert', 'worker-b', 'ci-test');
    RAISE EXCEPTION 'cross-tenant insert unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  INSERT INTO public.owned_worker_events
    (tenant_id, job_id, worker_key, event_type, detail)
  VALUES (
    tenant_a,
    (SELECT id FROM public.owned_worker_jobs WHERE tenant_id = tenant_a LIMIT 1),
    'worker-a',
    'ci_security_check',
    '{"source":"postgres-ci"}'::jsonb
  );

  PERFORM set_config('app.tenant_id', '', true);
  SELECT count(*) INTO visible_count FROM public.owned_worker_jobs;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'missing tenant context did not fail closed';
  END IF;
END $$;

-- Direct event mutation must be denied by SQL privileges.
DO $$
BEGIN
  BEGIN
    UPDATE public.owned_worker_events SET detail = '{"tampered":true}';
    RAISE EXCEPTION 'event update unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

SELECT 'owned-worker PostgreSQL security integration: PASS' AS result;
