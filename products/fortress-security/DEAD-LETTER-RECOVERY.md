# FORTRESS v3.6 — Dead-Letter Recovery

Defensive reference layer for controlled recovery of failed deliveries.

## Lifecycle

`DEAD_LETTER → STORE → AUTHORIZE → REPLAY → ATTEST → CLOSED/QUARANTINED`

## Controls

- Tenant-scoped durable-store contract and retrieval.
- Deterministic dead-letter identities and SHA-256 integrity.
- Duplicate-conflict rejection and cross-tenant isolation.
- Explicit replay authorization with approval binding.
- Replay blocked for already replayed or quarantined records.
- Deterministic replay idempotency keys.
- Recovery attestations bind the dead-letter record, authorization, result, tenant and delivery.
- Attestation integrity is independently verifiable.

## Production boundary

The included store is a reference in-memory implementation. Production deployment requires durable transactional storage, authenticated RBAC/approval infrastructure, encryption at rest, backup/restore, concurrency controls, immutable audit retention, monitoring, and an authenticated delivery/replay worker. This layer performs no network delivery, credential handling, exploit execution, or external side effects.
