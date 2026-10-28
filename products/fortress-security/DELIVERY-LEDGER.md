# FORTRESS v3.4 — Durable Delivery Ledger

The delivery ledger is a defensive reference layer for maintaining delivery state across worker attempts.

## Lifecycle

`READY → LEASED → DELIVERED | RETRYABLE | QUARANTINED`

Expired leases return to `READY` so a different worker can safely resume processing. Lease ownership is explicit and completion requires the owning worker.

## Controls

- Tenant-scoped delivery records
- SHA-256 record integrity
- Worker lease ownership and expiry
- Crash recovery through expired-lease reclamation
- Attempt counters
- Fail-closed integrity and ownership checks

## Production boundary

This reference implementation does not claim durable production storage, distributed locking, clock coordination, encryption at rest, authenticated workers, or network delivery. Production deployment requires a transactional durable ledger, atomic lease acquisition, fencing/lease semantics, authenticated worker identity, durable retry state, monitoring, backup/recovery, and verified delivery adapters.

No credentials, exploit execution, network delivery, or external side effects are implemented here.
