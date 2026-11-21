# IZAKHONO PAY — Regula Technical Due-Diligence Record

**Record:** IZP-REGULA-DD-001  
**Assessment date:** 2026-11-20  
**Status:** Preferred evaluation candidate; not approved for production  
**Business owner:** IZAKHONO  
**Integration owner:** IZAKHONO PAY / IZAKHONO ID  
**Security authority:** FORTRESS

## 1. Purpose and decision boundary

Regula is the preferred initial candidate for identity-document processing and biometric verification, subject to technical, commercial, legal, privacy and security due diligence.

This record does not appoint Regula as an exclusive supplier, authorise a purchase, establish a production integration, or certify POPIA/FICA compliance.

IZAKHONO must retain its own identity records, customer relationships, verification policies, audit history and final onboarding decisions. Regula supplies verification technology and evidence; it does not become IZAKHONO's identity authority.

## 2. Product family and current documentation snapshot

The Regula developer overview currently lists:
- Document Reader SDK 9.10 — identity-document reading and authenticity checks.
- Face SDK 8.4.1 — face matching, detection and liveness.
- IDV Platform 3.10 — orchestration of complete identity-verification workflows.

Official overview: https://docs.regulaforensics.com/develop/overview/

The versions above are a documentation snapshot, not a purchase recommendation. Before implementation, obtain the current supported release, release notes, supported platform matrix and end-of-support policy from Regula.

## 3. Relevant capabilities

### 3.1 Document Reader SDK

Regula documents capabilities including:
- Visual-zone OCR and document-type detection.
- MRZ recognition and check-digit validation.
- Barcode parsing and validation.
- RFID/NFC chip reading and authentication where the document and device support it.
- Document-image quality assessment.
- Document liveness and screenshot/electronic-display checks.
- Automatic authenticity control.
- Cross-checking data between visual zone, MRZ, barcode and RFID.
- Date, country-code and document-number validation.

References:
- https://docs.regulaforensics.com/develop/doc-reader-sdk/
- https://regulaforensics.com/products/document-reader-sdk/
- https://regulaforensics.com/explore/technologies/automatic-authenticity-control/

### 3.2 South African document coverage

The Document Reader SDK 9.9 release notes explicitly record an updated barcode parser for the South Africa ID Card.

Reference:
https://docs.regulaforensics.com/develop/doc-reader-sdk/release-notes/9-9/

This is useful evidence of South African document support, but it does not prove that every South African document variant is supported or that every security feature is validated.

Regula must demonstrate and document coverage for each intended launch document:
- South African Smart ID Card — front, back and barcode.
- Green barcoded ID book, if still accepted by the applicable onboarding policy.
- South African passport.
- South African driver's licence.
- Relevant foreign passports and residence permits.

The test must distinguish extraction success from authenticity verification. Reading a document is not proof that it is genuine or that it belongs to the presenter.

### 3.3 Face SDK

Regula documents face detection, 1:1 comparison, liveness assessment and 1:N identification/search.

For Face SDK Web Service:
- Detection and 1:1 comparison do not require the additional components listed for liveness and identification.
- Liveness requires configured storage and database components.
- Identification/search requires additional vector-storage/database components.
- GPU processing has separate NVIDIA driver/CUDA requirements.
- The documented liveness workflow requires HTTPS.

References:
- https://docs.regulaforensics.com/develop/face-sdk/web-service/installation/
- https://docs.regulaforensics.com/develop/face-sdk/web-service/development/usage/liveness/
- https://docs.regulaforensics.com/develop/face-sdk/overview/licensing/

Regula's licensing documentation describes the Face SDK Web Service as intended for on-premises server-side integration and distinguishes online, software and mobile licence types. The precise licence and operating-system/container constraints must be confirmed in a written commercial proposal.

## 4. Full Regula IDV Platform — infrastructure implications

Regula IDV Platform is a complete workflow product, not merely a REST endpoint.

Its documented architecture includes:
- Backoffice/API gateway and authentication layer (the v3.10 documentation renames the API service to Backoffice while retaining the old service name for backward compatibility).
- Workflow engine.
- Scheduler.
- Audit service.
- Indexer.
- Message broker.
- MongoDB for structured platform data.
- S3-compatible, Azure Blob, Google Cloud Storage or NFS storage for binary data.
- Optional vector database for similarity/search workloads.
- Optional Kafka replication bus when multi-site replication is enabled.
- Document Reader and Face services as processing components.

The v3.10 deployment guide lists MongoDB 8.0+ (or MongoDB Atlas), a message broker such as RabbitMQ/Amazon MQ/Redis/Valkey, and S3-compatible/MinIO, Azure Blob, Google Cloud Storage or NFS storage. Kafka is listed separately as an optional replication bus for multi-site deployments. A vector database (OpenSearch 2.19+ or MongoDB Atlas) is optional for the Profile module.

