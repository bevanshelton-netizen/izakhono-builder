CREATE TABLE IF NOT EXISTS pay_merchants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending_kyb',
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pay_merchants_status ON pay_merchants(status);

CREATE TABLE IF NOT EXISTS pay_payment_intents (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL,
  description TEXT,
  idempotency_key TEXT NOT NULL,
  provider TEXT,
  provider_reference TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(merchant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_pay_intents_merchant_created ON pay_payment_intents(merchant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pay_intents_status ON pay_payment_intents(status);

CREATE TABLE IF NOT EXISTS pay_links (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pay_links_merchant ON pay_links(merchant_id);

CREATE TABLE IF NOT EXISTS pay_ledger_events (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_pay_ledger_payment_created ON pay_ledger_events(payment_id, created_at);

CREATE TABLE IF NOT EXISTS pay_refunds (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pay_refunds_payment ON pay_refunds(payment_id);

CREATE TABLE IF NOT EXISTS pay_settlements (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  reference TEXT,
  gross_amount REAL,
  fees REAL,
  net_amount REAL,
  status TEXT NOT NULL,
  settled_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pay_settlements_merchant_date ON pay_settlements(merchant_id, settled_at);
