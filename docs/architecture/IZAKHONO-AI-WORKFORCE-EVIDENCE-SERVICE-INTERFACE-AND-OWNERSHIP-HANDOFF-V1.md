# IZAKHONO AI Workforce — Evidence Service Interface and Ownership Handoff v1.0

**Status:** Proposed interface and operational contract. No production service, endpoint, identity integration, storage implementation or owner is confirmed.
**Depends on:** Interface Contracts v1.0; Evidence Package Data Contract and Storage Ownership v1.0; Production Acceptance and Independent Verification v1.0; Independent Audit Reproducibility Protocol v1.0.

## 1. Purpose and boundary

This document defines the service-to-service boundary for evidence ingest, manifest creation, exact-version resolution, retention/disposition, restore verification and independent audit retrieval. It does not create a new authorization authority, event bus, scheduler or parallel evidence database.

- **FORTRESS** remains the sole policy authority. It authorizes the requesting principal, tenant, purpose, resource, action and scope. The evidence service enforces the decision at its boundary; it does not invent or reinterpret policy.
- **Evidence Service** is a proposed logical service boundary for evidence metadata, immutable version references, ingest orchestration and authorized resolution. Its accountable production owner is UNCONFIRMED.
- **Evidence Content Store** is the proposed byte-storage boundary. It must provide immutable version identity and verifiable retrieval. Its technology and owner are UNCONFIRMED.
- **Authoritative Transaction Owner** commits operation state, evidence metadata/reference and outbox event under the accepted atomicity contract. Owner and interface are UNCONFIRMED.
- **Runtime Fabric / NODE01** may request or coordinate evidence capture through approved adapters; neither becomes evidence authority by orchestration.
- **Independent Verifier / Auditor** obtains separately authorized read-only access to evidence and authoritative source records. It cannot mutate evidence, authorize business actions or override FORTRESS.

All service names and routes below are logical proposals, not deployed endpoints.

## 2. Trust and request context

Every request must be authenticated using an approved service or human identity profile. The receiver derives actor, tenant, organization, issuer, authentication context and permitted audiences from verified identity material and authoritative policy—not from caller-supplied headers.

Required request context:
- request and correlation identifiers;
- authenticated principal/workload identity reference;
- tenant and organization as consistency assertions;
- action and resource scope;
- declared purpose and data classification;
- idempotency key for writes;
- exact object/version or operation identity where relevant;
- request fingerprint for operation-bound evidence.

A tenant header is never sufficient authorization. The receiver compares it with the verified identity and FORTRESS-authorized scope. Mismatches fail closed without disclosing whether another tenant's object exists.

No request/response may carry raw storage credentials, encryption keys, provider tokens, session cookies or bearer secrets as evidence metadata. Short-lived retrieval capabilities, if eventually approved, must be audience-bound, tenant- and object-version-scoped, purpose-bound, expiry-limited and revocable. The capability must not become a substitute policy authority.

## 3. Logical API surface

The following routes illustrate responsibilities only. Exact transport, API gateway, service discovery and versioning remain UNCONFIRMED.

| Operation | Proposed route | Purpose |
|---|---|---|
| Ingest evidence | POST /v1/evidence/objects | Stage and verify a new immutable object version |
| Create manifest | POST /v1/evidence/manifests | Canonicalize and bind an evidence set |
| Resolve exact version | POST /v1/evidence/resolve | Authorize and retrieve one exact tenant-scoped version |
| Read metadata | GET /v1/evidence/objects/{id}/versions/{version} | Read authorized metadata only |
| Read manifest | GET /v1/evidence/manifests/{manifest_id} | Retrieve a specific immutable manifest |
| Record disposition request | POST /v1/evidence/dispositions | Submit a governed retention/hold/disposition action |
| Verify restore | POST /v1/evidence/restore-verifications | Record isolated restore-verification evidence |
| Auditor package read | POST /v1/evidence/audit-packages | Assemble a read-only, bounded evidence view |