References:
- https://docs.regulaforensics.com/develop/idv/overview/architecture/
- https://docs.regulaforensics.com/develop/idv/administration/deployment/
- https://docs.regulaforensics.com/develop/idv/release-notes/3-10/
- https://docs.regulaforensics.com/develop/idv/administration/rbac/

**Architecture consequence:** IZAKHONO's existing Supabase/PostgreSQL project is not a substitute for the MongoDB dependency specified for the full Regula IDV Platform. Do not assume that the complete platform can be deployed by adding a few endpoints to the existing Supabase project.

A full IDV Platform deployment therefore requires a separate infrastructure and total-cost assessment, including persistent storage, message broker, MongoDB operations, backup/restore, network segmentation, monitoring and any GPU capacity.

## 5. Recommended initial integration pattern

Until the full-platform cost and operations case is proven, evaluate a narrower integration using the Document Reader and Face services behind the IZAKHONO-owned provider adapter.

Proposed request path:

IZAKHONO business product
→ IZAKHONO PAY
→ IZAKHONO Verification API
→ FORTRESS policy and access checks
→ Provider Manager
→ Regula Adapter
→ Private Regula Document Reader / Face services
→ Normalised provider evidence
→ IZAKHONO decision and audit records.

Mandatory controls:
- Regula services are not directly exposed to browsers or public callers.
- Only the IZAKHONO adapter may reach Regula processing endpoints.
- All service credentials remain in the owner-controlled secrets manager.
- Use TLS 1.2 or later; prefer TLS 1.3 where supported.
- Use mTLS for private service-to-service traffic where feasible.
- Restrict Regula network egress and inbound paths.
- Use private object storage and short-lived authorised retrieval.
- Do not place raw documents, full identity numbers, face images, biometric templates or unredacted provider payloads in general-purpose logs or metadata.
- Persist provider references, normalised outcomes, evidence hashes and policy-versioned decisions in IZAKHONO-controlled records.
- Provider failure, timeout, stale evidence or uncertain match must not produce an approval.

## 6. Security findings requiring explicit validation

Regula's IDV Platform documentation states that the Platform API provides an authentication/authorisation layer, while standalone Document Reader SDK and Face SDK services do not themselves implement access control. The Platform API acts as a secure gateway to those services.

Reference:
https://docs.regulaforensics.com/develop/idv/overview/architecture/

Regula's security guide recommends TLS 1.2+, encrypted storage and volumes, secrets-manager storage for credentials, least-privilege policies, network segmentation, restricted logs and routing client access through the authenticated IDV API.

Reference:
https://docs.regulaforensics.com/develop/idv/administration/security/

IZAKHONO must therefore place standalone Regula services behind its own authenticated adapter boundary or use the authenticated Regula IDV Platform API. No standalone processing service may be exposed directly to the public internet.

## 7. Technical proof-of-capability test

Regula must provide a controlled demonstration and test licence for the following cases:

### Document tests
- Genuine South African Smart ID cards, including front/back and barcode.
- Supported legacy green ID book samples.
- South African passports.
- South African driver's licences.
- Foreign passports and residence permits relevant to launch markets.
- Expired, damaged, low-light, glare, cropped and low-resolution documents.
- Printed copies, screenshots, altered images and other controlled negative samples.
- MRZ/barcode/visual-zone mismatch.
- Unsupported or obsolete document types.

### Biometric tests
- 1:1 face matching using a verified document portrait and live capture.
- Active and passive liveness modes.
- Replay, print, screen, mask and presentation-attack scenarios.
- Camera quality and lighting variance.
- Accessibility and fallback for users unable to complete a particular capture flow.
- False acceptance and false rejection measurements using an agreed, lawful and representative test protocol.

### Operational tests
- Average and tail latency.
- Concurrent verification throughput.
- Service failure and retry behaviour.
- Provider outage and recovery.
- Data retention and deletion.
- Evidence export and auditability.
- Backup and restore.
- Offline or degraded-network behaviour where applicable.
- Version upgrade and rollback.

Regula must disclose supported thresholds, confidence semantics and known limitations. IZAKHONO must not invent or reinterpret undocumented vendor scores as probabilities.

## 8. Commercial and legal due diligence

Obtain written responses for:

