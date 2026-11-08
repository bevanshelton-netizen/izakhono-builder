-- IZAKHONO VOICE BYOP customer endpoint metadata.
-- Customer mobile numbers are identity/routing metadata, not proof of carrier forwarding.
-- Apply through the approved IZAKHONO DATA migration process; never run at app startup.

CREATE TABLE IF NOT EXISTS voice_customer_endpoints (
  endpoint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  customer_mobile_e164 TEXT NOT NULL,
  voice_destination_e164 TEXT NOT NULL,
  forwarding_mode TEXT NOT NULL DEFAULT 'no_answer'
    CHECK (forwarding_mode IN ('unconditional', 'busy', 'no_answer', 'unreachable', 'busy_no_answer_unreachable')),
  forwarding_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (forwarding_status IN ('pending', 'verified', 'paused', 'failed')),
  carrier_name TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, customer_mobile_e164),
  CHECK (customer_mobile_e164 ~ '^[+][1-9][0-9]{7,14}$'),
  CHECK (voice_destination_e164 ~ '^[+][1-9][0-9]{7,14}$')
);

CREATE INDEX IF NOT EXISTS voice_customer_endpoints_tenant_idx
  ON voice_customer_endpoints (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS voice_customer_endpoints_destination_idx
  ON voice_customer_endpoints (voice_destination_e164)
  WHERE forwarding_status = 'verified';

COMMENT ON TABLE voice_customer_endpoints IS
  'BYOP metadata only: customer-owned mobile number forwards to an IZAKHONO-assigned AI destination number. Never store SIM PIN, PUK, ICCID or carrier account credentials.';
