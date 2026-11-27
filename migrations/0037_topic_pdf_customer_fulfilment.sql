-- Customer purchase entitlements and auditable private PDF delivery.
-- Entitlements are created only by a verified payment/refund integration or trusted
-- back-office process. Customer routes cannot create or modify entitlement rows.

CREATE TABLE IF NOT EXISTS topic_pdf_customer_entitlements (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES builder_customers(id) ON DELETE CASCADE,
  publication_id TEXT NOT NULL REFERENCES topic_pdf_publications(id),
  payment_provider TEXT NOT NULL,
  payment_reference TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('active','refunded','revoked')),
  purchased_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, publication_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_pdf_entitlements_customer_status
  ON topic_pdf_customer_entitlements(customer_id, status, purchased_at DESC);

CREATE TABLE IF NOT EXISTS topic_pdf_download_events (
  id TEXT PRIMARY KEY,
  entitlement_id TEXT NOT NULL REFERENCES topic_pdf_customer_entitlements(id),
  customer_id TEXT NOT NULL REFERENCES builder_customers(id),
  publication_id TEXT NOT NULL REFERENCES topic_pdf_publications(id),
  accessed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_topic_pdf_download_events_customer
  ON topic_pdf_download_events(customer_id, accessed_at DESC);
