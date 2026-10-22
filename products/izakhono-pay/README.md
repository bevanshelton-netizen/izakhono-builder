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
