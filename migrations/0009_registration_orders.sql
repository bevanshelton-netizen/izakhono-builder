CREATE TABLE IF NOT EXISTS registration_orders (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  registrar_id TEXT NOT NULL,
  customer_reference TEXT,
  state TEXT NOT NULL,
  authority_transaction_id TEXT,
  authority_confirmed INTEGER NOT NULL DEFAULT 0,
  dns_published INTEGER NOT NULL DEFAULT 0,
  dns_verified INTEGER NOT NULL DEFAULT 0,
  rdap_verified INTEGER NOT NULL DEFAULT 0,
  handed_over INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_registration_orders_domain ON registration_orders(domain);
CREATE INDEX IF NOT EXISTS idx_registration_orders_registrar ON registration_orders(registrar_id);
