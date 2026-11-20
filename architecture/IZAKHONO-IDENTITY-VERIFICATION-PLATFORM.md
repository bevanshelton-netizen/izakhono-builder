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


## Security audit addendum — 2026-11-19

The deployed version 16 handler and the PR branch source were inspected alongside the live `identity` schema. This review identified a release-blocking tenant-boundary gap; the current user-scoped implementation must not be represented as entity-scoped authorisation.

### Verified implementation facts

- The current request authenticator validates a Supabase Auth bearer token and returns only the Supabase user UUID. It does not introspect the canonical IZAKHONO ID service, resolve an active entity membership, or bind a request to an entity context.
- `identity.verification_cases` has `opened_by` and `subject_id`, but no `entity_id` or membership reference. The other identity tables likewise do not carry an entity scope.
- Case lookup is restricted by case UUID and `opened_by = authenticated user UUID`. This is a user-ownership check, not a tenant/entity-membership check.
- Child records (evidence, screenings, decisions, relationships and consent) are queried or written through the case's subject/case IDs after that user-owned case check. This does not prove isolation between entities or product memberships belonging to the same person.
- Business subject creation currently creates a subject and case for the caller without resolving an authorised business membership or canonical entity.
- The live database schema confirms the absence of entity and canonical membership columns in the eight identity tables.

### Required remediation before pilot or customer onboarding

1. Establish the canonical IZAKHONO ID introspection endpoint and server-side credential through the approved deployment secret channel; never place the credential in source control or chat.
2. Define the authoritative entity/membership contract with IZAKHONO ID, including active membership, entity ID/slug, role, expiry/revocation semantics and the trusted source of product scope.
3. Design an additive migration for entity and membership references, including a safe backfill/reconciliation plan for existing cases. Do not infer an entity from user metadata, request body, URL parameters or untrusted JWT user metadata.
4. Require entity context on every case creation, list, read and mutation. Enforce ownership through the canonical active membership and server-derived entity ID; ensure every child record is reached only through a case already authorised in that entity context.
5. Add explicit reviewer/service permissions and audit actor/entity attribution; preserve least privilege and existing immutable decision/audit semantics.
6. Test cross-user, cross-entity, same-user/multiple-entity, revoked-membership, expired-session, guessed-case-ID and child-resource IDOR scenarios using real authenticated sessions.
7. Only after independent review may the corrected version be deployed. Keep the existing production handler and customer-facing routes unchanged until migration, compatibility and rollback plans are approved.

### Release decision

**BLOCKED — no pilot, public onboarding, production approval decisions, merchant activation or PR merge.** The existing version 16 deployment remains an authenticated intake foundation only. It is not yet a tenant-safe multi-entity verification service. No production schema, grants, policies, gateway routing or customer-facing behavior were changed during this audit.

### Additional operational observations

- The gateway's CORS helper defaults to reflecting any request origin when `IDENTITY_ALLOWED_ORIGINS` is unset. Before browser exposure, configure and verify an explicit origin allowlist against actual authorised clients; do not make an unverified production change that could interrupt existing gateway consumers.
- Evidence uploads have MIME, magic-byte, size and SHA-256 checks, but no malware scanning or external issuer validation. Hashing and MIME checks do not establish document authenticity or safety.
- The existing FORTRESS schema's access boundary remains separate and unresolved. Its data plane and authorised integration route must be established before wiring review cases into it; do not grant broad schema/table access as a shortcut.


## Canonical identity contract and deployment discovery — 2026-11-19

A further source-level review of `products/izakhono-id/app.py` found additional integration requirements that must be resolved before writing or applying a tenant migration.

### Canonical ID identifier formats

The canonical IZAKHONO ID service does not use UUID identifiers for its core identity records:
- entity IDs are `ent_` followed by a 32-character hexadecimal UUID;
- user IDs are `usr_` followed by a 32-character hexadecimal UUID;
- membership IDs are `mem_` followed by a 32-character hexadecimal UUID.

The existing verification schema uses PostgreSQL UUID columns for its own subjects/cases and `auth.users` foreign keys. It must not attempt to store canonical entity/user/membership identifiers in UUID columns or create false foreign keys across the independent SQLite identity service. The additive tenant-binding migration must use validated text identifiers (or a formally approved stable mapping table) and explicit indexes/constraints appropriate to these opaque canonical IDs.

### Introspection response is not yet sufficient for a safe principal binding

The original internal introspection response returned email as `subject` and omitted stable `user_id` / `membership_id` claims. The PR branch now extends the internal-only response additively with `user_id`, `membership_id`, and `session_id`, while retaining the existing `subject` email field for compatibility. The corresponding ID service test now asserts stable claims for the same user's two separate entity memberships, and rejects a wrong internal key and a revoked session. These changes are source-only and are not deployed to a production ID runtime.

