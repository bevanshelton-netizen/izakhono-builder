CREATE TABLE IF NOT EXISTS code_agent_sessions (
  id TEXT PRIMARY KEY,
  repository TEXT NOT NULL,
  base_ref TEXT NOT NULL,
  objective TEXT NOT NULL,
  workspace_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('ready','running','complete','blocked','failed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_code_agent_sessions_updated ON code_agent_sessions(updated_at DESC);

CREATE TABLE IF NOT EXISTS code_agent_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES code_agent_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','tool')),
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_code_agent_messages_session ON code_agent_messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS code_agent_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES code_agent_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_code_agent_events_session ON code_agent_events(session_id, created_at);
