-- DEPLOY-owned schema. Existing Runtime Fabric deployment rows are upgraded
-- additively; the shared FORTRESS audit table is deliberately not modified.
CREATE TABLE IF NOT EXISTS izakhono_runtime_deployments (
  deployment_id TEXT PRIMARY KEY,
  workload TEXT NOT NULL,
  state TEXT NOT NULL,
  node TEXT,
  checkpoint TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Upgrade databases where Runtime Fabric created this table before DEPLOY
-- existed. Generated scope columns remain derived from the canonical metadata.
ALTER TABLE izakhono_runtime_deployments
  ADD COLUMN IF NOT EXISTS tenant_id TEXT
    GENERATED ALWAYS AS (metadata->>'tenant_id') STORED;
ALTER TABLE izakhono_runtime_deployments
  ADD COLUMN IF NOT EXISTS application_id TEXT
    GENERATED ALWAYS AS (metadata->>'application_id') STORED;
ALTER TABLE izakhono_runtime_deployments
  ADD COLUMN IF NOT EXISTS environment_id TEXT
    GENERATED ALWAYS AS (metadata->>'environment_id') STORED;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM izakhono_runtime_deployments
     WHERE tenant_id IS NULL OR application_id IS NULL OR environment_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'DEPLOY migration blocked: existing Runtime Fabric rows lack tenant/application/environment metadata';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'izakhono_runtime_deployments'::regclass
       AND conname = 'izakhono_runtime_deployments_metadata_object'
  ) THEN
    ALTER TABLE izakhono_runtime_deployments
      ADD CONSTRAINT izakhono_runtime_deployments_metadata_object
      CHECK (jsonb_typeof(metadata) = 'object') NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'izakhono_runtime_deployments'::regclass
       AND conname = 'izakhono_runtime_deployments_scope_required'
  ) THEN
    ALTER TABLE izakhono_runtime_deployments
      ADD CONSTRAINT izakhono_runtime_deployments_scope_required
      CHECK (tenant_id IS NOT NULL AND application_id IS NOT NULL AND environment_id IS NOT NULL) NOT VALID;
  END IF;
END;
$$;

ALTER TABLE izakhono_runtime_deployments
  VALIDATE CONSTRAINT izakhono_runtime_deployments_metadata_object;
ALTER TABLE izakhono_runtime_deployments
  VALIDATE CONSTRAINT izakhono_runtime_deployments_scope_required;

CREATE UNIQUE INDEX IF NOT EXISTS izakhono_runtime_deployments_id_tenant_uidx
  ON izakhono_runtime_deployments (deployment_id, tenant_id);
CREATE INDEX IF NOT EXISTS izakhono_runtime_deployments_scope_idx
  ON izakhono_runtime_deployments (tenant_id, application_id, environment_id, updated_at DESC);

-- DEPLOY has its own append-only audit relation. Never add deployment FKs,
-- constraints, triggers, or grants to fortress_audit_events: Provisioner uses
-- that shared FORTRESS table with Provisioner job IDs.
CREATE TABLE IF NOT EXISTS izakhono_deploy_audit_events (
  event_id TEXT PRIMARY KEY,
  deployment_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  adapter TEXT,
  state TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT izakhono_deploy_audit_events_data_object
    CHECK (jsonb_typeof(data) = 'object'),
  CONSTRAINT izakhono_deploy_audit_events_deployment_scope_fk
    FOREIGN KEY (deployment_id, tenant_id)
    REFERENCES izakhono_runtime_deployments (deployment_id, tenant_id)
    ON DELETE RESTRICT,
  CONSTRAINT izakhono_deploy_audit_events_operation_unique
    UNIQUE (deployment_id, operation_id, event_type)
);

CREATE INDEX IF NOT EXISTS izakhono_deploy_audit_events_tenant_time_idx
  ON izakhono_deploy_audit_events (tenant_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS izakhono_deploy_audit_events_deployment_time_idx
  ON izakhono_deploy_audit_events (deployment_id, observed_at DESC);

CREATE OR REPLACE FUNCTION izakhono_deploy_audit_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'IZAKHONO DEPLOY audit events are append-only';
END;
$$;

DROP TRIGGER IF EXISTS izakhono_deploy_audit_no_mutation ON izakhono_deploy_audit_events;
CREATE TRIGGER izakhono_deploy_audit_no_mutation
BEFORE UPDATE OR DELETE OR TRUNCATE ON izakhono_deploy_audit_events
FOR EACH STATEMENT
EXECUTE FUNCTION izakhono_deploy_audit_reject_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE izakhono_deploy_audit_events FROM PUBLIC;

COMMENT ON TABLE izakhono_runtime_deployments IS
  'Runtime Fabric deployment records; DEPLOY scope is generated from canonical metadata.';
COMMENT ON TABLE izakhono_deploy_audit_events IS
  'Append-only tenant-scoped IZAKHONO DEPLOY audit ledger, separate from shared FORTRESS Provisioner events.';
