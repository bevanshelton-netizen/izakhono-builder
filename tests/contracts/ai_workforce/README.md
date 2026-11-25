# AI Workforce contract conformance harness

This directory contains isolated, standard-library Python tests for the proposed
IZAKHONO AI Workforce authorization-decision, human-approval, runtime-binding,
execution-receipt and tenant-isolation contracts.

## Run

From the repository root:

```sh
python -m unittest discover -s tests/contracts/ai_workforce -p 'test_*.py' -v
```

## Scope and limitations

- Synthetic fixtures and fixed test clocks only.
- The signature-verifier and cursor-signing callbacks are injected by the test;
  they are **not** cryptographic implementations or production trust anchors.
- No network calls, FORTRESS requests, credentials, databases, migrations,
  registry, cache, search index, object store, backup, runtime registration,
  HOST execution or provider operations.
- Tests cover exact issuer/audience/tenant/actor/agent/action/resource/fingerprint/
  policy binding, time bounds, revocation, ALLOW semantics, separately bound
  human approval, fresh tenant/agent-scoped runtime registration, health and
  revocation checks, and correlated execution receipts.
- Tenant-isolation tests exercise tenant-scoped query/filter results, pagination
  cursor binding to tenant/query/object scope, export manifest and item-set
  ownership, evidence retrieval scope, tenant-namespaced cache keys, and
  tenant-bound backup/restore verification. Unknown ownership or verification
  fails closed in the reference model.
- These tests validate test-only reference models. They do not prove that
  FORTRESS, NODE01, Runtime Fabric, a registry, cache, evidence store or
  execution adapter implements the proposed contracts.

Production adoption requires service-owner approval, a reviewed cryptographic
profile, independently managed keys and revocation, approved tenant ownership
and persistence boundaries, and conformance tests against actual approved
services at their enforcement boundaries.
