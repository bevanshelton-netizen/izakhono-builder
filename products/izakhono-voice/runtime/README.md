# IZAKHONO VOICE — owned WebSocket runtime

This package hosts the provider-neutral Twilio media bridge and GPT-Live session adapter on Node.js. It is portable across approved IZAKHONO-owned runtime targets and approved external resilience hosts. NODE01 is not a single point of failure.

## Implemented

- Node HTTP health endpoint and Twilio Media Streams WebSocket upgrade host.
- Canonical public WSS handshake validation against runtime-only Twilio credentials; never trusts Host or forwarded headers.
- Node WebSocket connector for GPT-Live.
- PostgreSQL-backed call registry with tenant isolation, short-lived one-time stream credentials, atomic token consumption, replay prevention and one-active-stream enforcement across replicas.
- Expiring 90-second stream leases refreshed every 30 seconds during media traffic, allowing stale leases to be reclaimed after a runtime crash.
- Stream lease release on Twilio stop, disconnect or bridge failure.
- Tenant-scoped GPT-Live instructions, durable usage attribution and audit events.
- Runtime and registry unit tests.

## Data schema

Apply `migrations/001_voice_registry.sql` through the approved IZAKHONO DATA migration process before starting the service. The runtime does not silently mutate production schemas.

The migration creates:
- `voice_calls` — canonical tenant/call association, provider CallSid, state and one-time stream credential hash.
- `voice_tenant_policies` — tenant-scoped system instructions.
- `voice_tenant_numbers` — inbound E.164 telephone number to tenant mapping.
- `voice_call_usage` — per-call model usage.
- `voice_audit_events` — tenant-scoped audit events.

Use opaque internal tenant and call IDs. The database account should have only the privileges needed by the runtime and provisioning service; do not expose database credentials to browsers or customer clients.

## Stream authorisation lifecycle

1. For inbound calls, the signed `/twilio/voice` webhook verifies Twilio's signature and account SID, resolves the called E.164 number through `voice_tenant_numbers` (only where the tenant has an enabled policy), and idempotently registers the provider CallSid. For outbound calls, the trusted application first calls `createOutboundCall({ callId, tenantId })`; the Twilio REST adapter adds that opaque internal call reference to the signed voice webhook URL, and the webhook binds the resulting provider CallSid with `bindProviderCall`.
2. Immediately before Twilio is instructed to connect its media stream, the trusted server issues a 90-second, one-time token using `issueStreamCredential(providerCallSid)`.
3. Twilio receives that opaque token as a supported Stream custom parameter named `streamToken`. It is a bearer credential; do not log it or put it in a URL.
4. On the WebSocket `start` event, the registry hashes the supplied token and performs one conditional SQL UPDATE. The operation succeeds only if CallSid, token hash, expiry, unused state, eligible call state and no-active-stream condition all match.
5. The database returns canonical tenant/call IDs. Other custom parameters are not authority.
6. On stop/disconnect/failure, the bridge releases the matching stream lease. A consumed token is cleared and cannot be replayed.

The SQL conditional update is the concurrency control; it works across multiple runtime replicas. A 90-second stream lease is refreshed every 30 seconds while media is flowing; a crashed runtime stops refreshing and its stale lease can be reclaimed. Lease heartbeats are fenced by tenant, internal call ID and exact StreamSid. There is no process-local registry fallback.

## Runtime environment

Required:
- `DATABASE_URL` — private PostgreSQL connection string.
- `IZAKHONO_TWILIO_MEDIA_PUBLIC_URL` — exact public `wss://` URL, without query or fragment.
- `IZAKHONO_TWILIO_VOICE_WEBHOOK_PUBLIC_URL` — exact public HTTPS URL for `/twilio/voice`.
- `IZAKHONO_TWILIO_STATUS_CALLBACK_PUBLIC_URL` — exact public HTTPS URL for `/twilio/status`.
- `IZAKHONO_TWILIO_ACCOUNT_SID` — expected Twilio account SID.
- `IZAKHONO_TWILIO_AUTH_TOKEN` — Twilio runtime secret.
- `OPENAI_API_KEY` — server-only GPT-Live API key.

Optional:
- `DATABASE_SSL=require` — enable TLS to PostgreSQL.
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

Place the service behind the approved IZAKHONO EDGE/TLS path. Preserve the configured public WSS path and upgrade headers. The `/health` endpoint checks PostgreSQL availability and returns 503 when the database is unavailable. PostgreSQL TLS certificate verification remains enabled when `DATABASE_SSL=require`. Do not expose the private runtime port or PostgreSQL port publicly.

## Inbound and outbound provisioning now implemented

The runtime exposes signed Twilio form endpoints:
- `POST /twilio/voice` — verifies the exact configured HTTPS URL, signature and Twilio AccountSid. Inbound calls resolve the called number to an enabled tenant policy and create an idempotent call record. Outbound calls resolve a signed internal call reference and bind the returned provider CallSid. Both paths issue a one-time token and return TwiML that connects the media stream.
- `POST /twilio/status` — verifies the exact configured HTTPS URL, signature and AccountSid, then persists call status by provider CallSid.

Configure each Twilio number's incoming voice webhook to the public `/twilio/voice` URL and its call status callback to `/twilio/status`. Seed `voice_tenant_numbers` and `voice_tenant_policies` through the approved tenant onboarding process. Do not accept tenant IDs from the webhook body as authority.

