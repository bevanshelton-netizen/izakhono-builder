PRAGMA foreign_keys = ON;

ALTER TABLE payment_intents ADD COLUMN idempotency_fingerprint TEXT;
