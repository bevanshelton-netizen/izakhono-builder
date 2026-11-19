# IZAKHONO Identity API — operational contract

Base URL:
`https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-gateway/identity`

All routes require a valid Supabase user access token:
`Authorization: Bearer <user-access-token>`.
The gateway has JWT verification disabled for legacy public routes, so this module independently validates every identity request by calling Supabase Auth `/auth/v1/user`. Never use a service-role key in a browser.

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
- The API validates the user access token against Supabase Auth and scopes case access to `opened_by`.
- Uploads are size/MIME/magic-byte checked and hashed. This is not a malware scan; evidence remains unvalidated pending an approved scanning/verification service.
- No external CIPC, SARS, identity-document, biometric/liveness, sanctions, PEP or adverse-media provider is configured. The engine therefore does not issue APPROVE; evaluation remains REVIEW.
- No human-review console or role-assignment workflow is included yet. Do not enable merchant/payment activation based on case submission or this API alone.
- The existing IZAKHONO gateway and PocketPOS source are deployed unchanged except for the identity route import/dispatch. Gateway deployment is version 15.