1. Pricing model: per transaction, per verification, per user, per instance, per environment or annual licence.
2. Minimum annual commitment, volume tiers, overages and renewal escalators.
3. Separate pricing for Document Reader, Face SDK, liveness, RFID, mobile SDKs and IDV Platform.
4. Test/sandbox licensing and production licence activation.
5. Deployment rights: private cloud, on-premises, container, Linux and GPU.
6. Supported regions, data residency, support access and any telemetry/phone-home traffic.
7. Subprocessors and cross-border processing.
8. Data-processing agreement, POPIA operator obligations and breach cooperation.
9. Data retention, deletion, backup deletion and termination assistance.
10. SLA, support hours, incident response, vulnerability disclosure and patch timelines.
11. Indemnities, liability caps, audit rights and security assurance reports.
12. Licence portability, disaster recovery and exit/migration rights.

No pricing or legal terms are assumed in this record.

## 9. Provider-independence requirements

Regula must remain one adapter behind the IZAKHONO Verification API.

- No Regula-specific identifier may become the primary IZAKHONO identity key.
- No Regula-specific status may be stored as the sole group verification status.
- Regula response payloads must be normalised to IZAKHONO-owned result enums.
- Provider-specific thresholds must remain in adapter configuration and versioned policy.
- The same internal workflow must support an alternative document provider, alternative biometric provider and manual review.
- Replacing Regula must not require rewriting business applications, identity records or payment activation logic.

## 10. Evaluation outcome and next gates

**Current outcome:** Regula remains the preferred evaluation candidate for document and biometric technology. No unconditional supplier appointment or full-platform adoption is authorised.

Required next gates:
1. Obtain Regula technical demonstration and South African sample-document coverage statement.
2. Obtain test licences and sandbox access.
3. Complete technical proof-of-capability and security review.
4. Obtain commercial proposal and total-cost comparison.
5. Complete POPIA, data-residency, contract and legal review.
6. Compare the narrow SDK/Web Service pattern against the full Regula IDV Platform.
7. Approve an architecture decision record before implementing production adapters.

**Production status:** Not configured. No provider credentials, licence, contract, production endpoint or live biometric/document processing is represented as existing.

## 11. Official documentation index

- Developer overview: https://docs.regulaforensics.com/
- Product versions: https://docs.regulaforensics.com/develop/overview/
- Document Reader SDK: https://docs.regulaforensics.com/develop/doc-reader-sdk/
- Document Reader SDK 9.9 release notes: https://docs.regulaforensics.com/develop/doc-reader-sdk/release-notes/9-9/
- Face SDK: https://docs.regulaforensics.com/develop/face-sdk/
- Face SDK Web Service installation: https://docs.regulaforensics.com/develop/face-sdk/web-service/installation/
- IDV Platform architecture: https://docs.regulaforensics.com/develop/idv/overview/architecture/
- IDV Platform deployment: https://docs.regulaforensics.com/develop/idv/administration/deployment/
- IDV Platform security: https://docs.regulaforensics.com/develop/idv/administration/security/


## 12. Current source implementation boundary

The repository now contains a provider-neutral adapter contract in `supabase/functions/izakhono-gateway/verification-providers.ts` and an unconfigured `RegulaAdapter`.

The contract:
- Separates provider capabilities and outcomes from IZAKHONO's final decision.
- Requires canonical entity, membership and case references plus evidence hash/reference.
- Does not pass raw identity documents or biometric templates through the provider interface.
- Normalises only allowlisted outcome/check fields.
- Downgrades a vendor `clear` response to `inconclusive` if required normalized checks or the result digest are absent.
- Returns `unavailable` / `error` and requires review when the adapter is not configured or fails.
- Supports adding alternative adapters through the provider registry.

**This is an adapter contract and fail-closed placeholder, not a live Regula connector.** No Regula API endpoint, license, credentials, HTTP transport or production processing has been configured. The transport must be implemented only after Regula confirms the exact API/SDK, version, authentication, payload, result schema and deployment model in the technical demonstration.


## 13. Standalone Web Service API and perimeter security

