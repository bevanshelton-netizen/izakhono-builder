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

The module is policy logic, not persistence or transport. The caller must authenticate and authorize tenant scope; persist state and idempotency key atomically; enforce unique (deployment_id, idempotency_key) and reject key reuse with a different request; append immutable audit events; keep secrets out of records and logs; and require a fresh registry heartbeat, verified runtime binding and readiness before target selection.

NODE01 remains the logical software identity. Its execution environment is a separately verified binding. Production promotion stays blocked until owner-runtime acceptance, backups, rollback and independent HTTPS checks are demonstrated.

## Tests

Run from this directory with Node.js 20 or later:

```sh
node --test lifecycle.test.mjs
```

No third-party package, paid builder, hosted inference, AI token or usage-credit account is required.
