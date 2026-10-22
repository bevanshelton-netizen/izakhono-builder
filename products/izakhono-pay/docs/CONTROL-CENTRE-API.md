# IZAKHONO PAY Merchant Control Centre API

## Endpoint

`GET /v1/merchants/:merchantId/control-centre`

Requires the configured IZAKHONO PAY API bearer credential.

## Response domains

- `merchant`: merchant identity and onboarding status.
- `financials`: transaction count, processed volume, pending volume, settled net amount, active payment links and requested refunds.
- `compliance`: KYB check count.
- `providers`: provider health records including status, failure count and last check.
- `currency`: dashboard reporting currency.

## Boundary

The endpoint is a control-plane view. It does not itself move customer funds, approve merchants, or represent that a regulated service is live. Settlement data is reporting data supplied to the IZAKHONO PAY reconciliation layer.

## Ownership

IZAKHONO owns the merchant experience, API contract, orchestration and reporting view. Provider execution remains replaceable and regulated money movement remains subject to the applicable partner and regulatory gates.
