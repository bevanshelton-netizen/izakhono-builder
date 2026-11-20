# IZAKHONO Identity API — operational contract

Base URL:
`https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-gateway/identity`

**Previously deployed baseline:** the first gateway implementation accepted a Supabase Auth access token and scoped cases to a Supabase user UUID. That model did not prove IZAKHONO entity membership and is not sufficient for multi-entity onboarding. The follow-up remediation branch replaces it with canonical IZAKHONO ID session introspection.

**Canonical integration requirement:** the repository already contains IZAKHONO ID (`products/izakhono-id`), with entity-scoped sessions, TOTP MFA, session revocation, rate limiting and audit events. The new KYC/KYB API must consume that existing authority rather than establish a second customer identity system. Its internal introspection endpoint requires the configured IZAKHONO ID service URL and internal integration key; no production URL/key was present in the audited repository or connected deployment context. Until this integration is configured and tested, Supabase Auth is a temporary adapter and this API is not approved for broad customer onboarding.

## Available endpoints

- `GET /health` — authenticated service health and provider-readiness status.
- `POST /cases` — create a KYC individual or KYB business case. JSON: `{ "subject_type":"individual|business", "verification_type":"KYC|KYB", "country_code":"ZA", "product_code":"..." }`.
- `GET /cases` — list only cases opened by the authenticated user.
- `GET /cases/{caseId}` — retrieve owned case, evidence metadata, screening outcomes and decisions.
- `POST /cases/{caseId}/evidence` — multipart form with `file` and `evidence_type`. PDF/JPEG/PNG only, max 10 MB. Accepted evidence is stored in private `identity-evidence` storage; only its object reference, SHA-256 and non-sensitive metadata are stored in Postgres.
- `POST /cases/{caseId}/submit` — submit after the minimum evidence type is present (`identity_document` for KYC, `company_registration` for KYB).
- `POST /cases/{caseId}/relationships` — add a director/UBO/controller etc. to a KYB case. Relationship is initially unverified.
- `POST /cases/{caseId}/consent` — record purpose-, recipient- and scope-bound consent/legal-basis metadata.
- `POST /cases/{caseId}/evaluate` — run fail-closed evaluation and append a REVIEW decision until required provider checks and human review are available.

## Security and release boundary

- Identity database schema is exposed to PostgREST but schema/table grants are limited to `service_role`; anon and authenticated have no schema usage or table read privilege. RLS is enabled and forced with service-role-only policies.
- Evidence storage is private; there are no anon/authenticated object policies.
- The deployed baseline validates Supabase Auth and scopes cases to `opened_by`; the remediation branch instead requires an active canonical IZAKHONO ID session and scopes cases by server-derived entity ID, membership ID and canonical user ID.
- Uploads are size/MIME/magic-byte checked and hashed. This is not a malware scan; evidence remains unvalidated pending an approved scanning/verification service.
- No external CIPC, SARS, identity-document, biometric/liveness, sanctions, PEP or adverse-media provider is configured. The engine therefore does not issue APPROVE; evaluation remains REVIEW.
- No human-review console or role-assignment workflow is included yet. Do not enable merchant/payment activation based on case submission or this API alone.
- The existing IZAKHONO gateway and PocketPOS source are deployed unchanged except for the identity route import/dispatch. Gateway deployment is version 15.


## Canonical ID entity-scope remediation — source branch

**Branch:** `fix/idv-canonical-entity-boundary-v1`  
**Status:** source changes and tests staged for CI; not deployed.

The remediation branch changes the identity API authentication contract:

- `Authorization: Bearer <IZAKHONO-ID-session-token>` is the canonical user session.
- The gateway calls `POST /api/v1/internal/introspect` over HTTPS using the server-only `IZAKHONO_ID_INTERNAL_KEY`.
- The gateway validates active session, expiry, canonical `usr_`, `ent_` and `mem_` identifiers, entity slug, role and session reference.
- A Supabase Auth JWT is not accepted as a substitute for an IZAKHONO ID session.
- Email is never used as an identity join key.
- The gateway derives entity, membership and user identifiers from introspection; request-body or URL tenant values are ignored.
- Case reads and writes are scoped to entity, membership and case creator. Child evidence, screenings, decisions, relationships and consent are reached only after the scoped parent case is authorised.
- Product onboarding requires a server-side `IDENTITY_PRODUCT_ENTITY_MAP` JSON mapping from product code to permitted canonical entity IDs.
- Browser CORS requires an explicit semicolon-separated `IDENTITY_ALLOWED_ORIGINS` allowlist. An empty allowlist denies browser origins.
- The gateway health route reports configuration state without exposing credentials.

Required server-side configuration:

- `IZAKHONO_ID_INTERNAL_URL` — canonical ID HTTPS origin.
- `IZAKHONO_ID_INTERNAL_KEY` — internal introspection credential, injected only through the protected secret manager.
- `IDENTITY_PRODUCT_ENTITY_MAP` — owner-approved product-to-entity mapping.
- `IDENTITY_ALLOWED_ORIGINS` — exact approved browser origins.

The SQL file `docs/IZAKHONO-IDENTITY-ENTITY-SCOPE-MIGRATION-DRAFT.sql` is a review draft only. It has not been converted into a Supabase CLI migration or applied. Existing unscoped records must not be assigned to an entity by inference.

**Release remains blocked** until the canonical ID runtime is deployed on a verified persistent HTTPS host, the required secrets and product mappings are installed through the approved secret channel, the schema migration is generated/reconciled and tested, authenticated staging tests pass, and independent security/privacy reviews are complete.


## Provider evaluation

Regula remains the preferred document/biometric technology evaluation candidate. Its technical, commercial and legal assessment is recorded in `docs/IZAKHONO-REGULA-TECHNICAL-DUE-DILIGENCE.md`. The full Regula IDV Platform has separate MongoDB, message-broker and storage dependencies; it must not be assumed to fit directly inside the existing Supabase/PostgreSQL deployment.

## Live database migration caution

The connected project already has the eight identity tables, forced RLS and service-role-only policies. Its applied migration names differ from the migration filenames in the original source PR. The entity-scope SQL in `docs/IZAKHONO-IDENTITY-ENTITY-SCOPE-MIGRATION-DRAFT.sql` is review-only and must not be applied until the exact live migration history and SQL are reconciled.


## Provider adapter implementation

The gateway source includes a provider-neutral adapter contract and an unconfigured Regula adapter. The health endpoint reports provider readiness without exposing credentials. The adapter does not call Regula or make an onboarding decision until an approved transport and licence are configured. All provider evidence remains subject to IZAKHONO/FORTRESS policy and human-review rules.
