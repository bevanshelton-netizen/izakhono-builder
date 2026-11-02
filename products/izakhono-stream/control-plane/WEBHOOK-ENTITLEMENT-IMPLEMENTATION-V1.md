# Webhook → Entitlement Implementation V1

Reference implementation boundary:

`SIGNED PAYMENT WEBHOOK → VERIFY → DEDUPE → TRANSLATE → UPSERT ENTITLEMENT → PLAYBACK RECHECK`

## Rules

1. Tenant and event identifiers are mandatory.
2. Provider signatures are verified before event processing.
3. Replay keys are tenant + provider + provider event ID.
4. Entitlements are keyed by tenant + provider + transaction ID.
5. `PAID` produces `ACTIVE`; `REFUNDED`, `CANCELLED`, and `FAILED` produce `REVOKED`.
6. Missing user/product/transaction identifiers block entitlement creation.
7. The playback layer remains authoritative at request time; a stored entitlement is not by itself proof that playback is currently allowed.

## Production gates

- provider-specific cryptographic verification over the raw request body
- atomic unique replay insert and entitlement upsert
- durable database constraints and transaction handling
- retry/dead-letter processing
- payment-provider reconciliation
- audit retention and tenant isolation
- sandbox end-to-end tests for paid, refunded, cancelled, failed, replayed, and cross-tenant events

This implementation is reference architecture only. It does not claim live payment processing or production entitlement persistence.
