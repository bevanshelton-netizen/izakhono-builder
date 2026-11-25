# IZAKHONO AI Workforce — Service Identity and Owner Decision Contract v1.0

**Status:** Proposed contract and decision record; owner acceptance required  
**Parent:** `IZAKHONO-AI-WORKFORCE-CONTRACTS-V1.md`  
**Scope:** Service identity, FORTRESS decision verification, approval binding, revocation and accountable service ownership.  
**Implementation status:** Design only. This document does not assert that an issuer, verifier, registry, key service, runtime adapter or production integration is deployed.

## 1. Purpose and binding rule

Phase 1 cannot safely progress from interface examples to implementation until the system can distinguish a human acting through an authenticated session from a service or workload acting under its own identity. It must also be possible to prove which owner accepted each authority boundary.

The governing rule is:

> A human session is not a workload credential. A workload credential is not a human approval. A policy decision is not proof of execution.

No component may infer one of these facts from another. NODE01 remains the logical orchestration identity; it is not a physical HOST, execution runner, human principal or blanket service credential.

## 2. Identity classes

| Identity class | Represents | Valid use | Does not prove |
|---|---|---|---|
| Human principal | A person authenticated by an approved identity/session service | Attribute operator intent and eligible approval actions | Independent legal identity verification unless a separate verified assertion exists |
| Human session | A time-bounded authenticated session for a human principal | Authenticate interactive requests within issuer, audience, tenant and session scope | Workload identity, approval of a specific action, or HOST execution |
| Service identity | A named IZAKHONO service acting without a human session | Authenticated service-to-service requests within an explicit service scope | A human decision or unrestricted tenant access |
| Workload identity | A registered running workload instance, such as an agent worker or execution adapter | Authenticate a particular workload and its environment to an accepted audience | Agent ownership, human approval, policy permission or actual success of a requested operation |
| Agent identity | A durable tenant-scoped registered agent record | Identify the managed agent and its version, owner and lifecycle | Runtime presence, capability verification or execution authority |
| Provider identity | An external provider account/model/adapter identity | Attribute provider-side operations and provider capability | IZAKHONO authorization or control of provider internals |
| Execution-environment identity | The separately registered HOST/environment that receives commands | Bind execution receipts and enforcement acknowledgements to the actual environment | That a request was authorized unless the FORTRESS decision is also validated |

## 3. Service-to-service authentication contract

The service identity owner and FORTRESS owner must select and document the accepted authentication profile before implementation. The profile must specify all of the following.

### 3.1 Issuer and audience

- A stable, explicitly allowlisted issuer identifier.
- A distinct audience for each receiving service or narrowly defined service class.
- Exact subject semantics: service identity and, where relevant, workload-instance identity.
- Tenant and organization claims only where the issuer is authoritative for that relationship.
- Issued-at, not-before and expiry claims with bounded lifetime.
- Unique token or assertion identifier and replay controls appropriate to the protocol.
- Key identifier and cryptographic algorithm allowlists; reject algorithm substitution and unsigned tokens.
- Explicit token type/profile so a human session cannot be substituted for a service credential.

A receiver must validate issuer, audience, signature, key status, subject, token type, time bounds, tenant scope and required workload claims. It must not trust caller-supplied identity headers or body fields as authentication.

### 3.2 Workload registration

A workload identity is accepted only when it resolves to a current registration containing:

- immutable workload identity and owning service;
- tenant/organization scope, where applicable;
- agent ID and agent version, where applicable;
- RuntimeBinding and execution-adapter references;
- environment identity and permitted audience;
- credential issuer and authentication profile;
- registration state, evidence reference, expiry/renewal and revocation state.

A registration record is not proof that the workload is currently running. Runtime health is a separate, timestamped observation. Neither registration nor health grants permission.

### 3.3 Key lifecycle

The issuer owner must document key generation, custody, access control, rotation, overlap, revocation, compromise response and audit. Private signing keys must not be embedded in source, agent packages, logs or portable AgentSync exports.

Verifiers must support an approved key-set distribution and cache policy. Unknown key IDs, revoked keys, invalid signatures, unsupported algorithms and ambiguous key rollover fail closed for consequential operations. Emergency key compromise must have a tested invalidation path and must not depend on the compromised issuer continuing to cooperate.

