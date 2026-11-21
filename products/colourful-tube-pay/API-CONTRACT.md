# COLOURFUL TUBE PAY API and control contract

Status: implementation specification for the next backend milestone. No endpoint in this document is live.

## Trust boundaries

- The browser is untrusted. It may request views and actions but cannot decide a payment is paid, a creator is verified, a balance is spendable, or a payout is complete.
- COLOURFUL TUBE PAY owns creator allocations, earnings presentation, payout requests and creator finance reporting.
- IZAKHONO PAY owns provider integration, collection intent, webhook verification, payment status confirmation and settlement/reconciliation interfaces.
- The payout provider is a separate integration and must be approved independently.
- All monetary amounts are integer minor units with explicit ISO currency. Never use floating-point arithmetic for financial posting.
- No provider secret, service-role key, bank credential or signing secret may reach the browser, logs or repository.

## Required server-side endpoints

| Method | Path | Purpose | Required controls |
|---|---|---|---|
| GET | /api/v1/creator/me/summary | Creator earnings summary | Authenticated creator; derive identity from verified session |
| GET | /api/v1/creator/me/ledger | Paginated creator ledger | Owner-scoped query; cursor pagination |
| GET | /api/v1/creator/me/payouts | Creator payout history | Owner-scoped query |
| POST | /api/v1/creator/me/payout-requests | Request a payout | Verified beneficiary; eligible status; idempotency key; available-balance lock |
| GET | /api/v1/admin/reconciliation | Reconciliation exceptions | Finance role + MFA + audit |
| POST | /api/v1/admin/allocations/approve | Approve a creator allocation batch | Finance role; maker-checker separation; policy version |
| POST | /api/v1/admin/payouts/:id/approve | Approve payout | Separate approver; beneficiary re-check; audit |
| POST | /api/v1/internal/provider-events | Provider event intake | Server-to-server only; signed source; replay protection; idempotency |

## Authentication and authorization

1. Use the platform's trusted identity provider. Never accept a creator ID or role supplied by the browser as authorization.
2. Resolve the authenticated subject server-side and map it to one active creator profile.
3. Creator endpoints can access only the caller's own records.
4. Finance administration is a separate server-side permission, not a user-editable profile field.
5. Require MFA for payout approval, beneficiary changes, policy changes and manual adjustments.
6. Use owner-controlled, least-privilege access. Default deny all unlisted routes and database operations.
7. Service credentials are server-only, scoped to the minimum required database and provider permissions.

## Financial invariants

- A provider event is not trusted until its signature, timestamp/replay window, merchant identity and provider-side payment status are verified.
- A unique provider event reference and idempotency key prevent duplicate processing.
- A collection is not creator revenue until confirmed, eligible and reconciled under the applicable policy.
- Allocation uses the approved, effective-dated policy and the distributable amount after the defined fees, refunds, chargebacks, tax reserves and agreed costs.
- Every posted ledger transaction balances debits and credits independently per currency.
- Posted transactions and audit events are append-only. Correct errors with a separately linked reversal.
- A payout request first reserves/holds funds. A provider response alone is not sufficient to mark paid; independently verify final payout status.
- A payout failure releases the hold through a balanced reversal/release transaction.
- No negative available balance; concurrent payout requests must lock or atomically reserve the balance.
- Daily reconciliation compares provider collections, internal ledger, creator allocations, payout provider and bank settlement records.

## Idempotency and event processing

Persist a unique idempotency key scoped by actor and operation. Store a request digest; if a key is reused with a different digest, reject it. Process provider events in a transaction that records the verified event, applies the state transition once, posts balanced entries and records the audit event. A retry returns the original outcome and does not post again.

## Error handling

Return stable machine-readable error codes without leaking provider payloads or internal database details. Use 401 for missing/invalid identity, 403 for insufficient permission, 409 for idempotency/state conflicts, 422 for invalid financial requests and 503 for unavailable provider dependencies. Never silently downgrade a failed verification into an accepted payment.

## Release gates

This contract does not authorize production processing. Before activation, complete the identity-provider decision, approved Supabase organization/project selection, RLS and database review, provider merchant approval, payout-provider selection, South African legal/compliance review, sandbox certification, penetration testing, reconciliation testing and owner acceptance.
