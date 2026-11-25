# IZAKHONO AI Workforce — Contract Test Vectors v1

**Status:** Proposed static fixtures and negative-test vectors; not executed  
**Parent:** `IZAKHONO-AI-WORKFORCE-CONTRACTS-V1.md`  
**Companion review:** `IZAKHONO-AI-WORKFORCE-PHASE1-CONTRACT-HARDENING-REVIEW.md`  
**Scope:** Deterministic, synthetic contract examples for isolated tests. No live services, credentials, database, migration, network calls or runtime activation.

## 1. Fixture rules

- All identifiers and digests below are synthetic test values, not real tenant, user, agent, runtime or provider identifiers.
- Test signing keys must be generated only inside an isolated test harness. Never place private keys, bearer tokens, passwords, refresh tokens, provider sessions or real customer data in fixtures.
- Fixtures describe expected contract behaviour. They do not prove a service implements it.
- A positive authorization fixture is valid only when the test verifier supplies a trusted test issuer/key and the expected audience. A JSON object alone is not a signed decision.
- Time-dependent tests use a fixed injected clock. They must not depend on wall-clock timing.
- Tests must assert both the response and the absence of side effects (no tool handler call, no queue dispatch, no HOST invocation) for every denial case.

## 2. Shared synthetic context

| Field | Synthetic value |
|---|---|
| Tenant A | `tenant-test-a` |
| Tenant B | `tenant-test-b` |
| Human actor | `principal-test-owner-a` |
| Agent | `agent-test-research-001` |
| Agent version | `agent-version-3` |
| Task | `task-test-1001` |
| Tool | `research.fetch.v1` |
| Resource | `dataset:public-catalogue-7` |
| Environment | `host-env-test-a` |
| Runtime binding | `runtime-binding-test-a` |
| Adapter | `host-adapter-test-v2` |
| Execution audience | `izakhono-host-executor-test` |
| Request fingerprint | `sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` |
| Policy | `fortress-policy-workforce-test`, version `7` |
| Fixed test time | `2026-11-25T12:00:00Z` |

## 3. Positive authorization decision fixture

The verifier must be configured independently with a synthetic trusted test issuer and signing key. The artifact's signature, issuer, audience, validity and claims must be checked before this fixture can pass.

```json
{
  "schema_version": "1.0",
  "decision_id": "decision-test-9001",
  "decision": "ALLOW",
  "issuer": "https://fortress.test.invalid",
  "audience": "izakhono-host-executor-test",
  "actor": {
    "type": "principal",
    "id": "principal-test-owner-a",
    "tenant_id": "tenant-test-a"
  },
  "subject": {
    "agent_id": "agent-test-research-001",
    "agent_version_id": "agent-version-3"
  },
  "operation": {
    "task_id": "task-test-1001",
    "action": "tool.execute",
    "tool_id": "research.fetch.v1",
    "resource": "dataset:public-catalogue-7",
    "environment_id": "host-env-test-a",
    "purpose": "approved_research",
    "data_classification": "public"
  },
  "request_fingerprint": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "policy": {
    "policy_id": "fortress-policy-workforce-test",
    "policy_version": "7"
  },
  "constraints": {
    "allowed_tools": ["research.fetch.v1"],
    "max_execution_seconds": 30,
    "network_profile": "public-read-only"
  },
  "issued_at": "2026-11-25T11:59:30Z",
  "not_before": "2026-11-25T11:59:30Z",
  "expires_at": "2026-11-25T12:00:30Z",
  "approval_ref": null,
  "revocation_status": "not_revoked",
  "audit_ref": "evidence-test-9001"
}
```

Expected: verifier accepts only when the trusted test signature is valid and all request claims exactly match the execution request. The test must then exercise a fake tool handler and assert it receives only the constrained request.

**Important contract clarification:** caller-supplied requested expiry is at most a requested maximum TTL. FORTRESS chooses the actual `issued_at`, `not_before` and `expires_at`; a caller cannot extend a decision by supplying its own expiry.

