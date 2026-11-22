# I-PAY V1 Sandbox Deployment and Acceptance Gate

**Status: BLOCKED — sandbox infrastructure and deployment authority not yet verified.**  
**Scope: non-production only. This document does not authorise deployment, DNS changes, database migrations, paid-resource changes, PR merge, or live payment processing.**

## 1. Preconditions (all required)

- [ ] A dedicated I-PAY sandbox D1 database has been provisioned in the intended Cloudflare account.
- [ ] The database name and ID have been independently verified in that account and recorded in the release evidence. Never reuse the shared `izakhono-builder` D1 database as the I-PAY sandbox.
- [ ] The Worker deployment identity is authorised for the intended Cloudflare account and Worker.
- [ ] Sandbox-only provider credentials and webhook secrets are provisioned through the approved secret manager; no secrets are committed to Git.
- [ ] A separate Vercel preview deployment exists for the exact release commit. A previous or unrelated READY deployment is not acceptable evidence.
- [ ] Deployment quotas and billing constraints are resolved through an authorised account owner action. Do not retry or circumvent a quota denial.
- [ ] The exact commit SHA, environment, resource IDs (non-secret), operator, and approval are recorded before execution.

If any precondition is absent, stop. Do not deploy or run remote migrations.

## 2. Database isolation and migration gate

- [ ] Review every migration in the I-PAY migration directory and its ordering before applying anything.
- [ ] Confirm the Wrangler `DB` binding resolves only to the dedicated I-PAY sandbox D1 database for the sandbox environment.
- [ ] Confirm no production or shared database binding is inherited by the sandbox environment.
- [ ] Confirm backup/restore or disposable-sandbox reset procedure and rollback owner.
- [ ] Apply migrations only after the database ID and binding have been independently checked; capture command output and migration state.
- [ ] Verify required tables, indexes, constraints, and migration ledger against the reviewed migration set.

**Hard stop:** the currently inspected `wrangler.jsonc` binds `DB` to the shared `izakhono-builder` database. Do not run `wrangler d1 migrations apply DB --remote` or the package `db:migrate` script until that binding is corrected and verified.

## 3. Worker deployment gate

- [ ] Confirm Wrangler account, project name, entrypoint, compatibility date, environment, and bindings.
- [ ] Confirm deployment uses sandbox environment and dedicated sandbox D1 only.
- [ ] Confirm no production provider credentials, production endpoints, or live-payment feature flags are present.
- [ ] Deploy only through the authorised Cloudflare route and capture the resulting Worker version/deployment ID.
- [ ] Verify the deployed Worker URL and environment identity before any functional tests.

A local bundle or Wrangler dry-run is not a deployment and does not prove runtime health.

## 4. Website and routing gate

- [ ] Obtain a Vercel preview built from the exact release commit and verify its project/root directory.
- [ ] Verify public landing page, pricing disclosures, legal/contact links, merchant entry points, and responsive layout.
- [ ] Verify static assets and mock checkout are served from the intended origin.
- [ ] Verify API routes reach the intended Worker and do not silently fall back to unrelated services.
- [ ] Verify TLS certificate validity and hostname coverage for each URL under test.
- [ ] Test the custom domain only after an approved DNS change plan exists. Do not change DNS as part of preview acceptance.

## 5. Sandbox functional acceptance matrix

Record request/response evidence with secrets and personal data redacted.

| Area | Required test | Pass condition |
|---|---|---|
| Health | Worker health route | Expected sandbox identity and healthy response |
| Merchant | Create/read/update merchant | Tenant-scoped records; unauthorised access denied |
| Authentication | Merchant sign-in/session | Valid session accepted; invalid/expired session rejected |
| Isolation | Cross-merchant access attempts | No cross-tenant data disclosure or mutation |
| Payment intent | Create and retrieve intent | Valid state transitions; invalid inputs rejected |
| Idempotency | Repeat same command/key | One logical operation; stable replay response |
| Checkout | Open and complete mock checkout | Explicitly sandbox; no real-money movement |
| Redirect | Tamper with browser return/redirect | Redirect alone never marks payment paid |
| Webhook | Valid signed sandbox event | Signature verified before state mutation |
| Webhook | Invalid/replayed event | Rejected or safely deduplicated; no duplicate mutation |
| Ledger | Inspect transaction/event records | Consistent provenance and immutable audit trail |
| Refund | Submit sandbox refund request | Correct state and idempotency; no real refund |
| Reconciliation | Compare provider fixture and ledger | Mismatches visible; no false settlement completion |
| Dashboard | Merchant dashboard queries | Tenant-scoped, consistent statuses and totals |
| Failure paths | Missing DB/secret/provider and upstream errors | Fail closed; no false success state |
| Security | PAN/CVV and secret handling review | No card security data or secrets persisted/logged |

## 6. Release evidence and decision

Attach or link:
- Release commit SHA and CI run URLs.
- Vercel preview URL and deployment metadata.
- Cloudflare Worker deployment/version metadata.
- Sandbox D1 database identity and migration output.
- Sanitised test report for every row in the acceptance matrix.
- TLS verification output for each tested hostname.
- Open defects, risk owner, and explicit acceptance decision.

**Release states**
1. `BLOCKED`: infrastructure, authority, or evidence missing.
2. `SANDBOX DEPLOYED`: Worker and preview deployed, but acceptance incomplete.
3. `SANDBOX ACCEPTED`: every required test passed and evidence reviewed.
4. `LIVE REVIEW ELIGIBLE`: separate legal, compliance, partner, security, operational, and owner approvals completed.

No state in this document automatically authorises live payments. Live activation requires a separate explicit approval and a separate production-readiness process.
