-- IZAKHONO VOICE subscription entitlement ledger.
-- Only the trusted billing adapter may write these rows after verifying provider webhooks.
-- Do not trust browser redirects or client-submitted payment status.

CREATE TABLE IF NOT EXISTS voice_tenant_subscriptions (
  tenant_id TEXT PRIMARY KEY,
  plan_code TEXT NOT NULL,
  billing_provider TEXT NOT NULL,
  provider_subscription_ref TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid', 'paused')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  last_verified_event_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (current_period_end > current_period_start)
);

CREATE INDEX IF NOT EXISTS voice_tenant_subscriptions_entitlement_idx
  ON voice_tenant_subscriptions (tenant_id, status, current_period_end);

CREATE TABLE IF NOT EXISTS voice_billing_events (
  billing_event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  billing_provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  provider_event_created_at TIMESTAMPTZ NOT NULL,
  payload_sha256 CHAR(64) NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (billing_provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS voice_billing_events_tenant_idx
  ON voice_billing_events (tenant_id, received_at DESC);

COMMENT ON TABLE voice_tenant_subscriptions IS
  'Source of truth for VOICE subscription entitlement. Writes are restricted to the trusted verified billing-event adapter.';
COMMENT ON TABLE voice_billing_events IS
  'Idempotency/audit ledger for verified provider webhook events. Store payload hashes, not raw payment payloads.';