### 3.4 Human identity remains separate

Human approvals must be attributed to a verified authenticated human principal and an eligible approver policy. A service may relay an approval request but may not manufacture the approver identity or convert its own service token into human approval.

Where independent human identity verification is required, record the verification provider, issuer, subject reference, purpose, result, verification time, expiry and revocation status. Do not retain identity documents or biometric material merely because a verification assertion exists.

## 4. FORTRESS authorization decision: online and signed-artifact profiles

FORTRESS remains the single policy authority. The service owner must explicitly select one primary decision-verification profile and document any permitted fallback.

### Profile A — Online decision reference

1. The enforcement service authenticates itself using its accepted service identity.
2. It submits the complete canonical request context to FORTRESS.
3. FORTRESS evaluates current policy, approval state, actor eligibility, tenant scope and revocation state.
4. FORTRESS returns a decision ID, decision, policy version, request fingerprint, audience, constraints and validity window.
5. Before execution, the enforcement boundary validates the decision with FORTRESS or an approved authoritative decision-verification endpoint.
6. If the verification endpoint is unavailable, consequential execution is denied or remains pending/unknown. A cached ALLOW is not silently treated as current.

A decision ID is a reference, not a bearer credential.

### Profile B — Signed, short-lived decision artifact

A signed artifact may be used only if FORTRESS and the receiving enforcement owner jointly approve its exact format and verification profile. It must bind at minimum:

- issuer and token/artifact type;
- decision ID and policy ID/version;
- authenticated actor identity and actor class;
- tenant and organization;
- agent ID and immutable agent-version reference;
- task and attempt identifiers, when applicable;
- action, resource, tool, purpose and data classification;
- execution audience, RuntimeBinding and environment identity;
- canonical request fingerprint and constraints;
- issued-at, not-before and FORTRESS-selected expiry;
- unique artifact ID, key ID and signature;
- approval reference and approval fingerprint, when required;
- revocation/checkpoint reference or the approved online revocation mechanism.

The caller may request a maximum lifetime but cannot choose the issued expiry. FORTRESS chooses the actual not-before and expiry according to policy. The artifact must be bound to one audience and one canonical request fingerprint; it cannot be replayed for a changed task, tenant, tool, resource, environment or action.

A signed artifact does not eliminate revocation. The owner must define how a verifier learns about revoked decisions, approvals, principals, workloads and signing keys during the artifact lifetime. If that mechanism cannot meet the approved revocation objective, the artifact lifetime must be reduced or the profile rejected.

### 4.1 Canonical request fingerprint

The fingerprint must be calculated from a versioned canonical representation of all security-relevant request fields. The canonicalization algorithm, field list, normalization rules and digest algorithm must be versioned and tested.

Do not include mutable display labels as identity. Do not omit tenant, actor, agent version, action, resource, audience, tool, environment, purpose, data classification, constraints or approval binding. A changed security-relevant field requires a new FORTRESS decision.

### 4.2 Time and expiry

- FORTRESS is authoritative for decision issue time and expiry.
- Verifiers use a trusted clock and an owner-approved maximum clock-skew allowance.
- Reject not-yet-valid and expired decisions; do not extend expiry locally.
- Long-running tasks require an explicit renewal/re-authorization protocol before the current grant expires.
- Renewal is a new FORTRESS decision, not a silent extension of an existing artifact.
- A task may not continue consequential actions merely because it began while a decision was valid.

### 4.3 Revocation and policy change

The owner must define revocation propagation and maximum detection delay for:
- principal/session revocation;
- service/workload credential revocation;
- agent or RuntimeBinding isolation/revocation;
- approval revocation;
- decision/artifact revocation;
- signing-key compromise;
- tenant suspension and policy-version replacement.

For consequential actions, stale or unavailable revocation state fails closed unless a separately approved, bounded offline verification profile explicitly covers the operation. Policy changes that invalidate a decision require re-evaluation; a policy version string alone does not prove that the decision remains acceptable.

## 5. Human approval contract

An approval is a separate governance record, never a boolean in a task payload.

