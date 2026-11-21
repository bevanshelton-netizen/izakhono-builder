# FORTRESS Recovery Orchestrator

The recovery orchestrator provides a defensive, reference-only reconciliation layer above the durable control journal.

## Controls

- Validates tenant ownership before recovery.
- Re-validates sequence and previous-hash continuity.
- Recomputes event integrity before planning recovery.
- Creates deterministic recovery checkpoints.
- Detects stale or tampered checkpoints.
- Produces a non-mutating replay/skip plan.
- Hashes the recovery plan for integrity verification.
- Fails closed on invalid or cross-tenant state.

## Recovery lifecycle

`CHECKPOINT → VALIDATE → RECONCILE → PLAN → VERIFY → COMMIT`

The reference implementation intentionally stops before a production commit adapter. A production implementation must provide transactional durable storage, atomic batch commit, write-ahead logging or equivalent crash recovery, concurrency control, backup/restore guarantees, encryption at rest, and operational monitoring.

No network access, credential handling, exploit execution, or external side effects are performed by this component.
