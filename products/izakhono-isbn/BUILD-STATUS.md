# Build status — IZAKHONO ISBN & Publishing Registry v1

## Delivered in this branch
- Cloudflare Worker API foundation.
- D1 schema for publisher, imprint, author, work, edition, ISBN, application and audit records.
- ISBN-13 checksum validation; no ISBN generation/allocation.
- ISBN validation regression tests and a repository test command.
- Edition-level catalogue endpoint and corrected multi-edition dashboard rendering.
- Removed caller-controlled audit actor and suppressed raw internal exception details in API responses.
- Bearer-token protection for management endpoints.
- CSV catalogue export.
- Private dashboard UI with work, edition, author/pen-name, contributor, agency-allocated ISBN and legal-deposit entry forms.
- Edition-level catalogue showing the ISBN verification state.
- Automated GitHub Actions test workflow for ISBN validation and fail-closed API checks.
- Operating boundary and deployment runbook.

## Not yet complete / not claimed
- No official ISBN has been allocated or verified.
- No NLSA publisher prefix or publisher registration has been confirmed.
- No remote D1 database has been provisioned.
- No production deployment or public URL exists.
- Barcode artwork generation is deferred until a real ISBN is verified.
- Cloudflare Access policy and backup/restore acceptance remain production gates.

## Release gates
1. Confirm NLSA publisher registration and agency allocation procedure.
2. Provision D1 only after explicit infrastructure/cost approval.
3. Set Worker secret; never commit credentials.
4. Configure Cloudflare Access for the management interface.
5. Apply migrations and run API/security tests.
6. Verify backups and restore.
7. Deploy to a private preview, then obtain acceptance before production promotion.
