CREATE TABLE IF NOT EXISTS supervisor_jobs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  priority INTEGER NOT NULL,
  risk TEXT NOT NULL,
  status TEXT NOT NULL,
  dependency_ids_json TEXT NOT NULL DEFAULT '[]',
  human_gate TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  input_json TEXT NOT NULL DEFAULT '{}',
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_supervisor_jobs_status_priority
  ON supervisor_jobs(status, priority);

CREATE TABLE IF NOT EXISTS supervisor_job_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  at TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_supervisor_job_events_job_at
  ON supervisor_job_events(job_id, at);
