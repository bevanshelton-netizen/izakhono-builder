# I-CONNECT Voice Core API

Initial control-plane layer for the I-CONNECT corporate voice platform.

## Endpoints
- `GET /api/voice/health` — service readiness and carrier-adapter state.
- `GET /api/voice/agents` — registered agent state for the current process.
- `POST /api/voice/agents` — register an agent identity and mobile endpoint.
- `POST /api/voice/call` — create a queued call request with number masking and corporate CLI requirements.

## Production boundary
These endpoints do **not** place real telephone calls. A regulated/authorised carrier or SIP provider must be connected through a production adapter before real PSTN calling is enabled. The adapter must implement authentication, caller-ID policy, number masking, call status callbacks, CDRs, rate limits, fraud controls, recording/consent controls where applicable, and billing events.

## Next adapter contract
Implement a provider-neutral interface:

```text
createCall({ from, to, callbackUrl })
answer(callId)
bridge(callId, legA, legB)
hangup(callId)
getCall(callId)
```

The application layer should never depend directly on a carrier SDK.
