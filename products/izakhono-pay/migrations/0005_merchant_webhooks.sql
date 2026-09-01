PRAGMA foreign_keys = ON;

ALTER TABLE merchant_apps ADD COLUMN webhook_url TEXT;
ALTER TABLE merchant_apps ADD COLUMN webhook_secret_env TEXT;

CREATE TABLE IF NOT EXISTS merchant_webhook_deliveries (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  merchant_slug TEXT NOT NULL,
  intent_id TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed','suppressed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_http_status INTEGER,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TEXT,
  FOREIGN KEY (intent_id) REFERENCES payment_intents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_merchant_webhook_delivery_status
  ON merchant_webhook_deliveries(status, created_at DESC);
