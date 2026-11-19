ALTER TABLE merchant_webhook_deliveries ADD COLUMN dead_lettered_at TEXT;

CREATE INDEX IF NOT EXISTS idx_merchant_webhook_dead_letter
  ON merchant_webhook_deliveries(dead_lettered_at, status, created_at);
