PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS flowiq_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '',
  legal_entity TEXT NOT NULL DEFAULT '',
  draft_id TEXT NOT NULL DEFAULT '',
  subject_id TEXT NOT NULL DEFAULT '',
  subject_type TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS flowiq_actions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_state TEXT NOT NULL DEFAULT 'queued',
  adapter_name TEXT NOT NULL DEFAULT '',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(event_id) REFERENCES flowiq_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS flowiq_audit (
  id TEXT PRIMARY KEY,
  event_id TEXT,
  action_id TEXT,
  event_name TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_flowiq_events_created ON flowiq_events(created_at);
CREATE INDEX IF NOT EXISTS idx_flowiq_events_type ON flowiq_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_flowiq_actions_state ON flowiq_actions(action_state, updated_at);
