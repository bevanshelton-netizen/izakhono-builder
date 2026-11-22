ALTER TABLE merchant_webhook_deliveries ADD COLUMN lease_token TEXT;
ALTER TABLE merchant_webhook_deliveries ADD COLUMN lease_expires_at TEXT;
ALTER TABLE merchant_webhook_deliveries ADD COLUMN next_attempt_at TEXT;

CREATE INDEX IF NOT EXISTS idx_merchant_webhook_retry
  ON merchant_webhook_deliveries(status, next_attempt_at, lease_expires_at);
