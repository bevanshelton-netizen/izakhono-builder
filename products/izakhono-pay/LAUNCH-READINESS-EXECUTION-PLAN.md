# IZAKHONO PAY — Launch Readiness Execution Plan

**Canonical product:** IZAKHONO PAY  
**Workstream:** Controlled South African launch  
**Status:** Launch preparation; live-money activation blocked pending evidence and approvals  
**Prepared:** 2026-11-18

## Objective

Prepare the existing IZAKHONO PAY platform for a controlled internal pilot first, then an external merchant pilot only after provider, legal, security and operational approval. Preserve the existing payment core, provider adapters, webhook guard, event store, orchestration, fulfillment, reconciliation, settlement and refund components. Do not create a competing payment engine.

## Evidence-based baseline

The repository contains:
- `products/izakhono-pay`: Cloudflare Worker product, migrations, provider and activation scripts.
- `products/izakhono-super-engine/src/payment-*`: shared payment core, orchestration, webhook guard, event/ledger, settlement, reconciliation and refund components.
- `infra/provisioner/izakhono_pay_adapter.py` and `production_payment_adapter.py`: Provisioner-side trusted payment verification adapters.
- `products/i-connect`: iKhokha payment-link integration and reconciliation work.

A Vercel project named `izakhono-pay` also exists, but it is not evidence that the Cloudflare Worker is deployed or that live payments are enabled. The current codebase is in the IZAKHONO Builder repository; do not split repositories until ownership, release, and shared-core dependencies are mapped.

## Non-negotiable release gates

1. **Canonical map:** inventory all routes, provider adapters, migrations, runtime bindings, environment variables, CI workflows, tests and deployment targets. Identify which payment path is authoritative; retire or isolate legacy paths only after dependency proof.
2. **Trusted payment-to-fulfillment boundary:** eliminate caller-controlled `payment.verified` authorization. Fulfillment must require server-generated, authenticated payment evidence tied to merchant, order, amount, currency, provider transaction ID and a confirmed paid state.
3. **Webhook durability:** raw-body signature verification, durable atomic claims, replay protection, duplicate handling and cross-instance idempotency. No in-memory production fallback.
4. **Provider contract:** verify iKhokha API and callback contract against current official provider documentation and approved merchant account settings. Confirm secrets are never exposed to browser/client code. Do not assume sandbox or live credentials exist.
5. **Financial integrity:** immutable event trail; ledger balancing invariants; idempotent refunds; ambiguous/failing refund recovery; settlement and provider/bank reconciliation.
6. **Merchant controls:** tenant isolation, least-privilege roles, merchant limits, KYB/KYC workflow where applicable, audit events, key rotation and support processes.
7. **Runtime operations:** health/readiness endpoints, structured redacted logs, alerting, backup and restore test, rollback procedure, incident runbook and rate limiting.
8. **Testing:** CI tests, integration tests against provider sandbox/test mode where available, negative tests, concurrency/replay tests, security review and a documented acceptance report.
9. **Regulatory/commercial scope:** specialist South African payments counsel and provider confirmation before external merchant onboarding, custody, stored value, payout or other regulated activities. Market initially as merchant/payment orchestration technology integrated with authorised providers, not as a bank, wallet, acquirer or licensed payment system.
10. **Controlled live test:** only after all prior gates and explicit release approval. Run a low-value transaction with an authorised internal merchant, then reconcile payment-provider and bank settlement records. Do not activate live processing by changing a feature flag alone.

## Work packages

### WP1 — Source and release map
- Produce a route/module/schema/test/deployment inventory.
- Trace every public payment callback and checkout path to its authoritative payment-intent and event-store implementation.
- Map Cloudflare Worker, D1 bindings/migrations, secrets, CI workflows, custom domains and deployment environments.
- Verify the latest successful CI run and deployed commit; record exact evidence.

### WP2 — Payment trust boundary
- Trace all callers of the Provisioner and order-fulfillment APIs.
- Replace boolean trust with an authenticated internal payment receipt/reference and server-side verification.
- Enforce tenant/order/amount/currency/provider transaction matching.
- Add adversarial tests for client-forged paid flags, mismatched amounts, wrong merchant, replay, duplicate and concurrent callbacks.

### WP3 — iKhokha staging integration
- Validate the provider's current API contract and callback signature semantics.
- Verify raw request bytes are used where required, callback mapping is exact, and secret material is held only in server-side secret storage.
- Complete sandbox/test-mode payment lifecycle, failure, expiry, cancellation and duplicate-callback tests.
- Record provider account approval and production credential status without exposing secret values.

### WP4 — Ledger and reconciliation
- Prove balanced entries and immutable event history for successful, failed, reversed and refunded payments.
- Exercise refund retries, ambiguous provider responses and recovery.
- Match provider settlement statements to internal ledger and bank records in test/pilot evidence.

### WP5 — Operations, security and merchant experience
- Complete merchant onboarding and access control, checkout/payment-link UX, receipts, transaction history, refund operations and support workflows.
- Configure monitoring, redaction, alerting, key rotation, backups, restore and rollback.
- Publish internal operator and merchant integration documentation.

### WP6 — Release decision
- Assemble signed evidence for all gates.
- Obtain provider and legal/compliance approval for the exact operating model.
- Approve a limited internal pilot; expand only after reconciliation and incident-free operation.
- Keep external merchant launch blocked until its own approval and risk sign-off.

