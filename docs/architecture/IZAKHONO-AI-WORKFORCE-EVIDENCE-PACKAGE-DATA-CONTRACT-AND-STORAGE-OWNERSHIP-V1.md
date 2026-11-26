# IZAKHONO AI Workforce — Evidence Package Data Contract and Storage Ownership v1.0

**Status:** Proposed logical data contract. Production service boundaries, accountable owners, storage technology, cryptographic profile, retention periods and key custody remain UNCONFIRMED.
**Parent:** Independent Audit Reproducibility Protocol v1.0; Production Acceptance and Independent Verification v1.0.
**Scope:** Define the minimum logical contract and ownership decisions needed before implementation. This document does not select a vendor, database, object store, cryptographic algorithm or retention duration.

## 1. Governing rules

1. An evidence reference identifies one immutable object version, not a mutable filename, path, URL or "latest" alias.
2. Every evidence object and reference is tenant-scoped. A globally unique identifier is not a substitute for tenant authorization.
3. A digest is an integrity check over retrieved bytes or canonical records; it is not proof of source authenticity, authorization, signer identity or truth.
4. Evidence content, evidence metadata, operation state and outbox publication have distinct responsibilities. The approved transaction owner must define how authoritative metadata and operation/outbox state commit atomically.
5. Object bytes may be staged outside that transaction, but an authoritative committed reference must never point to missing, unverified or mutable content. A failed metadata commit may leave an unreferenced quarantined object for controlled disposition.
6. Retention, legal hold, deletion, backup, restore and key lifecycle are first-class governed operations, not incidental storage settings.
7. No storage owner, migration authority or production interface is inferred from existing code or infrastructure.

## 2. Logical entities

### 2.1 EvidenceObjectVersion

One immutable byte sequence or canonical record snapshot.

Required logical fields:
- `tenant_id`: owning tenant namespace.
- `evidence_object_id`: stable opaque logical object identifier.
- `object_version_id`: immutable version identifier; never reused.
- `content_digest`: algorithm identifier, digest value and digest-input profile.
- `content_length_bytes`: exact stored byte length.
- `media_type` and `schema_id` / `schema_version`: content interpretation.
- `classification`: approved data classification.
- `created_at`: trusted capture/ingest time with source and precision metadata.
- `source_issuer`, `source_record_id`, `source_version`: provenance where applicable.
- `encryption_profile_ref`: reference to approved encryption/key policy, never key material.
- `retention_class_ref`, `legal_hold_state`: governed disposition metadata.
- `storage_locator_ref`: opaque locator resolved only by an authorized storage adapter.

The object version record must not contain credentials, private keys, access tokens, session cookies or unrelated tenant data. Sensitive evidence requires explicit classification, purpose and access policy.

### 2.2 EvidenceReference

A scoped reference embedded in operation, acceptance, audit or reproduction records.

Required logical fields:
- `tenant_id`
- `evidence_object_id`
- `object_version_id`
- `content_digest`
- `reference_purpose`
- `classification`
- `source_record_id` and `source_version`, where applicable
- `created_at`
- `request_fingerprint` and `operation_id`, where the evidence is operation-bound

A reference must resolve to exactly one object version. Resolution must verify tenant ownership, object/version identity, digest, classification, purpose authorization and retention/hold state. A resolver must reject cross-tenant references even when the caller knows a valid object ID.

### 2.3 EvidenceManifest

A versioned canonical declaration of the evidence set required for a specific bundle or reproduction package.

Required logical fields:
- `manifest_schema_id`, `manifest_schema_version`
- `manifest_id`, `tenant_id`, `operation_id`, `request_fingerprint`
- `created_at`, `created_by` (authenticated principal/service identity)
- `canonicalization_profile_ref`
- `entries`: ordered or canonically sorted list of EvidenceReference records
- `entry_count`, `total_content_length_bytes`
- `manifest_digest`: algorithm, digest and canonicalization profile
- `signing_identity_ref`, `signature_ref` (external trust resolution)
- `retention_class_ref`, `legal_hold_state`

Manifest canonicalization must define ordering, duplicate handling, Unicode normalization, number representation, timestamp precision, null-versus-absent semantics and byte encoding. The profile and algorithm identifiers are explicit; no algorithm is selected here. Duplicate object-version entries are rejected unless a future approved schema defines a distinct, justified reference purpose.

### 2.4 EvidenceDispositionRecord

An append-only record of retention, hold, access restriction, deletion or disposition decisions.

