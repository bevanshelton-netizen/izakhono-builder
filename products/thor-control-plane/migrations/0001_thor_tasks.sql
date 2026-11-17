-- THOR durable task queue (SQLite / Cloudflare D1 compatible)
CREATE TABLE IF NOT EXISTS thor_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  instruction TEXT NOT NULL,
  depends_on_json TEXT NOT NULL DEFAULT '[]',
  priority INTEGER NOT NULL DEFAULT 100,
  state TEXT NOT NULL CHECK (state IN ('queued','running','succeeded','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  worker_id TEXT,
  lease_until TEXT,
  result_json TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS thor_tasks_claim_idx
  ON thor_tasks(state, priority, created_at);

CREATE INDEX IF NOT EXISTS thor_tasks_project_idx
  ON thor_tasks(project_id, state, updated_at);

CREATE TABLE IF NOT EXISTS thor_task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES thor_tasks(id),
  event_type TEXT NOT NULL,
  worker_id TEXT,
  event_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS thor_task_events_task_idx
  ON thor_task_events(task_id, created_at);

-- A production adapter must claim a candidate using a transaction and a
-- conditional update that checks both state and expired lease. It must also
-- verify all dependency rows are succeeded before changing the task to running.
-- Do not implement claim as SELECT followed by an unconditional UPDATE.
