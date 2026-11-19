# IZAKHONO IDENTITY & BUSINESS VERIFICATION PLATFORM

**Canonical project name:** IZAKHONO IDENTITY & BUSINESS VERIFICATION PLATFORM  
**Project ID:** IZ-IDV-001  
**Portfolio classification:** Shared IZAKHONO Core Infrastructure / Identity & Compliance  
**Primary owners:** IZAKHONO ID (identity experience), FORTRESS (risk, policy and audit), IZAKHONO PAY (merchant onboarding consumer)

## Purpose

Provide a reusable KYC/KYB service for authorised IZAKHONO products. This is shared infrastructure, not a replacement for FORTRESS, IZAKHONO PAY, the Business Creation Engine, or any existing product.

## Existing infrastructure audit

The active IZAKHONO WebStart Supabase project already contains:
- `fortress_business_profiles`
- `fortress_identity_evidence`
- `fortress_compliance_checks`
- `fortress_compliance_decisions`
- `fortress_merchant_applications`
- `izp_kyb_profiles`, `izp_merchant_applications`, and `izp_merchants`
- `fortress_run_kyb_decision(uuid)` and existing merchant activation/production gates

The existing KYB function is a basic deterministic decision routine. It returns REVIEW when verified evidence is missing and records decisions/checks. It does not itself verify documents against CIPC/SARS, perform biometric liveness, or call sanctions/PEP/adverse-media providers.

Current database inspection found:
- one FORTRESS business profile with KYB still pending;
- 12 compliance-check rows and one compliance-decision row;
- zero rows in `fortress_identity_evidence`, `fortress_merchant_applications`, `izp_kyb_profiles`, and `izp_merchant_applications`;
- no identity-evidence row-level policies were returned in the inspected policy set. Do not expose the existing evidence table to browser roles until its access model is remediated.

## Architecture and ownership

- **IZAKHONO ID:** individual and business identity journeys, profile linkage, authentication and consent UX.
- **KYC:** individual identity proofing, document checks, liveness where lawful and proportionate, address evidence, and ongoing identity-risk refresh.
- **KYB:** legal entity verification, registration status, directors, authorised representatives, beneficial owners/controllers, ownership/control graph, and business address.
- **FORTRESS:** risk scoring, policy evaluation, sanctions/PEP/adverse-media result handling, human-review queue, decision versioning, audit evidence and fail-closed controls.
- **IZAKHONO PAY:** consumes verified status and only activates merchants after all payment-specific provider, credential, webhook, settlement and production gates pass.
- **Business Creation Engine:** initiates business onboarding and consumes the same verified business profile subject to purpose limitation and consent/legal basis.

## Data model

The additive `identity` schema provides:
- `subjects`: stable individual/business subjects, linked to auth identities or existing product records;
- `verification_cases`: product- and country-scoped KYC/KYB cases and lifecycle;
- `evidence`: private storage object references, hashes and validation metadata (no raw documents in database rows);
- `subject_relationships`: directors, beneficial owners, shareholders, trustees, partners and authorised representatives;
- `screenings`: provider-neutral sanctions, PEP, adverse-media, fraud, identity-document and company-registry outcomes;
- `consent_grants`: purpose-, recipient- and scope-bound sharing grants;
- `decisions`: immutable APPROVE / REVIEW / REJECT records tied to policy version and evidence snapshot;
- `audit_events`: append-only, privacy-minimised event evidence.

The schema is private to server-side service access. It is not to be added to PostgREST's exposed schemas. Browser roles receive no schema/table grants and there are no permissive RLS policies.

## Workflow

1. Create or resolve an individual/business subject without duplicating source-of-truth product records.
2. Create a KYC or KYB verification case for a declared product purpose and country.
3. Capture explicit notice/consent or record the applicable lawful basis before processing/sharing.
4. Collect evidence into a private object store; persist only object references and hashes in the database.
5. Validate document integrity and issuer/registry information through approved provider adapters.
6. Resolve directors, beneficial owners and controllers; verify each natural-person relationship.
7. Run risk-based sanctions, PEP, adverse-media and fraud screening with freshness/expiry controls.
8. Evaluate deterministic rules; route ambiguous, potential-match and high-risk outcomes to trained human review.
9. Persist immutable decision and audit evidence. Fail closed on unavailable providers, stale results, missing UBOs, or unresolved matches where policy requires.
10. Share only the minimum verified attributes/status with an authorised consumer under valid consent/legal basis.
11. Re-verify on expiry, material change, risk trigger, or applicable policy schedule.