Minimum fields:
- approval ID and lifecycle state;
- human principal and authenticated session evidence;
- approver eligibility/delegation policy version;
- tenant and organization;
- canonical request fingerprint;
- agent/version, task, action, resource, tool and environment scope;
- purpose and data classification;
- decision time, expiry, revocation state and reason reference;
- FORTRESS policy version and audit/evidence reference.

Lifecycle:

`REQUESTED → PENDING → APPROVED | DENIED | EXPIRED | REVOKED`

Approval must be denied if the approver is the acting agent, the service identity, an ineligible principal, or an unauthorized delegate. Approval is single-scope and cannot be replayed against a different fingerprint. An approval does not bypass a subsequent FORTRESS policy denial.

## 6. Decision and enforcement state semantics

The system must keep these states distinct:

| State | Meaning |
|---|---|
| REQUESTED | A caller asked for an operation |
| AUTHENTICATED | Caller identity was validated for this receiver |
| AUTHORIZED | FORTRESS decision was validated for this exact request |
| APPROVAL_PENDING | Required human approval has not completed |
| DISPATCHED | An authorized request was sent to the registered executor |
| EXECUTION_ACKNOWLEDGED | The authenticated executor acknowledged the request |
| EFFECT_VERIFIED | The required postcondition was independently observed |
| PARTIAL | Some required enforcement points did not acknowledge |
| UNKNOWN | Evidence is unavailable or contradictory |
| DENIED | Authentication, policy, approval, registration or verification failed |

A successful HTTP response, callback returning true, queue insertion, process health, NODE01 task completion or provider response alone must not be represented as EFFECT_VERIFIED.

## 7. Owner decision register

The following decisions require named accountable owners. Until accepted, the item remains **UNCONFIRMED** and its dependent production capability remains blocked.

| Decision | Accountable owner | Required decision/evidence | Current status |
|---|---|---|---|
| Canonical Agent Registry service boundary | IZAKHONO architecture/service owner | Named service, API boundary, lifecycle authority and integration ownership | UNCONFIRMED |
| Registry persistence and migrations | Database/platform owner | Authoritative store, tenant isolation, transaction/outbox design, migration runner and recovery owner | UNCONFIRMED |
| Human principal issuer | FORTRESS Identity owner | Deployed issuer/audience, key validation, tenant mapping, session revocation evidence | UNCONFIRMED |
| Service/workload issuer | FORTRESS security/identity owner | Accepted service-auth profile, subject semantics, key custody/rotation and workload binding | UNCONFIRMED |
| Authorization decision profile | FORTRESS policy owner | Online or signed-artifact profile, schema, canonical fingerprint, expiry, constraints and verifier | UNCONFIRMED |
| Revocation service objective | FORTRESS policy/security owner | Revocation sources, propagation objective, cache rules, outage behaviour and test evidence | UNCONFIRMED |
| Human approval service | FORTRESS governance owner | Approver eligibility, delegation, fingerprint binding, expiry/revocation and audit contract | UNCONFIRMED |
| Runtime registration | Runtime Fabric owner | Authoritative registration schema, tenant/workload binding, health TTL and revocation evidence | UNCONFIRMED |
| HOST execution identity and receipt | HOST/platform execution owner | Actual runner identity, environment attestation, command authentication, signed receipt and cancellation evidence | UNCONFIRMED |
| Atomic evidence boundary | Persistence/evidence owner | State-plus-evidence transaction/outbox, durability acknowledgement, retention and restore evidence | UNCONFIRMED |

A decision becomes ACCEPTED only when the named owner, decision date, approved contract version, evidence references, limitations and test results are recorded. An informal discussion, code comment, successful local mock or documentation example is not acceptance.

## 8. Owner acceptance record template

Copy and complete one record per decision. Do not fill in an owner or evidence reference by inference.

