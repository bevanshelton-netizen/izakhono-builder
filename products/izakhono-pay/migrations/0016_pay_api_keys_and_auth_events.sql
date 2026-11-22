-- Restore the API-key tables required by src/auth.ts and src/api-key-issuance.ts.
-- The raw key is never persisted; key_hash is the only authentication secret stored.
CREATE TABLE IF NOT EXISTS pay_api_keys (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT 'Primary API key',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (merchant_id) REFERENCES pay_merchants(id)
);

CREATE TABLE IF NOT EXISTS pay_auth_events (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  key_id TEXT,
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (merchant_id) REFERENCES pay_merchants(id),
  FOREIGN KEY (key_id) REFERENCES pay_api_keys(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pay_auth_events_merchant_created
  ON pay_auth_events(merchant_id, created_at DESC);
