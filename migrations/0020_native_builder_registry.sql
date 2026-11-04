-- IZAKHONO Native Builder durable project and build-job registry.
-- Payload JSON preserves the complete domain record; indexed columns support queue operations.
CREATE TABLE IF NOT EXISTS native_builder_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  source_of_truth TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_native_builder_projects_status
  ON native_builder_projects(status, updated_at);

CREATE TABLE IF NOT EXISTS native_builder_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  requested_by TEXT NOT NULL,
  approved_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES native_builder_projects(id)
);
CREATE INDEX IF NOT EXISTS idx_native_builder_jobs_queue
  ON native_builder_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_native_builder_jobs_project
  ON native_builder_jobs(project_id, created_at);
