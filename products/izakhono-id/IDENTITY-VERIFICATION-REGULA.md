# IZAKHONO ID — Regula Integration and Due-Diligence Specification

**Decision:** Regula is the preferred primary identity-verification provider candidate across approved IZAKHONO businesses. This is not an exclusive appointment, production approval or claim that Regula has passed due diligence.

## Architecture decision

- IZAKHONO ID remains the group-wide identity-verification service.
- IZAKHONO PAY coordinates service access, metering and integration with onboarding/payment workflows.
- Each consuming legal entity retains its own customer relationship, lawful purpose, notices, risk appetite and regulatory obligations.
- Existing IZAKHONO ID authentication remains responsible for accounts, memberships, entity-scoped sessions and MFA. It does not become a document-authenticity or biometric verification engine.
- FORTRESS INTELLIGENCE remains separate for PEP, sanctions, adverse-media and entity screening. Regula document/face checks do not provide AML clearance.
- A provider-neutral contract isolates Regula and allows a later provider to be substituted without rewriting consuming business applications.

## Verification workflow

1. An authenticated IZAKHONO service obtains the active entity and membership context from IZAKHONO ID.
2. The service confirms the business purpose, legal basis, privacy notice/consent version and verification policy.
3. IZAKHONO ID creates an entity-scoped verification session with an idempotency key.
4. The approved provider receives only the minimum data needed to perform the requested checks.
5. The user completes document capture and any required face/liveness steps in the approved Regula SDK or hosted workflow.
6. A provider callback or authenticated server-side retrieval updates the session. Callback handling must verify authenticity, timestamp, replay protection and idempotency.
7. IZAKHONO ID normalizes the result and stores provider evidence references, not raw document images or biometric media.
8. The consuming business receives one of: verified, review_required, incomplete, provider_unavailable, or cancelled.
9. A designated human reviewer handles ambiguous/failing results. A verification result is not itself a final credit, fraud, employment or account-eligibility decision.

## Regula capability assessment

Regula's official documentation describes:
- Document Reader SDK for identity-document data extraction and authenticity checks.
- Face SDK for face matching, face detection and liveness assessment.
- IDV Platform for orchestrating complete identity-verification workflows.
- Integration between document and face components.

References:
- https://docs.regulaforensics.com/
- https://docs.regulaforensics.com/develop/overview/
- https://docs.regulaforensics.com/develop/doc-reader-sdk/overview/authenticity/
- https://docs.regulaforensics.com/develop/face-sdk/overview/
- https://docs.regulaforensics.com/develop/idv/overview/architecture/

## Mandatory Regula due-diligence questionnaire

### Technical
- Demonstrate supported South African identity documents, passports, permits and business-relevant document types.
- Confirm document authenticity, MRZ/barcode/RFID checks where applicable, data cross-checks, face match and liveness modes.
- Provide licensed sandbox access, SDK/API specifications, sample apps, supported platforms and version lifecycle.
- Explain callback signing, retries, idempotency, rate limits, service availability, latency, incident response and support SLAs.
- Demonstrate low-bandwidth and low-end Android performance relevant to South African customers.
- Confirm accessibility, manual fallback and assisted/offline onboarding options.

### Privacy and data residency
- Identify every processing location, subprocessor, hosting region and onward transfer.
- State exactly which images, videos, templates, extracted fields, device metadata and logs are retained, where and for how long.
- Confirm deletion APIs, backup deletion timelines, data-subject request support and breach notification obligations.
- Confirm whether biometric templates or document images are used for model training or secondary purposes; require prohibition absent separate lawful approval.
- Supply a POPIA-ready operator agreement, security schedule, subprocessor list and cross-border transfer mechanism.

### Commercial
- Price per attempt and per successful verification, including retries, failed checks, liveness, face match and document coverage.
- Minimum commitments, annual licences, SDK licences, deployment model charges, overages, support and renewal uplifts.
- Ownership and portability of verification records and evidence references on termination.
- Exit assistance, deletion certification and transition support.

### Legal and governance
- Confirm contracting entity, governing law, liability caps, indemnities, IP rights, audit rights and subcontracting permissions.
- Establish controller/responsible-party and operator roles for each processing purpose.
- Obtain South African privacy and financial-regulatory advice before any regulated workflow is activated.

## POPIA / FICA controls

- Biometric information is special personal information under POPIA. Identify and document a lawful section 27 basis and satisfy the ordinary Chapter 3 processing conditions as well.
- Give clear section 18 notices explaining purpose, mandatory/optional fields, recipients, cross-border transfers, retention, rights and contact details.
- Apply section 19 safeguards and section 20 operator controls; assess section 21 operator contracts and section 22 security-compromise notification procedures.
- Assess section 72 before any international transfer. Do not assume a vendor's generic privacy statement is sufficient.
- Ask privacy counsel to assess section 57 prior authorisation, including whether any proposed special-personal-information or criminal-behaviour processing on behalf of third parties triggers it.
- FICA applies to accountable institutions and their relevant activities, not automatically to every IZAKHONO company. Map each legal entity and product to Schedule 1 and its own risk management and compliance programme. Where applicable, use a risk-based customer due-diligence approach and keep ongoing due diligence, sanctions screening and reporting obligations separate from document verification.
- Do not market Regula as a complete KYC/AML solution. Document and biometric checks do not replace PEP/sanctions screening, beneficial-ownership checks, source-of-funds review or the accountable institution's own decisions.

## FORTRESS security baseline

- Default deny; explicit entity scope on every read/write.
- Composite entity/session foreign keys and tenant-isolation tests.
- No raw identity documents, selfies, video, biometric templates, passwords, access tokens or full ID numbers in logs.
- Encrypt sensitive data in transit and at rest; secrets only in the approved secret manager.
- Store provider references and minimal verification outcomes; use short retention for any transient capture material.
- Signed callbacks, timestamp tolerance, replay protection, unique event IDs and idempotent processing.
- Append-only audit events with hashed subject references and no sensitive payloads.
- Role separation for support, reviewer, security administrator and business owner.
- Rate limits, abuse detection, provider outage handling, monitoring, backup/restore and incident runbooks.
- Provider failure or uncertainty never grants access by default.

## Current code boundary

identity_verification.py supplies an entity-scoped service, provider protocol, Regula adapter boundary and normalized outcome policy. The Regula transport is injected and is not yet a live vendor API client. It must be implemented only against the exact licensed sandbox contract and tested with synthetic/test records. It deliberately does not guess Regula endpoints or claim vendor connectivity.

## Acceptance gates

- [ ] Regula confirms South African document coverage in writing.
- [ ] Regula sandbox credentials and test licence received.
- [ ] POPIA operator agreement, data locations, retention and subprocessors approved.
- [ ] Section 72 and section 57 assessments completed where applicable.
- [ ] FICA applicability matrix approved per legal entity/product.
- [ ] Provider callback/authentication and replay tests pass.
- [ ] Entity-isolation, idempotency, manual-review and provider-outage tests pass.
- [ ] Independent security/privacy review completed.
- [ ] Business owner and compliance officer approve the production policy.
- [ ] Production enablement separately authorized; no live activation by code merge alone.
