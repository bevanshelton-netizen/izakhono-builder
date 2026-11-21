-- IZAKHONO-owned PostgreSQL schema for J.A.R.V.I.S.
-- Mirrors the reviewed D1 migrations 0025-0031. Applied only by the explicit installer.
CREATE TABLE IF NOT EXISTS jarvis_tasks (
  id TEXT PRIMARY KEY,
  owner_scope TEXT NOT NULL DEFAULT 'owner' CHECK (owner_scope = 'owner'),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','blocked','done','cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  due_at TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jarvis_tasks_owner_status_updated ON jarvis_tasks(owner_scope,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS jarvis_context_items (
  id TEXT PRIMARY KEY,
  owner_scope TEXT NOT NULL DEFAULT 'owner' CHECK (owner_scope = 'owner'),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('company','project','general')),
  scope_id TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 12000),
  source_label TEXT NOT NULL DEFAULT 'owner-entered' CHECK (char_length(source_label) <= 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((scope_type='general' AND scope_id='general') OR (scope_type IN ('company','project') AND char_length(scope_id) BETWEEN 1 AND 120))
);
CREATE INDEX IF NOT EXISTS idx_jarvis_context_scope_updated ON jarvis_context_items(owner_scope,scope_type,scope_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS jarvis_task_context (
  task_id TEXT NOT NULL REFERENCES jarvis_tasks(id) ON DELETE CASCADE,
  context_id TEXT NOT NULL REFERENCES jarvis_context_items(id) ON DELETE CASCADE,
  owner_scope TEXT NOT NULL DEFAULT 'owner' CHECK (owner_scope='owner'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(task_id,context_id)
);
CREATE INDEX IF NOT EXISTS idx_jarvis_task_context_owner ON jarvis_task_context(owner_scope,task_id);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jarvis_proposals_status ON jarvis_action_proposals(owner_scope,status,created_at DESC);
CREATE TABLE IF NOT EXISTS jarvis_proposal_decisions (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL UNIQUE REFERENCES jarvis_action_proposals(id),
  owner_scope TEXT NOT NULL DEFAULT 'owner' CHECK(owner_scope='owner'),
  decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),
  reason TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS jarvis_audit_events (
  id TEXT PRIMARY KEY,
  owner_scope TEXT NOT NULL DEFAULT 'owner' CHECK(owner_scope='owner'),
  event_type TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jarvis_audit_created ON jarvis_audit_events(owner_scope,created_at DESC);

CREATE TABLE IF NOT EXISTS jarvis_conversations (
  id TEXT PRIMARY KEY,
  owner_scope TEXT NOT NULL DEFAULT 'owner' CHECK(owner_scope='owner'),
  title TEXT NOT NULL CHECK(char_length(title) BETWEEN 1 AND 160),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jarvis_conversations_updated ON jarvis_conversations(owner_scope,status,updated_at DESC);
CREATE TABLE IF NOT EXISTS jarvis_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES jarvis_conversations(id) ON DELETE CASCADE,
  owner_scope TEXT NOT NULL DEFAULT 'owner' CHECK(owner_scope='owner'),
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL CHECK(char_length(content) BETWEEN 1 AND 12000),
  agent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jarvis_messages_conversation ON jarvis_messages(owner_scope,conversation_id,created_at ASC);

CREATE TABLE IF NOT EXISTS jarvis_orchestration_runs (
  id TEXT PRIMARY KEY,
  owner_scope TEXT NOT NULL DEFAULT 'owner' CHECK(owner_scope='owner'),
  instruction TEXT NOT NULL,
  objective TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','blocked','completed','cancelled')),
  risk_level TEXT NOT NULL CHECK(risk_level IN ('low','medium','high','critical')),
  evidence_json TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS jarvis_orchestration_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES jarvis_orchestration_runs(id),
  owner_scope TEXT NOT NULL DEFAULT 'owner' CHECK(owner_scope='owner'),
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  assigned_agent TEXT NOT NULL,
  depends_on_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','blocked','completed','cancelled')),
  approval_required SMALLINT NOT NULL DEFAULT 0 CHECK(approval_required IN (0,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  lease_owner TEXT,
  lease_until TEXT,
  last_error TEXT,
  evidence_json TEXT,
  updated_at TIMESTAMPTZ,
  owner_verification TEXT NOT NULL DEFAULT 'pending' CHECK(owner_verification IN ('pending','verified','rejected')),
  owner_review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  UNIQUE(run_id,position)
);
CREATE INDEX IF NOT EXISTS idx_jarvis_orchestration_runs ON jarvis_orchestration_runs(owner_scope,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jarvis_orchestration_steps ON jarvis_orchestration_steps(run_id,position);
CREATE INDEX IF NOT EXISTS idx_jarvis_workforce_queue ON jarvis_orchestration_steps(owner_scope,status,assigned_agent,position);
