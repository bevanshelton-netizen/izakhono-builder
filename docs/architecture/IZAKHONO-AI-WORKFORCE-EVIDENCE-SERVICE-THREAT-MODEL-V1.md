# IZAKHONO AI Workforce — Evidence Service Threat Model v1.0

**Status:** Proposed threat model for design review. No production deployment, penetration test or security certification is claimed.
**Scope:** Evidence ingest, immutable object storage, manifest creation, exact-version resolution, disposition, restore verification and independent audit access.
**Related contracts:** Evidence Package Data Contract and Storage Ownership v1.0; Evidence Service Interface and Ownership Handoff v1.0; Production Acceptance and Independent Verification v1.0.

## 1. Security objectives

The service must preserve:
- confidentiality: evidence is accessible only to authenticated, tenant-scoped principals for an authorized purpose;
- integrity: retrieved bytes and metadata are bound to an immutable object version and verified digest;
- authenticity: source, issuer and signature claims are validated against independently governed trust;
- accountability: access, ingest, disposition, restore and verification actions are durably attributable;
- availability: failures are explicit and recoverable without silently substituting evidence;
- tenant isolation: identifiers, indexes, caches, cursors, backups, search and restore cannot cross tenant boundaries;
- governance: FORTRESS remains the only policy authority; the service cannot mint approvals or self-grant access.

A digest alone proves neither authenticity nor truth. A signature alone does not prove that a signer was authorized for the asserted purpose. An audit log alone does not prove that a physical action occurred.

## 2. System and trust boundaries

### Actors
- Tenant human principal.
- Registered workload/service principal.
- Evidence producer (agent, NODE01, Runtime Fabric or authorized HOST adapter).
- FORTRESS policy authority.
- Evidence API/service.
- Evidence metadata and transaction owner.
- Immutable content store.
- Key/trust administration.
- Records/legal governance.
- Independent verifier/auditor.
- Storage, platform and incident operators.

### Protected assets
- Evidence bytes and exact object versions.
- Tenant, operation, request-fingerprint and provenance metadata.
- Manifests, signatures, trust references and audit checkpoints.
- FORTRESS decisions, approvals and revocation state.
- Encryption keys and service credentials.
- Retention schedules, legal holds and disposition records.
- Backup snapshots, restore inventory and independent findings.

### Boundaries requiring explicit enforcement
1. Caller to API gateway/service authentication.
2. Service to FORTRESS decision and revocation verification.
3. Evidence service to metadata/transaction store.
4. Evidence service to object storage.
5. Service to key-management boundary.
6. Outbox/event delivery to consumers.
7. Auditor identity to source systems and evidence store.
8. Operator/admin access to storage, keys, backups and logs.
9. Backup/restore boundary and production environment.

The trust boundary is enforced by the receiving service and source system, not by client-side conventions or UI labels.

## 3. Threat analysis and required controls

