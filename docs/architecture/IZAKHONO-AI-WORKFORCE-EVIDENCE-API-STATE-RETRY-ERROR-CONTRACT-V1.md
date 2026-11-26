# IZAKHONO AI Workforce — Evidence API State, Retry and Error Contract v1.0

**Status:** Proposed transport-neutral operational contract. No endpoint, HTTP gateway, database, queue, object store or production owner is confirmed.

## 1. Purpose

This contract defines safe client behavior under retries, timeouts, partial failures and uncertain acknowledgements. It does not select an HTTP framework, persistence engine, broker or vendor.

The service must never turn an uncertain outcome into success merely because a request was accepted, a connection closed or a retry returned an earlier response.

## 2. Stable operation identity and idempotency

Every mutating request carries an authenticated actor, authoritative tenant scope, request and correlation IDs, an idempotency key, a canonical request fingerprint, exact source/target identities, purpose and classification.

The idempotency identity is (authoritative tenant, operation family, idempotency key).

Rules:
1. Same tenant, operation family, key and fingerprint: return the same operation identity and current authoritative state; do not repeat side effects.
2. Same key but different fingerprint: return IDEMPOTENCY_CONFLICT; do not mutate the original operation.
3. Different tenant: independent namespace; never reveal another tenant's key or operation.
4. Missing key for a mutating operation: reject before side effects.
5. The receiver recomputes the fingerprint from all security- and effect-relevant fields. A caller-supplied fingerprint is only an assertion.
6. Every consequential transition re-evaluates current FORTRESS authorization and revocation. A retry does not inherit a prior allow.
7. A stable idempotency key is not permission to repeat external business execution after an uncertain result.

Canonicalization profile/version and fingerprint input fields require contract-owner approval.

## 3. Ingest lifecycle and legal transitions

Normal progression:

- RECEIVED → VALIDATING → STAGING → VERIFYING → STAGED_VERIFIED → COMMIT_PENDING → COMMITTED

Exceptional states:
- REJECTED: deterministic validation or policy failure; no committed reference.
- FAILED_SAFE: failure proven before external effect or durable publication.
- UNKNOWN: an effect or commit may have occurred but authoritative state cannot be established.
- QUARANTINED: bytes are preserved but not exposed because validation, commit or reconciliation is incomplete.

STAGED_VERIFIED means exact immutable bytes were read back and verified; it does not mean the operation or evidence reference is committed. COMMITTED requires authoritative transaction-owner confirmation that operation state, evidence reference/metadata and outbox intent committed under the approved atomicity boundary.

A timeout after COMMIT_PENDING is UNKNOWN until reconciliation proves COMMITTED or a safe non-commit outcome. Quarantined objects are inaccessible to ordinary consumers. Corrections create new events/versions; history is not overwritten.

## 4. Resolve lifecycle

- VERIFIED: exact version retrieved and verified, current policy passed, and required audit acknowledgement obtained.
- REJECTED: authentication, policy, scope, hold, disposition or integrity rule failed.
- PENDING: an explicitly asynchronous verification or audit step is running; no content is released.
- UNKNOWN: outcome cannot be established; query/reconcile using stable request/correlation reference. Do not infer that no access occurred.

Content is released only after all required verification and audit gates pass. Metadata-only requests do not bypass authorization or audit policy.

## 5. Disposition lifecycle

REQUESTED → AUTHORIZED → EXECUTION_PENDING → EXECUTED_VERIFIED

Other outcomes:
- REJECTED: policy, hold or approval gate denied.
- UNKNOWN: storage effect or acknowledgement uncertain; reconcile exact object/version before retry.
- PARTIAL: only a subset of requested replicas/representations was disposed; preserve references and escalate.

Only the designated storage owner performs physical disposition. A queue acknowledgement is not proof of deletion. Legal hold cannot be cleared by the requester, operator or storage service acting alone.

## 6. Retry and reconciliation matrix