## 4. Positive runtime binding fixture

```json
{
  "schema_version": "1.0",
  "runtime_binding_id": "runtime-binding-test-a",
  "tenant_id": "tenant-test-a",
  "workload_id": "workload-test-research",
  "logical_runtime_identity": "NODE01",
  "execution_adapter": {
    "adapter_id": "host-adapter-test-v2",
    "version": "2.0.0",
    "identity_verified": true
  },
  "execution_environment": {
    "environment_id": "host-env-test-a",
    "registration_verified": true
  },
  "registration_state": "ACTIVE",
  "health_state": "HEALTHY",
  "last_health_at": "2026-11-25T11:59:50Z",
  "health_ttl_seconds": 60,
  "credential_reference": "fortress-secret-ref-test-only",
  "revocation_state": "NOT_REVOKED",
  "registration_evidence_ref": "runtime-registration-evidence-test-a"
}
```

Expected: accept only when the verifier independently validates the adapter identity, environment registration, tenant/workload binding, current health window and non-revoked state. Boolean fields in this JSON are fixture claims, not proof; the test adapter must supply independently trusted verification results.

## 5. Positive HOST execution receipt fixture

```json
{
  "schema_version": "1.0",
  "receipt_id": "host-receipt-test-1001",
  "issuer": "host-adapter-test-v2",
  "tenant_id": "tenant-test-a",
  "workload_id": "workload-test-research",
  "task_id": "task-test-1001",
  "attempt_id": "attempt-test-1",
  "agent_id": "agent-test-research-001",
  "agent_version_id": "agent-version-3",
  "runtime_binding_id": "runtime-binding-test-a",
  "execution_environment_id": "host-env-test-a",
  "authorization_decision_ref": "decision-test-9001",
  "request_fingerprint": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "tool_id": "research.fetch.v1",
  "started_at": "2026-11-25T12:00:01Z",
  "completed_at": "2026-11-25T12:00:04Z",
  "outcome": "SUCCEEDED",
  "output_digest": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "cancellation": {
    "requested": false,
    "acknowledged": false,
    "residual_work": "NONE"
  },
  "signature_ref": "test-signature-material-is-supplied-by-harness"
}
```

Expected: accept only after verifying the receipt signature with the adapter's trusted test key and matching every identity, scope, decision and fingerprint field to the original authorized request. The literal `signature_ref` above is a test placeholder, not cryptographic material.

## 6. Negative authorization vectors

| ID | Mutation / condition | Expected result | Side-effect assertion |
|---|---|---|---|
| AUTH-001 | No decision artifact | `AUTHENTICATION_REQUIRED` or `POLICY_DENIED` | Tool not invoked |
| AUTH-002 | Caller sends `approval_granted=true` without FORTRESS decision | Deny | Tool not invoked |
| AUTH-003 | Wrong issuer | Deny | Tool not invoked |
| AUTH-004 | Wrong execution audience | Deny | Tool not invoked |
| AUTH-005 | Tenant B substituted for Tenant A | `TENANT_SCOPE_DENIED` | No lookup or dispatch leak |
| AUTH-006 | Actor differs from decision actor | Deny | Tool not invoked |
| AUTH-007 | Agent or immutable agent version differs | Deny | Tool not invoked |
| AUTH-008 | Action/tool/resource differs | Deny | Tool not invoked |
| AUTH-009 | Request fingerprint differs by one byte | Deny | Tool not invoked |
| AUTH-010 | Decision expired at injected clock | Deny | Tool not invoked |
| AUTH-011 | Decision not yet valid | Deny | Tool not invoked |
| AUTH-012 | Revocation lookup says revoked | Deny | Tool not invoked |
| AUTH-013 | Policy version is stale | Deny or require reauthorization | Tool not invoked |
| AUTH-014 | Signature invalid or key version retired | Deny | Tool not invoked |
| AUTH-015 | FORTRESS unavailable and no approved offline mode | `UNKNOWN`/deny | No consequential dispatch |
| AUTH-016 | Human approval is bound to a different fingerprint | `APPROVAL_REQUIRED`/deny | Tool not invoked |
| AUTH-017 | Approval expired or revoked | `APPROVAL_EXPIRED`/`APPROVAL_REVOKED` | Tool not invoked |
| AUTH-018 | Agent attempts self-approval | Deny and audit | No approval created |

