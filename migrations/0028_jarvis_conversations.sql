-- Owner-only persistent J.A.R.V.I.S. conversation history.
CREATE TABLE IF NOT EXISTS jarvis_conversations (
  id TEXT PRIMARY KEY,
  owner_scope TEXT NOT NULL DEFAULT 'owner' CHECK(owner_scope='owner'),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jarvis_conversations_updated
  ON jarvis_conversations(owner_scope,status,updated_at DESC);
CREATE TABLE IF NOT EXISTS jarvis_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES jarvis_conversations(id) ON DELETE CASCADE,
  owner_scope TEXT NOT NULL DEFAULT 'owner' CHECK(owner_scope='owner'),
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND 12000),
  agent_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jarvis_messages_conversation
  ON jarvis_messages(owner_scope,conversation_id,created_at ASC);
