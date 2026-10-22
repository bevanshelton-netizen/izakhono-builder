-- IZAKHONO PAY merchant-scoped authentication.
-- Store only SHA-256 token hashes; raw secrets are shown once at provisioning time.
CREATE TABLE IF NOT EXISTS pay_api_keys (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  last_used_at TEXT,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (merchant_id) REFERENCES pay_merchants(id)
);
CREATE INDEX IF NOT EXISTS idx_pay_api_keys_merchant_status ON pay_api_keys(merchant_id,status);
CREATE INDEX IF NOT EXISTS idx_pay_api_keys_prefix ON pay_api_keys(key_prefix);

CREATE TABLE IF NOT EXISTS pay_auth_events (
  id TEXT PRIMARY KEY,
  merchant_id TEXT,
  key_id TEXT,
  event_type TEXT NOT NULL,
  ip_hash TEXT,
  created_at TEXT NOT NULL,
  metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_pay_auth_events_merchant_created ON pay_auth_events(merchant_id,created_at DESC);
