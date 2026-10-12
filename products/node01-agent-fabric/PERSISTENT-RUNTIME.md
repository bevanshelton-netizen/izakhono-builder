# NODE01 v0.6 — Durable Queue + Persistent Worker Fabric

v0.6 adds a dependency-free SQLite durability adapter and a persistent worker execution boundary.

## Flow

`submit → durable task row → capability lease → worker execution → evidence receipt → complete`

Failures are re-queued until the configured attempt limit, then moved to `dead_letter`. Expired leases are recoverable.

## Durability boundary

SQLite is the reference owned/local durable implementation. It is deliberately an adapter boundary: a future IZAKHONO-owned queue or database can implement the same semantics without changing worker behavior.

The runtime does **not** claim public-live, multi-host production status. Continuous distributed operation still requires a persistent worker fleet, durable infrastructure deployment, monitoring, and verified production evidence.
