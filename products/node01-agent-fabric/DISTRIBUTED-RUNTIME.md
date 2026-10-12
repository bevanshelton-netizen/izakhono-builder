# NODE01 v0.5 Distributed Runtime

The distributed coordinator introduces the worker contract used by NODE01:

1. Worker registration declares capabilities and concurrency.
2. Workers heartbeat and are health-checked.
3. Jobs are submitted with idempotency keys.
4. Workers claim only compatible work and respect concurrency limits.
5. Completion requires ownership of the claimed work.
6. Receipts contain an evidence hash.
7. Stale workers are marked offline for recovery by the next runtime layer.

## Production adapter boundary

The reference coordinator is intentionally dependency-free and in-memory. Production NODE01 must replace the storage/queue boundary with an owned durable implementation while preserving the contract above. The engine must not claim distributed durability merely because this reference coordinator is present.

Recommended production components:
- durable task store
- durable queue/stream
- worker lease store
- append-only execution ledger
- metrics/event sink
- dead-letter/replay store

External infrastructure remains an adapter and must pass IZAKHONO owned-first and public-live evidence gates before being treated as production infrastructure.
