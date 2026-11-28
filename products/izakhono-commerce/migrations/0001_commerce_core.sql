-- IZAKHONO COMMERCE single-seller B2B foundation.
-- Payment, inventory, accounting and fulfilment remain separate authorities.
CREATE TABLE IF NOT EXISTS commerce_sellers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS commerce_buyers (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id),
  organisation_name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS commerce_products (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (seller_id, sku)
);
CREATE INDEX IF NOT EXISTS commerce_products_public_catalogue ON commerce_products(seller_id, status, sku);
CREATE TABLE IF NOT EXISTS commerce_orders (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES commerce_sellers(id),
  buyer_id TEXT NOT NULL REFERENCES commerce_buyers(id),
  buyer_reference TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor > 0),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','accepted','rejected','cancelled','fulfilled','closed')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
  inventory_status TEXT NOT NULL DEFAULT 'awaiting_seller_confirmation' CHECK (inventory_status IN ('awaiting_seller_confirmation','confirmed','unavailable')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (buyer_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS commerce_orders_buyer_recent ON commerce_orders(buyer_id, created_at DESC);
CREATE TABLE IF NOT EXISTS commerce_order_lines (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES commerce_products(id),
  sku_snapshot TEXT NOT NULL,
  name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor > 0),
  line_total_minor INTEGER NOT NULL CHECK (line_total_minor > 0),
  UNIQUE (order_id, sku_snapshot)
);
CREATE TABLE IF NOT EXISTS commerce_order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  source_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (order_id, event_type, source_key)
);
