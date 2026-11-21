# FORTRESS v2.6 — Unified Security Control API

The v2.6 control API is a deterministic, tenant-safe ingestion contract for recording security control-plane lifecycle events in the FORTRESS control journal.

## Purpose

The API provides one validated entry point for:

`INTELLIGENCE → POLICY → APPROVAL → ENFORCEMENT → ADAPTER → ATTESTATION → JOURNAL`

It does not execute security actions, make network calls, invoke adapters, or create external side effects.

## Contract

Every request requires:

- `tenantId`
- `actorId`
- `eventType`
- `subjectId`
- `outcome`
- `timestamp`

Optional correlation and lifecycle references include policy, approval, enforcement-decision, adapter-execution, and attestation identifiers.

The actor and correlation references are carried into journal metadata so downstream reporting can reconstruct the control-plane lifecycle without changing the append-only journal contract.

## Tenant isolation

An optional `expectedTenantId` represents the already-authorized tenant context. If supplied, the request tenant must match exactly. A mismatch is rejected before journal creation.

Validation failures never append an event.

## Determinism and integrity

Each request receives a deterministic SHA-256 `requestId`. Accepted events are created through the v2.5 journal, which provides deterministic event IDs, tenant-scoped sequencing, previous-hash chaining, and integrity verification.

## Failure behavior

The API fails closed for:

- missing tenant, actor, or subject context
- unsupported event types
- unsupported outcomes
- invalid timestamps
- authorized-context tenant mismatch

## Security boundary

This is a control-plane API contract, not a production network service. Authentication, transport security, rate limiting, durable persistence, encryption at rest, and production IAM remain deployment responsibilities. No offensive execution capability is introduced.
