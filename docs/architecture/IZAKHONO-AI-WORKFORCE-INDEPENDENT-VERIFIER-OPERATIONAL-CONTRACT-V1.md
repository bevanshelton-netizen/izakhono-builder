# IZAKHONO AI Workforce — Independent Verifier Operational Contract v1.0

**Status:** Proposed operational contract; all accountable owners and production interfaces remain UNCONFIRMED unless accepted with evidence.  
**Parent:** Production Acceptance and Independent Verification v1.0  
**Scope:** Define how an independent verifier is operated, isolated, supplied with authoritative evidence, governed and independently reviewed. This is a design artifact and synthetic test model only.

## 1. Purpose and non-authority

The independent verifier evaluates whether an operation's authorization, approval, runtime binding, execution receipt, evidence, event and audit checkpoint satisfy a versioned acceptance profile. It does not authorize, schedule, execute, repair or reverse operations.

- FORTRESS remains the sole policy and approval authority.
- Runtime Fabric remains the workload scheduling, registration and state authority.
- The registered HOST adapter remains the issuer of HOST execution receipts.
- The approved persistence/evidence owner remains authoritative for operation and evidence records.
- The verifier independently reads and correlates these sources; it is not a second registry, event bus, scheduler or policy engine.

A verifier result is an evidence assessment, not a permission grant. No component may use a verifier result as a substitute for a fresh FORTRESS decision at the enforcement boundary.

## 2. Operating model and accountable ownership

The verifier must be operated as a separately governed service. Before production adoption, the owner register must identify named accountable parties for:

1. service operation and incident response;
2. verifier software/profile release and change approval;
3. verifier workload identity and read-only access grants;
4. trust-root distribution, signing-key custody, rotation and revocation;
5. trusted time source and clock monitoring;
6. each authoritative evidence source and its availability/freshness contract;
7. append-only findings storage, retention and legal hold;
8. independent audit/reproduction and compromise review.

No role is assigned by this proposal. Owners remain **UNCONFIRMED** until the accountable authority records acceptance and evidence. The verifier operator must not unilaterally approve its own trust roots, change acceptance profiles, delete findings or certify its own compromise recovery.

## 3. Verifier identity and read-only access

The production verifier requires a distinct service/workload identity, separate from human sessions, agent identities, NODE01 logical identity, HOST adapter identity and provider identities.

Its access profile must be:
- read-only and source-specific;
- tenant- and purpose-scoped, with each query bound to an explicit tenant and operation/evidence reference;
- audience-bound to each authoritative source;
- short-lived, revocable and issued through the approved identity authority;
- denied access to secret values, credentials, session material and unrelated tenant data;
- unable to create FORTRESS decisions, approvals, grants, runtime registrations, receipts or operational commands.

The verifier must not accept caller-supplied claims of its own identity or authorization. Each source independently authenticates the verifier and enforces its scope. A single broad database credential or shared operator token is not an acceptable production design.

If the source cannot enforce the required read-only/tenant scope, that source is unavailable for independent verification and the result must be UNKNOWN or REJECTED according to the approved profile.

## 4. Authoritative evidence-source interfaces

The implementation must define versioned, authenticated read interfaces for at least:

| Source | Required independent reads | Authority boundary |
|---|---|---|
| Operation/persistence owner | immutable request fields, operation state, idempotency identity, transaction/outbox commit evidence | authoritative operation record |
| FORTRESS | decision, policy version, approval requirement, approval artifact and current revocation status | sole policy/approval authority |
| Identity/trust service | verifier and issuer identities, key metadata, principal/workload status and revocation | identity and trust metadata |
| Runtime Fabric | registration, tenant/workload binding, adapter/environment identity, state, health timestamp and revocation | runtime registration/state |
| HOST receipt source | signed receipt, issuer identity, attempt and outcome details | execution evidence for HOST action |
| Evidence store | immutable object metadata/content, digest, classification, retention and access status | evidence content and custody |
| Event/outbox/inbox owner | canonical event, transaction linkage, relay/deduplication state and consumer receipt | durable event-delivery evidence |
| Audit checkpoint service | signed checkpoint, covered sequence/range, root digest, trusted timestamp and retention reference | audit completeness evidence |

Each interface contract must specify authentication, authorization, tenant filtering, schema/version negotiation, pagination consistency, freshness/maximum staleness, error semantics, rate limits, availability, retention, and source-of-truth ownership. Reads must be correlated to a stable snapshot or explicitly report that the source set was observed at different times.

A source response that is absent, stale, ambiguous, unauthenticated or outside the verifier's scope is not evidence of a healthy or successful state. Never silently substitute a cache, local fixture, NODE01 callback or operator assertion for an authoritative source.

## 5. Trust roots and signing-key lifecycle

A production trust profile must define:
- approved root certificates/public keys and their authoritative distribution channel;
- key identifiers, allowed algorithms, purpose, issuer and audience constraints;
- separate trust domains for FORTRESS decisions, human approvals, HOST receipts, runtime registration and audit checkpoints;
- key generation and custody controls, including hardware-backed protection where required by risk;
- activation, overlap, rotation, expiry, revocation and emergency distrust procedures;
- signed trust-store/profile versions and a reproducible record of which version verified each bundle;
- historical verification rules for evidence signed before a key was revoked or retired.

The verifier must not trust a key merely because it appears in the bundle being verified. It must resolve trust metadata independently. It must reject algorithm downgrade, unknown key IDs, wrong-purpose keys, revoked keys outside an explicitly approved historical-validation rule, invalid chains and ambiguous issuer mappings.

Trust-store changes require dual control and independent review. Emergency revocation must propagate within an owner-approved maximum delay. If trust status cannot be established within that bound, consequential acceptance fails closed and the result is UNKNOWN/REJECTED, not VERIFIED_EFFECT.

