CREATE TABLE IF NOT EXISTS builder_internal_repositories (
  project_id TEXT PRIMARY KEY REFERENCES builder_projects(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility = 'private'),
  head_commit_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS builder_internal_repo_commits (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES builder_projects(id) ON DELETE CASCADE,
  parent_commit_id TEXT REFERENCES builder_internal_repo_commits(id),
  revision TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  message TEXT NOT NULL,
  files_json TEXT NOT NULL,
  file_count INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_builder_internal_repo_commits_project
  ON builder_internal_repo_commits(project_id, created_at DESC);
