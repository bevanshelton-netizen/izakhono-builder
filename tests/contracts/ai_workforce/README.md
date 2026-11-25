# AI Workforce contract conformance harness

This directory contains isolated, standard-library Python tests for the proposed
IZAKHONO AI Workforce authorization-decision and human-approval contracts.

## Run

From the repository root:

```sh
python -m unittest discover -s tests/contracts/ai_workforce -p 'test_*.py' -v
```

## Scope and limitations

- Synthetic fixtures and a fixed test clock only.
- The signature-verifier callback is injected by the test; it is **not** a
  cryptographic implementation or production trust anchor.
- No network calls, FORTRESS requests, credentials, databases, migrations,
  runtime registration, HOST execution or provider operations.
- Tests cover exact issuer/audience/tenant/actor/agent/action/resource/
  fingerprint/policy binding, time bounds, revocation, ALLOW semantics and
  separately bound human approval.
- These tests validate a test-only reference model. They do not prove that
  FORTRESS, NODE01, Runtime Fabric or an execution adapter implements the
  proposed contract.

Production adoption requires service-owner approval, a reviewed cryptographic
profile, independently managed keys and revocation, and conformance tests
against the actual approved verifier at its enforcement boundary.
