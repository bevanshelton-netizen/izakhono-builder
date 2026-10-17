# NODE01 v1.1 — Durable Orchestration

NODE01 v1.1 bridges the bounded v1.0 orchestration layer to the persistent SQLite task queue.

## Flow

Objective → Durable Queue → Lease → Agent Orchestrator → Model Reasoning → Governed Tools → Evidence → Durable Receipt

## Guarantees

- persistent queue-backed orchestration requests
- idempotency-key protection
- worker lease ownership
- existing retry/dead-letter semantics remain authoritative
- orchestration correlation IDs are preserved
- orchestration evidence is serialized into the durable receipt
- missing handlers fail through the existing worker boundary

## Recovery model

An orchestration request is not considered durably completed merely because model reasoning returned. The queue receipt is the durable completion boundary. Expired leases can be recovered by the existing queue recovery mechanism.

## Production boundary

SQLite is the current dependency-free durable adapter. It is not asserted to be the final production infrastructure. An IZAKHONO-owned durable queue/store may replace this adapter while preserving the worker contract.

This release does not claim public deployment, external AI credentials, DNS/TLS activation, or autonomous external side effects.
