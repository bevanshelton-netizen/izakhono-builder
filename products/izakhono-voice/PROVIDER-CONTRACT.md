# IZAKHONO VOICE™ — Live Provider Integration Contract

## Purpose
Define the boundary required to connect a real telephony provider without making IZAKHONO VOICE dependent on a specific vendor.

## Required inbound events

`call.started`
- providerCallId
- callerNumber
- calledNumber
- receivedAt
- provider

`call.media.ready`
- providerCallId
- mediaSessionId
- direction
- codec

`call.ended`
- providerCallId
- endedAt
- reason

## Required outbound commands

- answer
- hangup
- transfer
- sendSms
- startMedia
- stopMedia

## Security requirements

1. Provider webhooks must use the signed ingress boundary already implemented by IZAKHONO VOICE.
2. Provider credentials are runtime secrets only.
3. Caller ID must be normalized before entering the business layer.
4. Replay protection must remain enabled.
5. Provider-specific payloads must never become the system-of-record schema.

## Live activation gate

A provider may be marked `production-ready` only after:

- real inbound number is configured;
- signed webhook reaches the deployed IZAKHONO endpoint;
- Caller ID is captured correctly;
- call session is created;
- media is established;
- speech/AI response is returned;
- hangup and transfer are verified;
- audit event is recorded;
- failure path is tested.

Until every gate passes, the system status remains **NOT LIVE**.

## Provider neutrality

The first production adapter may use an external carrier or communications platform, but the adapter must implement the IZAKHONO contract. Replacing the carrier must not require rewriting the call-session, CRM, RAG, security, or business-rule layers.
