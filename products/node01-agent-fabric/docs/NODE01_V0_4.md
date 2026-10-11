# NODE01 v0.4 — Worker Recovery

NODE01 v0.4 adds the recovery layer beneath the execution runtime.

## Guarantees

- Workers have explicit heartbeats.
- Running tasks are leased to a worker.
- A stale worker causes its task to be returned to `pending` when retry capacity remains.
- Tasks exceeding their retry budget enter a dead-letter queue.
- Only the worker that owns a running task can complete or fail it.
- A runtime snapshot exposes worker/task state for OBSERVE.

## Production boundary

This module is deliberately provider-neutral and in-process. Persistent state, distributed locks, credentials, real mail delivery, infrastructure changes, and public deployment must be supplied by explicit production adapters and verified before being represented as live.
