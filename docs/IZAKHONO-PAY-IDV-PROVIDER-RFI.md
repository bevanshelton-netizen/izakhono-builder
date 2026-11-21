# IZAKHONO PAY — Identity Verification Provider RFI

**RFI reference:** IZP-RFI-IDV-001  
**Issue authority:** IZAKHONO PAY  
**Group scope:** All authorised IZAKHONO businesses  
**Canonical identity authority:** IZAKHONO ID  
**Security, risk and audit authority:** IZAKHONO FORTRESS  
**Document status:** Draft for owner approval before external issue  
**Classification:** Commercially sensitive — controlled distribution

## 1. Invitation

IZAKHONO PAY invites your organisation to provide a written technical, operational, privacy/security and commercial response for identity and business verification services to support a multi-business South African group platform.

The group is evaluating a modular, provider-independent architecture. A supplier may be selected for one or more capability modules; no supplier is presumed to provide every capability or to become the group's canonical identity authority.

This RFI is for information gathering and evaluation only. It is not a request for binding pricing, a tender award, purchase order, exclusivity commitment, data-sharing authorisation or production appointment. Any subsequent proof-of-capability or pilot will require separate written approval and appropriate agreements.

## 2. Group architecture and boundaries

The intended responsibility split is:

- **IZAKHONO PAY:** central coordination of shared verification-provider integrations and authorised group-product consumption.
- **IZAKHONO ID:** canonical user, entity, membership, session and role identity.
- **IZAKHONO FORTRESS:** security, fraud/risk controls, review governance, escalation, decision audit and human adjudication.
- **Provider:** performs only the contracted verification tasks and returns evidence/results through a controlled adapter.

The provider must not become the owner of IZAKHONO identities, customer relationships, verification policy or final onboarding decisions. A provider result is evidence for an IZAKHONO-controlled decision; it is not an automatic approval instruction.

## 3. Requested capability response

For each capability, mark **Available / Not available / Partner supplied / Roadmap**, identify the exact product/module and licence, and attach supporting documentation.

### A. Individual identity and document verification
1. South African Smart ID card: list every supported card revision and front/back checks.
2. South African green ID book: specify support, limitations and whether accepted for current verification.
3. South African passport, driver's licence, refugee/asylum and residence documents.
4. Foreign passports and residence permits for the countries supported.
5. OCR, MRZ, barcode, RFID/NFC and cross-field consistency checks.
6. Image quality, document alteration, counterfeit, screenshot/replay and presentation-attack checks.
7. Exact document database/pack version, release cadence and licensing dependency.
8. Issuer/government database verification versus document-image analysis: clearly distinguish the source and assurance level.

### B. Biometrics
1. 1:1 face comparison and reference-image provenance.
2. Passive and active liveness options; specify whether PAD is independently tested.
3. Presentation attack classes tested (print, screen replay, masks, injection, deepfake or other).
4. Score semantics, thresholds, calibration and recommended human-review bands.
5. False acceptance and false rejection metrics, sample sizes, demographic breakdowns and independent test reports.
6. Accessibility, low-bandwidth/device fallback and non-biometric alternative.
7. Whether face templates/embeddings are created, retained, exported or used for model training.

### C. KYB, directors and beneficial owners
1. Company registration and status checks, including exact CIPC source and access basis.
2. Director and officer verification and source provenance.
3. Beneficial ownership/UBO and controller checks; specify what is directly sourced versus customer supplied.
4. Authorised representative and mandate validation.
5. Company address, VAT/tax and bank-account verification, where offered.
6. Company data freshness, update frequency, correction/dispute mechanism and source licensing.

### D. Screening and ongoing monitoring
1. Sanctions, PEP/PIP, adverse media and crime datasets; identify each underlying source.
2. One-off versus ongoing screening, rescreen cadence and event triggers.
3. Match scoring, false-positive management, transliteration and alias handling.
4. Adverse-media coverage and whether it is included in standard AML/PEP products or separately licensed.
5. Case evidence, source links, timestamps, reviewer notes and exportability.

### E. API and integration
1. API reference, OpenAPI specification, SDKs and sandbox availability.
2. Authentication model, mTLS support, IP allowlisting, key rotation and service-account controls.
3. Webhook signature verification, replay protection, retry policy and delivery guarantees.
4. Idempotency, correlation IDs, rate limits, concurrency and timeout behaviour.
5. Normalised machine-readable outcomes, reason codes and evidence/result digests.
6. Versioning, deprecation notice and backward-compatibility policy.
7. Ability to operate behind IZAKHONO-controlled backend services without vendor secrets in browsers.
8. Support for customer-controlled/on-premises/private-cloud deployment, if available.

### F. Security, privacy and legal
1. Legal entity contracting and all subprocessors.
2. Processing locations, storage locations, backup locations, support access locations and cross-border transfers.
3. POPIA operator/responsible-party roles, written operator agreement, processing instructions and assistance with data-subject requests.
4. FICA support claims and the precise controls/services supplied; do not represent software as transferring the accountable institution's legal duties.
5. Data retention by data type, deletion timelines, backup deletion and deletion certification.
6. Encryption in transit/at rest, key management, tenant isolation and privileged access.
7. Independent security assurance (e.g. current ISO/SOC reports where held), penetration testing, vulnerability handling and incident notification timelines.
8. Security incident response, business continuity, disaster recovery and recovery objectives.
9. Whether customer data, identity documents, images, biometrics, prompts or outputs are used for model training, product improvement or analytics.
10. Audit logging, administrative access logs and customer access to audit evidence.

