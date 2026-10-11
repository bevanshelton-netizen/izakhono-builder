CREATE TABLE IF NOT EXISTS creator_renders (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  derivative_id TEXT NOT NULL,
  status TEXT NOT NULL,
  object_key TEXT,
  output_url TEXT,
  error TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_creator_renders_project ON creator_renders(project_id);
CREATE INDEX IF NOT EXISTS idx_creator_renders_status ON creator_renders(status);
