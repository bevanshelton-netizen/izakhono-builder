# IZAKHONO PAY — Central Identity Verification Provider Evaluation

**Record:** IZP-IDV-EVAL-001  
**Version:** 1.0  
**Assessment date:** 2026-11-21  
**Evaluation authority:** IZAKHONO PAY  
**Canonical identity authority:** IZAKHONO ID  
**Security, risk and audit authority:** IZAKHONO FORTRESS  
**Scope:** All authorised IZAKHONO businesses and products  
**Status:** Evaluation framework; no provider appointed for production

## 1. Decision and ownership

IZAKHONO PAY coordinates the group's central identity-verification provider evaluation. The outcome is a reusable, provider-independent service capability consumed by authorised IZAKHONO businesses. It is not a separate competing payment or identity platform.

The operating rule is:

**ONE GROUP EVALUATION THROUGH IZAKHONO PAY. ONE CANONICAL IDENTITY AUTHORITY THROUGH IZAKHONO ID. ONE RISK, REVIEW AND AUDIT CONTROL PLANE THROUGH FORTRESS.**

Provider selection must not transfer ownership of IZAKHONO customer identities, identity records, verification policy, evidence history, final decisions or business relationships to a vendor.

Regula is the preferred initial candidate for technical evaluation, subject to the same mandatory gates and scoring method as any alternative. Preferred-candidate status is not a supplier appointment, purchase approval, exclusivity commitment or production authorisation.

## 2. Group-wide scope

The evaluation must support the relevant KYC/KYB needs of all authorised group businesses, with purpose-specific configuration rather than a single blanket approval.

Expected capability domains include:

- Individual identity proofing and document authenticity.
- Business/entity verification and authorised-representative checks.
- Director, beneficial-owner and controller verification.
- Face comparison and liveness where lawful, necessary and proportionate.
- Address and supporting-document checks.
- Company-registry and tax-status checks through separately authorised sources.
- Sanctions, PEP, adverse-media and fraud screening through separately contracted providers.
- Human review, exception handling, auditability and re-verification.

A document/biometric vendor is not automatically a complete KYC/KYB provider. Capabilities must be evaluated separately and integrated through the IZAKHONO provider registry. Registry, sanctions and screening suppliers may remain separate adapters.

## 3. Non-negotiable architecture

1. IZAKHONO ID remains the canonical authority for user, entity, membership, session and role identifiers.
2. IZAKHONO PAY coordinates the shared verification service and its approved consumer integrations.
3. FORTRESS owns risk policy, fraud/security controls, reviewer governance, case escalation and decision audit.
4. Each product receives only the minimum purpose-bound verification result it is authorised to consume.
5. Provider identifiers are external references only; they must never become canonical IZAKHONO identity keys.
6. Provider results are evidence, not final IZAKHONO approval decisions.
7. The provider-neutral adapter contract and internal outcome model must allow replacement or addition of providers without rewriting product applications.
8. Raw identity documents and biometric data must remain in approved private storage and processing paths; they must not be copied into ordinary logs or general-purpose metadata.
9. All human and service access must follow the owner-controlled, least-privilege, default-deny standard.
10. No production activation follows from a provider's standalone "clear" result.

## 4. Mandatory pass/fail gates

A provider that fails any mandatory gate is not eligible for production selection, regardless of its weighted score.

| Gate | Required evidence |
|---|---|
| Legal and privacy | Contract and data-processing terms reviewed by qualified advisers; POPIA role allocation, lawful basis, purpose, retention, data-subject rights, breach support and cross-border transfers assessed |
| Security | Documented architecture, authentication, encryption, access control, vulnerability management, incident response, penetration-test/assurance evidence and subprocessor inventory |
| Data handling | Written data-flow map identifying every location, recipient, retention period, backup copy, support access and licensing/telemetry egress |
| South African coverage | Demonstration on agreed representative SA document samples; exact supported document versions and licensed modules listed |
| Evidence integrity | Correlation IDs, evidence/result hashes or equivalent integrity controls, reproducible audit evidence and documented result semantics |
| Operational resilience | SLA, capacity, timeout/retry behaviour, incident notification, backup/recovery and supported upgrade/rollback procedure |
| Integration safety | Private authenticated service-to-service access; no unauthenticated public processing endpoint; no browser-held vendor secret |
| Exit and portability | Data export, deletion certification, termination assistance, licence portability and an implementable provider replacement path |
| Governance | No provider-only auto-approval; FORTRESS review and IZAKHONO decision authority remain intact |

## 5. Weighted evaluation scorecard

Score each category from 0 to 5 and multiply by the category weight. A score of 0 means no evidence; 1 means materially deficient; 2 means weak/partial; 3 means acceptable with limitations; 4 means strong; 5 means demonstrated and independently substantiated.

| Category | Weight | Evidence to collect |
|---|---:|---|
| South African and launch-market document coverage | 15 | Exact Smart ID revisions, legacy ID book policy, passport, driver's licence, residence permits, foreign documents, document pack/version and demonstrated results |
| Document authenticity and capture quality | 15 | OCR/MRZ/barcode/RFID cross-checks, security-feature checks, image quality, copy/screenshot/replay detection and controlled attack tests |
| Face comparison and liveness | 15 | 1:1 match, active/passive liveness, presentation-attack tests, accessibility/fallback, performance and error-rate evidence |
| Security and deployment control | 15 | Private deployment options, API authentication, mTLS/TLS, network segmentation, encryption, secret handling, logging, vulnerability and incident controls |
| Privacy, data residency and legal readiness | 10 | Data-flow transparency, processing locations, subprocessors, retention/deletion, POPIA terms, cross-border safeguards and support access |
| KYB and related ecosystem coverage | 10 | Company/registry integrations, directors/UBOs, authorised representatives, sanctions/PEP/adverse-media integration options and clear capability boundaries |
| Reliability, performance and support | 8 | Throughput, p95/p99 latency, concurrency, availability, support response, disaster recovery, upgrade and rollback |
| Integration and provider independence | 5 | Stable APIs, normalised outcomes, evidence references, idempotency, portability and ease of adapter replacement |
| Commercial value and total cost | 7 | Complete licence/module pricing, transaction tiers, minimum commitments, infrastructure, support, renewals, egress and exit costs |
| **Total** | **100** | |

