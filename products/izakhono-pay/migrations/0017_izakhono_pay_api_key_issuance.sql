-- Merchant-scoped API credentials. Raw secrets are never persisted.
CREATE TABLE IF NOT EXISTS pay_api_keys (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (merchant_id) REFERENCES pay_merchants(id)
);
CREATE INDEX IF NOT EXISTS idx_pay_api_keys_merchant_status
  ON pay_api_keys(merchant_id,status);
