PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settlement_records (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  app_slug TEXT NOT NULL,
  provider_reference TEXT,
  merchant_reference TEXT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
  net_minor INTEGER NOT NULL CHECK (net_minor >= 0 AND net_minor <= amount_minor),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  settled_at TEXT,
  fingerprint TEXT NOT NULL UNIQUE,
  raw_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settlement_records_app_provider
  ON settlement_records(app_slug, provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlement_records_provider_ref
  ON settlement_records(provider, provider_reference);
CREATE INDEX IF NOT EXISTS idx_settlement_records_merchant_ref
  ON settlement_records(app_slug, merchant_reference);

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id TEXT PRIMARY KEY,
  app_slug TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  settlement_count INTEGER NOT NULL DEFAULT 0 CHECK (settlement_count >= 0),
  matched_count INTEGER NOT NULL DEFAULT 0 CHECK (matched_count >= 0),
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  duplicate_count INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
  matched_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (matched_amount_minor >= 0),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  error_code TEXT
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_app
  ON reconciliation_runs(app_slug, started_at DESC);

CREATE TABLE IF NOT EXISTS reconciliation_matches (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  settlement_id TEXT NOT NULL UNIQUE,
  intent_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('matched','review','duplicate')),
  match_type TEXT CHECK (match_type IS NULL OR match_type IN ('provider_reference','merchant_reference')),
  reason TEXT,
  difference_minor INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (settlement_id) REFERENCES settlement_records(id) ON DELETE CASCADE,
  FOREIGN KEY (intent_id) REFERENCES payment_intents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_run
  ON reconciliation_matches(run_id, status);
CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_intent
  ON reconciliation_matches(intent_id, status);

CREATE TABLE IF NOT EXISTS reconciliation_exceptions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  settlement_id TEXT NOT NULL,
  intent_id TEXT,
  reason TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open','resolved','ignored')),
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  FOREIGN KEY (run_id) REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (settlement_id) REFERENCES settlement_records(id) ON DELETE CASCADE,
  FOREIGN KEY (intent_id) REFERENCES payment_intents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_exceptions_open
  ON reconciliation_exceptions(app_slug, state, created_at DESC);
