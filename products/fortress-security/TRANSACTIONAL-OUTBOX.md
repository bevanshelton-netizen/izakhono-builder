# FORTRESS Transactional Outbox

The v3.2 reference layer separates durable control-state commits from downstream delivery.

## Guarantees

- Tenant-scoped entries
- Optimistic sequence checks
- Deterministic entry identities
- SHA-256 integrity verification
- Duplicate-entry rejection
- Atomic commit preparation: the entire batch is validated before an adapter is permitted to commit it
- Explicit `PENDING → DISPATCHED` / `FAILED` state transitions
- No network or external delivery from this reference implementation

## Production boundary

A production adapter must provide a real transaction around durable state and outbox insertion, durable write-ahead logging or equivalent recovery semantics, concurrency control, retry/idempotency policy, encrypted storage, backup/restore, monitoring, and authenticated delivery workers. External delivery must consume only committed outbox records.

Lifecycle:

`VALIDATE → PREPARE → ATOMIC COMMIT → OUTBOX PENDING → DISPATCH → ATTEST`
