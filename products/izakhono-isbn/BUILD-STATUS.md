# Build status — IZAKHONO ISBN & Publishing Registry v1

## Implemented

- Protected registry API and dashboard for publisher, imprint, author/pen-name, work, edition, ISBN, agency application, legal deposit, audit and agency correspondence records.
- D1 transitional schema and migrations; ISBN-13 validation and database integrity guards.
- PostgreSQL target schema, ISBN-13 checksum trigger, allocation-evidence constraints and append-only correspondence trigger.
- PostgreSQL compatibility adapter and Node.js 22 HTTP runtime; the existing registry API handler is wired through the PostgreSQL adapter.
- Local Compose development profile with database and application ports bound to loopback only.
- Live PostgreSQL 17 schema/seed/API integration tests and actual container HTTP/PostgreSQL smoke test in CI.
- Dry-run-first D1 JSON export → PostgreSQL importer with strict table/column allowlists, ISBN/evidence validation, dependency-ordered inserts, transactional rollback by default and explicit `--apply` commit mode.
- Migration-tool tests covering checksum validation, unknown data rejection, missing allocation evidence, verified ISBN allocation dates and dry-run/apply transaction outcomes.
- Initial publisher/imprint/author/application records and six SELFHELP Stories development works; no unconfirmed editions or ISBNs are invented.
- NLSA correspondence history for 6 October, 14 October and 26 November 2026. Outgoing messages are not represented as agency acknowledgement or allocation.

## Latest verification

- Commit `eaa646d341aaa464ec8c399962f71f6cf7cb7960`: all 18 reported GitHub checks completed successfully, including the ISBN registry integration suite, PostgreSQL 17 API integration, Docker image build, and actual container smoke test.
- Commit `410ba2ec30eb9e3db7584ca2cc8b715443bac2e8`: the ISBN registry CI job passed the migration unit tests, live PostgreSQL 17 schema/API integration, live D1-to-PostgreSQL importer dry-run and commit rehearsal, runtime syntax, Docker image build and actual container smoke test. The rehearsal used a synthetic fixture in an isolated schema, proved dry-run leaves zero rows, verified explicit commit and append-only correspondence, then dropped the test schema.
- All checks shown for the registry suite and the Workers build completed successfully. One unrelated repository `validate` check was still running at the last check; the overall repository check set is therefore not described as fully complete.
- Pull request #793 remains OPEN and DRAFT; it has not been merged.

## Migration safety

- The migration importer defaults to a transaction that is rolled back after all inserts and constraints are exercised.
- It rejects unknown tables/columns, invalid ISBN checksums, missing allocation authority/evidence and verified ISBNs without allocation dates.
- It preserves IDs and correspondence evidence references; duplicate/unique/FK errors abort the complete transaction.
- No automatic production migration has been run. Both source and destination backups plus a tested restore/rollback remain mandatory before a real import.

## Not complete / not claimed

- No official NLSA publisher registration, publisher prefix or ISBN allocation has been confirmed.
- No self-owned production PostgreSQL instance, application runtime, DNS, public edge or IZAKHONO Edge deployment has been provisioned.
- No production data migration, production backup/restore acceptance or rollback rehearsal has been performed.
- Organisation-controlled access, monitoring, encrypted off-node backups, restore testing and operational acceptance remain release gates.
- No hosting, hardware, bandwidth or subscription expenditure has been authorised.

## Release gates

1. Complete the remaining repository-wide validation check; the ISBN registry migration and container verification job has passed.
2. Complete an operator-led local migration rehearsal using a real, independently backed-up D1 export and disposable PostgreSQL target; the current passing CI rehearsal used synthetic test records only.
3. Verify source/target row counts, relationships, audit history and correspondence evidence; test restore and rollback.
4. Approve IZAKHONO Edge execution substrate, resource budget and access policy before provisioning.
5. Configure monitoring, encrypted off-node backups, restore procedures, owned DNS/TLS/WAF/ingress and operational controls.
6. Obtain explicit approval before any paid hosting, hardware, bandwidth or subscription commitment.
7. Record ISBNs only after allocation by NLSA or another authorised ISBN agency.
