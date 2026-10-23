-- IZAKHONO PAY merchant API-key issuance foundation.
-- Raw keys are never stored; only SHA-256 hashes are persisted.
CREATE INDEX IF NOT EXISTS idx_pay_api_keys_merchant_status
  ON pay_api_keys(merchant_id,status);
