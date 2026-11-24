-- TEST ONLY: ephemeral PostgreSQL schema for DEPLOY transaction integration tests.
-- These definitions are not production migrations and are never applied to an
-- IZAKHONO or Supabase environment.
CREATE TABLE izakhono_runtime_deployments (
  deployment_id TEXT PRIMARY KEY,
  workload TEXT NOT NULL,
  state TEXT NOT NULL,
  node TEXT,
  checkpoint TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mirrors the existing Provisioner/FORTRESS audit store contract.
CREATE TABLE fortress_audit_events (
  event_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  adapter TEXT NULL,
  state TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (job_id, operation_id, event_type)
);

CREATE FUNCTION reject_test_audit_event() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.job_id = 'dep-audit-fail' THEN
    RAISE EXCEPTION 'test audit append failure';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER test_audit_failure
BEFORE INSERT ON fortress_audit_events
FOR EACH ROW EXECUTE FUNCTION reject_test_audit_event();