## 7. Negative runtime and receipt vectors

| ID | Mutation / condition | Expected result | Side-effect assertion |
|---|---|---|---|
| RUN-001 | Logical NODE01 exists but HOST environment is unregistered | `RUNTIME_NOT_REGISTERED` | HOST not invoked |
| RUN-002 | Registration state is PENDING | Deny | HOST not invoked |
| RUN-003 | Health timestamp exceeds TTL | `RUNTIME_HEALTH_STALE` | HOST not invoked |
| RUN-004 | Runtime binding belongs to another tenant | `TENANT_SCOPE_DENIED` | HOST not invoked |
| RUN-005 | Adapter identity cannot be verified | `EXECUTION_ADAPTER_UNAVAILABLE` | HOST not invoked |
| RUN-006 | Runtime or credential reference revoked | Deny | HOST not invoked |
| RUN-007 | Callback returns true but no authenticated HOST receipt exists | `EXECUTION_NOT_ACKNOWLEDGED` | Never mark SUCCEEDED |
| RUN-008 | Receipt signature invalid | Reject receipt | Never mark SUCCEEDED |
| RUN-009 | Receipt fingerprint or decision reference mismatches | Reject receipt | Never mark SUCCEEDED |
| RUN-010 | Receipt environment/tenant differs from authorized binding | Reject receipt | Never mark SUCCEEDED |
| RUN-011 | Stop requested; executor unreachable | `PARTIAL`/`UNKNOWN` | Preserve restricted state |
| RUN-012 | Provider cancellation unsupported | Report unsupported/residual work | Never claim cancellation complete |

## 8. Negative idempotency, evidence and tenant-isolation vectors

| ID | Mutation / condition | Expected result |
|---|---|---|
| DATA-001 | Same tenant/actor/operation/key and same canonical request fingerprint | Return original operation identity/result |
| DATA-002 | Same scoped idempotency key but different request fingerprint | `409 IDEMPOTENCY_CONFLICT`; no second side effect |
| DATA-003 | Same raw key in a different tenant | Independent namespace; no cross-tenant collision or disclosure |
| DATA-004 | Crash before state-plus-outbox transaction commits | Neither transition nor event is visible as committed |
| DATA-005 | Crash after atomic commit but before publish | Outbox replay eventually publishes exactly one logical event |
| DATA-006 | Duplicate event delivery | Consumer deduplicates; no repeated consequential action |
| DATA-007 | Evidence store unavailable where policy requires durable evidence | Pending/unknown or fail closed; never report completed |
| DATA-008 | Application role attempts to rewrite historical evidence | Database authorization rejects it |
| DATA-009 | Tenant A queries Tenant B through list, cursor, search, export, cache or backup restore | No data or existence leak |
| DATA-010 | Missing/stale telemetry | Render UNKNOWN/STALE, never HEALTHY |

## 9. Required harness assertions

For each negative vector, the isolated harness should assert:

1. the stable error/state is returned;
2. the request correlation ID is retained without leaking sensitive payload;
3. no prohibited tool, queue, provider or HOST side effect occurred;
4. a denial/unknown event is emitted only through the configured test evidence sink;
5. retrying the same request does not bypass the denial or duplicate a consequential action.

The harness must inject clock, verifier, FORTRESS client, runtime registry, evidence sink, queue and HOST adapter. No test should silently fall back to live services or default credentials.

## 10. Acceptance boundary

These vectors become executable tests only after contract owners approve the issuer/audience, decision semantics, runtime registration proof, HOST receipt verification, tenant isolation and atomic evidence boundary. Until then they are review fixtures. No production endpoint, schema, migration, credential, provider grant or runtime has been created or activated.