**Proposed internal decision threshold:** at least 80/100 overall, no category below 60% of its available points, and every mandatory gate passed. This is an IZAKHONO evaluation threshold for approval by the owner; it is not a vendor-certified benchmark or regulatory standard.

## 6. Candidate register

| Candidate | Evaluation scope | Current status |
|---|---|---|
| Regula | Document Reader SDK + Face SDK behind IZAKHONO adapter; evaluate full IDV Platform separately | Preferred initial evaluation candidate; no licence, contract, endpoint or credentials configured |
| Alternative document provider(s) | Comparable document authenticity and capture coverage | To be identified and evaluated |
| Alternative face/liveness provider(s) | Comparable 1:1 match, liveness and presentation-attack detection | To be identified and evaluated |
| Registry/screening providers | CIPC/company registry, sanctions, PEP, adverse media and other authorised sources | Separate provider workstreams; no provider appointment implied |
| Manual verification | Controlled fallback and exception adjudication | Must remain available under FORTRESS governance |

Do not invent candidate scores, prices, accuracy figures, certifications or customer references. Populate the scorecard only from dated vendor evidence, test results and written commercial/legal responses.

## 7. Regula-specific evaluation questions

For Regula, require a controlled demonstration and written response covering:

- Exact Document Reader SDK release, document database pack and licensed components.
- Exact Smart ID Card revisions and South African document types supported, including front/back, barcode, OCR, MRZ and any applicable RFID checks.
- Which authenticity checks are available for each document type and which are excluded by the proposed licence.
- Face SDK version, liveness mode, presentation-attack coverage and 1:1 comparison configuration.
- Whether the proposed design uses standalone Web Services or the full IDV Platform.
- Authentication and network controls for every service; standalone services must not be publicly exposed.
- Every outbound licensing, telemetry, update and support destination and the categories of data transmitted.
- Data residency, subprocessors, retention, deletion, support access and POPIA contractual commitments.
- Written pricing by module, transaction volume, environment, worker, licence type and support tier.
- Service limits, worker sizing, throughput, SLA, recovery and upgrade/rollback procedure.
- Export and deletion procedure at contract termination.

The current technical due-diligence record is `docs/IZAKHONO-REGULA-TECHNICAL-DUE-DILIGENCE.md`. Current official documentation records Document Reader SDK 9.10 and a 9.9 release-note update to the South Africa ID Card barcode parser. That evidence does not prove complete South African document coverage; sample-based testing remains mandatory.

## 8. Proof-of-capability protocol

All candidates must use the same agreed test protocol and equivalent lawful sample sets.

### Document set
- South African Smart ID cards across agreed revisions, front and back.
- Legacy green ID books only where the approved onboarding policy still accepts them.
- South African passports and driver's licences.
- Foreign passports and residence permits for intended markets.
- Expired, damaged, low-light, glare, cropped and low-resolution samples.
- Controlled printed-copy, screenshot, altered-image and mismatch samples.

### Biometric set
- Genuine 1:1 comparison cases with lawful reference-image provenance.
- Active and passive liveness scenarios where offered.
- Replay, print, screen and other presentation-attack scenarios.
- Lighting, camera, device and accessibility variations.
- Agreed false-accept and false-reject measurement methodology.

### Operational set
- Normal and peak concurrency.
- Median, p95 and p99 latency.
- Timeout, retry, duplicate request and idempotency behaviour.
- Provider outage, partial outage and recovery.
- Evidence/result correlation and audit export.
- Retention/deletion and backup deletion.
- Version upgrade, rollback and licence interruption.

The test owner must preserve a test manifest, sample provenance, configuration, provider versions, raw measurements, adjudication notes and signed results. Do not use real customer biometric or identity data in a vendor test unless the lawful basis, notice, contract, security and retention controls have been approved.

## 9. Decision workflow and approvals

1. IZAKHONO PAY issues the common request for information and proof-of-capability specification.
2. Vendors provide technical, privacy/security, commercial and legal evidence.
3. IZAKHONO ID validates canonical identity and integration boundaries.
4. FORTRESS validates risk, security, audit, human-review and fail-closed requirements.
5. IZAKHONO PAY records test results, weighted score, total cost and recommendation.
6. Qualified legal/privacy advisers review POPIA, FICA applicability, contracts and cross-border processing.
7. The owner approves or rejects the architecture decision and supplier appointment.
8. Only after approval may a controlled staging adapter be configured; production remains separately gated by migration, security, operational and release evidence.

No supplier may change merchant activation, payment routing, settlement, customer status or final onboarding decisions through its own dashboard or API.

## 10. Current implementation and release status

The repository contains a provider-neutral adapter registry and a Regula adapter contract. Regula is registered as not configured. There is no vendor HTTP transport, licence, API credential, production endpoint or live document/biometric processing.

The evidence-scanning adapter is also fail-closed and unconfigured. The entity-scope migration is review-only and has not been applied. Canonical IZAKHONO ID runtime deployment, product/entity mapping, FORTRESS-owned reviewer API, staging integration tests, independent security review and legal review remain release gates.

**Current decision:** Continue Regula evaluation as the preferred candidate while identifying comparable alternatives. Do not appoint Regula as exclusive or production supplier until the mandatory gates and owner approval are complete.
