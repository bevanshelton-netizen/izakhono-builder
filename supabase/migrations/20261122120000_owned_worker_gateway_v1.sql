-- IZAKHONO owned worker gateway v1.
-- Additive only: does not alter iz_worker_jobs, Edge Functions, payments, identity or storage buckets.
DO $$ BEGIN
  CREATE ROLE owned_worker_gateway NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.owned_worker_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  worker_key text NOT NULL,
  token_hash char(64) NOT NULL UNIQUE,
  capabilities text[] NOT NULL DEFAULT ARRAY['job:claim','job:heartbeat','job:complete','job:fail'],
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT owned_worker_credentials_worker_tenant_unique UNIQUE (tenant_id, worker_key)
);
CREATE INDEX IF NOT EXISTS owned_worker_credentials_active_idx
  ON public.owned_worker_credentials (active, worker_key);

CREATE TABLE IF NOT EXISTS public.owned_worker_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  worker_key text NOT NULL,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','completed','blocked','failed','cancelled')),
  priority integer NOT NULL DEFAULT 50 CHECK (priority BETWEEN 1 AND 100),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  not_before timestamptz NOT NULL DEFAULT now(),
  lease_owner text,
  lease_token_hash char(64),
  lease_expires_at timestamptz,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT owned_worker_jobs_idempotency_unique UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT owned_worker_jobs_tenant_id_unique UNIQUE (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS owned_worker_jobs_claim_idx
  ON public.owned_worker_jobs (tenant_id, worker_key, status, not_before, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS owned_worker_jobs_lease_idx
  ON public.owned_worker_jobs (tenant_id, status, lease_expires_at);

CREATE TABLE IF NOT EXISTS public.owned_worker_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL,
  job_id uuid NOT NULL,
  CONSTRAINT owned_worker_events_job_tenant_fk FOREIGN KEY (tenant_id, job_id)
    REFERENCES public.owned_worker_jobs(tenant_id, id) ON DELETE RESTRICT,
  worker_key text NOT NULL,
  event_type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS owned_worker_events_job_idx
  ON public.owned_worker_events (tenant_id, job_id, created_at DESC);

ALTER TABLE public.owned_worker_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owned_worker_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owned_worker_events ENABLE ROW LEVEL SECURITY;

-- Credential rows are deliberately not directly selectable. Authentication uses this narrow function.
CREATE OR REPLACE FUNCTION public.authenticate_owned_worker(p_token_hash text)
RETURNS TABLE (tenant_id uuid, worker_key text, capabilities text[])
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT c.tenant_id, c.worker_key, c.capabilities
  FROM public.owned_worker_credentials c
  WHERE c.token_hash = p_token_hash
    AND c.active = true
    AND (c.expires_at IS NULL OR c.expires_at > now())
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.authenticate_owned_worker(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.authenticate_owned_worker(text) TO owned_worker_gateway;

DROP POLICY IF EXISTS owned_worker_jobs_tenant_scope ON public.owned_worker_jobs;
CREATE POLICY owned_worker_jobs_tenant_scope ON public.owned_worker_jobs
  FOR ALL TO owned_worker_gateway
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS owned_worker_events_tenant_read ON public.owned_worker_events;
CREATE POLICY owned_worker_events_tenant_read ON public.owned_worker_events
  FOR SELECT TO owned_worker_gateway
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
DROP POLICY IF EXISTS owned_worker_events_tenant_insert ON public.owned_worker_events;
CREATE POLICY owned_worker_events_tenant_insert ON public.owned_worker_events
  FOR INSERT TO owned_worker_gateway
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

GRANT USAGE ON SCHEMA public TO owned_worker_gateway;
GRANT SELECT, INSERT, UPDATE ON public.owned_worker_jobs TO owned_worker_gateway;
GRANT SELECT, INSERT ON public.owned_worker_events TO owned_worker_gateway;
-- Credentials are accessed only through narrow security-definer functions.
CREATE OR REPLACE FUNCTION public.touch_owned_worker_credential(p_token_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $touch$
BEGIN
  UPDATE public.owned_worker_credentials
  SET last_seen_at = now(), updated_at = now()
  WHERE token_hash = p_token_hash AND active = true
    AND (expires_at IS NULL OR expires_at > now());
  RETURN FOUND;
END
$touch$;
REVOKE ALL ON FUNCTION public.touch_owned_worker_credential(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_owned_worker_credential(text) TO owned_worker_gateway;

