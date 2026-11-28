# Deployment lifecycle implementation

This change adds a dependency-free Node.js ES module for deployment record creation and guarded state transitions.

## Enforced gates

- Sequential lifecycle: DISCOVERED → VALIDATED → BUILT → TESTED → APPROVED → RELEASED → HEALTHY → VERIFIED.
- Full source commit SHA and passing policy evidence before build.
- Immutable SHA-256 image digest and artifact reference.
- Passing test evidence before approval.
- Attributable human approval before release.
- Released digest must exactly match the tested build digest.
- Runtime health, independent HTTPS and acceptance evidence before VERIFIED.
- Actor, timestamp, idempotency key and evidence recorded in every transition.
- FAILED is terminal in this module; rollback requires a separately governed workflow.

## Required integration responsibilities

The lifecycle module remains policy logic, but the persistence boundary is now implemented by `transaction.mjs` and `postgres-adapter.mjs`. The coordinator authenticates/authorizes tenant scope before database access, computes a canonical request hash, distinguishes exact replay from conflicting key reuse, and requires state, FORTRESS audit append and idempotency completion to share one transaction. The PostgreSQL adapter uses one checked-out client, locks the existing Runtime Fabric deployment row, stores the small idempotency map in `metadata.deploy_control`, and inserts into the existing `fortress_audit_events` table. It creates no schema and runs no migration.

The Runtime Fabric `PostgresDeploymentStore.put()` path preserves DEPLOY's reserved metadata and tenant/application/environment bindings during ordinary runtime updates. Disposable PostgreSQL CI tests exercise concurrent requests, rollback on audit failure, replay, conflicts and resource scoping. The adapter is not production-wired and fails closed unless the two existing tables are co-located in the same approved database.

NODE01 remains the logical software identity. Its execution environment is a separately verified binding. Production promotion stays blocked until owner-runtime acceptance, backups, rollback and independent HTTPS checks are demonstrated.

## Tests

Run from this directory with Node.js 20 or later:

```sh
node --test lifecycle.test.mjs
```

No third-party package, paid builder, hosted inference, AI token or usage-credit account is required.

## Shared registry adapter

A read-only adapter now bridges DEPLOY to the existing NODE registry. It requires a fresh healthy heartbeat, explicit separate runtime binding, and reachability, persistent storage, container runtime, monitoring and backup readiness. It never instantiates, promotes or executes against a target. Its focused tests use an isolated temporary registry and do not contact an owner runtime.