No wildcard, global listing or cross-tenant search is exposed to ordinary tenant callers. Pagination cursors must bind tenant, query, authorization scope, sort order and snapshot/watermark; cursors are opaque and integrity-protected.

## 4. Ingest contract

### 4.1 Request

A proposed ingest request contains tenant and organization consistency assertions; source principal/workload identity reference (derived and verified by receiver); source component and source record/version; operation ID and immutable request fingerprint when operation-bound; evidence purpose, classification, schema ID/version and media type; declared content length and content digest profile/value; retention class reference and legal-hold assertion only as a request for policy evaluation; content bytes or a one-time staging upload reference; correlation and idempotency identifiers.

The service validates size and media limits, schema, classification, prohibited content, source provenance and authorization before accepting bytes. Approved limits and content rules are UNCONFIRMED. An ingest caller cannot self-assign a lower classification or remove a legal hold.

### 4.2 Response states

- **RECEIVED:** request accepted for validation; no durable object claim.
- **STAGING:** content write in progress.
- **VERIFYING:** read-back, length and digest checks in progress.
- **STAGED_VERIFIED:** immutable version exists and bytes verify, but no authoritative operation reference is committed.
- **COMMITTED:** metadata/reference and required operation/outbox records have been durably committed by the authoritative transaction owner.
- **REJECTED:** validation or policy failed.
- **UNKNOWN:** outcome cannot be proven; reconcile by stable idempotency and object-version identity.

STAGED_VERIFIED is not equivalent to COMMITTED. A staged object is not exposed to normal evidence consumers. A client retry with the same tenant/idempotency key and same fingerprint returns the original request state; reuse with a different fingerprint returns IDEMPOTENCY_CONFLICT.

### 4.3 Ingest sequence

1. Authenticate caller; derive tenant and actor.
2. Obtain FORTRESS authorization for evidence ingest, purpose, classification, operation and size/scope constraints.
3. Validate content declaration and source provenance.
4. Stage bytes as a new immutable object version in quarantine.
5. Read back exact version and recompute content length and digest.
6. Create and validate canonical manifest if the operation requires one.
7. Submit exact version metadata/reference and operation/outbox intent to the authoritative transaction owner.
8. Commit atomically under the approved transaction boundary.
9. Publish through the existing canonical outbox/event system at least once; consumers deduplicate.
10. If commit fails or acknowledgement is uncertain, preserve staged content as quarantined and reconcile. Do not claim committed and do not repeat the business action.

The Evidence Service must not hold a database transaction open while calling FORTRESS, the object store, HOST or an event broker. No distributed atomicity is assumed.

## 5. Exact-version resolution contract

### 5.1 Request

Required fields: authenticated principal/workload context; tenant assertion; exact evidence object ID and immutable version ID; requested purpose and resource/action; operation ID/request fingerprint where operation-bound; desired response mode (metadata only or content); correlation ID.

No latest, mutable URL, filename-only or caller-supplied storage locator is accepted as a version selector.

### 5.2 Enforcement sequence

1. Authenticate caller and derive tenant/actor.
2. Ask FORTRESS for a current, audience-bound decision over exact tenant, object/version, purpose, action, classification and operation scope.
3. Verify decision issuer, audience, signature/profile, validity, revocation and exact request binding at the service enforcement point.
4. Resolve exact metadata record using tenant + object ID + version ID.
5. Enforce classification, purpose, retention, legal hold, disposition and any legal access restrictions.
6. Retrieve exact immutable bytes from the content store using service-held, least-privilege access.
7. Recompute length and digest and compare with immutable metadata and manifest binding.
8. Emit a durable access audit event through the canonical event/outbox boundary.
9. Return authorized content or a bounded response. Never expose internal storage credentials or raw locator.

Where policy requires a durable access event before releasing content, the service must wait for that durable acknowledgement. If the audit path is unavailable, apply the approved fail-closed policy; do not silently downgrade audit requirements.

### 5.3 Response and errors

