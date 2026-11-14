CREATE TABLE IF NOT EXISTS jarvis_action_proposals (
  id TEXT PRIMARY KEY,
  owner_scope TEXT NOT NULL DEFAULT 'owner' CHECK(owner_scope='owner'),
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  risk_level TEXT NOT NULL CHECK(risk_level IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','approved','rejected','expired','cancelled')),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jarvis_proposals_status ON jarvis_action_proposals(owner_scope,status,created_at DESC);
CREATE TABLE IF NOT EXISTS jarvis_proposal_decisions (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL UNIQUE REFERENCES jarvis_action_proposals(id),
  owner_scope TEXT NOT NULL DEFAULT 'owner' CHECK(owner_scope='owner'),
  decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),
  reason TEXT NOT NULL,
  decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS jarvis_audit_events (
  id TEXT PRIMARY KEY,
  owner_scope TEXT NOT NULL DEFAULT 'owner' CHECK(owner_scope='owner'),
  event_type TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jarvis_audit_created ON jarvis_audit_events(owner_scope,created_at DESC);