The Document Reader Web Service processes documents through \`POST /api/process\`; the documented request includes a processing scenario and base64-encoded image data. Its service does not inherently authenticate callers and processes incoming requests without distinction. Regula recommends keeping it inside a closed perimeter and placing an authenticated proxy in front of it. Its security documentation describes reverse-proxy controls including Basic authentication and JWT authorization.

The Face SDK Web Service also does not inherently authenticate requests. Regula recommends a private perimeter and authenticated reverse proxy; its security documentation describes Basic authentication and mTLS patterns.

References:
- https://docs.regulaforensics.com/develop/doc-reader-sdk/web-service/development/usage/process/
- https://docs.regulaforensics.com/develop/doc-reader-sdk/web-service/administration/security/
- https://docs.regulaforensics.com/develop/face-sdk/web-service/administration/security/

**IZAKHONO rule:** Neither standalone Regula service may be directly internet-accessible. The only permitted route is an owner-controlled private service endpoint behind FORTRESS/network controls and the IZAKHONO adapter. Browser clients must never receive Regula service credentials.

## 14. Preliminary infrastructure sizing and licensing egress

Regula's current Document Reader Web Service getting-started documentation lists a minimum of 1 CPU and 3.5 GB RAM per worker. Each worker processes one request at a time. The Face SDK Web Service documentation lists a recommended 1 CPU and 4.5 GB RAM per worker; worker count depends on available hardware and licence type.

References:
- https://docs.regulaforensics.com/develop/doc-reader-sdk/web-service/getting-started/
- https://docs.regulaforensics.com/develop/face-sdk/web-service/getting-started/

These are vendor minimum/recommended figures, not IZAKHONO production sizing. Load testing must establish concurrency, latency, memory, CPU/GPU and storage requirements.

Regula documentation describes licensing-service communication for online licence models. The Face SDK FAQ states that the customer-hosted service keeps personal data on the customer's servers and does not communicate that personal data back to Regula; the licensing service is used to manage licence keys. Document Reader licensing documentation describes worker registration or transaction/heartbeat calls depending on licence type.

References:
- https://docs.regulaforensics.com/develop/face-sdk/web-service/faq/
- https://docs.regulaforensics.com/develop/doc-reader-sdk/overview/licensing/

Before network approval, Regula must document every outbound destination, payload category, cadence and failure mode for licence validation, updates, telemetry and support. IZAKHONO must permit only the minimum necessary egress and must confirm contractually that identity documents, face images and biometric data are not transmitted to licensing endpoints.

## 15. Required Regula demonstration questions

Regula must demonstrate, not merely state:

1. How a South African Smart ID card is captured and processed end-to-end.
2. The exact security checks and supported document database version used.
3. How \`/api/process\` is authenticated at the proxy and how service-to-service access is restricted.
4. How Face API liveness and 1:1 comparison are secured with mTLS.
5. How request IDs, evidence hashes and provider transaction references are correlated.
6. What identity/biometric data remains on the customer-controlled host.
7. What licence metadata leaves the network and which Regula endpoints are required.
8. How licensing behaves during a temporary loss of internet connectivity.
9. How document/Face service upgrades, database packs and licence renewals are delivered.
10. What data is retained in service logs, how logs are redacted, and how deletion is performed.


## 16. IDV Platform 3.10 RBAC consideration

Regula IDV Platform 3.10 introduces configurable RBAC with entity-level access restrictions for selected scopes, including sessions, workflows, persons, pools, cases, groups, roles, banlists and IAM applications. It also provides creator-ownership access for resources created by a user.

Reference:
https://docs.regulaforensics.com/develop/idv/release-notes/3-10/
https://docs.regulaforensics.com/develop/idv/administration/rbac/permissions/

This is a useful capability if the full IDV Platform is ever selected. It does not replace IZAKHONO ID or the IZAKHONO entity/membership authority. Any integration must explicitly map Regula entity IDs and Regula user/group permissions to IZAKHONO's canonical entity, membership and service-account controls. Regula must not be allowed to grant access broader than the IZAKHONO policy permits.


## 17. Documentation refresh — 2026-11-21

A fresh check of Regula's official developer documentation confirms that the current Document Reader SDK documentation is version **9.10**. The 9.9 release notes, dated 8 October 2026, explicitly list an updated parser for the **South Africa ID Card** barcode.

Official references:
- Current Document Reader SDK documentation (v9.10): https://docs.regulaforensics.com/develop/doc-reader-sdk/
- Document Reader SDK 9.9 release notes (8 October 2026): https://docs.regulaforensics.com/develop/doc-reader-sdk/release-notes/9-9/
- Regula product capability overview: https://regulaforensics.com/products/document-reader-sdk/

This strengthens the evidence that Regula has a South African ID-card barcode parser. It does **not** establish support for every South African identity document, every Smart ID card revision, all front/back security features, or successful authenticity verification. The proof-of-capability must record exact document model/revision, SDK/database pack version, enabled checks, result fields and observed false-accept/false-reject behaviour.

The v9.10 documentation page describes OCR, MRZ, barcode, RFID, image-quality and authenticity capabilities as dependent on the selected component and licence. The commercial proposal must therefore identify the exact licensed modules and document packs; a feature appearing in product documentation must not be assumed to be included in the quoted licence.

**Assessment remains unchanged:** Regula is the preferred candidate for evaluation, not an appointed exclusive supplier. No licence, contract, credentials, endpoint or production connector is configured.
