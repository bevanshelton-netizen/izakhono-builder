CREATE TABLE IF NOT EXISTS builder_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT NOT NULL DEFAULT '',
  modules_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','planned','building','validated','deploy_ready','deployed','paused')),
  build_recipe_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_builder_projects_status ON builder_projects(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS builder_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES builder_projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_builder_events_project ON builder_events(project_id, created_at DESC);
