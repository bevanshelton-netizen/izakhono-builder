# IZAKHONO VOICE™ — Carrier Architecture

## Purpose

Keep the IZAKHONO VOICE™ product independent from any single telecommunications provider. The application owns the customer, tenant, billing, Caller ID presentation rules, routing policy, analytics, security and user experience. A carrier adapter handles PSTN/telephony operations.

## Boundary

`IZAKHONO VOICE™ → Voice API → Carrier Adapter → Carrier/PSTN`

The first adapter is intended for TKOS, subject to an approved partner/reseller account, credentials and test number. The adapter must remain replaceable.

## Required carrier capabilities

- Number provisioning and release
- Inbound call delivery
- Outbound call origination
- Verified Caller ID / business number presentation
- Call routing and forwarding
- IVR/media integration
- Signed webhooks
- Call detail records (CDRs)
- Usage/minute reconciliation
- Idempotent write operations

## Security rules

1. Carrier credentials are server-side only.
2. Never use `NEXT_PUBLIC_` or equivalent browser-exposed configuration for carrier secrets.
3. Webhook signatures must be validated before processing events.
4. Webhook processing must be idempotent.
5. Every call and webhook is associated with a tenant/customer ID.
6. Rate limits and fraud controls must be enforced before production calling.
7. Recordings and caller data must be handled according to applicable privacy and communications requirements.
8. Provider-specific code must not leak into the customer-facing UI.

## Production configuration

Recommended server configuration names:

- `VOICE_PROVIDER`
- `TKOS_API_BASE_URL`
- `TKOS_API_KEY`
- `VOICE_WEBHOOK_SECRET`
- `VOICE_DEFAULT_REGION`

Only the base URL/provider setting is configuration. API keys and webhook secrets are secrets and must be stored in Vercel as Secret environment variables, not committed to Git.

## Go-live gate

IZAKHONO VOICE™ is not considered PSTN-live until all of the following are verified:

- carrier partner/reseller authorization
- real carrier API credentials
- test DID/number
- outbound test call succeeds
- inbound test call succeeds
- Caller ID verified
- webhook signature verified
- CDR reconciles with the call
- tenant isolation tested
- billing/usage reconciliation tested

Until then, the application may be production-deployed as a product shell, but it must not claim that live carrier calling is enabled.
