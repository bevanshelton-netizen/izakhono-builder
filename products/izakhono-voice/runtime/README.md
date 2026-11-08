# IZAKHONO VOICE — owned WebSocket runtime

This package is the Node.js runtime host for the existing provider-neutral Twilio media bridge and GPT-Live session adapter. It is portable: run the same package on an approved IZAKHONO-owned runtime or an approved external resilience runtime. It does not make NODE01 the sole serving target.

## What is implemented

- Node HTTP health endpoint at `/health`.
- Twilio Media Streams WebSocket upgrade at the exact path configured by `IZAKHONO_TWILIO_MEDIA_PUBLIC_URL`.
- Handshake validation against the configured canonical public WSS URL and runtime-only Twilio Auth Token, including Twilio's documented trailing-slash WSS validation variant. The implementation never builds the signature URL from Host or forwarded headers and rejects query strings.
- Node `ws` connector for the GPT-Live server-side WebSocket API.
- Existing per-connection media bridge, G.711 μ-law 8 kHz audio path, and session adapter.
- A required runtime adapter contract for the durable call registry, tenant policy, audit and usage persistence.

## Mandatory runtime adapter

Set `IZAKHONO_VOICE_RUNTIME_ADAPTER` to an absolute path to a trusted JavaScript/TypeScript module exporting `createVoiceRuntimeDependencies(env)`. It must return:

- `callRegistry.authorizeStart({ callSid, streamSid, customParameters })`
- `instructionsForCall({ tenantId, callId })`
- optional durable audit/usage methods.

The registry implementation is a production security boundary, not a convenience map. It MUST atomically resolve the provider CallSid against a persisted IZAKHONO call, verify expected call state and a short-lived one-time stream association, enforce tenant ownership and one-active-stream policy, reject replay, and return the canonical tenant/call IDs. It must not derive tenant identity from Twilio custom parameters. Use shared durable storage so multiple runtime replicas enforce the same policy. This repository intentionally does not ship an in-memory fallback.

The adapter must implement durable usage attribution and audit. Before production, bind GPT-Live usage to the actual authorized call record; do not use a placeholder call identifier.

## Runtime environment

Required:
- `IZAKHONO_VOICE_RUNTIME_ADAPTER` — absolute path to the trusted adapter module.
- `IZAKHONO_TWILIO_MEDIA_PUBLIC_URL` — exact public `wss://` URL, with no query or fragment.
- `IZAKHONO_TWILIO_AUTH_TOKEN` — Twilio runtime secret.
- `OPENAI_API_KEY` — server-only GPT-Live API key.

Optional:
- `IZAKHONO_VOICE_HOST` — bind address; default `127.0.0.1`.
- `IZAKHONO_VOICE_PORT` — bind port; default `8962`.
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

Place the service behind the approved TLS edge/reverse proxy. The edge must preserve the exact configured public path and use WSS/TLS. Do not expose the runtime's private bind port directly to the public internet.

## Important production gates

This package is an executable runtime host, not proof of a live telephone service. Before activation:

1. Implement and independently review the durable call-registry adapter.
2. Verify Twilio's WebSocket handshake signature behaviour against a real Twilio Media Streams request and current Twilio SDK/reference vectors, including the documented trailing-slash case.
3. Confirm the exact public URL, TLS certificate, edge routing, upgrade forwarding and health checks on an approved runtime.
4. Add concurrency, call-duration, tenant rate and resource limits at the edge and registry.
5. Complete tenant consent, privacy, retention, access-control, incident-response and South African regulatory reviews.
6. Run real inbound/outbound calls, caller audio, assistant audio, barge-in, DTMF, transfer, SMS and hangup acceptance tests.
7. Verify durable per-call usage attribution and audit records.

Do not mark IZAKHONO VOICE live until all gates have evidence. Never commit provider credentials or customer call data.
