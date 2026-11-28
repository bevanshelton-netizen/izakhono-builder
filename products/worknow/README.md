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