This proposal does not select algorithms, roots, vendors, HSMs or key custodians. Those are owner decisions.

## 6. Trusted time and freshness

The verifier must use an approved trusted time source and record:
- observed UTC time and source identity;
- clock synchronization/health status and measured offset;
- allowed skew per artifact class;
- maximum age for decisions, approvals, registrations, health, revocation state, receipts and checkpoints;
- time at which each source was queried and its source-reported update time.

If trusted time is unavailable, outside tolerance or contradictory, time-sensitive validity cannot be established. If revocation or registration freshness exceeds its approved bound, the verifier must not return VERIFIED_EFFECT.

The acceptance profile must distinguish artifact validity windows from source freshness windows. A still-unexpired decision does not prove that its signing key, actor, agent or approval remains unrevoked.

## 7. Deterministic verification profile and reproducibility

Every verification run must bind to an immutable, versioned profile containing:
- canonical request serialization/fingerprint version;
- required evidence classes and cross-record binding rules;
- trusted issuer/key profile version;
- clock-skew and freshness limits;
- revocation objectives;
- source-interface/schema versions;
- outcome classification and failure disposition rules;
- verifier binary/build digest and configuration digest.

Given the same authenticated source snapshot, trust-store version, trusted-time input and profile version, an independent reviewer must be able to reproduce the same decision and identify every input that affected it.

The finding must preserve references and digests, not unnecessary copies of source records or secrets. Any non-deterministic input must be explicitly recorded and its effect on reproducibility documented.

## 8. Findings, retention and independent review

Each verification finding must be append-only and uniquely identified. It records:
- tenant/operation scope and acceptance-bundle digest;
- outcome and reason codes;
- source references, source observation times and freshness;
- verifier identity, build/profile/configuration digests;
- trust-store version and key IDs evaluated;
- trusted-time observation and clock status;
- checks passed, failed, skipped or unavailable;
- limitations, unresolved contradictions and reviewer disposition;
- creation time, retention class and checkpoint reference.

A correction is a new linked finding; the prior finding is never overwritten. Findings storage must enforce tenant isolation, restricted read access, retention/legal-hold policy, durable acknowledgement, backup/restore and independently verifiable checkpoints. The verifier operator must not be able to erase or rewrite its findings.

An independent reviewer must be able to retrieve the finding and referenced source evidence under separate read-only authority, validate digests/signatures, rerun the specified profile against the recorded snapshot, and compare the reproduced outcome. Review access and any disclosure must itself be audited.

## 9. Verifier compromise and recovery

Treat suspected verifier compromise as a security incident. The runbook must require:
1. isolate verifier workload and revoke its service identity/access grants;
2. preserve volatile and durable evidence under incident authority without allowing the compromised process to modify source records;
3. revoke or suspend affected verifier signing identities, if any; the verifier should ordinarily not possess source-signing keys;
4. identify affected tenants, operations, findings, profile versions, trust-store changes and time intervals;
5. mark findings from the suspected interval as **UNDER_REVIEW** through new append-only linked records; do not silently delete or retroactively rewrite them;
6. independently re-evaluate consequential findings using a known-good verifier build, independently controlled trust store and source evidence;
7. rotate/reissue verifier identity and credentials only after containment and owner approval;
8. restore from verified artifacts, validate build/configuration provenance and access scopes, then resume under heightened monitoring;
9. document residual uncertainty, notify accountable owners and complete an independent post-incident review.

A compromised verifier cannot be allowed to certify itself clean. If source evidence or trust roots may also be compromised, the review must expand to those trust domains. Where evidence cannot be independently recovered, affected outcomes remain UNKNOWN.

## 10. Synthetic conformance requirements

The isolated test model must reject:
- verifier identity with write-capable or cross-tenant scope;
- source data returned for a different tenant or operation;
- missing, stale or unauthenticated authoritative sources;
- unknown, revoked, wrong-purpose or untrusted signing keys;
- absent or unhealthy trusted time;
- unversioned or mismatched verification profiles;
- attempts to overwrite or delete prior findings;
- attempts by the verifier operator to approve trust/profile changes or erase findings;
- an attempt to treat the verifier outcome as FORTRESS authorization;
- a compromise response that fails to revoke verifier access or preserve prior findings.

These tests are contract examples only. They do not implement cryptography, service identity, source adapters, trusted time, durable append-only storage, incident response or production isolation.

## 11. Owner acceptance register

All entries remain **UNCONFIRMED** until accepted with evidence.

- Verifier service/operator owner:
- Verifier software/profile release owner:
- Read-only identity and access owner:
- Authoritative source-interface owners:
- Trust-root authority and independent reviewer:
- Key custody/rotation/revocation owner:
- Trusted-time owner and clock tolerance:
- Findings store/retention/restore owner:
- Independent audit/reproduction owner:
- Incident commander and compromise recovery owner:
- Approved profile/schema/build versions:
- Maximum source freshness and revocation delay:
- Tenant isolation and read-only enforcement evidence:
- Append-only finding/checkpoint and restore evidence:
- Reproduction test report:
- Residual risks and limitations:
- Decision: ACCEPT / REJECT / DEFER
- Decision date and review/expiry date:

No value is populated by inference. Missing owners, unavailable source interfaces, unproven isolation or incomplete recovery evidence block production use.

## 12. Current disposition

This is a proposed operational contract and synthetic test scope. It does not establish an operating verifier, service identity, source integration, trust root, key custody, trusted time, findings store, incident runbook, independent audit capability or production acceptance. No credentials, access grants, database changes, migrations, deployments, runtime registrations, DNS changes or infrastructure expenditure are authorized.
