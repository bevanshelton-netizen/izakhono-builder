# @izakhono/pay-sdk

Provider-independent merchant SDK contract for IZAKHONO PAY.

## Design goals

- One merchant API surface regardless of underlying payment provider.
- Explicit idempotency for payment creation and refunds.
- No card data, CVV, PIN, OTP, credentials or provider secrets in SDK payloads.
- Provider changes remain an infrastructure concern, not a merchant integration rewrite.
- Sandbox and production base URLs are selected by configuration.

## Example

```js
import { IzakhonoPay } from "@izakhono/pay-sdk";

const pay = new IzakhonoPay({ apiKey: process.env.IZAKHONO_PAY_API_KEY });

const intent = await pay.createPaymentIntent({
  amount: 125000,
  currency: "ZAR",
  reference: "ORDER-1001",
  return_url: "https://merchant.example/success"
}, { idempotencyKey: "ORDER-1001-payment-v1" });
```

`amount` is an integer in the smallest currency unit. The SDK is an integration contract; actual money movement remains subject to the configured regulated/acquirer/payment-provider infrastructure and IZAKHONO's applicable authorisations.

## Initial resource contract

- `GET /v1/health`
- `POST /v1/payment-intents`
- `GET /v1/payment-intents/:id`
- `POST /v1/payment-intents/:id/cancel`
- `POST /v1/payment-intents/:id/refunds`
- `GET /v1/transactions`

This package is an implementation foundation, not evidence of live production endpoints or regulatory authorisation.