| ID | Threat / abuse case | Required controls | Required evidence |
|---|---|---|---|
| EVD-T01 | Tenant spoofing via header, body or path | Derive tenant from verified identity; compare assertions; enforce tenant predicate at every source | Cross-tenant negative tests and source-side policy evidence |
| EVD-T02 | IDOR / object enumeration | Opaque IDs; tenant-scoped resolution; tenant-safe errors; rate controls | Enumeration tests and no-existence-leak review |
| EVD-T03 | FORTRESS decision replay or substitution | Bind issuer, audience, tenant, principal, action, purpose, exact object/version, fingerprint and validity; check revocation on every access | Signed-decision verification and replay/revocation tests |
| EVD-T04 | Confused deputy / overbroad service credential | Separate caller authority from service storage access; least privilege; enforce request-scoped FORTRESS decision | Credential-scope review and confused-deputy tests |
| EVD-T05 | Mutable alias or version substitution | Require immutable object/version identity; reject latest, filename and caller storage locator | Exact-version tests and object-store versioning proof |
| EVD-T06 | Byte tampering or store corruption | Read exact version; recompute length and digest; compare manifest and metadata | Corruption, truncation and substitution tests |
| EVD-T07 | Metadata/content TOCTOU race | Bind immutable version ID; read version-specific bytes; verify digest after retrieval; do not trust pre-read metadata alone | Concurrent overwrite/swap and post-read digest tests |
| EVD-T08 | Malicious or misleading evidence producer | Authenticate source; validate schema, classification, provenance, signatures and content; distinguish assertion from independent observation | Producer spoofing, malformed-content and provenance tests |
| EVD-T09 | Manifest ambiguity or canonicalization collision | Versioned canonicalization; duplicate rejection; explicit Unicode/number/time/null rules; recompute digest | Cross-implementation canonical test vectors |
| EVD-T10 | Secret, token or unnecessary personal data leakage | Content scanning; classification; redaction; no secrets in logs/events/manifests; quarantine policy | Secret-pattern tests and log/output review |
| EVD-T11 | Audit suppression or evidence release without required audit | Durable audit acknowledgement before release where policy requires; fail closed on unavailable audit path | Audit outage and partial-commit failure injection |
| EVD-T12 | Orphan object cleanup deletes referenced evidence | Quarantine staging; reference scan; legal-hold check; explicit authorized idempotent disposition | Race tests between commit and cleanup |
| EVD-T13 | Unauthorized retention expiry or legal-hold removal | Separate legal/records authority; dual control; hold state enforced at storage boundary | Hold-bypass and unauthorized-disposition tests |
| EVD-T14 | Cross-tenant cache, index, cursor or backup leak | Tenant-bound cache keys, query filters, signed cursor scope and restore verification | Cross-tenant cache/cursor/backup/restore suite |
| EVD-T15 | Key compromise or unauthorized decryption | Separate key custody; narrow purpose and audience; rotation/revocation; audit key use; no keys in packages | Key lifecycle and compromise-recovery exercise |
| EVD-T16 | Malicious or compromised operator | Separate duties, time-bound privileged access, independent logs/checkpoints, dual control for sensitive changes | Privileged-access review and insider-abuse exercise |
| EVD-T17 | Backup tampering or rollback to stale evidence | Immutable backup identity, trusted snapshot metadata, restore-time digest/manifest checks and freshness validation | Restore corruption, rollback and missing-object tests |
| EVD-T18 | Auditor alters evidence or self-approves access | Separate read-only identity enforced at source; no mutation capabilities; independent trust anchors | Negative authorization and source-side role tests |
| EVD-T19 | Replay/duplicate ingest creates conflicting evidence | Tenant-scoped idempotency bound to request fingerprint; immutable object versions; conflict on changed request | Concurrent duplicate and same-key/different-fingerprint tests |
| EVD-T20 | Denial of service via oversized or expensive evidence | Approved size/type limits, quotas, bounded decompression/scanning, rate controls and backpressure | Resource-exhaustion tests and capacity evidence |
| EVD-T21 | Dependency compromise in scanner/parser/verifier | Pinned, reviewed dependencies; sandboxed parsers; isolated non-mutating verification; build provenance | Dependency provenance, sandbox escape and supply-chain review |
| EVD-T22 | Clock skew invalidates expiry/revocation decisions | Trusted time source, explicit skew bounds, fail closed when trust unavailable | Clock rollback/skew tests and time-source attestation |
| EVD-T23 | Cross-tenant restore or promotion | Isolated restore validation; tenant-bound manifests; explicit promotion authority | Restore isolation and promotion denial tests |
| EVD-T24 | False success from incomplete evidence or telemetry | Explicit UNKNOWN/INCOMPLETE states; completeness manifest; independent source reconciliation | Missing-source and partial-bundle tests |

## 4. High-risk abuse scenarios

### 4.1 Confused deputy through the evidence service

An attacker obtains a low-privilege authenticated account and asks the service to retrieve a different tenant's object. The service's storage credential is more powerful than the caller's identity. If the service trusts a caller-supplied tenant or object locator, it becomes a deputy that bypasses tenant controls.

Required defense: the service derives identity and tenant, requests a FORTRESS decision for the exact object/version and purpose, and applies tenant predicates in the metadata store and content-store adapter. The service credential only enables the service to perform the already-authorized read; it never supplies caller authorization.

### 4.2 Decision replay against another resource

An attacker captures or reuses an earlier allow decision for another object, purpose, tenant or service audience.

Required defense: decision verification binds exact tenant, principal, action, resource, object/version, purpose, audience, request fingerprint and validity. Revocation is checked at each read. A decision reference is not a bearer credential. The service rejects stale, revoked, wrong-audience or mismatched artifacts.

### 4.3 Evidence substitution after metadata validation

An object is replaced or redirected after the metadata lookup but before bytes are returned.

Required defense: immutable version-specific retrieval; no mutable locator; verify returned bytes and length against the exact version's stored digest immediately before response; preserve the observed digest and retrieval audit. If the store cannot guarantee immutable version retrieval, the service must not claim integrity.

### 4.4 Cleanup race with operation commit

