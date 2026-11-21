# NODE01 v1.2 — Workforce Supervisor

The supervisor adds a durable coordination layer above the persistent worker fabric.

## Flow

Durable orchestration → capability workers → lease/recovery → completion → supervisor receipt

## Guarantees

- workers remain capability-scoped
- expired leases are recovered before dispatch
- queue ownership rules remain authoritative
- bounded cycle/task processing prevents unbounded draining
- supervisor output includes queue snapshot and evidence hash
- no external side effect bypasses Tool Fabric or policy

## Production boundary

The supervisor uses the existing SQLite queue and PersistentWorker contracts. SQLite remains a replaceable adapter. This release does not claim public deployment, external credentials, DNS/TLS activation, or autonomous external side effects.
