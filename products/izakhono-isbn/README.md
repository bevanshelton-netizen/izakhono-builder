# IZAKHONO ISBN & Publishing Registry

Private publishing-operations platform for IZAKHONO AFRICA (PTY) LTD and its SELFHELP Stories imprint.

## Purpose and authority boundary

This system manages publisher identity, imprints, authors, works, edition metadata, official ISBN records, applications, evidence and legal-deposit tracking. It does **not** issue ISBNs, create publisher prefixes, or represent itself as an ISBN agency. Only record an ISBN after it has been allocated by the National Library of South Africa (or the appropriate authorised agency).

ISBNs are never fabricated, auto-reserved, or inferred from a title. Every ISBN record must retain its allocation authority, evidence reference, format, edition and verification status.

## Runtime and infrastructure direction

- **Target direction:** IZAKHONO-owned infrastructure platform (**IZAKHONO Edge**), with self-managed DNS, ingress/TLS, WAF, application runtime, PostgreSQL, object storage, monitoring and backups.
- **Architecture decision:** `products/izakhono-platform/IZAKHONO-EDGE-ARCHITECTURE-ADR-0001.md`.
- **Current implementation status:** this registry's existing Worker + D1 adapter is transitional prototype code. It is not the self-owned production platform and must not be represented as deployed self-hosted infrastructure.
- **PostgreSQL target schema:** `postgresql/0001_initial_schema.sql`; initial publisher/catalogue seed: `postgresql/0002_seed_initial_catalogue.sql`.
- **Provider-neutral persistence contract:** `src/storage/contract.ts`.
- **PostgreSQL runtime:** `src/postgresql-adapter.ts` and `runtime/` provide the PostgreSQL-backed adapter and Node.js 22 HTTP runtime. The existing API handler is wired through this adapter; CI exercises the live PostgreSQL API and boots the built container.
- The PostgreSQL schema preserves the registry's publisher, imprint, author, work, edition, agency application, ISBN, legal deposit, audit and immutable correspondence records. It enforces ISBN-13 checksum integrity and append-only correspondence at database level.
- NODE01 is an IZAKHONO software node, not a physical server. It is governed by the repository's software-node contract in `autonomy/software-node.mjs`; it is promoted only after runtime evidence.
- No physical-server enrolment is required merely to define NODE01. Any additional execution substrate, hosting, database, hardware or paid service must be separately configured and must not be provisioned without explicit cost approval.
- No paid service or infrastructure is provisioned by these changes.
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

1. Use the D1 configuration only when running tests or previewing the transitional Worker adapter.
2. Apply the five SQL migrations in `migrations/` in order.
3. Set `ISBN_ADMIN_TOKEN` as a local secret.
4. Run `npx wrangler dev --config products/izakhono-isbn/wrangler.jsonc`.

## Local PostgreSQL development (not production)

1. From `products/izakhono-isbn/postgresql/`, copy `.env.example` to `.env` and replace the sample password with a long random local-only password.
2. Start the loopback-only development database with `docker compose up -d`; port 5432 is bound to `127.0.0.1` only. The named volume persists local development data.
3. Apply the schema and seed from that directory:
   - `docker compose exec -T isbn-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < 0001_initial_schema.sql`
   - `docker compose exec -T isbn-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < 0002_seed_initial_catalogue.sql`
4. Stop the local database with `docker compose down`; use `docker compose down -v` only when intentionally deleting the local database volume.
5. The `.env` file is ignored by Git. Never put real credentials in `.env.example` or commit a local `.env`.

## Self-hosted Node.js + PostgreSQL runtime (local acceptance environment)

The repository now includes a Node.js 22 container runtime and a PostgreSQL adapter that preserves the current API's parameterised query surface while moving its storage to PostgreSQL. This is the intended first self-hosted runtime path; it is not yet a production deployment.

1. From `products/izakhono-isbn/postgresql/`, copy `.env.example` to `.env`.
2. Replace both sample secrets. Use a long URL-safe password for the local PostgreSQL password because the Compose connection URL embeds it; never commit `.env`.
3. Start only the local database: `docker compose up -d isbn-postgres`.
4. Apply `0001_initial_schema.sql` and `0002_seed_initial_catalogue.sql` using the psql commands above.
5. Start the application profile: `docker compose --profile runtime up -d --build isbn-registry`.
6. The dashboard is available at `http://127.0.0.1:8080`; management endpoints require the local bearer token. Both database and application ports are loopback-only.
7. Stop with `docker compose --profile runtime down`. Keep the PostgreSQL volume unless intentionally deleting local test data.

The adapter uses positional PostgreSQL parameters, bounded pool settings, statement timeouts and PostgreSQL's row-count result. The runtime requires `DATABASE_URL` and `ISBN_ADMIN_TOKEN` at startup and fails closed if either is absent. Apply schema migrations before starting the application. Do not expose this local stack to the public internet.


## D1 → PostgreSQL migration rehearsal

The dry-run-first importer is in `migration/`. It accepts a versioned JSON export from the transitional D1 registry, validates table/column allowlists, ISBN-13 checksums and allocation evidence, then attempts a dependency-ordered insert inside one PostgreSQL transaction.

- Default command performs a full validation transaction and rolls it back; it commits no records.
- `--apply` is an explicit opt-in and commits only after the complete import succeeds.
- Duplicate IDs, unique conflicts, foreign-key failures or other database constraints abort and roll back the entire transaction.
- Source IDs and correspondence evidence references are preserved; correspondence is insert-only.
- The tool does not allocate ISBNs, update existing records, drop tables or migrate secrets.

See `migration/README.md` for the export envelope and operator procedure. Back up both systems and test restore/rollback before any actual migration. CI runs the migration validation and transaction-mode tests.

## Production readiness gates

1. Create a private PostgreSQL instance only after the execution substrate, cost, access controls and backup destination have been approved.
2. Apply `postgresql/0001_initial_schema.sql`, then `postgresql/0002_seed_initial_catalogue.sql` using a migration runner.
3. Maintain the passing live PostgreSQL adapter/API integration and container smoke tests; complete local operator acceptance, transaction/security review and append-only correspondence checks.
4. Add organisation-controlled access, monitoring, encrypted off-node backups and demonstrate restore/rollback.
5. Migrate existing records only after a verified backup and tested rollback plan.

The PostgreSQL files are a migration foundation, not evidence of a running database. The Compose service is for local development only and is bound to loopback; it is not a public or production host. Do not deploy until adapter wiring, access controls, backups, restore tests and operational acceptance are complete.
