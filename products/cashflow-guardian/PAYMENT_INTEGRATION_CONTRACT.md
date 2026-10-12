# CashFlow Guardian — Payment Integration Contract

## Purpose
Define the provider-neutral billing contract so CashFlow Guardian can accept a real Founder subscription without coupling the product to one payment provider.

## Commercial offer
- Product: CashFlow Guardian
- Plan: Founder
- Price hypothesis: R299/month
- Currency: ZAR
- Optional activation: R499 once-off, only when explicitly selected
- Billing: recurring monthly subscription

## Required checkout states
1. `not_started`
2. `checkout_created`
3. `pending`
4. `paid`
5. `failed`
6. `cancelled`
7. `refunded`

Only `paid` represents verified subscription revenue.

## Canonical revenue event
Every successful payment must normalize into:

```json
{
  "event_type": "subscription_payment_succeeded",
  "customer_id": "...",
  "product_id": "cashflow-guardian",
  "plan_id": "founder-monthly",
  "amount": 29900,
  "currency": "ZAR",
  "provider": "...",
  "provider_transaction_id": "...",
  "provider_customer_id": "...",
  "provider_subscription_id": "...",
  "paid_at": "ISO-8601",
  "status": "paid"
}
```

Amounts are stored in minor currency units: R299.00 = `29900` cents.

## Idempotency
- `provider_transaction_id` must be unique.
- Duplicate webhook/event delivery must not create duplicate revenue.
- A payment event must be persisted before it is counted in revenue metrics.

## Revenue rules
- Do not count button clicks, checkout creation, promises, quotations or failed payments as revenue.
- Do not activate paid-only entitlements until the provider confirms success.
- Preserve provider identifiers for reconciliation.
- Refunds and chargebacks must reverse the appropriate recognized revenue state.

## Provider adapter boundary
The application should depend on these operations, not provider-specific SDK calls:

- `createCheckout(customer, plan)`
- `getCheckoutStatus(reference)`
- `cancelSubscription(subscriptionId)`
- `normalizePaymentEvent(providerEvent)`
- `verifyPaymentEvent(providerEvent)`

## Launch gate
CashFlow Guardian is commercially live only when:

- checkout is connected to an approved payment provider;
- successful payment events are verified and normalized;
- duplicate events are safely handled;
- paid customer access is activated from verified payment state; and
- the first real payment is visible in the revenue ledger.

Until then, all pricing remains a hypothesis and the product stays in launch-validation mode.
