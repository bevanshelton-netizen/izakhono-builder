-- Controlled workforce queue state; no external actions or autonomous credentials are granted.
ALTER TABLE jarvis_orchestration_steps ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jarvis_orchestration_steps ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3;
ALTER TABLE jarvis_orchestration_steps ADD COLUMN lease_owner TEXT;
ALTER TABLE jarvis_orchestration_steps ADD COLUMN lease_until TEXT;
ALTER TABLE jarvis_orchestration_steps ADD COLUMN last_error TEXT;
ALTER TABLE jarvis_orchestration_steps ADD COLUMN evidence_json TEXT;
ALTER TABLE jarvis_orchestration_steps ADD COLUMN updated_at TEXT;
UPDATE jarvis_orchestration_steps SET updated_at=CURRENT_TIMESTAMP WHERE updated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jarvis_workforce_queue ON jarvis_orchestration_steps(owner_scope,status,assigned_agent,position);
