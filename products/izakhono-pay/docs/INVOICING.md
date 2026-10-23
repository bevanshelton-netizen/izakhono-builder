# IZAKHONO PAY — Invoicing Engine

V1 adds merchant-owned customers and invoices to the IZAKHONO PAY control plane.

## Core capabilities

- Customer records scoped to a merchant.
- Invoice numbers unique per merchant.
- Multiple invoice line items with quantity, unit amount and tax rate.
- Draft → sent → partially paid → paid lifecycle, plus overdue/void states.
- Balance tracking and payment-event idempotency.
- Public invoice URL: `/invoice/:payment_token`.
- Public invoice payment-intent endpoint: `POST /v1/public/invoices/:payment_token/intent`.
- Merchant customer endpoints under `/v1/merchants/:merchantId/customers`.
- Merchant invoice endpoints under `/v1/merchants/:merchantId/invoices`.
- Send and void controls.

## Money boundary

The invoice engine is a business-control-plane feature. It does not make IZAKHONO PAY a bank, custodian or settlement institution. Payment movement remains provider-adapter/regulated-partner territory until applicable authorisations exist.

Public invoice pages explicitly identify the current environment as a controlled pilot. No live processing is claimed by this implementation.

## Next hardening layer

Before production use, add automated invoice tests, provider-specific payment/refund adapters, outbound email delivery, overdue automation, tax/invoice-number policy controls, and end-to-end reconciliation acceptance tests.
