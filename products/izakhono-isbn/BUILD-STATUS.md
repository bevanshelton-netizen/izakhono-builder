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
- Added CI checks for the PostgreSQL schema and provider-neutral contract.
- These are schema and contract foundations only. The PostgreSQL driver/adapter is not implemented, API routes are not wired to it, and no PostgreSQL instance has been provisioned.

## Latest verification
- The architecture/documentation commit `af4d83b1ba5d16606093399fa974ded9a9e6c96a` completed all 18 checks successfully, including the repository Worker build. That preview is a repository artifact, not the self-owned registry runtime.
- New PostgreSQL portability files and CI checks are committed after that SHA; their CI run is pending and must pass before this latest work is considered verified.

## Not complete / not claimed
- No official ISBN has been allocated or verified.
- No NLSA publisher prefix or publisher registration has been confirmed.
- No self-owned PostgreSQL instance, application runtime, DNS service or public edge has been provisioned.
- No self-hosted production deployment or production URL is claimed.
- PostgreSQL API adapter, integration tests, data migration tooling, organisation-controlled access, monitoring and tested backup/restore remain outstanding.
- NODE01 production runtime evidence and operational integration remain outstanding.
- No hosting, hardware, bandwidth or subscription expenditure is authorised by this work.

## Release gates
1. Implement the PostgreSQL adapter and wire the registry API to the provider-neutral contract.
2. Run live PostgreSQL schema, API, ISBN integrity and correspondence immutability integration tests.
3. Select and verify an execution substrate and resource budget.
4. Configure organisation-controlled access, secret handling, monitoring and encrypted off-node backups.
5. Demonstrate restore and rollback.
6. Implement owned DNS/TLS/WAF/ingress and complete operational acceptance.
7. Obtain explicit cost approval before any paid hosting, hardware, bandwidth or subscription commitment.
8. Obtain NLSA publisher registration and record ISBNs only after authorised allocation.
