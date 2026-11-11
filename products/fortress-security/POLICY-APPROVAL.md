# FORTRESS v2.1 — Policy Engine & Approval Gates

FORTRESS v2.1 adds a defensive control-plane gate between security intelligence and any downstream execution adapter.

## Control flow

`INTELLIGENCE → POLICY → APPROVAL → AUTHORIZED EXECUTION ADAPTER`

The policy layer is **deny-by-default**. A request must match a tenant-scoped rule and an authorized proposer role. Rules can require an approval before a downstream adapter may act.

## Roles

- `OWNER` / `SECURITY_ADMIN`: may approve gated actions.
- `ANALYST`: may propose actions when explicitly permitted by policy.
- `VIEWER`: read-only; cannot propose or approve gated actions.

## Safety boundaries

This component does not execute scans, remediation, network changes, credential actions, or offensive operations. It produces authorization state for separately controlled adapters. Production adapters must enforce authorization, tenant isolation, rate limits, audit logging, and their own safety checks.

## Integrity

Policy decisions and approvals receive deterministic identifiers and SHA-256 integrity hashes. Tenant identifiers are carried through every authorization object and rule matching is tenant-scoped.
