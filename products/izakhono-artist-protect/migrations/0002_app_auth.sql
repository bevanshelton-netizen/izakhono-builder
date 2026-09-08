CREATE TABLE IF NOT EXISTS artist_protect_apps(
  slug TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','paused')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
