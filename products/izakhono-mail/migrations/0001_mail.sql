PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS mail_outbox (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  recipient_name TEXT NOT NULL DEFAULT '',
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  state TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  smtp_message_id TEXT NOT NULL DEFAULT '',
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mail_state ON mail_outbox(state, updated_at);

CREATE TABLE IF NOT EXISTS mail_audit (
  id TEXT PRIMARY KEY,
  outbox_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(outbox_id) REFERENCES mail_outbox(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mail_audit_outbox ON mail_audit(outbox_id, created_at);
