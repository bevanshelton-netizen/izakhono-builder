# FORTRESS v2.7 — Control-Plane Persistence & Event Replay

v2.7 adds a persistence contract around the v2.5 tamper-evident control journal.

## Guarantees

- tenant-scoped event storage
- immutable event copies at the store boundary
- sequence and previous-hash conflict detection
- verified journal replay
- tenant-safe journal restoration
- fail-closed rejection of tampered or cross-tenant restore input

## Replay

`replayControlJournal()` reads a tenant's stored events, verifies the complete integrity chain, and returns the verified event sequence and last sequence number.

## Restore

`restoreControlJournal()` accepts only events belonging to the requested tenant and only after full journal verification. Invalid chains are rejected before persistence.

## Production boundary

The included implementation is an in-memory reference store. It is intentionally replaceable by the IZAKHONO-owned durable persistence layer. Production deployment still requires durable storage, access control, encryption at rest, backup/restore policy, concurrency controls, and operational monitoring.

No network calls, remediation, exploitation, or external security actions are introduced.
