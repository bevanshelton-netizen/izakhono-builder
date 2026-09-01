PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS payment_intents (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  app_slug TEXT NOT NULL DEFAULT 'internal',
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  customer_email TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  requested_provider TEXT NOT NULL DEFAULT 'smart',
  routed_provider TEXT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','requires_action','processing','paid','failed','cancelled')),
  provider_reference TEXT,
  checkout_url TEXT,
  checkout_method TEXT,
  checkout_token_hash TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_intents_app ON payment_intents(app_slug, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  fingerprint TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  intent_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (intent_id) REFERENCES payment_intents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_events_intent ON payment_events(intent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS routing_rules (
  id TEXT PRIMARY KEY,
  currency TEXT NOT NULL,
  provider TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(currency, provider)
);

INSERT OR IGNORE INTO routing_rules(id,currency,provider,priority,enabled) VALUES
  ('rr_zar_paystack','ZAR','paystack',10,1),
  ('rr_zar_payfast','ZAR','payfast',20,1);
