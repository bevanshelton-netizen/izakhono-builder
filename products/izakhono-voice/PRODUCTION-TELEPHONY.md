# IZAKHONO VOICE™ production telephony boundary

The runtime exposes a provider-neutral HTTP telephony adapter. A SIP carrier, PBX, hosted telephony service or future IZAKHONO-owned gateway can implement the gateway contract without changing the call-centre orchestration layer.

## Gateway commands

- `POST /v1/answer`
- `POST /v1/dial`
- `POST /v1/transfer`
- `POST /v1/sms`
- `POST /v1/hangup`

Inbound calls are normalized through `normalizeInboundCall()` before entering the domain model.

## Runtime configuration

- `IZAKHONO_VOICE_TELEPHONY_GATEWAY_URL`
- `IZAKHONO_VOICE_TELEPHONY_GATEWAY_API_KEY` (secret)
- `IZAKHONO_VOICE_TENANT_ID`
- `IZAKHONO_VOICE_INBOUND_WEBHOOK_SECRET` (secret)

No phone numbers, provider credentials or production endpoints belong in source control.

## Production gate

A live calling service is not claimed until a real SIP/telephony gateway is configured, credentials are supplied through the runtime secret store, an inbound number is connected, and an end-to-end test call passes.
