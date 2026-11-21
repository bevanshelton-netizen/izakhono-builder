-- Native Builder execution leases. Additive only; do not apply remotely until the
-- D1 migration ledger and deployment window have been verified.
CREATE TABLE IF NOT EXISTS native_builder_workers (
  worker_id TEXT PRIMARY KEY,
  credential_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'revoked')),
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  last_seen_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_native_builder_workers_status
  ON native_builder_workers(status, last_seen_at);

CREATE TABLE IF NOT EXISTS native_builder_execution_leases (
  job_id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  lease_token_hash TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  leased_at TEXT NOT NULL,
  heartbeat_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1 CHECK (attempt > 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  FOREIGN KEY(job_id) REFERENCES native_builder_jobs(id),
  FOREIGN KEY(worker_id) REFERENCES native_builder_workers(worker_id)
);
CREATE INDEX IF NOT EXISTS idx_native_builder_leases_expiry
  ON native_builder_execution_leases(expires_at);
CREATE INDEX IF NOT EXISTS idx_native_builder_leases_worker
  ON native_builder_execution_leases(worker_id, expires_at);

CREATE TABLE IF NOT EXISTS native_builder_execution_attempts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  attempt INTEGER NOT NULL CHECK (attempt > 0),
  outcome TEXT NOT NULL CHECK (outcome IN ('claimed', 'heartbeat', 'succeeded', 'failed', 'expired', 'dead_lettered')),
  detail_json TEXT NOT NULL DEFAULT '{}',
  started_at TEXT NOT NULL,
  finished_at TEXT,
  FOREIGN KEY(job_id) REFERENCES native_builder_jobs(id),
  FOREIGN KEY(worker_id) REFERENCES native_builder_workers(worker_id)
);
CREATE INDEX IF NOT EXISTS idx_native_builder_attempts_job
  ON native_builder_execution_attempts(job_id, attempt);

-- Append-only execution timeline. Application credentials must not expose UPDATE/DELETE.
CREATE TABLE IF NOT EXISTS native_builder_job_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  worker_id TEXT,
  event_type TEXT NOT NULL,
  event_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(job_id) REFERENCES native_builder_jobs(id)
);
CREATE INDEX IF NOT EXISTS idx_native_builder_job_events_job
  ON native_builder_job_events(job_id, created_at);
