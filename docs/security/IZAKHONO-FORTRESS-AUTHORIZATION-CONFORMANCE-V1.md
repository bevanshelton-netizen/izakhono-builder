# IZAKHONO FORTRESS Authorization Conformance V1

- **Status:** Proposed conformance specification and synthetic fixtures; documentation/test-data only.
- **Date:** 26 November 2026
- **Depends on:** FORTRESS Governance Interface V1 (PR #776) and the existing FORTRESS egress guard reviewed on `feat/ai-workforce-governance-architecture-v1`.
- **Purpose:** Establish repeatable security acceptance evidence for the existing narrow egress evaluator and a staged conformance roadmap for the wider FORTRESS governance interface.
- **Boundary:** This package does not claim that the complete FORTRESS identity, PDP/PEP, delegation, approval, secrets or audit services exist.

---

## 1. Conformance model

Conformance is assessed per capability and implementation surface, not by product name. A product or service MUST NOT claim full FORTRESS conformance because it passes only the external-egress fixtures.

Three statuses are used:

- **Implemented and testable:** source code exists and a test can exercise it.
- **Specified, implementation unverified:** a contract exists, but no verified implementation has been demonstrated.
- **Not covered:** the capability is outside the tested surface or has no accepted contract.

Each result MUST identify the source revision, test suite revision, policy revision, runtime/environment, timestamp and execution evidence. A result without these identifiers is not release evidence.

## 2. Current verified test target

The existing `products/izakhono-fortress/guard.py` exposes a pure `authorize(req, policy=None)` evaluator. It currently checks:

1. non-empty `entity_id`;
2. membership of `data_class` in the policy's forbidden or allowed external classes;
3. recursively detected exact forbidden field names in the payload;
4. `provider_class == external_ai`;
5. the external AI purpose denylist and allowlist;
6. default denial for unrecognised provider classes.

The associated `policy.json` defines the initial external data classes and purpose allowlists. The fixtures in `tests/fixtures/fortress-egress-conformance-v1.json` are designed against this evaluator and policy.

**Important limitations of this current target:**

- It does not authenticate a caller or verify the bearer token at the pure evaluator boundary.
- The HTTP handler's bearer-token check is a shared static token comparison, not a full principal/session identity system.
- The request has no verified tenant membership, principal identity, resource ownership, action binding, delegation chain or approval binding.
- Exact forbidden field-name detection does not establish that arbitrary free text, encoded material, attachments or transformed data contain no secrets.
- The service is documented as a policy decision point, not a transparent network firewall.
- A successful egress decision does not prove that every outbound path is forced through this service.

These are explicit coverage gaps, not reasons to discard the existing guard.

## 3. Synthetic fixture format

The JSON fixture catalogue is the canonical machine-readable input for the current evaluator suite. Each fixture has:

- stable test ID;
- descriptive name;
- synthetic request;
- expected decision and reason code, or a robustness-probe expectation;
- no real credentials, personal data, customer records or production identifiers.

A future test harness SHOULD load the actual policy file and pass each request to the actual `authorize` function. It MUST NOT copy the policy into a second hard-coded implementation. A harness MUST fail if the fixture cannot be evaluated or if actual output differs from the expected decision/reason pair.

### 3.1 Required result record

Each executed fixture SHOULD produce a result record with:

```json
{
  "suite_id": "fortress.egress.authorization.v1",
  "fixture_id": "EG-001",
  "source_revision": "git_commit_sha",
  "policy_version": 1,
  "test_runner_version": "runner_version",
  "environment": "isolated_test",
  "executed_at": "2026-11-26T00:00:00Z",
  "expected": {"allowed": true, "reason": "allowed_external_ai_advisory"},
  "actual": {"allowed": true, "reason": "allowed_external_ai_advisory"},
  "status": "pass",
  "evidence_ref": "test-artifact-reference"
}
```

Values are illustrative. Test output MUST NOT echo sensitive payloads. Record fixture IDs and redacted outcomes, not raw request bodies.

## 4. Current egress evaluator test matrix

The JSON fixture file includes eighteen cases:

| IDs | Security property | Expected outcome |
|---|---|---|
| EG-001–003 | Allowlisted entity, provider, data class and purpose combinations | Permit |
| EG-004–005 | Missing or blank entity scope | Deny |
| EG-006–007 | Explicitly forbidden data classes | Deny |
| EG-008–009 | Unknown or missing data class | Deny |
| EG-010–011 | Forbidden external authority/core-runtime purposes | Deny |
| EG-012 | Unknown purpose | Deny |
| EG-013 | Unknown provider class | Deny |
| EG-014–017 | Nested/array secret-like fields and sensitive payment/auth field names | Deny |
| EG-018 | Malformed request object robustness | Must reject safely; exception is a defect, not a passing deny |

EG-018 is deliberately marked as a robustness probe. The current function dereferences request fields without a top-level schema/type guard; the test must expose that gap rather than silently count an exception as a safe denial.

## 5. HTTP boundary tests — separate from pure policy tests

The HTTP service requires its configured bearer token for `GET /v1/policy` and `POST /v1/authorize-egress`. A future HTTP conformance suite MUST independently test:

- missing token → 401;
- incorrect token → 401;
- correct token → request reaches evaluator;
- unknown path → 404;
- malformed JSON → 400;
- oversized body handling is bounded and rejected safely;
- unsupported content type and invalid content length are rejected safely;
- server binds to loopback by default;
- response headers include no-store and nosniff;
- error responses do not disclose secrets or filesystem paths.

The current handler reads `min(Content-Length, 262144)` bytes. A conformance test must determine whether oversized declared bodies are actually rejected; truncating input and then parsing it is not sufficient. This is a test requirement, not a claim that the handler already passes it.

HTTP tests MUST run only in an isolated test process with a synthetic test token. Never request, display or commit a real FORTRESS token.

## 6. Security property tests

Beyond fixed examples, the implementation suite SHOULD include property and mutation tests:

1. **Unknown-value denial:** arbitrary unknown provider, data class and purpose values never produce permit.
2. **Entity scope:** missing, empty and whitespace-only entity values never produce permit.
3. **Forbidden class precedence:** every configured forbidden class is denied even if policy configuration accidentally also lists it as allowed; configuration inconsistency must be detected at policy-load/validation time.
4. **Secret-key recursion:** forbidden field names are detected at arbitrary nested dictionary/list depth.
5. **Case handling:** field-name case variants are tested; current code lowercases keys before comparison.
6. **Policy mutation:** removing an allowlist entry changes the expected result to deny; adding an unrecognised value does not create an unintended grant.
7. **Malformed input:** non-object requests, malformed policy structure and policy file read/parse errors fail closed with controlled errors.
8. **No secret echo:** logs, responses and test artefacts never include secret-like values.
9. **No cross-entity bleed:** requests cannot use one entity's scope to access another entity's data; current guard only requires a non-empty entity ID and does not prove ownership. This remains a release-blocking gap for multi-entity data access until an authoritative ownership check exists.
10. **Fail closed:** evaluator, policy loading and enforcement dependency failures cannot become a permit.

Property tests MUST use deterministic seeds or retain the seed and generated case reference for reproducibility.

## 7. Wider governance conformance — specified, implementation unverified

The following tests derive from FORTRESS Governance Interface V1. They are acceptance requirements for later implementation. They MUST be reported as `not_implemented` or `not_tested` until an actual implementation and enforcement point are supplied.

| Suite | Required cases | Release gate |
|---|---|---|
| Identity | Forged principal, wrong issuer/audience, expired/revoked principal, step-up | No request proceeds without verified identity |
| Tenant isolation | Tenant substitution, cross-tenant resource, stale membership, owner mismatch | All unauthorised cross-tenant attempts denied |
| PDP/PEP | Missing policy, PDP timeout, stale decision, obligation bypass, altered resource | Enforcement point denies unsafe/indeterminate requests |
| Delegation | Authority amplification, expired grant, revoked grant, chain tampering, agent self-grant | Effective authority never exceeds grantor and grant scope |
| Approval | Self-approval, changed amount/destination/resource, expired/replayed approval, wrong approver | Exact reviewed action only; single-use where required |
| Secrets | Unauthorised reference, wrong workload, revoked version, leakage in logs/prompts | No unauthorised disclosure or use |
| Audit | Missing event, tampered record, unauthorised audit read, sink unavailable | Required high-risk operations block without durable evidence |
| Revocation | Principal/session/delegation/secret revocation and propagation | Meets documented revocation target |
| Product adapters | API, worker, scheduler and agent-tool paths | Equivalent policy enforcement across entry points |

## 8. Product adoption gates

A product is not FORTRESS-conformant merely because it calls a policy endpoint. It MUST demonstrate that every relevant execution path is mediated and that the returned decision is enforced at the operation boundary.

Required product evidence:

- named owner and service/agent principal;
- documented action/resource/purpose inventory;
- tenant and resource ownership source of truth;
- policy and adapter version;
- list of all ingress, background and egress execution paths;
- positive and negative test results;
- approval/delegation enforcement evidence where applicable;
- revocation and failure-mode evidence;
- security audit correlation;
- rollback and incident containment procedure.

A product release gate MUST remain closed when any material execution path bypasses the enforcement point or when tests are not run against the release candidate revision.

## 9. Severity and release decision

- **Critical:** unauthorised permit, cross-tenant disclosure, secret leakage, approval bypass, privilege escalation or ability to disable enforcement without authority. Release blocked; incident/security review required.
- **High:** fail-open dependency behaviour, missing required audit on consequential actions, ineffective revocation, unmediated production path. Release blocked until fixed or explicitly risk-accepted by authorised owner under a time-bounded exception.
- **Medium:** insufficient diagnostics, incomplete metrics or bounded control gaps without demonstrated privilege bypass. Must have owner and remediation date.
- **Low:** non-security usability or documentation defects. Track and resolve through normal maintenance.

No risk acceptance may legalise a prohibited data flow or waive tenant isolation. Exceptions require accountable owner, precise scope, rationale, expiry, compensating controls and audit evidence.

## 10. Implementation sequence

1. **Fixture harness:** build a test runner against the existing `authorize` function and actual policy file; execute EG-001–EG-018.
2. **Close observed robustness gaps:** add strict request and policy schema validation; reject oversized HTTP bodies rather than silently truncating; make malformed inputs fail safely.
3. **HTTP boundary suite:** test authentication, request parsing, loopback binding, response handling and no-secret disclosure.
4. **Entity isolation:** define authoritative entity ownership and prove isolation; a non-empty `entity_id` alone is not enough.
5. **Governance interface suites:** implement and test identity, tenant, PDP/PEP, delegation, approval, secrets, audit and revocation contracts.
6. **Product adapters:** integrate one product at a time and prove all execution paths are mediated.
7. **Independent review:** run security review, threat-model update, incident exercises and release evidence review.

This document does not authorise code changes to the existing guard, policy, service configuration or deployed environment. Those should be proposed as a separate implementation PR after the owner approves the scope.

## 11. Acceptance checklist

- [ ] JSON fixture catalogue validates against its declared structure.
- [ ] Test harness executes the real evaluator and real policy file.
- [ ] All allow and deny cases match expected decision and reason.
- [ ] EG-018 exposes malformed-input behaviour and cannot be misreported as a pass.
- [ ] HTTP boundary tests run with synthetic credentials only.
- [ ] Oversized-body and malformed-policy behaviour is tested.
- [ ] Entity ownership/isolation is proven before multi-entity production use.
- [ ] Wider governance suites remain visibly unimplemented until verified.
- [ ] Every product adapter demonstrates enforcement on all execution paths.
- [ ] Release evidence is tied to exact source, policy and test revisions.

---

**End of specification.**
