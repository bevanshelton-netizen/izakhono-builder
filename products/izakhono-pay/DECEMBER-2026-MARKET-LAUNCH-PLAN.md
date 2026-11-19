# IZAKHONO PAY — December 2026 Global Market Entry Plan

**Canonical product:** IZAKHONO PAY  
**Market reach:** Globally accessible product, documentation and merchant interest; first live-payment market subject to South African provider and regulatory approval  
**Target:** December 2026 controlled market entry  
**Operating model:** Non-custodial payment orchestration integrated with authorised payment providers  
**Global architecture:** See [GLOBAL-PLATFORM-ARCHITECTURE.md](./GLOBAL-PLATFORM-ARCHITECTURE.md)  
**Release posture:** Staged launch; live-money processing remains default-deny until provider, legal, security and operational gates are evidenced and approved for each country, currency, payment method and merchant.

## Market offer

Position IZAKHONO PAY as the merchant-facing payment operations layer: payment requests and links, hosted checkout handoff to an authorised provider, transaction visibility, merchant controls, refunds workflow, settlement visibility, reconciliation and developer APIs. The product and documentation should be reachable globally. Payment acceptance is enabled only for explicit approved capability combinations. Do not market IZAKHONO PAY as a bank, wallet, acquirer, custodian of funds or licensed payment system.

## December launch sequence

| Window | Outcome | Exit evidence |
|---|---|---|
| 19–24 November | Freeze authoritative product/runtime path and close payment-to-fulfilment trust boundary | Approved route/config/schema map; no caller-controlled paid Boolean; server-to-server payment verification binds merchant, order, amount, currency, provider transaction and paid status |
| 25–30 November | Sandbox release candidate and global-access foundation | Isolated sandbox Worker and D1; successful checkout, success/failure/cancel, signed webhook, replay/concurrency, refund request, ledger and reconciliation tests; responsive public product/docs/demo; explicit country capability status |
| 1–7 December | Global-facing controlled launch | Public product information, demo flow, developer documentation and merchant interest/onboarding intake reachable internationally; clear statement that unsupported countries are not live-enabled |
| 8–15 December | Closed South African merchant pilot, if all gates pass | Small, explicitly approved pilot cohort; merchant KYB and provider account checks; transaction monitoring; daily exception and reconciliation review; incident/rollback drill |
| 16–31 December | Limited commercial availability and first-country release decision | Release decision signed by owner; provider and legal/compliance approval; production D1 identity/migrations; end-to-end settlement evidence; support and incident coverage; staged cohort expansion |

Dates are delivery targets, not permission to bypass release gates. If a live-money gate is not passed, the global-facing product, developer information, demos and merchant interest intake may launch in controlled non-transactional mode while live processing remains disabled.

## Release gates

### A. Product and architecture
- Name one authoritative Worker entrypoint, schema and deployment config. The checked-in default config currently points to src/index.ts, while sandbox and production point to src/index.js; do not merge or deploy until route, schema and migration parity is documented.
- The inspected payment-intent route currently selects South Africa (ZA) explicitly. Global routing is not complete: country, currency and method must come from validated merchant/payment context and an explicit capability registry, never an untrusted caller override.
- Confirm production D1 is provisioned in the owner-authorised Cloudflare account, record its immutable ID, and prove migrations target that exact database.
- Keep production PAYMENT_MODE=disabled and all provider enable flags false until the signed live release decision.

### B. Payment trust and financial integrity
- Paid-order provisioning accepts only server-to-server verified payment evidence; bind exact merchant, order, customer, amount, currency, provider transaction ID, reference and paid/settled status.
- Verify raw-body provider signatures and durable replay/idempotency controls across instances.
- Test success, failure, cancellation, expiry, reversal, duplicate/concurrent callbacks, ambiguous provider responses and refund retries.
- Prove immutable event history, balanced ledger behaviour and provider-to-bank settlement reconciliation.

### C. Provider, legal and compliance
- Obtain written provider confirmation for the exact IZAKHONO operating model, merchant onboarding requirements, permitted flows and production account status.
- Obtain specialist South African payments counsel's written assessment of the exact product scope and contractual allocation of responsibilities.
- For every additional country, complete a separate local legal classification, provider/banking agreement, privacy/data-transfer review and financial-crime assessment before enabling payment processing.
- Complete merchant KYB, beneficial-owner checks where applicable, sanctions/fraud controls as required by provider and counsel, privacy notices, terms, complaints and dispute processes.
- No custody, stored value, pooling, payout, remittance or unapproved regulated activity.

### D. Operations and security
- Owner-only administrative access; least-privilege service identities; secrets in approved vault/provider secret store only.
- Production monitoring, redacted logs, alert routing, rate limits, key rotation, backup/restore proof, incident response and rollback rehearsal.
- Confirm support ownership, business-hours coverage, escalation contacts and merchant communications.

## Commercial launch acceptance

A merchant-facing release is accepted only when:
1. Product, docs and demo are reachable over HTTPS internationally and render accessibly on mobile and desktop.
2. Merchant can understand the offer, submit an onboarding request and receive a tracked response.
3. Approved merchant can create a payment request/link and see a deterministic transaction reference in the correct environment.
4. Checkout hands off only to the selected authorised provider's approved environment.
5. A valid signed provider event changes payment state exactly once; invalid, mismatched, replayed and ambiguous events fail safely.
6. Merchant can view transactions, refund request status and settlement/reconciliation information without cross-tenant access.
7. Support can investigate an event using correlation IDs without exposing credentials or sensitive payment data.
8. A release evidence pack records commit, deployment, migrations, test results, approvals, rollback and owner decision.
9. Every displayed country/currency/method availability statement matches the capability registry and current provider/legal approvals.

## Current evidence and known blockers — 19 November 2026

- Earlier baseline commit ce428d96edfd6e564eec11facb6d2ff843774f0d: PAY Alpha CI, Builder CI, OpenAI Independence CI, Application Manifest Validation and NODE01 Architecture Invariant passed.
- Payment trust-boundary implementation and tests committed; the five workflows on the trust-boundary source commit 46fa460fabd4f67734aa9833563b5762376d0d5a completed successfully.
- Package scripts now default local development and migrations to sandbox; direct deploy and direct production migration scripts fail closed and direct operators to owner-controlled workflows.
- Global architecture inspection confirms routing.ts supports country/currency/method selection, but inspected index.js currently hardcodes ZA and index.ts is a separate sandbox implementation. Global live routing is therefore not complete.
- Production D1 ID remains an all-zero placeholder and production payment mode is disabled.
- Cloudflare deployment access, provider production approval/credentials, legal/compliance confirmation and real settlement evidence have not been verified.
- Canonical runtime entrypoint and schema/migration parity remain unresolved.

## Release decision

December 2026 is the target for global product access and a controlled market entry. The product may be globally discoverable and usable for documentation, demo and merchant interest without implying live payment support in every country. Live payment activation is country-, currency-, method-, provider- and merchant-specific and requires all mandatory evidence plus explicit owner approval. No production merge, deployment, live credential installation or live transaction is authorised by this plan alone.
