CREATE TABLE IF NOT EXISTS iz_host_provisioning_records (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  state TEXT NOT NULL,
  public_live BOOLEAN NOT NULL DEFAULT FALSE,
  payment_intent_id TEXT NOT NULL UNIQUE,
  external_transaction_id TEXT NOT NULL UNIQUE,
  payment_provider TEXT NOT NULL,
  provider_payment_id TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL,
  order_amount_minor BIGINT NOT NULL CHECK (order_amount_minor > 0),
  order_currency CHAR(3) NOT NULL,
  record JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT iz_host_provisioning_state_valid CHECK (
    state IN ('PLANNED','PAYMENT_VERIFIED','DOMAIN_READY','DNS_READY','SITE_READY','TLS_READY','MAIL_READY','INTEGRATIONS_READY','ACCEPTANCE_PENDING','LIVE','FAILED','PAUSED')
  ),
  CONSTRAINT iz_host_payment_order_match CHECK (
    amount_minor = order_amount_minor AND currency = order_currency
  ),
  CONSTRAINT iz_host_not_live_on_payment CHECK (
    state <> 'PAYMENT_VERIFIED' OR public_live = FALSE
  )
);

CREATE INDEX IF NOT EXISTS iz_host_provisioning_customer_idx
  ON iz_host_provisioning_records (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS iz_host_provisioning_state_idx
  ON iz_host_provisioning_records (state, updated_at DESC);
