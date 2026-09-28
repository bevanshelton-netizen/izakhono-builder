PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sign_envelopes (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL UNIQUE,
  event_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  legal_entity TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  title TEXT NOT NULL,
  recipient_name TEXT NOT NULL DEFAULT '',
  recipient_email TEXT NOT NULL DEFAULT '',
  signature_required INTEGER NOT NULL DEFAULT 0,
  content_sha256 TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'created',
  mail_status TEXT NOT NULL DEFAULT 'not_configured',
  expires_at TEXT NOT NULL,
  delivered_at TEXT,
  signed_at TEXT,
  signer_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sign_audit (
  id TEXT PRIMARY KEY,
  envelope_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(envelope_id) REFERENCES sign_envelopes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sign_draft ON sign_envelopes(draft_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sign_status ON sign_envelopes(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_sign_audit_env ON sign_audit(envelope_id, created_at);
