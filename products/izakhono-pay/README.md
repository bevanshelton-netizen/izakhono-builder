# IZAKHONO PAY V1

**The African Business Money Operating System**

IZAKHONO PAY V1 owns the merchant experience, payment intent lifecycle, idempotency, event model, ledger metadata and reconciliation control plane. Regulated partners handle regulated money movement until IZAKHONO is appropriately authorised.

## V1
- Merchant registration/status
- Payment intents
- Payment links
- Hosted-checkout contract
- Idempotency keys
- Provider adapter contract
- Signed webhook ingestion
- Transaction/event ledger records
- Refund request records
- Settlement/reconciliation records
- Merchant dashboard API
- Sandbox mode

## Flow
Merchant → IZAKHONO PAY API → Payment Intent → Provider Adapter → Webhook → Ledger → Reconciliation → Merchant Dashboard

Providers are replaceable capacity adapters. No provider is the system of record.

## Security
Never store PAN/CVV or banking credentials. Require idempotency for money-moving commands. Verify provider webhooks before state mutation. Record provenance. Keep secrets server-side. Separate sandbox from production credentials.


## Cross-device merchant workspace

The authenticated device workspace is served at `/devices` and is designed for existing smartphones, tablets and computers.

- Merchant API-key sign-in; credentials remain in page memory and are cleared on sign-out.
- Live merchant summary and recent transaction activity through merchant-scoped APIs.
- Payment-link creation using the existing `POST /v1/payment-links` endpoint.
- Copy/share hosted checkout links without loading third-party scripts.
- Printable merchant transaction receipts.
- Installable PWA shell with a service worker that caches only the app shell; API responses and payment data are never cached.
- Responsive layouts adapt the same workspace to mobile, tablet and desktop screens.

OpenAPI-backed merchant endpoints remain authoritative. The workspace does not process card data, store PAN/CVV, hold funds, or infer payment success from a redirect, screenshot or QR scan. Only provider-verified transaction state is displayed. Tap-to-Phone remains disabled until an approved acquiring partner, supported device and certified solution are in place.

### Device workspace routes

- `GET /devices` — merchant workspace
- `GET /device.webmanifest` — install metadata
- `GET /device-icon.svg` — app icon
- `GET /device-sw.js` — app-shell-only service worker
