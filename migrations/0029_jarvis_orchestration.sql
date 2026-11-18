CREATE TABLE IF NOT EXISTS jarvis_orchestration_runs (
 id TEXT PRIMARY KEY,
 owner_scope TEXT NOT NULL DEFAULT 'owner' CHECK(owner_scope='owner'),
 instruction TEXT NOT NULL,
 objective TEXT NOT NULL,
 agent_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','blocked','completed','cancelled')),
 risk_level TEXT NOT NULL CHECK(risk_level IN ('low','medium','high','critical')),
 evidence_json TEXT NOT NULL DEFAULT '[]',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
 approval_required INTEGER NOT NULL DEFAULT 0 CHECK(approval_required IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(run_id,position)
);
CREATE INDEX IF NOT EXISTS idx_jarvis_orchestration_runs ON jarvis_orchestration_runs(owner_scope,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jarvis_orchestration_steps ON jarvis_orchestration_steps(run_id,position);
