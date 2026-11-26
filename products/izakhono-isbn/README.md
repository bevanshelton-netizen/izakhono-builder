# IZAKHONO ISBN & Publishing Registry

Private publishing-operations platform for IZAKHONO AFRICA (PTY) LTD and its SELFHELP Stories imprint.

## Purpose and authority boundary

This system manages publisher identity, imprints, authors, works, edition metadata, official ISBN records, applications, evidence and legal-deposit tracking. It does **not** issue ISBNs, create publisher prefixes, or represent itself as an ISBN agency. Only record an ISBN after it has been allocated by the National Library of South Africa (or the appropriate authorised agency).

ISBNs are never fabricated, auto-reserved, or inferred from a title. Every ISBN record must retain its allocation authority, evidence reference, format, edition and verification status.

## Runtime and software-node architecture

- Registry application: Cloudflare Worker + D1 SQLite.
- **NODE01 is an IZAKHONO software node, not a physical server.** It is governed by the repository's software-node contract in `autonomy/software-node.mjs`; it can be instantiated in an available software execution substrate and is promoted only after runtime evidence.
- NODE01's software-node identity/control plane and this registry's Cloudflare Worker runtime are distinct components. Do not assume a local software-node process can be deployed unchanged inside the Cloudflare Worker runtime.
- No physical-server enrolment is required merely to define NODE01. Any additional execution substrate, hosting, database or paid service must be separately configured and must not be provisioned without explicit cost approval.
- No paid service or infrastructure is provisioned by this change.
- D1 database and Worker secrets must be configured by an authorised operator before production deployment.
- All management endpoints require `Authorization: Bearer <ISBN_ADMIN_TOKEN>`. Keep the token in a Worker secret; never commit it.
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
- `GET|POST|PATCH /api/isbns`
- `GET /api/export/catalogue.csv`

All non-health routes are protected. Input validation, audit logging and explicit state transitions are mandatory.

## Initial operating record

- Publisher: IZAKHONO AFRICA (PTY) LTD
- Imprint: SELFHELP Stories
- Initial application: THE BUSINESS OF MUSIC™ (EPUB), submitted 6 October 2026; follow-up 14 October 2026; no allocation verified in the correspondence reviewed.
- Other planned books/formats are entered as works/editions with ISBN status `pending_agency`, never with invented numbers.

## Local development

1. Create a D1 database and bind it as `DB` in `wrangler.jsonc`.
2. Apply migrations in order: `0001_initial.sql`, `0002_seed_initial_publisher_and_application.sql`, then `0003_isbn_integrity_guards.sql`. The third migration adds database-level ISBN checksum/canonical-format and verification-evidence guards; the Worker also normalises accepted ISBNs to digits-only before storage.
3. Set `ISBN_ADMIN_TOKEN` as a local secret.
4. Run `npx wrangler dev --config products/izakhono-isbn/wrangler.jsonc`.

Do not deploy until database binding, secret, access controls, backups and acceptance tests have been verified.
