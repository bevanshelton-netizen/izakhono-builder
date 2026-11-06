-- Single-use, short-lived email verification tokens. Store only token digests.
CREATE TABLE IF NOT EXISTS builder_email_verification_tokens (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TEXT,
  FOREIGN KEY(customer_id) REFERENCES builder_customers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_builder_email_verification_customer
  ON builder_email_verification_tokens(customer_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_builder_email_verification_expiry
  ON builder_email_verification_tokens(expires_at);
