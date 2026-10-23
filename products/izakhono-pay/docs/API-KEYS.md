# IZAKHONO PAY — Merchant API Keys

Merchant API keys are the programmatic credentials used by a merchant's applications to call IZAKHONO PAY merchant-scoped APIs.

## Security model

- Raw API keys are generated once and never stored.
- Only a SHA-256 hash is persisted in `pay_api_keys`.
- A short key prefix is retained for identification in the dashboard.
- Keys can be revoked without deleting historical records.
- Issuance and revocation are recorded in `pay_auth_events`.
- Merchant-scoped endpoints reject keys belonging to another merchant.

## Endpoints

### Create a key

`POST /v1/merchants/:merchantId/api-keys`

Optional JSON body:

```json
{"label":"Production integration"}
```

The response contains `api_key` exactly once. Store it in a secrets manager or other protected configuration immediately.

### List keys

`GET /v1/merchants/:merchantId/api-keys`

The response never contains raw keys.

### Revoke a key

`POST /v1/merchants/:merchantId/api-keys/:keyId/revoke`

A revoked key can no longer authenticate.

## Dashboard sessions

The merchant dashboard continues to use an HTTP-only session cookie. API keys are used to establish the dashboard session and to authenticate server-to-server API calls.

## Control boundary

API-key management does not itself enable live money movement. Live processing remains gated by merchant onboarding, provider credentials, webhook registration, production infrastructure, legal/privacy readiness and end-to-end acceptance. Regulated payment movement remains with approved payment partners until IZAKHONO obtains any authorisations that may be required.