| Situation | Client behavior | Service behavior |
|---|---|---|
| Authentication missing/invalid | Re-authenticate before a new request | No side effect |
| FORTRESS deny/revoked/expired | Do not retry unchanged | Reject and record policy outcome |
| Same key, same fingerprint | Retry/query same operation | Return same operation ID and authoritative state |
| Same key, different fingerprint | Stop; seek a separately governed new operation | IDEMPOTENCY_CONFLICT |
| Validation failure | Correct payload; new key for materially changed request | REJECTED; no committed reference |
| Upload timeout | Query stable request reference | Reconcile exact staging session/version |
| Digest mismatch | Stop and escalate | Quarantine exact version |
| Commit acknowledgement timeout | Query authoritative transaction owner/outbox | COMMITTED only with proof; otherwise UNKNOWN |
| Outbox publication timeout | Do not repeat business action | Relay retries same event ID; consumers deduplicate |
| Content retrieval timeout | Re-authorize before retry | Exact-version re-read and audit |
| Audit acknowledgement unavailable | Do not release content where audit-before-release applies | Fail closed or PENDING/UNKNOWN |
| Disposition timeout | Query exact version and replica state | Reconcile; never assume deleted |
| Restore verification incomplete | Keep restore isolated and unpromoted | UNKNOWN/FAILED |

Backoff, retry ceilings, timeout values and service objectives require owner approval and are not selected here.

## 7. Error envelope

Every error uses a stable machine-readable envelope:
- error_code;
- request_id and correlation_id;
- operation_id when one exists;
- retry_class: NEVER, AFTER_REAUTHORIZATION, AFTER_POLICY_CHANGE, SAFE_SAME_KEY, RECONCILE_FIRST or OPERATOR_REVIEW;
- outcome_certainty: NO_EFFECT_PROVEN, EFFECT_NOT_STARTED, COMMITTED, UNKNOWN or PARTIAL;
- safe non-sensitive message;
- optional allowlisted field errors;
- audit reference when available and safe to disclose.

Never include raw exception text, SQL, storage locators, tenant-existence clues, secrets, access tokens, signed decision contents or unredacted evidence.

Stable codes include AUTHENTICATION_REQUIRED, IDENTITY_INVALID, TENANT_SCOPE_DENIED, POLICY_DENIED, APPROVAL_REQUIRED, DECISION_EXPIRED, DECISION_REVOKED, PURPOSE_NOT_AUTHORIZED, CLASSIFICATION_BLOCKED, EVIDENCE_NOT_FOUND, EVIDENCE_VERSION_NOT_FOUND, EVIDENCE_DISPOSED, LEGAL_HOLD_RESTRICTION, EVIDENCE_DIGEST_MISMATCH, EVIDENCE_CONTENT_UNAVAILABLE, AUDIT_ACKNOWLEDGEMENT_UNAVAILABLE, IDEMPOTENCY_KEY_REQUIRED, IDEMPOTENCY_CONFLICT, REQUEST_FINGERPRINT_MISMATCH, SOURCE_UNAVAILABLE, OUTCOME_UNKNOWN, RESTORE_INCOMPLETE, DISPOSITION_PARTIAL, RATE_LIMITED, PAYLOAD_TOO_LARGE, UNSUPPORTED_MEDIA_TYPE, SCHEMA_INVALID and INTERNAL_ERROR.

Transport status codes do not define operation outcome or retry safety. Exact mapping is an API-gateway decision and remains UNCONFIRMED.

## 8. Reconciliation query contract

A reconciliation request identifies one tenant-scoped operation or request and proves caller authorization. It returns stable operation/request identity, current state and state version, authoritative transition time and trusted-time provenance, request fingerprint and idempotency namespace reference, committed evidence references, transaction/outbox references and delivery status, certainty classification, required next action and audit reference.

Reconciliation is read-only. It cannot execute, re-upload, commit, delete or promote state. It must not expose cross-tenant existence, raw queue payloads, credentials or storage locators.

## 9. Required conformance and fault-injection tests

Before production acceptance, test concurrent same-key/same-fingerprint convergence; same-key/different-fingerprint conflict; tenant namespace isolation; lost responses after stage, verification, commit and outbox publication; commit uncertainty; STAGED_VERIFIED versus COMMITTED; quarantine access denial; safe disposition retry and partial replica outcomes; authorization revocation between retries; secret-free errors; audit outage; read-only reconciliation; and clock/event-order ambiguity returning UNKNOWN rather than inferred success.

Synthetic tests prove only a reference model. Production acceptance requires concurrency/crash tests against approved persistence and storage owners, plus independent review.

## 10. Owner acceptance register

All remain UNCONFIRMED: API/service owner and gateway contract; identity and FORTRESS adapter; transaction owner and operation/outbox API; metadata and content-store owners; idempotency persistence and reconciliation authority; audit durability/acknowledgement semantics; retention, legal hold and disposition authority; trusted time; quotas, timeouts, retries and SLOs; security review and release authority.

## 11. Current disposition

This is a proposed operational contract. It does not authorize production code, infrastructure, credentials, database initialization, migrations, writes, DNS, deployment, spending, merge or runtime activation.
