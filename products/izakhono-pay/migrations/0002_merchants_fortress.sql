PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS merchant_apps (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  api_key_hash TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'staged' CHECK (status IN ('staged','active','suspended','closed')),
  fortress_required INTEGER NOT NULL DEFAULT 1 CHECK (fortress_required IN (0,1)),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO merchant_apps(id,slug,display_name,status,fortress_required) VALUES
  ('m_kora','kora','KORA','staged',1),
  ('m_allegro','allegro-vibez','ALLEGRO-VIBEZ','staged',1),
  ('m_ecd360','ecd360','ECD360','staged',1),
  ('m_fais','faisready','FAISReady','staged',1),
  ('m_videonomy','videonomy','VIDEONOMY','staged',1),
  ('m_doxa','doxa-sure','DOXA-SURE','staged',1),
  ('m_chancellor','the-chancellor','The Chancellor','staged',1),
  ('m_group','izakhono-group','IZAKHONO Group','staged',1),
  ('m_racing','bevan-shelton-racing','Bevan Shelton Racing','staged',1);

CREATE TABLE IF NOT EXISTS fortress_security_events (
  id TEXT PRIMARY KEY,
  severity TEXT NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
  category TEXT NOT NULL,
  source TEXT NOT NULL,
  merchant_slug TEXT,
  intent_id TEXT,
  fingerprint TEXT NOT NULL UNIQUE,
  details_json TEXT NOT NULL DEFAULT '{}',
  fortress_status TEXT NOT NULL DEFAULT 'pending' CHECK (fortress_status IN ('pending','delivered','suppressed','failed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TEXT,
  FOREIGN KEY (intent_id) REFERENCES payment_intents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fortress_events_status ON fortress_security_events(fortress_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fortress_events_merchant ON fortress_security_events(merchant_slug, created_at DESC);
