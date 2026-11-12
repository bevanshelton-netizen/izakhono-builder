-- The workflow-runs table already has a unique constraint on (organization_id, idempotency_key).
-- Remove the redundant standalone index created during the first queue migration.
drop index if exists public.ic_workflow_runs_org_idempotency_uidx;