Required fields:
- tenant, object and exact version identity;
- action and reason code;
- authorized actor and approval/decision references where required;
- policy and retention-rule versions;
- effective time and trusted-time provenance;
- legal-hold status before and after;
- disposition result and evidence of completion;
- correlation, audit and idempotency identifiers.

A disposition record does not authorize deletion by itself. Enforcement requires the designated storage owner and approved dual-control policy. Legal hold blocks ordinary disposition. Any exceptional override requires a separately authorized, auditable legal/governance process.

## 3. Reference resolution contract

The evidence resolver accepts a tenant-bound principal, purpose, object ID and exact version ID. It must:
1. authenticate the caller and obtain tenant/purpose scope from the authoritative identity/policy path;
2. reject caller-supplied tenant scope that conflicts with authenticated scope;
3. resolve only the exact immutable version;
4. verify object metadata, content length and recomputed digest;
5. enforce classification, purpose, retention and legal-hold policy;
6. emit an auditable access event without exposing storage credentials or raw internal locators;
7. return bytes or a bounded, short-lived retrieval capability only if the approved interface permits it.

Missing, ambiguous, mutable, digest-mismatched, stale or cross-tenant references fail closed. A missing historical version is NOT_REPRODUCIBLE; it must not silently resolve to a newer version.

## 4. Storage and transaction ownership boundaries

The following are logical responsibilities, not assignments to existing services:

| Responsibility | Required owner decision | Current status |
|---|---|---|
| Operation state + evidence metadata/reference + outbox atomic transaction | One authoritative transaction owner | UNCONFIRMED |
| Evidence byte storage and immutable versioning | Evidence content-store owner | UNCONFIRMED |
| Manifest schema and canonicalization | Contract/schema owner | UNCONFIRMED |
| Tenant-scoped reference resolver | Evidence access-service owner | UNCONFIRMED |
| Encryption and key custody/rotation/revocation | Independent key-management authority | UNCONFIRMED |
| Retention classes, legal hold and disposition | Records/legal governance owner | UNCONFIRMED |
| Backup, restore and digest re-verification | Storage resilience owner | UNCONFIRMED |
| Migration, recovery and schema evolution authority | Named migration/recovery owner | UNCONFIRMED |
| Independent trust anchors and signature verification | Trust governance owner | UNCONFIRMED |
| Access logs, append-only audit and checkpointing | Audit/evidence owner | UNCONFIRMED |

FORTRESS remains the policy authority for access decisions; it is not thereby assumed to own evidence bytes. Runtime Fabric remains the workload/state manager; it is not thereby assumed to own the evidence store. NODE01 remains the orchestrator; it is not the evidence authority. Execution OS coordinates delivery acceptance; it does not bypass the evidence resolver or FORTRESS. These are architectural boundaries, not claims that the proposed integrations exist.

## 5. Ingest and commit lifecycle

Proposed logical sequence:
1. An authenticated producer submits a tenant-bound evidence object and declared purpose.
2. The ingest boundary validates schema, classification, size limits, source identity and prohibited content policy.
3. Bytes are written to a quarantine/staging area as a new immutable version. The store returns an opaque object/version identity.
4. The ingest service reads the stored version back and verifies byte length and digest using the approved profile.
5. A canonical manifest is assembled and validated. Required signatures and source attestations are checked by the approved trust authority.
6. The authoritative transaction commits operation state, evidence metadata/reference and outbox row atomically. The transaction binds tenant, operation, request fingerprint and manifest digest.
7. A separate relay publishes the committed outbox event with stable event identity and at-least-once delivery. Consumers deduplicate through their own durable inbox.
8. If the transaction fails, no authoritative reference or success event is published. The staged object is quarantined and later reconciled by an authorized cleanup process; cleanup must check for references and legal hold.
9. If the commit succeeds but publication acknowledgement is uncertain, retry publication with the same event identity. Do not repeat the business action.

The evidence store write and database transaction are not assumed to be one distributed atomic transaction. The design must prevent dangling authoritative references and make orphan reconciliation safe and observable.

## 6. Retention, legal hold and disposition

Retention classes must be approved by records/legal owners and mapped to evidence purpose, classification, jurisdiction and applicable obligations. No default duration is specified here.

Required states include at minimum:
- ACTIVE
- LEGAL_HOLD
- RETENTION_EXPIRED_PENDING_REVIEW
- DISPOSITION_AUTHORIZED
- DISPOSITION_IN_PROGRESS
- DISPOSED
- DISPOSITION_FAILED
- RESTORE_REQUIRED

