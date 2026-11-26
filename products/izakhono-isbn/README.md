# IZAKHONO ISBN & Publishing Registry

Private publishing-operations platform for IZAKHONO AFRICA (PTY) LTD and its SELFHELP Stories imprint.

## Purpose and authority boundary

This system manages publisher identity, imprints, authors, works, edition metadata, official ISBN records, applications, evidence and legal-deposit tracking. It does **not** issue ISBNs, create publisher prefixes, or represent itself as an ISBN agency. Only record an ISBN after it has been allocated by the National Library of South Africa (or the appropriate authorised agency).

ISBNs are never fabricated, auto-reserved, or inferred from a title. Every ISBN record must retain its allocation authority, evidence reference, format, edition and verification status.

## Runtime

- Cloudflare Worker + D1 SQLite, matching the repository's existing low-dependency Cloudflare architecture.
- No paid service or infrastructure is provisioned by this change.
- D1 database and Worker secrets must be configured by an authorised operator before production deployment.
- All management endpoints require `Authorization: Bearer <ISBN_ADMIN_TOKEN>`. Keep the token in a Worker secret; never commit it.
- Production must additionally be placed behind an organisation-controlled access policy. Do not expose an unauthenticated registry.

## API

- `GET /api/health` — public health and release state only.
- `GET /api/dashboard` — counts and agency/application status.
- `GET|POST /api/publishers`
- `GET|POST /api/imprints`
- `GET|POST /api/authors`
- `GET|POST /api/works`
- `GET|POST /api/editions`
- `GET|POST /api/applications`
- `GET|POST /api/isbns`
- `GET /api/export/catalogue.csv`

All non-health routes are protected. Input validation, audit logging and explicit state transitions are mandatory.

## Initial operating record

- Publisher: IZAKHONO AFRICA (PTY) LTD
- Imprint: SELFHELP Stories
- Initial application: THE BUSINESS OF MUSIC™ (EPUB), submitted 6 October 2026; follow-up 14 October 2026; no allocation verified in the correspondence reviewed.
- Other planned books/formats are entered as works/editions with ISBN status `pending_agency`, never with invented numbers.

## Local development

1. Create a D1 database and bind it as `DB` in `wrangler.jsonc`.
2. Apply `migrations/0001_initial.sql`.
3. Set `ISBN_ADMIN_TOKEN` as a local secret.
4. Run `npx wrangler dev --config products/izakhono-isbn/wrangler.jsonc`.

Do not deploy until database binding, secret, access controls, backups and acceptance tests have been verified.
