PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS principals (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), email TEXT NOT NULL COLLATE NOCASE UNIQUE,
 display_name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('OWNER','SECURITY_ADMIN','ANALYST','VIEWER')),
 password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, password_iterations INTEGER NOT NULL,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 id TEXT PRIMARY KEY, principal_id TEXT NOT NULL REFERENCES principals(id), refresh_hash TEXT NOT NULL UNIQUE,
 access_jti TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS sessions_principal_idx ON sessions(principal_id,revoked_at);
CREATE TABLE IF NOT EXISTS login_attempts (bucket TEXT PRIMARY KEY, failures INTEGER NOT NULL, window_started_at INTEGER NOT NULL, locked_until INTEGER);
CREATE TABLE IF NOT EXISTS audit_events (
 id TEXT PRIMARY KEY, occurred_at INTEGER NOT NULL, event_type TEXT NOT NULL, principal_id TEXT, tenant_id TEXT,
 outcome TEXT NOT NULL, source_ip_hash TEXT, detail_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_events_time_idx ON audit_events(occurred_at);