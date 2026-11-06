-- IZAKHONO BUILDER customer tenancy and flat-rate subscription foundation.
-- Customer access is opt-in only after verified identity and confirmed subscription.
-- Raw passwords, session tokens and provider secrets must never be stored here.

PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS builder_customers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  display_name TEXT NOT NULL,
  organization TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  password_scheme TEXT NOT NULL DEFAULT 'scrypt-v1',
  status TEXT NOT NULL DEFAULT 'pending_verification'
    CHECK(status IN ('pending_verification','active','suspended','closed')),
  email_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(email)
);
CREATE INDEX IF NOT EXISTS idx_builder_customers_status
  ON builder_customers(status, created_at DESC);

CREATE TABLE IF NOT EXISTS builder_customer_sessions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  FOREIGN KEY(customer_id) REFERENCES builder_customers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_builder_customer_sessions_customer
  ON builder_customer_sessions(customer_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_builder_customer_sessions_expiry
  ON builder_customer_sessions(expires_at);

CREATE TABLE IF NOT EXISTS builder_subscriptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  billing_interval TEXT NOT NULL CHECK(billing_interval IN ('month','year')),
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'ZAR' CHECK(currency = 'ZAR'),
  billing_model TEXT NOT NULL DEFAULT 'flat_rate' CHECK(billing_model = 'flat_rate'),
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK(status IN ('pending_payment','active','past_due','cancelled','suspended')),
  payment_provider TEXT NOT NULL DEFAULT 'ikhokha' CHECK(payment_provider = 'ikhokha'),
  provider_customer_reference TEXT,
  last_verified_payment_reference TEXT,
  current_period_start TEXT,
  current_period_end TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(customer_id) REFERENCES builder_customers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_builder_subscriptions_customer
  ON builder_subscriptions(customer_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_builder_subscriptions_provider_reference
  ON builder_subscriptions(payment_provider, provider_customer_reference);

CREATE TABLE IF NOT EXISTS builder_customer_events (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(customer_id) REFERENCES builder_customers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_builder_customer_events_customer
  ON builder_customer_events(customer_id, created_at DESC);

ALTER TABLE builder_projects ADD COLUMN customer_id TEXT
  REFERENCES builder_customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_builder_projects_customer
  ON builder_projects(customer_id, updated_at DESC);
