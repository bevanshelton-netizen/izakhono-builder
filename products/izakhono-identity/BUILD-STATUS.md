# IZAKHONO IDENTITY — Build status

**Version:** Development milestone 0.2  
**Branch:** feature/izakhono-identity-v1  
**Status:** Core module and isolated validation passing; not production-ready.

## Implemented in this development branch

- Provider-neutral verification domain, status machine and orchestration.
- Tenant permission checks and processing-authorisation reference gate.
- Request fingerprint binding for idempotency.
- Ordered provider routing and fallback handling.
- Disabled-by-default Regula adapter with capability claims empty until verified.
- Normalised result persistence contract and transactional PostgreSQL result adapter.
- Private-schema PostgreSQL migration with browser roles revoked and append-only audit trigger.
- Tenant-scoped evidence upload intent and finalisation service.
- Raw-body-first webhook signature verification contract and atomic replay-claim interface.
- Authenticated HTTP handler contract with request-integrity/CSRF dependency.
- Operations console shell for request creation, lookup, manual review, provider status and private evidence upload.
- OpenAPI contract, threat model, POPIA/retention plan and Regula POC plan.
- IZAKHONO BUILDER module registration and build-intent routing.
- Isolated CI workflow.

## Validation evidence

The identity validation workflow completed successfully for commit 8e0b2ebb9d72260254ab68c6ef79aeffe71bec1b:

- Identity TypeScript type-check: passed.
- IZAKHONO BUILDER integration type-check: passed.
- Builder route syntax check: passed.
- Identity core, security and evidence tests: passed.

The validation is limited to the committed source and tests. It is not evidence of production infrastructure, external provider connectivity, POPIA approval or real-world document/biometric accuracy.

## Not yet completed

1. Promote a validated source snapshot into the IZAKHONO BUILDER internal repository using its owner-controlled build and commit workflow.
2. Connect the module to the canonical IZAKHONO HOST runtime and provision isolated PostgreSQL and private object storage.
3. Implement the production authentication, tenant membership, CSRF and secret-manager adapters.
4. Implement provider-specific Regula transport, webhook signature verification and live document/biometric test suite from the contracted Regula product specification.
5. Implement retention/deletion worker, evidence upload adapter and monitoring/alerting.
6. Complete independent security review, penetration testing, POPIA impact assessment, supplier contract and Information Officer approval.
7. Complete owner-approved staging, backup/restore, end-to-end acceptance and production release.

## Safety boundary

No migration has been applied to an existing database. No production service, payment workflow or Vercel deployment has been modified. Regula is not enabled. The GitHub branch is an optional development mirror; IZAKHONO's internal repository and owned runtime remain the intended source of truth and production foundation.
