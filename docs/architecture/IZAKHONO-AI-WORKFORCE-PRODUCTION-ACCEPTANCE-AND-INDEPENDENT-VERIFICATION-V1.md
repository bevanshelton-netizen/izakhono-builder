# IZAKHONO AI Workforce — Production Acceptance and Independent Verification v1.0

**Status:** Proposed acceptance protocol; owner approval and implementation evidence required  
**Parent:** AI Workforce architecture and interface contracts v1  
**Scope:** Cross-component evidence correlation and independent acceptance. This document does not assert a production verifier, evidence store, signing service, execution adapter or deployment exists.

## 1. Governing rule

A consequential operation is accepted only when an independent verifier can establish that the operation, authorization, approval (when required), runtime binding, execution receipt, evidence and canonical event refer to the same authorized action and its actual outcome.

A set of valid-looking records is not sufficient. Their signatures, issuers, scope, time bounds, references and content digests must be verified, and their cross-record relationships must agree.

The verifier is an evidence evaluator, not an authority that creates permissions. FORTRESS remains the sole policy and approval authority. Runtime Fabric remains the workload state/scheduling owner. The registered HOST adapter remains the execution evidence issuer for HOST actions. The persistence/evidence owner remains responsible for durable records.

## 2. Acceptance bundle

For each consequential operation, assemble an immutable, versioned acceptance bundle containing references (not copied secrets or unnecessary personal data) to:

1. **Operation record:** operation ID, tenant and organization, actor, agent/version, task/attempt, action/resource/tool, canonical request fingerprint, idempotency key, lifecycle state and timestamps.
2. **FORTRESS decision:** authoritative decision ID, issuer, audience, actor, tenant, agent/version, action/resource/tool, environment/runtime binding, request fingerprint, policy version, constraints, issue/not-before/expiry times and revocation status.
3. **Human approval:** required only where policy says so; authoritative approval ID, eligible human principal/session context, approver policy, exact request fingerprint, scope, expiry and revocation status. Absence is valid only when the verified FORTRESS decision says approval was not required.
4. **Runtime binding:** authoritative registration ID, tenant/workload, logical runtime identity, adapter identity/version, separate execution-environment identity, registration state, health freshness, credential reference status and revocation status.
5. **Execution receipt:** authenticated issuer, HOST adapter identity, environment, operation/task/attempt, tenant, agent/version, action/tool, FORTRESS decision and approval references, request fingerprint, start/end times, outcome, output digest, cancellation/residual-work status and receipt signature.
6. **Evidence manifest:** evidence IDs, tenant and operation scope, source, capture time, classification, immutable object reference, digest algorithm/value, encryption/key version, retention class and independent verification status.
7. **Canonical event/outbox record:** event ID, schema, tenant, operation, correlation/causation, idempotency key, decision/approval references, payload digest, evidence reference and durable commit/outbox status.
8. **Independent audit checkpoint:** checkpoint ID, covered event/sequence range, root digest, signer/key ID, signature, trusted timestamp, storage/retention reference and independent verification result.

The bundle contains opaque references and digests. It must not contain credentials, access tokens, session cookies, private keys, raw identity documents or provider-hidden memory.

## 3. Canonical binding rules

The verifier must reject the bundle if any security-relevant binding differs across records:

- tenant and organization;
- operation ID and immutable request fingerprint;
- actor identity and actor class;
- agent ID and immutable agent-version reference;
- task and attempt IDs where applicable;
- action, resource, tool, purpose and data classification;
- FORTRESS decision and approval references;
- execution audience, RuntimeBinding, adapter and physical execution environment;
- idempotency key and correlation/causation chain;
- evidence IDs, object references and content digests;
- event ID, outbox event and audit checkpoint coverage.

The canonical request fingerprint must be computed using an approved, versioned canonicalization specification. The verifier must not trust a caller-supplied fingerprint merely because multiple records repeat it. It must recompute the fingerprint from the authoritative security-relevant request fields and compare the result with the FORTRESS artifact and all dependent records.

