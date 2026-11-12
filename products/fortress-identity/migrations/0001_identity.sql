PRAGMA foreign_keys = ON;
CREATE TABLE principals (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE UNIQUE, display_name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('OWNER','SECURITY_ADMIN','ANALYST','VIEWER')), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE UNIQUE INDEX one_fortress_owner ON principals(role) WHERE role='OWNER';
CREATE TABLE credentials (principal_id TEXT PRIMARY KEY REFERENCES principals(id) ON DELETE CASCADE, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, password_iterations INTEGER NOT NULL, changed_at INTEGER NOT NULL);
CREATE TABLE refresh_sessions (id TEXT PRIMARY KEY, principal_id TEXT NOT NULL REFERENCES principals(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, csrf_hash TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER, replaced_by TEXT);
CREATE INDEX refresh_sessions_principal ON refresh_sessions(principal_id,expires_at);
CREATE TABLE login_rate_limits (bucket TEXT PRIMARY KEY, window_started INTEGER NOT NULL, attempts INTEGER NOT NULL);
CREATE TABLE security_audit (id TEXT PRIMARY KEY, event TEXT NOT NULL, principal_id TEXT, tenant_id TEXT, ip_hash TEXT, occurred_at INTEGER NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE INDEX security_audit_time ON security_audit(occurred_at);
