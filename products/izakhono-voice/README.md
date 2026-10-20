# IZAKHONO VOICE™ — Call-Centre Engine

Provider-neutral call-centre foundation for IZAKHONO VOICE™.

This product uses the public Microsoft `call-center-ai` project as an architectural reference for real-time voice conversations, structured case data, RAG, reminders, post-call synthesis and human handoff. It does **not** make Microsoft/Azure the IZAKHONO system of record or permanent infrastructure dependency.

## Design rule

**IZAKHONO owns the orchestration, customer/case state, Caller ID policy, business rules, security, APIs and audit trail. Telephony, speech and LLM providers are replaceable adapters.**

## First implementation surface

- Inbound and outbound call orchestration
- Built-in Caller ID context
- Customer/case schema
- Real-time conversation events
- RAG/knowledge lookup boundary
- Human-agent transfer boundary
- SMS follow-up boundary
- Reminder/callback boundary
- Post-call synthesis and action extraction
- Provider-neutral LLM and telephony interfaces
- FORTRESS audit/security hooks

## Provider adapter model

```text
PHONE/SIP PROVIDER
       ↓
IZAKHONO VOICE GATEWAY
       ↓
CALL SESSION + CALLER ID
       ↓
VOICE ORCHESTRATOR
  ↙       ↓        ↘
RAG     LLM       BUSINESS TOOLS
  ↓       ↓        ↓
CASE STORE / CRM / SMS / CALLBACKS
       ↓
FORTRESS AUDIT
```

The initial adapter can target Azure Communication Services/OpenAI where useful, while keeping the interfaces provider-neutral so IZAKHONO can later switch telephony, speech, model or hosting providers without redesigning the product.

## Secure telephony ingress

Before a provider event reaches the voice runtime, the gateway must verify `X-IZAKHONO-Timestamp` and `X-IZAKHONO-Signature`. The signature is HMAC-SHA256 over `${timestamp}.${rawBody}`; a `sha256=` prefix is accepted. Requests older than five minutes are rejected by default.

Verification must happen against the **raw request body before JSON parsing**. Secrets are runtime-only configuration and must never be committed, embedded in client applications, or logged.

Production ingress also requires replay/idempotency protection, rate limiting, request-size/time limits, HTTPS/TLS, provider allow-listing, security/audit events, transfer authorization, and appropriate call-recording/retention controls.

## Status

**Engineering foundation + secure ingress boundary created — not production deployed.** Production activation still requires telephony credentials/numbers, a reachable IZAKHONO runtime, provider-specific webhook configuration, security review, data-protection controls, end-to-end call testing and acceptance evidence.
