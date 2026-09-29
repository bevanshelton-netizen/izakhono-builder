# PocketPOS production API contract

## Security boundary

The browser/PWA may manage catalogue, basket and UI state, but it must never store payment-provider secret keys or raw cardholder data. Staff authentication, multi-device sync, webhook verification, payment reconciliation and audit logging belong on the IZAKHONO backend.

## Core endpoints

- `POST /api/auth/login` — staff login, returns short-lived session.
- `POST /api/devices/enrol` — registers a merchant device.
- `GET /api/bootstrap` — merchant, branches, role permissions, products and stock.
- `POST /api/sales` — creates a pending sale using an idempotency key.
- `POST /api/sales/:id/cash` — owner/manager/cashier records a cash payment.
- `POST /api/sales/:id/eft` — records EFT only after staff verification.
- `POST /api/payments/ikpay/session` — backend creates an iK Pay checkout/session.
- `POST /api/payments/ikhokha/webhook` — verifies provider signature, writes payment_event and settles sale exactly once.
- `GET /api/sales/:id/receipt` — receipt payload suitable for print/share/WhatsApp.
- `GET /api/reports/day?branch_id=...` — branch/day turnover and payment mix.
- `POST /api/stock/adjustments` — controlled inventory movement with audit record.
- `POST /api/customers` and `GET /api/customers` — merchant CRM.
- `POST /api/staff` — owner/manager only.
- `POST /api/branches` — owner only.

## Payment rules

1. Never trust a browser-side success flag.
2. Online/card payments remain `pending` until a server-verified provider callback or server-side status lookup confirms success.
3. Use unique idempotency keys for sale creation and provider callbacks.
4. Never log PAN, CVV or PIN.
5. Secrets live in server environment bindings, not source code or localStorage.
6. Refunds and voids require elevated permission and an audit-log entry.

## Offline mode

The PWA may queue non-card business operations locally. Cash sales may be queued with a locally unique ID and reconciled when online. Card payments must not be marked paid offline unless the approved payment provider itself confirms approval through its certified flow.
