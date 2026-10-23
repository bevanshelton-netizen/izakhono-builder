-- IZAKHONO PAY live-readiness control plane.
-- This records production gates; it does not grant regulatory approval or enable live money movement.
CREATE TABLE IF NOT EXISTS pay_live_readiness_checks (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  check_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','passed','failed','waived')),
  evidence_ref TEXT,
  checked_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(merchant_id,check_code),
  FOREIGN KEY (merchant_id) REFERENCES pay_merchants(id)
);
CREATE INDEX IF NOT EXISTS idx_pay_live_readiness_merchant_status
  ON pay_live_readiness_checks(merchant_id,status);

CREATE TABLE IF NOT EXISTS pay_live_provider_credentials (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK(environment IN ('sandbox','production')),
  status TEXT NOT NULL DEFAULT 'missing' CHECK(status IN ('missing','configured','verified','revoked')),
  credential_ref TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(merchant_id,provider,environment),
  FOREIGN KEY (merchant_id) REFERENCES pay_merchants(id)
);
CREATE INDEX IF NOT EXISTS idx_pay_live_credentials_merchant
  ON pay_live_provider_credentials(merchant_id,environment,status);
