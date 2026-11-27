# IZAKHONO ISBN & Publishing Registry

Private publishing-operations platform for IZAKHONO AFRICA (PTY) LTD and its SELFHELP Stories imprint.

## Purpose and authority boundary

This system manages publisher identity, imprints, authors, works, edition metadata, official ISBN records, applications, evidence and legal-deposit tracking. It does **not** issue ISBNs, create publisher prefixes, or represent itself as an ISBN agency. Only record an ISBN after it has been allocated by the National Library of South Africa (or the appropriate authorised agency).

ISBNs are never fabricated, auto-reserved, or inferred from a title. Every ISBN record must retain its allocation authority, evidence reference, format, edition and verification status.

## Runtime and infrastructure direction

- **Target direction:** IZAKHONO-owned infrastructure platform (**IZAKHONO Edge**), with self-managed DNS, ingress/TLS, WAF, application runtime, PostgreSQL, object storage, monitoring and backups.
- **Architecture decision:** `products/izakhono-platform/IZAKHONO-EDGE-ARCHITECTURE-ADR-0001.md`.
- **Current implementation status:** this registry's existing Worker + D1 adapter is transitional prototype code. It is not the self-owned production platform and must not be represented as deployed self-hosted infrastructure.
- Provider-specific runtime and database code must be isolated from registry business rules. The planned migration target is a provider-neutral application contract backed by PostgreSQL.
- **NODE01 is an IZAKHONO software node, not a physical server.** It is governed by the repository's software-node contract in `autonomy/software-node.mjs`; it can be instantiated in an available software execution substrate and is promoted only after runtime evidence.
- NODE01's software-node identity/control plane and the registry application runtime are distinct components. Do not assume a local software-node process can be deployed unchanged into a hosted Worker runtime.
- No physical-server enrolment is required merely to define NODE01. Any additional execution substrate, hosting, database, hardware or paid service must be separately configured and must not be provisioned without explicit cost approval.
- No paid service or infrastructure is provisioned by this change.
- Until the provider-neutral runtime is implemented and verified, the existing Worker adapter still requires its D1 binding and secret for its own tests/preview. It is not the target production dependency.
- All management endpoints require `Authorization: Bearer <ISBN_ADMIN_TOKEN>`. Keep the token in a secret store; never commit it.
- Production must additionally be placed behind an organisation-controlled access policy. Do not expose an unauthenticated registry.

## API

- `GET /api/health` — public health and release state only.
- `GET /api/dashboard` — counts and agency/application status.
- `GET /api/catalogue` — edition-level catalogue with ISBN verification state.
- `GET|POST|PATCH /api/publishers`
- `GET|POST|PATCH /api/imprints`
- `GET|POST|PATCH /api/authors`
- `GET|POST /api/work-authors` — link authors and contributors to works
- `GET|POST|PATCH /api/legal-deposits` — track statutory deposit records
- `GET|POST|PATCH /api/works`
- `GET|POST|PATCH /api/editions`
- `GET|POST|PATCH /api/applications`
- `GET|POST /api/correspondence` — append-only agency correspondence history; no update/delete route exists
- `GET|POST|PATCH /api/isbns`
- `GET /api/export/catalogue.csv`

All non-health routes are protected. Input validation, audit logging and explicit state transitions are mandatory.

## Initial operating record

- Publisher: IZAKHONO AFRICA (PTY) LTD
- Imprint: SELFHELP Stories
- Initial application: THE BUSINESS OF MUSIC™ (EPUB), submitted 6 October 2026; follow-up 14 October 2026; escalation sent 26 November 2026 to info@nlsa.ac.za, copying Motubatse.Kgatle@nlsa.ac.za; no acknowledgement, registration confirmation or ISBN allocation is yet verified.
- First-season SELFHELP Stories works seeded as development records: The Invitation, The Secret, The Door, The Choice, The Morning After and The Consequence. Format-specific editions and author/pen-name assignments are deliberately left unassigned until confirmed; each actual format/edition will receive its own agency-allocated ISBN record.

## Agency correspondence history

The database preserves dated outgoing and incoming agency correspondence as separate records linked to the application. The protected `/api/correspondence` endpoint allows retrieval and appending new evidence; it intentionally exposes no edit or delete operation. Database triggers reject updates and deletions so the correspondence ledger remains immutable; corrections must be added as new records. Initial application (6 October 2026), follow-up (14 October 2026) and escalation (26 November 2026) are seeded. An outgoing email is not evidence of agency acknowledgement or ISBN allocation; attach agency replies and allocation documents when received.

## Local development (transitional Worker adapter)

1. Create a D1 database and bind it as `DB` in `wrangler.jsonc` only if you are testing the transitional Worker adapter.
2. Apply migrations in order: `0001_initial.sql`, `0002_seed_initial_publisher_and_application.sql`, `0003_isbn_integrity_guards.sql`, `0004_seed_selfhelp_first_season.sql`, `0005_agency_correspondence_history.sql`.
3. Set `ISBN_ADMIN_TOKEN` as a local secret.
4. Run `npx wrangler dev --config products/izakhono-isbn/wrangler.jsonc`.

Do not deploy the transitional adapter as the long-term production service. The self-owned runtime, PostgreSQL migration, access controls, backups, restore tests and operational acceptance gates must be completed before production use.
