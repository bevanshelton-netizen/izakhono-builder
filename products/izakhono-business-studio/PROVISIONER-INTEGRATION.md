# Business Studio → Provisioner

The Business Studio produces a versioned business blueprint. The Provisioner consumes that blueprint through the adapter contract in provisioner-adapter.json.

## Payment authorization contract

Payment authorization is server-to-server only. Never accept a client-supplied payment.verified Boolean or a client-supplied receipt as proof of payment.

1. The Business Studio server loads the authoritative order from its own server-side order store. Order ID, merchant slug, blueprint, requested capabilities, amount and currency are server-derived; none are accepted from the browser request.
2. The Business Studio server creates an IZAKHONO PAY intent through izakhono-pay-gateway.ts using its server-only merchant API key.
3. The intent request includes metadata.order_id equal to the immutable Business Studio order ID. IZAKHONO PAY returns that value as merchant_reference only through the authenticated merchant intent response.
4. The Business Studio stores the returned intent ID, expected amount, currency, order ID and merchant slug in its server-side order record.
5. Before provisioning, provisionPaidOrder requires a PaymentVerifier and asks it to retrieve the intent from IZAKHONO PAY using server-side merchant authentication.
6. The verifier checks paid status, merchant slug, merchant_reference/order ID, intent ID, exact amount, currency, supported live provider, provider transaction reference and paid_at.
7. The orchestrator independently checks the returned receipt and refuses provisioning if any field is absent or mismatched.

Only a receipt marked IZAKHONO_PAY_SERVER and returned by the injected server-side verifier can pass the orchestration gate. The merchant API key must never be sent to the browser or included in a checkout response.

## Provisioning flow

Blueprint → server-side order → IZAKHONO PAY intent → hosted provider checkout → server-side payment verification → Provisioner Job → node selection → provisioning → health → deployment → edge → TLS → DNS → smoke test → rollback readiness → LIVE_VERIFIED.

The front end may display checkout status, but it cannot authorize fulfillment. Provider webhooks update IZAKHONO PAY state; the Business Studio server independently retrieves the authenticated intent before it starts provisioning.

## Runtime integration boundary

The front end is deliberately zero-dependency. Production payment and provisioning adapters remain server-side. The payment gateway module is an integration contract and must be instantiated only in a trusted server runtime with merchant credentials held in the secret store.

The runtime Provisioner accepts the blueprint, validates it against blueprint.schema.json, creates an auditable provisioning job, executes only requested capabilities, and transitions status only after each required acceptance check succeeds.
