# IZAKHONO REVENUE

Reusable commercial layer and independently deployable owned service for IZAKHONO ventures.

## Default creator rule

Creator revenue administered through an IZAKHONO creator platform defaults to:

- creator/rightsholder side: 90%
- platform: 10%

A different creator fee requires an approved written agreement reference.

IZAKHONO-owned advertising, subscriptions, academy fees and platform services are company revenue and are not automatically subjected to a creator 90/10 split.

## Flow

Offer → booking → acceptance → invoice → payment handoff → fulfilment → statement → CLEARSET.

REVENUE does **not** hold customer funds and does not declare a payment provider or payment status live. IZAKHONO PAY remains the payment source of truth.

## FLOW adapter

The owned Node service exposes:

- `GET /health`
- `POST /api/flow`
- `GET /api/quotes`
- `GET /api/invoices`
- `GET /api/audit`

Every FLOW call requires both `X-Entity-ID` and `X-Platform-ID` and is authenticated with `REVENUE_FLOW_TOKEN`.

Supported FLOW actions:

- `quote.prepare.requested` → create an idempotent draft quote.
- `invoice.issue.requested` → create an idempotent draft invoice.

The service never invents a price. If FLOW does not provide an approved amount, the draft is created with `requires_pricing` or `requires_amount` set so the financial value remains unresolved.

## Local validation

```bash
cd products/izakhono-revenue
npm run check
docker build -t izakhono/revenue:0.2.0 .
```
