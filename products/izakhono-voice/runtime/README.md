# IZAKHONO VOICE — owned WebSocket runtime

This package hosts the provider-neutral Twilio media bridge and GPT-Live session adapter on Node.js. It is portable across approved IZAKHONO-owned runtime targets and approved external resilience hosts. NODE01 is not a single point of failure.

## Implemented

- Node HTTP health endpoint and Twilio Media Streams WebSocket upgrade host.
- Canonical public WSS handshake validation against runtime-only Twilio credentials; never trusts Host or forwarded headers.
- Node WebSocket connector for GPT-Live.
- PostgreSQL-backed call registry with tenant isolation, short-lived one-time stream credentials, atomic token consumption, replay prevention and one-active-stream enforcement across replicas.
- Stream lease release on Twilio stop, disconnect or bridge failure.
- Tenant-scoped GPT-Live instructions, durable usage attribution and audit events.
- Runtime and registry unit tests.

## Data schema

Apply `migrations/001_voice_registry.sql` through the approved IZAKHONO DATA migration process before starting the service. The runtime does not silently mutate production schemas.

The migration creates:
- `voice_calls` — canonical tenant/call association, provider CallSid, state and one-time stream credential hash.
- `voice_tenant_policies` — tenant-scoped system instructions.
- `voice_call_usage` — per-call model usage.
- `voice_audit_events` — tenant-scoped audit events.

Use opaque internal tenant and call IDs. The database account should have only the privileges needed by the runtime and provisioning service; do not expose database credentials to browsers or customer clients.

## Stream authorisation lifecycle

1. A trusted server-side call provisioning flow inserts the call and binds the provider CallSid to the canonical tenant/call record using `PostgresVoiceCallRegistry.registerCall`.
2. Immediately before Twilio is instructed to connect its media stream, the trusted server issues a 90-second, one-time token using `issueStreamCredential(providerCallSid)`.
3. Twilio receives that opaque token as a supported Stream custom parameter named `streamToken`. It is a bearer credential; do not log it or put it in a URL.
4. On the WebSocket `start` event, the registry hashes the supplied token and performs one conditional SQL UPDATE. The operation succeeds only if CallSid, token hash, expiry, unused state, eligible call state and no-active-stream condition all match.
5. The database returns canonical tenant/call IDs. Other custom parameters are not authority.
6. On stop/disconnect/failure, the bridge releases the matching stream lease. A consumed token is cleared and cannot be replayed.

The SQL conditional update is the concurrency control; it works across multiple runtime replicas. There is no process-local registry fallback.

## Runtime environment

Required:
- `DATABASE_URL` — private PostgreSQL connection string.
- `IZAKHONO_TWILIO_MEDIA_PUBLIC_URL` — exact public `wss://` URL, without query or fragment.
- `IZAKHONO_TWILIO_AUTH_TOKEN` — Twilio runtime secret.
- `OPENAI_API_KEY` — server-only GPT-Live API key.

Optional:
- `DATABASE_SSL=require` — enable TLS to PostgreSQL.
- `DATABASE_SSL_REJECT_UNAUTHORIZED=false` — only for a controlled private CA setup; prefer installing the CA and keeping verification enabled.
- `IZAKHONO_VOICE_DB_POOL_MAX` — pool size, default 10.
- `IZAKHONO_VOICE_HOST` — bind address, default `127.0.0.1`.
- `IZAKHONO_VOICE_PORT` — bind port, default `8962`.
- `IZAKHONO_GPT_LIVE_MODEL` — default `gpt-live-1`.
- `IZAKHONO_GPT_LIVE_VOICE` — default `marin`.

Install and run:

```bash
cd products/izakhono-voice/runtime
npm install
npm run typecheck
npm test
npm start
```

Place the service behind the approved IZAKHONO EDGE/TLS path. Preserve the configured public WSS path and upgrade headers. Do not expose the private runtime port or PostgreSQL port publicly.

## Production gates still open

1. Apply the migration to the approved IZAKHONO DATA PostgreSQL service and create least-privilege database credentials.
2. Implement and verify the trusted inbound/outbound call provisioning flow that creates call records and binds the Twilio CallSid before issuing stream credentials.
3. Configure Twilio REST adapter's `streamCredentialForCall` callback to call `issueStreamCredential`; the adapter intentionally refuses to connect media without it.
4. Verify Twilio handshake signature behaviour against real provider requests and current SDK/reference vectors.
5. Confirm public WSS, TLS, edge upgrade forwarding, health checks, limits and failover on an approved runtime.
6. Configure tenant policies and verify consent, retention, access control, privacy, incident response and South African regulatory requirements.
7. Test real inbound/outbound calls, audio, barge-in, DTMF, transfer, SMS, hangup and failover.
8. Verify durable per-call usage and audit records.

This is executable runtime and registry code, not evidence of a live telephone service. Do not mark IZAKHONO VOICE live until every gate has evidence. Never commit credentials or customer call data.
