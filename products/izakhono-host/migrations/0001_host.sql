CREATE TABLE IF NOT EXISTS host_customers (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  trading_name TEXT NOT NULL DEFAULT '',
  registration_number TEXT NOT NULL DEFAULT '',
  primary_contact TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS host_domains (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES host_customers(id),
  domain TEXT NOT NULL UNIQUE,
  registrar TEXT NOT NULL DEFAULT '',
  registrar_status TEXT NOT NULL DEFAULT 'unknown',
  expires_at TEXT,
  auto_renew INTEGER NOT NULL DEFAULT 0,
  dns_provider TEXT NOT NULL DEFAULT '',
  dns_status TEXT NOT NULL DEFAULT 'unknown',
  verification_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS host_sites (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES host_customers(id),
  domain_id TEXT REFERENCES host_domains(id),
  name TEXT NOT NULL,
  deployment_provider TEXT NOT NULL DEFAULT 'izakhono-runtime',
  provider_project_id TEXT NOT NULL DEFAULT '',
  deployment_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned',
  ssl_status TEXT NOT NULL DEFAULT 'pending',
  canonical_host TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS host_dns_records (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL REFERENCES host_domains(id),
  record_type TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  ttl INTEGER NOT NULL DEFAULT 1,
  proxied INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned',
  provider_record_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS host_mailboxes (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES host_customers(id),
  domain_id TEXT NOT NULL REFERENCES host_domains(id),
  address TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'izakhono-mail',
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS host_plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  monthly_price_cents INTEGER NOT NULL,
  included_mailboxes INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS host_subscriptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES host_customers(id),
  plan_id TEXT NOT NULL REFERENCES host_plans(id),
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT,
  renews_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS host_invoices (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES host_customers(id),
  invoice_number TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL DEFAULT 'unpaid',
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS host_jobs (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES host_customers(id),
  job_type TEXT NOT NULL,
  target_id TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  input_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS host_audit_events (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO host_plans(id,code,name,monthly_price_cents,included_mailboxes)
VALUES
 ('plan_business','business','IZAKHONO HOST Business',24900,5);