## Status semantics

- `APPROVE`: required evidence and checks passed for the declared purpose and policy version.
- `REVIEW`: unresolved evidence, provider match, ownership/control gap or human adjudication required.
- `REJECT`: hard policy prohibition or failed verification with a recorded reason.
- `EXPIRED`: verification evidence is no longer current; consumer access must be re-evaluated.

Verification status is purpose-scoped. Approval for one product or purpose must not automatically authorise a different regulated or higher-risk use.

## South African launch scope

Initial jurisdiction: South Africa (ZA). Integrations must use authorised sources and approved provider contracts:
- CIPC for company registration and director/office-bearer evidence;
- SARS for tax status only where lawful access/mandate exists;
- FICA-aligned customer due diligence and risk-based ongoing monitoring;
- POPIA data minimisation, purpose limitation, security safeguards, retention and data-subject rights.

No direct registry access, data-provider contract, or legal compliance certification is implied by this specification.

## Security and operational controls

- Do not store raw identity documents, full ID numbers, biometric templates, or unredacted screening payloads in general-purpose JSON metadata.
- Keep evidence objects in private encrypted storage with short-lived signed access, strict tenant scoping, malware scanning and retention/deletion workflows.
- Hash provider results and evidence snapshots; keep provider references and minimal outcome metadata.
- No browser access to the private schema. Server-side callers use least-privilege service credentials.
- Human reviewers require role separation, MFA, reason codes and full audit trails.
- Make decisions idempotent and versioned; never overwrite prior decisions.
- Never infer approval from mere document upload or an unverified provider response.
- Keep payment activation, live routing, credentials and settlement independently gated by FORTRESS.

## Delivery stages

### Stage 1 — foundation (deployed)
- canonical project identity and architecture contract;
- eight-table private identity persistence schema;
- append-only decision/audit records;
- private `identity-evidence` storage bucket;
- service-role-only schema/table access and forced RLS with service-role-only policies.

### Stage 2 — service and evidence (API deployed; verification pending)
- authenticated KYC/KYB case, evidence-upload, submit, relationship, consent and evaluation routes integrated into the existing IZAKHONO gateway (version 15);
- Supabase Auth token validation in the identity module, user-scoped case retrieval, private file storage, MIME/magic-byte/size checks and SHA-256 evidence hashes;
- fail-closed evaluation creates REVIEW decisions only; no self-approval path exists;
- runtime end-to-end request tests and independent code/security review remain outstanding.

### Stage 3 — provider adapters and South African workflow
- CIPC/company-registry adapter under authorised access;
- individual identity/document and liveness provider adapter;
- sanctions/PEP/adverse-media provider adapter;
- human review console and exception queues;
- provider outage, timeout, retry and stale-result controls.

### Stage 4 — product integration
- IZAKHONO ID onboarding UX;
- IZAKHONO PAY merchant activation integration;
- Business Creation Engine onboarding;
- consented verification-status reuse across approved products.

### Stage 5 — assurance and release
- independent privacy/security review;
- POPIA/FICA legal review by qualified advisers;
- automated abuse, isolation, replay, idempotency and disaster-recovery tests;
- provider production credentials and commercial contracts;
- controlled pilot, production evidence and owner release approval.

## Release boundary

The database and authenticated intake/evidence API are deployed, but this is not a complete regulated KYC/KYB verification service. No external identity-document, biometric/liveness, CIPC, SARS, sanctions, PEP or adverse-media provider is configured; uploaded evidence is not malware-scanned or externally verified; no reviewer console or reviewer-role provisioning is deployed; and the end-to-end API has not yet passed a real authenticated user-session test. The evaluation engine therefore returns REVIEW and cannot issue APPROVE. Existing FORTRESS and IZAKHONO PAY gates remain closed unless their own acceptance evidence passes.