## Owner-node container deployment

The production image is built from the repository root so it includes the runtime and shared provider-neutral voice modules. The container runs as the non-root Node user, has a read-only root filesystem, drops Linux capabilities, and publishes port 8962 only on host loopback for the local IZAKHONO EDGE reverse proxy.

On an approved owner node, first create `/etc/izakhono/apps/izakhono-voice.env` with the required runtime variables and securely provision the PostgreSQL, Twilio and OpenAI credentials. Do not place this file in the repository.

After the database migration and tenant setup are complete:

```bash
docker compose -f products/izakhono-voice/runtime/docker-compose.yml up -d --build
docker compose -f products/izakhono-voice/runtime/docker-compose.yml ps
curl --fail http://127.0.0.1:8962/health
```

This local deployment command is a runbook only. No owner-node deployment, public DNS/TLS route or real call has been executed by this code change. The external EDGE route must be configured separately through the approved Runtime Fabric process.


## Trusted outbound application boundary

Use `OutboundCallService` from `src/outbound-call-service.ts` in the trusted server-side application layer rather than calling the Twilio adapter directly. Its `placeCall({ tenantId, destination })` method validates the E.164 destination, generates an internal UUID, persists the tenant-bound outbound call first, and only then invokes the carrier adapter. If carrier submission throws, it marks the still-unbound call failed. The provider webhook later binds the actual Twilio CallSid to that same internal call. Do not expose this service or its registry to an untrusted browser client.

Example:

```ts
const outboundCalls = new OutboundCallService(callRegistry, twilioAdapter);
const submitted = await outboundCalls.placeCall({
  tenantId: authenticatedTenantId,
  destination: "+27821234567",
});
// Persist/display submitted.callId; the call is submitted, not yet answered.
```

The service returns `status: "submitted"`, not "connected": carrier acceptance and the later call-status webhook are separate lifecycle events.

## Production gates still open

1. Apply the migration to the approved IZAKHONO DATA PostgreSQL service and create least-privilege database credentials.
2. Configure inbound telephone numbers and tenant policies; verify inbound and outbound webhook signatures using real Twilio-signed requests.
3. Ensure the trusted outbound application creates each call with `createOutboundCall({ callId, tenantId })` before invoking the Twilio REST adapter's `dial(phone, callId)` method. The signed Twilio webhook binds the returned CallSid idempotently; webhook retries for the same provider CallSid are safe.
4. Configure Twilio REST adapter's `streamCredentialForCall` callback to call `issueStreamCredential`; the adapter intentionally refuses to connect media without it.
5. Verify Twilio handshake signature behaviour against real provider requests and current SDK/reference vectors.
6. Confirm public WSS, TLS, edge upgrade forwarding, health checks, limits and failover on an approved runtime.
7. Verify consent, retention, access control, privacy, incident response and South African regulatory requirements.
8. Test real inbound/outbound calls, audio, barge-in, DTMF, transfer, SMS, hangup and failover.
9. Verify durable per-call usage and audit records.

This is executable runtime and registry code, not evidence of a live telephone service. Do not mark IZAKHONO VOICE live until every gate has evidence. Never commit credentials or customer call data.


## Customer delivery model — BYOP

IZAKHONO supplies the VOICE software platform. Customers bring their existing cellphone, SIM and mobile number; no compulsory handset, SIM or PBX purchase is part of the product. The MVP connects the customer's existing number to the software through carrier-supported call forwarding to an IZAKHONO-assigned AI answering number. The customer's mobile number is endpoint metadata, while the called IZAKHONO destination number in `voice_tenant_numbers` remains the authoritative tenant-routing key.

See [BYOP customer onboarding](../../BYOP-CUSTOMER-ONBOARDING.md) for the customer journey, forwarding choices, activation checklist, privacy boundaries and release scope.

Apply `migrations/002_voice_byop_endpoints.sql` through the approved IZAKHONO DATA migration process after reviewing it alongside migration 001. It records the customer's E.164 mobile number, assigned AI destination, forwarding condition and verification state. It deliberately does not store SIM PIN/PUK, ICCID or carrier credentials. A number is not marked verified until a controlled test call reaches the correct tenant's AI answering flow.

Carrier forwarding support, codes, tariffs and South African number availability must be confirmed with the selected carrier. Do not promise a specific number or universal activation code before that verification.

## Subscription-gated customer onboarding

The trusted onboarding domain service is implemented in `src/tenant-onboarding-service.ts`. It accepts tenant identity only from the authenticated application server, checks an injected active-subscription gate before number allocation, requests an AI destination number from a replaceable idempotent number-provider adapter, validates E.164, and atomically persists the tenant policy, assigned inbound number and BYOP endpoint through `PostgresVoiceTenantSetupRepository`. If database setup fails, it attempts to release the allocated number and preserves the original error.

The service deliberately does not implement public authentication, payment processing or a carrier number inventory. Those adapters must be wired by the trusted customer application before public signup is enabled. Payment status must come from verified provider events, not browser redirects. See [customer subscription flow](../../CUSTOMER-SUBSCRIPTION-FLOW.md).

The initial endpoint record remains `pending`; the software must not represent forwarding as active until a controlled test call confirms that the carrier forwards the customer's existing number to the assigned AI destination and that the correct tenant answers.
