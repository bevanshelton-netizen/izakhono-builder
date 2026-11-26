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
- The production acceptance contract now separates the authoritative database
  transaction (operation state + evidence metadata/reference + outbox row) from
  FORTRESS calls, event publication and HOST/provider execution. It specifies
  at-least-once outbox delivery, consumer inbox/deduplication, revalidation at
  the enforcement boundary, and a staged immutable-object protocol when
  evidence bytes live outside the database. It explicitly rejects exactly-once
  execution claims.
- The acceptance checklist requires named persistence/evidence/eventing owners,
  transaction and isolation semantics, tenant-scoped uniqueness, relay/inbox
  ownership, evidence retention/key custody, durability acknowledgement,
  crash/replay/concurrency tests, restore evidence and an approved migration
  and recovery authority. None of these production decisions is marked
  accepted by the synthetic tests.
- Recovery tests model pending outbox delivery, retry after uncertain delivery
  acknowledgement, consumer idempotency, and explicit reconciliation when an
  executor's outcome is unknown. Only a scope-matched, independently verified
  receipt may move an uncertain operation to ACKNOWLEDGED or FAILED.
- Recovery-governance tests model bounded retry budgets, policy-verified
  backoff, stale-operation escalation, assigned operator ownership, evidence
  preservation, tenant/fingerprint-bound recovery approval, separation of
  operator and approver, and unresolved closure. An operator cannot declare
  execution successful through a recovery-resolution action.

- Production-acceptance verification tests assemble a synthetic bundle across
  immutable request/operation, FORTRESS decision, human approval, RuntimeBinding,
  HOST receipt, evidence manifest, canonical outbox event and audit checkpoint.
  They recompute the request fingerprint and reject cross-record tenant,
  environment, approval, receipt, evidence, outbox and checkpoint mismatches.
  Trust and digest verification are injected callbacks, not production
  cryptographic implementations or independent trust anchors.
- Recovery-audit tests bind recovery events to the canonical workforce event
  envelope: schema/source, tenant/organization/agent/workload, actor, correlation
  and causation IDs, idempotency key, classification/redaction metadata,
  payload digest, FORTRESS decision/approval references and evidence reference.
  Recovery-specific fields bind case, operation and immutable request
  fingerprint; authenticated initiating principal/session; distinct operator
  and approver; reason/action/policy version; hashed evidence references;
  reconciliation queries, receipt verification, execution attempt and final
  disposition/outcome certainty. Cross-event case/operation/fingerprint
  consistency and duplicate event IDs are enforced by the synthetic model.
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

- Independent-verifier operational-contract tests also require the complete, non-duplicated authoritative source set, all source-specific read audiences, the full trust-key purpose set, unique key IDs, and valid freshness limits. Missing or duplicate sources, missing trust purposes, wrong-purpose keys, or incomplete read scopes are rejected/unknown rather than silently accepted.
- Independent-verifier operational-contract tests model a tenant-scoped,
  read-only verifier identity; authenticated, fresh, operation-correlated
  source records; explicit versioned profiles; trusted-time availability;
  trusted/revoked key status; append-only findings; and verifier compromise
  containment that revokes access while preserving prior findings. This is
  an in-memory contract model only: it does not implement cryptography,
  workload identity, authoritative source adapters, trusted time, durable
  append-only storage, independent audit reproduction or incident response.

- Independent audit reproducibility tests model a signed, tenant-scoped package
  containing immutable source/evidence references, trust/time/profile/build
  artifacts and provenance. They reject missing/duplicate artifacts, digest
  mismatches, cross-tenant scope, untrusted package signers, package-supplied
  trust anchors, incomplete or inconsistent snapshots, pagination gaps,
  build/profile mismatch and runners with mutating capability. Historical
  reproduction outcomes are distinguished from current reassessment. This is
  an in-memory model only: it does not implement signatures, digest algorithms,
  snapshot APIs, immutable object storage, deterministic containers, trusted
  trust-anchor distribution, reviewer identity or production audit.


- Evidence-package data-contract tests model tenant-scoped immutable object
  versions, exact-version resolution, content-digest verification, canonical
  manifest ordering and binding to tenant/operation/request fingerprint,
  duplicate and unresolved reference rejection, legal-hold enforcement and
  explicitly authorized disposition. This is a synthetic in-memory model; it
  does not implement an object store, transaction coordinator, encryption,
  signature verification, retention scheduler, backup/restore or legal process.
- Evidence-storage lifecycle tests model staged immutable objects, quarantine,
  copy-on-write publication of operation/evidence-reference/outbox records,
  failed-transaction non-publication, authorized orphan cleanup, legal-hold
  blocking and restore-time byte/reference digest checks. This is a synthetic
  in-memory model; it does not prove database atomicity, object-store durability,
  distributed transaction behavior, backup isolation or production recovery.

- Evidence service interface tests model the proposed exact-version resolver:
  tenant and principal scope, FORTRESS allow/deny/audience/purpose checks,
  revocation re-check on each read, rejection of caller storage locators and
  mutable latest aliases, content-digest validation and scope-bound audit
  references. The model is synthetic; it does not call FORTRESS, implement
  cryptography, access an object store or prove production audit durability.
