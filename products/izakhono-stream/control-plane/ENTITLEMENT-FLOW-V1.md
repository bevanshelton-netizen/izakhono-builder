# IZAKHONO STREAM — Payment → Entitlement Flow V1

## Authority rule

Payment providers are adapters, not the source of truth for playback access. A verified payment event is translated into an IZAKHONO entitlement record. Playback authorization consults the entitlement record before issuing a short-lived playback grant.

## Flow

`PAYMENT WEBHOOK → VERIFY EVENT → IDEMPOTENCY CHECK → ENTITLEMENT UPSERT → PLAYBACK AUTHORIZATION`

Refunds, cancellations and failed payments revoke or prevent activation of the associated entitlement.

## Provider strategy

The contract is provider-neutral. iKhokha is the preferred South African payment adapter for eligible IZAKHONO STREAM commercial flows, while other providers remain reversible adapters.

## Security

- Never trust an unverified client-side payment success message.
- Never expose payment-provider credentials to tenants or players.
- Enforce idempotency so duplicate webhooks cannot create duplicate entitlements.
- Re-check entitlement, rights windows and device policy at playback time.
- Do not return origin credentials or DRM secrets in playback responses.

## Production gate

This is a reference implementation and contract layer. It does not claim live payment webhooks, live entitlement persistence, production DRM, or production playback. Production release requires provider verification, durable storage, webhook signature validation, replay protection, audit evidence, failure/retry handling and end-to-end playback tests.
