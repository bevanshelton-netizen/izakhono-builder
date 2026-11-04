CREATE TABLE IF NOT EXISTS native_builder_execution_evidence (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(job_id) REFERENCES native_builder_jobs(id)
);
CREATE INDEX IF NOT EXISTS idx_native_builder_evidence_job
  ON native_builder_execution_evidence(job_id, created_at);
