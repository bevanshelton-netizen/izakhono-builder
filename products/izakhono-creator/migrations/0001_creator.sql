CREATE TABLE IF NOT EXISTS creator_projects (
  id TEXT PRIMARY KEY,
  brief TEXT NOT NULL,
  package_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS creator_assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  shot_index INTEGER,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT,
  external_id TEXT,
  object_key TEXT,
  url TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_creator_assets_project ON creator_assets(project_id);