Email must never be used as an identity join key. Before gateway integration, run the ID CI suite and add/verify explicit expiry, inactive-user, inactive-entity and inactive-membership contract cases in addition to the current revoked-session and cross-entity cases.

### Deployment discovery

- The linked Vercel team/project inventory was inspected. It contains numerous IZAKHONO product projects, but no project named or linked as `izakhono-id`.
- The known IZAKHONO ID runtime is still configured for a host/port process (defaults `127.0.0.1:9696`) and uses a local SQLite data directory. The repository source and connected deployment inventory do not establish a production HTTPS origin, persistent production volume/backup strategy, active node, DNS target or TLS certificate.
- Prior NODE01 infrastructure records identify `NODE01` / `IZ-GATEWAY-01` and `api-owned-node` as planned/provisioning, with no endpoint. This is consistent with the current deployment discovery; it is not evidence of a live host.
- Do not deploy the SQLite identity service to ephemeral serverless storage. A production target must provide durable encrypted storage, backups and restore testing, private network ingress, TLS, monitoring, controlled secret injection and an owner-controlled recovery path.

### Safe next implementation sequence

1. Extend canonical ID internal introspection to return `user_id` and `membership_id` in addition to current claims; add tests without changing login/session semantics.
2. Provision the canonical ID service on an approved persistent runtime and verify HTTPS health, durable database path, backups, TLS and internal-key rotation. NODE01 remains the documented intended target, but no runtime is presently verified.
3. Define a versioned service-to-service contract. The verification gateway must present the canonical ID session token to introspection over TLS using the internal key; the key is stored only in the gateway's protected secret store.
4. Use server-returned `user_id`, `entity_id`, `membership_id`, `role` and expiry to establish a trusted principal. Never map by email or accept entity/membership values from request payloads.
5. Design an additive text-ID tenant binding schema, reconcile existing cases explicitly, and scope all parent and child reads/writes to the authenticated entity and permitted role.
6. Test against a staging ID deployment with seeded multiple entities and memberships, including same-user cross-entity isolation, revoked memberships, expiry and IDOR attempts.
7. Only after verified migration, rollback, CI, end-to-end and independent security evidence may a controlled production rollout be considered.

**Release remains BLOCKED.** No production deployment, schema migration, permission change, DNS/TLS change or customer-facing behavior was modified as part of this discovery.


## Follow-up remediation — 2026-11-20

A dedicated source branch, `fix/idv-canonical-entity-boundary-v1`, was created from the existing IZAKHONO IDV foundation PR head. It reuses the existing gateway, identity schema, private evidence bucket and canonical ID source; it does not create a replacement platform.

Source changes on that branch:

- Introduce a canonical ID introspection client that requires HTTPS, the protected internal key, an active session and unexpired stable user/entity/membership identifiers.
- Make the IZAKHONO ID session token the IDV API bearer credential. Supabase Auth JWTs are not treated as canonical business membership proof.
- Scope cases by server-derived entity ID, membership ID and canonical user ID.
- Bind KYC subjects to canonical user IDs and KYB subjects to canonical entity IDs.
- Bind relationships and consent records to their verification case.
- Attribute evidence submissions, decisions and audit events to canonical IDs.
- Require an owner-configured product-to-entity map and explicit CORS allowlist.
- Add pure contract tests for active/revoked/expired sessions, identifier validation, exact CORS matching and product/entity binding.
- Keep verification decisions fail-closed as REVIEW.

A review-only SQL draft is present at `docs/IZAKHONO-IDENTITY-ENTITY-SCOPE-MIGRATION-DRAFT.sql`. It deliberately does not infer tenant ownership for existing records. It must be converted to a proper Supabase CLI migration after reconciling the checked-in migration history with the live project.

### Current blockers

1. The canonical IZAKHONO ID service still has no verified production HTTPS endpoint, durable runtime, TLS/DNS and backup/restore evidence.
2. No production internal introspection credential is available or installed.
3. No approved product-to-canonical-entity mapping has been configured.
4. The additive entity-scope schema draft has not been converted into a migration or tested against a disposable branch.
5. Malware scanning and external issuer verification are not implemented.
6. Regula and other external provider credentials/contracts are not configured.
7. FORTRESS reviewer access and reviewer workflow are not yet proven end-to-end.
8. No authenticated staging cross-entity, same-user/multiple-membership, revoked-session, expired-session or IDOR test evidence has been accepted.

The follow-up branch is source-only. No Supabase production schema, grants, storage policies, Vercel deployment, DNS, secrets, merchant status or customer-facing traffic was changed.


## Regula provider evaluation — 2026-11-20

