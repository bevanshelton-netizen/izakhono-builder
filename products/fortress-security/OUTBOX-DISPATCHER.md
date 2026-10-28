# FORTRESS v3.3 — Durable Outbox Dispatcher

## Purpose

The dispatcher is the reference delivery-control layer after a transactional outbox commit. It prevents duplicate delivery, validates tenant and event integrity, bounds retries, and produces a verifiable delivery receipt.

## Lifecycle

`COMMITTED → READY → DISPATCHING → DELIVERED / RETRYABLE / QUARANTINED → ATTESTED`

## Controls

- Deterministic tenant + outbox-entry + adapter idempotency keys.
- Outbox integrity validation before dispatch.
- Explicit adapter/event compatibility checks.
- Duplicate delivered-event suppression.
- Bounded retry attempts.
- Quarantine after the configured retry ceiling.
- Tenant-scoped receipt validation.
- SHA-256 receipt integrity attestation.
- Reference no-op adapter for safe local verification only.
- No network calls, credentials, exploit execution, or external side effects in this layer.

## Production boundary

A production dispatcher still requires an authenticated delivery worker, durable attempt/receipt state, locking or leases, transactional state transitions, network egress policy, retry backoff, encryption, monitoring, and operational recovery controls. This reference implementation does not claim those production guarantees.
