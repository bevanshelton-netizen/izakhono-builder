# NODE01 v0.7 — OBSERVE + CONTROL

This layer adds an operator-visible reference control boundary around the NODE01 runtime.

## Observe
- append-only in-memory event ledger
- correlation IDs on events
- recent-event retrieval
- event-type counters
- JSON export for diagnostics

## Control
- pause new execution
- resume execution
- drain mode
- replay requires explicit approval
- every control action emits an event

## Production boundary
The reference ledger is intentionally dependency-free. Production telemetry should be backed by IZAKHONO-owned durable storage/event infrastructure, with authentication, authorization, immutable audit retention and deployment evidence before it is treated as an operational control plane.