Regula remains the preferred evaluation candidate for document and biometric verification, subject to a proof-of-capability, commercial proposal, privacy/legal review and security assessment.

The official documentation snapshot lists Document Reader SDK 9.10, Face SDK 8.4.1 and IDV Platform 3.10. The Document Reader 9.9 release notes explicitly mention an updated South Africa ID Card barcode parser; this is not proof of coverage for every South African document variant. Smart ID card, legacy green ID book, passport and driving-licence support must be demonstrated with agreed samples.

The full Regula IDV Platform has material infrastructure dependencies: MongoDB 8.0+ or Atlas, a message broker, S3-compatible/NFS storage, and optionally a vector database. Its internal architecture includes API, Workflow, Scheduler, Audit and Indexer services. The existing IZAKHONO Supabase/PostgreSQL project does not replace the documented MongoDB requirement.

The current preferred technical evaluation path is therefore:
1. Evaluate Document Reader and Face services behind the IZAKHONO-owned provider adapter.
2. Keep all Regula services private and reachable only through the authenticated IZAKHONO/FORTRESS boundary.
3. Evaluate the full Regula IDV Platform separately against the cost, operations, persistence, broker, MongoDB, storage and GPU requirements.
4. Do not adopt the full platform until a written quote, data-flow review, licence model and deployment design are accepted.

Regula documentation states that standalone Document Reader and Face SDK services do not provide their own access-control layer, whereas the IDV Platform API provides authentication/authorization and acts as a gateway to processing services. IZAKHONO must not expose standalone processing services directly to browsers or the public internet.

Detailed assessment: `docs/IZAKHONO-REGULA-TECHNICAL-DUE-DILIGENCE.md`.

Official references:
- https://docs.regulaforensics.com/develop/overview/
- https://docs.regulaforensics.com/develop/doc-reader-sdk/release-notes/9-9/
- https://docs.regulaforensics.com/develop/idv/overview/architecture/
- https://docs.regulaforensics.com/develop/idv/administration/deployment/
- https://docs.regulaforensics.com/develop/idv/administration/security/
- https://docs.regulaforensics.com/develop/face-sdk/web-service/installation/

No Regula licence, production endpoint, credentials, supplier contract or live processing is configured.


## Live database verification and migration reconciliation — 2026-11-20

Read-only inspection of the connected IZAKHONO WebStart Supabase project confirmed:

- The eight `identity` tables already exist.
- All eight identity tables have RLS enabled and forced.
- Each identity table has one service-role-only policy; service_role has the required table privileges.
- The private `identity-evidence` bucket exists, is not public, and is limited to PDF/JPEG/PNG with a 10 MiB object limit. No browser object policy referencing this bucket was found.
- All eight identity tables had zero rows at the time of inspection.

The live migration history records:
- `20261119061402_izakhono_identity_verification_v1`
- `20261119061439_expose_identity_schema_service_only`
- `20261119061842_identity_service_role_rls_policies`

The original PR branch contains migration filenames `20261119090000_izakhono_identity_verification_v1.sql` and `20261119091500_identity_service_access_and_storage.sql`. These names do not match the applied live migration history. Do not replay or apply those files blindly. Reconcile the exact live SQL, repository migration files and Supabase migration history before any migration deployment.

The review-only entity-scope SQL draft includes a preflight that aborts if any identity records exist at application time. It does not assign tenant ownership by inference. The final migration must be generated through the Supabase CLI after the migration-history reconciliation and tested on a disposable branch/project.


The provider-neutral adapter contract is now implemented in `supabase/functions/izakhono-gateway/verification-providers.ts`. The default registry exposes Regula as `not_configured`; it has no vendor transport, licence or credentials. The adapter accepts only evidence references/hashes and returns normalised provider evidence. A provider `clear` result is not an IZAKHONO approval decision. The actual Regula transport remains blocked on vendor-confirmed API/schema, test licence, secure endpoint and infrastructure decisions.


## FORTRESS reviewer integration boundary — 2026-11-20

Read-only inspection found an existing `fortress` database schema containing case, evidence, finding, entity and mission tables. The schema is not exposed to `service_role`, `authenticated` or `anon` (no schema USAGE grant was present), and no table policies were returned for that schema. The existing `izakhono-fortress-intelligence` Vercel project has SSO protection enabled and no custom production domain was listed.

Do not grant the IDV gateway direct access to the FORTRESS schema and do not bypass the FORTRESS SSO boundary. The IDV gateway currently records `review_required` / `in_review` and fails closed. A future reviewer integration must be exposed by a FORTRESS-owned, owner-approved service API with its own least-privilege service identity, entity-scoped request contract, audit correlation and explicit approval of the service-to-service trust path.

Until that interface exists and is tested, human review remains a recorded state in the identity-verification service, not a completed FORTRESS workflow.
