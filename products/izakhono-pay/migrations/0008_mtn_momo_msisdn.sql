ALTER TABLE payment_intents ADD COLUMN customer_msisdn TEXT;

CREATE INDEX IF NOT EXISTS idx_payment_intents_provider_reference
  ON payment_intents(routed_provider, provider_reference);
