-- IZAKHONO Builder Economy control plane
-- Contracts for developer accounts, app ownership, entitlements, metering,
-- pricing, marketplace listings and immutable commercial events.

CREATE TABLE IF NOT EXISTS builder_developers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','team','business','enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS builder_app_registry (
  app_id TEXT PRIMARY KEY,
  developer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  stage TEXT NOT NULL DEFAULT 'idea' CHECK (stage IN ('idea','building','preview','verified','deployed','monetizing','scaled')),
  manifest_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (developer_id) REFERENCES builder_developers(id)
);

CREATE TABLE IF NOT EXISTS builder_entitlements (
  id TEXT PRIMARY KEY,
  developer_id TEXT NOT NULL,
  app_id TEXT,
  product_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','revoked','expired')),
  limits_json TEXT NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'plan',
  starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (developer_id) REFERENCES builder_developers(id),
  FOREIGN KEY (app_id) REFERENCES builder_app_registry(app_id)
);

CREATE INDEX IF NOT EXISTS idx_builder_entitlements_lookup
  ON builder_entitlements(developer_id, app_id, product_id, status);

CREATE TABLE IF NOT EXISTS builder_usage_events (
  event_id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  developer_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity >= 0),
  occurred_at TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  billable INTEGER NOT NULL DEFAULT 1 CHECK (billable IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (app_id) REFERENCES builder_app_registry(app_id),
  FOREIGN KEY (developer_id) REFERENCES builder_developers(id)
);

CREATE INDEX IF NOT EXISTS idx_builder_usage_billing
  ON builder_usage_events(developer_id, metric, occurred_at, billable);

CREATE TABLE IF NOT EXISTS builder_price_catalog (
  price_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  unit TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  included_quantity REAL NOT NULL DEFAULT 0,
  overage_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (overage_amount_minor >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(product_id, plan, currency, unit)
);

CREATE TABLE IF NOT EXISTS builder_marketplace_listings (
  listing_id TEXT PRIMARY KEY,
  developer_id TEXT NOT NULL,
  app_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('api','component','template','agent','app','asset')),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','published','suspended','retired')),
  pricing_json TEXT NOT NULL,
  entitlement_json TEXT NOT NULL DEFAULT '{}',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (developer_id) REFERENCES builder_developers(id),
  FOREIGN KEY (app_id) REFERENCES builder_app_registry(app_id)
);

CREATE TABLE IF NOT EXISTS builder_commercial_events (
  event_id TEXT PRIMARY KEY,
  app_id TEXT,
  developer_id TEXT,
  event_type TEXT NOT NULL,
  currency TEXT,
  gross_minor INTEGER NOT NULL DEFAULT 0,
  platform_fee_minor INTEGER NOT NULL DEFAULT 0,
  seller_net_minor INTEGER NOT NULL DEFAULT 0,
  external_reference TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_builder_commercial_events_owner
  ON builder_commercial_events(developer_id, created_at);

CREATE TABLE IF NOT EXISTS builder_api_credentials (
  key_id TEXT PRIMARY KEY,
  developer_id TEXT NOT NULL,
  app_id TEXT,
  key_prefix TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL,
  scopes_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  FOREIGN KEY (developer_id) REFERENCES builder_developers(id),
  FOREIGN KEY (app_id) REFERENCES builder_app_registry(app_id)
);
