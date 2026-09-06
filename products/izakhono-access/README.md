# IZAKHONO ACCESS

Central subscription and entitlement service for IZAKHONO platforms.

## Purpose

A successful subscription payment should unlock the subscribed IZAKHONO product without a second artificial message-credit gate.

The service accepts signed `payment.paid` webhooks from IZAKHONO PAY and grants or extends a product entitlement for the subscriber.

## Subscriber access policy

For active subscribers:

- no per-message credit meter
- no per-session credit meter
- no arbitrary "work usage" quota
- access remains active while the paid entitlement is current
- capacity is still subject to fair-use safeguards and the compute/storage/network we own

This is not a promise of infinite compute. It is a promise that paid access is controlled by the subscription entitlement rather than a hidden vendor message counter.

## Integration contract

IZAKHONO PAY should include these metadata fields on subscription intents:

```json
{
  "access_entity_id": "faisready-entity",
  "access_subject": "customer@example.com",
  "access_product": "faisready",
  "access_plan": "monthly",
  "access_period_days": 30
}
```

After verified payment, IZAKHONO PAY already dispatches a signed `payment.paid` merchant webhook. Point that merchant webhook at:

```
POST /api/webhooks/izakhono-pay
```

with the shared secret configured as `IZAKHONO_PAY_WEBHOOK_SECRET`.

Internal products check access with:

```
POST /api/v1/check
x-izakhono-access-key: <internal-key>
content-type: application/json

{"entity_id":"faisready-entity","subject":"customer@example.com","product":"faisready"}
```

An active response contains `usage_credit_gate: false`, `message_quota: null`, and `session_quota: null`.

## Security

- webhook signatures use HMAC-SHA256 and a 5-minute timestamp window
- duplicate payment event IDs are idempotent
- access checks require an internal API key
- secrets are environment-only
- no card data is stored
- this service grants access only; settlement truth remains with IZAKHONO PAY


## Entity isolation

Every entitlement is scoped by `entity_id + subject + product`. The same email address can hold different subscriptions in separate entities without the records becoming interchangeable.