Human-readable names and labels are display metadata, not identity keys. NODE01 is a logical runtime identity and cannot substitute for the separately registered execution environment or HOST adapter identity.

## 4. Independent verification sequence

The acceptance verifier performs these checks in order:

1. **Bundle integrity:** validate schema/version, required references, duplicate IDs and manifest digest.
2. **Source authenticity:** independently resolve trusted issuer/key metadata and verify signatures/checkpoints. Test callbacks and self-asserted booleans are not production trust anchors.
3. **Freshness and revocation:** validate trusted time, not-before/expiry, key status, principal/workload/agent/runtime revocation, approval revocation and the approved maximum revocation detection delay.
4. **Request reconstruction:** retrieve authoritative immutable request fields and recompute the canonical fingerprint.
5. **FORTRESS decision:** verify issuer, audience, actor, tenant, organization, agent/version, action, resource, tool, purpose, classification, constraints, policy version, fingerprint and validity window.
6. **Approval:** establish whether approval was required. If required, verify independent human principal, approver eligibility, separation of duties, fingerprint/scope, expiry and revocation. A service identity or agent cannot stand in for a human approver.
7. **Runtime registration:** verify active registration, tenant/workload binding, adapter identity, separate environment identity, health TTL and revocation. Health alone is not registration or authorization.
8. **Execution receipt:** verify authenticated HOST adapter signature and exact binding to the authorized operation, attempt, decision, approval, runtime and environment. A NODE01 orchestration receipt or generic callback is not proof of HOST execution.
9. **Evidence:** independently retrieve each referenced evidence object under access controls, verify its digest and classification metadata, confirm tenant/operation scope and retention status, and ensure the evidence is not missing, substituted or mutable.
10. **Event and transaction:** verify the canonical event/outbox references, durable commit acknowledgement and operation/evidence/outbox transaction evidence. Confirm duplicate delivery did not create a second logical operation.
11. **Audit checkpoint:** verify checkpoint signature, signer authorization, covered event range/root digest, trusted timestamp, retention and independent access path.
12. **Outcome classification:** assign an evidence-backed result; never infer success from missing telemetry, HTTP status, queue insertion or an unverified callback.

The verifier must obtain evidence from authoritative sources independently of the component whose action is being assessed wherever practical. A component must not be the sole issuer and sole verifier of its own consequential claim.

## 5. Acceptance outcomes

| Outcome | Meaning | Permitted interpretation |
|---|---|---|
| VERIFIED_EFFECT | All required records and signatures verify; scope is consistent; execution receipt and required postcondition evidence prove the effect | The defined effect is verified for the stated scope and time |
| VERIFIED_FAILURE | Authentic, scope-matched evidence proves the operation failed or was rejected | Failure is established; no success claim |
| PENDING | Required evidence or external acknowledgement is still expected within policy bounds | Not complete; continue controlled reconciliation |
| UNKNOWN | Evidence is absent, stale, contradictory, unverifiable or outside approved trust bounds | No success or failure claim; restrict consequential continuation |
| REJECTED | Authorization, approval, tenant, identity, runtime or integrity validation failed | No dispatch or acceptance |
| PARTIAL | Only some required enforcement points or effects are verified | Report exact verified and unverified portions; maintain restricted state |

A receipt that proves command acceptance does not necessarily prove the requested postcondition. Where policy requires effect verification, the bundle must include an independent observation of that postcondition. If a command is non-idempotent and its outcome is UNKNOWN, do not blindly retry it; reconcile first.

## 6. Trust separation and verifier independence

The production verifier must have:

- a separately approved service identity and narrowly scoped read-only evidence access;
- independently managed trust roots/key distribution and a documented trust-store update/revocation process;
- trusted time and a defined clock-skew policy;
- access to authoritative FORTRESS decision/approval status and revocation information;
- read access to the authoritative operation store, Runtime Fabric registration, HOST receipt source, evidence store and audit checkpoints;
- append-only verification results identifying verifier version, policy/profile version, source references, checks performed, time and limitations;
- separation between the operator who performs an operation, the human who approves it and the independent reviewer where policy requires that separation.

