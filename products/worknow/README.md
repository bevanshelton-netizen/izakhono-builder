# WORKNOW — Global Employment & Workforce Infrastructure

WORKNOW is a separate workforce product family. It must not be merged into FORTRESS financial-market infrastructure or SHELTONAIR.

## Product direction

- WORKNOW Recruit: candidate and employer recruitment workflows.
- WORKNOW Employ: employment lifecycle, contract and onboarding administration.
- WORKNOW Payroll: payroll calculation, approval, reconciliation and reporting.
- WORKNOW Global: country-aware employer and talent operations.
- WORKNOW Compliance: jurisdiction rules, evidence and compliance workflows.
- WORKNOW Benefits: benefits and leave administration.
- WORKNOW Mobility: immigration and relocation case management.
- WORKNOW Intelligence: assisted operations with approval gates and audit logs.

## Current operating mode: Connector Mode

Until required registrations, legal review and operating controls are cleared:
- Vacancies are moderated and employer verification is mandatory before publication.
- Candidate applications are sent directly to the named employer, with explicit consent and a recorded privacy-notice version.
- Candidate fees, employer listing fees and placement fees are disabled.
- WORKNOW does not shortlist, refer candidates, or represent itself as the employer of record.
- The product is a connector, not a licensed employment agency or EOR by implication.

## Initial engineering slice

`src/core.ts` is a deterministic, side-effect-free policy core for vacancy review, publication, direct applications and employer acknowledgements. It does not store data, send emails, process payments, calculate statutory payroll, or provide legal advice. It is intended to be called by authenticated server-side adapters after tenant, employer and applicant authorisation.

## Architecture principles

- One canonical workforce record with role-based, least-privilege access.
- Explicit consent, data minimisation, purpose limitation, retention/deletion workflows and audit trail.
- Jurisdiction-specific rules with effective dates, source citations, versioning and human legal approval.
- No invented payroll tax rates or employment-law defaults. Calculations require verified, current country rule packs.
- Human approval for employment contracts, payroll release, immigration decisions, adverse candidate actions and other high-impact operations.
- Country coverage is activated only after legal entity/partner, compliance, payroll rail, support, data and operational readiness are evidenced.
- Africa-first foundation; multi-country, multi-currency and global architecture from inception.
- No vendor/hosting spend or production deployment without explicit approval.

## Delivery roadmap

1. Connector Mode safety core and tests.
2. Authenticated tenant-scoped storage, employer verification and moderation queue.
3. Applicant account, privacy controls, CV builder, private profile and direct-apply UX.
4. Employer portal, vacancy management, applicant receipt and audit logs.
5. South Africa legal/rules pack reviewed by qualified local counsel.
6. Payroll calculation engine with versioned, sourced rules; maker-checker approvals and reconciliation.
7. Benefits, leave, equipment, expenses and employee self-service.
8. Global country capability registry and partner/entity onboarding.
9. EOR only in jurisdictions where WORKNOW's employing entity or approved partner can lawfully provide it.
10. International expansion after country-level gates are signed off.

## Legal and release gates

This code does not establish registration, legal compliance, a licensed service, a legal employer, live integrations, or production readiness. Before launch, verify current South African requirements with qualified counsel and relevant authorities, including private employment agency requirements where applicable, employment legislation, POPIA/PAIA, tax/payroll and data-security obligations. Record the approved operating model and scope.


## Persistence foundation

Migration `migrations/0032_worknow_connector_core.sql` creates tenant-scoped employer, membership, vacancy, direct-application and append-only audit tables. The first migration intentionally stores no CV/profile payload and pins country code to `ZA`. Employer membership and composite tenant foreign keys are included, but SQLite/D1 does not enforce row-level security: server adapters must authenticate each request and scope every read/write by the verified user, tenant and employer membership. Do not expose direct database access to clients. Application endpoints must validate published vacancy state and consent, and write an audit event transactionally. The migration is not applied to any remote database in this work.

## Product blueprint

See [`PRODUCT_BLUEPRINT.md`](./PRODUCT_BLUEPRINT.md) for the Africa-to-world product portfolio, employer and employee journeys, country capability gates, transparent proposal model, controlled AI action workflow, security/privacy requirements, migration approach and phased delivery plan. The blueprint is strategy and specification—not a claim of current service availability or legal readiness.

## Authenticated server adapter contract

`src/server-adapter.ts` defines the next server-side boundary for direct applications, applicant-owned reads and employer receipt acknowledgements. It accepts only trusted middleware-derived actor/tenant context, requires tenant-scoped store methods, checks employer membership and role for employer actions, and requires transactional state-plus-audit persistence for writes. It deliberately does not implement a database driver, HTTP route, authentication provider, CV upload, notification, or production integration. A concrete adapter must implement every store query with tenant and subject predicates, parameterized SQL, and transactionally appended audit records; these requirements must be reviewed before integration.

`src/server-adapter.test.ts` adds focused tests to the `worknow:core:test` script. Tests have been authored but have not been executed in this session; CI and local validation remain required.

See [`API_CONTRACT_V1.md`](./API_CONTRACT_V1.md) for the proposed route contract, tenant/auth boundaries, candidate direct-application flow, employer acknowledgement, response codes and release gates. Routes are specified only; they are not live.
