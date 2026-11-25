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
- Recovery-governance tests model bounded retry budgets, policy-verified
  backoff, stale-operation escalation, assigned operator ownership, evidence
  preservation, tenant/fingerprint-bound recovery approval, separation of
  operator and approver, and unresolved closure. An operator cannot declare
  execution successful through a recovery-resolution action.

- Recovery-audit tests model a sequenced event ledger binding each recovery case
  and operation to tenant and request fingerprint; authenticated initiating
  principal/session context; assigned operator and distinct approver; reason,
  action, approval decision and policy version; hashed evidence references;
  reconciliation queries, receipt-verification result and execution-attempt
  correlation; and final disposition/outcome certainty. They reject
  cross-scope references, missing actor/evidence, operator self-approval,
  altered fingerprints, unverified checkpoints, sequence/time rollback,
  unsupported terminal dispositions and event mutation/deletion.
- The recovery-audit ledger is a synthetic in-memory hash-chain reference
  model. A hash chain is **not** tamper-proof or immutable storage and does not
  prove signer identity, key custody, atomicity, retention or independent
  verification. Production requires signed checkpoints, separately controlled
  append-only storage, independently verifiable evidence, managed signing-key
  lifecycle, retention/access segregation and atomic state-plus-audit commits.
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