### G. Operations and service levels
1. Availability SLA and exclusions; support hours and severity response times.
2. Median, p95 and p99 processing times by capability.
3. Throughput/concurrency and worker sizing.
4. Outage, degraded-mode, queueing, retry and recovery behaviour.
5. Change notice, SDK/database updates and rollback support.
6. Named escalation route and customer success/technical support model.

### H. Commercial response
Provide itemised ZAR and/or currency pricing, clearly identifying VAT, currency conversion and validity:
1. Setup, onboarding, implementation and integration fees.
2. Per-check/per-transaction pricing by capability and outcome.
3. Monthly/annual minimums, committed volumes and overage rates.
4. Sandbox, staging, production and additional environment charges.
5. SDK, API, document-pack, biometric, database and licence/module charges.
6. Hosting, infrastructure, support, storage, egress, renewals and upgrade fees.
7. Manual review, resubmission, retry and failed/duplicate request charges.
8. Volume tiers and group-wide pricing across multiple legal entities.
9. Contract term, price escalation, renewal, termination and exit charges.
10. Any restrictions on using the service across multiple IZAKHONO subsidiaries/products.

## 4. Mandatory South African evidence pack

Attach a document-by-document matrix containing:
- document name and issuing authority;
- exact supported revision/version and side(s);
- capture method and supported checks;
- whether checks are image-based, chip-based or issuer/database-backed;
- exact licensed module and document database pack;
- last validation date and known limitations;
- independent test evidence and known error rates;
- countries/regions and customer eligibility restrictions.

For any claimed Home Affairs, CIPC, government or other authoritative source, identify whether the connection is direct, licensed, reseller-mediated, cached or derived. Describe legal authority/data rights and freshness. A vendor marketing statement or coverage percentage alone is insufficient.

## 5. Standard proof-of-capability (PoC)

A common protocol will be agreed before any vendor receives test material. The PoC should include:
- lawful, controlled South African document samples covering agreed Smart ID revisions and other accepted documents;
- genuine, damaged, low-quality and controlled attack samples;
- agreed face-match/liveness scenarios and presentation-attack tests;
- false-accept/false-reject measurement with confidence intervals and sample-size disclosure;
- normal and peak concurrency, latency, timeout, retry and outage tests;
- audit export, result correlation, deletion and data-location verification.

No live customer identity documents or biometric data may be supplied for a demonstration unless IZAKHONO has separately approved the lawful basis, notice, contract, security controls, test purpose and retention. Synthetic or vendor-provided test data should be used initially.

## 6. Required response format

Please return:
1. Executive summary and proposed capability modules.
2. Completed response to Sections 3–4, with evidence references.
3. Architecture and data-flow diagram.
4. Security/privacy assurance pack and subprocessor list.
5. South African document/source coverage matrix.
6. API/SDK and sandbox access process.
7. Itemised commercial proposal.
8. Draft service levels and contractual terms.
9. Customer references in comparable regulated/high-volume use cases, subject to reference permission.
10. Named technical, security/privacy and commercial contacts.

For every answer, distinguish **currently generally available**, **available only by custom agreement**, **partner supplied**, **limited/early access**, and **roadmap**. Identify the date and version of each supporting document.

## 7. Evaluation method

Responses will be assessed against the group's mandatory pass/fail gates and weighted scorecard in `docs/IZAKHONO-PAY-CENTRAL-IDV-PROVIDER-EVALUATION.md`.

The evaluation may select different providers for document authenticity, biometric checks, government/database checks, KYB, sanctions/PEP/adverse media and manual review. A composite architecture is acceptable where it improves assurance, resilience or total cost without duplicating canonical identity or weakening privacy/security controls.

No vendor score, award or production approval will be inferred from participation in this RFI.

## 8. Confidentiality and contact

Do not send identity documents, biometric samples, production credentials, customer records or confidential group security details in an initial RFI response. Any confidential exchange will use a separately approved channel and, where required, an NDA and data-processing agreement.

**IZAKHONO PAY — Identity Verification Provider Evaluation**  
**RFI reference:** IZP-RFI-IDV-001  
**Response contact:** To be designated by IZAKHONO PAY before external issue.  
**Response deadline:** To be confirmed in the formal invitation.

## 9. Internal issue checklist — do not send to vendors

- [ ] Owner approval to issue the RFI.
- [ ] Confirm legal contracting entity and approved response mailbox.
- [ ] Confirm vendor legal names and official sales/procurement contact routes.
- [ ] Approve NDA template for any confidential technical exchange.
- [ ] Approve lawful PoC design and test-data provenance.
- [ ] Approve recipients and access permissions for vendor responses.
- [ ] Do not provide production credentials, private architecture secrets or customer data.
- [ ] Record each response, version, date, evidence source and clarification in the evaluation register.
- [ ] Keep provider selection, purchase and production activation as separate approval decisions.
