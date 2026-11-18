-- J.A.R.V.I.S. owner task queue. This migration is intentionally not applied to any database here.
-- Single-owner scope mirrors the existing Builder ADMIN_SECRET guard; no tenant identity is inferred.
CREATE TABLE IF NOT EXISTS jarvis_tasks (
  id TEXT PRIMARY KEY,
  owner_scope TEXT NOT NULL DEFAULT 'owner' CHECK (owner_scope = 'owner'),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','blocked','done','cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  due_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jarvis_tasks_owner_status_updated
  ON jarvis_tasks(owner_scope, status, updated_at DESC);
