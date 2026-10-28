# FORTRESS v2.5 — Control-Plane Event Journal

The control journal provides an append-only, tenant-scoped integrity chain for security lifecycle events.

## Lifecycle

`INTELLIGENCE → POLICY → APPROVAL → ENFORCEMENT → ADAPTER → ATTESTATION → AUDIT/JOURNAL`

Each event carries a deterministic identifier, tenant identity, sequence number, previous-event hash, outcome, timestamp and integrity hash. Verification recomputes the event identity and integrity chain.

## Security properties

- tenant-scoped sequencing and retrieval
- deterministic SHA-256 event identity
- previous-hash chaining
- tamper detection
- explicit lifecycle event types
- no cross-tenant event mixing

This is a control-plane data contract. It does not execute network actions, remediation, exploitation or other external side effects.