The verifier cannot grant capabilities, change agent state, rewrite source evidence, issue credentials or override FORTRESS. A failed verification must preserve source evidence and produce a scoped finding, not repair the evidence by mutation.

## 7. Failure and recovery matrix

| Failure | Required disposition |
|---|---|
| Decision or approval revoked before dispatch | Reject dispatch |
| Revocation source unavailable beyond approved bound | Fail closed; pending/unknown only if explicitly allowed by policy |
| Tenant, fingerprint, action, audience or environment mismatch | Reject; preserve evidence and raise security finding |
| Runtime health stale or binding revoked | Do not dispatch new consequential work |
| HOST receipt absent after uncertain dispatch | UNKNOWN; reconcile before any retry |
| Receipt signature or issuer invalid | Reject receipt; execution outcome remains UNKNOWN |
| Evidence object missing or digest mismatch | UNKNOWN/REJECTED according to policy; never accept effect |
| Outbox event duplicated | Deduplicate by durable event identity and consumer scope |
| Event/checkpoint chain gap or signature invalid | Reject audit completeness; escalate |
| Database commit acknowledged but outbox relay delayed | PENDING; no false completion |
| External object upload succeeded but metadata commit failed | Keep object quarantined/unreferenced; authorized orphan reconciliation |
| Independent verifier unavailable | No VERIFIED_EFFECT claim; preserve pending state |

## 8. Production acceptance gates

Before production adoption, accountable owners must provide evidence for:

- approved canonicalization and fingerprint test vectors;
- FORTRESS issuer, decision, approval, signature/key and revocation verification;
- service/workload identity and verifier identity;
- authoritative operation/evidence/outbox persistence and tenant isolation;
- transactional outbox, consumer inbox, replay and concurrency behavior;
- Runtime Fabric registration and HOST adapter identity/environment binding;
- signed execution receipts and cancellation/residual-work semantics;
- immutable evidence storage, digest verification, encryption, retention and restore;
- independent audit checkpoints, signer/key custody and retention/access segregation;
- independent verifier implementation, read-only scope, negative tests and versioned findings;
- crash/restart, duplicate, replay, stale-state, revocation, clock-skew, tampering and recovery exercises;
- named owners, migration runner, operational runbooks, incident escalation and separately authorized release approval.

Synthetic fixtures can validate contract logic but do not satisfy these gates. Production acceptance requires test evidence from the approved deployed services and enforcement boundaries.

## 9. Owner acceptance record

- Acceptance profile/version:
- Accountable architecture owner:
- FORTRESS decision/approval owner:
- Identity/key/revocation owner:
- Runtime Fabric registration owner:
- HOST execution/receipt owner:
- Operation persistence/outbox owner:
- Evidence store/retention owner:
- Independent verifier owner:
- Audit checkpoint/signing owner:
- Approved canonicalization version and test-vector reference:
- Approved trust roots/key IDs and revocation objective:
- Approved clock-skew and freshness limits:
- Tenant isolation and transaction evidence:
- Receipt and postcondition evidence references:
- Evidence digest/restore/retention evidence:
- Independent verification test report:
- Known limitations and residual risks:
- Decision: ACCEPT / REJECT / DEFER
- Decision date and review/expiry date:

No owner or evidence may be filled in by inference. A missing owner, missing proof or DEFER decision blocks the dependent production capability.

## 10. Current disposition

This protocol is a proposed review artifact only. It does not establish a production verifier, cryptographic trust root, signed HOST receipt, authoritative evidence store, atomic transaction, approved owner decision or production readiness. No database initialization/migration, credential provisioning, runtime registration, production write, deployment, DNS change or release authorization follows from this document.