## Current explicit blockers

- No verified evidence yet of a live iKhokha merchant approval, live credentials, or completed real-money settlement.
- No verified evidence yet of a fully tested Cloudflare production deployment and D1 migration state for the canonical Worker.
- The Provisioner production adapter requires a configured IZAKHONO PAY verification endpoint and vault-managed credential; runtime configuration has not been verified.
- The caller-supplied `PaidOrder.payment.verified` boundary is a documented security concern and must be traced and closed before any paid order can trigger fulfillment.
- South African legal/regulatory scope for third-party merchant services, custody, stored value and payouts requires specialist confirmation.

## Release rule

**No live-money launch** until every mandatory gate is evidenced. Passing unit tests, a green deployment, or the presence of payment code is not sufficient. Keep sandbox/staging isolated from production and default-deny live processing.


## Additional deployment audit — 2026-11-19

The following issues were confirmed by inspecting the checked-in deployment configurations and workflows:

- `wrangler.production.jsonc` names the production D1 database but does not contain a `database_id`. The production workflow deploys the Worker before applying migrations and contains no verified database-provisioning step. Production deployment must not proceed until the intended D1 database is provisioned, its immutable ID is recorded, and the migration target is verified.
- The production config sets `PAYMENT_MODE=live` while `IKHOKHA_ENABLED`, `PAYSTACK_ENABLED`, and `PAYFAST_ENABLED` are false. Keep the production service in a non-money-moving, fail-closed mode until provider onboarding, credentials, merchant eligibility, and end-to-end controls are evidenced. A production runtime label must not imply that live payments are authorised.
- The default Worker config points to `src/index.ts`, while the sandbox and production configs point to `src/index.js`. The canonical entrypoint and route parity between these implementations must be established and tested before release; do not assume they are interchangeable.
- The existing PAY CI workflow runs syntax/unit checks and a Wrangler dry-run on relevant changes. The observed successful Cloudflare check for PR #677 is a preview build of the Builder Worker, not a deployment or acceptance test of the IZAKHONO PAY Worker.
- No connected Cloudflare deployment/secret-management action is available in this execution session. No production deployment, remote D1 migration, provider secret installation, or live transaction has been performed or verified here.

### Release disposition as of 2026-11-19

**Production launch: BLOCKED.** Do not merge or trigger the production workflow until the database identity/provisioning order, canonical entrypoint, fail-closed runtime mode, provider approval, and end-to-end acceptance evidence are resolved. A sandbox-only deployment may proceed through the dedicated sandbox workflow after its secrets and target account are verified. The current PR remains documentation-only and does not itself deploy IZAKHONO PAY.


## Safe production pipeline remediation — 2026-11-19

Committed on the launch branch:

- Production `PAYMENT_MODE` is now explicitly `disabled`; all provider enable flags remain false. This prevents the production health endpoint from advertising a live payment mode while launch approvals are outstanding.
- The production workflow no longer requires or installs iKhokha credentials for this disabled service deployment. Provider credentials remain outside the deployment until provider onboarding and the separately approved activation step.
- The workflow now validates that the production D1 binding has a syntactically valid, provisioned `database_id` before attempting any Worker deployment or remote migration. The current production config still has no database ID, so the workflow will intentionally stop at this preflight.
- The production health check now expects `mode=disabled`.

This is a fail-closed pipeline correction, not a production deployment. The production D1 database must be provisioned in the authorised Cloudflare account and its verified ID added to the production config before the workflow can proceed. No Cloudflare resources, secrets, production payment switches, or live transactions were changed by these commits.


### Additional fail-closed routing and operator-secret correction — 2026-11-19

- The payment core now treats `PAYMENT_MODE=disabled` as an unconditional routing stop before provider selection. This remains true even if provider credentials are accidentally present; sandbox mode retains its existing test-provider routing behaviour.
- Added a regression test proving disabled mode rejects iKhokha, Paystack and PayFast when all corresponding credentials are present.
- Restored installation of the owner-controlled `ADMIN_SECRET` as a separate production secret step after the Worker bootstrap and D1 migrations. Provider credentials are not installed by this workflow.
- These source changes require CI execution before merge. The production D1 identity is still absent, so the preflight continues to block deployment safely.


### CI remediation and deployment-order hardening — 2026-11-19

- Corrected rollback-learning feedback filtering so a recorded rollback decision actually excludes that candidate from the next sandbox cycle.
- Aligned the signal-ordering test with the implementation's impact-magnitude ordering (largest absolute movement first).
- Updated the experiment-persistence test fixture to supply the required verified synthetic measurement source; production telemetry remains separately classified.
- Corrected the optimization runner's reported measurement-source summary to read the persisted adapter record shape.
- Added an explicit all-zero D1 database ID placeholder to the production Wrangler config and made the deployment preflight reject that placeholder. This satisfies the layout contract while ensuring an unprovisioned database cannot pass preflight.
- Reordered the production pipeline to apply D1 migrations and verify that no merchant is active before deploying the Worker. The Worker remains payment-disabled; admin secret installation follows initial deployment.
- Latest CI run must be inspected after these commits; no production deployment is authorised or claimed.
