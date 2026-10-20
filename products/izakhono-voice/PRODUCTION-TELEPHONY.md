# IZAKHONO VOICE™ production telephony boundary

The runtime now exposes a provider-neutral HTTP telephony adapter. A SIP carrier, PBX, hosted telephony service or future IZAKHONO-owned telephony gateway can implement the gateway contract without changing the call-centre orchestration layer.

## Runtime contract

The gateway receives POST commands at:

- `/v1/answer`
- `/v1/dial`
- `/v1/transfer`
- `/v1/sms`
- `/v1/hangup`

Inbound calls are normalized through `normalizeInboundCall()` before entering the domain model.

## Required runtime configuration

- `IZAKHONO_VOICE_TELEPHONY_GATEWAY_URL`
- `IZAKHONO_VOICE_TELEPHONY_GATEWAY_API_KEY` (secret)
- `IZAKHONO_VOICE_TENANT_ID`
- `IZAKHONO_VOICE_INBOUND_WEBHOOK_SECRET` (secret)

No phone numbers, provider credentials or production endpoints belong in source control.

## Deployment gate

This adapter is the production integration boundary, but a live calling service is **not** claimed until a real SIP/telephony gateway is configured, credentials are supplied through the runtime secret store, an inbound number is connected, and an end-to-end test call passes.
