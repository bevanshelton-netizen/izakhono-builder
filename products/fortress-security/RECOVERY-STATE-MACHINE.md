# FORTRESS v3.7 — Recovery State Machine

Defensive reference layer for controlled dead-letter recovery.

Lifecycle:
`DEAD_LETTER → STORED → AUTHORIZED → REPLAYED → ATTESTED → CLOSED`

Any non-terminal state may transition to `QUARANTINED`; terminal states cannot transition further.

Controls:
- deterministic SHA-256 record integrity
- explicit state-transition allow-list
- tamper detection before transition
- tenant and delivery binding
- evidence-linked closure verification
- quarantine as a fail-closed terminal path

Production boundary: durable transactional persistence, concurrency control, authenticated operators, immutable audit logging, encryption, backup/restore, monitoring and operational approvals remain deployment responsibilities. This layer performs no network delivery, credential handling, exploit execution, or external side effects.
