# FORTRESS v3.5 — Lease Fencing & Retry Recovery

Defensive reference controls for safe delivery-worker coordination.

## Lifecycle

`READY → LEASED → FENCED → DISPATCH → RETRY_SCHEDULED → DELIVERED | DEAD_LETTER`

## Controls

- Tenant-scoped worker lease tokens
- Lease expiry validation
- Worker ownership validation
- Monotonic generation fencing to reject stale workers
- Deterministic SHA-256 token integrity
- Bounded exponential retry scheduling
- Integrity-protected retry records
- Explicit dead-letter transition after the configured retry ceiling

## Production boundary

This is a reference control layer. Production deployment still requires durable transactional lease storage, atomic compare-and-swap or equivalent fencing, authenticated workers, clock-skew handling, durable retry queues, encrypted storage, monitoring, and operational recovery procedures.

No network delivery, credential handling, exploit execution, or external side effects are implemented.
