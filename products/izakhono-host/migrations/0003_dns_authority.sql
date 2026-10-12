-- IZAKHONO HOST DNS Authority v1
-- Owned-first DNS control-plane state. Provider adapters are optional fallbacks.
CREATE TABLE IF NOT EXISTS dns_zones (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  zone_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','paused','failed')),
  serial INTEGER NOT NULL DEFAULT 1,
  primary_nameserver TEXT NOT NULL,
  secondary_nameserver TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dns_records (
  id TEXT PRIMARY KEY,
  zone_id TEXT NOT NULL REFERENCES dns_zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('A','AAAA','CNAME','MX','TXT','NS','SRV','CAA','SOA')),
  ttl INTEGER NOT NULL DEFAULT 300,
  priority INTEGER,
  value TEXT NOT NULL,
  proxied INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(zone_id,name,type,priority,value)
);

CREATE INDEX IF NOT EXISTS idx_dns_records_zone_name ON dns_records(zone_id,name);
CREATE INDEX IF NOT EXISTS idx_dns_zones_customer ON dns_zones(customer_id);

CREATE TABLE IF NOT EXISTS dns_audit_events (
  id TEXT PRIMARY KEY,
  zone_id TEXT,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dns_delegations (
  id TEXT PRIMARY KEY,
  zone_id TEXT NOT NULL REFERENCES dns_zones(id) ON DELETE CASCADE,
  nameserver TEXT NOT NULL,
  address TEXT,
  role TEXT NOT NULL CHECK (role IN ('primary','secondary','tertiary')),
  verified INTEGER NOT NULL DEFAULT 0,
  last_checked_at TEXT
);
