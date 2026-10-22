PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS mail_identities (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  mailbox_id TEXT NOT NULL UNIQUE,
  quota_bytes INTEGER NOT NULL DEFAULT 1073741824,
  uid_validity INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mail_messages (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  mailbox_id TEXT NOT NULL,
  folder TEXT NOT NULL CHECK (folder IN ('INBOX','SENT','DRAFTS','ARCHIVE','JUNK','TRASH')),
  sender TEXT NOT NULL,
  recipients_json TEXT NOT NULL DEFAULT '[]',
  cc_json TEXT NOT NULL DEFAULT '[]',
  subject TEXT NOT NULL DEFAULT '',
  headers_json TEXT NOT NULL DEFAULT '{}',
  body TEXT NOT NULL DEFAULT '',
  raw_message TEXT NOT NULL DEFAULT '',
  flags_json TEXT NOT NULL DEFAULT '[]',
  delivery_state TEXT NOT NULL DEFAULT 'delivered' CHECK (delivery_state IN ('queued','processing','delivered','deferred','failed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(mailbox_id) REFERENCES mail_identities(mailbox_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mail_messages_mailbox_folder_created ON mail_messages(mailbox_id, folder, created_at DESC);

CREATE TABLE IF NOT EXISTS mail_core_audit (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
