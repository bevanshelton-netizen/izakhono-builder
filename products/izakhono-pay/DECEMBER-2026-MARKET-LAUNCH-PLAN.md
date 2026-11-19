# IZAKHONO PAY — December 2026 Market Launch Plan

**Canonical product:** IZAKHONO PAY  
**Market:** South Africa  
**Target:** December 2026 controlled market entry  
**Operating model:** Non-custodial payment orchestration integrated with authorised payment providers  
**Release posture:** Staged launch; live-money processing remains default-deny until provider, legal, security and operational gates are evidenced and approved.

## Market offer

Position IZAKHONO PAY as the merchant-facing payment operations layer: payment requests and links, hosted checkout handoff to an authorised provider, transaction visibility, merchant controls, refunds workflow, settlement visibility and reconciliation. Do not market IZAKHONO PAY as a bank, wallet, acquirer, custodian of funds or licensed payment system.

## December launch sequence

| Window | Outcome | Exit evidence |
|---|---|---|
| 19–24 November | Freeze authoritative product/runtime path and close payment-to-fulfilment trust boundary | Approved route/config/schema map; no caller-controlled paid Boolean; server-to-server payment verification binds merchant, order, amount, currency, provider transaction and paid status |
| 25–30 November | Sandbox release candidate | Isolated sandbox Worker and D1; successful checkout, success/failure/cancel, signed webhook, replay/concurrency, refund request, ledger and reconciliation tests; reproducible deployment and rollback evidence |
| 1–7 December | Market-facing controlled launch | Public product information, demo flow, merchant interest/onboarding intake, operator runbook, privacy/terms and support contact; no live money unless all live gates already passed |
| 8–15 December | Closed merchant pilot | Small, explicitly approved pilot cohort; merchant KYB and provider account checks; transaction monitoring; daily exception and reconciliation review; incident/rollback drill |
| 16–31 December | Limited commercial availability | Release decision signed by owner; provider and legal/compliance approval; production D1 identity/migrations; end-to-end settlement evidence; support and incident coverage; staged cohort expansion |

Dates are delivery targets, not permission to bypass release gates. If a live-money gate is not passed, the market-facing product and onboarding may launch in controlled non-transactional/demo mode while live processing remains disabled.

## Release gates

### A. Product and architecture
- Name one authoritative Worker entrypoint, schema and deployment config. The checked-in default config currently points to `src/index.ts`, while sandbox and production point to `src/index.js`; do not merge or deploy until the route, schema and migration parity decision is documented.
- Confirm the production D1 database is provisioned in the owner-authorised Cloudflare account, record its immutable ID, and prove migrations target that exact database.
- Keep production `PAYMENT_MODE=disabled` and all provider enable flags false until the signed live release decision.

### B. Payment trust and financial integrity
- Paid-order provisioning accepts only server-to-server verified payment evidence; bind exact merchant, order, customer, amount, currency, provider transaction ID, reference and paid/settled status.
- Verify raw-body provider signatures and durable replay/idempotency controls across instances.
- Test success, failure, cancellation, expiry, reversal, duplicate/concurrent callbacks, ambiguous provider responses and refund retries.
- Prove immutable event history, balanced ledger behaviour and provider-to-bank settlement reconciliation.

### C. Provider, legal and compliance
- Obtain written provider confirmation for the exact IZAKHONO operating model, merchant onboarding requirements, permitted flows and production account status.
- Obtain specialist South African payments counsel's written assessment of the exact product scope and contractual allocation of responsibilities.
- Complete merchant KYB, beneficial-owner checks where applicable, sanctions/fraud controls as required by provider and counsel, privacy notices, terms, complaints and dispute processes.
- No custody, stored value, pooling, payout or unapproved regulated activity.

### D. Operations and security
- Owner-only administrative access; least-privilege service identities; secrets in approved vault/provider secret store only.
- Production monitoring, redacted logs, alert routing, rate limits, key rotation, backup/restore proof, incident response and rollback rehearsal.
- Confirm support ownership, business-hours coverage, escalation contacts and merchant communications.

## Commercial launch acceptance

A merchant-facing release is accepted only when:
1. Merchant can understand the offer, submit an onboarding request and receive a tracked response.
2. Approved merchant can create a payment request/link and see a deterministic transaction reference.
3. Checkout hands off only to the selected authorised provider's approved environment.
4. A valid signed provider event changes payment state exactly once; invalid, mismatched, replayed and ambiguous events fail safely.
5. Merchant can view transactions, refund request status and settlement/reconciliation information without cross-tenant access.
6. Support can investigate an event using correlation IDs without exposing credentials or sensitive payment data.
7. A release evidence pack records commit, deployment, migrations, test results, approvals, rollback and owner decision.

## Current evidence and known blockers — 19 November 2026

- Five CI workflows on commit `ce428d96edfd6e564eec11facb6d2ff843774f0d` completed successfully before the latest trust-boundary change.
- The latest trust-boundary change replaces caller-supplied `payment.verified` with an injected authoritative payment evidence verifier and exact identity/amount/currency/status matching. Its CI is running; do not call it passed until the latest commit's checks complete.
- Production D1 ID remains an all-zero placeholder and production payment mode is disabled.
- The canonical `src/index.ts` versus `src/index.js` path and schema/migration parity remain unresolved.
- Cloudflare account ownership, production database provisioning and sandbox deployment evidence have not been verified in this execution.
- Provider production approval/credentials, legal/compliance opinion, real settlement evidence and external merchant pilot acceptance remain outstanding.
- The latest payment event-store and webhook replay fixes are committed in the controlled-launch PR; they do not by themselves constitute end-to-end provider acceptance.

## Release decision

**December market entry is the objective.** The safe fallback is a controlled market-facing launch with demos and merchant onboarding, while live-money processing remains disabled. No production merge, deployment, live credential installation or live transaction is authorised by this plan alone.