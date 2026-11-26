# IZAKHONO AI Workforce — Independent Audit Reproducibility Protocol v1.0

**Status:** Proposed audit protocol; production owners, interfaces, evidence retention and cryptographic profile remain UNCONFIRMED.
**Parent:** Independent Verifier Operational Contract v1.0
**Scope:** Enable an independent reviewer to reconstruct and challenge a verifier finding from preserved, authenticated evidence without relying on the original verifier operator.

## 1. Objective and boundary

A reproduction package allows an authorized independent reviewer to determine whether a prior finding follows from the exact evidence snapshot, trust state, time inputs, verification profile and verifier build recorded at the time.

Reproduction is an evidence assessment. It does not grant access, authorize an operation, alter an operation outcome or replace a fresh FORTRESS decision. The reviewer must not execute or replay the original business action.

The protocol distinguishes:
- **Historical reproduction:** reproduce what the verifier could validly conclude using the trust and source state recorded for the original evaluation.
- **Current re-assessment:** evaluate whether the same evidence remains acceptable under current revocation, trust, policy and acceptance requirements.
- **Independent challenge:** identify missing, contradictory, invalid or unavailable inputs and record a separate finding.

A historical result must never be presented as proof that credentials, actors, agents, registrations or keys remain trusted today.

## 2. Reproduction package

Each finding must reference a versioned, content-addressed reproduction package. The package manifest includes:
1. finding ID, tenant and operation scope, acceptance-bundle digest and parent/correction finding IDs;
2. immutable operation/request snapshot reference and canonical request serialization version;
3. exact source snapshot references, source issuer identities, schema versions, query parameters, observation times, source update times, pagination/snapshot tokens and consistency status;
4. evidence manifest with object IDs, immutable version IDs, content digests, media/schema types, classification and retention/access references;
5. FORTRESS decision and approval artifact references, issuer/key IDs, policy version and recorded revocation observation;
6. Runtime Fabric registration/health snapshot, HOST receipt and issuer metadata;
7. canonical event/outbox/inbox records and audit checkpoint references, including covered sequence/range;
8. trust-store snapshot/version and key-status observations, including historical-validation rule version;
9. trusted-time observation, clock-health/offset evidence and time-zone/serialization conventions;
10. exact acceptance profile, canonicalization rules, schema versions, verifier build digest, dependency lock/build provenance and configuration digest;
11. deterministic inputs, outcome, reason codes, checks passed/failed/skipped/unavailable and known limitations;
12. manifest creation time, signer identity, signature reference, package digest and retention class.

The manifest is a map of references and digests, not a licence to duplicate entire source databases. Preserve the minimum evidence required for independent reproduction. Secret values, access tokens, private keys, session cookies and unrelated tenant data are prohibited.

## 3. Snapshot consistency and source capture

The verifier must request immutable versions or a source-supported consistent snapshot wherever available. Each source response is bound to the same tenant, operation, request fingerprint and declared verification window.

If a source cannot provide snapshot isolation, the package records:
- query start/end and source observation timestamps;
- stable pagination cursor or snapshot token, if supported;
- source sequence/version/watermark;
- any observed changes during collection;
- explicit consistency classification: CONSISTENT, BOUNDED_SKEW, or INCONSISTENT.

The acceptance profile defines the maximum permitted skew per source class. An inconsistent snapshot, missing page, cursor gap, changed object version or unresolved cross-record contradiction cannot produce VERIFIED_EFFECT. The outcome is UNKNOWN or REJECTED as prescribed by the profile.

Never reconstruct missing historical source state from current mutable records and label it as the original snapshot. If the original snapshot was not retained, state that historical reproduction is unavailable.

## 4. Canonical encoding and digest rules

The profile must pin canonical serialization for every signed or hashed structure, including field ordering, Unicode normalization, number representation, null/absent distinction, timestamp precision, byte encoding and schema version.

Every digest record identifies the algorithm, digest value, input object/version and canonicalization profile. Verification must recompute digests from retrieved bytes or canonical records; a digest string supplied by the original verifier is not proof by itself.

A package-level digest binds the manifest and all included artifacts using a versioned deterministic manifest format. Signatures bind the manifest digest, package ID, tenant scope, creation time, signer identity and intended purpose. A package cannot redefine its own trust roots or algorithm policy.

Algorithm selection and transition policy remain subject to approved cryptographic governance; this document does not select algorithms or vendors.

## 5. Deterministic execution environment

The reproduction environment must be isolated and non-authoritative. It must:
- use the exact verifier build digest and dependency set, or a separately approved compatibility implementation;
- verify build provenance and profile signatures before execution;
- disable network access by default and prohibit business-action adapters;
- accept only the package's declared, validated inputs;
- use recorded trusted-time inputs for historical reproduction, not the reviewer workstation clock;
- emit a deterministic report with input manifest digest, build/profile digests and output reason codes;
- record any unavoidable nondeterminism and downgrade the result where it affects the conclusion.

A container image tag or source branch name alone is insufficient; bind immutable build artifacts by digest and retain provenance. A reproducible build is desirable, but if it is not achieved, the exact signed binary/build artifact and its provenance must be retained.

The verifier must not make live calls that mutate source state. A current re-assessment may query current revocation/trust metadata through separate read-only authority, and must be reported separately from historical reproduction.

## 6. Reproduction outcomes

