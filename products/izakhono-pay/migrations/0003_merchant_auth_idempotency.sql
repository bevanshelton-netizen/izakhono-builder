PRAGMA foreign_keys = ON;

ALTER TABLE payment_intents ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_app_idempotency
  ON payment_intents(app_slug, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_merchant_apps_status
  ON merchant_apps(status, slug);
