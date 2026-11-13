-- Durable, idempotent leases for specialist-agent execution.
-- Human-gated/high-risk work remains outside automatic claims.
CREATE TABLE IF NOT EXISTS supervisor_execution_leases (
  job_id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  lease_token_hash TEXT NOT NULL,
  leased_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  heartbeat_at TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  idempotency_key TEXT NOT NULL UNIQUE,
  FOREIGN KEY(job_id) REFERENCES supervisor_jobs(id)
);
CREATE INDEX IF NOT EXISTS idx_supervisor_leases_expiry
  ON supervisor_execution_leases(expires_at);
CREATE TABLE IF NOT EXISTS supervisor_execution_attempts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  started_at TEXT NOT NULL,
  finished_at TEXT,
  FOREIGN KEY(job_id) REFERENCES supervisor_jobs(id)
);
CREATE INDEX IF NOT EXISTS idx_supervisor_attempts_job
  ON supervisor_execution_attempts(job_id, attempt);
