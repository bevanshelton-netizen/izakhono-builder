-- IZAKHONO Provisioner durable queue schema.
-- Runtime migration is idempotent; PostgreSQLQueue.ensure_schema() mirrors it.
CREATE TABLE IF NOT EXISTS provisioner_queue (
  job_id TEXT PRIMARY KEY,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_id TEXT,
  leased_until TIMESTAMPTZ,
  last_error_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS provisioner_queue_ready_idx
  ON provisioner_queue (available_at, updated_at);

-- Workers claim using FOR UPDATE SKIP LOCKED. A lease expires automatically,
-- allowing another worker to recover a job after a crash.
