CREATE TABLE IF NOT EXISTS commander_devices (id TEXT PRIMARY KEY,name TEXT NOT NULL,platform TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',agent_token_hash TEXT,enrolled_at TEXT,last_seen_at TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS commander_pairings (code_hash TEXT PRIMARY KEY,device_id TEXT NOT NULL,expires_at TEXT NOT NULL,used_at TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS commander_audit (id INTEGER PRIMARY KEY AUTOINCREMENT,device_id TEXT,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT,outcome TEXT NOT NULL,detail TEXT,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_commander_audit_created ON commander_audit(created_at);
