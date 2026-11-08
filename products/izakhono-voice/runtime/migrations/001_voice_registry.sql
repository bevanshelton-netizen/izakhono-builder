-- IZAKHONO VOICE durable registry.
-- Apply through the approved IZAKHONO DATA migration process; never run implicitly at app startup.
CREATE TABLE IF NOT EXISTS voice_tenant_policies (
  tenant_id TEXT PRIMARY KEY,
  system_instructions TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voice_calls (
  call_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  provider_call_sid TEXT UNIQUE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL CHECK (status IN ('ringing', 'active', 'handoff', 'completed', 'failed')),
  stream_token_hash CHAR(64),
  stream_token_expires_at TIMESTAMPTZ,
  stream_token_consumed_at TIMESTAMPTZ,
  active_stream_sid TEXT UNIQUE,
  active_stream_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (active_stream_sid IS NULL AND active_stream_expires_at IS NULL)
    OR (active_stream_sid IS NOT NULL AND active_stream_expires_at IS NOT NULL)
  ),
  CHECK (
    (stream_token_hash IS NULL AND stream_token_expires_at IS NULL)
    OR (stream_token_hash IS NOT NULL AND stream_token_expires_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS voice_calls_tenant_created_idx
  ON voice_calls (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS voice_calls_active_provider_idx
  ON voice_calls (provider_call_sid)
  WHERE status IN ('ringing', 'active', 'handoff');

CREATE TABLE IF NOT EXISTS voice_call_usage (
  usage_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES voice_calls(call_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'openai',
  usage JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS voice_call_usage_tenant_idx
  ON voice_call_usage (tenant_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS voice_audit_events (
  event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES voice_calls(call_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  details JSONB,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS voice_audit_events_tenant_idx
  ON voice_audit_events (tenant_id, recorded_at DESC);

-- Inbound number ownership is resolved server-side; the To field is only a lookup key.
CREATE TABLE IF NOT EXISTS voice_tenant_numbers (
  phone_number TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS voice_tenant_numbers_tenant_idx
  ON voice_tenant_numbers (tenant_id);
