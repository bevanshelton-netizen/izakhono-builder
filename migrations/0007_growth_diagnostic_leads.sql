CREATE TABLE IF NOT EXISTS growth_diagnostic_leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  intent TEXT NOT NULL,
  lane TEXT NOT NULL,
  lead_score INTEGER NOT NULL,
  focus TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  recommended_products_json TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  consent INTEGER NOT NULL CHECK (consent = 1),
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_growth_diagnostic_leads_created
  ON growth_diagnostic_leads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_diagnostic_leads_priority
  ON growth_diagnostic_leads(status, lead_score DESC, created_at DESC);
