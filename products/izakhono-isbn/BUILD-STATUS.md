# Build status — IZAKHONO ISBN & Publishing Registry v1

## Delivered in this branch
- Publishing registry API and dashboard foundation with protected management endpoints.
- D1 prototype schema and migrations for publisher, imprint, author, work, edition, ISBN, application, append-only agency correspondence and audit records.
- Preserves the 6 October and 14 October 2026 NLSA application emails and the 26 November 2026 escalation as dated correspondence records; no reply or ISBN allocation is implied.
- Seeds six first-season SELFHELP Stories titles as development works only; no unconfirmed formats, author assignments or ISBNs are invented.
- ISBN-13 checksum validation and digits-only canonicalisation; no ISBN generation/allocation.
- Database-level SQLite guards for ISBN checksum, canonical storage, allocation authority/evidence and allocation dates.
- API regression tests, SQLite migration integrity tests and dashboard syntax checks.
- Edition-level catalogue, contributor links, agency correspondence, legal deposit tracking and CSV export.
- Bearer-token protection, audit logging and fail-closed behaviour.
- NODE01 is documented as an IZAKHONO software node, not a physical server.

## IZAKHONO Edge / PostgreSQL portability work
- Accepted architecture decision: `products/izakhono-platform/IZAKHONO-EDGE-ARCHITECTURE-ADR-0001.md`.
- Added PostgreSQL target schema: `postgresql/0001_initial_schema.sql`.
- Added idempotent initial publisher, imprint, author, work, edition, application, first-season catalogue and NLSA correspondence seed: `postgresql/0002_seed_initial_catalogue.sql`.
- Added PostgreSQL database-level ISBN-13 checksum guard and immutable agency-correspondence trigger.
- Added provider-neutral TypeScript persistence contract: `src/storage/contract.ts`.
- Added PostgreSQL parameter-binding compatibility adapter: `src/postgresql-adapter.ts`, with adapter unit tests.
- Added Node.js 22 HTTP runtime, PostgreSQL driver manifest and container build: `runtime/`.
- Connected the existing registry API handler to the PostgreSQL adapter through the Node runtime without changing the domain/API route implementation.
- Added opt-in local Compose runtime profile, with PostgreSQL and application ports bound to loopback only; local secrets are supplied through an ignored `.env` file.
- Added live PostgreSQL schema/seed/API integration tests to CI using a PostgreSQL 17 service container; the tests cover catalogue reads, dashboard counts, author create/update, ISBN checksum enforcement and immutable correspondence.
- Added CI container-image build validation for the self-hosted Node.js runtime.
- The self-hosted runtime path is implemented in source. Its live CI result is pending; no local production-like stack or public service has been deployed.

## Latest verification
- The architecture/documentation commit `af4d83b1ba5d16606093399fa974ded9a9e6c96a` completed all 18 checks successfully, including the repository Worker build. That preview is a repository artifact, not the self-owned registry runtime.
- The CI run for commit `c8ef320bf30b7d56e6703146648b949e9dbc24f7` exposed a dashboard syntax-check command failure before the registry test suite could run. The workflow command was corrected and adapter/runtime checks were added; the updated branch CI must complete successfully before verification can be claimed.
- No live PostgreSQL server or Docker container has been started in this environment.

## Not complete / not claimed
- No official ISBN has been allocated or verified.
- No NLSA publisher prefix or publisher registration has been confirmed.
- No self-owned production PostgreSQL instance, application runtime, DNS service or public edge has been provisioned. A local-only PostgreSQL Compose definition is provided for development; it has not been started or tested in this environment.
- No self-hosted production deployment or production URL is claimed.
- CI live PostgreSQL integration and container build results must pass before this branch is verified. Local deployment, data migration tooling, organisation-controlled access, monitoring and tested backup/restore remain outstanding.
- NODE01 production runtime evidence and operational integration remain outstanding.
- No hosting, hardware, bandwidth or subscription expenditure is authorised by this work.

## Release gates
1. Run live PostgreSQL schema, API, ISBN integrity and correspondence immutability integration tests against the supplied local Compose stack.
2. Add data migration tooling and a tested rollback plan for any transition from the D1 prototype.
3. Select and verify an IZAKHONO Edge execution substrate and resource budget.
4. Configure organisation-controlled access, secret handling, monitoring and encrypted off-node backups.
5. Demonstrate restore and rollback.
6. Implement owned DNS/TLS/WAF/ingress and complete operational acceptance.
7. Obtain explicit cost approval before any paid hosting, hardware, bandwidth or subscription commitment.
8. Obtain NLSA publisher registration and record ISBNs only after authorised allocation.
