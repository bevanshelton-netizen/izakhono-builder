# IZAKHONO AI GATEWAY

Shared AI routing layer for IZAKHONO products.

A product sends a trusted subscriber identity, product slug and conversation to IZAKHONO AI GATEWAY. The gateway first asks IZAKHONO ACCESS whether the subscription is active. If active, it sends the request to an owner-controlled model runtime.

## Subscriber rule

An active paid subscription is not converted into a second hidden message-credit system.

The gateway response explicitly reports:

- `usage_credit_gate: false`
- `message_quota: null`
- `session_quota: null`
- `fair_use: true`

That means "unlimited" means no artificial usage-credit counter while the subscription remains active. It does not mean infinite compute, bandwidth, storage, or permission to abuse the service.

## API

`POST /api/v1/chat`

Headers:

- `x-izakhono-ai-key` — internal product credential

Body:

```json
{
  "entity_id": "faisready-entity",
  "subject": "customer@example.com",
  "product": "faisready",
  "model": "qwen3:4b",
  "messages": [
    {"role":"user","content":"Explain the FAIS fit-and-proper requirements."}
  ]
}
```

The gateway is an internal service. Public products should authenticate their own users and pass only trusted subject identities to this layer.

## Next routing phase

Add owner model pools, GPU nodes, health-aware routing, queueing, and optional external-provider fallback behind the same contract. Products should never hard-code a model vendor directly.


## Entity boundary

The gateway requires an `entity_id` and passes it to IZAKHONO ACCESS. A subscription in one operating entity cannot unlock AI capacity in another entity.