Success includes exact object/version identity, tenant scope, purpose, classification, digest profile/value, content length, provenance, verification time and an audit reference. It returns no key material.

Stable errors include AUTHENTICATION_REQUIRED, TENANT_SCOPE_DENIED, POLICY_DENIED, APPROVAL_REQUIRED, DECISION_EXPIRED, DECISION_REVOKED, EVIDENCE_NOT_FOUND (tenant-safe; no cross-tenant existence disclosure), EVIDENCE_VERSION_NOT_FOUND, EVIDENCE_DISPOSED, LEGAL_HOLD_RESTRICTION, PURPOSE_NOT_AUTHORIZED, CLASSIFICATION_BLOCKED, EVIDENCE_DIGEST_MISMATCH, EVIDENCE_CONTENT_UNAVAILABLE, AUDIT_ACKNOWLEDGEMENT_UNAVAILABLE, IDEMPOTENCY_CONFLICT, SOURCE_UNAVAILABLE and OUTCOME_UNKNOWN.

A missing historical version is never silently replaced with a newer version. It results in NOT_REPRODUCIBLE or an equivalent explicit state.

## 6. Manifest service contract

Manifest creation is deterministic under an approved, versioned canonicalization profile. The service validates each entry against authoritative tenant-scoped object/version metadata; verifies purpose, operation and request-fingerprint binding; rejects unresolved, duplicated, substituted or cross-tenant entries; sorts entries using the canonical profile; calculates entry count, total byte length and manifest digest; obtains required signature/attestation through the separately governed trust mechanism; stores the manifest as an immutable version; and records the manifest reference through the authoritative transaction boundary.

The service must not trust a caller-provided manifest digest without recomputation. Package-supplied trust roots are rejected. Canonicalization changes create a new manifest version/profile and never rewrite historical manifests.

## 7. Retention, legal hold and disposition interface

Retention class and legal-hold state are authoritative governed metadata. An ingest caller may request a class or flag a potential hold, but cannot grant, clear or override it.

A disposition request binds tenant and exact object/version; requested action and reason; applicable retention rule and policy version; actor and required separate approver; FORTRESS decision and approval references; legal-hold evaluation and trusted time; correlation/idempotency identifiers.

The service records the request and decision. Only the designated storage owner executes physical disposition under approved controls. Expiry is not automatic permission to delete. Legal hold blocks ordinary disposition. A failed or partial disposition is explicitly recorded and retried only through a safe idempotent workflow. Audit history and a governed tombstone remain according to approved rules.

## 8. Restore verification interface

Restore verification operates in an isolated validation boundary and is read-only against production evidence. It binds source backup identity and snapshot/watermark; tenant scope and exact object/version inventory; expected and restored manifest digests; content length and recomputed digest results; schema/profile and trust-store versions; retention and legal-hold state; operator and separate approver where required; trusted time, verifier build and result.

Results: VERIFIED, VERIFIED_WITH_EXCEPTIONS, FAILED, INCOMPLETE, UNKNOWN. A backup-complete event alone is not a restore pass. Restore verification never writes restored data into production. Promotion/repair requires a separately approved recovery procedure and migration authority.

## 9. Independent auditor access

The auditor receives a separately approved, tenant-scoped, read-only identity with explicit purpose, time limit and source audiences. It can retrieve exact object versions and manifests; verify content digests, provenance, signatures and checkpoint references; inspect retention/disposition and restore evidence; compare source snapshots and operation/decision/receipt/outbox records; create append-only findings and reproducibility/challenge records.

It cannot ingest, replace, amend or delete source evidence; change legal holds or retention classes; issue FORTRESS decisions or approvals; grant service access or issue credentials; run a business action or execution adapter; or edit another verifier's historical finding.

Operator, approver, storage administrator, key custodian and independent reviewer duties must be separated as required by risk and policy. Read-only is enforced at the source boundary, not merely asserted by the client.

## 10. Availability, retries and failure semantics

