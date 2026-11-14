-- J.A.R.V.I.S. shared owner context and explicit task attachments.
-- One owner scope is supported by the current Builder ADMIN_SECRET guard.
-- Context records are source-labelled; no cross-company identity or permissions are inferred.
CREATE TABLE IF NOT EXISTS jarvis_context_items (
  id TEXT PRIMARY KEY,
  owner_scope TEXT NOT NULL DEFAULT 'owner' CHECK (owner_scope = 'owner'),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('company','project','general')),
  scope_id TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 12000),
  source_label TEXT NOT NULL DEFAULT 'owner-entered' CHECK (length(source_label) <= 120),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (scope_type = 'general' AND scope_id = 'general') OR
    (scope_type IN ('company','project') AND length(scope_id) BETWEEN 1 AND 120)
  )
);
CREATE INDEX IF NOT EXISTS idx_jarvis_context_scope_updated
  ON jarvis_context_items(owner_scope, scope_type, scope_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS jarvis_task_context (
  task_id TEXT NOT NULL REFERENCES jarvis_tasks(id) ON DELETE CASCADE,
  context_id TEXT NOT NULL REFERENCES jarvis_context_items(id) ON DELETE CASCADE,
  owner_scope TEXT NOT NULL DEFAULT 'owner' CHECK (owner_scope = 'owner'),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(task_id, context_id)
);
CREATE INDEX IF NOT EXISTS idx_jarvis_task_context_owner
  ON jarvis_task_context(owner_scope, task_id);
