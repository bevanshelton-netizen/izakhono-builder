# FORTRESS v3.9 — Recovery Governance

Defensive reference control layer for governed recovery closure.

## Lifecycle

`PROPOSE → EVALUATE → QUORUM → EVIDENCE-BIND → AUTHORIZE → ATTEST → CLOSE`

## Controls

- Tenant-scoped governance decisions
- OWNER and SECURITY_ADMIN role requirements
- Multi-party quorum
- Proposer/approver separation
- Duplicate-approver suppression
- Approval expiry enforcement
- Evidence-digest binding
- SHA-256 integrity for approvals, decisions and evidence bindings
- Fail-closed authorization
- Tenant isolation

## Evidence Vault Boundary

The integration defines a replaceable evidence-vault contract and validates tenant ownership, integrity and expiry. It performs no network calls and has no external side effects.

## Production Boundary

Production deployment still requires durable transactional persistence, real IAM, encryption at rest, concurrency controls, immutable audit logging, backup/restore, monitoring and operational approval controls. This package does not claim those capabilities are production provisioned.