Unknown outcome is a first-class state. Never translate timeout into failure or success. Writes use tenant-scoped idempotency keys bound to immutable request fingerprints. Reads are exact-version and safe to retry; every retry re-evaluates current authorization. A revoked/expired FORTRESS decision blocks new retrieval even if a previous request was authorized. Evidence bytes staged but not committed remain quarantined. A committed reference whose content cannot be retrieved is an integrity/availability incident; never replace it with a different version. Duplicate outbox delivery is expected and must be idempotent. Partial disposition and restore results remain explicit; no success summary may hide failed objects. Rate limits, maximum payload sizes, timeouts, retry windows, RPO/RTO and service-level objectives remain UNCONFIRMED and require owner approval.

## 11. Accountable ownership handoff

| Responsibility | Required accountable owner | Acceptance evidence | Status |
|---|---|---|---|
| FORTRESS policy contract and decision verification | FORTRESS security/policy owner | issuer/audience/key/revocation tests at enforcement boundary | UNCONFIRMED |
| Evidence API/service boundary | Evidence service owner | deployed interface, threat model, operational runbook | UNCONFIRMED |
| Immutable content store | Evidence storage owner | exact-version, immutability, durability and retrieval tests | UNCONFIRMED |
| Metadata + operation + outbox transaction | Authoritative persistence owner | isolation/uniqueness/crash/concurrency evidence | UNCONFIRMED |
| Manifest schema/canonicalization | Contract governance owner | cross-implementation canonical test vectors | UNCONFIRMED |
| Encryption/key custody | Independent key-management owner | key lifecycle, rotation/revocation and recovery evidence | UNCONFIRMED |
| Retention/legal hold/disposition | Records/legal governance owner | approved retention schedule and dual-control runbook | UNCONFIRMED |
| Backup/restore | Storage resilience owner | isolated restore and digest verification report | UNCONFIRMED |
| Independent auditor/verifier | Independent assurance owner | separate read-only identity and reproducibility report | UNCONFIRMED |
| Canonical event/outbox/audit | Event/audit owner | durable append-only event and checkpoint evidence | UNCONFIRMED |
| Migration and recovery authority | Named migration/recovery owner | approved plan, backup, rollback and explicit authorization | UNCONFIRMED |

A role name is not an accountable owner. Acceptance requires a named accountable party, approved service boundary, signed decision record and test evidence. No owner is inferred from repository paths, existing schemas or process availability.

## 12. Production acceptance gates

No production implementation proposal is ready until all accountable owners and interfaces are accepted; FORTRESS authorization and revocation are verified at the evidence enforcement boundary; tenant isolation is tested against actual deployed identities and storage; immutable object/version and canonical manifest behavior is demonstrated; operation/evidence/outbox atomicity, idempotency and crash recovery are proven; legal hold, retention, disposition and audit obligations are approved; encryption/key custody and historical verification are accepted; backup restore and independent audit reproduction pass; operational monitoring, incident response, service objectives and recovery ownership are approved; and a separately authorized release decision is recorded.

Synthetic tests and architecture documents do not satisfy these gates.

## 13. Machine-readable contract artifact

The proposed JSON Schema is located at
`schemas/ai-workforce/evidence-contracts-v1.schema.json`. It defines shared
evidence references, exact-version resolve request/response and manifest
shapes. Its namespace is illustrative, not a deployed endpoint or public
schema registration. The schema provides structural validation only; runtime
validation must additionally enforce FORTRESS authorization, tenant isolation,
cross-record binding, digest recomputation, canonicalization, trusted time,
revocation and audit acknowledgement. The selected digest/signature algorithms
and canonicalization profile remain UNCONFIRMED.

## 14. Current disposition

This is a proposed service interface and ownership handoff only. It does not establish a deployed API, service identity, object store, database, transaction owner, cryptographic trust root, retention policy, auditor account, operational SLA or production readiness. No credentials, provisioning, database initialization, migration, production write, deployment, DNS change, infrastructure expenditure, merge or runtime activation is authorized.
