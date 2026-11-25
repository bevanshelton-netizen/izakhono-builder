# AI Workforce contract conformance harness

This directory contains isolated, standard-library Python tests for the proposed
IZAKHONO AI Workforce authorization-decision, human-approval, runtime-binding,
execution-receipt, tenant-isolation, idempotency, atomic-evidence and
recovery/reconciliation contracts.

## Run

From the repository root:

```sh
python -m unittest discover -s tests/contracts/ai_workforce -p 'test_*.py' -v
```

## Scope and limitations

- Synthetic fixtures and fixed test clocks only.
- Signature-verifier and cursor-signing callbacks are injected by tests; they
  are **not** cryptographic implementations or production trust anchors.
- No network calls, FORTRESS requests, credentials, databases, migrations,
  registry, cache, search index, object store, backup, runtime registration,
  HOST execution or provider operations.
- Decision and approval tests cover exact issuer/audience/tenant/actor/agent/
  action/resource/fingerprint/policy binding, time bounds, revocation, ALLOW
  semantics and separately bound human approval.
- Runtime tests cover fresh tenant/agent-scoped registration, health and
  revocation checks, plus correlated execution receipts and their time/scope.
- Tenant-isolation tests exercise tenant-scoped query/filter results,
  pagination cursor binding to tenant/query/object scope, export manifest and
  item-set ownership, evidence retrieval by tenant/object/object ID,
  tenant-namespaced cache keys, and tenant-bound backup/restore verification.
- Idempotency tests model tenant-scoped idempotency keys: a repeated key and
  identical request fingerprint returns the original operation; reuse with a
  different fingerprint conflicts.
- Atomic-evidence tests model copy-on-write publication of operation state,
  evidence and an outbox event as one unit. Injected failures before commit
  publish none of the staged records.
- Recovery tests model pending outbox delivery, retry after uncertain delivery
  acknowledgement, consumer idempotency, and explicit reconciliation when an
  executor's outcome is unknown. Only a scope-matched, independently verified
  receipt may move an uncertain operation to ACKNOWLEDGED or FAILED.
- The idempotency ledger, atomic store and recovery coordinator are in-memory
  reference models. They do not prove database uniqueness, isolation levels,
  crash consistency, distributed locking, durable outbox delivery, delivery
  guarantees, durable recovery, or exactly-once execution. Real systems must
  define retry, reconciliation, duplicate suppression and operator escalation.
- These tests do not prove that FORTRESS, NODE01, Runtime Fabric, a registry,
  cache, evidence store or execution adapter implements the proposed contracts.

Production adoption requires service-owner approval, a reviewed cryptographic
profile, independently managed keys and revocation, approved tenant ownership
and persistence boundaries, and conformance tests against actual approved
services at their enforcement boundaries.