The reviewer records one of:
- **REPRODUCED_MATCH:** independent execution yields the same outcome and material reason codes from the retained historical inputs.
- **REPRODUCED_DIFFERENT:** valid reproduction yields a different outcome or material reason code; open an investigation and preserve both findings.
- **NOT_REPRODUCIBLE:** required source snapshot, artifact, build, profile, trust state or time evidence is missing or invalid.
- **INDETERMINATE:** inputs are available but contradictory, stale, ambiguous or outside approved tolerances.
- **CURRENTLY_REASSESSED:** a distinct current-state evaluation was performed; this is not historical reproduction.
- **REJECTED_PACKAGE:** package signature, digest, scope, provenance or manifest validation fails.

A match does not mean the original decision was substantively correct if the source itself was false or compromised. The reviewer must report source trust limitations and independent corroboration gaps.

## 7. Independent reviewer controls

The reviewer has a separate, time-bounded, read-only identity and approved purpose. Access is tenant-scoped and evidence-specific. It cannot change the original finding, issue policy decisions, approve operations, update trust roots or access unrelated tenant records.

The reviewer must independently obtain trust anchors and package-signing trust metadata from an authority outside the package and outside the original verifier operator's sole control. Conflicts of interest, operator/reviewer overlap and trust-administration overlap are disclosed and managed under owner-approved dual control.

Every package access, export, verification run, exception and reviewer disposition is audited. Sensitive evidence may require controlled-room review, redaction or supervised access; redaction that removes a necessary verification input results in NOT_REPRODUCIBLE or INDETERMINATE, not an assumed pass.

## 8. Retention, legal hold and recovery

Retention must cover the maximum audit, dispute, incident and legal-hold period approved by accountable owners. The package manifest, referenced immutable objects, trust/profile/build artifacts and audit trail must be retained as a coherent set.

Retention controls include:
- immutable versioned object references and verified digests;
- tenant-isolated access and encryption/key custody;
- legal hold and authorized disposition workflows;
- independent checkpointing and periodic restore/retrieval tests;
- backup copies under separately controlled failure domains;
- evidence of successful restoration and digest re-verification.

A missing object, expired key material without a valid historical verification path, broken reference, failed restore or unavailable build artifact must be recorded as a reproduction limitation. Do not silently substitute a newer object or newer profile.

## 9. Disagreement, correction and escalation

The independent reviewer never edits the original finding. A disagreement creates a new linked challenge/reproduction record containing the package digest, original finding ID, reviewer identity, independent build/profile, reproduced result, discrepancy classification, evidence and disposition.

A material difference, suspected source compromise, trust-root issue, verifier compromise or missing evidence triggers incident escalation to accountable owners. Consequential original findings may be marked UNDER_REVIEW only through a new authorized append-only event; they are not deleted or rewritten.

If the verifier and reviewer share the same compromised source, trust root, build pipeline or operator, the review is not independent. The report must state the common-mode dependency and remain qualified.

## 10. Production acceptance gates

Production adoption requires evidence-backed approval of:
- accountable package, evidence, trust, build, reviewer and retention owners;
- immutable source snapshot interfaces and consistency/freshness semantics;
- canonical serialization and digest/signature profile;
- independently distributed trust anchors and package signer policy;
- retained verifier build, dependency and provenance artifacts;
- isolated deterministic reproduction runner with no business-action capability;
- tenant-scoped reviewer identity, read-only evidence access and audit;
- package retention, legal hold, backup, restore and digest verification;
- successful positive, negative, missing-evidence, tamper, cross-tenant, stale-source and restore-failure tests;
- independent reviewer exercise demonstrating reproducibility and documented limitations.

All owners and acceptance evidence remain UNCONFIRMED until explicitly accepted. Synthetic tests do not satisfy these gates.

## 11. Synthetic conformance vectors

The test-only reference model should reject:
- incomplete or duplicate manifest artifacts and duplicate artifact IDs;
- digest mismatch, untrusted package signer or package scope mismatch;
- source snapshot inconsistency, pagination gaps or missing historical snapshots;
- build/profile/dependency digest mismatch;
- live/mutating execution capability in the reproduction environment;
- missing trust anchors or an attempt to trust roots supplied only by the package;
- historical/current-state result conflation;
- overwrite of an original finding rather than a linked challenge record;
- cross-tenant package or reviewer access;
- missing required artifacts, failed restore or unresolved evidence references.

The tests are synthetic in-memory examples. They do not implement cryptography, deterministic containers, source snapshot APIs, immutable object storage, trusted time, independent trust distribution or production audit.

## 12. Owner acceptance register

- Reproduction package/manifest owner: UNCONFIRMED
- Source snapshot/interface owners: UNCONFIRMED
- Canonicalization and cryptographic profile owner: UNCONFIRMED
- Independent trust-anchor authority: UNCONFIRMED
- Verifier build/provenance owner: UNCONFIRMED
- Isolated reproduction runner owner: UNCONFIRMED
- Independent reviewer/audit owner: UNCONFIRMED
- Evidence retention/legal-hold/restore owner: UNCONFIRMED
- Maximum source skew and retention periods: UNCONFIRMED
- Tenant isolation and reviewer access evidence: UNCONFIRMED
- Reproduction test report and residual risks: UNCONFIRMED
- Decision: ACCEPT / REJECT / DEFER (not selected)

## 13. Current disposition

This is a proposed audit reproducibility protocol and synthetic test scope only. It does not create a verifier, evidence package service, immutable snapshot API, signing key, trust store, container runner, reviewer identity, retention store or production audit capability. No production access, credentials, database changes, migrations, deployments, DNS changes or infrastructure expenditure are authorized.
