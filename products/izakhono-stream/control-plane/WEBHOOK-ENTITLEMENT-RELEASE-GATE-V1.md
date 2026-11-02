# Webhook Entitlement Release Gate V1

Release is blocked until all of the following are evidenced:

- real provider signature verification over the raw request
- durable tenant-scoped replay protection
- atomic entitlement upsert and revocation
- retry/dead-letter handling
- payment reconciliation
- audit logging
- KORA NETWORK sandbox tests for paid, replay, invalid signature, refund, cancellation, failure and cross-tenant isolation
- playback-time entitlement and rights revalidation

Reference adapters and synthetic signatures are not production payment evidence.
