PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS pa_tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  timezone TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
  owner_whatsapp TEXT,
  brief_enabled INTEGER NOT NULL DEFAULT 1,
  brief_hour_utc INTEGER NOT NULL DEFAULT 6,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO pa_tenants(id,name,timezone) VALUES('izakhono','IZAKHONO AFRICA','Africa/Johannesburg');

CREATE TABLE IF NOT EXISTS pa_contacts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  organization TEXT,
  email TEXT,
  phone TEXT,
  whatsapp_wa_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  next_action_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tenant_id) REFERENCES pa_tenants(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pa_contact_wa ON pa_contacts(tenant_id, whatsapp_wa_id) WHERE whatsapp_wa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pa_contacts_tenant_next ON pa_contacts(tenant_id, next_action_at);

CREATE TABLE IF NOT EXISTS pa_tasks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  due_at TEXT,
  owner TEXT,
  value_amount REAL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  contact_id TEXT,
  source TEXT NOT NULL DEFAULT 'dashboard',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tenant_id) REFERENCES pa_tenants(id) ON DELETE CASCADE,
  FOREIGN KEY(contact_id) REFERENCES pa_contacts(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_pa_tasks_queue ON pa_tasks(tenant_id,status,priority,due_at);
CREATE INDEX IF NOT EXISTS idx_pa_tasks_category ON pa_tasks(tenant_id,category,status);

CREATE TABLE IF NOT EXISTS pa_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  contact_id TEXT,
  direction TEXT NOT NULL,
  channel TEXT NOT NULL,
  provider_message_id TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  raw_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tenant_id) REFERENCES pa_tenants(id) ON DELETE CASCADE,
  FOREIGN KEY(contact_id) REFERENCES pa_contacts(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pa_provider_message ON pa_messages(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pa_messages_tenant_time ON pa_messages(tenant_id,created_at DESC);

CREATE TABLE IF NOT EXISTS pa_briefs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  brief_date TEXT NOT NULL,
  body TEXT NOT NULL,
  open_tasks INTEGER NOT NULL DEFAULT 0,
  money_value REAL NOT NULL DEFAULT 0,
  decision_count INTEGER NOT NULL DEFAULT 0,
  risk_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tenant_id) REFERENCES pa_tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pa_briefs_tenant_date ON pa_briefs(tenant_id,brief_date DESC);

CREATE TABLE IF NOT EXISTS pa_integrations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  config_json TEXT,
  last_sync_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tenant_id) REFERENCES pa_tenants(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pa_integration_provider ON pa_integrations(tenant_id,provider);

CREATE TABLE IF NOT EXISTS pa_audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tenant_id) REFERENCES pa_tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pa_audit_tenant_time ON pa_audit_events(tenant_id,created_at DESC);