A background cleanup process sees a staged object as unreferenced while a concurrent operation is about to commit a reference.

Required defense: the transaction owner and cleanup process coordinate through a durable lifecycle state or equivalent concurrency-safe protocol. Cleanup rechecks authoritative references and legal holds at the enforcement point. A time delay alone is not a correctness guarantee. Failed or uncertain cleanup remains pending and auditable.

### 4.5 Auditor or operator privilege escalation

An auditor attempts to amend source evidence, or an operator changes a legal hold and approves their own action.

Required defense: separate identities and source-enforced permissions; FORTRESS authorization for each sensitive action; independent approver and audit trail; no shared service account or client-only read-only flag. The independent verifier cannot change its own trust roots or findings.

## 5. Security invariants

The following invariants must hold at the source enforcement boundary:
1. No authenticated tenant scope, no access.
2. No current FORTRESS allow for the exact requested scope, no retrieval.
3. No exact immutable object version, no retrieval.
4. No digest match, no verified evidence response.
5. No required durable audit acknowledgement, no release where policy mandates it.
6. No legal-hold clearance by an authorized authority, no ordinary disposition.
7. No independent reviewer mutation permission, ever.
8. No complete restore verification, no restore pass.
9. No trusted time or revocation status within approved bounds, no consequential allow.
10. No verified evidence, no VERIFIED_EFFECT claim.

## 6. Monitoring and incident response

Security telemetry should record, without embedding sensitive content:
- actor/service identity, tenant, purpose and resource reference;
- FORTRESS decision and approval references and policy version;
- object/version, manifest digest and verification result;
- denied cross-tenant attempts, enumeration patterns and repeated digest failures;
- staging age, orphan count, unresolved references and disposition failures;
- unusual retrieval volume, size, geography or purpose changes where lawfully collected;
- key use, key rotation/revocation and privileged access;
- backup/restore failures, manifest gaps and stale snapshots;
- auditor access, verifier findings and checkpoint gaps.

Alerts must not leak evidence bytes or secrets. Incident response must preserve affected evidence, revoke compromised grants/keys through their authoritative owners, isolate affected service identities, record uncertain operations and avoid destructive cleanup while an investigation or legal hold applies. Recovery actions require their own FORTRESS authorization and audit evidence.

Detection thresholds, telemetry retention, escalation owners and response-time objectives are UNCONFIRMED.

## 7. Security test plan

Before production acceptance, execute at minimum:
- tenant spoofing, IDOR, enumeration and cross-tenant cache/cursor/backup tests;
- wrong issuer, audience, principal, purpose, action, resource, fingerprint, expiry and revocation decision tests;
- stale decision replay and authorization change between retries;
- immutable-version substitution, byte corruption, truncation and TOCTOU race tests;
- malformed schema, content bomb, parser exploit and secret leakage tests in isolation;
- canonicalization ambiguity, duplicate manifest and signature/trust-root substitution tests;
- audit outage, transaction crash, outbox duplicate and cleanup/commit race tests;
- legal-hold bypass, unauthorized disposition and operator self-approval tests;
- key compromise, revocation, backup tampering and historical verification tests;
- auditor write attempts and verifier compromise containment;
- resource exhaustion, rate-limit bypass and dependency/supply-chain tests;
- clock rollback, time-source loss, incomplete snapshot and restore rollback tests.

Each test result must identify exact build, test profile, fixture/source versions, trust-store version, execution environment, timestamp source, findings and limitations. Synthetic models are design conformance examples, not penetration tests or production assurance.

## 8. Residual risks and owner decisions

The following remain UNCONFIRMED and prevent a production security conclusion:
- accountable service, storage, persistence, FORTRESS, key, legal/records, audit, resilience and incident owners;
- actual identity issuer/audience/key/revocation interfaces and maximum revocation delay;
- content store immutability and exact-version guarantees;
- transaction isolation, outbox and cleanup concurrency behavior;
- encryption profile, key custody, key rotation and compromise recovery;
- approved content scanning and sandbox architecture;
- retention classes, jurisdictions, legal hold and deletion rules;
- trusted time, backup immutability, restore objectives and auditor independence;
- service quotas, monitoring, incident runbooks and recovery objectives;
- production penetration testing, external review and release authorization.

## 9. Current disposition

This threat model is a proposed design-review artifact. It does not certify security, prove that controls are implemented, assign owners or authorize production operation. No credentials, infrastructure, database initialization, migrations, production writes, deployments, DNS changes, spending, merge or runtime activation are authorized.
