CREATE TABLE IF NOT EXISTS pay_sessions (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  session_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (merchant_id) REFERENCES pay_merchants(id)
);
CREATE INDEX IF NOT EXISTS idx_pay_sessions_merchant ON pay_sessions(merchant_id,expires_at);
CREATE INDEX IF NOT EXISTS idx_pay_sessions_expiry ON pay_sessions(expires_at);
