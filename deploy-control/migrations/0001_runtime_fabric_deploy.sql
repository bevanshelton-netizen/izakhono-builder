CREATE TABLE IF NOT EXISTS izakhono_runtime_deployments (
  deployment_id TEXT PRIMARY KEY,
  workload TEXT NOT NULL,
  state TEXT NOT NULL,
  node TEXT,
  checkpoint TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  tenant_id TEXT GENERATED ALWAYS AS (metadata->>'tenant_id') STORED,
  application_id TEXT GENERATED ALWAYS AS (metadata->>'application_id') STORED,
  environment_id TEXT GENERATED ALWAYS AS (metadata->>'environment_id') STORED,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT izakhono_runtime_deployments_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT izakhono_runtime_deployments_scope_required
    CHECK (tenant_id IS NOT NULL AND application_id IS NOT NULL AND environment_id IS NOT NULL),
  CONSTRAINT izakhono_runtime_deployments_id_tenant_unique
    UNIQUE (deployment_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS izakhono_runtime_deployments_scope_idx
  ON izakhono_runtime_deployments (tenant_id, application_id, environment_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS fortress_audit_events (
  event_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  adapter TEXT,
  state TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT fortress_audit_events_data_object CHECK (jsonb_typeof(data) = 'object'),
  CONSTRAINT fortress_audit_events_deployment_scope_fk
    FOREIGN KEY (job_id, tenant_id)
    REFERENCES izakhono_runtime_deployments (deployment_id, tenant_id)
    ON DELETE RESTRICT,
  CONSTRAINT fortress_audit_events_operation_unique
    UNIQUE (job_id, operation_id, event_type)
);

CREATE INDEX IF NOT EXISTS fortress_audit_events_tenant_time_idx
  ON fortress_audit_events (tenant_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS fortress_audit_events_job_time_idx
  ON fortress_audit_events (job_id, observed_at DESC);

CREATE OR REPLACE FUNCTION fortress_audit_events_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'FORTRESS audit events are append-only';
END;
$$;

DROP TRIGGER IF EXISTS fortress_audit_events_no_mutation ON fortress_audit_events;
CREATE TRIGGER fortress_audit_events_no_mutation
BEFORE UPDATE OR DELETE OR TRUNCATE ON fortress_audit_events
FOR EACH STATEMENT
EXECUTE FUNCTION fortress_audit_events_reject_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE fortress_audit_events FROM PUBLIC;

COMMENT ON TABLE izakhono_runtime_deployments IS
  'Runtime Fabric deployment records; scope is materialized from metadata for owner-controlled authorization.';
COMMENT ON TABLE fortress_audit_events IS
  'Append-only DEPLOY/FORTRESS audit ledger. Runtime role must not own this table or hold UPDATE/DELETE/TRUNCATE privileges.';
