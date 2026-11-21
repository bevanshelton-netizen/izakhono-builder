# FORTRESS v2.8 — Durable Storage Contract

FORTRESS v2.8 defines the boundary for an IZAKHONO-owned durable control-journal adapter.

## Guarantees

- Tenant-scoped atomic append decisions.
- Explicit optimistic-concurrency expectations (`expectedLastSequence`, `expectedLastHash`).
- Idempotency keys prevent duplicate control-event commits.
- Cross-tenant writes fail closed.
- Sequence and chain continuity are verified before commit.
- No partial append is performed after validation failure.
- Read/list operations return copies rather than mutable store state.

## Production boundary

`InMemoryDurableControlJournalStore` is a deterministic reference implementation and is **not** production durable storage. A production adapter must provide durable persistence, transactional/atomic semantics, encryption at rest, access control, backup/restore, crash recovery, observability, and a concurrency model appropriate to the backing datastore.

The adapter contract is intentionally independent of a specific database so FORTRESS can migrate to IZAKHONO-owned infrastructure without changing control-plane semantics.