- Decision ID:
- Decision area:
- Accountable owner name/team:
- Owner authority/source:
- Decision: ACCEPT / REJECT / DEFER
- Approved contract/profile and version:
- Accepted issuer, audience, subject and tenant semantics (where applicable):
- Expiry, clock-skew and renewal limits:
- Revocation source and maximum detection delay:
- Key custody, rotation and compromise procedure:
- Outage/fail-closed behaviour:
- Data classification and retention constraints:
- Required enforcement point:
- Required negative and recovery tests:
- Evidence references (deployment/configuration/test/audit):
- Known limitations and residual risks:
- Decision date and review/expiry date:

No production implementation proceeds on a DEFER, missing owner, missing evidence, or unresolved disagreement between FORTRESS and the consuming enforcement owner.

## 9. Required isolated contract tests

These are proposed test cases. They are not represented as executed.

| ID | Scenario | Required result |
|---|---|---|
| SID-001 | Human session presented to a service-only audience | Reject token-type/audience mismatch |
| SID-002 | Service token presented as a human approver | Reject; no approval created |
| SID-003 | Unknown issuer or wrong audience | Reject before application action |
| SID-004 | Caller-supplied tenant header conflicts with authenticated claims | Reject and emit tenant-safe evidence |
| SID-005 | Workload is not registered or registration is stale | Deny consequential dispatch |
| SID-006 | Logical NODE01 identity is substituted for HOST environment identity | Reject binding |
| SID-007 | Invalid signature, unsigned artifact or disallowed algorithm | Reject |
| SID-008 | Unknown, revoked or compromised signing key | Reject |
| SID-009 | Artifact not-before is in the future or expiry has passed | Reject; no local extension |
| SID-010 | Caller supplies a longer expiry than policy permits | FORTRESS-selected expiry wins or request is denied |
| SID-011 | Request fingerprint differs by tenant, agent version, action, tool or environment | Reject artifact/approval replay |
| SID-012 | Approval is revoked after decision issue | Reject at enforcement point |
| SID-013 | Principal or workload revoked during artifact lifetime | Reject within approved revocation objective |
| SID-014 | FORTRESS unavailable under online profile | Deny or remain pending/unknown; no cached ALLOW |
| SID-015 | Revocation source unavailable and no approved offline profile exists | Fail closed |
| SID-016 | Policy version changes and invalidates the decision | Require fresh authorization |
| SID-017 | Long-running task reaches grant expiry | Stop further consequential actions pending re-authorization |
| SID-018 | Service attempts to self-approve or approve for an ineligible principal | Reject and audit |
| SID-019 | Executor callback returns true without authenticated execution receipt | Do not advance to EXECUTION_ACKNOWLEDGED |
| SID-020 | Executor receipt has wrong audience, environment, task or decision binding | Reject receipt; state remains UNKNOWN/FAILED |
| SID-021 | Key rotation overlap uses an unapproved old key | Reject according to approved key status |
| SID-022 | Duplicate request with same idempotency key and same fingerprint | Return original operation outcome safely |
| SID-023 | Duplicate request with same idempotency key and different fingerprint | Reject with IDEMPOTENCY_CONFLICT |
| SID-024 | Audit/evidence acknowledgement unavailable for a policy-required operation | Do not report EFFECT_VERIFIED |

A production-grade harness must use deterministic clocks, synthetic keys and isolated fixtures. It must test issuer and verifier behaviour independently, include tampered artifacts and concurrency/replay cases, and assert no prohibited side effects. Test fixtures are not production credentials or deployment evidence.

## 10. Phase gate

**Permitted now**
- Review and amend these proposed contracts.
- Obtain named owner decisions and evidence.
- Add isolated synthetic fixtures and deterministic tests.
- Map current source interfaces without activating services or changing production state.

**Not authorized by this document**
- Creating or migrating production registry tables.
- Changing FORTRESS identity, policy or key configuration.
- Issuing production service/workload credentials.
- Registering or activating a HOST execution adapter.
- Replacing NODE01 Tool Fabric authorization in a live runtime.
- Enabling consequential AI Workforce execution.
- Claiming production readiness, security certification or verified provider parity.

**Exit criterion:** every applicable owner decision is accepted; issuer and verifier profiles are implemented and independently tested; authorization, approval, revocation and HOST receipt tests pass; persistence/evidence atomicity and tenant isolation are evidenced; and the authorized release process separately approves deployment.

Until then, Phase 1 remains contract design and review only.
