CREATE TABLE IF NOT EXISTS registrars (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, organization TEXT, country TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hosts (name TEXT PRIMARY KEY, addresses_json TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS domains (name TEXT PRIMARY KEY, registrar_id TEXT NOT NULL, registrant_id TEXT NOT NULL, nameservers_json TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, object_type TEXT NOT NULL, object_id TEXT NOT NULL, before_json TEXT, after_json TEXT);
CREATE TABLE IF NOT EXISTS idempotency_keys (key TEXT PRIMARY KEY, actor TEXT NOT NULL, request_hash TEXT NOT NULL, response_json TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS billing_ledger (id TEXT PRIMARY KEY, registrar_id TEXT NOT NULL, domain TEXT, kind TEXT NOT NULL, amount_minor INTEGER NOT NULL, currency TEXT NOT NULL, reference TEXT, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_domains_registrar ON domains(registrar_id);
CREATE INDEX IF NOT EXISTS idx_audit_object ON audit_events(object_type, object_id);
