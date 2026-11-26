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
- Private dashboard UI with work, edition, author/pen-name, contributor, agency application, agency-allocated ISBN and legal-deposit management forms.
- Audited PATCH updates for application and publishing metadata.
- Edition-level catalogue showing the ISBN verification state.
- Automated GitHub Actions test workflow for ISBN validation and fail-closed API checks.
- Operating boundary and deployment runbook.
- Explicitly documented NODE01 as an IZAKHONO software node, not a physical server; no physical-server enrolment is required just to define or instantiate its software identity.

## Not yet complete / not claimed
- No official ISBN has been allocated or verified.
- No NLSA publisher prefix or publisher registration has been confirmed.
- No remote D1 database has been provisioned.
- No production deployment or public URL exists.
- Barcode artwork generation is deferred until a real ISBN is verified.
- Cloudflare Access policy and backup/restore acceptance remain production gates.
- NODE01 software-node runtime evidence and its operational integration with the registry have not yet been demonstrated in the production substrate.

## Release gates
1. Confirm NLSA publisher registration and agency allocation procedure.
2. Confirm an authorised, zero-cost/free-tier deployment path or obtain explicit cost approval before provisioning any infrastructure.
3. Connect the authorised Cloudflare account through the secure integration flow.
4. Provision D1 only after the cost and account checks are satisfied.
5. Set Worker secret; never commit credentials.
6. Configure Cloudflare Access for the management interface.
7. Apply migrations and run API/security tests.
8. Verify backups and restore.
9. Validate NODE01 runtime evidence and the registry integration.
10. Deploy to a private preview, then obtain acceptance before production promotion.