Transitions require authenticated actor, policy version, reason, trusted time and append-only audit. Legal hold prevents ordinary expiration/deletion. A retention expiry is not itself authorization to delete. Disposition must be idempotent and report partial failures; metadata and audit history must preserve a governed tombstone or disposition proof without retaining prohibited content.

## 7. Encryption and trust separation

- Encrypt evidence in transit and at rest under an approved, documented profile.
- Keep key material outside manifests, application logs, evidence metadata and reproduction packages.
- Separate storage administration from key administration and independent audit where feasible.
- Define key identifiers, purpose, scope, rotation, revocation, recovery and historical verification policy.
- Historical reproduction must retain a valid verification path for signatures and digests without restoring revoked operational credentials.
- A package cannot nominate its own trusted roots or grant itself access to encrypted evidence.
- Encryption does not replace tenant authorization, classification controls or audit.

Algorithms, key-management product, custody model and rotation intervals remain UNCONFIRMED.

## 8. Backup, restore and integrity

Backups must preserve immutable object versions, manifests, metadata, required trust/profile/build references and disposition/audit history as a coherent recoverable set. Backup copies should be isolated across separately controlled failure domains, with access and key custody defined by approved owners.

Restore acceptance requires:
- restore into an isolated tenant-scoped validation boundary;
- exact object/version count and manifest-reference reconciliation;
- byte-length and digest recomputation for every sampled or required object under the approved restore profile;
- manifest canonicalization and signature verification;
- legal-hold and retention-state preservation;
- evidence that no cross-tenant references or access grants were introduced;
- recorded restore operator, approver, time source, source backup identity, result and exceptions.

A backup-complete signal is not proof of a successful restore. Failed or incomplete restoration leaves affected evidence unavailable and historical reproduction NOT_REPRODUCIBLE or INDETERMINATE.

## 9. Schema evolution and migration

Every manifest, object metadata and disposition schema is explicitly versioned. Compatibility rules must specify additive changes, deprecated fields, canonicalization changes, migration provenance and rollback. Never rewrite an immutable historical object version in place. A transformation creates a new object version with a new digest and a provenance link to the source version.

Production migrations require an approved owner, reviewed migration plan, tested backup/restore, tenant-isolation verification, rollback/reconciliation plan and explicit authorization. This proposal authorizes no database initialization, migration, storage provisioning or production write.

## 10. Minimum acceptance tests

Before production consideration, test:
- canonical manifest bytes and digest stability across implementations;
- duplicate, missing, malformed and reordered manifest entries;
- exact immutable version binding and rejection of mutable aliases;
- cross-tenant resolver denial and tenant-scope substitution;
- object byte mutation, length mismatch and digest mismatch;
- source/provenance/signature failure and untrusted trust roots;
- staged object plus transaction failure, orphan quarantine and safe cleanup;
- committed reference plus delayed/duplicate outbox publication;
- legal hold, retention expiry, authorized disposition and partial failure;
- backup restore with missing, substituted, corrupted and cross-tenant objects;
- key rotation/revocation with historical verification and no operational credential resurrection;
- schema upgrade, rollback and immutable historical version preservation;
- audit completeness and independent reproduction after restore.

## 11. Accountable owner decision register

All entries require named accountable owners, accepted interfaces and evidence; none is assigned by this document.

- Operation/evidence metadata/outbox transaction owner: UNCONFIRMED
- Evidence byte-store owner: UNCONFIRMED
- Manifest/schema/canonicalization owner: UNCONFIRMED
- Evidence resolver and tenant-isolation owner: UNCONFIRMED
- FORTRESS policy integration owner: UNCONFIRMED
- Key custody and cryptographic governance owner: UNCONFIRMED
- Retention/legal-hold/disposition owner: UNCONFIRMED
- Backup/restore/resilience owner: UNCONFIRMED
- Migration and recovery authority: UNCONFIRMED
- Independent audit/trust owner: UNCONFIRMED
- Retention classes and periods: UNCONFIRMED
- Maximum object size, supported media/schema and ingest limits: UNCONFIRMED
- Approved encryption, digest and signature profiles: UNCONFIRMED
- Production decision: ACCEPT / REJECT / DEFER (not selected)

## 12. Current disposition

This is a proposed logical data contract and ownership register only. It does not establish a production evidence service, object store, database schema, transaction implementation, key-management system, retention policy, backup service, migration authority or operational integration. Existing repository code is not treated as proof of ownership or production readiness. No credentials, infrastructure spending, database initialization, migrations, deployments, DNS changes, production writes or merge are authorized.
