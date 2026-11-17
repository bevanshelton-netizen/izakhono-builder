-- Add the validated worker execution envelope to durable THOR tasks.
-- Existing tasks remain valid but cannot be claimed by the coding-worker endpoint
-- until they have an explicit, validated envelope.
ALTER TABLE thor_tasks ADD COLUMN worker_envelope_json TEXT;

CREATE INDEX IF NOT EXISTS thor_tasks_worker_claim_idx
  ON thor_tasks(state, priority, created_at)
  WHERE worker_envelope_json IS NOT NULL;
