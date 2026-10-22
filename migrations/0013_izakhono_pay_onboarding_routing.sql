CREATE TABLE IF NOT EXISTS pay_kyb_checks (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  check_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT,
  provider_reference TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pay_kyb_merchant_status ON pay_kyb_checks(merchant_id, status);

CREATE TABLE IF NOT EXISTS pay_provider_routes (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'ZA',
  currency TEXT NOT NULL DEFAULT 'ZAR',
  payment_method TEXT NOT NULL DEFAULT 'any',
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  requires_kyb_status TEXT NOT NULL DEFAULT 'verified',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider, country, currency, payment_method)
);

CREATE INDEX IF NOT EXISTS idx_pay_routes_lookup ON pay_provider_routes(country, currency, payment_method, enabled, priority);

CREATE TABLE IF NOT EXISTS pay_provider_health (
  provider TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'healthy',
  last_checked_at TEXT NOT NULL,
  failure_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pay_audit_events (
  id TEXT PRIMARY KEY,
  merchant_id TEXT,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pay_audit_merchant_created ON pay_audit_events(merchant_id, created_at);

INSERT OR IGNORE INTO pay_provider_routes
(id, provider, country, currency, payment_method, priority, enabled, requires_kyb_status, created_at, updated_at)
VALUES
('route-sandbox-zar-any', 'izakhono_sandbox', 'ZA', 'ZAR', 'any', 1000, 1, 'pending_kyb', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO pay_provider_health
(provider, status, last_checked_at, failure_count, updated_at)
VALUES
('izakhono_sandbox', 'healthy', datetime('now'), 0, datetime('now'));
